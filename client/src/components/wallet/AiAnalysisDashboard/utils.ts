import type { EvidenceLike, Severity } from "./types";

export function truncateMiddle(value: string, start = 6, end = 4): string {
  if (!value) return value;
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  const numeric = Number(value);
  const percent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
}

export function getSeverityClass(severity: Severity): "high" | "medium" | "low" | "neutral" {
  const normalized = String(severity ?? "").toUpperCase();
  if (normalized === "HIGH") return "high";
  if (normalized === "MEDIUM") return "medium";
  if (normalized === "LOW") return "low";
  return "neutral";
}

export function getRiskLevelClass(riskLevel: string | null | undefined): "high" | "medium" | "low" | "neutral" {
  const normalized = String(riskLevel ?? "").toUpperCase();
  if (normalized === "HIGH" || normalized === "CRITICAL") return "high";
  if (normalized === "MEDIUM" || normalized === "MODERATE") return "medium";
  if (normalized === "LOW") return "low";
  return "neutral";
}

export function getEvidenceId(evidence: EvidenceLike): string {
  return evidence.evidenceId ?? evidence.id ?? "evidence";
}

export function formatMetricValue(value: unknown): string {
  if (value == null || value === "") return "-";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return String(value);
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}
