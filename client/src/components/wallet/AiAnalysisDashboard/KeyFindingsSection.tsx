import styles from "./AiAnalysisDashboard.module.scss";
import { SeverityBadge } from "./SeverityBadge";
import { SignatureChip } from "./SignatureChip";
import type { FindingLike } from "./types";
import { normalizeRiskLanguage, uniqueStrings } from "./utils";

type KeyFindingsSectionProps = {
  suspiciousFindings?: FindingLike[];
  behaviorInsights?: FindingLike[];
};

function evidenceChips(ids: string[] | undefined) {
  const uniqueIds = uniqueStrings(ids ?? []);
  if (uniqueIds.length === 0) return null;
  return (
    <div className={styles.chipRow} aria-label="Evidence IDs">
      {uniqueIds.map((id) => (
        <span key={id} className={styles.chip}>{id}</span>
      ))}
    </div>
  );
}

function signatureChips(signatures: string[] | undefined) {
  const uniqueSignatures = uniqueStrings(signatures ?? []);
  if (uniqueSignatures.length === 0) return null;
  return (
    <div className={styles.chipRow} aria-label="Related signatures">
      {uniqueSignatures.slice(0, 5).map((signature) => (
        <SignatureChip key={signature} signature={signature} />
      ))}
      {uniqueSignatures.length > 5 ? (
        <span className={`${styles.chip} ${styles.moreChip}`}>+{uniqueSignatures.length - 5} more</span>
      ) : null}
    </div>
  );
}

export function KeyFindingsSection({ suspiciousFindings, behaviorInsights }: KeyFindingsSectionProps) {
  const findings: FindingLike[] = [
    ...(suspiciousFindings ?? []),
    ...(behaviorInsights ?? []),
  ];

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Key Findings</h3>
          <p className={styles.sectionDescription}>Evidence-backed observations generated from the wallet profile.</p>
        </div>
      </div>

      {findings.length === 0 ? (
        <p className={styles.bodyText}>No major evidence-backed findings were generated for this wallet.</p>
      ) : (
        <div className={styles.findingList}>
          {findings.map((finding, index) => (
            <article key={`${finding.title ?? "finding"}-${index}`} className={styles.findingCard}>
              <div className={styles.cardTitleRow}>
                <h4 className={styles.cardTitle}>{normalizeRiskLanguage(finding.title) || "Finding"}</h4>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className={styles.findingText}>{normalizeRiskLanguage(finding.explanation) || "No explanation was provided."}</p>
              {evidenceChips(finding.evidenceIds)}
              {signatureChips(finding.relatedSignatures)}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
