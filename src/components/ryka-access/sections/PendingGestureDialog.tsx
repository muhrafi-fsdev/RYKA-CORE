import type { AccessController } from "../useRykaAccess";
import {
  ACCESS_GESTURE_LABELS,
} from "@/lib/accessibility";

export function PendingGestureDialog({ access }: { access: AccessController }) {
  const {
    pendingGesture,
    recordMessage,
    setComposer,
    setPendingGesture,
    setTab,
  } = access;

  if (!pendingGesture) return null;

  return (
    <>
      <div className="ryka-access-confirm-backdrop" role="alertdialog" aria-modal="true" aria-label="Konfirmasi pesan gestur">
        <div className="ryka-access-confirm-card">
          <small>GESTUR TERDETEKSI // {Math.round(pendingGesture.score * 100)}%</small>
          <h2>{ACCESS_GESTURE_LABELS[pendingGesture.gesture]}</h2>
          <p>{pendingGesture.phrase}</p>
          <div>
            <button type="button" className="primary" onClick={() => {
              recordMessage(pendingGesture.phrase, "gesture", true);
              setPendingGesture(null);
            }}>🔊 KONFIRMASI & BICARAKAN</button>
            <button type="button" onClick={() => {
              setComposer(pendingGesture.phrase);
              setPendingGesture(null);
              setTab("communicate");
            }}>EDIT</button>
            <button type="button" onClick={() => setPendingGesture(null)}>BATAL</button>
          </div>
        </div>
      </div>
    </>
  );
}
