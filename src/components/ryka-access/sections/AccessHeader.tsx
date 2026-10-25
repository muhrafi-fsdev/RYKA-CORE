import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_ROLE_LABELS,
} from "@/lib/accessibility";

export function AccessHeader({ access }: { access: AccessController }) {
  const {
    onClose,
    personalProfile,
    setEmergencyOpen,
    setSetupOpen,
    setTab,
  } = access;

  return (
    <>
      <header className="ryka-access-header">
        <div>
          <strong>RYKA ACCESS 4.4</strong>
          <span>PERSONAL ACCESS & PARTNER COMMUNICATION // TANPA NUSAMIND AI</span>
        </div>
        <div className="ryka-access-header-actions">
          <button type="button" className="ryka-access-role-chip" onClick={() => setTab("personal")}>
            {ACCESS_ROLE_LABELS[personalProfile.role]}
          </button>
          <button type="button" onClick={() => setSetupOpen(true)}>SETUP</button>
          <button type="button" className="ryka-access-emergency-button" onClick={() => setEmergencyOpen(true)}>
            🆘 DARURAT
          </button>
          <button type="button" onClick={onClose} aria-label="Tutup RYKA Access">×</button>
        </div>
      </header>
    </>
  );
}
