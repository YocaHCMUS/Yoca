import { tokenVolatilityNewsCache } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, eq, gt } from "drizzle-orm";
import type { TokenVolatilityTimeframe } from "./token-volatility.js";

export interface TokenVolatilityNewsCacheKey {
  tokenAddress: string;
  symbol: string;
  name: string;
  thresholdPercent: number;
  timeframe: TokenVolatilityTimeframe;
  detectionWindow: string;
  maxEventsWithNews: number;
  includeSummary: boolean;
}

export interface TokenVolatilityNewsCacheEntry<TData> {
  data: TData;
  expiresAt: string;
}

const TOKEN_VOLATILITY_NEWS_CACHE_TTL_MS: Record<
  TokenVolatilityTimeframe,
  number
> = {
  "24h": 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 6 * 60 * 60 * 1000,
};

export function getTokenVolatilityNewsCacheExpiresAt(
  timeframe: TokenVolatilityTimeframe,
) {
  return new Date(
    Date.now() + TOKEN_VOLATILITY_NEWS_CACHE_TTL_MS[timeframe],
  );
}

export function getTokenVolatilityNewsCacheTtlMs(
  timeframe: TokenVolatilityTimeframe,
) {
  return TOKEN_VOLATILITY_NEWS_CACHE_TTL_MS[timeframe];
}

export async function readTokenVolatilityNewsCache<TData>(
  key: TokenVolatilityNewsCacheKey,
): Promise<TokenVolatilityNewsCacheEntry<TData> | null> {
  const [row] = await db
    .select({
      responseJson: tokenVolatilityNewsCache.responseJson,
      expiresAt: tokenVolatilityNewsCache.expiresAt,
    })
    .from(tokenVolatilityNewsCache)
    .where(
      and(
        eq(tokenVolatilityNewsCache.tokenAddress, key.tokenAddress),
        eq(tokenVolatilityNewsCache.thresholdPercent, key.thresholdPercent),
        eq(tokenVolatilityNewsCache.timeframe, key.timeframe),
        eq(tokenVolatilityNewsCache.detectionWindow, key.detectionWindow),
        eq(tokenVolatilityNewsCache.maxEventsWithNews, key.maxEventsWithNews),
        eq(tokenVolatilityNewsCache.includeSummary, key.includeSummary),
        gt(tokenVolatilityNewsCache.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    data: row.responseJson as TData,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function writeTokenVolatilityNewsCache<TData>(
  key: TokenVolatilityNewsCacheKey,
  data: TData,
  expiresAt: Date,
) {
  const now = new Date();

  await db
    .insert(tokenVolatilityNewsCache)
    .values({
      tokenAddress: key.tokenAddress,
      symbol: key.symbol,
      name: key.name,
      thresholdPercent: key.thresholdPercent,
      timeframe: key.timeframe,
      detectionWindow: key.detectionWindow,
      maxEventsWithNews: key.maxEventsWithNews,
      includeSummary: key.includeSummary,
      responseJson: data as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        tokenVolatilityNewsCache.tokenAddress,
        tokenVolatilityNewsCache.thresholdPercent,
        tokenVolatilityNewsCache.timeframe,
        tokenVolatilityNewsCache.detectionWindow,
        tokenVolatilityNewsCache.maxEventsWithNews,
        tokenVolatilityNewsCache.includeSummary,
      ],
      set: {
        symbol: key.symbol,
        name: key.name,
        responseJson: data as Record<string, unknown>,
        updatedAt: now,
        expiresAt,
      },
    });
}
