import type { AccessController } from "../useRykaAccess";

export function PartnerDisplay({ access }: { access: AccessController }) {
  const {
    captions,
    composer,
    partnerRotated,
    recordMessage,
    setPartnerDisplayOpen,
    setPartnerRotated,
    setTab,
    settings,
    speakText,
    waitingMessage,
  } = access;

  return (
    <>
      <div className={`ryka-access-partner-fullscreen ${partnerRotated ? "rotated" : ""}`} role="dialog" aria-modal="true" aria-label="Partner Display layar penuh">
        <header>
          <div>
            <strong>{waitingMessage ? "MOHON TUNGGU" : "PESAN PENGGUNA RYKA"}</strong>
            <span>{waitingMessage ? "Sedang menyusun jawaban…" : "Tampilan untuk lawan bicara"}</span>
          </div>
          <div>
            <button type="button" onClick={() => setPartnerRotated((current) => !current)}>↻ 180°</button>
            <button type="button" onClick={() => setPartnerDisplayOpen(false)} aria-label="Tutup Partner Display">×</button>
          </div>
        </header>
        <main>
          <strong>{composer || "Mohon beri saya waktu untuk menjawab."}</strong>
          {captions[0]?.text && (
            <div>
              <small>{captions[0].speaker}</small>
              <p>{captions[0].text}</p>
            </div>
          )}
        </main>
        <footer>
          <button type="button" onClick={() => speakText(composer)}>🔊 BICARAKAN</button>
          <button type="button" onClick={() => recordMessage("Ya.", "phrase", settings.autoSpeak)}>✓ YA</button>
          <button type="button" onClick={() => recordMessage("Tidak.", "phrase", settings.autoSpeak)}>✕ TIDAK</button>
          <button type="button" onClick={() => { setPartnerDisplayOpen(false); setTab("communicate"); }}>EDIT PESAN</button>
        </footer>
      </div>
    </>
  );
}
