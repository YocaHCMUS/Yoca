import styles from "./PillTabs.module.scss";

interface PillTabOption {
  label: string;
  value: string;
}

interface PillTabsProps {
  options: PillTabOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function PillTabs({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: PillTabsProps) {
  return (
    <div
      className={`${styles.tabs} ${size === "sm" ? styles.sm : ""} ${className}`}
      role="toolbar"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`${styles.pill} ${active ? styles.active : ""}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
