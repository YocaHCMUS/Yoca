import { Button } from "@carbon/react";
import { useAiAnalysisI18n } from "./i18n";
import styles from "./AiAnalysisDashboard.module.scss";

type AIAnalysisHeaderProps = {
  generatedAt?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
};

function formatGeneratedAt(
  value: string | null | undefined,
  labels: {
    notGenerated: string;
    unavailable: string;
    generated: (value: string) => string;
  },
): string {
  if (!value) return labels.notGenerated;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return labels.unavailable;
  return labels.generated(value);
}

export function AIAnalysisHeader({ generatedAt, onRefresh, refreshing }: AIAnalysisHeaderProps) {
  const { tr, fmt } = useAiAnalysisI18n();
  const generatedText = formatGeneratedAt(generatedAt, {
    notGenerated: String(tr("aiAnalysisDashboard.header.notGenerated")),
    unavailable: String(tr("aiAnalysisDashboard.header.generatedUnavailable")),
    generated: (value) => String(tr("aiAnalysisDashboard.header.generated", { time: fmt.datetime.datetime(value) })),
  });

  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <span className={styles.eyebrow}>{tr("aiAnalysisDashboard.header.eyebrow")}</span>
        <h2 className={styles.title}>{tr("aiAnalysisDashboard.header.title")}</h2>
        <p className={styles.subtitle}>
          {tr("aiAnalysisDashboard.header.subtitle")}
        </p>
      </div>
      <div className={styles.headerActions}>
        {onRefresh ? (
          <Button kind="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>
            {tr("aiAnalysisDashboard.header.refresh")}
          </Button>
        ) : null}
        <span className={styles.generatedAt}>{generatedText}</span>
      </div>
    </header>
  );
}
