import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_INPUT_LABELS,
  CORE_VOCABULARY,
  PHRASE_CATEGORIES,
  appendPhrase,
  removeLastWord,
} from "@/lib/accessibility";

export function CommunicateTab({ access }: { access: AccessController }) {
  const {
    activeCategory,
    addFavorite,
    cameraOn,
    cancelDwell,
    category,
    composer,
    dwellPhrase,
    favorites,
    history,
    onToggleCamera,
    recordMessage,
    scanIndex,
    selectActivePhrase,
    setCategory,
    setComposer,
    setHistory,
    setPartnerDisplayOpen,
    setWaitingMessage,
    settings,
    startDwell,
  } = access;

  return (
    <>
      <div className="ryka-access-communication-layout">
        <section className="ryka-access-card ryka-access-composer-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>PESAN SAYA</h2>
              <p>Ketik, pilih kalimat, atau gunakan gestur yang sudah dipetakan.</p>
            </div>
            <button
              type="button"
              className={`ryka-access-camera-chip ${cameraOn ? "online" : ""}`}
              onClick={onToggleCamera}
            >
              CAMERA {cameraOn ? "ON" : "OFF"}
            </button>
          </div>
          <textarea
            value={composer}
            onChange={(event) => setComposer(event.target.value.slice(0, 500))}
            placeholder="Tulis pesan di sini…"
            aria-label="Pesan komunikasi"
          />

          <div className="ryka-access-composer-tools">
            <div className="ryka-access-card-heading">
              <div>
                <h2>CORE VOCABULARY</h2>
                <p>Posisi kata dibuat tetap untuk membantu pembelajaran motorik dan penyusunan kalimat.</p>
              </div>
              <span className="ryka-access-mode-chip">{ACCESS_INPUT_LABELS[settings.inputMode]}</span>
            </div>
            <div className="ryka-access-core-grid" aria-label="Kosakata inti">
              {CORE_VOCABULARY.map((word) => (
                <button
                  key={word.id}
                  type="button"
                  onClick={() => setComposer((current) => appendPhrase(current, word.label))}
                  title={`Tambahkan ${word.label}`}
                >
                  <span aria-hidden="true">{word.icon}</span>
                  <strong>{word.label}</strong>
                </button>
              ))}
            </div>
            <div className="ryka-access-composer-edit-actions">
              <button type="button" onClick={() => setComposer((current) => removeLastWord(current))}>⌫ HAPUS KATA</button>
              <button type="button" onClick={() => setComposer((current) => appendPhrase(current, "."))}>. TITIK</button>
              <button type="button" onClick={() => setComposer((current) => appendPhrase(current, "?"))}>? TANYA</button>
              <button type="button" onClick={() => setWaitingMessage((current) => !current)}>⏳ MOHON TUNGGU</button>
            </div>
          </div>

          <div className="ryka-access-message-actions">
            <button type="button" className="primary" onClick={() => recordMessage(composer, "typed", true)}>
              🔊 BICARAKAN
            </button>
            <button type="button" onClick={() => recordMessage(composer, "typed", false)}>
              ✓ SIMPAN PESAN
            </button>
            <button type="button" onClick={() => addFavorite(composer)}>
              ★ FAVORIT
            </button>
            <button type="button" onClick={() => setPartnerDisplayOpen(true)}>↔ PARTNER DISPLAY</button>
            <button type="button" onClick={() => setComposer("")}>HAPUS</button>
          </div>
          <div className="ryka-access-local-note">
            <span>🔒</span>
            <div>
              <strong>{settings.privateSession ? "PRIVATE SESSION" : "LOCAL-FIRST"}</strong>
              <p>{settings.privateSession ? "Riwayat tidak disimpan selama sesi privat aktif." : "Pesan, profil gestur, dan riwayat disimpan lokal pada browser ini."}</p>
            </div>
          </div>
          <div className="ryka-access-input-guide" role="status">
            <strong>METODE INPUT: {ACCESS_INPUT_LABELS[settings.inputMode]}</strong>
            <span>
              {settings.inputMode === "keyboard" && "Tekan angka 1–9 untuk memilih kalimat pada kategori aktif."}
              {settings.inputMode === "switch" && "RYKA menyorot pilihan otomatis. Tekan Space atau Enter untuk memilih."}
              {settings.inputMode === "dwell" && `Arahkan pointer selama ${settings.dwellMs} ms untuk memilih.`}
              {settings.inputMode === "gesture" && "Gunakan gestur yang telah dipetakan pada Profil Gestur."}
              {settings.inputMode === "touch" && "Gunakan layar sentuh atau mouse seperti biasa."}
            </span>
          </div>
        </section>

        <section className="ryka-access-card ryka-access-phrases-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>QUICK PHRASE BOARD</h2>
              <p>Tombol besar untuk kebutuhan komunikasi sehari-hari.</p>
            </div>
          </div>
          <div className="ryka-access-category-tabs">
            {PHRASE_CATEGORIES.map((item) => (
              <button key={item.id} type="button" className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>
          <div className="ryka-access-phrase-grid">
            {activeCategory.phrases.map((phrase, index) => {
              const classes = [
                favorites.includes(phrase) ? "favorite" : "",
                settings.inputMode === "switch" && scanIndex === index ? "scan-active" : "",
                dwellPhrase === phrase ? "dwell-active" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={phrase}
                  type="button"
                  className={classes}
                  onClick={() => selectActivePhrase(phrase)}
                  onPointerEnter={() => startDwell(phrase)}
                  onPointerLeave={cancelDwell}
                  onFocus={() => startDwell(phrase)}
                  onBlur={cancelDwell}
                  aria-current={settings.inputMode === "switch" && scanIndex === index ? "true" : undefined}
                >
                  <span>{phrase}</span>
                  <small>
                    {settings.inputMode === "keyboard" && index < 9 ? `${index + 1} // ` : ""}
                    {favorites.includes(phrase) ? "★ Favorit" : "Pilih pesan"}
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="ryka-access-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>FAVORIT</h2>
              <p>Pesan yang paling sering digunakan.</p>
            </div>
          </div>
          <div className="ryka-access-favorite-list">
            {favorites.length === 0 ? (
              <p className="ryka-access-empty">Belum ada pesan favorit.</p>
            ) : (
              favorites.map((phrase) => (
                <div key={phrase}>
                  <button type="button" onClick={() => recordMessage(phrase, "phrase", settings.autoSpeak)}>{phrase}</button>
                  <button type="button" aria-label={`Hapus ${phrase} dari favorit`} onClick={() => addFavorite(phrase)}>×</button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="ryka-access-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>RIWAYAT KOMUNIKASI</h2>
              <p>Maksimum 40 pesan dan dapat dimatikan melalui Privacy Settings.</p>
            </div>
            <button type="button" onClick={() => setHistory([])}>BERSIHKAN</button>
          </div>
          <div className="ryka-access-history-list">
            {history.length === 0 ? (
              <p className="ryka-access-empty">Belum ada pesan yang digunakan.</p>
            ) : (
              history.map((item) => (
                <button key={item.id} type="button" onClick={() => setComposer(item.text)}>
                  <small>{item.timestamp} // {item.source.toUpperCase()}</small>
                  <span>{item.text}</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
