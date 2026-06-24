import client from "@/api/main";
import type {
  TokenVolatilityNewsQuery,
  VolatilityAiUsage,
  VolatilitySignalResponse,
} from "@/types/volatility";

export class TokenVolatilityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
    public readonly usage?: VolatilityAiUsage,
  ) {
    super(message);
    this.name = "TokenVolatilityError";
  }
}

export async function getTokenVolatilityNews(
  query: TokenVolatilityNewsQuery,
) {
  const resp = await client.api.tokenVolatilityNews.index.$get({
    query: {
      address: query.address,
      symbol: query.symbol,
      name: query.name,
      threshold: String(query.threshold ?? 20),
      timeframe: query.timeframe ?? "daily",
      window: query.window ?? "auto",
      maxEventsWithNews: String(query.maxEventsWithNews ?? 3),
      ...(query.forceRefresh ? { forceRefresh: "true" } : {}),
      ...(query.includeSummary ? { includeSummary: "true" } : {}),
    },
  });

  if (!resp.ok) {
    let message = `Failed to fetch volatility signals: ${resp.status}`;
    let errorCode: string | undefined;
    let usage: VolatilityAiUsage | undefined;
    try {
      const error = (await resp.json()) as {
        message?: string;
        errorCode?: string;
        feature?: VolatilityAiUsage["feature"];
        tier?: VolatilityAiUsage["tier"];
        limit?: number;
        used?: number;
        remaining?: number;
        resetsAt?: string;
        disabled?: boolean;
      };
      message = error.message?.trim() || message;
      errorCode = error.errorCode;
      usage =
        error.feature &&
        error.tier &&
        typeof error.limit === "number" &&
        typeof error.used === "number" &&
        typeof error.remaining === "number" &&
        error.resetsAt
          ? {
              feature: error.feature,
              tier: error.tier,
              limit: error.limit,
              used: error.used,
              remaining: error.remaining,
              resetsAt: error.resetsAt,
              disabled: error.disabled,
            }
          : undefined;
    } catch {
      // Keep the status-based fallback message when the body is not JSON.
    }
    throw new TokenVolatilityError(
      message,
      resp.status,
      errorCode,
      usage,
    );
  }

  const payload = (await resp.json()) as VolatilitySignalResponse;
  if (!payload.success) {
    throw new Error("Failed to fetch volatility signals");
  }

  return {
    ...payload.data,
    usage: payload.usage,
    counted: payload.counted ?? false,
  };
}
