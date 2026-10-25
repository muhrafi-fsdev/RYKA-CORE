import type { AccessController } from "../useRykaAccess";

export function AccessNav({ access }: { access: AccessController }) {
  const {
    setTab,
    tab,
  } = access;

  return (
    <>
      <nav className="ryka-access-tabs" aria-label="Menu RYKA Access">
        {([
          ["communicate", "💬 KOMUNIKASI"],
          ["caption", "CC CAPTION"],
          ["personal", "👤 PERSONAL ACCESS"],
          ["partner", "↔ PARTNER DISPLAY"],
          ["gestures", "✋ PROFIL GESTUR"],
          ["settings", "⚙ SETTINGS"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
