import type { GestureKey } from "@/lib/gestureEngine";

export type CameraState = "off" | "starting" | "on" | "error";
export type TrackerMode = "idle" | "spin" | "zoom";
export type ProfileMode = "presentation" | "media" | "custom";
export type QualityMode = "performance" | "balanced" | "quality";
export type ViewMode = "command" | "minimal" | "debug";
export type CameraViewMode = "composite" | "skeleton" | "clean";
export type BridgeState = "checking" | "online" | "offline";
export type ActionKey =
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

export type ActionMap = Record<GestureKey, ActionKey>;

export type HandGesture = {
  handedness: string;
  gesture: string;
  score: number;
};

export type ActionLog = {
  id: number;
  time: string;
  gesture: string;
  action: string;
  score: number;
};

export type PinchState = {
  pinching: boolean;
  grab: { x: number; y: number };
};
