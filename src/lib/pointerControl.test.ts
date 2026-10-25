import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerOperation } from "@/lib/desktopBridge";
import {
  POINTER_REGION,
  PointerSender,
  PointerTracker,
  pinchRatio,
  readHand,
  toScreenPoint,
} from "@/lib/pointerControl";

/** A 21-landmark hand where only the points the pointer reads are placed. */
function hand(parts: {
  wrist?: [number, number];
  palm?: [number, number];
  thumb?: [number, number];
  tip?: [number, number];
}) {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  const set = (index: number, value: [number, number] = [0, 0]) => {
    points[index] = { x: value[0], y: value[1] };
  };
  set(0, parts.wrist ?? [0.5, 0.8]);
  set(9, parts.palm ?? [0.5, 0.6]);
  set(4, parts.thumb ?? [0.4, 0.4]);
  set(8, parts.tip ?? [0.6, 0.4]);
  return points;
}

const moves = (ops: Array<PointerOperation>) =>
  ops.filter((op): op is Extract<PointerOperation, { op: "move" }> => op.op === "move");

describe("toScreenPoint", () => {
  it("maps the active region onto the whole screen", () => {
    const { left, top, width, height } = POINTER_REGION;
    expect(toScreenPoint({ x: left, y: top })).toEqual({ x: 0, y: 0 });
    expect(toScreenPoint({ x: left + width, y: top + height })).toEqual({ x: 1, y: 1 });
    const centre = toScreenPoint({ x: 0.5, y: 0.5 });
    expect(centre.x).toBeCloseTo(0.5);
    expect(centre.y).toBeCloseTo(0.5);
  });

  it("is linear inside the region", () => {
    expect(toScreenPoint({ x: 0.325, y: 0.5 }).x).toBeCloseTo(0.25);
  });

  it("clamps points outside the region to the screen edge", () => {
    expect(toScreenPoint({ x: -3, y: 9 })).toEqual({ x: 0, y: 1 });
  });
});

describe("pinchRatio and readHand", () => {
  it("is large for open fingers and small for a pinch", () => {
    expect(pinchRatio(hand({ thumb: [0.4, 0.4], tip: [0.6, 0.4] }))).toBeCloseTo(1);
    expect(pinchRatio(hand({ thumb: [0.5, 0.4], tip: [0.52, 0.4] }))).toBeCloseTo(0.1);
  });

  it("is null when the palm has no size", () => {
    expect(pinchRatio(hand({ wrist: [0.5, 0.6], palm: [0.5, 0.6] }))).toBeNull();
    expect(readHand(hand({ wrist: [0.5, 0.6], palm: [0.5, 0.6] }))).toBeNull();
  });

  it("mirrors x so a hand on the right of the picture steers to the right of the screen", () => {
    const frame = readHand(hand({ tip: [0.2, 0.3], palm: [0.25, 0.6] }))!;
    expect(frame.tip).toEqual({ x: 0.8, y: 0.3 });
    expect(frame.palm).toEqual({ x: 0.75, y: 0.6 });
  });
});

