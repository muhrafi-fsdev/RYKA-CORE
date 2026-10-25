/// <reference types="node" />
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POINTER_HELPER_SCRIPT,
  POINTER_OPS,
  POINTER_RELEASE_AFTER_MS,
  POINTER_STOP_AFTER_MS,
  PointerController,
  encodeHelperScript,
  formatHelperCommand,
  parsePointerRequest,
} from "../../scripts/pointer-driver.mjs";

describe("parsePointerRequest", () => {
  it("accepts the three operations", () => {
    expect(POINTER_OPS).toEqual(["move", "down", "up"]);
    expect(parsePointerRequest({ op: "move", x: 0.25, y: 1 })).toEqual({ op: "move", x: 0.25, y: 1 });
    expect(parsePointerRequest({ op: "down" })).toEqual({ op: "down" });
    expect(parsePointerRequest({ op: "up" })).toEqual({ op: "up" });
  });

  it("accepts the edges of the screen", () => {
    expect(parsePointerRequest({ op: "move", x: 0, y: 0 })).toEqual({ op: "move", x: 0, y: 0 });
    expect(parsePointerRequest({ op: "move", x: 1, y: 1 })).toEqual({ op: "move", x: 1, y: 1 });
  });

  it.each([
    ["null", null],
    ["an array", [{ op: "down" }]],
    ["a string", "down"],
    ["no op", {}],
    ["a numeric op", { op: 1 }],
    ["an unknown op", { op: "rightclick" }],
    ["a shell-looking op", { op: "move; calc" }],
    ["a move without coordinates", { op: "move" }],
    ["a move without y", { op: "move", x: 0.5 }],
    ["x below 0", { op: "move", x: -0.001, y: 0.5 }],
    ["x above 1", { op: "move", x: 1.001, y: 0.5 }],
    ["y as a string", { op: "move", x: 0.5, y: "0.5" }],
    ["x as null", { op: "move", x: null, y: 0.5 }],
    ["an extra field on move", { op: "move", x: 0.5, y: 0.5, speed: 9 }],
    ["coordinates on down", { op: "down", x: 0.5, y: 0.5 }],
    ["an extra field on up", { op: "up", cmd: "calc" }],
  ])("rejects %s with status 400", (_label, payload) => {
    try {
      parsePointerRequest(payload);
      throw new Error("expected a rejection");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(400);
    }
  });

  it("rejects values JSON cannot carry safely", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => parsePointerRequest({ op: "move", x: bad, y: 0.5 })).toThrow();
    }
  });

  it("rejects a __proto__ payload from JSON.parse", () => {
    expect(() => parsePointerRequest(JSON.parse('{"op":"down","__proto__":{"x":1}}'))).toThrow();
  });
});

describe("formatHelperCommand", () => {
  it("writes the fixed one-line protocol", () => {
    expect(formatHelperCommand({ op: "down" })).toBe("D");
    expect(formatHelperCommand({ op: "up" })).toBe("U");
    expect(formatHelperCommand({ op: "move", x: 0.5, y: 0.25 })).toBe("M 0.5000 0.2500");
  });

  it("always uses four decimals and never exponent notation", () => {
    expect(formatHelperCommand({ op: "move", x: 1e-9, y: 0 })).toBe("M 0.0000 0.0000");
    expect(formatHelperCommand({ op: "move", x: 0.99996, y: 1 })).toBe("M 1.0000 1.0000");
  });

  it("only produces lines the helper's pattern accepts", () => {
    const pattern = /^M [01]\.[0-9]{1,4} [01]\.[0-9]{1,4}$/;
    for (const value of [0, 0.00004, 0.123456789, 0.5, 0.99999, 1]) {
      expect(formatHelperCommand({ op: "move", x: value, y: value })).toMatch(pattern);
    }
  });
});

describe("helper script", () => {
  it("is a fixed program that never evaluates its input", () => {
    expect(POINTER_HELPER_SCRIPT).not.toMatch(/Invoke-Expression|\biex\b|Start-Process|Invoke-Command/i);
  });

  it("compares commands case-sensitively", () => {
    expect(POINTER_HELPER_SCRIPT).toContain("-cmatch");
    expect(POINTER_HELPER_SCRIPT).toContain("-ceq 'D'");
    expect(POINTER_HELPER_SCRIPT).toContain("-ceq 'U'");
    expect(POINTER_HELPER_SCRIPT).toContain("-ceq 'Q'");
  });

  it("encodes to base64 UTF-16LE for -EncodedCommand", () => {
    expect(Buffer.from(encodeHelperScript(), "base64").toString("utf16le")).toBe(POINTER_HELPER_SCRIPT);
  });
});

