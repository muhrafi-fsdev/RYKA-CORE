import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_GESTURES,
  ACCESS_GESTURE_LABELS,
  DEFAULT_GESTURE_PHRASES,
} from "@/lib/accessibility";

export function GesturesTab({ access }: { access: AccessController }) {
  const {
    cameraOn,
    exportProfile,
    fileInputRef,
    gesturePhrases,
    handleGesturePhrase,
    onToggleCamera,
    profileImportError,
    setGesturePhrases,
  } = access;

  return (
    <>
      <div className="ryka-access-gesture-layout">
        <section className="ryka-access-card">
          <div className="ryka-access-card-heading">
            <div>
              <h2>GESTURE-TO-TEXT PROFILE</h2>
              <p>Setiap gestur dapat dipetakan ke kalimat pribadi. Gunakan kamera dan tunggu stabilisasi sebelum pesan muncul.</p>
            </div>
            <button type="button" className={cameraOn ? "online" : ""} onClick={onToggleCamera}>
              CAMERA {cameraOn ? "ON" : "OFF"}
            </button>
          </div>
          <div className="ryka-access-gesture-map">
            {ACCESS_GESTURES.map((gesture) => (
              <label key={gesture}>
                <span>
                  <strong>{ACCESS_GESTURE_LABELS[gesture]}</strong>
                  <small>{gesture.replaceAll("_", " ")}</small>
                </span>
                <input
                  value={gesturePhrases[gesture]}
                  maxLength={300}
                  onChange={(event) => setGesturePhrases((current) => ({ ...current, [gesture]: event.target.value }))}
                />
                <button type="button" onClick={() => handleGesturePhrase(gesture, 1)}>TES</button>
              </label>
            ))}
          </div>
          <div className="ryka-access-profile-actions">
            <button type="button" onClick={exportProfile}>EXPORT PROFIL</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>IMPORT PROFIL</button>
            <button type="button" onClick={() => setGesturePhrases(DEFAULT_GESTURE_PHRASES)}>RESET GESTUR</button>
          </div>
          {profileImportError && <p className="ryka-access-error">{profileImportError}</p>}
        </section>

        <section className="ryka-access-card ryka-access-safety-card">
          <h2>ANTI-SALAH DETEKSI</h2>
          <ul>
            <li>Weighted multi-frame stabilization tetap aktif.</li>
            <li>Confidence, hold duration, cooldown, dan release-required tetap digunakan.</li>
            <li>Konfirmasi pesan gestur dapat diwajibkan sebelum dibacakan.</li>
            <li>Semua gestur personal disimpan lokal.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