describe("PointerTracker", () => {
  const open = 1;
  const pinched = 0.1;
  const palm = { x: 0.5, y: 0.6 };

  /** Moves the fingertip right in 33 ms frames and returns the cursor moves it produced. */
  function sweep(tracker: PointerTracker, frames: number, startAt = 0) {
    const out: Array<{ at: number; x: number; y: number }> = [];
    for (let i = 0; i < frames; i += 1) {
      const at = startAt + i * 33;
      const ops = tracker.update({
        tip: { x: 0.3 + i * 0.02, y: 0.5 },
        palm,
        pinchRatio: open,
        now: at,
      });
      for (const move of moves(ops)) out.push({ at, x: move.x, y: move.y });
    }
    return out;
  }

  it("follows the fingertip with plain moves while the fingers are open", () => {
    const tracker = new PointerTracker();
    const ops = tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: open, now: 0 });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: "move" });
    expect(tracker.isPressed).toBe(false);
  });

  it("moves right when the fingertip moves right", () => {
    const path = sweep(new PointerTracker(), 10);
    expect(path.at(-1)!.x).toBeGreaterThan(path[0].x);
  });

  it("presses where the cursor was a moment earlier, not where the closing fingers ended up", () => {
    const tracker = new PointerTracker();
    const path = sweep(tracker, 10);
    const now = 10 * 33;
    const ops = tracker.update({ tip: { x: 0.52, y: 0.5 }, palm, pinchRatio: pinched, now });

    expect(ops).toHaveLength(2);
    expect(ops[1]).toEqual({ op: "down" });
    const anchor = ops[0] as Extract<PointerOperation, { op: "move" }>;
    expect(anchor.op).toBe("move");
    const expected = [...path].reverse().find((item) => item.at <= now - 150)!;
    expect(anchor.x).toBeCloseTo(expected.x);
    expect(anchor.x).toBeLessThan(path.at(-1)!.x);
    expect(tracker.isPressed).toBe(true);
  });

  it("presses at its only known position when the very first frame is already a pinch", () => {
    const tracker = new PointerTracker();
    const ops = tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: pinched, now: 0 });
    expect(ops.map((op) => op.op)).toEqual(["move", "down"]);
  });

  it("drags with the palm while pressed", () => {
    const tracker = new PointerTracker();
    sweep(tracker, 10);
    const press = tracker.update({ tip: { x: 0.52, y: 0.5 }, palm, pinchRatio: pinched, now: 400 });
    const anchor = press[0] as Extract<PointerOperation, { op: "move" }>;

    const dragged = tracker.update({
      tip: { x: 0.9, y: 0.9 }, // the fingertip is ignored during a drag
      palm: { x: palm.x + 0.07, y: palm.y },
      pinchRatio: pinched,
      now: 433,
    });
    expect(dragged).toHaveLength(1);
    const move = dragged[0] as Extract<PointerOperation, { op: "move" }>;
    expect(move.x).toBeCloseTo(anchor.x + 0.07 / POINTER_REGION.width);
    expect(move.y).toBeCloseTo(anchor.y);
  });

  it("keeps the drag inside the screen", () => {
    const tracker = new PointerTracker();
    tracker.update({ tip: { x: 0.8, y: 0.5 }, palm, pinchRatio: pinched, now: 0 });
    const far = tracker.update({
      tip: { x: 0.8, y: 0.5 },
      palm: { x: palm.x + 5, y: palm.y - 5 },
      pinchRatio: pinched,
      now: 33,
    })[0] as Extract<PointerOperation, { op: "move" }>;
    expect(far.x).toBe(1);
    expect(far.y).toBe(0);
  });

  it("lifts the button first at the drag position, then returns to the fingertip", () => {
    const tracker = new PointerTracker();
    tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: pinched, now: 0 });
    const ops = tracker.update({ tip: { x: 0.6, y: 0.55 }, palm, pinchRatio: open, now: 33 });
    expect(ops.map((op) => op.op)).toEqual(["up", "move"]);
    expect(tracker.isPressed).toBe(false);
  });

  it("needs the fingers to open past the release threshold before letting go", () => {
    const tracker = new PointerTracker();
    tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: pinched, now: 0 });
    const between = tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: 0.4, now: 33 });
    expect(between.map((op) => op.op)).toEqual(["move"]);
    expect(tracker.isPressed).toBe(true);
  });

  it("does not press until the fingers close past the engage threshold", () => {
    const tracker = new PointerTracker();
    const ops = tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: 0.4, now: 0 });
    expect(ops.map((op) => op.op)).toEqual(["move"]);
    expect(tracker.isPressed).toBe(false);
  });

  it("releases a held press once, and nothing when nothing is held", () => {
    const tracker = new PointerTracker();
    expect(tracker.release()).toEqual([]);
    tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: pinched, now: 0 });
    expect(tracker.release()).toEqual([{ op: "up" }]);
    expect(tracker.release()).toEqual([]);
  });

  it("forgets the press on reset", () => {
    const tracker = new PointerTracker();
    tracker.update({ tip: { x: 0.5, y: 0.5 }, palm, pinchRatio: pinched, now: 0 });
    tracker.reset();
    expect(tracker.isPressed).toBe(false);
    expect(tracker.release()).toEqual([]);
  });
});

describe("PointerSender", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(options: { epsilon?: number; fail?: boolean } = {}) {
    const sent: Array<{ op: PointerOperation; at: number }> = [];
    const onError = vi.fn();
    const send = vi.fn((op: PointerOperation) => {
      sent.push({ op, at: Date.now() });
      return options.fail ? Promise.reject(new Error("bridge down")) : Promise.resolve();
    });
    const sender = new PointerSender(send, { onError, epsilon: options.epsilon });
    return { sender, sent, send, onError };
  }
  const move = (x: number, y = 0.5): PointerOperation => ({ op: "move", x, y });
  const settle = () => vi.advanceTimersByTimeAsync(500);

  it("sends in order and never drops or reorders a button event", async () => {
    const { sender, sent } = setup();
    sender.push(move(0.1));
    sender.push({ op: "down" });
    sender.push(move(0.4));
    sender.push({ op: "up" });
    await settle();
    expect(sent.map((item) => item.op)).toEqual([move(0.1), { op: "down" }, move(0.4), { op: "up" }]);
  });

  it("replaces a move that has not left yet with the newer one", async () => {
    const { sender, sent } = setup();
    sender.push(move(0.1));
    sender.push(move(0.2));
    sender.push(move(0.3));
    sender.push(move(0.4));
    await settle();
    expect(sent.map((item) => item.op)).toEqual([move(0.1), move(0.4)]);
  });

  it("skips moves too small to matter", async () => {
    const { sender, sent } = setup({ epsilon: 0.01 });
    sender.push(move(0.5));
    await settle();
    sender.push(move(0.504));
    await settle();
    sender.push(move(0.52));
    await settle();
    expect(sent.map((item) => item.op)).toEqual([move(0.5), move(0.52)]);
  });

  it("keeps moves at least 40 ms apart so the bridge limit is never reached", async () => {
    const { sender, sent } = setup();
    for (let i = 0; i < 6; i += 1) {
      sender.push(move(0.1 * (i + 1)));
      await vi.advanceTimersByTimeAsync(10);
    }
    await settle();
    expect(sent.length).toBeGreaterThan(1);
    for (let i = 1; i < sent.length; i += 1) {
      expect(sent[i].at - sent[i - 1].at).toBeGreaterThanOrEqual(40);
    }
  });

  it("does not delay a button event", async () => {
    const { sender, sent } = setup();
    sender.push(move(0.1));
    await vi.advanceTimersByTimeAsync(0);
    sender.push({ op: "down" });
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((item) => item.op)).toEqual([move(0.1), { op: "down" }]);
  });

  it("reports a failure once, drops what was waiting, and works again afterwards", async () => {
    const { sender, send, onError } = setup({ fail: true });
    sender.push(move(0.1));
    sender.push({ op: "down" });
    sender.push({ op: "up" });
    await settle();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);

    sender.push({ op: "up" });
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
