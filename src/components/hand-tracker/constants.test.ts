import { describe, expect, it } from "vitest";
import {
  ACTION_LABELS,
  DESKTOP_ACTIONS,
  GESTURES,
  GESTURE_LABELS,
  PINCH_OFF,
  PINCH_ON,
  PROFILE_MAPS,
  PROFILE_MODES,
  QUALITY_CONFIG,
  VIEW_MODES,
} from "./constants";

describe("hand tracker constants", () => {
  it("maps every gesture in every profile to a known action", () => {
    for (const profile of PROFILE_MODES) {
      const map = PROFILE_MAPS[profile];
      expect(Object.keys(map).sort()).toEqual([...GESTURES].sort());
      for (const gesture of GESTURES) {
        expect(ACTION_LABELS).toHaveProperty(map[gesture]);
      }
    }
  });

  it("labels every gesture", () => {
    for (const gesture of GESTURES) {
      expect(GESTURE_LABELS[gesture]).toMatch(/\S/);
    }
    expect(GESTURE_LABELS.None).toBe("NO GESTURE");
  });

  it("keeps the desktop action list in sync with the bridge allowlist", () => {
    // Must match DesktopBridgeAction in src/lib/desktopBridge.ts and the
    // allowlist in scripts/windows-bridge.mjs; a new key needs both.
    expect([...DESKTOP_ACTIONS].sort()).toEqual(
      [
        "mute",
        "next-slide",
        "next-track",
        "play-pause",
        "previous-slide",
        "previous-track",
        "volume-down",
        "volume-up",
      ].sort(),
    );
  });

  it("never sends local-only actions to the desktop", () => {
    for (const local of ["none", "screenshot", "pointer-mode", "scan-pulse", "reset-orb"] as const) {
      expect(DESKTOP_ACTIONS.has(local)).toBe(false);
    }
  });

  it("uses a pinch release threshold above the engage threshold (hysteresis)", () => {
    expect(PINCH_OFF).toBeGreaterThan(PINCH_ON);
  });

  it("scales quality presets monotonically", () => {
    const { performance, balanced, quality } = QUALITY_CONFIG;
    expect(performance.width).toBeLessThan(balanced.width);
    expect(balanced.width).toBeLessThan(quality.width);
    expect(performance.inferenceInterval).toBeGreaterThan(balanced.inferenceInterval);
    expect(balanced.inferenceInterval).toBeGreaterThan(quality.inferenceInterval);
  });

  it("exposes the selectable modes", () => {
    expect(VIEW_MODES).toEqual(["command", "minimal", "debug"]);
    expect(PROFILE_MODES).toEqual(["presentation", "media", "custom"]);
  });
});
