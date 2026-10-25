import { GESTURE_LABELS } from "../constants";
import type { GestureKey } from "@/lib/gestureEngine";
import type { HandGesture } from "../types";

export function LiveGesturesPanel({ gestures }: { gestures: Array<HandGesture> }) {
  return (
    <section className="ultron-panel-section">
      <div className="ultron-section-heading-row">
        <h2>LIVE GESTURES</h2>
        <span>{gestures.length}</span>
      </div>
      <div className="ultron-live-list">
        {gestures.length === 0 ? (
          <p>NO ACTIVE HAND SIGNATURE</p>
        ) : (
          gestures.map((gesture, index) => (
            <div key={`${gesture.handedness}-${index}`}>
              <span>
                {GESTURE_LABELS[gesture.gesture as GestureKey | "None"] ?? gesture.gesture}
              </span>
              <strong>{Math.round(gesture.score * 100)}%</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
