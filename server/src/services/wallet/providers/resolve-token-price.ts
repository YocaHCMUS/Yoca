import {
  getEndpoint as getBirdeyeEndpoint,
  getRequiredHeaders as getBirdeyeHeaders,
  limiter as birdeyeLimiter,
} from "@sv/util/util-birdeye.js";
import { validateApiResult } from "@sv/middlewares/validation.js";
import { db } from "@sv/db/index.js";
import { tokenPriceCache } from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { getCoinGeckoIdsByAddresses } from "@sv/services/tokens/token-list.js";
import {
  bds_PriceAtTimestampSchema,
  cg_TokenMarketChartSchema,
  type BDS_PriceAtTimestamp,
} from "@sv/services/_types/token-raw-responses.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import { and, eq, gte, lte, sql } from "drizzle-orm";

const STABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4h4H8o3A8rM6jD5M3j6Q", // USDT
  "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", // USDS
  "2b1kV6DkP7d3xERf9jR7WvyaManEXZDV4SSQSSHqzTe", // PYUSD
]);

const FIVE_MIN_SEC = 300;

type PriceCacheKey = `${string}:${number}`;

function cacheKey(mint: string, bucketSec: number): PriceCacheKey {
  return `${mint}:${bucketSec}` as PriceCacheKey;
}

function fiveMinBucketSec(timestampSec: number): number {
  return Math.floor(timestampSec / FIVE_MIN_SEC) * FIVE_MIN_SEC;
}

const priceCache = new Map<PriceCacheKey, number>();

function extractBirdeyePriceValue(payload: BDS_PriceAtTimestamp): number | undefined {
  const candidates = [
    Number(payload.data?.value ?? 0),
    Number(payload.data?.price ?? 0),
  ];
  for (const value of candidates) {
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

async function fetchBirdeyePriceAtTimestampUsd(
  mint: string,
  timestampSec: number,
): Promise<number | undefined> {
  if (!process.env.BIRDEYE_API_KEY || !process.env.BIRDEYE_API_BASE_URL) {
    return undefined;
  }

  try {
    const endpoint = getBirdeyeEndpoint("/defi/price");
    endpoint.searchParams.set("address", mint);
    endpoint.searchParams.set("address_type", "token");
    endpoint.searchParams.set("time", String(timestampSec));

    const response = await rlFetch(endpoint, {
      method: "GET",
      headers: getBirdeyeHeaders(),
      rlLimiter: birdeyeLimiter,
    });

    if (!response.ok) {
      // TODO: Consider more robust error handling
      return undefined;
    }

    const payload = await validateApiResult(bds_PriceAtTimestampSchema, response);
    if (!payload) {
      // TODO: Consider more robust error handling
      return undefined;
    }

    return extractBirdeyePriceValue(payload);
  } catch {
    // TODO: Consider more robust error handling
    return undefined;
  }
}

async function fetchCoinGeckoPriceAtTimestamp(
  mint: string,
  bucketSec: number,
): Promise<number | undefined> {
  if (!process.env.COINGECKO_API_KEY || !process.env.COINGECKO_API_BASE_URL) {
    return undefined;
  }

  try {
    const cgIdLookup = await getCoinGeckoIdsByAddresses([mint]);
    const cgId = cgIdLookup?.[mint];
    if (!cgId) return undefined;

    const windowSec = 1800;
    const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart/range`);
    cgEndpoint.search = new URLSearchParams({
      vs_currency: "usd",
      from: String(bucketSec - windowSec),
      to: String(bucketSec + windowSec),
    }).toString();

    const response = await rlFetch(cgEndpoint, {
      method: "GET",
      headers: cg.getRequiredHeaders(),
      rlLimiter: cg.limiter,
    });
    if (!response.ok) {
      // TODO: Consider more robust error handling
      return undefined;
    }

    const data = await validateApiResult(cg_TokenMarketChartSchema, response);
    if (!data || data.prices.length == 0) {
      // TODO: Consider more robust error handling
      return undefined;
    }

    const targetMs = bucketSec * 1000;
    const closest = data.prices.reduce((a, b) =>
      Math.abs(a[0] - targetMs) < Math.abs(b[0] - targetMs) ? a : b,
    );
    return closest[1];
  } catch {
    // TODO: Consider more robust error handling
    return undefined;
  }
}

async function queryDbCache(
  mint: string,
  bucketSec: number,
): Promise<number | undefined> {
  const rows = await db
    .select()
    .from(tokenPriceCache)
    .where(
      and(
        eq(tokenPriceCache.mint, mint),
        gte(tokenPriceCache.timestampSec, bucketSec - FIVE_MIN_SEC),
        lte(tokenPriceCache.timestampSec, bucketSec + FIVE_MIN_SEC),
      ),
    )
    .orderBy(
      sql`ABS(${tokenPriceCache.timestampSec} - ${bucketSec})`,
    )
    .limit(1);

  if (rows.length > 0) {
    const price = Number(rows[0].priceUsd);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }
  return undefined;
}

async function storeDbCache(
  mint: string,
  bucketSec: number,
  priceUsd: number,
  source: "birdeye" | "coingecko",
): Promise<void> {
  try {
    await db
      .insert(tokenPriceCache)
      .values({
        mint,
        timestampSec: bucketSec,
        priceUsd,
        source,
      })
      .onConflictDoUpdate({
        target: [tokenPriceCache.mint, tokenPriceCache.timestampSec],
        set: {
          priceUsd: excluded(tokenPriceCache.priceUsd),
          source: excluded(tokenPriceCache.source),
        },
      });
  } catch {
    // Non-critical cache, silently ignore write failures
  }
}

export async function resolveTokenPriceAtTimestamp(
  mint: string,
  timestampSec: number,
): Promise<number | undefined> {
  if (STABLE_MINTS.has(mint)) return 1;
  if (!mint) return undefined;

  const bucket = fiveMinBucketSec(timestampSec);

  // 1. In-memory cache
  const memCached = priceCache.get(cacheKey(mint, bucket));
  if (memCached !== undefined) return memCached;

  // 2. DB cache (within ±5 min tolerance)
  const dbCached = await queryDbCache(mint, bucket);
  if (dbCached !== undefined) {
    priceCache.set(cacheKey(mint, bucket), dbCached);
    return dbCached;
  }

  // 3. Birdeye API
  const birdeyePrice = await fetchBirdeyePriceAtTimestampUsd(mint, timestampSec);
  if (birdeyePrice !== undefined && Number.isFinite(birdeyePrice) && birdeyePrice > 0) {
    priceCache.set(cacheKey(mint, bucket), birdeyePrice);
    await storeDbCache(mint, bucket, birdeyePrice, "birdeye");
    return birdeyePrice;
  }

  // 4. CoinGecko API fallback
  const cgPrice = await fetchCoinGeckoPriceAtTimestamp(mint, bucket);
  if (cgPrice !== undefined && Number.isFinite(cgPrice) && cgPrice > 0) {
    priceCache.set(cacheKey(mint, bucket), cgPrice);
    await storeDbCache(mint, bucket, cgPrice, "coingecko");
    return cgPrice;
  }

  return undefined;
}

export async function resolveTokenPricesAtTimestamp(
  mints: string[],
  timestampSec: number,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const uniqueMints = Array.from(new Set(mints.filter(Boolean)));

  await Promise.all(
    uniqueMints.map(async (mint) => {
      const p = await resolveTokenPriceAtTimestamp(mint, timestampSec);
      if (p !== undefined) prices.set(mint, p);
    }),
  );

  return prices;
}

export function clearPriceCache(): void {
  priceCache.clear();
}
