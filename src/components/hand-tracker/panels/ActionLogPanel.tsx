import type { ActionLog } from "../types";

type ActionLogPanelProps = {
  logs: Array<ActionLog>;
  onExport: (format: "json" | "csv") => void;
  onClear: () => void;
};

export function ActionLogPanel({ logs, onExport, onClear }: ActionLogPanelProps) {
  return (
    <section className="ultron-panel-section">
      <div className="ultron-section-heading-row">
        <h2>ACTION LOG</h2>
        <div className="ultron-log-actions">
          <button type="button" onClick={() => onExport("json")}>JSON</button>
          <button type="button" onClick={() => onExport("csv")}>CSV</button>
          <button type="button" onClick={onClear}>CLEAR</button>
        </div>
      </div>
      <div className="ultron-log-list">
        {logs.length === 0 ? (
          <p>NO COMMANDS TRIGGERED</p>
        ) : (
          logs.map((item) => (
            <div key={item.id}>
              <small>{item.time}</small>
              <span>{item.action}</span>
              <em>{item.gesture}</em>
              <strong>{Math.round(item.score * 100)}%</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
