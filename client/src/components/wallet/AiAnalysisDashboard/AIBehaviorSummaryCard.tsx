import styles from "./AiAnalysisDashboard.module.scss";
import { ExplanationDetails, HelpTooltip, LabelWithTooltip } from "./HelpTooltip";
import {
  formatEnumLabel,
  formatPercent,
  getPersonaExplanation,
  getRiskLevelExplanation,
  normalizeRiskLanguage,
  uniqueStrings,
} from "./utils";

type AIBehaviorSummaryCardProps = {
  aiSummary: any;
  profile: any;
};

export function AIBehaviorSummaryCard({ aiSummary, profile }: AIBehaviorSummaryCardProps) {
  const persona = profile?.persona?.primaryPersona ?? aiSummary?.walletPersona;
  const personaExplanation = getPersonaExplanation(persona);
  const confidence = profile?.persona?.confidence ?? profile?.persona?.primaryPersonaScore;
  const reasoning = uniqueStrings(profile?.persona?.reasoning ?? []).slice(0, 4);
  const evidenceIds = uniqueStrings(profile?.persona?.evidenceIds ?? []);
  const riskScore = profile?.risk?.riskScore;
  const txCount = profile?.analysisWindow?.actualTransactionCount;

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
            <LabelWithTooltip
              className={styles.cardMetaLabel}
              tooltip="Persona explains what behavior the wallet most resembles. It is separate from Risk Level."
            >
              Wallet Persona
            </LabelWithTooltip>
            <div className={styles.cardMetaValue}>{formatEnumLabel(aiSummary?.walletPersona)}</div>
          </div>
          <div className={styles.summaryMetaCard}>
            <LabelWithTooltip
              className={styles.cardMetaLabel}
              tooltip={getRiskLevelExplanation(riskScore, txCount)}
            >
              Risk Summary
            </LabelWithTooltip>
            <div className={styles.cardMetaValue}>{normalizeRiskLanguage(aiSummary?.riskSummary) || "-"}</div>
          </div>
          <div className={styles.summaryMetaCard}>
            <LabelWithTooltip
              className={styles.cardMetaLabel}
              tooltip="PnL summary is based on closed positions and available price data in the analyzed window. It may not include all wallet value changes."
            >
              PnL Summary
            </LabelWithTooltip>
            <div className={styles.cardMetaValue}>{normalizeRiskLanguage(aiSummary?.pnlSummary) || "-"}</div>
          </div>
        </div>

        <ExplanationDetails summary="Why this persona?">
          <p className={styles.inlineHelpText}>
            Persona explains what behavior the wallet most resembles. Risk Level explains how strong the overall risk signals are.
          </p>
          <div className={styles.explanationGrid}>
            <div className={styles.explanationBlock}>
              <div className={styles.cardMetaLabel}>
                Selected Persona <HelpTooltip text={personaExplanation.caution ?? "This is a behavioral classification, not an identity claim."} />
              </div>
              <div className={styles.cardMetaValue}>{personaExplanation.label}</div>
              <p className={styles.inlineHelpText}>{personaExplanation.meaning}</p>
            </div>
            <div className={styles.explanationBlock}>
              <div className={styles.cardMetaLabel}>Common Signals</div>
              <p className={styles.inlineHelpText}>{personaExplanation.commonSignals}</p>
            </div>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Observed Support</div>
            <p className={styles.inlineHelpText}>
              Persona confidence is {formatPercent(confidence)} based on how strongly available metrics support this persona compared with alternatives.
            </p>
            {reasoning.length > 0 ? (
              <ul className={styles.compactList}>
                {reasoning.map((item) => (
                  <li key={item}>{normalizeRiskLanguage(item)}</li>
                ))}
              </ul>
            ) : null}
            {evidenceIds.length > 0 ? (
              <div className={styles.chipRow}>
                {evidenceIds.slice(0, 6).map((id) => (
                  <span key={id} className={styles.chip}>{id}</span>
                ))}
                {evidenceIds.length > 6 ? (
                  <span className={`${styles.chip} ${styles.moreChip}`}>+{evidenceIds.length - 6} more</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </ExplanationDetails>
      </div>
    </section>
  );
}
