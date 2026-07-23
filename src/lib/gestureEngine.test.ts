import { describe, expect, it } from "vitest";
import { GestureStabilizer } from "@/lib/gestureEngine";

describe("GestureStabilizer", () => {
  it("requires multiple votes before returning a stable gesture", () => {
    const stabilizer = new GestureStabilizer(420, 4, 260);
    expect(
      stabilizer.push({ gesture: "Thumb_Up", score: 0.9, hand: "Right" }, 0),
    ).toBeNull();
    stabilizer.push({ gesture: "Thumb_Up", score: 0.91, hand: "Right" }, 50);
    stabilizer.push({ gesture: "Thumb_Up", score: 0.89, hand: "Right" }, 100);
    const stable = stabilizer.push(
      { gesture: "Thumb_Up", score: 0.92, hand: "Right" },
      150,
    );
    expect(stable?.gesture).toBe("Thumb_Up");
    expect(stable?.votes).toBe(4);
  });

  it("requires release after a trigger", () => {
    const stabilizer = new GestureStabilizer(420, 4, 260);
    stabilizer.markTriggered("Victory");
    expect(stabilizer.requiresRelease("Victory")).toBe(true);
    stabilizer.push(null, 500);
    stabilizer.push(null, 800);
    expect(stabilizer.isReleasePending()).toBe(false);
  });
});
