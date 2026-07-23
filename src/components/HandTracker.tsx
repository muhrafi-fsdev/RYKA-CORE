import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import toast from "react-hot-toast";
import { createOrbScene, type OrbSceneApi, type OrbVisualState } from "@/lib/orbScene";
import { DynamicGestureDetector } from "@/lib/dynamicGesture";
import { GestureStabilizer, type GestureKey, type StaticGestureKey } from "@/lib/gestureEngine";
import {
  armBridge,
  emergencyStopBridge,
  getBridgeSecurityState,
  sendDesktopAction,
  updateBridgePermissions,
  type BridgePermissions,
  type DesktopBridgeAction,
} from "@/lib/desktopBridge";
import { OneEuroFilter } from "@/lib/oneEuroFilter";
import RykaAccess from "@/components/RykaAccess";
import {
  drawLegacyHandEffect,
  type EffectHandsMode,
  type EffectSelection,
  type LegacyEffectMode,
} from "@/lib/legacyEffects";

type CameraState = "off" | "starting" | "on" | "error";
type TrackerMode = "idle" | "spin" | "zoom";
type ProfileMode = "presentation" | "media" | "custom";
type QualityMode = "performance" | "balanced" | "quality";
type ViewMode = "command" | "minimal" | "debug";
type CameraViewMode = "composite" | "skeleton" | "clean";
type BridgeState = "checking" | "online" | "offline";
type ActionKey =
  | "none"
  | "next-slide"
  | "previous-slide"
  | "play-pause"
  | "mute"
  | "screenshot"
  | "pointer-mode"
  | "scan-pulse"
  | "reset-orb"
  | "volume-up"
  | "volume-down"
  | "next-track"
  | "previous-track";

type ActionMap = Record<GestureKey, ActionKey>;

type HandGesture = {
  handedness: string;
  gesture: string;
  score: number;
};

type ActionLog = {
  id: number;
  time: string;
  gesture: string;
  action: string;
  score: number;
};

type PinchState = {
  pinching: boolean;
  grab: { x: number; y: number };
};

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

const PINCH_ON = 0.32;
const PINCH_OFF = 0.45;
const ROTATE_SPEED = 5;

const QUALITY_CONFIG: Record<
  QualityMode,
  { width: number; height: number; frameRate: number; inferenceInterval: number }
> = {
  performance: { width: 640, height: 360, frameRate: 24, inferenceInterval: 42 },
  balanced: { width: 960, height: 540, frameRate: 30, inferenceInterval: 30 },
  quality: { width: 1280, height: 720, frameRate: 30, inferenceInterval: 18 },
};

const DESKTOP_ACTIONS = new Set<ActionKey>([
  "next-slide",
  "previous-slide",
  "play-pause",
  "mute",
  "volume-up",
  "volume-down",
  "next-track",
  "previous-track",
]);

const GESTURES: GestureKey[] = [
  "Closed_Fist",
  "Open_Palm",
  "Pointing_Up",
  "Thumb_Down",
  "Thumb_Up",
  "Victory",
  "ILoveYou",
  "Swipe_Left",
  "Swipe_Right",
  "Swipe_Up",
  "Swipe_Down",
];

const GESTURE_LABELS: Record<GestureKey | "None", string> = {
  Closed_Fist: "CLOSED FIST",
  Open_Palm: "OPEN PALM",
  Pointing_Up: "POINTING UP",
  Thumb_Down: "THUMB DOWN",
  Thumb_Up: "THUMB UP",
  Victory: "VICTORY",
  ILoveYou: "I LOVE YOU",
  Swipe_Left: "SWIPE LEFT",
  Swipe_Right: "SWIPE RIGHT",
  Swipe_Up: "SWIPE UP",
  Swipe_Down: "SWIPE DOWN",
  None: "NO GESTURE",
};

