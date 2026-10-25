import { spawn } from "node:child_process";

/**
 * Pointer control for the desktop bridge.
 *
 * Mouse moves arrive many times a second, so they cannot go through the
 * per-action PowerShell launcher. Instead one fixed helper process stays
 * alive and reads one-line commands from stdin. The bridge only ever writes
 * lines it built itself from validated numbers (see formatHelperCommand);
 * request text never reaches the helper.
 */

/** Operations accepted on /pointer. Anything else is rejected before the helper is involved. */
export const POINTER_OPS = Object.freeze(["move", "down", "up"]);

/** A held button is released if the client goes quiet for this long. */
export const POINTER_RELEASE_AFTER_MS = 2000;
/** The helper process is stopped after this long without any pointer request. */
export const POINTER_STOP_AFTER_MS = 10_000;
/** Moves are dropped, not queued, once this many bytes are waiting for the helper. */
const MAX_BACKLOG_BYTES = 8192;

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/** Validates a /pointer body and returns a clean request, or throws an error with status 400. */
export function parsePointerRequest(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalid("Invalid pointer payload.");
  }
  const op = payload.op;
  if (typeof op !== "string" || !POINTER_OPS.includes(op)) {
    throw invalid("Pointer operation is not in the allowlist.");
  }

  const allowedKeys = op === "move" ? ["op", "x", "y"] : ["op"];
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.includes(key)) throw invalid(`Unexpected pointer field: ${key}.`);
  }
  if (op !== "move") return { op };

  for (const name of ["x", "y"]) {
    const value = payload[name];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw invalid(`Pointer ${name} must be a number between 0 and 1.`);
    }
  }
  return { op, x: payload.x, y: payload.y };
}

/** The single line written to the helper for a validated request. */
export function formatHelperCommand(request) {
  if (request.op === "down") return "D";
  if (request.op === "up") return "U";
  return `M ${request.x.toFixed(4)} ${request.y.toFixed(4)}`;
}

/**
 * Fixed helper program (PowerShell + a small P/Invoke class). It understands
 * exactly four lines: `M <x> <y>` (x and y are fractions of the primary
 * screen, 0..1), `D` (left button down), `U` (left button up) and `Q` (quit).
 * Everything else is ignored.
 */
export const POINTER_HELPER_SCRIPT = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RykaPointer {
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  public static int Width;
  public static int Height;
  public static void Init() {
    SetProcessDPIAware();
    Width = GetSystemMetrics(0);
    Height = GetSystemMetrics(1);
  }
  public static void Move(double nx, double ny) {
    nx = Math.Min(1.0, Math.Max(0.0, nx));
    ny = Math.Min(1.0, Math.Max(0.0, ny));
    SetCursorPos((int)Math.Round(nx * (Width - 1)), (int)Math.Round(ny * (Height - 1)));
  }
  public static void Down() { mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); }
  public static void Up() { mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); }
}
'@
[RykaPointer]::Init()
$culture = [System.Globalization.CultureInfo]::InvariantCulture
while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ($line -cmatch '^M ([01]\\.[0-9]{1,4}) ([01]\\.[0-9]{1,4})$') {
    [RykaPointer]::Move([double]::Parse($Matches[1], $culture), [double]::Parse($Matches[2], $culture))
  } elseif ($line -ceq 'D') {
    [RykaPointer]::Down()
  } elseif ($line -ceq 'U') {
    [RykaPointer]::Up()
  } elseif ($line -ceq 'Q') {
    break
  }
}
`;

/** -EncodedCommand takes base64 UTF-16LE, so the script needs no shell quoting. */
export function encodeHelperScript(script = POINTER_HELPER_SCRIPT) {
  return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * Starts the real helper. Fixed arguments, no shell, stdin only: the one
 * channel in is the line protocol above.
 */
export function spawnPowerShellHelper({ onExit }) {
  const child = spawn(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodeHelperScript()],
    { windowsHide: true, stdio: ["pipe", "ignore", "ignore"], shell: false },
  );
  child.once("exit", onExit);
  child.once("error", onExit);
  child.stdin.on("error", () => {
    // The helper may already be gone; the exit handler resets the controller.
  });

  return {
    write: (line) => child.stdin.write(line),
    backlog: () => child.stdin.writableLength,
    close: () => {
      child.stdin.end("Q\n");
      setTimeout(() => child.kill(), 1000).unref();
    },
  };
}

/**
 * Applies validated requests to a helper and keeps it safe: a button that is
 * held while the client goes quiet is released, and an unused helper stops.
 */
export class PointerController {
  #helper = null;
  #buttonDown = false;
  #releaseTimer = null;
  #stopTimer = null;

  constructor({
    spawnHelper,
    onEvent = () => {},
    releaseAfterMs = POINTER_RELEASE_AFTER_MS,
    stopAfterMs = POINTER_STOP_AFTER_MS,
  }) {
    this.spawnHelper = spawnHelper;
    this.onEvent = onEvent;
    this.releaseAfterMs = releaseAfterMs;
    this.stopAfterMs = stopAfterMs;
  }

  get buttonDown() {
    return this.#buttonDown;
  }

  get running() {
    return this.#helper !== null;
  }

  handle(request) {
    if (request.op === "down" && this.#buttonDown) return;
    if (request.op === "up" && !this.#buttonDown) return;

    const helper = this.#ensureHelper();
    if (request.op === "move" && helper.backlog() > MAX_BACKLOG_BYTES) return;

    if (request.op === "down") {
      this.#buttonDown = true;
      this.onEvent("button-down");
    } else if (request.op === "up") {
      this.#buttonDown = false;
      this.onEvent("button-up");
    }
    helper.write(`${formatHelperCommand(request)}\n`);
    this.#arm();
  }

  /** Releases the button if it is held, then stops the helper. Safe to call at any time. */
  stop(reason = "stopped") {
    this.#clearTimers();
    const helper = this.#helper;
    if (!helper) {
      this.#buttonDown = false;
      return;
    }
    if (this.#buttonDown) {
      helper.write("U\n");
      this.#buttonDown = false;
      this.onEvent("button-released-on-stop");
    }
    this.#helper = null;
    helper.close();
    this.onEvent(`stopped:${reason}`);
  }

  #ensureHelper() {
    if (this.#helper) return this.#helper;
    const helper = this.spawnHelper({
      onExit: () => {
        if (this.#helper !== helper) return;
        this.#clearTimers();
        if (this.#buttonDown) this.onEvent("helper-exited-while-pressed");
        this.#helper = null;
        this.#buttonDown = false;
      },
    });
    this.#helper = helper;
    this.onEvent("started");
    return helper;
  }

  #arm() {
    this.#clearTimers();
    if (this.#buttonDown) {
      this.#releaseTimer = setTimeout(() => {
        if (this.#helper && this.#buttonDown) {
          this.#helper.write("U\n");
          this.#buttonDown = false;
          this.onEvent("watchdog-release");
        }
      }, this.releaseAfterMs);
      this.#releaseTimer.unref?.();
    }
    this.#stopTimer = setTimeout(() => this.stop("idle"), this.stopAfterMs);
    this.#stopTimer.unref?.();
  }

  #clearTimers() {
    clearTimeout(this.#releaseTimer);
    clearTimeout(this.#stopTimer);
    this.#releaseTimer = null;
    this.#stopTimer = null;
  }
}
