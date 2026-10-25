/// <reference types="node" />
import { createHash, createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Every test re-imports the module (vi.resetModules) to get a clean session
// state; that import is slow while the whole suite runs in parallel.
vi.setConfig({ testTimeout: 30_000 });

type RecordedCall = {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

type Reply = { status?: number; json?: unknown };
type Handler = (call: RecordedCall, index: number) => Reply | Promise<Reply>;

// Generated per run so no credential-shaped literal lives in the repository.
const SESSION_SECRET = randomBytes(24).toString("hex");
const BOOTSTRAP = randomBytes(24).toString("hex");

function sessionReply(overrides: Partial<{ id: string; expiresAt: number }> = {}): Reply {
  return {
    json: {
      ok: true,
      sessionId: overrides.id ?? "sid-1",
      sessionSecret: SESSION_SECRET,
      expiresAt: overrides.expiresAt ?? Date.now() + 30 * 60 * 1000,
    },
  };
}

function installFetch(handler: Handler) {
  const calls: Array<RecordedCall> = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: RecordedCall = {
      path: url.pathname,
      method: init?.method ?? "GET",
      headers: { ...(init?.headers as Record<string, string> | undefined) },
      body: typeof init?.body === "string" ? init.body : "",
    };
    calls.push(call);
    const reply = await handler(call, calls.length - 1);
    return new Response(JSON.stringify(reply.json ?? { ok: true }), {
      status: reply.status ?? 200,
    });
  });
  vi.stubGlobal("fetch", mock);
  return { calls, mock, of: (path: string) => calls.filter((call) => call.path === path) };
}

async function loadBridge(token = BOOTSTRAP) {
  vi.resetModules();
  vi.stubEnv("VITE_RYKA_BRIDGE_BOOTSTRAP_TOKEN", token);
  return import("@/lib/desktopBridge");
}

function expectedSignature(call: RecordedCall) {
  const canonical = [
    call.method,
    call.path,
    call.headers["X-RYKA-TIMESTAMP"],
    call.headers["X-RYKA-NONCE"],
    createHash("sha256").update(call.body).digest("hex"),
  ].join("\n");
  return createHmac("sha256", SESSION_SECRET).update(canonical).digest("base64url");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("desktopBridge session bootstrap", () => {
  it("refuses to talk to the bridge without a bootstrap token", async () => {
    const server = installFetch(() => sessionReply());
    const bridge = await loadBridge("");

    await expect(bridge.sendDesktopAction("mute")).rejects.toThrow(
      /bootstrap token is unavailable/i,
    );
    expect(server.mock).not.toHaveBeenCalled();
  });

  it("opens a session with the bootstrap header and no signature", async () => {
    const server = installFetch((call) =>
      call.path === "/session" ? sessionReply() : { json: { ok: true } },
    );
    const bridge = await loadBridge();

    await bridge.sendDesktopAction("mute");

    const [session] = server.of("/session");
    expect(session.method).toBe("POST");
    expect(session.headers["X-RYKA-BOOTSTRAP"]).toBe(BOOTSTRAP);
    expect(session.headers["X-RYKA-SIGNATURE"]).toBeUndefined();
  });

  it("surfaces the server error when the session is rejected", async () => {
    installFetch(() => ({ status: 429, json: { ok: false, error: "Too many attempts." } }));
    const bridge = await loadBridge();

    await expect(bridge.sendDesktopAction("mute")).rejects.toThrow("Too many attempts.");
  });

  it("can open a session again after a failed attempt", async () => {
    const server = installFetch((call, index) => {
      if (call.path === "/session") {
        return index === 0 ? { status: 500, json: { ok: false } } : sessionReply();
      }
      return { json: { ok: true } };
    });
    const bridge = await loadBridge();

    await expect(bridge.sendDesktopAction("mute")).rejects.toThrow();
    await expect(bridge.sendDesktopAction("mute")).resolves.toBeUndefined();
    expect(server.of("/session")).toHaveLength(2);
  });

  it("shares one session between concurrent requests and reuses it afterwards", async () => {
    const server = installFetch((call) =>
      call.path === "/session" ? sessionReply() : { json: { ok: true } },
    );
    const bridge = await loadBridge();

    await Promise.all([
      bridge.sendDesktopAction("mute"),
      bridge.sendDesktopAction("play-pause"),
    ]);
    await bridge.sendDesktopAction("volume-up");

    expect(server.of("/session")).toHaveLength(1);
    expect(server.of("/action")).toHaveLength(3);
  });

  it("renews a session that is about to expire", async () => {
    let issued = 0;
    const server = installFetch((call) => {
      if (call.path !== "/session") return { json: { ok: true } };
      issued += 1;
      return sessionReply({ id: `sid-${issued}`, expiresAt: Date.now() + 5_000 });
    });
    const bridge = await loadBridge();

    await bridge.sendDesktopAction("mute");
    await bridge.sendDesktopAction("mute");

    expect(server.of("/session")).toHaveLength(2);
    expect(server.of("/action")[1].headers["X-RYKA-SESSION"]).toBe("sid-2");
  });
});

describe("desktopBridge request signing", () => {
  it("signs POST requests with an HMAC that matches the server algorithm", async () => {
    const server = installFetch((call) =>
      call.path === "/session" ? sessionReply() : { json: { ok: true } },
    );
    const bridge = await loadBridge();

    await bridge.sendDesktopAction("next-slide");

    const [action] = server.of("/action");
    expect(action.method).toBe("POST");
    expect(action.body).toBe(JSON.stringify({ action: "next-slide" }));
    expect(action.headers["Content-Type"]).toBe("application/json");
    expect(action.headers["X-RYKA-SESSION"]).toBe("sid-1");
    expect(action.headers["X-RYKA-SIGNATURE"]).toBe(expectedSignature(action));
  });

  it("signs GET requests over an empty body", async () => {
    const server = installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : {
            json: {
              ok: true,
              version: "4.4.0",
              security: "HMAC-SHA256",
              sessionExpiresAt: 123,
              emergencyLocked: false,
              permissions: { presentation: true, media: false },
            },
          },
    );
    const bridge = await loadBridge();

    await bridge.getBridgeSecurityState();

    const [health] = server.of("/health");
    expect(health.method).toBe("GET");
    expect(health.body).toBe("");
    expect(health.headers["Content-Type"]).toBeUndefined();
    expect(health.headers["X-RYKA-SIGNATURE"]).toBe(expectedSignature(health));
  });

  it("uses a fresh nonce and a numeric timestamp for every request", async () => {
    const server = installFetch((call) =>
      call.path === "/session" ? sessionReply() : { json: { ok: true } },
    );
    const bridge = await loadBridge();

    await bridge.sendDesktopAction("mute");
    await bridge.sendDesktopAction("mute");

    const [first, second] = server.of("/action");
    expect(first.headers["X-RYKA-NONCE"]).not.toBe(second.headers["X-RYKA-NONCE"]);
    expect(first.headers["X-RYKA-NONCE"]).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(Number(first.headers["X-RYKA-TIMESTAMP"])).toBeGreaterThan(0);
  });
});

