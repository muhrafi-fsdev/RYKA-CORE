import type { RefObject } from "react";
import type { LegacyEffectMode } from "@/lib/legacyEffects";
import type { CameraState, CameraViewMode, QualityMode, TrackerMode } from "./types";

type ControlDockProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  camera: CameraState;
  cameraExpanded: boolean;
  mirrorCamera: boolean;
  cameraView: CameraViewMode;
  hands: number;
  numHands: number;
  mode: TrackerMode;
  fps: number;
  quality: QualityMode;
  activeEffectMode: LegacyEffectMode;
  candidate: string;
  holdProgress: number;
  inferenceMs: number;
  adaptiveDelay: number;
  lastDynamicGesture: string;
  error: string | null;
  accessOpen: boolean;
  panelOpen: boolean;
  onToggleCameraExpanded: () => void;
  onToggleGestures: () => void;
  onOpenAccess: () => void;
  onTogglePanel: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
};

export function ControlDock({
  videoRef,
  overlayRef,
  camera,
  cameraExpanded,
  mirrorCamera,
  cameraView,
  hands,
  numHands,
  mode,
  fps,
  quality,
  activeEffectMode,
  candidate,
  holdProgress,
  inferenceMs,
  adaptiveDelay,
  lastDynamicGesture,
  error,
  accessOpen,
  panelOpen,
  onToggleCameraExpanded,
  onToggleGestures,
  onOpenAccess,
  onTogglePanel,
  onZoomIn,
  onZoomOut,
  onResetView,
}: ControlDockProps) {
  return (
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
          onClick={onToggleCameraExpanded}
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
          onClick={onToggleGestures}
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
          onClick={onOpenAccess}
        >
          ACCESS
        </button>
        <button
          type="button"
          className="ultron-button"
          aria-pressed={panelOpen}
          onClick={onTogglePanel}
        >
          SYS
        </button>
      </div>
      <div className="ultron-row">
        <button type="button" className="ultron-button" onClick={onZoomIn}>
          +
        </button>
        <button type="button" className="ultron-button" onClick={onZoomOut}>
          −
        </button>
        <button type="button" className="ultron-button ultron-button-wide" onClick={onResetView}>
          RESET
        </button>
      </div>
    </section>
  );
}
