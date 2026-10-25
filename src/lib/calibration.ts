import { z } from "zod";
import type { DynamicGestureConfig, SwipeSample } from "@/lib/dynamicGesture";

export const CALIBRATION_KEY = "ryka-core-calibration";

/** Swipes asked from the user, in order. */
export const CALIBRATION_STEPS = [
  { axis: "x", title: "SWIPE LEFT AND RIGHT", count: 3 },
  { axis: "y", title: "SWIPE UP AND DOWN", count: 3 },
] as const;

/** Share of the user's median swipe that must be reached to trigger. */
const DISTANCE_SHARE = 0.55;
const SPEED_SHARE = 0.5;

/**
 * Safe bounds for a derived threshold. Below the floor ordinary hand movement
 * would fire swipes; above the ceiling a normal swipe would stop registering.
 */
const DISTANCE_RANGE = { min: 0.1, max: 0.35 } as const;
const SPEED_RANGE = { min: 0.3, max: 1.2 } as const;

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

function median(values: Array<number>) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function axisThresholds(samples: Array<SwipeSample>) {
  return {
    distance: round3(
      clamp(DISTANCE_SHARE * median(samples.map((item) => item.distance)), DISTANCE_RANGE),
    ),
    speed: round3(clamp(SPEED_SHARE * median(samples.map((item) => item.speed)), SPEED_RANGE)),
  };
}

/** Swipe thresholds from what the user actually did, or null when there is too little data. */
export function deriveSwipeConfig(samples: Array<SwipeSample>): DynamicGestureConfig | null {
  const horizontal = samples.filter((item) => item.axis === "x");
  const vertical = samples.filter((item) => item.axis === "y");
  const needed = (axis: "x" | "y") => CALIBRATION_STEPS.find((step) => step.axis === axis)!.count;
  if (horizontal.length < needed("x") || vertical.length < needed("y")) return null;

  const h = axisThresholds(horizontal);
  const v = axisThresholds(vertical);
  return {
    minHorizontalDistance: h.distance,
    minHorizontalSpeed: h.speed,
    minVerticalDistance: v.distance,
    minVerticalSpeed: v.speed,
  };
}

export type CalibrationSession = { samples: Array<SwipeSample> };

export const startSession = (): CalibrationSession => ({ samples: [] });

/** The swipe the wizard is waiting for, or null once every step has enough samples. */
export function currentStep(session: CalibrationSession) {
  for (const step of CALIBRATION_STEPS) {
    const taken = session.samples.filter((item) => item.axis === step.axis).length;
    if (taken < step.count) return { ...step, taken };
  }
  return null;
}

/** Adds a sample; returns the same session when it is not the axis being asked for. */
export function addSample(session: CalibrationSession, sample: SwipeSample): CalibrationSession {
  const step = currentStep(session);
  if (!step || step.axis !== sample.axis) return session;
  return { samples: [...session.samples, sample] };
}

const distance = z.number().min(DISTANCE_RANGE.min).max(DISTANCE_RANGE.max);
const speed = z.number().min(SPEED_RANGE.min).max(SPEED_RANGE.max);

export const calibrationSchema = z.object({
  version: z.literal(1),
  calibratedAt: z.number().int().positive(),
  config: z.object({
    minHorizontalDistance: distance,
    minVerticalDistance: distance,
    minHorizontalSpeed: speed,
    minVerticalSpeed: speed,
  }),
});

export type CalibrationProfile = z.infer<typeof calibrationSchema>;

export function createProfile(config: DynamicGestureConfig, now = Date.now()): CalibrationProfile {
  return { version: 1, calibratedAt: now, config };
}

/** Saved calibration, or null when absent, corrupted, from another version or out of range. */
export function loadCalibration(): CalibrationProfile | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) return null;
    const parsed = calibrationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveCalibration(profile: CalibrationProfile) {
  try {
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be unavailable (private mode); calibration then lasts for this session only.
  }
}

export function clearCalibration() {
  try {
    localStorage.removeItem(CALIBRATION_KEY);
  } catch {
    // Nothing stored if storage is unavailable.
  }
}
