type PointerModePanelProps = {
  active: boolean;
  /** Why pointer mode cannot start, or null when it can. */
  reason: string | null;
  onToggle: () => void;
};

export function PointerModePanel({ active, reason, onToggle }: PointerModePanelProps) {
  return (
    <section className="ultron-panel-section">
      <div className="ultron-section-heading-row">
        <h2>POINTER MODE</h2>
        <span className={`ultron-bridge-state ${active ? "online" : "checking"}`}>
          {active ? "ACTIVE" : "OFF"}
        </span>
      </div>
      <p className="ultron-safety-note">
        Steer the Windows cursor with your index fingertip. Pinch thumb and index to click;
        hold the pinch to drag. It ends when the hand is out of view for 5 seconds, when control
        locks, or on emergency stop (Ctrl + Shift + F12).
      </p>
      <button type="button" disabled={!active && reason !== null} onClick={onToggle}>
        {active ? "STOP POINTER MODE" : "START POINTER MODE"}
      </button>
      {!active && reason && <p>{reason}.</p>}
    </section>
  );
}
