export type DesktopBridgeAction =
  | "next-slide"
  | "previous-slide"
  | "play-pause"
  | "mute"
  | "volume-up"
  | "volume-down"
  | "next-track"
  | "previous-track";

export type BridgePermissions = {
  presentation: boolean;
  media: boolean;
};

export type BridgeSecurityState = {
  online: boolean;
  version: string;
  security: string;
  sessionExpiresAt: number;
  emergencyLocked: boolean;
  permissions: BridgePermissions;
};

type BridgeSession = {
  sessionId: string;
  sessionSecret: string;
  expiresAt: number;
};

const BASE_URL = "http://127.0.0.1:3210";
const BOOTSTRAP_TOKEN = (
  import.meta.env as Record<string, string | boolean | undefined>
).VITE_RYKA_BRIDGE_BOOTSTRAP_TOKEN;

let activeSession: BridgeSession | null = null;
let sessionPromise: Promise<BridgeSession> | null = null;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function createNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function clearSession() {
  activeSession = null;
  sessionPromise = null;
}

async function createSession(signal?: AbortSignal) {
  if (!BOOTSTRAP_TOKEN || typeof BOOTSTRAP_TOKEN !== "string") {
    throw new Error("Secure bridge bootstrap token is unavailable. Run npm run dev:desktop.");
  }

  const response = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-RYKA-BOOTSTRAP": BOOTSTRAP_TOKEN,
    },
    body: "{}",
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    sessionId?: string;
    sessionSecret?: string;
    expiresAt?: number;
    error?: string;
  };

  if (
    !response.ok ||
    !data.ok ||
    !data.sessionId ||
    !data.sessionSecret ||
    !data.expiresAt
  ) {
    throw new Error(data.error || `Secure bridge session failed (${response.status}).`);
  }

  const session: BridgeSession = {
    sessionId: data.sessionId,
    sessionSecret: data.sessionSecret,
    expiresAt: data.expiresAt,
  };
  activeSession = session;
  return session;
}

async function ensureSession(signal?: AbortSignal) {
  if (activeSession && activeSession.expiresAt - Date.now() > 15_000) {
    return activeSession;
  }

  if (!sessionPromise) {
    sessionPromise = createSession(signal).finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

async function signedFetch(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
    retry?: boolean;
  } = {},
) {
  const method = options.method ?? "GET";
  const body = method === "POST" ? JSON.stringify(options.body ?? {}) : "";
  const session = await ensureSession(options.signal);
  const timestamp = String(Date.now());
  const nonce = createNonce();
  const bodyDigest = await sha256(body);
  const canonical = [method, path, timestamp, nonce, bodyDigest].join("\n");
  const signature = await hmacSha256(session.sessionSecret, canonical);

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal: options.signal,
    cache: "no-store",
    headers: {
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      "X-RYKA-SESSION": session.sessionId,
      "X-RYKA-TIMESTAMP": timestamp,
      "X-RYKA-NONCE": nonce,
      "X-RYKA-SIGNATURE": signature,
    },
    body: method === "POST" ? body : undefined,
  });

  if (
    options.retry !== false &&
    [401, 403].includes(response.status)
  ) {
    clearSession();
    return signedFetch(path, { ...options, retry: false });
  }

  return response;
}

async function readBridgeResponse<T>(response: Response) {
  const data = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Bridge request failed (${response.status}).`);
  }
  return data;
}

export async function getBridgeSecurityState(
  signal?: AbortSignal,
): Promise<BridgeSecurityState> {
  const response = await signedFetch("/health", { signal });
  const data = await readBridgeResponse<{
    ok: boolean;
    version: string;
    security: string;
    sessionExpiresAt: number;
    emergencyLocked: boolean;
    permissions: BridgePermissions;
  }>(response);

  return {
    online: true,
    version: data.version,
    security: data.security,
    sessionExpiresAt: data.sessionExpiresAt,
    emergencyLocked: data.emergencyLocked,
    permissions: data.permissions,
  };
}

export async function checkDesktopBridge(signal?: AbortSignal) {
  try {
    await getBridgeSecurityState(signal);
    return true;
  } catch {
    return false;
  }
}

export async function sendDesktopAction(action: DesktopBridgeAction) {
  const response = await signedFetch("/action", {
    method: "POST",
    body: { action },
  });
  await readBridgeResponse<{ ok: boolean; action: DesktopBridgeAction }>(response);
}

export async function updateBridgePermissions(permissions: BridgePermissions) {
  const response = await signedFetch("/permissions", {
    method: "POST",
    body: permissions,
  });
  const data = await readBridgeResponse<{
    ok: boolean;
    permissions: BridgePermissions;
  }>(response);
  return data.permissions;
}

export async function emergencyStopBridge() {
  const response = await signedFetch("/emergency-stop", {
    method: "POST",
    body: { reason: "operator-request" },
    retry: false,
  });
  await readBridgeResponse<{ ok: boolean; emergencyLocked: boolean }>(response);
  clearSession();
}

export async function armBridge() {
  const response = await signedFetch("/arm", {
    method: "POST",
    body: { confirm: "ARM RYKA" },
  });
  const data = await readBridgeResponse<{
    ok: boolean;
    emergencyLocked: boolean;
  }>(response);
  return data.emergencyLocked;
}
