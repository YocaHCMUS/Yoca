import styles from "./AiAnalysisDashboard.module.scss";
import { SeverityBadge } from "./SeverityBadge";
import { SignatureChip, TokenMintChip } from "./SignatureChip";
import type { EvidenceLike } from "./types";
import { formatMetricValue, getEvidenceId, normalizeRiskLanguage, uniqueStrings } from "./utils";

export function EvidenceCard({ evidence }: { evidence: EvidenceLike }) {
  const evidenceId = getEvidenceId(evidence);
  const signatures = uniqueStrings(evidence.relatedSignatures ?? []);
  const tokenMints = uniqueStrings(evidence.relatedTokenMints ?? []);
  const visibleSignatures = signatures.slice(0, 5);
  const hiddenSignatureCount = signatures.length - visibleSignatures.length;

  return (
    <article className={styles.evidenceCard}>
      <div className={styles.evidenceTitleRow}>
        <div>
          <h4 className={styles.evidenceTitle}>{normalizeRiskLanguage(evidence.title) || "Evidence"}</h4>
          <div className={styles.evidenceId}>ID: {evidenceId}</div>
        </div>
        <SeverityBadge severity={evidence.severity} />
      </div>

      <p className={styles.evidenceDescription}>
        {normalizeRiskLanguage(evidence.description) || "No evidence description was provided."}
      </p>

      {(evidence.value != null || evidence.threshold != null) ? (
        <div className={styles.metricRow}>
          {evidence.value != null ? (
            <span className={styles.metricPill}>Value: <strong>{formatMetricValue(evidence.value)}</strong></span>
          ) : null}
          {evidence.threshold != null ? (
            <span className={styles.metricPill}>Threshold: <strong>{formatMetricValue(evidence.threshold)}</strong></span>
          ) : null}
        </div>
      ) : null}

      {visibleSignatures.length > 0 ? (
        <div>
          <div className={styles.chipLabel}>Related Signatures</div>
          <div className={styles.chipRow}>
            {visibleSignatures.map((signature) => (
              <SignatureChip key={signature} signature={signature} />
            ))}
            {hiddenSignatureCount > 0 ? (
              <span className={`${styles.chip} ${styles.moreChip}`}>+{hiddenSignatureCount} more</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {tokenMints.length > 0 ? (
        <div>
          <div className={styles.chipLabel}>Related Token Mints</div>
          <div className={styles.chipRow}>
            {tokenMints.slice(0, 5).map((mint) => (
              <TokenMintChip key={mint} mint={mint} />
            ))}
            {tokenMints.length > 5 ? (
              <span className={`${styles.chip} ${styles.moreChip}`}>+{tokenMints.length - 5} more</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