function fakeHelper() {
  const lines: Array<string> = [];
  const state = { backlog: 0, closed: false };
  const handle = {
    write: vi.fn((line: string) => {
      lines.push(line);
    }),
    backlog: () => state.backlog,
    close: vi.fn(() => {
      state.closed = true;
    }),
  };
  return { handle, lines, state };
}

function setup(options: { releaseAfterMs?: number; stopAfterMs?: number } = {}) {
  const events: Array<string> = [];
  const helpers: Array<ReturnType<typeof fakeHelper>> = [];
  const exits: Array<() => void> = [];
  const spawnHelper = vi.fn(({ onExit }: { onExit: () => void }) => {
    const helper = fakeHelper();
    helpers.push(helper);
    exits.push(onExit);
    return helper.handle;
  });
  const controller = new PointerController({
    spawnHelper,
    onEvent: (event) => events.push(event),
    ...options,
  });
  return { controller, events, helpers, exits, spawnHelper };
}

describe("PointerController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the helper on first use and reuses it", () => {
    const { controller, helpers, spawnHelper, events } = setup();
    controller.handle({ op: "move", x: 0.5, y: 0.5 });
    controller.handle({ op: "move", x: 0.6, y: 0.5 });
    expect(spawnHelper).toHaveBeenCalledTimes(1);
    expect(helpers[0].lines).toEqual(["M 0.5000 0.5000\n", "M 0.6000 0.5000\n"]);
    expect(events).toEqual(["started"]);
  });

  it("does not report every move, only the lifecycle and button events", () => {
    const { controller, events } = setup();
    for (let i = 0; i < 20; i += 1) controller.handle({ op: "move", x: i / 20, y: 0.5 });
    controller.handle({ op: "down" });
    controller.handle({ op: "up" });
    expect(events).toEqual(["started", "button-down", "button-up"]);
  });

  it("presses the button once and ignores a repeated down", () => {
    const { controller, helpers } = setup();
    controller.handle({ op: "down" });
    controller.handle({ op: "down" });
    expect(helpers[0].lines).toEqual(["D\n"]);
    expect(controller.buttonDown).toBe(true);
  });

  it("ignores an up with nothing pressed, without even starting the helper", () => {
    const { controller, spawnHelper } = setup();
    controller.handle({ op: "up" });
    expect(spawnHelper).not.toHaveBeenCalled();
  });

  it("releases a held button when the client goes quiet", () => {
    const { controller, helpers, events } = setup();
    controller.handle({ op: "down" });
    vi.advanceTimersByTime(POINTER_RELEASE_AFTER_MS - 1);
    expect(controller.buttonDown).toBe(true);
    vi.advanceTimersByTime(2);
    expect(helpers[0].lines).toEqual(["D\n", "U\n"]);
    expect(controller.buttonDown).toBe(false);
    expect(events).toContain("watchdog-release");
    controller.handle({ op: "up" });
    expect(helpers[0].lines).toEqual(["D\n", "U\n"]);
  });

  it("keeps a drag alive while moves keep arriving", () => {
    const { controller, helpers } = setup();
    controller.handle({ op: "down" });
    vi.advanceTimersByTime(1500);
    controller.handle({ op: "move", x: 0.4, y: 0.4 });
    vi.advanceTimersByTime(1500);
    expect(controller.buttonDown).toBe(true);
    vi.advanceTimersByTime(600);
    expect(helpers[0].lines.at(-1)).toBe("U\n");
  });

  it("stops the helper after a quiet period and restarts it on demand", () => {
    const { controller, helpers, spawnHelper, events } = setup();
    controller.handle({ op: "move", x: 0.5, y: 0.5 });
    vi.advanceTimersByTime(POINTER_STOP_AFTER_MS + 1);
    expect(controller.running).toBe(false);
    expect(helpers[0].handle.close).toHaveBeenCalledTimes(1);
    expect(events).toContain("stopped:idle");

    controller.handle({ op: "move", x: 0.1, y: 0.1 });
    expect(spawnHelper).toHaveBeenCalledTimes(2);
    expect(controller.running).toBe(true);
  });

  it("releases the button before the helper closes when stopped", () => {
    const { controller, helpers, events } = setup();
    controller.handle({ op: "down" });
    controller.stop("emergency-stop");
    expect(helpers[0].lines).toEqual(["D\n", "U\n"]);
    expect(helpers[0].handle.close).toHaveBeenCalledTimes(1);
    expect(controller.buttonDown).toBe(false);
    expect(controller.running).toBe(false);
    expect(events).toContain("button-released-on-stop");
    expect(events).toContain("stopped:emergency-stop");
  });

  it("is safe to stop when nothing is running, and stopping twice", () => {
    const { controller, helpers } = setup();
    expect(() => controller.stop()).not.toThrow();
    controller.handle({ op: "move", x: 0.5, y: 0.5 });
    controller.stop();
    controller.stop();
    expect(helpers[0].handle.close).toHaveBeenCalledTimes(1);
  });

  it("forgets a helper that exits and reports a press it could not release", () => {
    const { controller, exits, events, spawnHelper } = setup();
    controller.handle({ op: "down" });
    exits[0]();
    expect(controller.running).toBe(false);
    expect(controller.buttonDown).toBe(false);
    expect(events).toContain("helper-exited-while-pressed");

    controller.handle({ op: "move", x: 0.5, y: 0.5 });
    expect(spawnHelper).toHaveBeenCalledTimes(2);
  });

  it("ignores the late exit of a helper it already replaced", () => {
    const { controller, exits } = setup();
    controller.handle({ op: "move", x: 0.5, y: 0.5 });
    controller.stop();
    controller.handle({ op: "move", x: 0.5, y: 0.5 });
    exits[0]();
    expect(controller.running).toBe(true);
  });

  it("drops moves, but never button events, when the helper falls behind", () => {
    const { controller, helpers } = setup();
    controller.handle({ op: "move", x: 0.1, y: 0.1 });
    helpers[0].state.backlog = 100_000;
    controller.handle({ op: "move", x: 0.2, y: 0.2 });
    controller.handle({ op: "down" });
    controller.handle({ op: "up" });
    expect(helpers[0].lines).toEqual(["M 0.1000 0.1000\n", "D\n", "U\n"]);
  });
});

