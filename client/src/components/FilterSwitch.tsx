import styles from "./FilterSwitch.module.scss";

type FilterOption<V extends string> = {
  value: V;
  label: string;
};

interface FilterSwitchProps<V extends string> {
  options: readonly FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  tooltipLabel: string;
}

export function FilterSwitch<V extends string>({
  value,
  options,
  onChange,
  tooltipLabel,
}: FilterSwitchProps<V>) {
  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-label={tooltipLabel}
      title={tooltipLabel}
    >
      {options.map((opt, idx) => {
        const selected = opt.value == value;

        return (
          <button
            key={idx}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.button} ${selected ? styles.selected : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
