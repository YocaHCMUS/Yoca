import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip, LabelWithTooltip } from "./HelpTooltip";
import { SeverityBadge } from "./SeverityBadge";
import type { RiskFactorLike } from "./types";
import { getRiskFactorExplanation, normalizeRiskLanguage, uniqueStrings } from "./utils";

function formatScoreImpact(value: RiskFactorLike["scoreImpact"]): string | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `${numeric > 0 ? "+" : ""}${numeric} pts`;
  }
  return String(value);
}

function riskPointText(value: RiskFactorLike["scoreImpact"]): string | null {
  const formatted = formatScoreImpact(value);
  return formatted ? `${formatted} added to Risk Score` : null;
}

export function RiskBreakdownSection({
  riskFactors,
  profile,
}: {
  riskFactors?: RiskFactorLike[];
  profile?: any;
}) {
  const factors = riskFactors ?? [];
  const unsupported = Number(profile?.dataQuality?.unsupportedTransactionCount ?? 0);
  const totalTx = Number(profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit ?? 0);

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Risk Breakdown</h3>
          <p className={styles.sectionDescription}>Computed risk factors contributing to the wallet score.</p>
        </div>
      </div>

      {factors.length === 0 ? (
        <p className={styles.bodyText}>No risk factors were generated for this wallet.</p>
      ) : (
        <div className={styles.riskList}>
          {factors.map((factor, index) => {
            const evidenceIds = uniqueStrings(factor.evidenceIds ?? []);
            const explanation = getRiskFactorExplanation(factor.code);
            const isMissingData = String(factor.code ?? "").toUpperCase() === "MISSING_DATA";
            return (
              <article key={`${factor.code ?? "risk"}-${index}`} className={styles.riskFactorCard}>
                <div className={styles.riskTitleRow}>
                  <div>
                    <h4 className={styles.riskTitle}>
                      <LabelWithTooltip tooltip={explanation.meaning}>
                        {explanation.label}
                      </LabelWithTooltip>
                    </h4>
                  </div>
                  <div className={styles.chipRow}>
                    <SeverityBadge severity={factor.severity} context="risk" />
                    {riskPointText(factor.scoreImpact) ? (
                      <span className={styles.labelWithTooltip}>
                        <span className={styles.scoreImpact}>{riskPointText(factor.scoreImpact)}</span>
                        <HelpTooltip text="This is how many points this factor adds to the total Risk Score. Higher point impact means the factor contributes more strongly to the risk level." />
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className={styles.riskDescription}>{normalizeRiskLanguage(factor.description) || "No description was provided."}</p>
                <p className={styles.inlineHelpText}>
                  <strong>Why it matters:</strong> {explanation.whyItMatters}
                </p>
                {isMissingData && totalTx > 0 ? (
                  <p className={styles.inlineHelpText}>
                    Unsupported transactions: {unsupported.toLocaleString()} out of {totalTx.toLocaleString()} analyzed transactions. Missing Data is a reliability adjustment, not suspicious wallet behavior.
                  </p>
                ) : null}
                {evidenceIds.length > 0 ? (
                  <div className={styles.chipRow}>
                    <LabelWithTooltip
                      className={styles.chipLabel}
                      tooltip="Evidence IDs connect this risk factor to supporting evidence cards and key findings."
                    >
                      Evidence
                    </LabelWithTooltip>
                    {evidenceIds.map((id) => (
                      <span key={id} className={styles.chip}>{id}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
