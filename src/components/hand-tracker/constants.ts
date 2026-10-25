import type { GestureKey } from "@/lib/gestureEngine";
import type { ActionKey, ActionMap, ProfileMode, QualityMode, ViewMode } from "./types";

export const VIEW_MODES: ReadonlyArray<ViewMode> = ["command", "minimal", "debug"];
export const PROFILE_MODES: ReadonlyArray<ProfileMode> = [
  "presentation",
  "media",
  "custom",
];

export const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

export const PINCH_ON = 0.32;
export const PINCH_OFF = 0.45;
export const ROTATE_SPEED = 5;

export const QUALITY_CONFIG: Record<
  QualityMode,
  { width: number; height: number; frameRate: number; inferenceInterval: number }
> = {
  performance: { width: 640, height: 360, frameRate: 24, inferenceInterval: 42 },
  balanced: { width: 960, height: 540, frameRate: 30, inferenceInterval: 30 },
  quality: { width: 1280, height: 720, frameRate: 30, inferenceInterval: 18 },
};

export const DESKTOP_ACTIONS = new Set<ActionKey>([
  "next-slide",
  "previous-slide",
  "play-pause",
  "mute",
  "volume-up",
  "volume-down",
  "next-track",
  "previous-track",
]);

export const GESTURES: Array<GestureKey> = [
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

export const GESTURE_LABELS: Record<GestureKey | "None", string> = {
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

export const ACTION_LABELS: Record<ActionKey, string> = {
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

export const PROFILE_MAPS: Record<ProfileMode, ActionMap> = {
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
