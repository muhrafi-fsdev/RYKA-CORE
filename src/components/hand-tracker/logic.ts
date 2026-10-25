import { PROFILE_MAPS } from "./constants";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { OrbVisualState } from "@/lib/orbScene";
import type { ActionLog, ActionMap, CameraState, TrackerMode } from "./types";

export function normalizeActionMap(map: Partial<ActionMap>): ActionMap {
  return { ...PROFILE_MAPS.presentation, ...map };
}

export function dist2d(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function formatTime() {
  return new Date().toLocaleTimeString("id-ID", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function clampHandCount(value: unknown) {
  return Math.min(4, Math.max(1, Number(value) || 1));
}

export function deriveOrbState(input: {
  camera: CameraState;
  error: string | null;
  controlActive: boolean;
  scanPulse: boolean;
  holdProgress: number;
  releaseRequired: boolean;
  hands: number;
}): OrbVisualState {
  const { camera, error, controlActive, scanPulse, holdProgress, releaseRequired, hands } =
    input;
  if (error || camera === "error") return "error";
  if (camera === "on" && !controlActive) return "locked";
  if (scanPulse) return "triggered";
  if (camera === "on" && (holdProgress > 0 || releaseRequired)) return "holding";
  if (camera === "on" && controlActive && hands > 0) return "tracking";
  return "idle";
}

export function deriveStatusText(input: {
  accessOpen: boolean;
  camera: CameraState;
  emergencyLocked: boolean;
  controlActive: boolean;
  releaseRequired: boolean;
  mode: TrackerMode;
  hands: number;
  pointerActive?: boolean;
}) {
  const { accessOpen, camera, emergencyLocked, controlActive, releaseRequired, mode, hands } =
    input;
  if (accessOpen) return "RYKA ACCESS";
  if (camera === "starting") return "INITIALIZING";
  if (camera === "error") return "SYSTEM ERROR";
  if (camera === "off") return "GESTURES OFF";
  if (emergencyLocked) return "SECURITY LOCK";
  if (input.pointerActive) return "POINTER ACTIVE";
  if (!controlActive) return "CONTROL LOCKED";
  if (releaseRequired) return "RELEASE REQUIRED";
  if (mode === "spin") return "ORB SPIN";
  if (mode === "zoom") return "ORB ZOOM";
  return hands > 0 ? "TRACKING" : "STANDBY";
}

export function buildLogExport(logs: Array<ActionLog>, format: "json" | "csv") {
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
  return {
    content,
    mimeType: format === "json" ? "application/json" : "text/csv",
  };
}
