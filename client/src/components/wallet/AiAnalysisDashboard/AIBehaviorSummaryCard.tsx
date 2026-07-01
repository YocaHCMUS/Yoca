import styles from "./AiAnalysisDashboard.module.scss";
import { ExplanationDetails, HelpTooltip, LabelWithTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import {
  formatPercent,
  uniqueStrings,
} from "./utils";

type AIBehaviorSummaryCardProps = {
  aiSummary: any;
  profile: any;
};

export function AIBehaviorSummaryCard({ aiSummary, profile }: AIBehaviorSummaryCardProps) {
  const {
    tr,
    labelForCode,
    personaExplanation: getLocalizedPersonaExplanation,
    normalizeUserText,
    riskLevelExplanation,
  } = useAiAnalysisI18n();
  const persona = profile?.persona?.primaryPersona ?? aiSummary?.walletPersona;
  const personaExplanation = getLocalizedPersonaExplanation(persona);
  const confidence = profile?.persona?.confidence ?? profile?.persona?.primaryPersonaScore;
  const reasoning = uniqueStrings(profile?.persona?.reasoning ?? []).slice(0, 4);
  const evidenceIds = uniqueStrings(profile?.persona?.evidenceIds ?? []);
  const riskScore = profile?.risk?.riskScore;
  const txCount = profile?.analysisWindow?.actualTransactionCount;

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr("aiAnalysisDashboard.summary.title")}</h3>
          <p className={styles.sectionDescription}>{tr("aiAnalysisDashboard.summary.description")}</p>
        </div>
      </div>

      <div className={styles.summaryStack}>
        {aiSummary?.shortSummary ? (
          <p className={styles.summaryText}>{normalizeUserText(aiSummary.shortSummary)}</p>
        ) : (
          <p className={styles.bodyText}>{tr("aiAnalysisDashboard.summary.noSummary")}</p>
        )}

        <div className={styles.summaryMetaGrid}>
          <div className={styles.summaryMetaCard}>
            <LabelWithTooltip
              className={styles.cardMetaLabel}
              tooltip={String(tr("aiAnalysisDashboard.summary.walletPersonaTooltip"))}
            >
              {tr("aiAnalysisDashboard.summary.walletPersona")}
            </LabelWithTooltip>
            <div className={styles.cardMetaValue}>{labelForCode(aiSummary?.walletPersona)}</div>
          </div>
          <div className={styles.summaryMetaCard}>
            <LabelWithTooltip
              className={styles.cardMetaLabel}
              tooltip={riskLevelExplanation(riskScore, txCount)}
            >
              {tr("aiAnalysisDashboard.summary.riskSummary")}
            </LabelWithTooltip>
            <div className={styles.cardMetaValue}>{normalizeUserText(aiSummary?.riskSummary) || "-"}</div>
          </div>
          <div className={styles.summaryMetaCard}>
            <LabelWithTooltip
              className={styles.cardMetaLabel}
              tooltip={String(tr("aiAnalysisDashboard.summary.pnlSummaryTooltip"))}
            >
              {tr("aiAnalysisDashboard.summary.pnlSummary")}
            </LabelWithTooltip>
            <div className={styles.cardMetaValue}>{normalizeUserText(aiSummary?.pnlSummary) || "-"}</div>
          </div>
        </div>

        <ExplanationDetails summary={tr("aiAnalysisDashboard.summary.whyPersona")}>
          <p className={styles.inlineHelpText}>
            {tr("aiAnalysisDashboard.summary.personaVsRisk")}
          </p>
          <div className={styles.explanationGrid}>
            <div className={styles.explanationBlock}>
              <div className={styles.cardMetaLabel}>
                {tr("aiAnalysisDashboard.summary.selectedPersona")}{" "}
                <HelpTooltip text={personaExplanation.caution ?? String(tr("aiAnalysisDashboard.summary.selectedPersonaFallbackTooltip"))} />
              </div>
              <div className={styles.cardMetaValue}>{personaExplanation.label}</div>
              <p className={styles.inlineHelpText}>{personaExplanation.meaning}</p>
            </div>
            <div className={styles.explanationBlock}>
              <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.summary.commonSignals")}</div>
              <p className={styles.inlineHelpText}>{personaExplanation.commonSignals}</p>
            </div>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.summary.observedSupport")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.summary.personaConfidenceSentence", {
                confidence: formatPercent(confidence),
              })}
            </p>
            {reasoning.length > 0 ? (
              <ul className={styles.compactList}>
                {reasoning.map((item) => (
                  <li key={item}>{normalizeUserText(item)}</li>
                ))}
              </ul>
            ) : null}
            {evidenceIds.length > 0 ? (
              <div className={styles.chipRow}>
                {evidenceIds.slice(0, 6).map((id) => (
                  <span key={id} className={styles.chip}>{id}</span>
                ))}
                {evidenceIds.length > 6 ? (
                  <span className={`${styles.chip} ${styles.moreChip}`}>
                    {tr("aiAnalysisDashboard.summary.more", { count: evidenceIds.length - 6 })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </ExplanationDetails>
      </div>
    </section>
  );
}
