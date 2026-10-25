import type { ReactNode } from "react";

type SystemPanelProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function SystemPanel({ open, onClose, children }: SystemPanelProps) {
  return (
    <aside className={`ultron-panel ${open ? "open" : ""}`}>
      <div className="ultron-panel-header">
        <div>
          <p>RYKA CORE SYSTEM</p>
          <small>ACCESSIBILITY + LEGACY VISUALS + HMAC SECURITY + WINDOWS BRIDGE</small>
        </div>
        <button type="button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="ultron-panel-scroll">{children}</div>
    </aside>
  );
}
