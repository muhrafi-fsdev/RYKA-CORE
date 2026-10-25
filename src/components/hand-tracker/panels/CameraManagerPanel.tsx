import type { QualityMode } from "../types";

type CameraManagerPanelProps = {
  selectedCameraId: string;
  cameraDevices: Array<MediaDeviceInfo>;
  quality: QualityMode;
  adaptivePerformance: boolean;
  onCameraChange: (deviceId: string) => void;
  onQualityChange: (quality: QualityMode) => void;
  onAdaptiveChange: (enabled: boolean) => void;
  onRefresh: () => void;
  onApply: () => void;
};

export function CameraManagerPanel({
  selectedCameraId,
  cameraDevices,
  quality,
  adaptivePerformance,
  onCameraChange,
  onQualityChange,
  onAdaptiveChange,
  onRefresh,
  onApply,
}: CameraManagerPanelProps) {
  return (
    <section className="ultron-panel-section">
      <h2>CAMERA MANAGER</h2>
      <div className="ultron-camera-config">
        <label>
          <span>VIDEO INPUT</span>
          <select
            value={selectedCameraId}
            onChange={(event) => onCameraChange(event.target.value)}
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
            onChange={(event) => onQualityChange(event.target.value as QualityMode)}
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
            onChange={(event) => onAdaptiveChange(event.target.checked)}
          />
        </label>
        <div className="ultron-row">
          <button type="button" onClick={onRefresh}>
            REFRESH
          </button>
          <button type="button" onClick={onApply}>
            APPLY / RESTART
          </button>
        </div>
      </div>
    </section>
  );
}
