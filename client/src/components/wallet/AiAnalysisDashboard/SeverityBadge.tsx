import styles from "./AiAnalysisDashboard.module.scss";
import type { Severity } from "./types";
import { getSeverityClass } from "./utils";

export function SeverityBadge({ severity }: { severity?: Severity }) {
  if (!severity) return null;
  const tone = getSeverityClass(severity);
  return (
    <span className={`${styles.severityBadge} ${styles[`severity_${tone}`]}`}>
      {String(severity).toUpperCase()}
    </span>
  );
}
