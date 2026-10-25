import type { AccessInputMode, AccessRole } from "@/lib/accessibility";
import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_INPUT_LABELS,
  ACCESS_NEED_LABELS,
  ACCESS_ROLE_LABELS,
} from "@/lib/accessibility";

export function PersonalTab({ access }: { access: AccessController }) {
  const {
    exportAccessAssessment,
    exportCommunicationCard,
    exportProfile,
    fileInputRef,
    personalProfile,
    printCommunicationCard,
    setPersonalProfile,
    setSettings,
    setSetupOpen,
    settings,
  } = access;

  return (
    <>
      <div className="ryka-access-settings-layout">
        <section className="ryka-access-card ryka-access-personal-summary">
          <div className="ryka-access-card-heading">
            <div>
              <h2>PERSONAL ACCESS PROFILE</h2>
              <p>Profil ini mengatur cara RYKA menampilkan kontrol dan menerima input.</p>
            </div>
            <button type="button" onClick={() => setSetupOpen(true)}>ULANGI SETUP</button>
          </div>
          <div className="ryka-access-profile-summary-grid">
            <div><small>NAMA</small><strong>{personalProfile.displayName || "Belum diisi"}</strong></div>
            <div><small>MODE</small><strong>{ACCESS_ROLE_LABELS[personalProfile.role]}</strong></div>
            <div><small>INPUT</small><strong>{ACCESS_INPUT_LABELS[settings.inputMode]}</strong></div>
            <div><small>LINGKUNGAN</small><strong>{personalProfile.environment.toUpperCase()}</strong></div>
          </div>
          <div className="ryka-access-needs-list">
            {personalProfile.needs.map((need) => <span key={need}>{ACCESS_NEED_LABELS[need]}</span>)}
          </div>
        </section>

        <section className="ryka-access-card">
          <h2>METODE AKSES ALTERNATIF</h2>
          <p>Pilih cara yang paling nyaman. Touch dan mouse tetap selalu tersedia.</p>
          <div className="ryka-access-choice-grid ryka-access-choice-grid-vertical">
            {(Object.entries(ACCESS_INPUT_LABELS) as Array<[AccessInputMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={settings.inputMode === mode ? "active" : ""}
                onClick={() => {
                  setSettings((current) => ({ ...current, inputMode: mode }));
                  setPersonalProfile((current) => ({ ...current, inputMode: mode }));
                }}
              >
                <strong>{label}</strong>
                <small>
                  {mode === "touch" && "Tekan tombol memakai sentuhan atau mouse."}
                  {mode === "keyboard" && "Gunakan angka 1–9 dan shortcut keyboard."}
                  {mode === "switch" && "Sorotan berpindah otomatis; pilih dengan Space/Enter."}
                  {mode === "dwell" && "Arahkan pointer dan tahan tanpa klik."}
                  {mode === "gesture" && "Gunakan pemetaan Gesture-to-Text."}
                </small>
              </button>
            ))}
          </div>
        </section>

        <section className="ryka-access-card">
          <h2>ROLE MODE</h2>
          <p>Mode tidak mengambil hak pengguna. Caregiver dan Professional hanya menampilkan alat konfigurasi tambahan.</p>
          <div className="ryka-access-choice-grid ryka-access-choice-grid-vertical">
            {(Object.entries(ACCESS_ROLE_LABELS) as Array<[AccessRole, string]>).map(([role, label]) => (
              <button
                key={role}
                type="button"
                className={personalProfile.role === role ? "active" : ""}
                onClick={() => setPersonalProfile((current) => ({ ...current, role }))}
              >
                <strong>{label}</strong>
                <small>
                  {role === "user" && "Komunikasi sehari-hari dengan kontrol sederhana."}
                  {role === "caregiver" && "Mengatur phrase board, backup, dan bantuan setup."}
                  {role === "professional" && "Kalibrasi metode akses dan dokumentasi evaluasi."}
                </small>
              </button>
            ))}
          </div>
        </section>

        {personalProfile.role !== "user" && (
          <section className="ryka-access-card">
            <h2>{personalProfile.role === "caregiver" ? "CAREGIVER TOOLS" : "PROFESSIONAL SETUP TOOLS"}</h2>
            <p>Alat ini membantu setup dan backup. Kontrol serta data komunikasi tetap berada pada pengguna utama.</p>
            <div className="ryka-access-profile-actions">
              <button type="button" onClick={exportAccessAssessment}>EXPORT CONFIGURATION SNAPSHOT</button>
              <button type="button" onClick={exportProfile}>BACKUP PROFIL JSON</button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>IMPORT PROFIL</button>
            </div>
            <div className="ryka-access-local-note">
              <span>⚖️</span>
              <div>
                <strong>USER CONTROL FIRST</strong>
                <p>Mode pendamping tidak memberikan akses otomatis ke percakapan privat dan bukan pengganti evaluasi profesional.</p>
              </div>
            </div>
          </section>
        )}

        <section className="ryka-access-card">
          <h2>LOW-TECH FALLBACK</h2>
          <p>Siapkan kartu komunikasi yang tetap dapat digunakan saat kamera, mikrofon, atau perangkat bermasalah.</p>
          <div className="ryka-access-profile-actions">
            <button type="button" onClick={printCommunicationCard}>CETAK / SIMPAN PDF</button>
            <button type="button" onClick={exportCommunicationCard}>DOWNLOAD TXT</button>
            <button type="button" onClick={exportProfile}>BACKUP PROFIL JSON</button>
          </div>
          <div className="ryka-access-local-note">
            <span>🪪</span>
            <div>
              <strong>KARTU KOMUNIKASI</strong>
              <p>Berisi cara berkomunikasi, pesan favorit, dan kalimat darurat. Periksa isinya sebelum dicetak.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
