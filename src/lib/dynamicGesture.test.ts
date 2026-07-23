import { describe, expect, it } from "vitest";
import { DynamicGestureDetector } from "@/lib/dynamicGesture";

function handAt(x: number, y: number) {
  return Array.from({ length: 21 }, () => ({ x, y, z: 0, visibility: 1 }));
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
});
