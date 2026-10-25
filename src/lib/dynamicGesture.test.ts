import { describe, expect, it } from "vitest";
import type { DynamicGestureConfig } from "@/lib/dynamicGesture";
import {
  DEFAULT_DYNAMIC_CONFIG,
  DynamicGestureDetector,
  SwipeRecorder,
  measureMotion,
} from "@/lib/dynamicGesture";

function handAt(x: number, y: number) {
  return Array.from({ length: 21 }, () => ({ x, y, z: 0, visibility: 1 }));
}

const FRAME_MS = 55;

/** Raw x falls as the hand moves right on a mirrored screen. */
function rightwardSwipe(detector: DynamicGestureDetector, step: number, startAt = 0) {
  const events = [];
  for (let index = 0; index < 7; index += 1) {
    events.push(
      ...detector.update([handAt(0.8 - index * step, 0.5)], ["Right"], startAt + index * FRAME_MS),
    );
  }
  return events;
}

describe("DynamicGestureDetector", () => {
  it("recognizes a right swipe in mirrored screen coordinates", () => {
    const detector = new DynamicGestureDetector();
    const events = [];
    for (let index = 0; index < 7; index += 1) {
      events.push(
        ...detector.update([handAt(0.8 - index * 0.045, 0.5)], ["Right"], index * 55),
      );
    }
    expect(events.some((event) => event.gesture === "Swipe_Right")).toBe(true);
  });

  it("keeps the original thresholds as its defaults", () => {
    expect(DEFAULT_DYNAMIC_CONFIG).toEqual({
      minHorizontalDistance: 0.2,
      minVerticalDistance: 0.18,
      minHorizontalSpeed: 0.55,
      minVerticalSpeed: 0.5,
    });
  });

  it("ignores a short swipe with the default thresholds", () => {
    expect(rightwardSwipe(new DynamicGestureDetector(), 0.02)).toHaveLength(0);
  });

  it("accepts that short swipe once it is configured for a smaller reach", () => {
    const sensitive: DynamicGestureConfig = {
      minHorizontalDistance: 0.1,
      minVerticalDistance: 0.1,
      minHorizontalSpeed: 0.3,
      minVerticalSpeed: 0.3,
    };
    const configured = new DynamicGestureDetector(sensitive);
    expect(rightwardSwipe(configured, 0.02).some((e) => e.gesture === "Swipe_Right")).toBe(true);

    const later = new DynamicGestureDetector();
    later.configure(sensitive);
    expect(rightwardSwipe(later, 0.02).some((e) => e.gesture === "Swipe_Right")).toBe(true);
  });

  it("rejects a normal swipe when configured for a wider reach", () => {
    const strict = { ...DEFAULT_DYNAMIC_CONFIG, minHorizontalDistance: 0.35 };
    expect(rightwardSwipe(new DynamicGestureDetector(strict), 0.045)).toHaveLength(0);
  });

  it("detects vertical swipes against their own thresholds", () => {
    const detector = new DynamicGestureDetector({
      ...DEFAULT_DYNAMIC_CONFIG,
      minVerticalDistance: 0.1,
      minVerticalSpeed: 0.3,
    });
    const events = [];
    for (let index = 0; index < 7; index += 1) {
      events.push(...detector.update([handAt(0.5, 0.3 + index * 0.02)], ["Right"], index * FRAME_MS));
    }
    expect(events.some((event) => event.gesture === "Swipe_Down")).toBe(true);
  });
});

describe("measureMotion", () => {
  it("returns displacement, distance and speed over the window", () => {
    const motion = measureMotion([
      { x: 0, y: 0, at: 0 },
      { x: 0.3, y: 0.4, at: 500 },
    ]);
    expect(motion.dx).toBeCloseTo(0.3);
    expect(motion.dy).toBeCloseTo(0.4);
    expect(motion.distance).toBeCloseTo(0.5);
    expect(motion.speed).toBeCloseTo(1);
  });
});

describe("SwipeRecorder", () => {
  /** Feeds a swipe along one axis followed by stillness; returns the samples produced. */
  function perform(
    recorder: SwipeRecorder,
    ask: "x" | "y",
    move: "x" | "y",
    step: number,
    startAt: number,
  ) {
    const samples = [];
    let end = startAt;
    for (let index = 0; index < 8; index += 1) {
      end = startAt + index * FRAME_MS;
      const hand = move === "x" ? handAt(0.8 - index * step, 0.5) : handAt(0.5, 0.2 + index * step);
      const sample = recorder.update([hand], ask, end);
      if (sample) samples.push(sample);
    }
    const rest = move === "x" ? handAt(0.8 - 7 * step, 0.5) : handAt(0.5, 0.2 + 7 * step);
    for (let index = 1; index <= 20; index += 1) {
      const sample = recorder.update([rest], ask, end + index * FRAME_MS);
      if (sample) samples.push(sample);
    }
    return samples;
  }

  it("reports the peak distance and speed of a swipe once the hand stops", () => {
    const [sample, ...rest] = perform(new SwipeRecorder(), "x", "x", 0.045, 0);
    expect(rest).toHaveLength(0);
    expect(sample.axis).toBe("x");
    expect(sample.distance).toBeGreaterThan(0.25);
    expect(sample.distance).toBeLessThan(0.4);
    expect(sample.speed).toBeGreaterThan(0.5);
  });

  it("measures vertical swipes on the y axis", () => {
    const [sample] = perform(new SwipeRecorder(), "y", "y", 0.04, 0);
    expect(sample.axis).toBe("y");
    expect(sample.distance).toBeGreaterThan(0.2);
  });

  it("ignores movement along the other axis", () => {
    expect(perform(new SwipeRecorder(), "y", "x", 0.045, 0)).toHaveLength(0);
  });

  it("ignores slow drift below the attempt threshold", () => {
    expect(perform(new SwipeRecorder(), "x", "x", 0.004, 0)).toHaveLength(0);
  });

  it("reports an in-progress swipe when the hand leaves the frame", () => {
    const recorder = new SwipeRecorder();
    for (let index = 0; index < 8; index += 1) {
      expect(recorder.update([handAt(0.8 - index * 0.045, 0.5)], "x", index * FRAME_MS)).toBeNull();
    }
    expect(recorder.update([], "x", 8 * FRAME_MS)?.axis).toBe("x");
    expect(recorder.update([], "x", 9 * FRAME_MS)).toBeNull();
  });

  it("records one sample per swipe and accepts the next after the pause", () => {
    const recorder = new SwipeRecorder();
    const first = perform(recorder, "x", "x", 0.045, 0);
    const second = perform(recorder, "x", "x", 0.045, 5000);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it("forgets everything on reset", () => {
    const recorder = new SwipeRecorder();
    for (let index = 0; index < 8; index += 1) {
      recorder.update([handAt(0.8 - index * 0.045, 0.5)], "x", index * FRAME_MS);
    }
    recorder.reset();
    expect(recorder.update([], "x", 600)).toBeNull();
  });
});