describe.skipIf(process.platform !== "win32")("helper script on Windows", () => {
  /** Runs the real helper with the native calls swapped for harmless prints. */
  function runDry(lines: Array<string>) {
    const dry = POINTER_HELPER_SCRIPT.replace(
      /SetCursorPos\(\(int\)Math\.Round\(nx \* \(Width - 1\)\), \(int\)Math\.Round\(ny \* \(Height - 1\)\)\);/,
      'Console.Out.WriteLine("MOVE " + (int)Math.Round(nx * (Width - 1)) + " " + (int)Math.Round(ny * (Height - 1)));',
    )
      .replace("mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);", 'mouse_event(0, 0, 0, 0, UIntPtr.Zero); Console.Out.WriteLine("DOWN");')
      .replace("mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);", 'mouse_event(0, 0, 0, 0, UIntPtr.Zero); Console.Out.WriteLine("UP");')
      .replace("[RykaPointer]::Init()", '[RykaPointer]::Init(); [Console]::Out.WriteLine("SIZE " + [RykaPointer]::Width + " " + [RykaPointer]::Height)');
    expect(dry).not.toBe(POINTER_HELPER_SCRIPT);
    expect(dry).toContain('WriteLine("MOVE ');
    expect(dry).toContain('WriteLine("DOWN")');

    return new Promise<Array<string>>((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodeHelperScript(dry)],
        { windowsHide: true, stdio: ["pipe", "pipe", "ignore"], shell: false },
      );
      let out = "";
      child.stdout.on("data", (chunk) => (out += String(chunk)));
      child.once("error", reject);
      child.once("exit", () => resolve(out.split(/\r?\n/).filter(Boolean)));
      child.stdin.end(`${lines.join("\n")}\n`);
    });
  }

  it("maps fractions to screen pixels and obeys only the four commands", async () => {
    const output = await runDry([
      "M 0.0000 0.0000",
      "M 1.0000 1.0000",
      "M 0.5000 0.2500",
      "D",
      "U",
      "m 0.5000 0.5000", // wrong case
      "M 2.0000 0.5000", // out of range
      "M 0.5000 0.5000; calc.exe", // trailing text
      "d",
      "garbage",
      "Q",
      "M 0.1000 0.1000", // after quit
    ]);
    const [, width, height] = output[0].split(" ").map(Number);
    expect(output.slice(1)).toEqual([
      "MOVE 0 0",
      `MOVE ${width - 1} ${height - 1}`,
      `MOVE ${Math.round(0.5 * (width - 1))} ${Math.round(0.25 * (height - 1))}`,
      "DOWN",
      "UP",
    ]);
  }, 30_000);
});
