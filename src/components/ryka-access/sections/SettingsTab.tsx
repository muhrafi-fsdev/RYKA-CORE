import type { AccessInputMode } from "@/lib/accessibility";
import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_INPUT_LABELS,
} from "@/lib/accessibility";

export function SettingsTab({ access }: { access: AccessController }) {
  const {
    resetAccessData,
    setCaptions,
    setHistory,
    setPersonalProfile,
    setSettings,
    settings,
    speakText,
    voices,
  } = access;

  return (
    <>
      <div className="ryka-access-settings-layout">
        <section className="ryka-access-card">
          <h2>TAMPILAN AKSESIBEL</h2>
          <label className="ryka-access-toggle-row">
            <span><strong>TEKS BESAR</strong><small>Memperbesar teks dan kontrol utama.</small></span>
            <input type="checkbox" checked={settings.largeText} onChange={(event) => setSettings((current) => ({ ...current, largeText: event.target.checked }))} />
          </label>
          <label className="ryka-access-toggle-row">
            <span><strong>KONTRAS TINGGI</strong><small>Menguatkan batas, teks, dan tombol.</small></span>
            <input type="checkbox" checked={settings.highContrast} onChange={(event) => setSettings((current) => ({ ...current, highContrast: event.target.checked }))} />
          </label>
          <label className="ryka-access-toggle-row">
            <span><strong>KURANGI ANIMASI</strong><small>Menonaktifkan transisi dan efek yang tidak perlu.</small></span>
            <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings((current) => ({ ...current, reducedMotion: event.target.checked }))} />
          </label>
        </section>

        <section className="ryka-access-card">
          <h2>KONTROL KOMUNIKASI</h2>
          <label className="ryka-access-toggle-row">
            <span><strong>KONFIRMASI GESTUR</strong><small>Tampilkan preview sebelum gestur dibacakan.</small></span>
            <input type="checkbox" checked={settings.confirmGesture} onChange={(event) => setSettings((current) => ({ ...current, confirmGesture: event.target.checked }))} />
          </label>
          <label className="ryka-access-toggle-row">
            <span><strong>AUTO SPEAK</strong><small>Kalimat pilihan langsung dibacakan.</small></span>
            <input type="checkbox" checked={settings.autoSpeak} onChange={(event) => setSettings((current) => ({ ...current, autoSpeak: event.target.checked }))} />
          </label>
          <label className="ryka-access-toggle-row">
            <span><strong>SIMPAN RIWAYAT LOKAL</strong><small>Matikan untuk mode tanpa riwayat.</small></span>
            <input type="checkbox" checked={settings.saveHistory} onChange={(event) => {
              const enabled = event.target.checked;
              setSettings((current) => ({ ...current, saveHistory: enabled }));
              if (!enabled) setHistory([]);
            }} />
          </label>
        </section>

        <section className="ryka-access-card">
          <h2>ALTERNATIVE INPUT SETTINGS</h2>
          <label className="ryka-access-field-row">
            <span>METODE INPUT</span>
            <select
              value={settings.inputMode}
              onChange={(event) => {
                const inputMode = event.target.value as AccessInputMode;
                setSettings((current) => ({ ...current, inputMode }));
                setPersonalProfile((current) => ({ ...current, inputMode }));
              }}
            >
              {(Object.entries(ACCESS_INPUT_LABELS) as Array<[AccessInputMode, string]>).map(([mode, label]) => (
                <option key={mode} value={mode}>{label}</option>
              ))}
            </select>
          </label>
          <label className="ryka-access-range-row">
            <span>SCAN INTERVAL</span>
            <strong>{settings.scanningIntervalMs} ms</strong>
            <input type="range" min={700} max={3000} step={100} value={settings.scanningIntervalMs} onChange={(event) => setSettings((current) => ({ ...current, scanningIntervalMs: Number(event.target.value) }))} />
          </label>
          <label className="ryka-access-range-row">
            <span>DWELL TIME</span>
            <strong>{settings.dwellMs} ms</strong>
            <input type="range" min={500} max={3000} step={100} value={settings.dwellMs} onChange={(event) => setSettings((current) => ({ ...current, dwellMs: Number(event.target.value) }))} />
          </label>
          <p>Shortcut: Alt+S untuk membacakan pesan, Alt+P membuka Partner Display, Escape menutup layar penuh.</p>
        </section>

        <section className="ryka-access-card">
          <h2>TEXT-TO-SPEECH</h2>
          <label className="ryka-access-field-row">
            <span>BAHASA</span>
            <select value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value }))}>
              <option value="id-ID">Bahasa Indonesia</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
            </select>
          </label>
          <label className="ryka-access-field-row">
            <span>SUARA</span>
            <select value={settings.voiceUri} onChange={(event) => setSettings((current) => ({ ...current, voiceUri: event.target.value }))}>
              <option value="">Default sistem</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} — {voice.lang}</option>
              ))}
            </select>
          </label>
          <label className="ryka-access-range-row">
            <span>KECEPATAN</span>
            <strong>{settings.speechRate.toFixed(1)}×</strong>
            <input type="range" min={0.5} max={1.8} step={0.1} value={settings.speechRate} onChange={(event) => setSettings((current) => ({ ...current, speechRate: Number(event.target.value) }))} />
          </label>
          <label className="ryka-access-range-row">
            <span>VOLUME</span>
            <strong>{Math.round(settings.speechVolume * 100)}%</strong>
            <input type="range" min={0} max={1} step={0.05} value={settings.speechVolume} onChange={(event) => setSettings((current) => ({ ...current, speechVolume: Number(event.target.value) }))} />
          </label>
          <button type="button" onClick={() => speakText("Ini adalah suara RYKA Access.")}>TES SUARA</button>
        </section>

        <section className="ryka-access-card ryka-access-danger-zone">
          <h2>PRIVACY CENTER</h2>
          <p>Kamera dan mikrofon selalu memiliki indikator. RYKA CORE tidak menyimpan rekaman video atau audio secara default.</p>
          <label className="ryka-access-toggle-row">
            <span><strong>PRIVATE SESSION</strong><small>Tidak menyimpan pesan baru dan langsung menghapus riwayat aktif.</small></span>
            <input type="checkbox" checked={settings.privateSession} onChange={(event) => setSettings((current) => ({ ...current, privateSession: event.target.checked }))} />
          </label>
          <label className="ryka-access-field-row">
            <span>AUTO-DELETE RIWAYAT</span>
            <select value={settings.autoDeleteMinutes} onChange={(event) => setSettings((current) => ({ ...current, autoDeleteMinutes: Number(event.target.value) }))}>
              <option value={0}>Tidak otomatis</option>
              <option value={5}>5 menit</option>
              <option value={15}>15 menit</option>
              <option value={60}>1 jam</option>
              <option value={1440}>24 jam</option>
            </select>
          </label>
          <div className="ryka-access-profile-actions">
            <button type="button" onClick={() => setHistory([])}>HAPUS RIWAYAT</button>
            <button type="button" onClick={() => setCaptions([])}>HAPUS CAPTION</button>
            <button type="button" onClick={resetAccessData}>HAPUS & RESET SEMUA DATA ACCESS</button>
          </div>
        </section>
      </div>
    </>
  );
}
