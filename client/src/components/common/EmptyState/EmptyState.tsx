import type { ReactNode } from "react";
import styles from "./EmptyState.module.scss";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  compact,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ""} ${className}`}
    >
      {icon && <div className={styles.iconWrap}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {action && (
        <button className={styles.actionBtn} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
