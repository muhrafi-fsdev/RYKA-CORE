// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwipeSample } from "@/lib/dynamicGesture";
import {
  CALIBRATION_KEY,
  addSample,
  calibrationSchema,
  clearCalibration,
  createProfile,
  currentStep,
  deriveSwipeConfig,
  loadCalibration,
  saveCalibration,
  startSession,
} from "@/lib/calibration";

const h = (distance: number, speed: number): SwipeSample => ({ axis: "x", distance, speed });
const v = (distance: number, speed: number): SwipeSample => ({ axis: "y", distance, speed });

const typical = [h(0.3, 0.8), h(0.32, 0.9), h(0.28, 0.7), v(0.25, 0.7), v(0.27, 0.8), v(0.23, 0.6)];

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("deriveSwipeConfig", () => {
  it("needs three swipes on each axis", () => {
    expect(deriveSwipeConfig([])).toBeNull();
    expect(deriveSwipeConfig(typical.slice(0, 5))).toBeNull();
    expect(deriveSwipeConfig([h(0.3, 0.8), h(0.3, 0.8), h(0.3, 0.8)])).toBeNull();
  });

  it("sets thresholds to a share of the median swipe on each axis", () => {
    const config = deriveSwipeConfig(typical)!;
    expect(config.minHorizontalDistance).toBeCloseTo(0.55 * 0.3, 3);
    expect(config.minHorizontalSpeed).toBeCloseTo(0.5 * 0.8, 3);
    expect(config.minVerticalDistance).toBeCloseTo(0.55 * 0.25, 2);
    expect(config.minVerticalSpeed).toBeCloseTo(0.5 * 0.7, 3);
  });

  it("is not thrown off by one wild swipe", () => {
    const withOutlier = [h(0.3, 0.8), h(0.31, 0.8), h(1.5, 4), v(0.25, 0.7), v(0.25, 0.7), v(0.25, 0.7)];
    expect(deriveSwipeConfig(withOutlier)!.minHorizontalDistance).toBeCloseTo(0.55 * 0.31, 2);
  });

  it("never goes below the floor, so ordinary movement cannot fire swipes", () => {
    const tiny = [h(0.05, 0.1), h(0.05, 0.1), h(0.05, 0.1), v(0.05, 0.1), v(0.05, 0.1), v(0.05, 0.1)];
    expect(deriveSwipeConfig(tiny)).toEqual({
      minHorizontalDistance: 0.1,
      minHorizontalSpeed: 0.3,
      minVerticalDistance: 0.1,
      minVerticalSpeed: 0.3,
    });
  });

  it("never goes above the ceiling, so a normal swipe keeps working", () => {
    const huge = [h(2, 9), h(2, 9), h(2, 9), v(2, 9), v(2, 9), v(2, 9)];
    expect(deriveSwipeConfig(huge)).toEqual({
      minHorizontalDistance: 0.35,
      minHorizontalSpeed: 1.2,
      minVerticalDistance: 0.35,
      minVerticalSpeed: 1.2,
    });
  });

  it("rounds to three decimals", () => {
    const config = deriveSwipeConfig(typical)!;
    for (const value of Object.values(config)) {
      expect(Math.round(value * 1000) / 1000).toBe(value);
    }
  });
});

describe("calibration session", () => {
  it("asks for horizontal swipes first, then vertical", () => {
    let session = startSession();
    expect(currentStep(session)).toMatchObject({ axis: "x", taken: 0, count: 3 });

    for (let i = 0; i < 3; i += 1) session = addSample(session, h(0.3, 0.8));
    expect(currentStep(session)).toMatchObject({ axis: "y", taken: 0, count: 3 });

    for (let i = 0; i < 3; i += 1) session = addSample(session, v(0.3, 0.8));
    expect(currentStep(session)).toBeNull();
  });

  it("ignores a sample for the axis it is not asking for", () => {
    const session = startSession();
    expect(addSample(session, v(0.3, 0.8))).toBe(session);
  });

  it("ignores samples once it is complete", () => {
    let session = startSession();
    for (const sample of typical) session = addSample(session, sample);
    expect(addSample(session, h(0.3, 0.8))).toBe(session);
    expect(session.samples).toHaveLength(6);
  });

  it("does not mutate the previous session", () => {
    const before = startSession();
    addSample(before, h(0.3, 0.8));
    expect(before.samples).toHaveLength(0);
  });
});

describe("saved calibration", () => {
  const config = deriveSwipeConfig(typical)!;

  it("round-trips through storage", () => {
    const profile = createProfile(config, 1_700_000_000_000);
    saveCalibration(profile);
    expect(loadCalibration()).toEqual(profile);
  });

  it("loads null when nothing is saved", () => {
    expect(loadCalibration()).toBeNull();
  });

  it("ignores corrupted JSON", () => {
    localStorage.setItem(CALIBRATION_KEY, "{broken");
    expect(loadCalibration()).toBeNull();
  });

  it("ignores another version, missing fields and out-of-range values", () => {
    const good = createProfile(config);
    for (const bad of [
      { ...good, version: 2 },
      { version: 1, calibratedAt: 1 },
      { ...good, config: { ...good.config, minHorizontalDistance: 0.01 } },
      { ...good, config: { ...good.config, minVerticalSpeed: 50 } },
      { ...good, config: { ...good.config, minHorizontalSpeed: "fast" } },
      { ...good, calibratedAt: -5 },
    ]) {
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(bad));
      expect(loadCalibration()).toBeNull();
    }
  });

  it("clears the saved profile", () => {
    saveCalibration(createProfile(config));
    clearCalibration();
    expect(localStorage.getItem(CALIBRATION_KEY)).toBeNull();
  });

  it("survives storage that refuses writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveCalibration(createProfile(config))).not.toThrow();
  });

  it("validates what the wizard produces", () => {
    expect(calibrationSchema.safeParse(createProfile(config)).success).toBe(true);
  });
});
