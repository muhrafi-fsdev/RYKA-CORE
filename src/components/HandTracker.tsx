import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
import toast from "react-hot-toast";
import { ControlDock } from "./hand-tracker/ControlDock";
import { useCalibration } from "./hand-tracker/useCalibration";
import { CalibrationPanel } from "./hand-tracker/panels/CalibrationPanel";
import { TopHud } from "./hand-tracker/TopHud";
import { usePersistedSetting } from "./hand-tracker/usePersistedSetting";
import { readCompatStorage, readStorage } from "./hand-tracker/storage";
import {
  ACTION_LABELS,
  DESKTOP_ACTIONS,
  GESTURE_LABELS,
  MODEL_URL,
  PINCH_OFF,
  PINCH_ON,
  PROFILE_MAPS,
  PROFILE_MODES,
  QUALITY_CONFIG,
  ROTATE_SPEED,
  VIEW_MODES,
  WASM_URL,
} from "./hand-tracker/constants";
import {
  buildLogExport,
  clampHandCount,
  deriveOrbState,
  deriveStatusText,
  dist2d,
  formatTime,
  normalizeActionMap,
} from "./hand-tracker/logic";
import { ActionLogPanel } from "./hand-tracker/panels/ActionLogPanel";
import { ActionMapperPanel } from "./hand-tracker/panels/ActionMapperPanel";
import { CameraManagerPanel } from "./hand-tracker/panels/CameraManagerPanel";
import { LiveGesturesPanel } from "./hand-tracker/panels/LiveGesturesPanel";
import { OptionGridSection } from "./hand-tracker/panels/OptionGridSection";
import { SecurityCenterPanel } from "./hand-tracker/panels/SecurityCenterPanel";
import {
  AccessLauncherSection,
  ControlStateSection,
  DesktopBridgeInfoSection,
} from "./hand-tracker/panels/StatusSections";
import { SystemPanel } from "./hand-tracker/panels/SystemPanel";
import { TriggerSafetyPanel } from "./hand-tracker/panels/TriggerSafetyPanel";
import { VisualCompatibilityPanel } from "./hand-tracker/panels/VisualCompatibilityPanel";
import type {
  EffectHandsMode,
  EffectSelection,
  LegacyEffectMode,
} from "@/lib/legacyEffects";
import type { BridgePermissions, DesktopBridgeAction } from "@/lib/desktopBridge";
import type { GestureKey, StaticGestureKey } from "@/lib/gestureEngine";
import type { OrbSceneApi } from "@/lib/orbScene";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type {
  ActionKey,
  ActionLog,
  ActionMap,
  BridgeState,
  CameraState,
  CameraViewMode,
  HandGesture,
  PinchState,
  ProfileMode,
  QualityMode,
  TrackerMode,
  ViewMode,
} from "./hand-tracker/types";
import { drawLegacyHandEffect } from "@/lib/legacyEffects";
import RykaAccess from "@/components/RykaAccess";
import { OneEuroFilter } from "@/lib/oneEuroFilter";
import {
  armBridge,
  emergencyStopBridge,
  getBridgeSecurityState,
  sendDesktopAction,
  updateBridgePermissions,
} from "@/lib/desktopBridge";
import { GestureStabilizer } from "@/lib/gestureEngine";
import { DynamicGestureDetector } from "@/lib/dynamicGesture";
import { createOrbScene } from "@/lib/orbScene";

