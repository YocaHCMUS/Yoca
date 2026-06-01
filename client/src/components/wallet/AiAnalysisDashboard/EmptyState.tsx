import { Button } from "@carbon/react";
import styles from "./AiAnalysisDashboard.module.scss";
import { normalizeRiskLanguage } from "./utils";

export function EmptyAnalysisState() {
  return (
    <div className={styles.emptyState}>
      <h3 className={styles.emptyTitle}>No analyzable activity found for this wallet.</h3>
      <p className={styles.emptyText}>
        Transaction data loaded successfully, but there were no wallet events available for evidence-backed analysis.
      </p>
    </div>
  );
}

export function AnalysisErrorState({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.errorCard}>
      <h3 className={styles.errorTitle}>AI analysis could not be loaded</h3>
      <p className={styles.errorText}>{normalizeRiskLanguage(message) || "Please retry the analysis."}</p>
      {onRetry ? (
        <Button kind="primary" size="sm" onClick={onRetry}>
          Retry AI analysis
        </Button>
      ) : null}
    </div>
  );
}
