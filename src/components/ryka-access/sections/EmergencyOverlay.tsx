import type { AccessController } from "../useRykaAccess";
import {
  BODY_REGIONS,
  PHRASE_CATEGORIES,
  buildPainPhrase,
} from "@/lib/accessibility";

export function EmergencyOverlay({ access }: { access: AccessController }) {
  const {
    recordMessage,
    setEmergencyOpen,
    setTab,
  } = access;

  return (
    <>
      <div className="ryka-access-emergency-screen" role="alertdialog" aria-modal="true" aria-label="Komunikasi darurat">
        <header>
          <div>
            <strong>🆘 KOMUNIKASI DARURAT</strong>
            <span>Pilih pesan. RYKA akan menampilkan dan membacakannya.</span>
          </div>
          <button type="button" onClick={() => setEmergencyOpen(false)}>×</button>
        </header>
        <div className="ryka-access-emergency-grid">
          {PHRASE_CATEGORIES.find((item) => item.id === "emergency")?.phrases.map((phrase) => (
            <button key={phrase} type="button" onClick={() => {
              recordMessage(phrase, "emergency", true);
              setEmergencyOpen(false);
              setTab("communicate");
            }}>{phrase}</button>
          ))}
        </div>
        <section className="ryka-access-body-map">
          <strong>TUNJUKKAN BAGIAN YANG SAKIT</strong>
          <div>
            {BODY_REGIONS.map((region) => (
              <button key={region} type="button" onClick={() => {
                const phrase = buildPainPhrase(region);
                recordMessage(phrase, "emergency", true);
                setEmergencyOpen(false);
                setTab("communicate");
              }}>{region.toUpperCase()}</button>
            ))}
          </div>
        </section>
        <p>RYKA CORE adalah alat bantu komunikasi. Aplikasi tidak melakukan panggilan, diagnosis, atau mengirim lokasi secara otomatis.</p>
      </div>
    </>
  );
}
