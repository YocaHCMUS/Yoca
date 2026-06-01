import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip, LabelWithTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import { SeverityBadge } from "./SeverityBadge";
import { SignatureChip, TokenMintChip } from "./SignatureChip";
import type { EvidenceLike } from "./types";
import { formatMetricValue, getEvidenceId, uniqueStrings } from "./utils";

export function EvidenceCard({ evidence }: { evidence: EvidenceLike }) {
  const { tr, normalizeUserText } = useAiAnalysisI18n();
  const evidenceId = getEvidenceId(evidence);
  const signatures = uniqueStrings(evidence.relatedSignatures ?? []);
  const tokenMints = uniqueStrings(evidence.relatedTokenMints ?? []);
  const visibleSignatures = signatures.slice(0, 5);
  const hiddenSignatureCount = signatures.length - visibleSignatures.length;

  return (
    <article className={styles.evidenceCard}>
      <div className={styles.evidenceTitleRow}>
        <div>
          <h4 className={styles.evidenceTitle}>
            {normalizeUserText(evidence.title) || tr("aiAnalysisDashboard.evidence.fallbackTitle")}
          </h4>
          <div className={styles.evidenceId}>
            {tr("aiAnalysisDashboard.evidence.evidenceId")}: {evidenceId}{" "}
            <HelpTooltip text={String(tr("aiAnalysisDashboard.evidence.evidenceIdTooltip"))} />
          </div>
        </div>
        <SeverityBadge severity={evidence.severity} />
      </div>

      <p className={styles.evidenceDescription}>
        {normalizeUserText(evidence.description) || tr("aiAnalysisDashboard.evidence.fallbackDescription")}
      </p>

      {(evidence.value != null || evidence.threshold != null) ? (
        <div className={styles.metricRow}>
          {evidence.value != null ? (
            <span className={styles.metricPill}>
              <LabelWithTooltip tooltip={String(tr("aiAnalysisDashboard.evidence.valueTooltip"))}>
                {tr("aiAnalysisDashboard.evidence.value")}
              </LabelWithTooltip>
              <strong>{formatMetricValue(evidence.value)}</strong>
            </span>
          ) : null}
          {evidence.threshold != null ? (
            <span className={styles.metricPill}>
              <LabelWithTooltip tooltip={String(tr("aiAnalysisDashboard.evidence.thresholdTooltip"))}>
                {tr("aiAnalysisDashboard.evidence.threshold")}
              </LabelWithTooltip>
              <strong>{formatMetricValue(evidence.threshold)}</strong>
            </span>
          ) : null}
        </div>
      ) : null}

      {visibleSignatures.length > 0 ? (
        <div>
          <LabelWithTooltip
            className={styles.chipLabel}
            tooltip={String(tr("aiAnalysisDashboard.evidence.relatedSignaturesTooltip"))}
          >
            {tr("aiAnalysisDashboard.evidence.relatedSignatures")}
          </LabelWithTooltip>
          <div className={styles.chipRow}>
            {visibleSignatures.map((signature) => (
              <SignatureChip key={signature} signature={signature} />
            ))}
            {hiddenSignatureCount > 0 ? (
              <span className={`${styles.chip} ${styles.moreChip}`}>
                {tr("aiAnalysisDashboard.summary.more", { count: hiddenSignatureCount })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {tokenMints.length > 0 ? (
        <div>
          <LabelWithTooltip
            className={styles.chipLabel}
            tooltip={String(tr("aiAnalysisDashboard.evidence.relatedTokenMintsTooltip"))}
          >
            {tr("aiAnalysisDashboard.evidence.relatedTokenMints")}
          </LabelWithTooltip>
          <div className={styles.chipRow}>
            {tokenMints.slice(0, 5).map((mint) => (
              <TokenMintChip key={mint} mint={mint} />
            ))}
            {tokenMints.length > 5 ? (
              <span className={`${styles.chip} ${styles.moreChip}`}>
                {tr("aiAnalysisDashboard.summary.more", { count: tokenMints.length - 5 })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
