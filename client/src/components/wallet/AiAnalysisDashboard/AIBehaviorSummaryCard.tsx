import styles from "./AiAnalysisDashboard.module.scss";
import { formatEnumLabel, normalizeRiskLanguage } from "./utils";

type AIBehaviorSummaryCardProps = {
  aiSummary: any;
};

export function AIBehaviorSummaryCard({ aiSummary }: AIBehaviorSummaryCardProps) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>AI Wallet Behavior Summary</h3>
          <p className={styles.sectionDescription}>Plain-language interpretation of the computed wallet profile.</p>
        </div>
      </div>

      <div className={styles.summaryStack}>
        {aiSummary?.shortSummary ? (
          <p className={styles.summaryText}>{normalizeRiskLanguage(aiSummary.shortSummary)}</p>
        ) : (
          <p className={styles.bodyText}>No summary was generated for this wallet.</p>
        )}

        <div className={styles.summaryMetaGrid}>
          <div className={styles.summaryMetaCard}>
            <div className={styles.cardMetaLabel}>Wallet Persona</div>
            <div className={styles.cardMetaValue}>{formatEnumLabel(aiSummary?.walletPersona)}</div>
          </div>
          <div className={styles.summaryMetaCard}>
            <div className={styles.cardMetaLabel}>Risk Summary</div>
            <div className={styles.cardMetaValue}>{normalizeRiskLanguage(aiSummary?.riskSummary) || "-"}</div>
          </div>
          <div className={styles.summaryMetaCard}>
            <div className={styles.cardMetaLabel}>PnL Summary</div>
            <div className={styles.cardMetaValue}>{normalizeRiskLanguage(aiSummary?.pnlSummary) || "-"}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
