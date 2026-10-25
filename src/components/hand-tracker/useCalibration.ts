import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { RefObject } from "react";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { CalibrationProfile, CalibrationSession } from "@/lib/calibration";
import type { DynamicGestureDetector } from "@/lib/dynamicGesture";
import {
  addSample,
  clearCalibration,
  createProfile,
  currentStep,
  deriveSwipeConfig,
  loadCalibration,
  saveCalibration,
  startSession,
} from "@/lib/calibration";
import { DEFAULT_DYNAMIC_CONFIG, SwipeRecorder } from "@/lib/dynamicGesture";

/**
 * Owns the swipe calibration: the saved profile (applied to the detector), the
 * wizard session, and the per-frame recorder. `isCalibratingRef` lets the
 * camera loop suppress gesture actions while the user is calibrating.
 */
export function useCalibration(detectorRef: RefObject<DynamicGestureDetector>) {
  const [profile, setProfile] = useState<CalibrationProfile | null>(() => loadCalibration());
  const [session, setSession] = useState<CalibrationSession | null>(null);
  const sessionRef = useRef<CalibrationSession | null>(null);
  const recorderRef = useRef(new SwipeRecorder());

  useEffect(() => {
    detectorRef.current.configure(profile?.config ?? DEFAULT_DYNAMIC_CONFIG);
  }, [detectorRef, profile]);

  const finish = useCallback((done: CalibrationSession) => {
    const config = deriveSwipeConfig(done.samples);
    sessionRef.current = null;
    setSession(null);
    if (!config) {
      toast.error("CALIBRATION FAILED // TRY AGAIN");
      return;
    }
    const next = createProfile(config);
    saveCalibration(next);
    setProfile(next);
    toast.success("CALIBRATION SAVED");
  }, []);

  const start = useCallback(() => {
    recorderRef.current.reset();
    const fresh = startSession();
    sessionRef.current = fresh;
    setSession(fresh);
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
  }, []);

  const reset = useCallback(() => {
    clearCalibration();
    setProfile(null);
    toast("SWIPE SENSITIVITY RESET TO DEFAULT");
  }, []);

  const processFrame = useCallback(
    (landmarks: Array<Array<NormalizedLandmark>>, now: number) => {
      const current = sessionRef.current;
      const step = current && currentStep(current);
      if (!current || !step) return;

      const sample = recorderRef.current.update(landmarks, step.axis, now);
      if (!sample) return;
      const next = addSample(current, sample);
      if (next === current) return;

      if (currentStep(next) === null) {
        finish(next);
        return;
      }
      sessionRef.current = next;
      setSession(next);
    },
    [finish],
  );

  return { profile, session, isCalibratingRef: sessionRef, start, cancel, reset, processFrame };
}
