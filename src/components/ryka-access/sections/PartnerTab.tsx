import type { AccessController } from "../useRykaAccess";
import {
  PARTNER_GUIDE,
} from "@/lib/accessibility";

export function PartnerTab({ access }: { access: AccessController }) {
  const {
    captions,
    composer,
    partnerRotated,
    recordMessage,
    setComposer,
    setPartnerDisplayOpen,
    setPartnerRotated,
    setTab,
    setWaitingMessage,
    settings,
    speakText,
    waitingMessage,
  } = access;

  return (
    <>
      <div className="ryka-access-partner-layout">
        <section className="ryka-access-card ryka-access-partner-preview-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>PARTNER DISPLAY</h2>
              <p>Tampilan besar untuk lawan bicara. Pesan dapat diputar 180° saat perangkat diletakkan di meja.</p>
            </div>
            <button type="button" className="primary" onClick={() => setPartnerDisplayOpen(true)}>BUKA LAYAR PENUH</button>
          </div>
          <div className={`ryka-access-partner-stage ${partnerRotated ? "rotated" : ""}`}>
            <small>{waitingMessage ? "MOHON TUNGGU — SEDANG MENYUSUN JAWABAN" : "PESAN DARI PENGGUNA RYKA"}</small>
            <strong>{composer || "Pilih atau tulis pesan pada tab Komunikasi."}</strong>
            {captions[0]?.text && <p><b>{captions[0].speaker}:</b> {captions[0].text}</p>}
          </div>
          <div className="ryka-access-message-actions">
            <button type="button" onClick={() => setPartnerRotated((current) => !current)}>↻ PUTAR 180°</button>
            <button type="button" onClick={() => speakText(composer)}>🔊 BICARAKAN</button>
            <button type="button" onClick={() => setWaitingMessage((current) => !current)}>⏳ STATUS MENUNGGU</button>
            <button type="button" onClick={() => setTab("communicate")}>EDIT PESAN</button>
          </div>
        </section>

        <section className="ryka-access-card">
          <h2>PANDUAN MITRA KOMUNIKASI</h2>
          <ul className="ryka-access-partner-guide">
            {PARTNER_GUIDE.map((item) => <li key={item}>✓ {item}</li>)}
          </ul>
          <button type="button" onClick={() => setComposer("Mohon beri saya waktu untuk menjawab.")}>GUNAKAN PESAN “MOHON TUNGGU”</button>
        </section>

        <section className="ryka-access-card">
          <h2>PERTANYAAN CEPAT</h2>
          <p>Lawan bicara dapat memakai pertanyaan sederhana yang dapat dijawab cepat.</p>
          <div className="ryka-access-yes-no-grid">
            <button type="button" className="yes" onClick={() => recordMessage("Ya.", "phrase", settings.autoSpeak)}>✓ YA</button>
            <button type="button" className="no" onClick={() => recordMessage("Tidak.", "phrase", settings.autoSpeak)}>✕ TIDAK</button>
            <button type="button" onClick={() => recordMessage("Tolong ulangi.", "phrase", settings.autoSpeak)}>ULANGI</button>
            <button type="button" onClick={() => recordMessage("Saya belum mengerti.", "phrase", settings.autoSpeak)}>BELUM MENGERTI</button>
          </div>
        </section>
      </div>
    </>
  );
}
