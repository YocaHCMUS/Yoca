import type { ReactNode } from "react";
import styles from "./StatusBadge.module.scss";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
  info: styles.info,
  neutral: styles.neutral,
};

export function StatusBadge({
  label,
  variant,
  icon,
  size = "md",
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${VARIANT_CLASS[variant]} ${size === "sm" ? styles.sm : ""} ${className}`}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      {label}
    </span>
  );
}
