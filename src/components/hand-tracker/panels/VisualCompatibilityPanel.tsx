import type {
  EffectHandsMode,
  EffectSelection,
  LegacyEffectMode,
} from "@/lib/legacyEffects";
import type { CameraViewMode } from "../types";

type VisualCompatibilityPanelProps = {
  numHands: number;
  cameraView: CameraViewMode;
  skeletonOn: boolean;
  landmarksOn: boolean;
  effectsOn: boolean;
  mirrorCamera: boolean;
  effectSelection: EffectSelection;
  effectHandsMode: EffectHandsMode;
  blurStrength: number;
  mosaicBlockSize: number;
  motionSmoothing: number;
  activeEffectMode: LegacyEffectMode;
  onNumHandsChange: (value: number) => void;
  onCameraViewChange: (value: CameraViewMode) => void;
  onSkeletonChange: (value: boolean) => void;
  onLandmarksChange: (value: boolean) => void;
  onEffectsChange: (value: boolean) => void;
  onMirrorChange: (value: boolean) => void;
  onEffectSelectionChange: (value: EffectSelection) => void;
  onEffectHandsModeChange: (value: EffectHandsMode) => void;
  onBlurStrengthChange: (value: number) => void;
  onMosaicBlockSizeChange: (value: number) => void;
  onMotionSmoothingChange: (value: number) => void;
};

export function VisualCompatibilityPanel({
  numHands,
  cameraView,
  skeletonOn,
  landmarksOn,
  effectsOn,
  mirrorCamera,
  effectSelection,
  effectHandsMode,
  blurStrength,
  mosaicBlockSize,
  motionSmoothing,
  activeEffectMode,
  onNumHandsChange,
  onCameraViewChange,
  onSkeletonChange,
  onLandmarksChange,
  onEffectsChange,
  onMirrorChange,
  onEffectSelectionChange,
  onEffectHandsModeChange,
  onBlurStrengthChange,
  onMosaicBlockSizeChange,
  onMotionSmoothingChange,
}: VisualCompatibilityPanelProps) {
  return (
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
            onChange={(event) => onNumHandsChange(Number(event.target.value))}
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
            onChange={(event) => onCameraViewChange(event.target.value as CameraViewMode)}
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
            onChange={(event) => onSkeletonChange(event.target.checked)}
          />
        </label>
        <label className="ultron-check-row">
          <span>LANDMARK POINTS</span>
          <input
            type="checkbox"
            checked={landmarksOn}
            onChange={(event) => onLandmarksChange(event.target.checked)}
          />
        </label>
        <label className="ultron-check-row">
          <span>LEGACY VISUAL EFFECTS</span>
          <input
            type="checkbox"
            checked={effectsOn}
            onChange={(event) => onEffectsChange(event.target.checked)}
          />
        </label>
        <label className="ultron-check-row">
          <span>MIRROR CAMERA</span>
          <input
            type="checkbox"
            checked={mirrorCamera}
            onChange={(event) => onMirrorChange(event.target.checked)}
          />
        </label>
        <label>
          <span>EFFECT MODE</span>
          <select
            value={effectSelection}
            disabled={!effectsOn}
            onChange={(event) =>
              onEffectSelectionChange(event.target.value as EffectSelection)
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
              onEffectHandsModeChange(event.target.value as EffectHandsMode)
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
          onChange={(event) => onBlurStrengthChange(Number(event.target.value))}
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
          onChange={(event) => onMosaicBlockSizeChange(Number(event.target.value))}
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
          onChange={(event) => onMotionSmoothingChange(Number(event.target.value))}
        />
      </label>
      <p>
        Active effect: <strong>{activeEffectMode?.toUpperCase() ?? "IDLE"}</strong>.
        Auto mode preserves the original thumb/index behavior from Rafi
        HandMotion Modified.
      </p>
    </section>
  );
}
