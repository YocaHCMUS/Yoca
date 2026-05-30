import styles from "./AiAnalysisDashboard.module.scss";
import { EvidenceCard } from "./EvidenceCard";
import { ExplanationDetails } from "./HelpTooltip";
import type { EvidenceLike } from "./types";

type EvidenceHighlightsSectionProps = {
  evidenceHighlights?: EvidenceLike[];
  profileEvidence?: EvidenceLike[];
};

export function EvidenceHighlightsSection({ evidenceHighlights, profileEvidence }: EvidenceHighlightsSectionProps) {
  const evidence = evidenceHighlights && evidenceHighlights.length > 0
    ? evidenceHighlights
    : profileEvidence ?? [];

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Evidence Highlights</h3>
          <p className={styles.sectionDescription}>Signals and representative signatures used to support the analysis.</p>
        </div>
      </div>

      <ExplanationDetails summary="How to read evidence cards">
        <div className={styles.explanationGrid}>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Value and Threshold</div>
            <p className={styles.inlineHelpText}>
              Value is the measured result for this wallet. Threshold is the rule level that triggered the signal.
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Traceability</div>
            <p className={styles.inlineHelpText}>
              Evidence IDs connect findings, risk factors, and evidence. Signatures are representative transactions users can verify on Solscan.
            </p>
          </div>
        </div>
      </ExplanationDetails>

      {evidence.length === 0 ? (
        <p className={styles.bodyText}>No evidence highlights are available for this wallet.</p>
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
