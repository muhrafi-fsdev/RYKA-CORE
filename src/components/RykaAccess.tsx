import { useRykaAccess } from "./ryka-access/useRykaAccess";
import { AccessHeader } from "./ryka-access/sections/AccessHeader";
import { AccessNav } from "./ryka-access/sections/AccessNav";
import { SetupDialog } from "./ryka-access/sections/SetupDialog";
import { CommunicateTab } from "./ryka-access/sections/CommunicateTab";
import { CaptionTab } from "./ryka-access/sections/CaptionTab";
import { PersonalTab } from "./ryka-access/sections/PersonalTab";
import { PartnerTab } from "./ryka-access/sections/PartnerTab";
import { GesturesTab } from "./ryka-access/sections/GesturesTab";
import { SettingsTab } from "./ryka-access/sections/SettingsTab";
import { PendingGestureDialog } from "./ryka-access/sections/PendingGestureDialog";
import { PartnerDisplay } from "./ryka-access/sections/PartnerDisplay";
import { EmergencyOverlay } from "./ryka-access/sections/EmergencyOverlay";
import type { RykaAccessProps } from "./ryka-access/types";

export default function RykaAccess(props: RykaAccessProps) {
  const access = useRykaAccess(props);
  const {
    emergencyOpen,
    fileInputRef,
    importProfile,
    open,
    partnerDisplayOpen,
    pendingGesture,
    settings,
    setupOpen,
    soundLevel,
    tab,
    visualAlert,
  } = access;

  if (!open) return null;

  const rootClasses = [
    "ryka-access",
    settings.largeText ? "ryka-access-large" : "",
    settings.highContrast ? "ryka-access-contrast" : "",
    settings.reducedMotion ? "ryka-access-reduced-motion" : "",
    visualAlert ? "ryka-access-alerting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} role="dialog" aria-modal="true" aria-label="RYKA Access communication suite">
      <AccessHeader access={access} />

      <AccessNav access={access} />

      {setupOpen && <SetupDialog access={access} />}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importProfile(file);
          event.target.value = "";
        }}
      />

      {visualAlert && (
        <div className="ryka-access-visual-alert" role="alert">
          <strong>⚠ {visualAlert}</strong>
          <span>Level mikrofon: {soundLevel}%</span>
        </div>
      )}

      <div className="ryka-access-body">
        {tab === "communicate" && <CommunicateTab access={access} />}
        {tab === "caption" && <CaptionTab access={access} />}
        {tab === "personal" && <PersonalTab access={access} />}
        {tab === "partner" && <PartnerTab access={access} />}
        {tab === "gestures" && <GesturesTab access={access} />}
        {tab === "settings" && <SettingsTab access={access} />}
      </div>

      {pendingGesture && <PendingGestureDialog access={access} />}

      {partnerDisplayOpen && <PartnerDisplay access={access} />}

      {emergencyOpen && <EmergencyOverlay access={access} />}
    </div>
  );
}
