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

  console.log("[SECURE BRIDGE TEST] PASS // session, HMAC, replay rejection, emergency stop, and re-arm verified.");
} finally {
  child.kill("SIGTERM");
}
