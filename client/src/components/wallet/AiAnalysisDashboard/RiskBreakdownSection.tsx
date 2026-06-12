import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip, LabelWithTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import { SeverityBadge } from "./SeverityBadge";
import type { RiskFactorLike } from "./types";
import { uniqueStrings } from "./utils";

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
  return formatted;
}

export function RiskBreakdownSection({
  riskFactors,
  profile,
}: {
  riskFactors?: RiskFactorLike[];
  profile?: any;
}) {
  const { tr, formatCount, riskFactorExplanation, normalizeUserText } = useAiAnalysisI18n();
  const factors = riskFactors ?? [];
  const unsupported = Number(profile?.dataQuality?.unsupportedTransactionCount ?? 0);
  const totalTx = Number(profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit ?? 0);

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr("aiAnalysisDashboard.riskBreakdown.title")}</h3>
          <p className={styles.sectionDescription}>{tr("aiAnalysisDashboard.riskBreakdown.description")}</p>
        </div>
      </div>

      {factors.length === 0 ? (
        <p className={styles.bodyText}>{tr("aiAnalysisDashboard.riskBreakdown.empty")}</p>
      ) : (
        <div className={styles.riskList}>
          {factors.map((factor, index) => {
            const evidenceIds = uniqueStrings(factor.evidenceIds ?? []);
            const explanation = riskFactorExplanation(factor.code);
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
                        <span className={styles.scoreImpact}>
                          {tr("aiAnalysisDashboard.riskBreakdown.pointsAdded", {
                            points: riskPointText(factor.scoreImpact) ?? "",
                          })}
                        </span>
                        <HelpTooltip text={String(tr("aiAnalysisDashboard.riskBreakdown.pointsTooltip"))} />
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className={styles.riskDescription}>
                  {normalizeUserText(factor.description) || tr("aiAnalysisDashboard.riskBreakdown.fallbackDescription")}
                </p>
                <p className={styles.inlineHelpText}>
                  <strong>{tr("aiAnalysisDashboard.riskBreakdown.whyItMatters")}</strong>{" "}
                  {explanation.whyItMatters}
                </p>
                {isMissingData && totalTx > 0 ? (
                  <p className={styles.inlineHelpText}>
                    {tr("aiAnalysisDashboard.riskBreakdown.unsupportedOutOfTotal", {
                      unsupported: formatCount(unsupported),
                      txTotal: formatCount(totalTx),
                    })}
                  </p>
                ) : null}
                {evidenceIds.length > 0 ? (
                  <div className={styles.chipRow}>
                    <LabelWithTooltip
                      className={styles.chipLabel}
                      tooltip={String(tr("aiAnalysisDashboard.riskBreakdown.evidenceTooltip"))}
                    >
                      {tr("aiAnalysisDashboard.riskBreakdown.evidence")}
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
