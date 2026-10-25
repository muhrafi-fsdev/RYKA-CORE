type OptionGridSectionProps<T extends string> = {
  title: string;
  options: ReadonlyArray<T>;
  value: T;
  onSelect: (option: T) => void;
};

export function OptionGridSection<T extends string>({
  title,
  options,
  value,
  onSelect,
}: OptionGridSectionProps<T>) {
  return (
    <section className="ultron-panel-section">
      <h2>{title}</h2>
      <div className="ultron-profile-grid">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            className={value === item ? "active" : ""}
            onClick={() => onSelect(item)}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>
    </section>
  );
}
