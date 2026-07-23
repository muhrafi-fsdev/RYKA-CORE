import http from "node:http";
import { execFile } from "node:child_process";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = 3210;
const BRIDGE_VERSION = "2.0.0";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 10_000;
const MAX_BODY_BYTES = 4096;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 1000;
const FAILURE_LIMIT = 10;
const FAILURE_LOCK_MS = 30_000;
const AUDIT_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3200",
  "http://127.0.0.1:3200",
]);
const ALLOWED_HOSTS = new Set([
  `127.0.0.1:${PORT}`,
  `localhost:${PORT}`,
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const auditDirectory = join(projectRoot, "logs");
const auditFile = join(auditDirectory, "security-audit.jsonl");

const bootstrapToken = process.env.RYKA_BRIDGE_BOOTSTRAP_TOKEN;
if (!bootstrapToken || bootstrapToken.length < 32) {
  console.error(
    "[RYKA SECURITY] Missing secure bootstrap token. Run the bridge through npm run dev:desktop.",
  );
  process.exit(1);
}

const SEND_KEYS = Object.freeze({
  "next-slide": "{RIGHT}",
  "previous-slide": "{LEFT}",
});

const MEDIA_KEYS = Object.freeze({
  "play-pause": 0xb3,
  mute: 0xad,
  "volume-up": 0xaf,
  "volume-down": 0xae,
  "next-track": 0xb0,
  "previous-track": 0xb1,
});

const ACTION_CATEGORY = Object.freeze({
  "next-slide": "presentation",
  "previous-slide": "presentation",
  "play-pause": "media",
  mute: "media",
  "volume-up": "media",
  "volume-down": "media",
  "next-track": "media",
  "previous-track": "media",
});

const permissions = {
  presentation: true,
  media: true,
};

const sessions = new Map();
const failedClients = new Map();
let emergencyLocked = false;

function nowIso() {
  return new Date().toISOString();
}

function rotateAuditLog() {
  try {
    if (!existsSync(auditFile)) return;
    if (statSync(auditFile).size < AUDIT_MAX_BYTES) return;
    const archived = join(auditDirectory, `security-audit-${Date.now()}.jsonl`);
    renameSync(auditFile, archived);
  } catch {
    // Security logging must never crash the bridge.
  }
}

function audit(event, details = {}) {
  try {
    mkdirSync(auditDirectory, { recursive: true });
    rotateAuditLog();
    appendFileSync(
      auditFile,
      `${JSON.stringify({ timestamp: nowIso(), event, ...details })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } catch {
    // Security logging must never crash the bridge.
  }
}

function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "X-RYKA-BOOTSTRAP",
      "X-RYKA-SESSION",
      "X-RYKA-TIMESTAMP",
      "X-RYKA-NONCE",
      "X-RYKA-SIGNATURE",
    ].join(", "),
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function json(res, status, payload) {
  setSecurityHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function safeEqualText(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  if (first.length !== second.length) return false;
  return timingSafeEqual(first, second);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalRequest(method, path, timestamp, nonce, body) {
  return [method.toUpperCase(), path, timestamp, nonce, sha256(body)].join("\n");
}

function clientKey(req) {
  return req.socket.remoteAddress || "local";
}

function isClientLocked(req) {
  const entry = failedClients.get(clientKey(req));
  if (!entry) return false;
  if (entry.lockedUntil <= Date.now()) {
    failedClients.delete(clientKey(req));
    return false;
  }
  return true;
}

function registerFailure(req, reason) {
  const key = clientKey(req);
  const current = failedClients.get(key) ?? { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= FAILURE_LIMIT) {
    current.lockedUntil = Date.now() + FAILURE_LOCK_MS;
    current.count = 0;
    audit("client-temporarily-locked", { client: key, reason });
  }
  failedClients.set(key, current);
}

function clearFailures(req) {
  failedClients.delete(clientKey(req));
}

function validateRequestEnvelope(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;

  if (!host || !ALLOWED_HOSTS.has(host)) {
    return { ok: false, status: 403, error: "Invalid Host header." };
  }
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return { ok: false, status: 403, error: "Origin is not allowed." };
  }
  if (isClientLocked(req)) {
    return { ok: false, status: 429, error: "Client temporarily locked." };
  }
  return { ok: true };
}

function purgeExpiredSessions() {
  const current = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt <= current) sessions.delete(id);
  }
}

function createSession() {
  purgeExpiredSessions();
  const id = randomBytes(18).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(id, {
    secret,
    expiresAt,
    nonces: new Map(),
    requests: [],
  });
  return { id, secret, expiresAt };
}

function consumeRateLimit(session) {
  const current = Date.now();
  session.requests = session.requests.filter(
    (time) => current - time < RATE_LIMIT_WINDOW_MS,
  );
  if (session.requests.length >= RATE_LIMIT_MAX) return false;
  session.requests.push(current);
  return true;
}

function verifySignedRequest(req, body) {
  purgeExpiredSessions();

  const sessionId = req.headers["x-ryka-session"];
  const timestampText = req.headers["x-ryka-timestamp"];
  const nonce = req.headers["x-ryka-nonce"];
  const suppliedSignature = req.headers["x-ryka-signature"];

  if (
    typeof sessionId !== "string" ||
    typeof timestampText !== "string" ||
    typeof nonce !== "string" ||
    typeof suppliedSignature !== "string"
  ) {
    return { ok: false, status: 401, error: "Missing signed request headers." };
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return { ok: false, status: 401, error: "Session is invalid or expired." };
  }

  const timestamp = Number(timestampText);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, error: "Request timestamp is outside the accepted window." };
  }

  const nonceExpiry = session.nonces.get(nonce);
  if (nonceExpiry && nonceExpiry > Date.now()) {
    return { ok: false, status: 409, error: "Replay request rejected." };
  }

  for (const [savedNonce, expiry] of session.nonces.entries()) {
    if (expiry <= Date.now()) session.nonces.delete(savedNonce);
  }

  const path = req.url || "/";
  const canonical = canonicalRequest(req.method || "GET", path, timestampText, nonce, body);
  const expected = createHmac("sha256", session.secret)
    .update(canonical)
    .digest("base64url");

  if (!safeEqualText(expected, suppliedSignature)) {
    return { ok: false, status: 401, error: "Invalid request signature." };
  }

  if (!consumeRateLimit(session)) {
    return { ok: false, status: 429, error: "Desktop action rate limit exceeded." };
  }

  session.nonces.set(nonce, Date.now() + MAX_CLOCK_SKEW_MS * 2);
  return { ok: true, sessionId, session };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let exceeded = false;

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      if (exceeded) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        exceeded = true;
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
      }
    });
    req.on("end", () => {
      if (!exceeded) resolve(body);
    });
    req.on("error", reject);
  });
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
      { windowsHide: true, timeout: 5000, maxBuffer: 128 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

async function executeAction(action) {
  if (!(action in SEND_KEYS) && !(action in MEDIA_KEYS)) {
    throw Object.assign(new Error("Action is not in the desktop allowlist."), {
      status: 400,
    });
  }

  if (emergencyLocked) {
    throw Object.assign(new Error("RYKA desktop control is emergency locked."), {
      status: 423,
    });
  }

  const category = ACTION_CATEGORY[action];
  if (!permissions[category]) {
    throw Object.assign(new Error(`${category} permission is disabled.`), {
      status: 403,
    });
  }

  if (process.platform !== "win32") {
    throw Object.assign(
      new Error("Desktop bridge actions are currently supported on Windows only."),
      { status: 501 },
    );
  }

  if (SEND_KEYS[action]) {
    const escaped = SEND_KEYS[action].replaceAll("'", "''");
    await runPowerShell(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`,
    );
    return;
  }

  const keyCode = MEDIA_KEYS[action];
  await runPowerShell(`
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RykaMediaKey {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
'@;
[RykaMediaKey]::keybd_event(${keyCode}, 0, 0, [UIntPtr]::Zero);
Start-Sleep -Milliseconds 40;
[RykaMediaKey]::keybd_event(${keyCode}, 0, 2, [UIntPtr]::Zero);
`);
}

function parseJson(body) {
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

function sendAuthFailure(req, res, verification) {
  registerFailure(req, verification.error);
  audit("request-rejected", {
    client: clientKey(req),
    path: req.url,
    reason: verification.error,
  });
  json(res, verification.status, { ok: false, error: verification.error });
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  setCors(req, res);

  const envelope = validateRequestEnvelope(req);
  if (!envelope.ok) {
    registerFailure(req, envelope.error);
    json(res, envelope.status, { ok: false, error: envelope.error });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const body = req.method === "POST" ? await readBody(req) : "";

    if (req.method === "POST" && req.url === "/session") {
      const supplied = req.headers["x-ryka-bootstrap"];
      if (typeof supplied !== "string" || !safeEqualText(supplied, bootstrapToken)) {
        registerFailure(req, "invalid-bootstrap-token");
        audit("bootstrap-rejected", { client: clientKey(req) });
        json(res, 403, { ok: false, error: "Bootstrap authentication failed." });
        return;
      }

      const session = createSession();
      clearFailures(req);
      audit("session-created", {
        client: clientKey(req),
        sessionId: session.id,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
      json(res, 201, {
        ok: true,
        sessionId: session.id,
        sessionSecret: session.secret,
        expiresAt: session.expiresAt,
        permissions,
        emergencyLocked,
      });
      return;
    }

    const verification = verifySignedRequest(req, body);
    if (!verification.ok) {
      sendAuthFailure(req, res, verification);
      return;
    }
    clearFailures(req);

    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, {
        ok: true,
        platform: process.platform,
        version: BRIDGE_VERSION,
        security: "HMAC-SHA256",
        sessionExpiresAt: verification.session.expiresAt,
        emergencyLocked,
        permissions,
        actions: [...Object.keys(SEND_KEYS), ...Object.keys(MEDIA_KEYS)],
      });
      return;
    }

    if (req.method === "GET" && req.url === "/permissions") {
      json(res, 200, { ok: true, permissions, emergencyLocked });
      return;
    }

    if (req.method === "POST" && req.url === "/permissions") {
      const payload = parseJson(body);
      if (
        typeof payload.presentation !== "boolean" ||
        typeof payload.media !== "boolean"
      ) {
        json(res, 400, { ok: false, error: "Invalid permission payload." });
        return;
      }
      permissions.presentation = payload.presentation;
      permissions.media = payload.media;
      audit("permissions-updated", {
        sessionId: verification.sessionId,
        permissions: { ...permissions },
      });
      json(res, 200, { ok: true, permissions });
      return;
    }

    if (req.method === "POST" && req.url === "/emergency-stop") {
      emergencyLocked = true;
      sessions.clear();
      audit("emergency-stop", { client: clientKey(req) });
      json(res, 200, { ok: true, emergencyLocked: true });
      return;
    }

    if (req.method === "POST" && req.url === "/arm") {
      const payload = parseJson(body);
      if (payload.confirm !== "ARM RYKA") {
        json(res, 400, { ok: false, error: "Explicit arm confirmation is required." });
        return;
      }
      emergencyLocked = false;
      audit("bridge-armed", { sessionId: verification.sessionId });
      json(res, 200, { ok: true, emergencyLocked: false });
      return;
    }

    if (req.method === "POST" && req.url === "/action") {
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
        json(res, 415, { ok: false, error: "Content-Type must be application/json." });
        return;
      }
      const payload = parseJson(body);
      if (typeof payload.action !== "string") {
        json(res, 400, { ok: false, error: "Invalid action payload." });
        return;
      }

      await executeAction(payload.action);
      audit("desktop-action", {
        sessionId: verification.sessionId,
        action: payload.action,
      });
      json(res, 200, { ok: true, action: payload.action });
      return;
    }

    json(res, 404, { ok: false, error: "Not found." });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const message = error instanceof Error ? error.message : "Desktop bridge failure.";
    audit("bridge-error", { path: req.url, status, message });
    json(res, status, { ok: false, error: message });
  }
});

server.on("clientError", (error, socket) => {
  audit("client-error", { message: error.message });
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(PORT, HOST, () => {
  audit("bridge-started", { host: HOST, port: PORT, version: BRIDGE_VERSION });
  console.log(`[RYKA CORE SECURE BRIDGE] ONLINE http://${HOST}:${PORT}`);
  console.log("[RYKA CORE SECURE BRIDGE] HMAC sessions, replay protection, rate limiting, and audit logging enabled.");
  console.log("[RYKA CORE SECURE BRIDGE] Press Ctrl+C to stop.");
});

function shutdown(signal) {
  audit("bridge-stopped", { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 800).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
