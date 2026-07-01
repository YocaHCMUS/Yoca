import type { ReactNode } from "react";
import styles from "./MetricCard.module.scss";

interface MetricCardProps {
  label: string;
  value: string | ReactNode;
  trend?: { value: number; direction: "up" | "down" | "neutral" };
  subtitle?: string;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MetricCard({
  label,
  value,
  trend,
  subtitle,
  icon,
  size = "md",
  className = "",
}: MetricCardProps) {
  return (
    <div className={`${styles.card} ${styles[size]} ${className}`}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>

      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span
            className={`${styles.trend} ${
              trend.direction === "up"
                ? styles.trendUp
                : trend.direction === "down"
                  ? styles.trendDown
                  : styles.trendNeutral
            }`}
          >
            {trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : ""}
            {trend.value}%
          </span>
        )}
      </div>

      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
  );
}
