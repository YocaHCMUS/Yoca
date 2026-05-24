import styles from "./AiAnalysisDashboard.module.scss";
import { EvidenceCard } from "./EvidenceCard";
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
