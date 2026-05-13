import {
  getEndpoint as getBirdeyeEndpoint,
  getRequiredHeaders as getBirdeyeHeaders,
} from "@sv/util/util-birdeye.js";

const STABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4h4H8o3A8rM6jD5M3j6Q", // USDT
  "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA", // USDS
  "2b1kV6DkP7d3xERf9jR7WvyaManEXZDV4SSQSSHqzTe", // PYUSD
]);

type PriceCacheKey = `${string}:${number}`;

function cacheKey(mint: string, bucketSec: number): PriceCacheKey {
  return `${mint}:${bucketSec}` as PriceCacheKey;
}

function fiveMinBucketSec(timestampSec: number): number {
  return Math.floor(timestampSec / 300) * 300;
}

const priceCache = new Map<PriceCacheKey, number>();

function extractBirdeyePriceValue(payload: unknown): number | undefined {
  const root = payload as {
    success?: boolean;
    data?: { value?: number; price?: number };
  };

  const candidates = [
    Number(root?.data?.value ?? 0),
    Number(root?.data?.price ?? 0),
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

    const response = await fetch(endpoint, {
      method: "GET",
      headers: getBirdeyeHeaders(),
    });

    if (!response.ok) return undefined;

    const payload = (await response.json()) as unknown;
    return extractBirdeyePriceValue(payload);
  } catch {
    return undefined;
  }
}

export async function resolveTokenPriceAtTimestamp(
  mint: string,
  timestampSec: number,
): Promise<number | undefined> {
  if (STABLE_MINTS.has(mint)) return 1;
  if (!mint) return undefined;

  const bucket = fiveMinBucketSec(timestampSec);
  const cached = priceCache.get(cacheKey(mint, bucket));
  if (cached !== undefined) return cached;

  const price = await fetchBirdeyePriceAtTimestampUsd(mint, timestampSec);
  if (price !== undefined && Number.isFinite(price) && price > 0) {
    priceCache.set(cacheKey(mint, bucket), price);
    return price;
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
