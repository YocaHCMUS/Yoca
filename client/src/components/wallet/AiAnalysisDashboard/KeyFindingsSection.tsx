import styles from "./AiAnalysisDashboard.module.scss";
import { LabelWithTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import { SeverityBadge } from "./SeverityBadge";
import { SignatureChip } from "./SignatureChip";
import type { FindingLike } from "./types";
import { uniqueStrings } from "./utils";

type KeyFindingsSectionProps = {
  suspiciousFindings?: FindingLike[];
  behaviorInsights?: FindingLike[];
};

function evidenceChips(ids: string[] | undefined, labels: { label: string; tooltip: string }) {
  const uniqueIds = uniqueStrings(ids ?? []);
  if (uniqueIds.length === 0) return null;
  return (
    <div className={styles.chipRow} aria-label={labels.label}>
      <LabelWithTooltip
        className={styles.chipLabel}
        tooltip={labels.tooltip}
      >
        {labels.label}
      </LabelWithTooltip>
      {uniqueIds.map((id) => (
        <span key={id} className={styles.chip}>{id}</span>
      ))}
    </div>
  );
}

function signatureChips(signatures: string[] | undefined, labels: { label: string; tooltip: string; more: (count: number) => string }) {
  const uniqueSignatures = uniqueStrings(signatures ?? []);
  if (uniqueSignatures.length === 0) return null;
  return (
    <div className={styles.chipRow} aria-label={labels.label}>
      <LabelWithTooltip
        className={styles.chipLabel}
        tooltip={labels.tooltip}
      >
        {labels.label}
      </LabelWithTooltip>
      {uniqueSignatures.slice(0, 5).map((signature) => (
        <SignatureChip key={signature} signature={signature} />
      ))}
      {uniqueSignatures.length > 5 ? (
        <span className={`${styles.chip} ${styles.moreChip}`}>{labels.more(uniqueSignatures.length - 5)}</span>
      ) : null}
    </div>
  );
}

function inferWhyItMatters(
  finding: FindingLike,
  getRiskFactorExplanation: ReturnType<typeof useAiAnalysisI18n>["riskFactorExplanation"],
): string | null {
  const searchable = [
    finding.title,
    finding.explanation,
    ...(finding.evidenceIds ?? []),
  ].join(" ").toLowerCase();

  const matchedCode = [
    "SHORT_HOLDING_PERIOD",
    "HIGH_FREQUENCY_ACTIVITY",
    "LOW_WIN_RATE",
    "HIGH_TOKEN_DIVERSITY",
    "MISSING_DATA",
    "NEGATIVE_PNL",
  ].find((code) => searchable.includes(code.toLowerCase()) || searchable.includes(getRiskFactorExplanation(code).label.toLowerCase()));

  return matchedCode ? getRiskFactorExplanation(matchedCode).whyItMatters : null;
}

export function KeyFindingsSection({ suspiciousFindings, behaviorInsights }: KeyFindingsSectionProps) {
  const { tr, riskFactorExplanation, normalizeUserText } = useAiAnalysisI18n();
  const findings: FindingLike[] = [
    ...(suspiciousFindings ?? []),
    ...(behaviorInsights ?? []),
  ];

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr("aiAnalysisDashboard.findings.title")}</h3>
          <p className={styles.sectionDescription}>{tr("aiAnalysisDashboard.findings.description")}</p>
        </div>
      </div>

      {findings.length === 0 ? (
        <p className={styles.bodyText}>{tr("aiAnalysisDashboard.findings.empty")}</p>
      ) : (
        <div className={styles.findingList}>
          {findings.map((finding, index) => (
            <article key={`${finding.title ?? "finding"}-${index}`} className={styles.findingCard}>
              <div className={styles.cardTitleRow}>
                <h4 className={styles.cardTitle}>
                  {normalizeUserText(finding.title) || tr("aiAnalysisDashboard.findings.fallbackTitle")}
                </h4>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className={styles.findingText}>
                {normalizeUserText(finding.explanation) || tr("aiAnalysisDashboard.findings.fallbackExplanation")}
              </p>
              {inferWhyItMatters(finding, riskFactorExplanation) ? (
                <p className={styles.inlineHelpText}>
                  <strong>{tr("aiAnalysisDashboard.findings.whyItMatters")}</strong>{" "}
                  {inferWhyItMatters(finding, riskFactorExplanation)}
                </p>
              ) : null}
              {evidenceChips(finding.evidenceIds, {
                label: String(tr("aiAnalysisDashboard.findings.evidence")),
                tooltip: String(tr("aiAnalysisDashboard.findings.evidenceTooltip")),
              })}
              {signatureChips(finding.relatedSignatures, {
                label: String(tr("aiAnalysisDashboard.findings.signatures")),
                tooltip: String(tr("aiAnalysisDashboard.findings.signaturesTooltip")),
                more: (count) => String(tr("aiAnalysisDashboard.summary.more", { count })),
              })}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
