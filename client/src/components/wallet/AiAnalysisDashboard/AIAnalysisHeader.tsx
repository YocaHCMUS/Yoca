import { Button } from "@carbon/react";
import styles from "./AiAnalysisDashboard.module.scss";

type AIAnalysisHeaderProps = {
  generatedAt?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

function formatGeneratedAt(value?: string | null): string {
  if (!value) return "Not generated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Generated time unavailable";
  return `Generated ${date.toLocaleString()}`;
}

export function AIAnalysisHeader({ generatedAt, onRefresh, refreshing }: AIAnalysisHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <span className={styles.eyebrow}>AI analysis</span>
        <h2 className={styles.title}>AI Wallet Behavior Analysis</h2>
        <p className={styles.subtitle}>
          Evidence-aware wallet analysis with persona, risk, and signature-backed findings.
        </p>
      </div>
      <div className={styles.headerActions}>
        {onRefresh ? (
          <Button kind="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>
            Refresh analysis
          </Button>
        ) : null}
        <span className={styles.generatedAt}>{formatGeneratedAt(generatedAt)}</span>
      </div>
    </header>
  );
}
