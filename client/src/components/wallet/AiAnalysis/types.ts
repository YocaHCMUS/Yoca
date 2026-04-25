export type AiAnalysisDependencyId = "portfolio" | "swaps" | "intelligence";

export type AiAnalysisDependencyStatus = "available" | "no_data" | "fetching";

export interface AiAnalysisDependencyItem {
  id: AiAnalysisDependencyId;
  label: string;
  status: AiAnalysisDependencyStatus;
}

