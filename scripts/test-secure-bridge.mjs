import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "scripts", "windows-bridge.mjs");
const token = randomBytes(32).toString("base64url");
const origin = "http://127.0.0.1:3200";
const base = "http://127.0.0.1:3210";

const child = spawn(process.execPath, [entry], {
  cwd: root,
  env: { ...process.env, RYKA_BRIDGE_BOOTSTRAP_TOKEN: token },
  stdio: ["ignore", "pipe", "pipe"],
});

function waitForReady() {
  return new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error("Bridge startup timed out.")), 5000);
    const onData = (chunk) => {
      if (String(chunk).includes("ONLINE")) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolveReady();
      }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => reject(new Error(`Bridge exited early (${code}).`)));
  });
}

function hashBody(body) {
  return createHash("sha256").update(body).digest("hex");
}

function signedHeaders(session, method, path, body, nonce = randomBytes(18).toString("base64url")) {
  const timestamp = String(Date.now());
  const canonical = [method, path, timestamp, nonce, hashBody(body)].join("\n");
  return {
    timestamp,
    nonce,
    headers: {
      Origin: origin,
      "X-RYKA-SESSION": session.sessionId,
      "X-RYKA-TIMESTAMP": timestamp,
      "X-RYKA-NONCE": nonce,
      "X-RYKA-SIGNATURE": createHmac("sha256", session.sessionSecret)
        .update(canonical)
        .digest("base64url"),
    },
  };
}

async function createSession() {
  const response = await fetch(`${base}/session`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-RYKA-BOOTSTRAP": token,
    },
    body: "{}",
  });
  if (response.status !== 201) throw new Error(`Session creation failed: ${response.status}`);
  return response.json();
}

try {
  await waitForReady();
  const session = await createSession();

  const signed = signedHeaders(session, "GET", "/health", "");
  const health = await fetch(`${base}/health`, { headers: signed.headers });
  if (health.status !== 200) throw new Error(`Signed health failed: ${health.status}`);

  const replay = await fetch(`${base}/health`, { headers: signed.headers });
  if (replay.status !== 409) throw new Error(`Replay was not rejected: ${replay.status}`);

  const unsigned = await fetch(`${base}/health`, { headers: { Origin: origin } });
  if (unsigned.status !== 401) throw new Error(`Unsigned request was not rejected: ${unsigned.status}`);

  const emergencyBody = JSON.stringify({ reason: "test" });
  const emergencyHeaders = signedHeaders(session, "POST", "/emergency-stop", emergencyBody);
  const emergency = await fetch(`${base}/emergency-stop`, {
    method: "POST",
    headers: { ...emergencyHeaders.headers, "Content-Type": "application/json" },
    body: emergencyBody,
  });
  if (emergency.status !== 200) throw new Error(`Emergency stop failed: ${emergency.status}`);

  const rearmSession = await createSession();
  const armBody = JSON.stringify({ confirm: "ARM RYKA" });
  const armHeaders = signedHeaders(rearmSession, "POST", "/arm", armBody);
  const armed = await fetch(`${base}/arm`, {
    method: "POST",
    headers: { ...armHeaders.headers, "Content-Type": "application/json" },
    body: armBody,
  });
  if (armed.status !== 200) throw new Error(`Bridge re-arm failed: ${armed.status}`);

  // Pointer control: opt-in, validated, separately rate limited, revoked by emergency stop.
  const call = async (path, payload, method = "POST") => {
    const body = method === "POST" ? JSON.stringify(payload) : "";
    const { headers } = signedHeaders(rearmSession, method, path, body);
    return fetch(`${base}${path}`, {
      method,
      headers: method === "POST" ? { ...headers, "Content-Type": "application/json" } : headers,
      body: method === "POST" ? body : undefined,
    });
  };
  const expectStatus = async (label, response, status) => {
    if (response.status !== status) {
      throw new Error(`${label}: expected ${status}, got ${response.status} ${await response.text()}`);
    }
  };

  await expectStatus("pointer is off by default", await call("/pointer", { op: "move", x: 0.5, y: 0.5 }), 403);
  const defaults = await (await call("/permissions", null, "GET")).json();
  if (defaults.permissions.pointer !== false) throw new Error("Pointer permission must default to false.");

  await expectStatus(
    "enable pointer",
    await call("/permissions", { presentation: true, media: true, pointer: true }),
    200,
  );
  await expectStatus("unknown op", await call("/pointer", { op: "format-c" }), 400);
  await expectStatus("x out of range", await call("/pointer", { op: "move", x: 1.5, y: 0.5 }), 400);
  await expectStatus("y not a number", await call("/pointer", { op: "move", x: 0.5, y: "0.5" }), 400);
  await expectStatus("extra field", await call("/pointer", { op: "down", cmd: "calc" }), 400);
  await expectStatus("not an object", await call("/pointer", [1, 2]), 400);

  // /action is limited to 5 requests per second, /pointer has its own bucket.
  for (let index = 0; index < 12; index += 1) {
    await expectStatus(`pointer burst ${index}`, await call("/pointer", { op: "format-c" }), 400);
  }

  // The regular 5-per-second limit still applies to every other route.
  const pause = () => new Promise((resolvePause) => setTimeout(resolvePause, 1100));
  await pause();
  await expectStatus("old two-field permissions still accepted", await call("/permissions", { presentation: true, media: true }), 200);
  const kept = await (await call("/permissions", null, "GET")).json();
  if (kept.permissions.pointer !== true) throw new Error("Omitting pointer must keep its value.");
  await expectStatus("bad pointer permission type", await call("/permissions", { presentation: true, media: true, pointer: "yes" }), 400);

  await pause();
  await expectStatus("emergency stop", await call("/emergency-stop", { reason: "test" }), 200);
  const afterStop = await createSession();
  const afterStopHeaders = signedHeaders(afterStop, "POST", "/arm", JSON.stringify({ confirm: "ARM RYKA" }));
  await fetch(`${base}/arm`, {
    method: "POST",
    headers: { ...afterStopHeaders.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "ARM RYKA" }),
  });
  const permsHeaders = signedHeaders(afterStop, "GET", "/permissions", "");
  const revoked = await (await fetch(`${base}/permissions`, { headers: permsHeaders.headers })).json();
  if (revoked.permissions.pointer !== false) throw new Error("Emergency stop must revoke pointer permission.");

  console.log("[SECURE BRIDGE TEST] PASS // session, HMAC, replay rejection, emergency stop, re-arm, and pointer opt-in/validation/revocation verified.");
} finally {
  child.kill("SIGTERM");
}