const ACTION_LABELS: Record<ActionKey, string> = {
  none: "NO ACTION",
  "next-slide": "NEXT SLIDE",
  "previous-slide": "PREVIOUS SLIDE",
  "play-pause": "PLAY / PAUSE",
  mute: "MUTE",
  screenshot: "CAPTURE SCREENSHOT",
  "pointer-mode": "POINTER MODE",
  "scan-pulse": "SCAN PULSE",
  "reset-orb": "RESET ORB",
  "volume-up": "VOLUME UP",
  "volume-down": "VOLUME DOWN",
  "next-track": "NEXT TRACK",
  "previous-track": "PREVIOUS TRACK",
};

const PROFILE_MAPS: Record<ProfileMode, ActionMap> = {
  presentation: {
    Closed_Fist: "none",
    Open_Palm: "none",
    Pointing_Up: "next-slide",
    Thumb_Down: "previous-slide",
    Thumb_Up: "pointer-mode",
    Victory: "screenshot",
    ILoveYou: "scan-pulse",
    Swipe_Left: "previous-slide",
    Swipe_Right: "next-slide",
    Swipe_Up: "pointer-mode",
    Swipe_Down: "reset-orb",
  },
  media: {
    Closed_Fist: "none",
    Open_Palm: "none",
    Pointing_Up: "play-pause",
    Thumb_Down: "mute",
    Thumb_Up: "play-pause",
    Victory: "screenshot",
    ILoveYou: "reset-orb",
    Swipe_Left: "previous-track",
    Swipe_Right: "next-track",
    Swipe_Up: "volume-up",
    Swipe_Down: "volume-down",
  },
  custom: {
    Closed_Fist: "none",
    Open_Palm: "none",
    Pointing_Up: "next-slide",
    Thumb_Down: "previous-slide",
    Thumb_Up: "play-pause",
    Victory: "screenshot",
    ILoveYou: "scan-pulse",
    Swipe_Left: "previous-slide",
    Swipe_Right: "next-slide",
    Swipe_Up: "volume-up",
    Swipe_Down: "volume-down",
  },
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}


function readCompatStorage<T>(newKey: string, legacyKey: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const newValue = readStorage<T>(newKey, fallback);
    if (localStorage.getItem(newKey) !== null) return newValue;
    return readStorage<T>(legacyKey, fallback);
  } catch {
    return fallback;
  }
}

function normalizeActionMap(map: Partial<ActionMap>): ActionMap {
  return { ...PROFILE_MAPS.presentation, ...map };
}

