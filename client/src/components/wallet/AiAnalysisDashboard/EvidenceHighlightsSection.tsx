import styles from "./AiAnalysisDashboard.module.scss";
import { EvidenceCard } from "./EvidenceCard";
import { ExplanationDetails } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import type { EvidenceLike } from "./types";

type EvidenceHighlightsSectionProps = {
  evidenceHighlights?: EvidenceLike[];
  profileEvidence?: EvidenceLike[];
};

export function EvidenceHighlightsSection({ evidenceHighlights, profileEvidence }: EvidenceHighlightsSectionProps) {
  const { tr } = useAiAnalysisI18n();
  const evidence = evidenceHighlights && evidenceHighlights.length > 0
    ? evidenceHighlights
    : profileEvidence ?? [];

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr("aiAnalysisDashboard.evidence.sectionTitle")}</h3>
          <p className={styles.sectionDescription}>{tr("aiAnalysisDashboard.evidence.sectionDescription")}</p>
        </div>
      </div>

      <ExplanationDetails summary={tr("aiAnalysisDashboard.evidence.howToRead")}>
        <div className={styles.explanationGrid}>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.evidence.valueAndThreshold")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.evidence.valueAndThresholdDescription")}
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.evidence.traceability")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.evidence.traceabilityDescription")}
            </p>
          </div>
        </div>
      </ExplanationDetails>

      {evidence.length === 0 ? (
        <p className={styles.bodyText}>{tr("aiAnalysisDashboard.evidence.empty")}</p>
      ) : (
        <div className={styles.evidenceList}>
          {evidence.map((item, index) => (
            <EvidenceCard key={`${item.evidenceId ?? item.id ?? "evidence"}-${index}`} evidence={item} />
          ))}
        </div>
      )}
    </section>
  );
}
