import client from "@/api/main";

export type TokenAiTimeframe = "24h" | "7d" | "1m" | "3m" | "1y";
export type TokenAiLanguage = "en" | "vi";
export type TokenAiModelMode = "fast" | "balanced" | "deep";
export type TokenAiProvider =
  | "gemini"
  | "gemini_model_fallback"
  | "cached_gemini"
  | "analyst_fallback"
  | "deterministic";
export type TokenAiIntent =
  | "price_move_explanation"
  | "latest_news"
  | "risk_overview"
  | "bullish_bearish"
  | "simple_explanation"
  | "what_to_watch"
  | "investment_guidance"
  | "custom";

export interface TokenAiChatPayload {
  address: string;
  symbol?: string;
  name?: string;
  question: string;
  timeframe?: TokenAiTimeframe;
  language?: TokenAiLanguage;
  includeNews?: boolean;
  includeVolatility?: boolean;
  modelMode?: TokenAiModelMode;
}

export interface TokenAiSection {
  title: string;
  kind:
    | "market_snapshot"
    | "key_drivers"
    | "deep_dive"
    | "latest_headlines"
    | "why_it_matters"
    | "bullish_signals"
    | "bearish_signals"
    | "risk_factors"
    | "what_to_watch"
    | "simple_explanation"
    | "scenario_analysis"
    | "practical_framework"
    | "conclusion"
    | "custom";
  content?: string;
  bullets?: string[];
  table?: Array<Record<string, string | number | null>>;
}

export interface TokenAiEvidence {
  type:
    | "market"
    | "chart"
    | "news"
    | "volatility"
    | "holders"
    | "pool"
    | "trades"
    | "security"
    | "metadata"
    | "internal";
  label: string;
  value?: string;
  detail?: string;
  url?: string;
  timestamp?: string;
  source?: string;
}

export interface TokenAiSource {
  title: string;
  publisher?: string;
  url: string;
  publishedAt?: string | null;
  snippet?: string;
  sourceType?: "internal" | "external";
}

export interface TokenAiChatData {
  token: {
    address: string;
    symbol?: string;
    name?: string;
    yocaUrl: string;
  };
  question: string;
  intent: TokenAiIntent;
  tldr: string[];
  sections: TokenAiSection[];
  evidence: TokenAiEvidence[];
  sources: TokenAiSource[];
  warnings: string[];
  confidence: "Low" | "Medium" | "High";
  asOf: string;
  disclaimer: string;
  generatedAt: string;
  provider: TokenAiProvider;
  fallbackReason?: string;
  modelModeRequested?: TokenAiModelMode;
  modelModeUsed?: TokenAiModelMode;
  modelRequested?: string;
  modelUsed?: string;
  stale?: boolean;
  cache?: {
    hit: boolean;
    expiresAt?: string;
  };
}

export interface TokenAiChatResponse {
  success: true;
  data: TokenAiChatData;
  usage: AiUsageMetadata;
}

export interface AiUsageMetadata {
  feature: "ask_yoca_ai";
  tier: "Free" | "Lite" | "Plus" | "Pro";
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export class TokenAiChatError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
    public readonly usage?: AiUsageMetadata,
  ) {
    super(message);
    this.name = "TokenAiChatError";
  }
}

export async function askTokenAiChat(
  payload: TokenAiChatPayload,
): Promise<TokenAiChatResponse> {
  const response = await client.api.tokenAiChat.index.$post({
    json: payload,
  });

  if (!response.ok) {
    let message = `Token AI chat failed (${response.status})`;
    let errorCode: string | undefined;
    let usage: AiUsageMetadata | undefined;
    try {
      const errorData = (await response.json()) as {
        message?: string;
        error?: string;
        errorCode?: string;
        feature?: AiUsageMetadata["feature"];
        tier?: AiUsageMetadata["tier"];
        limit?: number;
        used?: number;
        remaining?: number;
        resetsAt?: string;
      };
      if (errorData.message?.trim()) {
        message = errorData.message;
      } else if (errorData.error?.trim()) {
        message = errorData.error;
      }
      errorCode = errorData.errorCode;
      usage =
        errorData.feature &&
        errorData.tier &&
        typeof errorData.limit === "number" &&
        typeof errorData.used === "number" &&
        typeof errorData.remaining === "number" &&
        errorData.resetsAt
          ? {
              feature: errorData.feature,
              tier: errorData.tier,
              limit: errorData.limit,
              used: errorData.used,
              remaining: errorData.remaining,
              resetsAt: errorData.resetsAt,
            }
          : undefined;
    } catch {
      // Keep the status-based fallback message when the body is not JSON.
    }
    throw new TokenAiChatError(message, response.status, errorCode, usage);
  }

  return (await response.json()) as TokenAiChatResponse;
}