function dist2d(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatTime() {
  return new Date().toLocaleTimeString("id-ID", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

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
  const [gestures, setGestures] = useState<HandGesture[]>([]);
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
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [fps, setFps] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [scanPulse, setScanPulse] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
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
    return new URLSearchParams(window.location.search).get("mode") === "access";
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

  useEffect(() => {
    actionMapRef.current = actionMap;
    localStorage.setItem("ryka-core-action-map", JSON.stringify(actionMap));
  }, [actionMap]);

  useEffect(() => {
    thresholdRef.current = threshold;
    localStorage.setItem("ryka-core-threshold", JSON.stringify(threshold));
  }, [threshold]);

  useEffect(() => {
    holdMsRef.current = holdMs;
    localStorage.setItem("ryka-core-hold", JSON.stringify(holdMs));
  }, [holdMs]);

  useEffect(() => {
    cooldownMsRef.current = cooldownMs;
    localStorage.setItem("ryka-core-cooldown", JSON.stringify(cooldownMs));
  }, [cooldownMs]);

  useEffect(() => {
    localStorage.setItem("ryka-core-profile", JSON.stringify(profile));
    if (profile !== "custom") setActionMap(PROFILE_MAPS[profile]);
  }, [profile]);

  useEffect(() => {
    selectedCameraRef.current = selectedCameraId;
    localStorage.setItem("ryka-core-camera-id", JSON.stringify(selectedCameraId));
  }, [selectedCameraId]);

  useEffect(() => {
    qualityRef.current = quality;
    localStorage.setItem("ryka-core-quality", JSON.stringify(quality));
  }, [quality]);

  useEffect(() => {
    adaptivePerformanceRef.current = adaptivePerformance;
    localStorage.setItem("ryka-core-adaptive", JSON.stringify(adaptivePerformance));
    if (!adaptivePerformance) {
      adaptiveDelayRef.current = 0;
      setAdaptiveDelay(0);
    }
  }, [adaptivePerformance]);

  useEffect(() => {
    localStorage.setItem("ryka-core-view", JSON.stringify(viewMode));
  }, [viewMode]);

  useEffect(() => {
    const normalized = Math.min(4, Math.max(1, Number(numHands) || 1));
    numHandsRef.current = normalized;
    localStorage.setItem("ryka-core-num-hands", JSON.stringify(normalized));
    if (recognizerRef.current) {
      void recognizerRef.current.setOptions({ numHands: normalized });
    }
  }, [numHands]);

  useEffect(() => {
    skeletonOnRef.current = skeletonOn;
    localStorage.setItem("ryka-core-skeleton", JSON.stringify(skeletonOn));
  }, [skeletonOn]);

  useEffect(() => {
    landmarksOnRef.current = landmarksOn;
    localStorage.setItem("ryka-core-landmarks", JSON.stringify(landmarksOn));
  }, [landmarksOn]);

  useEffect(() => {
    effectsOnRef.current = effectsOn;
    localStorage.setItem("ryka-core-effects", JSON.stringify(effectsOn));
    if (!effectsOn) {
      activeEffectModeRef.current = null;
      setActiveEffectMode(null);
    }
  }, [effectsOn]);

  useEffect(() => {
    cameraViewRef.current = cameraView;
    localStorage.setItem("ryka-core-camera-view", JSON.stringify(cameraView));
  }, [cameraView]);

  useEffect(() => {
    mirrorCameraRef.current = mirrorCamera;
    localStorage.setItem("ryka-core-mirror-camera", JSON.stringify(mirrorCamera));
  }, [mirrorCamera]);

  useEffect(() => {
    effectSelectionRef.current = effectSelection;
    localStorage.setItem(
      "ryka-core-effect-selection",
      JSON.stringify(effectSelection),
    );
  }, [effectSelection]);

  useEffect(() => {
    effectHandsModeRef.current = effectHandsMode;
    localStorage.setItem("ryka-core-effect-hands", JSON.stringify(effectHandsMode));
  }, [effectHandsMode]);

  useEffect(() => {
    blurStrengthRef.current = blurStrength;
    localStorage.setItem("ryka-core-blur-strength", JSON.stringify(blurStrength));
  }, [blurStrength]);

  useEffect(() => {
    mosaicBlockSizeRef.current = mosaicBlockSize;
    localStorage.setItem(
      "ryka-core-mosaic-block",
      JSON.stringify(mosaicBlockSize),
    );
  }, [mosaicBlockSize]);

  useEffect(() => {
    smoothingRef.current = motionSmoothing;
    localStorage.setItem(
      "ryka-core-motion-smoothing",
      JSON.stringify(motionSmoothing),
    );
    motionFiltersRef.current.clear();
  }, [motionSmoothing]);

  useEffect(() => {
    localStorage.setItem(
      "ryka-core-camera-expanded",
      JSON.stringify(cameraExpanded),
    );
  }, [cameraExpanded]);

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
    let state: OrbVisualState = "idle";
    if (error || camera === "error") state = "error";
    else if (camera === "on" && !controlActive) state = "locked";
    else if (scanPulse) state = "triggered";
    else if (camera === "on" && (holdProgress > 0 || releaseRequired)) state = "holding";
    else if (camera === "on" && controlActive && hands > 0) state = "tracking";
    sceneRef.current?.setState(state);
    sceneRef.current?.setEnergy(holdProgress / 100);
  }, [camera, controlActive, error, hands, holdProgress, releaseRequired, scanPulse]);

  const drawOverlay = useCallback(
    (
      landmarks: NormalizedLandmark[][],
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
    (landmarks: NormalizedLandmark[][], labels: string[], now: number) => {
      const pinched: { x: number; y: number }[] = [];
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
  }, []);

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
        processGestureActions(result, finished);
        processDynamicGestures(result, finished);
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
      const content =
        format === "json"
          ? JSON.stringify(logs, null, 2)
          : [
              "time,gesture,action,score",
              ...logs.map((item) =>
                [
                  item.time,
                  `"${item.gesture.replaceAll('"', '""')}"`,
                  `"${item.action.replaceAll('"', '""')}"`,
                  item.score.toFixed(4),
                ].join(","),
              ),
            ].join("\n");
      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/csv",
      });
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

  const statusText = useMemo(() => {
    if (accessOpen) return "RYKA ACCESS";
    if (camera === "starting") return "INITIALIZING";
    if (camera === "error") return "SYSTEM ERROR";
    if (camera === "off") return "GESTURES OFF";
    if (emergencyLocked) return "SECURITY LOCK";
    if (!controlActive) return "CONTROL LOCKED";
    if (releaseRequired) return "RELEASE REQUIRED";
    if (mode === "spin") return "ORB SPIN";
    if (mode === "zoom") return "ORB ZOOM";
    return hands > 0 ? "TRACKING" : "STANDBY";
  }, [accessOpen, camera, controlActive, emergencyLocked, hands, mode, releaseRequired]);

  return (
    <main className={`ultron-root ultron-view-${viewMode}`}>
      <div ref={sceneContainerRef} className="ultron-scene" />
      <div className="ultron-vignette" />
      <div className="ultron-grain" />
      <div className="ultron-scanlines" />
      {scanPulse && <div className="ultron-scan-pulse" />}

      <header className="ultron-hud ultron-title">
        <div>RYKA CORE</div>
        <small>OPERATOR: MUHAMMAD RAFI PRIYO // PERSONAL ACCESS & PARTNER COMMUNICATION 4.4</small>
      </header>

      <div className="ultron-hud ultron-status-top">
        <span className={`ultron-dot ${camera === "on" ? "online" : ""}`} />
        <span>{statusText}</span>
        <span className="ultron-divider">//</span>
        <span>{accessOpen ? "ACCESS" : profile.toUpperCase()}</span>
        <span className="ultron-divider">//</span>
        <span className={`ultron-bridge-state ${bridgeState}`}>
          BRIDGE {bridgeState.toUpperCase()}
        </span>
      </div>

      <div className="ultron-hud ultron-hints">
        <div>
          <span className="ultron-key">DRAG</span> SPIN&nbsp;&nbsp;
          <span className="ultron-key">SCROLL</span> ZOOM
        </div>
        <div>
          <span className="ultron-key">PINCH 1 HAND</span> ROTATE&nbsp;&nbsp;
          <span className="ultron-key">PINCH 2 HANDS</span> ZOOM
        </div>
        <div>
          <span className="ultron-key">CLOSED FIST</span> ARM&nbsp;&nbsp;
          <span className="ultron-key">OPEN PALM</span> LOCK
        </div>
        <div>
          <span className="ultron-key">SWIPE</span> DYNAMIC COMMANDS&nbsp;&nbsp;
          <span className="ultron-key">RELEASE</span> ANTI-REPEAT
        </div>
        <div>
          <span className="ultron-key">G</span> GESTURES&nbsp;&nbsp;
          <span className="ultron-key">P</span> PANEL&nbsp;&nbsp;
          <span className="ultron-key">A</span> ACCESS&nbsp;&nbsp;
          <span className="ultron-key">R</span> RESET&nbsp;&nbsp;
          <span className="ultron-key">1/2/3</span> VIEW&nbsp;&nbsp;
          <span className="ultron-key">CTRL+SHIFT+F12</span> EMERGENCY STOP
        </div>
      </div>

      <section className="ultron-hud ultron-controls">
        <div
          className={`ultron-camera ${camera === "on" ? "visible" : ""} ${
            cameraExpanded ? "expanded" : ""
          }`}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className={`ultron-camera-video ${
              mirrorCamera ? "" : "unmirrored"
            } ${cameraView === "skeleton" ? "camera-hidden" : ""} ${
              cameraView === "clean" ? "camera-clean-feed" : ""
            }`}
          />
          <canvas
            ref={overlayRef}
            width={208}
            height={156}
            className={`ultron-camera-overlay ${
              mirrorCamera ? "" : "unmirrored"
            } ${cameraView === "clean" ? "overlay-hidden" : ""}`}
          />
          <button
            type="button"
            className="ultron-camera-expand"
            onClick={() => setCameraExpanded((value) => !value)}
            aria-label={cameraExpanded ? "Minimize vision preview" : "Expand vision preview"}
          >
            {cameraExpanded ? "MIN" : "MAX"}
          </button>
          <div className="ultron-camera-status">
            {hands > 0
              ? `${hands}/${numHands} HAND${hands > 1 ? "S" : ""} // ${mode.toUpperCase()} // ${fps} FPS // ${quality.toUpperCase()}${
                  activeEffectMode ? ` // ${activeEffectMode.toUpperCase()}` : ""
                }`
              : `SHOW HANDS // MAX ${numHands}`}
          </div>
        </div>

        {camera === "on" && (
          <div className="ultron-candidate-box">
            <div>{candidate}</div>
            <div className="ultron-progress-track">
              <span style={{ width: `${holdProgress}%` }} />
            </div>
            <small>
              {inferenceMs.toFixed(1)} MS INFERENCE // ADAPTIVE +{adaptiveDelay} MS
            </small>
            <small>DYNAMIC: {lastDynamicGesture}</small>
          </div>
        )}

        {error && <div className="ultron-error">{error}</div>}

        <div className="ultron-row">
          <button
            type="button"
            className="ultron-button ultron-button-wide"
            aria-pressed={camera === "on"}
            onClick={toggleGestures}
            disabled={camera === "starting"}
          >
            {camera === "starting"
              ? "INITIALIZING…"
              : camera === "on"
                ? "GESTURES ON"
                : "GESTURES OFF"}
          </button>
          <button
            type="button"
            className="ultron-button"
            aria-pressed={accessOpen}
            onClick={() => setAccessOpen(true)}
          >
            ACCESS
          </button>
          <button
            type="button"
            className="ultron-button"
            aria-pressed={panelOpen}
            onClick={() => setPanelOpen((value) => !value)}
          >
            SYS
          </button>
        </div>
        <div className="ultron-row">
          <button
            type="button"
            className="ultron-button"
            onClick={() => sceneRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            className="ultron-button"
            onClick={() => sceneRef.current?.zoomOut()}
          >
            −
          </button>
          <button
            type="button"
            className="ultron-button ultron-button-wide"
            onClick={() => sceneRef.current?.resetView()}
          >
            RESET
          </button>
        </div>
      </section>

      <aside className={`ultron-panel ${panelOpen ? "open" : ""}`}>
        <div className="ultron-panel-header">
          <div>
            <p>RYKA CORE SYSTEM</p>
            <small>ACCESSIBILITY + LEGACY VISUALS + HMAC SECURITY + WINDOWS BRIDGE</small>
          </div>
          <button type="button" onClick={() => setPanelOpen(false)}>
            ×
          </button>
        </div>

        <div className="ultron-panel-scroll">
          <section className="ultron-panel-section">
            <h2>CONTROL STATE</h2>
            <button
              type="button"
              className={`ultron-arm-button ${controlActive ? "armed" : ""}`}
              onClick={() => setControlActive((value) => !value)}
            >
              {controlActive ? "SYSTEM ARMED" : "SYSTEM LOCKED"}
            </button>
            <p>
              Hold CLOSED FIST for 1.2 seconds to arm. Hold OPEN PALM for 1.2 seconds to lock.
            </p>
          </section>

          <section className="ultron-panel-section">
            <div className="ultron-section-heading-row">
              <h2>RYKA ACCESS</h2>
              <span className="ultron-bridge-state online">LOCAL</span>
            </div>
            <p>
              Gesture-to-text, quick phrase board, text-to-speech, live caption,
              conversation mode, visual sound alerts, emergency communication,
              personal gesture profiles, and accessible display settings.
            </p>
            <button type="button" onClick={() => setAccessOpen(true)}>
              OPEN ACCESS SUITE
            </button>
          </section>

          <section className="ultron-panel-section">
            <div className="ultron-section-heading-row">
              <h2>DESKTOP BRIDGE</h2>
              <span className={`ultron-bridge-state ${bridgeState}`}>
                {bridgeState.toUpperCase()}
              </span>
            </div>
            <p>
              Run <strong>npm run dev:desktop</strong> to enable real Windows slide,
              media, volume, and track controls. Only allowlisted commands are accepted.
            </p>
          </section>

          <section className="ultron-panel-section">
            <div className="ultron-section-heading-row">
              <h2>SECURITY CENTER</h2>
              <span className={`ultron-bridge-state ${emergencyLocked ? "offline" : bridgeState}`}>
                {emergencyLocked ? "EMERGENCY LOCK" : bridgeSecurity}
              </span>
            </div>
            <p className="ultron-safety-note">
              Secure Bridge v{bridgeVersion}: per-session 256-bit bootstrap, HMAC-SHA256
              signing, timestamp validation, nonce replay protection, rate limiting,
              strict Origin/Host checks, and local security audit logs.
            </p>
            <div className="ultron-camera-config">
              <label className="ultron-check-row">
                <span>PRESENTATION COMMANDS</span>
                <input
                  type="checkbox"
                  checked={bridgePermissions.presentation}
                  disabled={securityBusy || bridgeState !== "online" || emergencyLocked}
                  onChange={(event) =>
                    void handlePermissionChange("presentation", event.target.checked)
                  }
                />
              </label>
              <label className="ultron-check-row">
                <span>MEDIA / VOLUME COMMANDS</span>
                <input
                  type="checkbox"
                  checked={bridgePermissions.media}
                  disabled={securityBusy || bridgeState !== "online" || emergencyLocked}
                  onChange={(event) =>
                    void handlePermissionChange("media", event.target.checked)
                  }
                />
              </label>
              <div className="ultron-row">
                <button
                  type="button"
                  disabled={securityBusy || bridgeState !== "online" || emergencyLocked}
                  onClick={() => void handleEmergencyStop()}
                >
                  EMERGENCY STOP
                </button>
                <button
                  type="button"
                  disabled={securityBusy || bridgeState !== "online" || !emergencyLocked}
                  onClick={() => void handleArmBridge()}
                >
                  RE-ARM BRIDGE
                </button>
              </div>
            </div>
            <p>
              Emergency shortcut: <strong>Ctrl + Shift + F12</strong>. Audit file:
              <strong> logs/security-audit.jsonl</strong>. Raw shell commands remain blocked.
            </p>
          </section>

          <section className="ultron-panel-section">
            <h2>RAFI HANDMOTION COMPATIBILITY</h2>
            <p className="ultron-safety-note">
              Legacy controls are preserved: 1–4 hands, skeleton, landmarks,
              mirror, Blur, Mosaic, and Flip 180°. All settings persist locally.
            </p>
            <div className="ultron-camera-config">
              <label>
                <span>MAXIMUM HANDS</span>
                <select
                  value={numHands}
                  onChange={(event) => setNumHands(Number(event.target.value))}
                >
                  <option value={1}>1 HAND</option>
                  <option value={2}>2 HANDS</option>
                  <option value={3}>3 HANDS</option>
                  <option value={4}>4 HANDS</option>
                </select>
              </label>
              <label>
                <span>CAMERA VIEW</span>
                <select
                  value={cameraView}
                  onChange={(event) =>
                    setCameraView(event.target.value as CameraViewMode)
                  }
                >
                  <option value="composite">COMPOSITE // VIDEO + VISUALS</option>
                  <option value="skeleton">SKELETON ONLY</option>
                  <option value="clean">CLEAN CAMERA</option>
                </select>
              </label>
              <label className="ultron-check-row">
                <span>SKELETON CONNECTIONS</span>
                <input
                  type="checkbox"
                  checked={skeletonOn}
                  onChange={(event) => setSkeletonOn(event.target.checked)}
                />
              </label>
              <label className="ultron-check-row">
                <span>LANDMARK POINTS</span>
                <input
                  type="checkbox"
                  checked={landmarksOn}
                  onChange={(event) => setLandmarksOn(event.target.checked)}
                />
              </label>
              <label className="ultron-check-row">
                <span>LEGACY VISUAL EFFECTS</span>
                <input
                  type="checkbox"
                  checked={effectsOn}
                  onChange={(event) => setEffectsOn(event.target.checked)}
                />
              </label>
              <label className="ultron-check-row">
                <span>MIRROR CAMERA</span>
                <input
                  type="checkbox"
                  checked={mirrorCamera}
                  onChange={(event) => setMirrorCamera(event.target.checked)}
                />
              </label>
              <label>
                <span>EFFECT MODE</span>
                <select
                  value={effectSelection}
                  disabled={!effectsOn}
                  onChange={(event) =>
                    setEffectSelection(event.target.value as EffectSelection)
                  }
                >
                  <option value="auto">AUTO // THUMB DIRECTION</option>
                  <option value="blur">BLUR</option>
                  <option value="mosaic">MOSAIC</option>
                  <option value="flip">FLIP 180°</option>
                </select>
              </label>
              <label>
                <span>EFFECT HANDS</span>
                <select
                  value={effectHandsMode}
                  disabled={!effectsOn}
                  onChange={(event) =>
                    setEffectHandsMode(event.target.value as EffectHandsMode)
                  }
                >
                  <option value="auto">AUTO // 1 OR 2 HANDS</option>
                  <option value="single">FIRST HAND ONLY</option>
                  <option value="dual">REQUIRE TWO HANDS</option>
                </select>
              </label>
            </div>
            <label>
              <span>BLUR STRENGTH</span>
              <strong>{blurStrength} PX</strong>
              <input
                type="range"
                min={2}
                max={30}
                value={blurStrength}
                disabled={!effectsOn}
                onChange={(event) => setBlurStrength(Number(event.target.value))}
              />
            </label>
            <label>
              <span>MOSAIC BLOCK SIZE</span>
              <strong>{mosaicBlockSize} PX</strong>
              <input
                type="range"
                min={4}
                max={40}
                value={mosaicBlockSize}
                disabled={!effectsOn}
                onChange={(event) =>
                  setMosaicBlockSize(Number(event.target.value))
                }
              />
            </label>
            <label>
              <span>MOTION SMOOTHING // 1€ FILTER</span>
              <strong>{motionSmoothing}%</strong>
              <input
                type="range"
                min={0}
                max={100}
                value={motionSmoothing}
                onChange={(event) =>
                  setMotionSmoothing(Number(event.target.value))
                }
              />
            </label>
            <p>
              Active effect: <strong>{activeEffectMode?.toUpperCase() ?? "IDLE"}</strong>.
              Auto mode preserves the original thumb/index behavior from Rafi
              HandMotion Modified.
            </p>
          </section>

          <section className="ultron-panel-section">
            <h2>CAMERA MANAGER</h2>
            <div className="ultron-camera-config">
              <label>
                <span>VIDEO INPUT</span>
                <select
                  value={selectedCameraId}
                  onChange={(event) => {
                    selectedCameraRef.current = event.target.value;
                    setSelectedCameraId(event.target.value);
                  }}
                >
                  <option value="">SYSTEM DEFAULT CAMERA</option>
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `CAMERA ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>QUALITY PROFILE</span>
                <select
                  value={quality}
                  onChange={(event) => {
                    const value = event.target.value as QualityMode;
                    qualityRef.current = value;
                    setQuality(value);
                  }}
                >
                  <option value="performance">PERFORMANCE // 640×360</option>
                  <option value="balanced">BALANCED // 960×540</option>
                  <option value="quality">QUALITY // 1280×720</option>
                </select>
              </label>
              <label className="ultron-check-row">
                <span>ADAPTIVE FRAME SKIP</span>
                <input
                  type="checkbox"
                  checked={adaptivePerformance}
                  onChange={(event) => setAdaptivePerformance(event.target.checked)}
                />
              </label>
              <div className="ultron-row">
                <button type="button" onClick={() => void refreshCameraDevices()}>
                  REFRESH
                </button>
                <button type="button" onClick={applyCameraSettings}>
                  APPLY / RESTART
                </button>
              </div>
            </div>
          </section>

          <section className="ultron-panel-section">
            <h2>INTERFACE VIEW</h2>
            <div className="ultron-profile-grid">
              {(["command", "minimal", "debug"] as ViewMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={viewMode === item ? "active" : ""}
                  onClick={() => setViewMode(item)}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section className="ultron-panel-section">
            <h2>PROFILE</h2>
            <div className="ultron-profile-grid">
              {(["presentation", "media", "custom"] as ProfileMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={profile === item ? "active" : ""}
                  onClick={() => setProfile(item)}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section className="ultron-panel-section">
            <h2>TRIGGER SAFETY</h2>
            <p className="ultron-safety-note">
              4-frame weighted voting, 260 ms release gate, confidence filtering,
              hold validation, and cooldown are active.
            </p>
            <label>
              <span>CONFIDENCE</span>
              <strong>{threshold}%</strong>
              <input
                type="range"
                min={50}
                max={99}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
            </label>
            <label>
              <span>HOLD DURATION</span>
              <strong>{holdMs} MS</strong>
              <input
                type="range"
                min={300}
                max={2000}
                step={100}
                value={holdMs}
                onChange={(event) => setHoldMs(Number(event.target.value))}
              />
            </label>
            <label>
              <span>COOLDOWN</span>
              <strong>{cooldownMs} MS</strong>
              <input
                type="range"
                min={500}
                max={3000}
                step={100}
                value={cooldownMs}
                onChange={(event) => setCooldownMs(Number(event.target.value))}
              />
            </label>
          </section>

          <section className="ultron-panel-section">
            <h2>ACTION MAPPER</h2>
            <div className="ultron-mapper-list">
              {GESTURES.map((gesture) => (
                <label key={gesture}>
                  <span>{GESTURE_LABELS[gesture]}</span>
                  <select
                    value={actionMap[gesture]}
                    onChange={(event) => {
                      setProfile("custom");
                      setActionMap((current) => ({
                        ...current,
                        [gesture]: event.target.value as ActionKey,
                      }));
                    }}
                  >
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="ultron-panel-section">
            <div className="ultron-section-heading-row">
              <h2>LIVE GESTURES</h2>
              <span>{gestures.length}</span>
            </div>
            <div className="ultron-live-list">
              {gestures.length === 0 ? (
                <p>NO ACTIVE HAND SIGNATURE</p>
              ) : (
                gestures.map((gesture, index) => (
                  <div key={`${gesture.handedness}-${index}`}>
                    <span>
                      {GESTURE_LABELS[
                        gesture.gesture as GestureKey | "None"
                      ] ?? gesture.gesture}
                    </span>
                    <strong>{Math.round(gesture.score * 100)}%</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="ultron-panel-section">
            <div className="ultron-section-heading-row">
              <h2>ACTION LOG</h2>
              <div className="ultron-log-actions">
                <button type="button" onClick={() => exportLogs("json")}>JSON</button>
                <button type="button" onClick={() => exportLogs("csv")}>CSV</button>
                <button type="button" onClick={() => setLogs([])}>CLEAR</button>
              </div>
            </div>
            <div className="ultron-log-list">
              {logs.length === 0 ? (
                <p>NO COMMANDS TRIGGERED</p>
              ) : (
                logs.map((item) => (
                  <div key={item.id}>
                    <small>{item.time}</small>
                    <span>{item.action}</span>
                    <em>{item.gesture}</em>
                    <strong>{Math.round(item.score * 100)}%</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>

      <RykaAccess
        open={accessOpen}
        cameraOn={camera === "on"}
        latestGesture={accessGesture}
        onClose={() => setAccessOpen(false)}
        onToggleCamera={toggleGestures}
      />
    </main>
  );
}
