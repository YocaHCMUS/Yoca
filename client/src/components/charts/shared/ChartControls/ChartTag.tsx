import { X } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./ChartControls.module.scss";

interface ChartTagProps {
  label: ReactNode;
  value?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

export function ChartTag({
  label,
  value,
  onDismiss,
  dismissLabel = "Remove",
  className = "",
}: ChartTagProps) {
  return (
    <span className={`${styles.tag} ${className}`}>
      <span className={styles.tagLabel}>{label}</span>
      {value ? <span className={styles.tagValue}>{value}</span> : null}
      {onDismiss ? (
        <button
          type="button"
          className={styles.tagDismiss}
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          <X size={13} />
        </button>
      ) : null}
    </span>
  );
}
