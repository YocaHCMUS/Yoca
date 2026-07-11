import styles from "./AiAnalysisDashboard.module.scss";
import { LabelWithTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import type { AnalysisProfileLike, MetricCardItem } from "./types";
import { formatPercent, getRiskLevelClass } from "./utils";

type AnalysisMetricCardsProps = {
  profile: AnalysisProfileLike;
};

function metricToneFromRisk(riskLevel: string | null | undefined): MetricCardItem["tone"] {
  const riskClass = getRiskLevelClass(riskLevel);
  if (riskClass === "high") return "danger";
  if (riskClass === "medium") return "warning";
  if (riskClass === "low") return "success";
  return "neutral";
}

function metricToneFromScore(score: number | null | undefined): MetricCardItem["tone"] {
  if (score == null) return "neutral";
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}

export function AnalysisMetricCards({ profile }: AnalysisMetricCardsProps) {
  const { tr, formatCount, labelForCode } = useAiAnalysisI18n();
  const trustScore = profile?.risk?.trustScore;
  const riskLevel = profile?.risk?.riskLevel;
  const persona = profile?.persona?.primaryPersona;
  const confidence = profile?.persona?.primaryPersonaScore ?? profile?.persona?.confidence;
  const completeness = profile?.dataQuality?.completenessScore;
  const txCount = profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit;
  const unsupportedCount = Number(profile?.dataQuality?.unsupportedTransactionCount ?? 0);
  const missingPriceCount = Number(profile?.dataQuality?.missingPriceCount ?? 0);
  const dataIssueText = [
    unsupportedCount > 0 ? String(tr("aiAnalysisDashboard.metrics.unsupported", { count: unsupportedCount })) : null,
    missingPriceCount > 0 ? String(tr("aiAnalysisDashboard.metrics.missingPrices", { count: missingPriceCount })) : null,
  ].filter(Boolean).join("; ");
  const dataHelper = txCount != null && (unsupportedCount > 0 || missingPriceCount > 0)
    ? String(tr("aiAnalysisDashboard.metrics.outOfAnalyzed", {
        items: dataIssueText,
        txCount: formatCount(Number(txCount)),
      }))
    : String(tr("aiAnalysisDashboard.metrics.dataCompletenessHelper"));
  const transactionHelper = txCount != null && unsupportedCount > 0
    ? String(tr("aiAnalysisDashboard.metrics.unsupportedOutOfAnalyzed", {
        unsupported: formatCount(unsupportedCount),
        txCount: formatCount(Number(txCount)),
      }))
    : String(tr("aiAnalysisDashboard.metrics.analyzedTransactionsHelper"));

  const cards: MetricCardItem[] = [
    {
      label: String(tr("aiAnalysisDashboard.metrics.trustScore")),
      value: trustScore != null ? `${Math.round(Number(trustScore))} / 100` : "-",
      helper: String(tr("aiAnalysisDashboard.metrics.trustScoreHelper")),
      tooltip: String(tr("aiAnalysisDashboard.metrics.trustScoreTooltip")),
      tone: metricToneFromScore(trustScore),
    },
    {
      label: String(tr("aiAnalysisDashboard.metrics.riskLevel")),
      value: labelForCode(riskLevel ?? "UNKNOWN"),
      helper: String(tr("aiAnalysisDashboard.metrics.riskLevelHelper")),
      tooltip: String(tr("aiAnalysisDashboard.metrics.riskLevelTooltip")),
      tone: metricToneFromRisk(riskLevel),
    },
    {
      label: String(tr("aiAnalysisDashboard.metrics.persona")),
      value: labelForCode(persona),
      helper: String(tr("aiAnalysisDashboard.metrics.personaHelper")),
      tooltip: String(tr("aiAnalysisDashboard.metrics.personaTooltip")),
      tone: "info",
    },
    {
      label: String(tr("aiAnalysisDashboard.metrics.personaConfidence")),
      value: formatPercent(confidence),
      helper: String(tr("aiAnalysisDashboard.metrics.personaConfidenceHelper")),
      tooltip: String(tr("aiAnalysisDashboard.metrics.personaConfidenceTooltip")),
      tone: "neutral",
    },
    {
      label: String(tr("aiAnalysisDashboard.metrics.dataCompleteness")),
      value: formatPercent(completeness),
      helper: dataHelper,
      tooltip: String(tr("aiAnalysisDashboard.metrics.dataCompletenessTooltip")),
      tone: Number(completeness ?? 0) >= 70 ? "success" : "warning",
    },
    {
      label: String(tr("aiAnalysisDashboard.metrics.analyzedTransactions")),
      value: txCount != null ? formatCount(Number(txCount)) : "-",
      helper: transactionHelper,
      tooltip: String(tr("aiAnalysisDashboard.metrics.analyzedTransactionsTooltip")),
      tone: "neutral",
    },
  ];

  return (
    <section className={styles.metricsGrid} aria-label={String(tr("aiAnalysisDashboard.metrics.ariaLabel"))}>
      {cards.map((card) => (
        <article key={card.label} className={`${styles.metricCard} ${styles[`metric_${card.tone ?? "neutral"}`]}`}>
          <LabelWithTooltip className={styles.metricLabel} tooltip={card.tooltip}>
            {card.label}
          </LabelWithTooltip>
          <strong className={styles.metricValue}>{card.value}</strong>
          {card.helper ? <span className={styles.metricHelper}>{card.helper}</span> : null}
        </article>
      ))}
    </section>
  );
}
