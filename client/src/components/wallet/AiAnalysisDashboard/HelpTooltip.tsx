import type { ReactNode } from "react";
import styles from "./AiAnalysisDashboard.module.scss";

export function HelpTooltip({ text }: { text: string }) {
  return (
    <span className={styles.tooltipWrap}>
      <button
        type="button"
        className={styles.infoButton}
        aria-label={text}
      >
        i
      </button>
      <span className={styles.tooltipBubble} role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function LabelWithTooltip({
  children,
  tooltip,
  className,
}: {
  children: ReactNode;
  tooltip?: string;
  className?: string;
}) {
  return (
    <span className={`${styles.labelWithTooltip} ${className ?? ""}`}>
      {children}
      {tooltip ? <HelpTooltip text={tooltip} /> : null}
    </span>
  );
}

export function ExplanationDetails({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className={styles.explanationDetails}>
      <summary>{summary}</summary>
      <div className={styles.explanationContent}>{children}</div>
    </details>
  );
}
