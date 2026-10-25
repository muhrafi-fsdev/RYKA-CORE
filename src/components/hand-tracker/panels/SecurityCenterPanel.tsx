import type { BridgePermissions } from "@/lib/desktopBridge";
import type { BridgeState } from "../types";

type SecurityCenterPanelProps = {
  bridgeState: BridgeState;
  bridgeSecurity: string;
  bridgeVersion: string;
  bridgePermissions: BridgePermissions;
  emergencyLocked: boolean;
  securityBusy: boolean;
  onPermissionChange: (key: keyof BridgePermissions, enabled: boolean) => Promise<void>;
  onEmergencyStop: () => Promise<void>;
  onArmBridge: () => Promise<void>;
};

export function SecurityCenterPanel({
  bridgeState,
  bridgeSecurity,
  bridgeVersion,
  bridgePermissions,
  emergencyLocked,
  securityBusy,
  onPermissionChange,
  onEmergencyStop,
  onArmBridge,
}: SecurityCenterPanelProps) {
  return (
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
              void onPermissionChange("presentation", event.target.checked)
            }
          />
        </label>
        <label className="ultron-check-row">
          <span>MEDIA / VOLUME COMMANDS</span>
          <input
            type="checkbox"
            checked={bridgePermissions.media}
            disabled={securityBusy || bridgeState !== "online" || emergencyLocked}
            onChange={(event) => void onPermissionChange("media", event.target.checked)}
          />
        </label>
        <div className="ultron-row">
          <button
            type="button"
            disabled={securityBusy || bridgeState !== "online" || emergencyLocked}
            onClick={() => void onEmergencyStop()}
          >
            EMERGENCY STOP
          </button>
          <button
            type="button"
            disabled={securityBusy || bridgeState !== "online" || !emergencyLocked}
            onClick={() => void onArmBridge()}
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
  );
}
