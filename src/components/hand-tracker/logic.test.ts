import { describe, expect, it } from "vitest";
import { PROFILE_MAPS } from "./constants";
import {
  buildLogExport,
  clampHandCount,
  deriveOrbState,
  deriveStatusText,
  dist2d,
  normalizeActionMap,
} from "./logic";
import type { ActionLog } from "./types";

const baseOrb = {
  camera: "on",
  error: null,
  controlActive: true,
  scanPulse: false,
  holdProgress: 0,
  releaseRequired: false,
  hands: 0,
} as const;

describe("deriveOrbState", () => {
  it("is idle with the camera off", () => {
    expect(deriveOrbState({ ...baseOrb, camera: "off" })).toBe("idle");
  });

  it("reports errors before anything else", () => {
    expect(deriveOrbState({ ...baseOrb, error: "CAMERA ACCESS DENIED", scanPulse: true })).toBe(
      "error",
    );
    expect(deriveOrbState({ ...baseOrb, camera: "error" })).toBe("error");
  });

  it("is locked while the camera runs but control is not armed", () => {
    expect(deriveOrbState({ ...baseOrb, controlActive: false, scanPulse: true })).toBe(
      "locked",
    );
  });

  it("shows the scan pulse over holding and tracking", () => {
    expect(deriveOrbState({ ...baseOrb, scanPulse: true, holdProgress: 50, hands: 2 })).toBe(
      "triggered",
    );
  });

  it("holds while a gesture is charging or a release is pending", () => {
    expect(deriveOrbState({ ...baseOrb, holdProgress: 10 })).toBe("holding");
    expect(deriveOrbState({ ...baseOrb, releaseRequired: true })).toBe("holding");
  });

  it("tracks only when armed with a hand in view", () => {
    expect(deriveOrbState({ ...baseOrb, hands: 1 })).toBe("tracking");
    expect(deriveOrbState({ ...baseOrb, hands: 0 })).toBe("idle");
  });
});

describe("deriveStatusText", () => {
  const base = {
    accessOpen: false,
    camera: "on",
    emergencyLocked: false,
    controlActive: true,
    releaseRequired: false,
    mode: "idle",
    hands: 0,
  } as const;

  it.each([
    [{ accessOpen: true }, "RYKA ACCESS"],
    [{ camera: "starting" }, "INITIALIZING"],
    [{ camera: "error" }, "SYSTEM ERROR"],
    [{ camera: "off" }, "GESTURES OFF"],
    [{ emergencyLocked: true }, "SECURITY LOCK"],
    [{ controlActive: false }, "CONTROL LOCKED"],
    [{ releaseRequired: true }, "RELEASE REQUIRED"],
    [{ mode: "spin" }, "ORB SPIN"],
    [{ mode: "zoom" }, "ORB ZOOM"],
    [{ hands: 2 }, "TRACKING"],
    [{}, "STANDBY"],
  ] as const)("%j -> %s", (override, expected) => {
    expect(deriveStatusText({ ...base, ...override })).toBe(expected);
  });

  it("lets the access suite win over every other state", () => {
    expect(
      deriveStatusText({ ...base, accessOpen: true, camera: "error", emergencyLocked: true }),
    ).toBe("RYKA ACCESS");
  });

  it("lets a camera problem win over the security lock", () => {
    expect(deriveStatusText({ ...base, camera: "off", emergencyLocked: true })).toBe(
      "GESTURES OFF",
    );
  });
});

describe("clampHandCount", () => {
  it.each([
    [0, 1],
    [-3, 1],
    [1, 1],
    [3, 3],
    [4, 4],
    [9, 4],
    ["2", 2],
    ["abc", 1],
    [undefined, 1],
    [null, 1],
    [2.5, 2.5],
  ])("%j -> %j", (input, expected) => {
    expect(clampHandCount(input)).toBe(expected);
  });
});

describe("buildLogExport", () => {
  const logs: Array<ActionLog> = [
    { id: 2, time: "10:00:02", gesture: "SWIPE LEFT", action: "PREVIOUS SLIDE", score: 0.91234 },
    { id: 1, time: "10:00:01", gesture: 'SAY "HI"', action: "MUTE", score: 1 },
  ];

  it("serialises JSON with indentation", () => {
    const { content, mimeType } = buildLogExport(logs, "json");
    expect(mimeType).toBe("application/json");
    expect(JSON.parse(content)).toEqual(logs);
    expect(content).toContain("\n  {");
  });

  it("writes CSV with a header, quoted text columns and four-decimal scores", () => {
    const { content, mimeType } = buildLogExport(logs, "csv");
    expect(mimeType).toBe("text/csv");
    expect(content.split("\n")).toEqual([
      "time,gesture,action,score",
      '10:00:02,"SWIPE LEFT","PREVIOUS SLIDE",0.9123',
      '10:00:01,"SAY ""HI""","MUTE",1.0000',
    ]);
  });
});

describe("normalizeActionMap and dist2d", () => {
  it("fills missing gestures from the presentation profile", () => {
    const map = normalizeActionMap({ Victory: "mute" });
    expect(map.Victory).toBe("mute");
    expect(map.Pointing_Up).toBe(PROFILE_MAPS.presentation.Pointing_Up);
    expect(Object.keys(map)).toHaveLength(Object.keys(PROFILE_MAPS.presentation).length);
  });

  it("does not let a saved map mutate the shared profile", () => {
    normalizeActionMap({ Victory: "mute" });
    expect(PROFILE_MAPS.presentation.Victory).toBe("screenshot");
  });

  it("measures the 2D distance between landmarks", () => {
    expect(
      dist2d({ x: 0, y: 0, z: 0, visibility: 1 }, { x: 0.3, y: 0.4, z: 9, visibility: 1 }),
    ).toBeCloseTo(0.5);
  });
});