describe("desktopBridge retry behaviour", () => {
  it("retries once with a new session after a 401", async () => {
    let issued = 0;
    let actionCalls = 0;
    const server = installFetch((call) => {
      if (call.path === "/session") {
        issued += 1;
        return sessionReply({ id: `sid-${issued}` });
      }
      actionCalls += 1;
      return actionCalls === 1
        ? { status: 401, json: { ok: false, error: "expired" } }
        : { json: { ok: true } };
    });
    const bridge = await loadBridge();

    await expect(bridge.sendDesktopAction("mute")).resolves.toBeUndefined();

    expect(server.of("/session")).toHaveLength(2);
    const [first, second] = server.of("/action");
    expect(first.headers["X-RYKA-SESSION"]).toBe("sid-1");
    expect(second.headers["X-RYKA-SESSION"]).toBe("sid-2");
  });

  it("gives up after a single retry instead of looping", async () => {
    const server = installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { status: 403, json: { ok: false, error: "Origin is not allowed." } },
    );
    const bridge = await loadBridge();

    await expect(bridge.sendDesktopAction("mute")).rejects.toThrow("Origin is not allowed.");
    expect(server.of("/action")).toHaveLength(2);
  });

  it("does not retry on other errors and reports the server message", async () => {
    const server = installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { status: 400, json: { ok: false, error: "Action is not in the desktop allowlist." } },
    );
    const bridge = await loadBridge();

    await expect(bridge.sendDesktopAction("mute")).rejects.toThrow(
      "Action is not in the desktop allowlist.",
    );
    expect(server.of("/action")).toHaveLength(1);
  });

  it("falls back to a generic message when the error body is empty", async () => {
    installFetch((call) =>
      call.path === "/session" ? sessionReply() : { status: 500, json: {} },
    );
    const bridge = await loadBridge();

    await expect(bridge.sendDesktopAction("mute")).rejects.toThrow(
      "Bridge request failed (500).",
    );
  });
});

