import { validateApiResult } from "@sv/middlewares/validation.js";
import {
    cmc_SpotPairsLatestSchema,
    cg_TopPoolDataSchema,
    type CG_TopPoolData,
    type CMC_SpotPair,
    type CMC_SpotPairsLatest,
} from "@sv/services/_types/token-raw-responses.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import * as cg from "@sv/util/util-coingecko.js";
import * as cmc from "@sv/util/util-coinmarketcap.js";

const INCLUDE = "base_token,quote_token,dex";
const TARGET_POOL_COUNT = 100;
const MAX_PAGE_ROUNDS = 12;
const MIN_LIQUIDITY_USD = 500;

export type PoolDuration = "5m" | "1h" | "6h" | "24h";
export type PoolTopSort = "volume" | "txns" | "marketCap";

export interface MarketPoolItem {
  id: string;
  poolAddress: string;
  poolName: string;
  dexId: string;
  dexName: string;
  baseAddress: string;
  baseName: string;
  baseSymbol: string;
  baseImageUrl: string | null;
  quoteAddress: string;
  quoteName: string;
  quoteSymbol: string;
  quoteImageUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  txns24h: number | null;
  volume24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  poolCreatedAt: string | null;
}

function toNumber(input: string | number | null | undefined): number | null {
  if (input == null) {
    return null;
  }

  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimIdPrefix(id: string, prefix: string = "solana_"): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

async function fetchCgPools(
  path: string,
  query: Record<string, string>,
): Promise<MarketPoolItem[]> {
  const candidates: MarketPoolItem[] = [];
  const seenPools = new Set<string>();

  for (let page = 1; page <= MAX_PAGE_ROUNDS; page += 1) {
    const cgEndpoint = cg.getOnchainEndpoint(path);
    cgEndpoint.search = new URLSearchParams({
      include: INCLUDE,
      page: String(page),
      ...query,
    }).toString();

    const resp = await rlFetch(cgEndpoint, {
      method: "GET",
      headers: cg.getRequiredHeaders(),
      rlLimiter: cg.limiter,
    });

    if (!resp.ok) {
      console.error(
        `FetchPools: Error ${resp.status} for URL: ${cgEndpoint.toString()}`,
      );
      break;
    }

    const res = await validateApiResult(cg_TopPoolDataSchema, resp);
    if (!res) {
      // TODO: Consider more robust error handling
      break;
    }
    const pageItems = mapCgPools(res);

    if (pageItems.length == 0) {
      // Log for debugging empty responses
      console.warn(
        `FetchPools: Page ${page} returned 0 items for URL: ${cgEndpoint.toString()}`,
      );
      // Don't break immediately on page 1, try a few more if it's a list fetch
      if (page > 3) break;
      continue;
    }

    for (const item of pageItems) {
      if (seenPools.has(item.poolAddress)) {
        continue;
      }

      seenPools.add(item.poolAddress);
      candidates.push(item);
    }

    if (candidates.length >= TARGET_POOL_COUNT * 3) {
      break;
    }
  }

  if (candidates.length == 0) {
    return [];
  }

  // The list endpoints (trending, pools, top) already return the full pool data
  // (volume, liquidity, price changes, etc.) so we don't need to enrich them again.
  return candidates.slice(0, TARGET_POOL_COUNT);
}

function mapCgPools(res: CG_TopPoolData): MarketPoolItem[] {
  const tokenLookup = new Map<
    string,
    { address: string; name: string; symbol: string; imageUrl: string | null }
  >();
  const dexLookup = new Map<string, { name: string }>();

  for (const item of res.included ?? []) {
    if (item.type == "token") {
      tokenLookup.set(item.id, {
        address: item.attributes.address ?? "",
        name: item.attributes.name,
        symbol: item.attributes.symbol ?? "",
        imageUrl: item.attributes.image_url ?? null,
      });
      continue;
    }

    if (item.type == "dex") {
      dexLookup.set(item.id, {
        name: item.attributes.name,
      });
    }
  }

  return res.data.map((pool) => {
    const baseTokenId = pool.relationships.base_token.data.id;
    const quoteTokenId = pool.relationships.quote_token.data.id;
    const dexId = pool.relationships.dex.data.id;

    const baseToken = tokenLookup.get(baseTokenId);
    const quoteToken = tokenLookup.get(quoteTokenId);
    const dex = dexLookup.get(dexId);

    const buys24h = pool.attributes.transactions?.h24?.buys ?? 0;
    const sells24h = pool.attributes.transactions?.h24?.sells ?? 0;

    return {
      id: pool.id,
      poolAddress: pool.attributes.address,
      poolName: pool.attributes.name,
      dexId,
      dexName: dex?.name ?? dexId,
      baseAddress: baseToken?.address || trimIdPrefix(baseTokenId),
      baseName: baseToken?.name ?? "",
      baseSymbol: baseToken?.symbol ?? "",
      baseImageUrl: baseToken?.imageUrl ?? null,
      quoteAddress: quoteToken?.address || trimIdPrefix(quoteTokenId),
      quoteName: quoteToken?.name ?? "",
      quoteSymbol: quoteToken?.symbol ?? "",
      quoteImageUrl: quoteToken?.imageUrl ?? null,
      priceUsd: toNumber(pool.attributes.base_token_price_usd),
      marketCapUsd: toNumber(
        pool.attributes.market_cap_usd && pool.attributes.market_cap_usd !== "0"
          ? pool.attributes.market_cap_usd
          : pool.attributes.fdv_usd,
      ),
      fdvUsd: toNumber(pool.attributes.fdv_usd),
      txns24h: buys24h + sells24h,
      volume24h: toNumber(pool.attributes.volume_usd?.h24),
      priceChange5m: toNumber(pool.attributes.price_change_percentage?.m5),
      priceChange1h: toNumber(pool.attributes.price_change_percentage?.h1),
      priceChange6h: toNumber(pool.attributes.price_change_percentage?.h6),
      priceChange24h: toNumber(pool.attributes.price_change_percentage?.h24),
      liquidityUsd: toNumber(pool.attributes.reserve_in_usd),
      poolCreatedAt: pool.attributes.pool_created_at ?? null,
    };
  });
}

export async function getTrendingMarketPools(duration: PoolDuration) {
  const result = await fetchCgPools("/networks/solana/trending_pools", {
    duration,
  });

  if (result.length > 0 || duration == "5m") {
    return result;
  }

  // Fallback for demo-tier data sparsity on longer durations.
  return await fetchCgPools("/networks/solana/trending_pools", {
    duration: "5m",
  });
}

export async function getNewMarketPools() {
  // Với New Pools, chúng ta chỉ cần fetch 2 trang đầu (40 pools) để đảm bảo độ tươi (freshness)
  // và tránh việc lấy quá nhiều dữ liệu cũ từ các trang sau.
  const cgEndpoint = cg.getOnchainEndpoint("/networks/solana/new_pools");
  const allResults: MarketPoolItem[] = [];

  for (let page = 1; page <= 2; page++) {
    cgEndpoint.search = new URLSearchParams({
      include: INCLUDE,
      page: String(page),
    }).toString();

    const resp = await rlFetch(cgEndpoint, {
      method: "GET",
      headers: cg.getRequiredHeaders(),
      rlLimiter: cg.limiter,
    });

    if (resp.ok) {
      const res = await validateApiResult(cg_TopPoolDataSchema, resp);
      if (res) {
        allResults.push(...mapCgPools(res));
      }
    } else {
      break;
    }
  }

  // Ép sắp xếp theo thời gian tạo mới nhất lên đầu (Newest First)
  return allResults.sort((a, b) => {
    const timeA = a.poolCreatedAt ? new Date(a.poolCreatedAt).getTime() : 0;
    const timeB = b.poolCreatedAt ? new Date(b.poolCreatedAt).getTime() : 0;
    return timeB - timeA;
  });
}

export async function getTopMarketPools(sortBy: PoolTopSort) {
  const sortCandidates: Record<PoolTopSort, string[]> = {
    volume: ["h24_volume_usd_desc"],
    txns: ["h24_tx_count_desc", "tx_count_desc", "h24_txns_desc"],
    marketCap: ["market_cap_usd_desc"],
  };

  for (const sort of sortCandidates[sortBy]) {
    const result = await fetchCgPools("/networks/solana/pools", { sort });

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

// CoinMarketCap – Top Gainers
function getCmcSpotPairRows(payload: CMC_SpotPairsLatest) {
  return Array.isArray(payload) ? payload : payload.data;
}

function mapCmcSpotPairs(pairs: CMC_SpotPair[]): MarketPoolItem[] {
  return pairs.map((pair) => {
    const quote = pair.quote?.[0];
    const poolCreatedAt = pair.pool_created ?? pair.created_at ?? null;

    return {
      id: pair.contract_address,
      poolAddress: pair.contract_address,
      poolName: pair.name,
      dexId: String(pair.dex_id ?? pair.dex_slug ?? ""),
      dexName: pair.dex_slug ?? String(pair.dex_id ?? ""),
      baseAddress:
        pair.base_asset_contract_address ?? String(pair.base_asset_id ?? ""),
      baseName: pair.base_asset_name ?? "",
      baseSymbol: pair.base_asset_symbol ?? "",
      baseImageUrl: null,
      quoteAddress:
        pair.quote_asset_contract_address ?? String(pair.quote_asset_id ?? ""),
      quoteName: pair.quote_asset_name ?? "",
      quoteSymbol: pair.quote_asset_symbol ?? "",
      quoteImageUrl: null,
      priceUsd: toNumber(quote?.price),
      marketCapUsd: null,
      fdvUsd: toNumber(quote?.fully_diluted_value),
      txns24h: toNumber(pair.num_transactions_24h),
      volume24h: toNumber(quote?.volume_24h),
      priceChange5m: null,
      priceChange1h: toNumber(quote?.percent_change_price_1h),
      priceChange6h: null,
      priceChange24h: toNumber(quote?.percent_change_price_24h),
      liquidityUsd: toNumber(quote?.liquidity),
      poolCreatedAt,
    };
  });
}

async function fetchCmcTopGainerMarketPools(): Promise<MarketPoolItem[]> {
  const endpoint = cmc.getEndpoint("/v4/dex/spot-pairs/latest");
  endpoint.search = new URLSearchParams({
    network_slug: "solana",
    limit: String(TARGET_POOL_COUNT),
    sort: "percent_change_24h",
    sort_dir: "desc",
    aux: [
      "pool_created",
      "num_transactions_24h",
      "24h_no_of_buys",
      "24h_no_of_sells",
      "24h_buy_volume",
      "24h_sell_volume",
    ].join(","),
  }).toString();

  const resp = await rlFetch(endpoint, {
    method: "GET",
    headers: cmc.getRequiredHeaders(),
    rlLimiter: cmc.limiter,
  });

  if (!resp.ok) {
    throw new Error(
      `CoinMarketCap top gainers request failed: ${resp.status}`,
    );
  }

  const payload = await validateApiResult(cmc_SpotPairsLatestSchema, resp);
  if (!payload) {
    throw new Error("CoinMarketCap top gainers response validation failed");
  }

  const seen = new Set<string>();
  return mapCmcSpotPairs(getCmcSpotPairRows(payload))
    .filter((pool) => {
      if (!pool.poolAddress || seen.has(pool.poolAddress)) {
        return false;
      }
      seen.add(pool.poolAddress);
      return true;
    })
    .sort((a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0));
}

export async function getTopGainerMarketPools(): Promise<MarketPoolItem[]> {
  const cmcPools = await fetchCmcTopGainerMarketPools();
  return cmcPools;
}
