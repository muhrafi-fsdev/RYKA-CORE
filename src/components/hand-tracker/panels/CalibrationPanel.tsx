import type { CalibrationProfile, CalibrationSession } from "@/lib/calibration";
import { currentStep } from "@/lib/calibration";

type CalibrationPanelProps = {
  profile: CalibrationProfile | null;
  session: CalibrationSession | null;
  cameraOn: boolean;
  onStart: () => void;
  onCancel: () => void;
  onReset: () => void;
};

export function CalibrationPanel({
  profile,
  session,
  cameraOn,
  onStart,
  onCancel,
  onReset,
}: CalibrationPanelProps) {
  const step = session && currentStep(session);

  return (
    <section className="ultron-panel-section">
      <div className="ultron-section-heading-row">
        <h2>SWIPE CALIBRATION</h2>
        <span className={`ultron-bridge-state ${profile ? "online" : "checking"}`}>
          {profile ? "CALIBRATED" : "DEFAULT"}
        </span>
      </div>
      {step ? (
        <>
          <p className="ultron-safety-note">
            {step.title}: {step.taken}/{step.count}. Swipe the way you normally would, then
            pause. Gesture actions are paused during calibration.
          </p>
          <div className="ultron-progress-track">
            <span style={{ width: `${(step.taken / step.count) * 100}%` }} />
          </div>
          <button type="button" onClick={onCancel}>
            CANCEL
          </button>
        </>
      ) : (
        <>
          <p className="ultron-safety-note">
            {profile
              ? `Swipe thresholds tuned to you: ${profile.config.minHorizontalDistance.toFixed(2)} wide, ${profile.config.minVerticalDistance.toFixed(2)} tall.`
              : "Swipes use the default thresholds. Calibrate to match how far and how fast you swipe."}
          </p>
          <div className="ultron-row">
            <button type="button" disabled={!cameraOn} onClick={onStart}>
              {profile ? "RECALIBRATE" : "START CALIBRATION"}
            </button>
            <button type="button" disabled={!profile} onClick={onReset}>
              RESET
            </button>
          </div>
          {!cameraOn && <p>Turn gestures on first so the camera can see your hand.</p>}
        </>
      )}
    </section>
  );
}
