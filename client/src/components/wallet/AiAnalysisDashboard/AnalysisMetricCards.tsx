import styles from "./AiAnalysisDashboard.module.scss";
import { LabelWithTooltip } from "./HelpTooltip";
import type { MetricCardItem } from "./types";
import { formatEnumLabel, formatPercent, getRiskLevelClass } from "./utils";

type AnalysisMetricCardsProps = {
  profile: any;
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
  const trustScore = profile?.risk?.trustScore;
  const riskLevel = profile?.risk?.riskLevel;
  const persona = profile?.persona?.primaryPersona;
  const confidence = profile?.persona?.primaryPersonaScore ?? profile?.persona?.confidence;
  const completeness = profile?.dataQuality?.completenessScore;
  const txCount = profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit;
  const unsupportedCount = Number(profile?.dataQuality?.unsupportedTransactionCount ?? 0);
  const missingPriceCount = Number(profile?.dataQuality?.missingPriceCount ?? 0);
  const dataHelper = txCount != null && (unsupportedCount > 0 || missingPriceCount > 0)
    ? [
        unsupportedCount > 0 ? `${unsupportedCount} unsupported` : null,
        missingPriceCount > 0 ? `${missingPriceCount} missing prices` : null,
      ].filter(Boolean).join("; ") + ` out of ${Number(txCount).toLocaleString()} analyzed transactions`
    : "Quality of available analysis inputs";
  const transactionHelper = txCount != null && unsupportedCount > 0
    ? `${unsupportedCount} unsupported out of ${Number(txCount).toLocaleString()} analyzed transactions.`
    : "Transactions in the analysis window";

  const cards: MetricCardItem[] = [
    {
      label: "Trust Score",
      value: trustScore != null ? `${Math.round(Number(trustScore))} / 100` : "-",
      helper: "Higher means cleaner observed behavior",
      tooltip: "Trust Score is calculated as 100 minus Risk Score. Higher means fewer risk signals were observed in the analyzed transaction window.",
      tone: metricToneFromScore(trustScore),
    },
    {
      label: "Risk Level",
      value: String(riskLevel ?? "UNKNOWN").toUpperCase(),
      helper: "Based on computed behavioral signals",
      tooltip: "Risk Level is assigned from the total Risk Score: LOW 0-19, MEDIUM 20-44, HIGH 45-74, CRITICAL 75-100. UNKNOWN is used when there are too few transactions.",
      tone: metricToneFromRisk(riskLevel),
    },
    {
      label: "Persona",
      value: formatEnumLabel(persona),
      helper: "Primary behavior pattern",
      tooltip: "Persona is the wallet's primary observed behavior pattern. It describes behavior in the analyzed window, not the identity or intent of the wallet owner.",
      tone: "info",
    },
    {
      label: "Persona Confidence",
      value: formatPercent(confidence),
      helper: "Confidence in the persona classification",
      tooltip: "Persona Confidence estimates how strongly the available metrics support the selected persona compared with alternatives. It is not legal or identity certainty.",
      tone: "neutral",
    },
    {
      label: "Data Completeness",
      value: formatPercent(completeness),
      helper: dataHelper,
      tooltip: "Data Completeness estimates how usable the analyzed data is. It is reduced by missing prices, unsupported transactions, parsing warnings, and failed transactions.",
      tone: Number(completeness ?? 0) >= 70 ? "success" : "warning",
    },
    {
      label: "Analyzed Transactions",
      value: txCount != null ? Number(txCount).toLocaleString() : "-",
      helper: transactionHelper,
      tooltip: "This is the number of transactions included in the AI analysis window. Results may not represent the wallet's full history.",
      tone: "neutral",
    },
  ];

  return (
    <section className={styles.metricsGrid} aria-label="AI analysis metrics">
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
