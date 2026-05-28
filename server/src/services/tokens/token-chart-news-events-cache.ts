import { db } from "@sv/db/index.js";
import { tokenChartNewsEventsCache } from "@sv/db/schema.js";
import { and, eq, gt } from "drizzle-orm";

export type TokenChartNewsTimeframe = "24h" | "7d" | "1m" | "3m" | "1y";

export interface TokenChartNewsEventsCacheKey {
  tokenAddress: string;
  symbol: string;
  name: string;
  timeframe: TokenChartNewsTimeframe;
  includeSummary: boolean;
}

export interface TokenChartNewsEventsCacheEntry<TData> {
  data: TData;
  expiresAt: string;
}

const TOKEN_CHART_NEWS_EVENTS_CACHE_TTL_MS: Record<
  TokenChartNewsTimeframe,
  number
> = {
  "24h": 30 * 60 * 1000,
  "7d": 60 * 60 * 1000,
  "1m": 2 * 60 * 60 * 1000,
  "3m": 6 * 60 * 60 * 1000,
  "1y": 6 * 60 * 60 * 1000,
};

export function getTokenChartNewsEventsCacheExpiresAt(
  timeframe: TokenChartNewsTimeframe,
) {
  return new Date(
    Date.now() + TOKEN_CHART_NEWS_EVENTS_CACHE_TTL_MS[timeframe],
  );
}

export async function readTokenChartNewsEventsCache<TData>(
  key: TokenChartNewsEventsCacheKey,
): Promise<TokenChartNewsEventsCacheEntry<TData> | null> {
  const [row] = await db
    .select({
      responseJson: tokenChartNewsEventsCache.responseJson,
      expiresAt: tokenChartNewsEventsCache.expiresAt,
    })
    .from(tokenChartNewsEventsCache)
    .where(
      and(
        eq(tokenChartNewsEventsCache.tokenAddress, key.tokenAddress),
        eq(tokenChartNewsEventsCache.symbol, key.symbol),
        eq(tokenChartNewsEventsCache.name, key.name),
        eq(tokenChartNewsEventsCache.timeframe, key.timeframe),
        eq(tokenChartNewsEventsCache.includeSummary, key.includeSummary),
        gt(tokenChartNewsEventsCache.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    data: row.responseJson as TData,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function writeTokenChartNewsEventsCache<TData>(
  key: TokenChartNewsEventsCacheKey,
  data: TData,
  expiresAt: Date,
) {
  const now = new Date();

  await db
    .insert(tokenChartNewsEventsCache)
    .values({
      tokenAddress: key.tokenAddress,
      symbol: key.symbol,
      name: key.name,
      timeframe: key.timeframe,
      includeSummary: key.includeSummary,
      responseJson: data as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        tokenChartNewsEventsCache.tokenAddress,
        tokenChartNewsEventsCache.symbol,
        tokenChartNewsEventsCache.name,
        tokenChartNewsEventsCache.timeframe,
        tokenChartNewsEventsCache.includeSummary,
      ],
      set: {
        responseJson: data as Record<string, unknown>,
        updatedAt: now,
        expiresAt,
      },
    });
}
