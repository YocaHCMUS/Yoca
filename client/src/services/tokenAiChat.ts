import client from "@/api/main";

export type TokenAiTimeframe = "24h" | "7d" | "1m" | "3m" | "1y";
export type TokenAiLanguage = "en" | "vi";
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
  provider: "gemini" | "deterministic";
  fallbackReason?: string;
  cache?: {
    hit: boolean;
    expiresAt?: string;
  };
}

export interface TokenAiChatResponse {
  success: true;
  data: TokenAiChatData;
}

export async function askTokenAiChat(
  payload: TokenAiChatPayload,
): Promise<TokenAiChatData> {
  const response = await (client.api.tokenAiChat.index as any).$post({
    json: payload,
  });

  if (!response.ok) {
    let message = `Token AI chat failed (${response.status})`;
    try {
      const errorData = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (errorData.message?.trim()) {
        message = errorData.message;
      } else if (errorData.error?.trim()) {
        message = errorData.error;
      }
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  const data = (await response.json()) as TokenAiChatResponse;
  return data.data;
}
