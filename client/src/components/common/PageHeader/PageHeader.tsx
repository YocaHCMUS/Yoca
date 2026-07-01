import type { ReactNode } from "react";
import styles from "./PageHeader.module.scss";

interface PageHeaderTab {
  label: string;
  value: string;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tabs?: PageHeaderTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.content}>
        <div className={styles.textGroup}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {tabs && tabs.length > 0 && (
        <div className={styles.tabStrip}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`${styles.pillTab} ${tab.value === activeTab ? styles.pillTabActive : ""}`}
              onClick={() => onTabChange?.(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
