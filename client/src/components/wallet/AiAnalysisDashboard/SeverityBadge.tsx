import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip } from "./HelpTooltip";
import type { Severity } from "./types";
import { getSeverityClass, getSeverityTooltip } from "./utils";

export function SeverityBadge({
  severity,
  context = "finding",
}: {
  severity?: Severity;
  context?: "finding" | "risk";
}) {
  if (!severity) return null;
  const tone = getSeverityClass(severity);
  return (
    <span className={styles.labelWithTooltip}>
      <span className={`${styles.severityBadge} ${styles[`severity_${tone}`]}`}>
        {String(severity).toUpperCase()}
      </span>
      <HelpTooltip text={getSeverityTooltip(severity, context)} />
    </span>
  );
}
