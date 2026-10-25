import toast from "react-hot-toast";
import type { AccessInputMode, AccessNeed, AccessRole, PersonalAccessProfile } from "@/lib/accessibility";
import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_INPUT_LABELS,
  ACCESS_NEED_LABELS,
  ACCESS_ROLE_LABELS,
} from "@/lib/accessibility";

export function SetupDialog({ access }: { access: AccessController }) {
  const {
    personalProfile,
    setPersonalProfile,
    setSettings,
    setSetupOpen,
  } = access;

  return (
    <>
      <div className="ryka-access-setup-backdrop" role="dialog" aria-modal="true" aria-label="Personal Needs Setup">
        <section className="ryka-access-setup-card">
          <div className="ryka-access-card-heading">
            <div>
              <small>PERSONAL NEEDS SETUP</small>
              <h2>ATUR RYKA SESUAI KEBUTUHAN PENGGUNA</h2>
              <p>Pengaturan dapat diubah kapan saja. Pilih lebih dari satu kebutuhan bila diperlukan.</p>
            </div>
            {personalProfile.completed && (
              <button type="button" onClick={() => setSetupOpen(false)} aria-label="Tutup setup">×</button>
            )}
          </div>

          <div className="ryka-access-setup-grid">
            <label className="ryka-access-field-row">
              <span>NAMA TAMPILAN</span>
              <input
                type="text"
                value={personalProfile.displayName}
                maxLength={60}
                placeholder="Nama pengguna (opsional)"
                onChange={(event) => setPersonalProfile((current) => ({ ...current, displayName: event.target.value }))}
              />
            </label>

            <div className="ryka-access-setup-section">
              <strong>KEBUTUHAN UTAMA</strong>
              <div className="ryka-access-choice-grid">
                {(Object.entries(ACCESS_NEED_LABELS) as Array<[AccessNeed, string]>).map(([need, label]) => {
                  const active = personalProfile.needs.includes(need);
                  return (
                    <button
                      key={need}
                      type="button"
                      className={active ? "active" : ""}
                      aria-pressed={active}
                      onClick={() => setPersonalProfile((current) => ({
                        ...current,
                        needs: active
                          ? current.needs.filter((item) => item !== need)
                          : [...current.needs, need],
                      }))}
                    >
                      {active ? "✓ " : ""}{label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ryka-access-setup-section">
              <strong>METODE INPUT UTAMA</strong>
              <div className="ryka-access-choice-grid">
                {(Object.entries(ACCESS_INPUT_LABELS) as Array<[AccessInputMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={personalProfile.inputMode === mode ? "active" : ""}
                    onClick={() => {
                      setPersonalProfile((current) => ({ ...current, inputMode: mode }));
                      setSettings((current) => ({ ...current, inputMode: mode }));
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="ryka-access-field-row">
              <span>MODE PENGGUNA</span>
              <select
                value={personalProfile.role}
                onChange={(event) => setPersonalProfile((current) => ({ ...current, role: event.target.value as AccessRole }))}
              >
                {(Object.entries(ACCESS_ROLE_LABELS) as Array<[AccessRole, string]>).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </label>

            <label className="ryka-access-field-row">
              <span>DUKUNGAN BACA</span>
              <select
                value={personalProfile.readingSupport}
                onChange={(event) => setPersonalProfile((current) => ({
                  ...current,
                  readingSupport: event.target.value as PersonalAccessProfile["readingSupport"],
                }))}
              >
                <option value="text">Teks utama</option>
                <option value="text-symbol">Teks + simbol</option>
                <option value="symbol">Simbol dominan</option>
              </select>
            </label>

            <label className="ryka-access-field-row">
              <span>TANGAN DOMINAN</span>
              <select
                value={personalProfile.dominantHand}
                onChange={(event) => setPersonalProfile((current) => ({
                  ...current,
                  dominantHand: event.target.value as PersonalAccessProfile["dominantHand"],
                }))}
              >
                <option value="either">Keduanya / tidak dibatasi</option>
                <option value="right">Kanan</option>
                <option value="left">Kiri</option>
              </select>
            </label>

            <label className="ryka-access-field-row">
              <span>LINGKUNGAN UTAMA</span>
              <select
                value={personalProfile.environment}
                onChange={(event) => setPersonalProfile((current) => ({
                  ...current,
                  environment: event.target.value as PersonalAccessProfile["environment"],
                }))}
              >
                <option value="mixed">Beragam</option>
                <option value="home">Rumah</option>
                <option value="school">Sekolah</option>
                <option value="work">Pekerjaan</option>
                <option value="healthcare">Fasilitas kesehatan</option>
              </select>
            </label>
          </div>

          <div className="ryka-access-profile-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                const inputMode = personalProfile.inputMode;
                const needs = personalProfile.needs.length ? personalProfile.needs : ["speech" as AccessNeed];
                setPersonalProfile((current) => ({ ...current, needs, completed: true }));
                setSettings((current) => ({
                  ...current,
                  inputMode,
                  largeText: current.largeText || needs.includes("low-vision"),
                }));
                setSetupOpen(false);
                toast.success("PERSONAL ACCESS PROFILE TERSIMPAN");
              }}
            >
              SIMPAN & MULAI
            </button>
            <button type="button" onClick={() => {
              setPersonalProfile((current) => ({ ...current, completed: true }));
              setSetupOpen(false);
            }}>GUNAKAN DEFAULT</button>
          </div>
        </section>
      </div>
    </>
  );
}
