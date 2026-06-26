import client from "@/api/main";
import type {
    TokenVolatilityNewsQuery,
    VolatilitySignalResponse,
} from "@/types/volatility";

export async function getTokenVolatilityNews(
  query: TokenVolatilityNewsQuery,
) {
  const resp = await client.api["token-chart-news-events"].$get({
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
    throw new Error(`Failed to fetch volatility signals: ${resp.status}`);
  }

  const payload = (await resp.json()) as VolatilitySignalResponse;
  if (!payload.success) {
    throw new Error("Failed to fetch volatility signals");
  }

  return payload.data;
}
