// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCalibration } from "./useCalibration";
import {
  CALIBRATION_KEY,
  createProfile,
  currentStep,
  saveCalibration,
} from "@/lib/calibration";
import { DEFAULT_DYNAMIC_CONFIG, DynamicGestureDetector } from "@/lib/dynamicGesture";

const FRAME_MS = 55;

function hand(x: number, y: number) {
  return [Array.from({ length: 21 }, () => ({ x, y, z: 0, visibility: 1 }))];
}

/** One swipe (8 moving frames) followed by a pause long enough to end it. */
function swipeFrames(axis: "x" | "y", startAt: number) {
  const frames: Array<{ landmarks: ReturnType<typeof hand>; at: number }> = [];
  const position = (i: number) => (axis === "x" ? hand(0.8 - i * 0.045, 0.5) : hand(0.5, 0.2 + i * 0.04));
  for (let i = 0; i < 8; i += 1) frames.push({ landmarks: position(i), at: startAt + i * FRAME_MS });
  const last = startAt + 7 * FRAME_MS;
  for (let i = 1; i <= 24; i += 1) frames.push({ landmarks: position(7), at: last + i * FRAME_MS });
  return frames;
}

function setup() {
  const detector = new DynamicGestureDetector();
  const detectorRef = { current: detector };
  const rendered = renderHook(() => useCalibration(detectorRef));
  return { detector, ...rendered };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useCalibration", () => {
  it("starts with no profile and leaves the detector on its defaults", () => {
    const { result } = setup();
    expect(result.current.profile).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.isCalibratingRef.current).toBeNull();
  });

  it("loads a saved profile and applies it to the detector", () => {
    const profile = createProfile({
      minHorizontalDistance: 0.12,
      minVerticalDistance: 0.11,
      minHorizontalSpeed: 0.35,
      minVerticalSpeed: 0.33,
    });
    saveCalibration(profile);
    const { result, detector } = setup();
    expect(result.current.profile).toEqual(profile);
    // The detector now fires on a swipe the defaults would ignore.
    const events = [];
    for (let i = 0; i < 7; i += 1) {
      events.push(...detector.update([hand(0.8 - i * 0.02, 0.5)[0]], ["Right"], i * FRAME_MS));
    }
    expect(events.some((e) => e.gesture === "Swipe_Right")).toBe(true);
  });

  it("ignores frames when no wizard is running", () => {
    const { result } = setup();
    act(() => {
      for (const frame of swipeFrames("x", 0)) result.current.processFrame(frame.landmarks, frame.at);
    });
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem(CALIBRATION_KEY)).toBeNull();
  });

  it("walks through six swipes, then saves and applies the calibration", () => {
    const { result, detector } = setup();
    act(() => result.current.start());
    expect(result.current.isCalibratingRef.current).not.toBeNull();
    expect(currentStep(result.current.session!)).toMatchObject({ axis: "x", taken: 0 });

    let clock = 0;
    for (const axis of ["x", "x", "x", "y", "y", "y"] as const) {
      act(() => {
        for (const frame of swipeFrames(axis, clock)) {
          result.current.processFrame(frame.landmarks, frame.at);
        }
      });
      clock += 8000;
    }

    expect(result.current.session).toBeNull();
    expect(result.current.isCalibratingRef.current).toBeNull();
    const profile = result.current.profile!;
    expect(profile).not.toBeNull();
    expect(profile.config.minHorizontalDistance).toBeLessThan(DEFAULT_DYNAMIC_CONFIG.minHorizontalDistance);
    expect(JSON.parse(localStorage.getItem(CALIBRATION_KEY)!)).toEqual(profile);

    // The detector was reconfigured with the personal thresholds.
    const events = [];
    for (let i = 0; i < 7; i += 1) {
      events.push(...detector.update([hand(0.8 - i * 0.03, 0.5)[0]], ["Right"], clock + i * FRAME_MS));
    }
    expect(events.some((e) => e.gesture === "Swipe_Right")).toBe(true);
  });

  it("only advances on the axis it asks for", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => {
      for (const frame of swipeFrames("y", 0)) result.current.processFrame(frame.landmarks, frame.at);
    });
    expect(currentStep(result.current.session!)).toMatchObject({ axis: "x", taken: 0 });
  });

  it("cancel drops the session without saving", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.cancel());
    expect(result.current.session).toBeNull();
    expect(result.current.isCalibratingRef.current).toBeNull();
    expect(localStorage.getItem(CALIBRATION_KEY)).toBeNull();
  });

  it("reset removes the profile and restores the default thresholds", () => {
    saveCalibration(
      createProfile({
        minHorizontalDistance: 0.12,
        minVerticalDistance: 0.11,
        minHorizontalSpeed: 0.35,
        minVerticalSpeed: 0.33,
      }),
    );
    const { result, detector } = setup();
    act(() => result.current.reset());
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem(CALIBRATION_KEY)).toBeNull();

    const events = [];
    for (let i = 0; i < 7; i += 1) {
      events.push(...detector.update([hand(0.8 - i * 0.02, 0.5)[0]], ["Right"], i * FRAME_MS));
    }
    expect(events).toHaveLength(0);
  });
});
