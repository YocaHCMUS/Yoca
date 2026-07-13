import type { CSSProperties, ReactNode } from "react";
import styles from "./Card.module.scss";

interface CardProps {
  title?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  hoverable?: boolean;
  padding?: string;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}

export function Card({
  title,
  subtitle,
  actions,
  hoverable,
  padding,
  style,
  className = "",
  children,
}: CardProps) {
  return (
    <div
      className={`${styles.card} ${hoverable ? styles.hoverable : ""} ${className}`}
      style={{ ...(padding ? { padding } : {}), ...style }}
    >
      {(title || actions) && (
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {title && <span className={styles.title}>{title}</span>}
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
