import styles from "./AiAnalysisDashboard.module.scss";
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

  const cards: MetricCardItem[] = [
    {
      label: "Trust Score",
      value: trustScore != null ? `${Math.round(Number(trustScore))} / 100` : "-",
      helper: "Higher means cleaner observed behavior",
      tone: metricToneFromScore(trustScore),
    },
    {
      label: "Risk Level",
      value: String(riskLevel ?? "UNKNOWN").toUpperCase(),
      helper: "Based on computed behavioral signals",
      tone: metricToneFromRisk(riskLevel),
    },
    {
      label: "Persona",
      value: formatEnumLabel(persona),
      helper: "Primary behavior pattern",
      tone: "info",
    },
    {
      label: "Persona Confidence",
      value: formatPercent(confidence),
      helper: "Confidence in the persona classification",
      tone: "neutral",
    },
    {
      label: "Data Completeness",
      value: formatPercent(completeness),
      helper: "Quality of available analysis inputs",
      tone: Number(completeness ?? 0) >= 70 ? "success" : "warning",
    },
    {
      label: "Analyzed Transactions",
      value: txCount != null ? Number(txCount).toLocaleString() : "-",
      helper: "Transactions in the analysis window",
      tone: "neutral",
    },
  ];

  return (
    <section className={styles.metricsGrid} aria-label="AI analysis metrics">
      {cards.map((card) => (
        <article key={card.label} className={`${styles.metricCard} ${styles[`metric_${card.tone ?? "neutral"}`]}`}>
          <span className={styles.metricLabel}>{card.label}</span>
          <strong className={styles.metricValue}>{card.value}</strong>
          {card.helper ? <span className={styles.metricHelper}>{card.helper}</span> : null}
        </article>
      ))}
    </section>
  );
}
