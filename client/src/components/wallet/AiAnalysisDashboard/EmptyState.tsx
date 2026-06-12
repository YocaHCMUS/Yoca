import { Button } from "@carbon/react";
import styles from "./AiAnalysisDashboard.module.scss";
import { useAiAnalysisI18n } from "./i18n";

export function EmptyAnalysisState() {
  const { tr } = useAiAnalysisI18n();
  return (
    <div className={styles.emptyState}>
      <h3 className={styles.emptyTitle}>{tr("aiAnalysisDashboard.empty.title")}</h3>
      <p className={styles.emptyText}>
        {tr("aiAnalysisDashboard.empty.description")}
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
  const { tr, normalizeUserText } = useAiAnalysisI18n();
  return (
    <div className={styles.errorCard}>
      <h3 className={styles.errorTitle}>{tr("aiAnalysisDashboard.error.title")}</h3>
      <p className={styles.errorText}>{normalizeUserText(message) || tr("aiAnalysisDashboard.error.fallback")}</p>
      {onRetry ? (
        <Button kind="primary" size="sm" onClick={onRetry}>
          {tr("aiAnalysisDashboard.error.retry")}
        </Button>
      ) : null}
    </div>
  );
}
