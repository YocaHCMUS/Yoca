import type { ReactNode } from "react";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | string | null | undefined;

export type EvidenceLike = {
  evidenceId?: string;
  id?: string;
  title?: string;
  description?: string;
  value?: number | string | null;
  threshold?: number | string | null;
  severity?: Severity;
  relatedSignatures?: string[];
  relatedTokenMints?: string[];
};

export type FindingLike = {
  title?: string;
  explanation?: string;
  severity?: Severity;
  evidenceIds?: string[];
  relatedSignatures?: string[];
};

export type RiskFactorLike = {
  code?: string;
  severity?: Severity;
  scoreImpact?: number | string | null;
  description?: string;
  evidenceIds?: string[];
};

export type MetricCardItem = {
  label: string;
  value: ReactNode;
  helper?: string;
  tooltip?: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
};

export type PersonaExplanation = {
  label: string;
  meaning: string;
  commonSignals: string;
  caution?: string;
};

export type RiskFactorExplanation = {
  label: string;
  meaning: string;
  whyItMatters: string;
};
