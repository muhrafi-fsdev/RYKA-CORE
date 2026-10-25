import { ACTION_LABELS, GESTURES, GESTURE_LABELS } from "../constants";
import type { GestureKey } from "@/lib/gestureEngine";
import type { ActionKey, ActionMap } from "../types";

type ActionMapperPanelProps = {
  actionMap: ActionMap;
  onActionChange: (gesture: GestureKey, action: ActionKey) => void;
};

export function ActionMapperPanel({ actionMap, onActionChange }: ActionMapperPanelProps) {
  return (
    <section className="ultron-panel-section">
      <h2>ACTION MAPPER</h2>
      <div className="ultron-mapper-list">
        {GESTURES.map((gesture) => (
          <label key={gesture}>
            <span>{GESTURE_LABELS[gesture]}</span>
            <select
              value={actionMap[gesture]}
              onChange={(event) =>
                onActionChange(gesture, event.target.value as ActionKey)
              }
            >
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
