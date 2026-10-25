import type { BridgeState } from "../types";

export function ControlStateSection({
  controlActive,
  onToggle,
}: {
  controlActive: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="ultron-panel-section">
      <h2>CONTROL STATE</h2>
      <button
        type="button"
        className={`ultron-arm-button ${controlActive ? "armed" : ""}`}
        onClick={onToggle}
      >
        {controlActive ? "SYSTEM ARMED" : "SYSTEM LOCKED"}
      </button>
      <p>
        Hold CLOSED FIST for 1.2 seconds to arm. Hold OPEN PALM for 1.2 seconds to lock.
      </p>
    </section>
  );
}

export function AccessLauncherSection({ onOpen }: { onOpen: () => void }) {
  return (
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
      <button type="button" onClick={onOpen}>
        OPEN ACCESS SUITE
      </button>
    </section>
  );
}

export function DesktopBridgeInfoSection({ bridgeState }: { bridgeState: BridgeState }) {
  return (
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
  );
}
