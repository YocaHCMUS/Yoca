import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import type { Severity } from "./types";
import { getSeverityClass } from "./utils";

export function SeverityBadge({
  severity,
  context = "finding",
}: {
  severity?: Severity;
  context?: "finding" | "risk";
}) {
  const { severityLabel, severityTooltip } = useAiAnalysisI18n();
  if (!severity) return null;
  const tone = getSeverityClass(severity);
  return (
    <span className={styles.labelWithTooltip}>
      <span className={`${styles.severityBadge} ${styles[`severity_${tone}`]}`}>
        {severityLabel(severity)}
      </span>
      <HelpTooltip text={severityTooltip(severity, context)} />
    </span>
  );
}