export default function HandTracker() {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbSceneApi | null>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const pinchStatesRef = useRef(new Map<string, PinchState>());
  const motionFiltersRef = useRef(
    new Map<string, { x: OneEuroFilter; y: OneEuroFilter }>(),
  );
  const effectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeEffectModeRef = useRef<LegacyEffectMode>(null);
  const previousModeRef = useRef<TrackerMode>("idle");
  const previousSpinGrabRef = useRef<{ x: number; y: number } | null>(null);
  const previousZoomDistanceRef = useRef<number | null>(null);
  const holdRef = useRef({ gesture: "", hand: "", startedAt: 0 });
  const cooldownUntilRef = useRef(0);
  const dynamicCooldownUntilRef = useRef(0);
  const stabilizerRef = useRef(new GestureStabilizer());
  const dynamicDetectorRef = useRef(new DynamicGestureDetector());
  const calibration = useCalibration(dynamicDetectorRef);
  const {
    processFrame: processCalibrationFrame,
    isCalibratingRef,
    cancel: cancelCalibration,
  } = calibration;
  const lastInferenceRunRef = useRef(0);
  const adaptiveDelayRef = useRef(0);
  const lowFpsTicksRef = useRef(0);
  const controlActiveRef = useRef(false);
  const actionMapRef = useRef<ActionMap>(PROFILE_MAPS.presentation);
  const thresholdRef = useRef(80);
  const holdMsRef = useRef(700);
  const cooldownMsRef = useRef(1200);
  const logIdRef = useRef(1);
  const lastUiRef = useRef(0);
  const perfRef = useRef({ frames: 0, tick: 0 });
  const selectedCameraRef = useRef("");
  const qualityRef = useRef<QualityMode>("balanced");
  const adaptivePerformanceRef = useRef(true);
  const bridgeOnlineRef = useRef(false);
  const numHandsRef = useRef(2);
  const skeletonOnRef = useRef(true);
  const landmarksOnRef = useRef(true);
  const effectsOnRef = useRef(true);
  const cameraViewRef = useRef<CameraViewMode>("composite");
  const mirrorCameraRef = useRef(true);
  const effectSelectionRef = useRef<EffectSelection>("auto");
  const effectHandsModeRef = useRef<EffectHandsMode>("auto");
  const blurStrengthRef = useRef(12);
  const mosaicBlockSizeRef = useRef(16);
  const smoothingRef = useRef(62);
  const accessModeRef = useRef(false);
  const accessGestureIdRef = useRef(1);

  const [camera, setCamera] = useState<CameraState>("off");
  const [error, setError] = useState<string | null>(null);
  const [hands, setHands] = useState(0);
  const [mode, setMode] = useState<TrackerMode>("idle");
  const [gestures, setGestures] = useState<Array<HandGesture>>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [controlActive, setControlActive] = useState(false);
  const [profile, setProfile] = useState<ProfileMode>(() =>
    readCompatStorage("ryka-core-profile", "rafi-ultron-profile", "presentation"),
  );
  const [actionMap, setActionMap] = useState<ActionMap>(() =>
    normalizeActionMap(
      readCompatStorage<Partial<ActionMap>>("ryka-core-action-map", "rafi-ultron-action-map", PROFILE_MAPS.presentation),
    ),
  );
  const [threshold, setThreshold] = useState(() =>
    readCompatStorage("ryka-core-threshold", "rafi-ultron-threshold", 80),
  );
  const [holdMs, setHoldMs] = useState(() =>
    readCompatStorage("ryka-core-hold", "rafi-ultron-hold", 700),
  );
  const [cooldownMs, setCooldownMs] = useState(() =>
    readCompatStorage("ryka-core-cooldown", "rafi-ultron-cooldown", 1200),
  );
  const [candidate, setCandidate] = useState("AWAITING HAND INPUT");
  const [holdProgress, setHoldProgress] = useState(0);
  const [logs, setLogs] = useState<Array<ActionLog>>([]);
  const [fps, setFps] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [scanPulse, setScanPulse] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<Array<MediaDeviceInfo>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() =>
    readCompatStorage("ryka-core-camera-id", "rafi-ultron-camera-id", ""),
  );
  const [quality, setQuality] = useState<QualityMode>(() =>
    readCompatStorage("ryka-core-quality", "rafi-ultron-quality", "balanced"),
  );
  const [adaptivePerformance, setAdaptivePerformance] = useState(() =>
    readCompatStorage("ryka-core-adaptive", "rafi-ultron-adaptive", true),
  );
  const [adaptiveDelay, setAdaptiveDelay] = useState(0);
  const [bridgeState, setBridgeState] = useState<BridgeState>("checking");
  const [bridgePermissions, setBridgePermissions] = useState<BridgePermissions>({
    presentation: true,
    media: true,
  });
  const [bridgeSecurity, setBridgeSecurity] = useState("HMAC-SHA256");
  const [bridgeVersion, setBridgeVersion] = useState("-");
  const [emergencyLocked, setEmergencyLocked] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    readCompatStorage("ryka-core-view", "rafi-ultron-view", "command"),
  );
  const [releaseRequired, setReleaseRequired] = useState(false);
  const [lastDynamicGesture, setLastDynamicGesture] = useState("NONE");
  const [numHands, setNumHands] = useState(() =>
    readStorage("ryka-core-num-hands", 2),
  );
  const [skeletonOn, setSkeletonOn] = useState(() =>
    readStorage("ryka-core-skeleton", true),
  );
  const [landmarksOn, setLandmarksOn] = useState(() =>
    readStorage("ryka-core-landmarks", true),
  );
  const [effectsOn, setEffectsOn] = useState(() =>
    readStorage("ryka-core-effects", true),
  );
  const [cameraView, setCameraView] = useState<CameraViewMode>(() =>
    readStorage("ryka-core-camera-view", "composite"),
  );
  const [mirrorCamera, setMirrorCamera] = useState(() =>
    readStorage("ryka-core-mirror-camera", true),
  );
  const [effectSelection, setEffectSelection] = useState<EffectSelection>(() =>
    readStorage("ryka-core-effect-selection", "auto"),
  );
  const [effectHandsMode, setEffectHandsMode] = useState<EffectHandsMode>(() =>
    readStorage("ryka-core-effect-hands", "auto"),
  );
  const [blurStrength, setBlurStrength] = useState(() =>
    readStorage("ryka-core-blur-strength", 12),
  );
  const [mosaicBlockSize, setMosaicBlockSize] = useState(() =>
    readStorage("ryka-core-mosaic-block", 16),
  );
  const [motionSmoothing, setMotionSmoothing] = useState(() =>
    readStorage("ryka-core-motion-smoothing", 62),
  );
  const [activeEffectMode, setActiveEffectMode] = useState<LegacyEffectMode>(null);
  const [cameraExpanded, setCameraExpanded] = useState(() =>
    readStorage("ryka-core-camera-expanded", false),
  );
  const [accessOpen, setAccessOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname === "/access" ||
      new URLSearchParams(window.location.search).get("mode") === "access"
    );
  });
  const [accessGesture, setAccessGesture] = useState<{
    id: number;
    gesture: GestureKey;
    score: number;
  } | null>(null);

  useEffect(() => {
    const container = sceneContainerRef.current;
    if (!container) return;
    const scene = createOrbScene(container);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    controlActiveRef.current = controlActive;
  }, [controlActive]);

  useEffect(() => {
    accessModeRef.current = accessOpen;
    if (accessOpen) setPanelOpen(false);
  }, [accessOpen]);

  usePersistedSetting(actionMap, "ryka-core-action-map", actionMapRef);

  usePersistedSetting(threshold, "ryka-core-threshold", thresholdRef);

  usePersistedSetting(holdMs, "ryka-core-hold", holdMsRef);

  usePersistedSetting(cooldownMs, "ryka-core-cooldown", cooldownMsRef);

  useEffect(() => {
    localStorage.setItem("ryka-core-profile", JSON.stringify(profile));
    if (profile !== "custom") setActionMap(PROFILE_MAPS[profile]);
  }, [profile]);

  usePersistedSetting(selectedCameraId, "ryka-core-camera-id", selectedCameraRef);

  usePersistedSetting(quality, "ryka-core-quality", qualityRef);

  useEffect(() => {
    adaptivePerformanceRef.current = adaptivePerformance;
    localStorage.setItem("ryka-core-adaptive", JSON.stringify(adaptivePerformance));
    if (!adaptivePerformance) {
      adaptiveDelayRef.current = 0;
      setAdaptiveDelay(0);
    }
  }, [adaptivePerformance]);

  usePersistedSetting(viewMode, "ryka-core-view");

  useEffect(() => {
    const normalized = clampHandCount(numHands);
    numHandsRef.current = normalized;
    localStorage.setItem("ryka-core-num-hands", JSON.stringify(normalized));
    if (recognizerRef.current) {
      void recognizerRef.current.setOptions({ numHands: normalized });
    }
  }, [numHands]);

  usePersistedSetting(skeletonOn, "ryka-core-skeleton", skeletonOnRef);

  usePersistedSetting(landmarksOn, "ryka-core-landmarks", landmarksOnRef);

  useEffect(() => {
    effectsOnRef.current = effectsOn;
    localStorage.setItem("ryka-core-effects", JSON.stringify(effectsOn));
    if (!effectsOn) {
      activeEffectModeRef.current = null;
      setActiveEffectMode(null);
    }
  }, [effectsOn]);

  usePersistedSetting(cameraView, "ryka-core-camera-view", cameraViewRef);

  usePersistedSetting(mirrorCamera, "ryka-core-mirror-camera", mirrorCameraRef);

  usePersistedSetting(effectSelection, "ryka-core-effect-selection", effectSelectionRef);

  usePersistedSetting(effectHandsMode, "ryka-core-effect-hands", effectHandsModeRef);

  usePersistedSetting(blurStrength, "ryka-core-blur-strength", blurStrengthRef);

  usePersistedSetting(mosaicBlockSize, "ryka-core-mosaic-block", mosaicBlockSizeRef);

  useEffect(() => {
    smoothingRef.current = motionSmoothing;
    localStorage.setItem(
      "ryka-core-motion-smoothing",
      JSON.stringify(motionSmoothing),
    );
    motionFiltersRef.current.clear();
  }, [motionSmoothing]);

  usePersistedSetting(cameraExpanded, "ryka-core-camera-expanded");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const refresh = async () => {
      setBridgeState((current) => (current === "online" ? current : "checking"));
      try {
        const security = await getBridgeSecurityState(controller.signal);
        if (cancelled) return;
        bridgeOnlineRef.current = true;
        setBridgeState("online");
        setBridgePermissions(security.permissions);
        setBridgeSecurity(security.security);
        setBridgeVersion(security.version);
        setEmergencyLocked(security.emergencyLocked);
      } catch {
        if (cancelled) return;
        bridgeOnlineRef.current = false;
        setBridgeState("offline");
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 3500);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const refreshCameraDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      setCameraDevices(cameras);
      if (
        selectedCameraRef.current &&
        !cameras.some((device) => device.deviceId === selectedCameraRef.current)
      ) {
        setSelectedCameraId("");
      }
    } catch {
      setCameraDevices([]);
    }
  }, []);

  useEffect(() => {
    void refreshCameraDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshCameraDevices);
    return () =>
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshCameraDevices);
  }, [refreshCameraDevices]);

  useEffect(() => {
    const state = deriveOrbState({
      camera,
      error,
      controlActive,
      scanPulse,
      holdProgress,
      releaseRequired,
      hands,
    });
    sceneRef.current?.setState(state);
    sceneRef.current?.setEnergy(holdProgress / 100);
  }, [camera, controlActive, error, hands, holdProgress, releaseRequired, scanPulse]);

  const drawOverlay = useCallback(
    (
      landmarks: Array<Array<NormalizedLandmark>>,
      drawing: DrawingUtils,
      video: HTMLVideoElement,
    ) => {
      const canvas = overlayRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (cameraViewRef.current === "clean") {
        if (activeEffectModeRef.current !== null) {
          activeEffectModeRef.current = null;
          setActiveEffectMode(null);
        }
        return;
      }

      let nextEffectMode: LegacyEffectMode = null;
      if (
        cameraViewRef.current === "composite" &&
        effectsOnRef.current &&
        landmarks.length > 0
      ) {
        const temporaryCanvas =
          (effectCanvasRef.current ??= document.createElement("canvas"));
        nextEffectMode = drawLegacyHandEffect(
          context,
          video,
          landmarks,
          canvas.width,
          canvas.height,
          temporaryCanvas,
          {
            selection: effectSelectionRef.current,
            handsMode: effectHandsModeRef.current,
            blurStrength: blurStrengthRef.current,
            mosaicBlockSize: mosaicBlockSizeRef.current,
          },
        );
      }

      if (nextEffectMode !== activeEffectModeRef.current) {
        activeEffectModeRef.current = nextEffectMode;
        setActiveEffectMode(nextEffectMode);
      }

      for (const hand of landmarks) {
        if (skeletonOnRef.current) {
          drawing.drawConnectors(hand, GestureRecognizer.HAND_CONNECTIONS, {
            color: "rgba(56,189,248,0.86)",
            lineWidth: 2,
          });
        }
        if (landmarksOnRef.current) {
          drawing.drawLandmarks(hand, {
            color: "#7dd3fc",
            lineWidth: 1,
            radius: 2,
          });
        }
      }
    },
    [],
  );

  const processPinchControl = useCallback(
    (landmarks: Array<Array<NormalizedLandmark>>, labels: Array<string>, now: number) => {
      const pinched: Array<{ x: number; y: number }> = [];
      const seen = new Set<string>();

      landmarks.forEach((lm, index) => {
        const label = labels[index] || `HAND-${index}`;
        seen.add(label);
        const scale = dist2d(lm[0], lm[9]);
        if (scale < 1e-6) return;
        const ratio = dist2d(lm[4], lm[8]) / scale;
        const raw = {
          x: 1 - (lm[4].x + lm[8].x) / 2,
          y: (lm[4].y + lm[8].y) / 2,
        };
        const smoothingRatio = smoothingRef.current / 100;
        let filters = motionFiltersRef.current.get(label);
        if (!filters) {
          filters = { x: new OneEuroFilter(), y: new OneEuroFilter() };
          motionFiltersRef.current.set(label, filters);
        }
        const filterConfig = {
          minCutoff: 2.4 - smoothingRatio * 1.9,
          beta: 0.09 - smoothingRatio * 0.07,
          derivativeCutoff: 1,
        };
        filters.x.configure(filterConfig);
        filters.y.configure(filterConfig);
        const filteredRaw = {
          x: filters.x.filter(raw.x, now),
          y: filters.y.filter(raw.y, now),
        };

        let state = pinchStatesRef.current.get(label);
        if (!state) {
          state = { pinching: false, grab: filteredRaw };
          pinchStatesRef.current.set(label, state);
        }

        if (state.pinching && ratio > PINCH_OFF) state.pinching = false;
        else if (!state.pinching && ratio < PINCH_ON) state.pinching = true;

        state.grab = filteredRaw;

        if (state.pinching) pinched.push(state.grab);
      });

      for (const key of pinchStatesRef.current.keys()) {
        if (!seen.has(key)) {
          pinchStatesRef.current.delete(key);
          motionFiltersRef.current.delete(key);
        }
      }

      const nextMode: TrackerMode =
        pinched.length >= 2 ? "zoom" : pinched.length === 1 ? "spin" : "idle";

      if (nextMode !== previousModeRef.current) {
        previousSpinGrabRef.current = null;
        previousZoomDistanceRef.current = null;
        previousModeRef.current = nextMode;
      }

      if (nextMode === "spin") {
        const grab = pinched[0];
        const previous = previousSpinGrabRef.current;
        if (previous) {
          const dx = grab.x - previous.x;
          const dy = grab.y - previous.y;
          sceneRef.current?.rotateBy(dx * ROTATE_SPEED, dy * ROTATE_SPEED);
        }
        previousSpinGrabRef.current = grab;
      } else if (nextMode === "zoom") {
        const distance = Math.hypot(
          pinched[0].x - pinched[1].x,
          pinched[0].y - pinched[1].y,
        );
        const previous = previousZoomDistanceRef.current;
        if (previous && distance > 1e-4) {
          const factor = Math.min(1.18, Math.max(0.85, previous / distance));
          sceneRef.current?.zoomBy(factor);
        }
        previousZoomDistanceRef.current = distance;
      }

      setMode(nextMode);
    },
    [],
  );

  const captureScreenshot = useCallback(() => {
    const rendererCanvas = sceneContainerRef.current?.querySelector("canvas");
    if (!(rendererCanvas instanceof HTMLCanvasElement)) return;
    try {
      const anchor = document.createElement("a");
      anchor.download = `ryka-core-${Date.now()}.png`;
      anchor.href = rendererCanvas.toDataURL("image/png");
      anchor.click();
    } catch {
      toast.error("SCREENSHOT CAPTURE FAILED");
    }
  }, []);

  const triggerAction = useCallback(
    (gesture: GestureKey, action: ActionKey, score: number) => {
      if (action === "none") return;

      if (action === "screenshot") captureScreenshot();
      if (action === "reset-orb") sceneRef.current?.resetView();
      if (action === "scan-pulse") {
        setScanPulse(true);
        window.setTimeout(() => setScanPulse(false), 900);
      }

      sceneRef.current?.pulse();

      const isDesktopAction = DESKTOP_ACTIONS.has(action);
      if (isDesktopAction) {
        if (emergencyLocked) {
          toast.error("SECURITY LOCK ACTIVE // ARM BRIDGE FROM SECURITY CENTER", {
            duration: 2600,
          });
        } else if (bridgeOnlineRef.current) {
          void sendDesktopAction(action as DesktopBridgeAction)
            .then(() =>
              toast.success(`${ACTION_LABELS[action]} // WINDOWS EXECUTED`, {
                duration: 1600,
              }),
            )
            .catch((caught) => {
              bridgeOnlineRef.current = false;
              setBridgeState("offline");
              toast.error(
                caught instanceof Error
                  ? `DESKTOP BRIDGE // ${caught.message}`
                  : "DESKTOP BRIDGE ACTION FAILED",
              );
            });
        } else {
          toast.error("DESKTOP BRIDGE OFFLINE // RUN npm run dev:desktop", {
            duration: 2600,
          });
        }
      }

      const item: ActionLog = {
        id: logIdRef.current++,
        time: formatTime(),
        gesture: GESTURE_LABELS[gesture],
        action: ACTION_LABELS[action],
        score,
      };
      setLogs((current) => [item, ...current].slice(0, 24));
      if (!isDesktopAction) {
        toast.success(`${item.action} // ${Math.round(score * 100)}%`, {
          duration: 1600,
        });
      }
    },
    [captureScreenshot, emergencyLocked],
  );

  const emitAccessGesture = useCallback((gesture: GestureKey, score: number) => {
    setAccessGesture({
      id: accessGestureIdRef.current++,
      gesture,
      score,
    });
    sceneRef.current?.pulse();
  }, []);

  const processGestureActions = useCallback(
    (
      result: ReturnType<GestureRecognizer["recognizeForVideo"]>,
      now: number,
    ) => {
      const raw = result.gestures
        .map((entry, index) => ({
          gesture: entry[0]?.categoryName as StaticGestureKey | "None" | undefined,
          score: entry[0]?.score ?? 0,
          hand: result.handedness[index]?.[0]?.categoryName ?? "UNKNOWN",
        }))
        .filter(
          (entry): entry is { gesture: StaticGestureKey; score: number; hand: string } =>
            !!entry.gesture && entry.gesture !== "None",
        )
        .sort((a, b) => b.score - a.score)[0] ?? null;

      const stable = stabilizerRef.current.push(raw, now);
      setReleaseRequired(stabilizerRef.current.isReleasePending());

      if (!stable) {
        if (raw) {
          setCandidate(
            `STABILIZING // ${GESTURE_LABELS[raw.gesture]} // ${Math.round(raw.score * 100)}%`,
          );
        } else {
          holdRef.current = { gesture: "", hand: "", startedAt: 0 };
          setHoldProgress(0);
          setCandidate(
            stabilizerRef.current.isReleasePending()
              ? "RELEASE HAND TO RE-ARM TRIGGER"
              : accessModeRef.current
                ? "RYKA ACCESS // AWAITING GESTURE"
                : controlActiveRef.current
                  ? "AWAITING HAND INPUT"
                  : "CONTROL SYSTEM LOCKED",
          );
        }
        return;
      }

      const gesture = stable.gesture;
      const isReleaseRequired = stabilizerRef.current.requiresRelease(gesture);
      setReleaseRequired(isReleaseRequired);

      if (isReleaseRequired) {
        holdRef.current = { gesture: "", hand: "", startedAt: 0 };
        setHoldProgress(0);
        setCandidate(`RELEASE REQUIRED // ${GESTURE_LABELS[gesture]}`);
        return;
      }

      setCandidate(
        `${GESTURE_LABELS[gesture]} // ${stable.hand} // ${Math.round(stable.score * 100)}% // ${stable.votes} VOTES`,
      );

      const accessModeActive = accessModeRef.current;
      if (!accessModeActive && !controlActiveRef.current && gesture !== "Closed_Fist") {
        holdRef.current = { gesture: "", hand: "", startedAt: 0 };
        setHoldProgress(0);
        setCandidate(`CONTROL LOCKED // HOLD CLOSED FIST TO ARM`);
        return;
      }

      const lockAction = accessModeActive
        ? null
        : !controlActiveRef.current && gesture === "Closed_Fist"
          ? "arm"
          : controlActiveRef.current && gesture === "Open_Palm"
            ? "lock"
            : null;
      const requiredHold = accessModeActive
        ? Math.max(500, holdMsRef.current)
        : lockAction
          ? 1200
          : holdMsRef.current;

      if (
        holdRef.current.gesture !== gesture ||
        holdRef.current.hand !== stable.hand
      ) {
        holdRef.current = { gesture, hand: stable.hand, startedAt: now };
      }

      const elapsed = now - holdRef.current.startedAt;
      setHoldProgress(Math.min(100, (elapsed / requiredHold) * 100));

      if (stable.score * 100 < thresholdRef.current) return;
      if (elapsed < requiredHold || now < cooldownUntilRef.current) return;

      let didTrigger = false;
      if (lockAction === "arm") {
        setControlActive(true);
        cooldownUntilRef.current = now + cooldownMsRef.current;
        sceneRef.current?.pulse();
        toast.success("CONTROL SYSTEM ARMED");
        didTrigger = true;
      } else if (lockAction === "lock") {
        setControlActive(false);
        cooldownUntilRef.current = now + cooldownMsRef.current;
        sceneRef.current?.pulse();
        toast("CONTROL SYSTEM LOCKED");
        didTrigger = true;
      } else if (accessModeActive) {
        emitAccessGesture(gesture, stable.score);
        cooldownUntilRef.current = now + Math.max(900, cooldownMsRef.current);
        didTrigger = true;
      } else if (controlActiveRef.current) {
        const action = actionMapRef.current[gesture];
        if (action !== "none") {
          triggerAction(gesture, action, stable.score);
          cooldownUntilRef.current = now + cooldownMsRef.current;
          didTrigger = true;
        }
      }

      holdRef.current = { gesture: "", hand: "", startedAt: 0 };
      setHoldProgress(0);
      if (!didTrigger) return;

      stabilizerRef.current.markTriggered(gesture);
      setReleaseRequired(true);
    },
    [emitAccessGesture, triggerAction],
  );

  const processDynamicGestures = useCallback(
    (
      result: ReturnType<GestureRecognizer["recognizeForVideo"]>,
      now: number,
    ) => {
      const labels = result.handedness.map(
        (entry) => entry[0]?.categoryName ?? "UNKNOWN",
      );
      const events = dynamicDetectorRef.current.update(result.landmarks, labels, now);
      if (
        (!accessModeRef.current && !controlActiveRef.current) ||
        previousModeRef.current !== "idle" ||
        now < dynamicCooldownUntilRef.current ||
        events.length === 0
      ) {
        return;
      }

      const event = events[0];
      const action = actionMapRef.current[event.gesture];
      setLastDynamicGesture(
        `${GESTURE_LABELS[event.gesture]} // ${event.hand} // ${event.speed.toFixed(2)} U/S`,
      );
      setCandidate(
        `${GESTURE_LABELS[event.gesture]} // MOTION VERIFIED // ${event.speed.toFixed(2)} U/S`,
      );
      const score = Math.min(0.99, 0.72 + event.speed * 0.12);
      if (accessModeRef.current) emitAccessGesture(event.gesture, score);
      else triggerAction(event.gesture, action, score);
      dynamicCooldownUntilRef.current = now + Math.max(850, cooldownMsRef.current);
    },
    [emitAccessGesture, triggerAction],
  );

  const stopGestures = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recognizerRef.current?.close();
    recognizerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    pinchStatesRef.current.clear();
    motionFiltersRef.current.clear();
    activeEffectModeRef.current = null;
    stabilizerRef.current.reset();
    dynamicDetectorRef.current.reset();
    cancelCalibration();
    holdRef.current = { gesture: "", hand: "", startedAt: 0 };
    previousModeRef.current = "idle";
    previousSpinGrabRef.current = null;
    previousZoomDistanceRef.current = null;
    setCamera("off");
    setHands(0);
    setMode("idle");
    setGestures([]);
    setCandidate("AWAITING HAND INPUT");
    setHoldProgress(0);
    setReleaseRequired(false);
    setLastDynamicGesture("NONE");
    setActiveEffectMode(null);
    setFps(0);
    setInferenceMs(0);
    const ctx = overlayRef.current?.getContext("2d");
    if (ctx && overlayRef.current) {
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, [cancelCalibration]);

  const startGestures = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay || runningRef.current) return;

    setCamera("starting");
    setError(null);

    try {
      const qualityConfig = QUALITY_CONFIG[qualityRef.current];
      const deviceId = selectedCameraRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: "user" as const }),
          width: { ideal: qualityConfig.width },
          height: { ideal: qualityConfig.height },
          frameRate: { ideal: qualityConfig.frameRate },
        },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      await refreshCameraDevices();

      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
        runningMode: "VIDEO" as const,
        numHands: numHandsRef.current,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      };

      try {
        recognizerRef.current = await GestureRecognizer.createFromOptions(
          vision,
          options,
        );
      } catch {
        recognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" as const },
        });
      }

      runningRef.current = true;
      lastVideoTimeRef.current = -1;
      perfRef.current = { frames: 0, tick: performance.now() };
      lastInferenceRunRef.current = 0;
      adaptiveDelayRef.current = 0;
      lowFpsTicksRef.current = 0;
      setAdaptiveDelay(0);
      setCamera("on");

      const ctx = overlay.getContext("2d");
      const drawing = ctx ? new DrawingUtils(ctx) : null;

      const loop = () => {
        if (!runningRef.current) return;
        rafRef.current = requestAnimationFrame(loop);
        const recognizer = recognizerRef.current;
        if (!recognizer || video.readyState < 2) return;
        if (video.currentTime === lastVideoTimeRef.current) return;
        lastVideoTimeRef.current = video.currentTime;

        const schedulingNow = performance.now();
        const inferenceInterval =
          QUALITY_CONFIG[qualityRef.current].inferenceInterval + adaptiveDelayRef.current;
        if (schedulingNow - lastInferenceRunRef.current < inferenceInterval) return;
        lastInferenceRunRef.current = schedulingNow;

        const started = performance.now();
        const result = recognizer.recognizeForVideo(video, started);
        const finished = performance.now();
        const elapsed = finished - started;

        processPinchControl(
          result.landmarks,
          result.handedness.map((entry) => entry[0]?.categoryName ?? "UNKNOWN"),
          finished,
        );
        if (isCalibratingRef.current) {
          processCalibrationFrame(result.landmarks, finished);
        } else {
          processGestureActions(result, finished);
          processDynamicGestures(result, finished);
        }
        if (drawing) drawOverlay(result.landmarks, drawing, video);

        perfRef.current.frames += 1;
        if (finished - perfRef.current.tick >= 500) {
          const duration = finished - perfRef.current.tick;
          const nextFps = Math.round((perfRef.current.frames / duration) * 1000);
          setFps(nextFps);
          setInferenceMs(Number(elapsed.toFixed(1)));

          if (adaptivePerformanceRef.current) {
            if (nextFps < 17) lowFpsTicksRef.current += 1;
            else lowFpsTicksRef.current = Math.max(0, lowFpsTicksRef.current - 1);

            if (lowFpsTicksRef.current >= 3) {
              adaptiveDelayRef.current = Math.min(70, adaptiveDelayRef.current + 8);
              lowFpsTicksRef.current = 0;
              setAdaptiveDelay(adaptiveDelayRef.current);
            } else if (nextFps > 26 && adaptiveDelayRef.current > 0) {
              adaptiveDelayRef.current = Math.max(0, adaptiveDelayRef.current - 4);
              setAdaptiveDelay(adaptiveDelayRef.current);
            }
          }

          perfRef.current = { frames: 0, tick: finished };
        }

        if (finished - lastUiRef.current >= 100) {
          lastUiRef.current = finished;
          setHands(result.landmarks.length);
          setGestures(
            result.gestures.map((entry, index) => ({
              handedness: result.handedness[index]?.[0]?.categoryName ?? "UNKNOWN",
              gesture: entry[0]?.categoryName ?? "None",
              score: entry[0]?.score ?? 0,
            })),
          );
        }
      };

      loop();
    } catch (caught) {
      stopGestures();
      setCamera("error");
      setError(
        caught instanceof DOMException && caught.name === "NotAllowedError"
          ? "CAMERA ACCESS DENIED"
          : "TRACKING INITIALIZATION FAILED",
      );
    }
  }, [
    drawOverlay,
    isCalibratingRef,
    processCalibrationFrame,
    processDynamicGestures,
    processGestureActions,
    processPinchControl,
    refreshCameraDevices,
    stopGestures,
  ]);

  const toggleGestures = useCallback(() => {
    if (runningRef.current) stopGestures();
    else void startGestures();
  }, [startGestures, stopGestures]);

  const applyCameraSettings = useCallback(() => {
    selectedCameraRef.current = selectedCameraId;
    qualityRef.current = quality;
    if (!runningRef.current) {
      toast("CAMERA CONFIGURATION SAVED");
      return;
    }
    stopGestures();
    window.setTimeout(() => void startGestures(), 180);
  }, [quality, selectedCameraId, startGestures, stopGestures]);

  const exportLogs = useCallback(
    (format: "json" | "csv") => {
      if (logs.length === 0) {
        toast.error("NO ACTION LOG TO EXPORT");
        return;
      }
      const { content, mimeType } = buildLogExport(logs, format);
      const blob = new Blob([content], { type: mimeType });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `ryka-core-log-${Date.now()}.${format}`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    },
    [logs],
  );

  const handlePermissionChange = useCallback(
    async (key: keyof BridgePermissions, enabled: boolean) => {
      const next = { ...bridgePermissions, [key]: enabled };
      setSecurityBusy(true);
      try {
        const saved = await updateBridgePermissions(next);
        setBridgePermissions(saved);
        toast.success(`SECURITY POLICY // ${String(key).toUpperCase()} ${enabled ? "ALLOWED" : "BLOCKED"}`);
      } catch (caught) {
        toast.error(
          caught instanceof Error
            ? `SECURITY POLICY // ${caught.message}`
            : "SECURITY POLICY UPDATE FAILED",
        );
      } finally {
        setSecurityBusy(false);
      }
    },
    [bridgePermissions],
  );

  const handleEmergencyStop = useCallback(async () => {
    setSecurityBusy(true);
    try {
      await emergencyStopBridge();
      setEmergencyLocked(true);
      setControlActive(false);
      controlActiveRef.current = false;
      bridgeOnlineRef.current = true;
      setBridgeState("online");
      toast.error("EMERGENCY STOP ACTIVE // DESKTOP ACTIONS LOCKED", {
        duration: 3200,
      });
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? `EMERGENCY STOP // ${caught.message}`
          : "EMERGENCY STOP FAILED",
      );
    } finally {
      setSecurityBusy(false);
    }
  }, []);

  const handleArmBridge = useCallback(async () => {
    setSecurityBusy(true);
    try {
      await armBridge();
      setEmergencyLocked(false);
      bridgeOnlineRef.current = true;
      setBridgeState("online");
      toast.success("SECURE BRIDGE ARMED // SIGNED ACTIONS ENABLED");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? `ARM BRIDGE // ${caught.message}`
          : "BRIDGE ARM FAILED",
      );
    } finally {
      setSecurityBusy(false);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "F12") {
        event.preventDefault();
        void handleEmergencyStop();
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "g" || event.key === "G") toggleGestures();
      if (event.key === "r" || event.key === "R") sceneRef.current?.resetView();
      if (event.key === "+" || event.key === "=") sceneRef.current?.zoomIn();
      if (event.key === "-" || event.key === "_") sceneRef.current?.zoomOut();
      if (event.key === "p" || event.key === "P") setPanelOpen((value) => !value);
      if (event.key === "a" || event.key === "A") setAccessOpen((value) => !value);
      if (event.key === "1") setViewMode("command");
      if (event.key === "2") setViewMode("minimal");
      if (event.key === "3") setViewMode("debug");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleEmergencyStop, toggleGestures]);

  useEffect(() => stopGestures, [stopGestures]);

  const statusText = useMemo(
    () =>
      deriveStatusText({
        accessOpen,
        camera,
        emergencyLocked,
        controlActive,
        releaseRequired,
        mode,
        hands,
      }),
    [accessOpen, camera, controlActive, emergencyLocked, hands, mode, releaseRequired],
  );

  const handleCameraSelect = useCallback((deviceId: string) => {
    selectedCameraRef.current = deviceId;
    setSelectedCameraId(deviceId);
  }, []);

  const handleQualityChange = useCallback((value: QualityMode) => {
    qualityRef.current = value;
    setQuality(value);
  }, []);

  const handleActionChange = useCallback((gesture: GestureKey, action: ActionKey) => {
    setProfile("custom");
    setActionMap((current) => ({ ...current, [gesture]: action }));
  }, []);

  return (
    <main className={`ultron-root ultron-view-${viewMode}`}>
      <div ref={sceneContainerRef} className="ultron-scene" />
      <div className="ultron-vignette" />
      <div className="ultron-grain" />
      <div className="ultron-scanlines" />
      {scanPulse && <div className="ultron-scan-pulse" />}

      <TopHud
        statusText={statusText}
        camera={camera}
        accessOpen={accessOpen}
        profile={profile}
        bridgeState={bridgeState}
      />

      <ControlDock
        videoRef={videoRef}
        overlayRef={overlayRef}
        camera={camera}
        cameraExpanded={cameraExpanded}
        mirrorCamera={mirrorCamera}
        cameraView={cameraView}
        hands={hands}
        numHands={numHands}
        mode={mode}
        fps={fps}
        quality={quality}
        activeEffectMode={activeEffectMode}
        candidate={candidate}
        holdProgress={holdProgress}
        inferenceMs={inferenceMs}
        adaptiveDelay={adaptiveDelay}
        lastDynamicGesture={lastDynamicGesture}
        error={error}
        accessOpen={accessOpen}
        panelOpen={panelOpen}
        onToggleCameraExpanded={() => setCameraExpanded((value) => !value)}
        onToggleGestures={toggleGestures}
        onOpenAccess={() => setAccessOpen(true)}
        onTogglePanel={() => setPanelOpen((value) => !value)}
        onZoomIn={() => sceneRef.current?.zoomIn()}
        onZoomOut={() => sceneRef.current?.zoomOut()}
        onResetView={() => sceneRef.current?.resetView()}
      />

      <SystemPanel open={panelOpen} onClose={() => setPanelOpen(false)}>
        <ControlStateSection
          controlActive={controlActive}
          onToggle={() => setControlActive((value) => !value)}
        />
        <AccessLauncherSection onOpen={() => setAccessOpen(true)} />
        <DesktopBridgeInfoSection bridgeState={bridgeState} />
        <SecurityCenterPanel
          bridgeState={bridgeState}
          bridgeSecurity={bridgeSecurity}
          bridgeVersion={bridgeVersion}
          bridgePermissions={bridgePermissions}
          emergencyLocked={emergencyLocked}
          securityBusy={securityBusy}
          onPermissionChange={handlePermissionChange}
          onEmergencyStop={handleEmergencyStop}
          onArmBridge={handleArmBridge}
        />
        <VisualCompatibilityPanel
          numHands={numHands}
          cameraView={cameraView}
          skeletonOn={skeletonOn}
          landmarksOn={landmarksOn}
          effectsOn={effectsOn}
          mirrorCamera={mirrorCamera}
          effectSelection={effectSelection}
          effectHandsMode={effectHandsMode}
          blurStrength={blurStrength}
          mosaicBlockSize={mosaicBlockSize}
          motionSmoothing={motionSmoothing}
          activeEffectMode={activeEffectMode}
          onNumHandsChange={setNumHands}
          onCameraViewChange={setCameraView}
          onSkeletonChange={setSkeletonOn}
          onLandmarksChange={setLandmarksOn}
          onEffectsChange={setEffectsOn}
          onMirrorChange={setMirrorCamera}
          onEffectSelectionChange={setEffectSelection}
          onEffectHandsModeChange={setEffectHandsMode}
          onBlurStrengthChange={setBlurStrength}
          onMosaicBlockSizeChange={setMosaicBlockSize}
          onMotionSmoothingChange={setMotionSmoothing}
        />
        <CameraManagerPanel
          selectedCameraId={selectedCameraId}
          cameraDevices={cameraDevices}
          quality={quality}
          adaptivePerformance={adaptivePerformance}
          onCameraChange={handleCameraSelect}
          onQualityChange={handleQualityChange}
          onAdaptiveChange={setAdaptivePerformance}
          onRefresh={() => void refreshCameraDevices()}
          onApply={applyCameraSettings}
        />
        <OptionGridSection<ViewMode>
          title="INTERFACE VIEW"
          options={VIEW_MODES}
          value={viewMode}
          onSelect={setViewMode}
        />
        <OptionGridSection<ProfileMode>
          title="PROFILE"
          options={PROFILE_MODES}
          value={profile}
          onSelect={setProfile}
        />
        <TriggerSafetyPanel
          threshold={threshold}
          holdMs={holdMs}
          cooldownMs={cooldownMs}
          onThresholdChange={setThreshold}
          onHoldMsChange={setHoldMs}
          onCooldownMsChange={setCooldownMs}
        />
        <CalibrationPanel
          profile={calibration.profile}
          session={calibration.session}
          cameraOn={camera === "on"}
          onStart={calibration.start}
          onCancel={calibration.cancel}
          onReset={calibration.reset}
        />
        <ActionMapperPanel actionMap={actionMap} onActionChange={handleActionChange} />
        <LiveGesturesPanel gestures={gestures} />
        <ActionLogPanel logs={logs} onExport={exportLogs} onClear={() => setLogs([])} />
      </SystemPanel>

      <RykaAccess
        open={accessOpen}
        cameraOn={camera === "on"}
        latestGesture={accessGesture}
        onClose={() => {
          setAccessOpen(false);
          if (window.location.pathname === "/access") {
            window.location.assign("/");
          }
        }}
        onToggleCamera={toggleGestures}
      />
    </main>
  );
}
