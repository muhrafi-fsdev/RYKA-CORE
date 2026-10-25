import type { AccessController } from "../useRykaAccess";

export function CaptionTab({ access }: { access: AccessController }) {
  const {
    captionActive,
    captionInterim,
    captionSupported,
    captions,
    composer,
    exportTranscript,
    setCaptions,
    setComposer,
    setPartnerDisplayOpen,
    setSettings,
    setSpeakerLabel,
    setVisualAlert,
    settings,
    soundLevel,
    soundMonitorActive,
    speakText,
    speakerLabel,
    startCaptions,
    startSoundMonitor,
    stopCaptions,
    stopSoundMonitor,
  } = access;

  return (
    <>
      <div className="ryka-access-caption-layout">
        <section className="ryka-access-card ryka-access-caption-stage">
          <div className="ryka-access-card-heading">
            <div>
              <h2>LIVE CAPTION</h2>
              <p>Suara lawan bicara diubah menjadi teks menggunakan kemampuan browser.</p>
            </div>
            <span className={`ryka-access-caption-chip ${captionActive ? "online" : ""}`}>
              {captionActive ? "MENDENGARKAN" : "BERHENTI"}
            </span>
          </div>
          <div className="ryka-access-caption-toolbar">
            <label>
              <span>LABEL PEMBICARA</span>
              <input
                type="text"
                value={speakerLabel}
                maxLength={40}
                onChange={(event) => setSpeakerLabel(event.target.value)}
              />
            </label>
            <label>
              <span>UKURAN CAPTION</span>
              <input
                type="range"
                min={0.8}
                max={1.8}
                step={0.1}
                value={settings.captionScale}
                onChange={(event) => setSettings((current) => ({ ...current, captionScale: Number(event.target.value) }))}
              />
            </label>
          </div>
          {!captionSupported ? (
            <div className="ryka-access-unavailable">
              <strong>LIVE CAPTION TIDAK TERSEDIA</strong>
              <p>Gunakan Google Chrome atau Microsoft Edge terbaru. Dukungan tetap bergantung pada browser dan sistem operasi.</p>
            </div>
          ) : (
            <div className="ryka-access-caption-controls">
              <button type="button" className="primary" disabled={captionActive} onClick={startCaptions}>🎙 MULAI CAPTION</button>
              <button type="button" disabled={!captionActive} onClick={stopCaptions}>STOP</button>
              <button type="button" onClick={exportTranscript}>EXPORT TXT</button>
              <button type="button" onClick={() => setPartnerDisplayOpen(true)}>PARTNER DISPLAY</button>
              <button type="button" onClick={() => setCaptions([])}>HAPUS TRANSKRIP</button>
            </div>
          )}
          <div className="ryka-access-caption-display" aria-live="polite" style={{ "--caption-scale": settings.captionScale } as React.CSSProperties}>
            {captionInterim && <div className="interim">{captionInterim}</div>}
            {captions.length === 0 && !captionInterim ? (
              <p>Kalimat lawan bicara akan muncul besar di sini.</p>
            ) : (
              captions.map((line) => (
                <div key={line.id}>
                  <small>{line.time} // {line.speaker} {line.confidence > 0 ? `// ${Math.round(line.confidence * 100)}%` : ""}</small>
                  <strong>{line.text}</strong>
                  <button type="button" onClick={() => setComposer(line.text)}>GUNAKAN SEBAGAI PESAN</button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="ryka-access-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>VISUAL SOUND ALERT</h2>
              <p>Mendeteksi tingkat suara keras. Fitur ini belum mengklasifikasikan jenis suara.</p>
            </div>
          </div>
          <div className="ryka-access-sound-meter">
            <div><span style={{ width: `${soundLevel}%` }} /></div>
            <strong>{soundLevel}%</strong>
          </div>
          <div className="ryka-access-caption-controls">
            <button type="button" className="primary" disabled={soundMonitorActive} onClick={() => void startSoundMonitor()}>AKTIFKAN MONITOR</button>
            <button type="button" disabled={!soundMonitorActive} onClick={stopSoundMonitor}>STOP</button>
            <button type="button" onClick={() => {
              setVisualAlert("TES PERINGATAN VISUAL");
              window.setTimeout(() => setVisualAlert(null), 1800);
            }}>TES ALERT</button>
          </div>
          <label className="ryka-access-range-row">
            <span>AMBANG SUARA</span>
            <strong>{settings.soundThreshold}%</strong>
            <input type="range" min={25} max={95} value={settings.soundThreshold} onChange={(event) => setSettings((current) => ({ ...current, soundThreshold: Number(event.target.value) }))} />
          </label>
          <p className="ryka-access-privacy-warning">Mikrofon hanya dipakai saat fitur diaktifkan. Audio tidak disimpan oleh RYKA CORE.</p>
        </section>

        <section className="ryka-access-card ryka-access-conversation-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>CONVERSATION MODE</h2>
              <p>Caption lawan bicara di atas, jawaban pengguna di bawah.</p>
            </div>
          </div>
          <div className="ryka-access-conversation-split">
            <div>
              <small>LAWAN BICARA</small>
              <strong>{captionInterim || captions[0]?.text || "Menunggu suara…"}</strong>
            </div>
            <div>
              <small>PENGGUNA RYKA</small>
              <strong>{composer || "Pilih atau tulis pesan…"}</strong>
              <div className="ryka-access-conversation-actions">
                <button type="button" onClick={() => speakText(composer)}>🔊 BICARAKAN JAWABAN</button>
                <button type="button" onClick={() => setPartnerDisplayOpen(true)}>LAYAR LAWAN BICARA</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
