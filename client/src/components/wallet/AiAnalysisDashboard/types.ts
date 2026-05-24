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
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
};
