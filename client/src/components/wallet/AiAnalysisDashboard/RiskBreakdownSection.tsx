import styles from "./AiAnalysisDashboard.module.scss";
import { SeverityBadge } from "./SeverityBadge";
import type { RiskFactorLike } from "./types";
import { formatRiskCode, normalizeRiskLanguage, uniqueStrings } from "./utils";

function formatScoreImpact(value: RiskFactorLike["scoreImpact"]): string | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return `${numeric > 0 ? "+" : ""}${numeric} pts`;
  }
  return String(value);
}

export function RiskBreakdownSection({ riskFactors }: { riskFactors?: RiskFactorLike[] }) {
  const factors = riskFactors ?? [];

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
            return (
              <article key={`${factor.code ?? "risk"}-${index}`} className={styles.riskFactorCard}>
                <div className={styles.riskTitleRow}>
                  <div>
                    <h4 className={styles.riskTitle}>{formatRiskCode(factor.code ?? "UNKNOWN")}</h4>
                  </div>
                  <div className={styles.chipRow}>
                    <SeverityBadge severity={factor.severity} />
                    {formatScoreImpact(factor.scoreImpact) ? (
                      <span className={styles.scoreImpact}>{formatScoreImpact(factor.scoreImpact)}</span>
                    ) : null}
                  </div>
                </div>
                <p className={styles.riskDescription}>{normalizeRiskLanguage(factor.description) || "No description was provided."}</p>
                {evidenceIds.length > 0 ? (
                  <div className={styles.chipRow}>
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
