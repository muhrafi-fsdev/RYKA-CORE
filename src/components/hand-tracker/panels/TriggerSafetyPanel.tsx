type TriggerSafetyPanelProps = {
  threshold: number;
  holdMs: number;
  cooldownMs: number;
  onThresholdChange: (value: number) => void;
  onHoldMsChange: (value: number) => void;
  onCooldownMsChange: (value: number) => void;
};

export function TriggerSafetyPanel({
  threshold,
  holdMs,
  cooldownMs,
  onThresholdChange,
  onHoldMsChange,
  onCooldownMsChange,
}: TriggerSafetyPanelProps) {
  return (
    <section className="ultron-panel-section">
      <h2>TRIGGER SAFETY</h2>
      <p className="ultron-safety-note">
        4-frame weighted voting, 260 ms release gate, confidence filtering,
        hold validation, and cooldown are active.
      </p>
      <label>
        <span>CONFIDENCE</span>
        <strong>{threshold}%</strong>
        <input
          type="range"
          min={50}
          max={99}
          value={threshold}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
        />
      </label>
      <label>
        <span>HOLD DURATION</span>
        <strong>{holdMs} MS</strong>
        <input
          type="range"
          min={300}
          max={2000}
          step={100}
          value={holdMs}
          onChange={(event) => onHoldMsChange(Number(event.target.value))}
        />
      </label>
      <label>
        <span>COOLDOWN</span>
        <strong>{cooldownMs} MS</strong>
        <input
          type="range"
          min={500}
          max={3000}
          step={100}
          value={cooldownMs}
          onChange={(event) => onCooldownMsChange(Number(event.target.value))}
        />
      </label>
    </section>
  );
}