describe("desktopBridge operations", () => {
  it("maps the health response into a security state", async () => {
    installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : {
            json: {
              ok: true,
              version: "4.4.0",
              security: "HMAC-SHA256",
              sessionExpiresAt: 1234,
              emergencyLocked: true,
              permissions: { presentation: false, media: true },
            },
          },
    );
    const bridge = await loadBridge();

    await expect(bridge.getBridgeSecurityState()).resolves.toEqual({
      online: true,
      version: "4.4.0",
      security: "HMAC-SHA256",
      sessionExpiresAt: 1234,
      emergencyLocked: true,
      // This bridge predates the pointer permission, so it reads as off.
      permissions: { presentation: false, media: true, pointer: false },
    });
  });

  it("reads the pointer permission when the bridge reports it", async () => {
    installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : {
            json: {
              ok: true,
              version: "4.5.0",
              security: "HMAC-SHA256",
              sessionExpiresAt: 1,
              emergencyLocked: false,
              permissions: { presentation: true, media: true, pointer: true },
            },
          },
    );
    const bridge = await loadBridge();

    const state = await bridge.getBridgeSecurityState();
    expect(state.permissions.pointer).toBe(true);
  });

  it("only treats a literal true as the pointer permission being on", async () => {
    installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : {
            json: {
              ok: true,
              version: "4.5.0",
              security: "HMAC-SHA256",
              sessionExpiresAt: 1,
              emergencyLocked: false,
              permissions: { presentation: true, media: true, pointer: "yes" },
            },
          },
    );
    const bridge = await loadBridge();

    expect((await bridge.getBridgeSecurityState()).permissions.pointer).toBe(false);
  });

  it("reports availability through checkDesktopBridge", async () => {
    installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { json: { ok: true, permissions: { presentation: true, media: true } } },
    );
    const online = await loadBridge();
    await expect(online.checkDesktopBridge()).resolves.toBe(true);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    const offline = await loadBridge();
    await expect(offline.checkDesktopBridge()).resolves.toBe(false);
  });

  it("sends the new permissions and returns what the server stored", async () => {
    const server = installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { json: { ok: true, permissions: { presentation: true, media: false, pointer: true } } },
    );
    const bridge = await loadBridge();

    const saved = await bridge.updateBridgePermissions({
      presentation: true,
      media: false,
      pointer: true,
    });

    expect(saved).toEqual({ presentation: true, media: false, pointer: true });
    expect(server.of("/permissions")[0].body).toBe(
      JSON.stringify({ presentation: true, media: false, pointer: true }),
    );
  });

  it("signs pointer operations and posts them to /pointer", async () => {
    const server = installFetch((call) =>
      call.path === "/session" ? sessionReply() : { json: { ok: true } },
    );
    const bridge = await loadBridge();

    await bridge.sendPointer({ op: "move", x: 0.25, y: 0.75 });
    await bridge.sendPointer({ op: "down" });
    await bridge.sendPointer({ op: "up" });

    const calls = server.of("/pointer");
    expect(calls.map((call) => call.body)).toEqual([
      JSON.stringify({ op: "move", x: 0.25, y: 0.75 }),
      JSON.stringify({ op: "down" }),
      JSON.stringify({ op: "up" }),
    ]);
    for (const call of calls) {
      expect(call.method).toBe("POST");
      expect(call.headers["X-RYKA-SIGNATURE"]).toBe(expectedSignature(call));
    }
    expect(server.of("/session")).toHaveLength(1);
  });

  it("does not retry a refused pointer request or renew the session for it", async () => {
    const server = installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { status: 403, json: { ok: false, error: "pointer permission is disabled." } },
    );
    const bridge = await loadBridge();

    await expect(bridge.sendPointer({ op: "move", x: 0.5, y: 0.5 })).rejects.toThrow(
      "pointer permission is disabled.",
    );
    expect(server.of("/pointer")).toHaveLength(1);
    expect(server.of("/session")).toHaveLength(1);
  });

  it("surfaces the emergency lock for pointer requests", async () => {
    installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { status: 423, json: { ok: false, error: "RYKA desktop control is emergency locked." } },
    );
    const bridge = await loadBridge();

    await expect(bridge.sendPointer({ op: "down" })).rejects.toThrow(/emergency locked/);
  });

  it("requires the explicit confirmation phrase to re-arm", async () => {
    const server = installFetch((call) =>
      call.path === "/session" ? sessionReply() : { json: { ok: true, emergencyLocked: false } },
    );
    const bridge = await loadBridge();

    await expect(bridge.armBridge()).resolves.toBe(false);
    expect(server.of("/arm")[0].body).toBe(JSON.stringify({ confirm: "ARM RYKA" }));
  });

  it("emergency stop never retries and drops the session", async () => {
    let issued = 0;
    const server = installFetch((call) => {
      if (call.path === "/session") {
        issued += 1;
        return sessionReply({ id: `sid-${issued}` });
      }
      return { json: { ok: true, emergencyLocked: true } };
    });
    const bridge = await loadBridge();

    await bridge.emergencyStopBridge();
    expect(server.of("/emergency-stop")[0].body).toBe(
      JSON.stringify({ reason: "operator-request" }),
    );

    await bridge.sendDesktopAction("mute");
    expect(server.of("/session")).toHaveLength(2);
    expect(server.of("/action")[0].headers["X-RYKA-SESSION"]).toBe("sid-2");
  });

  it("emergency stop surfaces a 401 without retrying", async () => {
    const server = installFetch((call) =>
      call.path === "/session"
        ? sessionReply()
        : { status: 401, json: { ok: false, error: "Signature mismatch." } },
    );
    const bridge = await loadBridge();

    await expect(bridge.emergencyStopBridge()).rejects.toThrow("Signature mismatch.");
    expect(server.of("/emergency-stop")).toHaveLength(1);
  });
});
