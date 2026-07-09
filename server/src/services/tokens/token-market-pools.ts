import { trackedFetch } from "@sv/services/tracking/apiCallTracker.service.js";
import * as cg from "@sv/util/util-coingecko.js";
import type { CG_TopPoolData } from "../_types/token-raw-responses.js";

const INCLUDE = "base_token,quote_token,dex";
const TARGET_POOL_COUNT = 100;
const MAX_PAGE_ROUNDS = 12;
// Pool phải có liquidity tối thiểu để lọc bỏ meme pool rác không có thanh khoản

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

type ValidationCacheEntry = {
  exists: boolean;
  checkedAt: number;
};

const poolValidationCache = new Map<string, ValidationCacheEntry>();

/** Xóa toàn bộ cache validation — dùng khi cần force refresh data */
export function clearPoolValidationCache(): void {
  poolValidationCache.clear();
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

async function fetchPools(
  path: string,
  query: Record<string, string>,
  functionName: string,
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

    const resp = await trackedFetch({
      provider: "unknown",
      url: cgEndpoint,
      init: {
        method: "GET",
        headers: cg.getRequiredHeaders(),
      },
      serviceFile: "server/src/services/tokens/token-market-pools.ts",
      functionName,
    });

    if (!resp.ok) {
      console.error(`[fetchPools] Error ${resp.status} for URL: ${cgEndpoint.toString()}`);
      break;
    }

    const res = (await resp.json()) as CG_TopPoolData;
    const pageItems = mapPools(res);
    
    if (pageItems.length === 0) {
      // Log for debugging empty responses
      console.warn(`[fetchPools] Warning: Page ${page} returned 0 items for URL: ${cgEndpoint.toString()}`);
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

  if (candidates.length === 0) {
    return [];
  }

  // The list endpoints (trending, pools, top) already return the full pool data
  // (volume, liquidity, price changes, etc.) so we don't need to enrich them again.
  return candidates.slice(0, TARGET_POOL_COUNT);
}

function mapPools(res: CG_TopPoolData): MarketPoolItem[] {

  const tokenLookup = new Map<
    string,
    { address: string; name: string; symbol: string; imageUrl: string | null }
  >();
  const dexLookup = new Map<string, { name: string }>();

  for (const item of res.included ?? []) {
    if (item.type === "token") {
      tokenLookup.set(item.id, {
        address: item.attributes.address ?? "",
        name: item.attributes.name,
        symbol: item.attributes.symbol ?? "",
        imageUrl: item.attributes.image_url ?? null,
      });
      continue;
    }

    if (item.type === "dex") {
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
      marketCapUsd: toNumber(pool.attributes.market_cap_usd && pool.attributes.market_cap_usd !== "0" 
        ? pool.attributes.market_cap_usd 
        : (pool.attributes as any).fdv_usd),
      fdvUsd: toNumber((pool.attributes as any).fdv_usd),
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

async function fetchMultiPoolsFromCoinGecko(
  addresses: string[],
  functionName: string,
): Promise<MarketPoolItem[]> {
  if (addresses.length === 0) return [];
  const result: MarketPoolItem[] = [];

  // CoinGecko allows max 30 addresses per multi-pool request
  for (let i = 0; i < addresses.length; i += 30) {
    const chunk = addresses.slice(i, i + 30);
    const endpoint = cg.getOnchainEndpoint(
      `/networks/solana/pools/multi/${chunk.join(",")}`,
    );
    endpoint.search = new URLSearchParams({
      include: INCLUDE,
    }).toString();

    const resp = await trackedFetch({
      provider: "unknown",
      url: endpoint,
      init: {
        method: "GET",
        headers: cg.getRequiredHeaders(),
      },
      serviceFile: "server/src/services/tokens/token-market-pools.ts",
      functionName,
    });

    if (resp.ok) {
      const payload = (await resp.json()) as CG_TopPoolData;
      result.push(...mapPools(payload));
    }
  }

  return result;
}

/** Lấy data chi tiết cho 1 pool duy nhất - ổn định nhất cho pool mới */
async function fetchSinglePoolFromCoinGecko(
  poolAddress: string,
  functionName: string,
): Promise<MarketPoolItem | null> {
  const endpoint = cg.getOnchainEndpoint(`/networks/solana/pools/${poolAddress}`);
  endpoint.search = new URLSearchParams({ include: INCLUDE }).toString();

  const resp = await trackedFetch({
    provider: "unknown",
    url: endpoint,
    init: {
      method: "GET",
      headers: cg.getRequiredHeaders(),
    },
    serviceFile: "server/src/services/tokens/token-market-pools.ts",
    functionName: `${functionName}:fetchSingle`,
  });

  if (!resp.ok) return null;

  try {
    const payload = await resp.json() as any;
    // API single pool trả về { data: { id, attributes... } }
    // Chúng ta wrap vào mảng để dùng chung hàm mapPools
    const results = mapPools({
      data: [payload.data],
      included: payload.included
    } as any);
    return results[0] || null;
  } catch {
    return null;
  }
}

export async function getTrendingMarketPools(duration: PoolDuration) {
  const result = await fetchPools(
    "/networks/solana/trending_pools",
    { duration },
    "getTrendingMarketPools",
  );

  if (result.length > 0 || duration === "5m") {
    return result;
  }

  // Fallback for demo-tier data sparsity on longer durations.
  return await fetchPools(
    "/networks/solana/trending_pools",
    { duration: "5m" },
    "getTrendingMarketPools:fallback5m",
  );
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

    const resp = await trackedFetch({
      provider: "unknown",
      url: cgEndpoint,
      init: {
        method: "GET",
        headers: cg.getRequiredHeaders(),
      },
      serviceFile: "server/src/services/tokens/token-market-pools.ts",
      functionName: "getNewMarketPools",
    });

    if (resp.ok) {
      const res = (await resp.json()) as CG_TopPoolData;
      allResults.push(...mapPools(res));
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
    const result = await fetchPools(
      "/networks/solana/pools",
      { sort },
      `getTopMarketPools:${sortBy}:${sort}`,
    );

    if (result.length > 0) {
      return result;
    }
  }

  return [];
}

// ─── DexPaprika – Top Gainers ────────────────────────────────────────────────

const DEXPAPRIKA_BASE = "https://api.dexpaprika.com";

interface DexPaprikaToken {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  has_image: boolean;
  fdv?: number;
}

interface DexPaprikaPool {
  id: string;
  dex_id: string;
  dex_name: string;
  chain: string;
  volume_usd: number;
  created_at: string;
  transactions: number;
  price_usd: number;
  last_price_change_usd_5m: number | null;
  last_price_change_usd_1h: number | null;
  last_price_change_usd_24h: number | null;
  tokens: DexPaprikaToken[];
}

interface DexPaprikaPoolsResponse {
  pools: DexPaprikaPool[];
  page_info: {
    limit: number;
    page: number;
    total_items: number;
    total_pages: number;
  };
}

function getDexPaprikaImageUrl(tokenId: string, hasImage: boolean): string | null {
  if (!hasImage) return null;
  return `https://assets.dexpaprika.com/tokens/solana/${tokenId}/logo.png`;
}

function mapDexPaprikaPools(pools: DexPaprikaPool[]): MarketPoolItem[] {
  return pools.map((pool) => {
    const baseToken = pool.tokens[0];
    const quoteToken = pool.tokens[1];

    return {
      id: pool.id,
      poolAddress: pool.id,
      poolName: baseToken
        ? `${baseToken.symbol}/${quoteToken?.symbol ?? "???"}`
        : pool.id,
      dexId: pool.dex_id,
      dexName: pool.dex_name,
      baseAddress: baseToken?.id ?? "",
      baseName: baseToken?.name ?? "",
      baseSymbol: baseToken?.symbol ?? "",
      baseImageUrl: baseToken
        ? getDexPaprikaImageUrl(baseToken.id, baseToken.has_image)
        : null,
      quoteAddress: quoteToken?.id ?? "",
      quoteName: quoteToken?.name ?? "",
      quoteSymbol: quoteToken?.symbol ?? "",
      quoteImageUrl: quoteToken 
        ? getDexPaprikaImageUrl(quoteToken.id, quoteToken.has_image)
        : null,
      priceUsd: toNumber(pool.price_usd),
      marketCapUsd: toNumber(baseToken?.fdv),
      fdvUsd: toNumber(baseToken?.fdv),
      txns24h: toNumber(pool.transactions),
      volume24h: toNumber(pool.volume_usd),
      priceChange5m: null, // USD delta, not %, needs CoinGecko enrichment
      priceChange1h: null, // USD delta, not %, needs CoinGecko enrichment
      priceChange6h: null,
      priceChange24h: null, // USD delta, not %, needs CoinGecko enrichment
      liquidityUsd: null, // DexPaprika list không trả về liquidity (phải lấy từ CoinGecko)
      poolCreatedAt: pool.created_at ?? null,
    };
  });
}

async function fetchDexPaprikaGainers(
  limit: number = 100,
  pages: number = 1,
): Promise<MarketPoolItem[]> {
  const allPools: DexPaprikaPool[] = [];

  for (let page = 0; page < pages; page++) {
    const url = new URL(`${DEXPAPRIKA_BASE}/networks/solana/pools`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "desc");
    url.searchParams.set("order_by", "last_price_change_usd_24h");

    const resp = await trackedFetch({
      provider: "dexpaprika",
      url,
      init: { method: "GET" },
      serviceFile: "server/src/services/tokens/token-market-pools.ts",
      functionName: "fetchDexPaprikaGainers",
    });

    if (!resp.ok) {
      console.error(
        `[DexPaprika] fetchDexPaprikaGainers page ${page} failed: ${resp.status}`,
      );
      break;
    }

    const data = (await resp.json()) as DexPaprikaPoolsResponse;
    if (!data.pools || data.pools.length === 0) break;

    allPools.push(...data.pools);
  }

  // Map raw DexPaprika pools thành MarketPoolItem (dùng pool.id làm address)
  return mapDexPaprikaPools(allPools);
}

export async function getTopGainerMarketPools(): Promise<MarketPoolItem[]> {
  try {
    // Bước 1: Lấy 150 địa chỉ pool từ DexPaprika (discovery)
    const candidates = await fetchDexPaprikaGainers(150, 1);

    if (candidates.length > 0) {
      // Ưu tiên 10 cái đầu tiên dùng API Detail đơn lẻ (chính xác nhất)
      const topPriority = candidates.slice(0, 10);
      const others = candidates.slice(10);
      
      const enriched: MarketPoolItem[] = [];
      
      // Fetch 10 cái ưu tiên (batch of 5)
      for (let i = 0; i < topPriority.length; i += 5) {
        const chunk = topPriority.slice(i, i + 5);
        const results = await Promise.all(
          chunk.map(p => fetchSinglePoolFromCoinGecko(p.poolAddress, "getTopGainerMarketPools:priority"))
        );
        for (let j = 0; j < results.length; j++) { enriched.push(results[j] ?? chunk[j]); }
      }

      // Còn lại dùng MULTI-POOL endpoint (30 address/request) để lấy sll cho nhanh
      const otherAddresses = others.map(p => p.poolAddress);
      if (otherAddresses.length > 0) {
        const otherEnriched = await fetchMultiPoolsFromCoinGecko(
          otherAddresses,
          "getTopGainerMarketPools:others"
        );
        const cgMap = new Map<string, MarketPoolItem>(); for (const p of otherEnriched) cgMap.set(p.poolAddress, p); for (const original of others) { enriched.push(cgMap.get(original.poolAddress) ?? original); }
      }

      // Xóa trùng nếu có (đề phòng)
      const seen = new Set<string>();
      const final = enriched.filter(p => {
        if (seen.has(p.poolAddress)) return false;
        seen.add(p.poolAddress);
        return true;
      });

      // CoinGecko-enriched (real % change) lên đầu; DexPaprika-only giữ nguyên thứ tự discovery
      return final.sort((a, b) => {
        const aHas = a.priceChange24h != null;
        const bHas = b.priceChange24h != null;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0);
      });
    }
  } catch (err) {
    console.error("[DexPaprika] getTopGainerMarketPools failed:", err);
  }

  // Fallback
  return fetchPools(
    "/networks/solana/pools",
    { sort: "h24_price_change_percentage_desc" },
    "getTopGainerMarketPools:fallback"
  );
}
