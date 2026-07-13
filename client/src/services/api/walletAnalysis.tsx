import type { AnalysisProfileLike, AnalysisSummaryLike } from "@/components/wallet/AiAnalysisDashboard/types";
export type AnalyzeWalletWithAIParams = {
  walletAddress: string;
  transactionLimit?: number;
  language?: "vi" | "en";
  userLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  maxSummaryLength?: "SHORT" | "MEDIUM" | "DETAILED";
};

export type WalletAnalysisApiResponse = {
  walletAddress: string;
  profile: AnalysisProfileLike;
  aiSummary: AnalysisSummaryLike;
  generatedAt: string;
  debug?: {
    transactionSource?: string;
    rawTransactionCount?: number;
    normalizedEventCount?: number;
    warnings?: string[];
  };
};

export class WalletAnalysisApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WalletAnalysisApiError";
    this.code = code;
  }
}

export async function analyzeWalletWithAI(params: AnalyzeWalletWithAIParams) {
  const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN || "";
  const endpoint = `${apiDomain}/api/wallet-analysis/analyze`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const code = typeof payload?.error?.code === "string" ? payload.error.code : undefined;
    const message = code === "TRANSACTION_FETCH_FAILED"
      ? "AI analysis could not load wallet transaction data. Please retry."
      : payload?.error?.message ?? `Request failed with ${res.status}`;
    throw new WalletAnalysisApiError(message, code);
  }

  const payload = await res.json();
  if (!payload?.success || !payload?.data) {
    throw new Error("Wallet analysis response is missing expected data.");
  }

  return payload.data as WalletAnalysisApiResponse;
}

export default analyzeWalletWithAI;


