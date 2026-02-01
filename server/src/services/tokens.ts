import {
  CG_TOKEN_LIST_TTL_MS,
  TOKEN_CHART_24H_UPDATE_THRESHOLD,
  TOKEN_MARKET_DATA_TTL_MS,
  TOKEN_META_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  coinGeckoTokenList,
  coinGeckoTokenListMeta,
  tokenMarketChart24h,
  tokenMarketData,
  tokenMeta,
  type CoingeckoTokenListInsert,
  type TokenMarketChart24hInsert,
  type TokenMarketDataInsert,
  type TokenMetaInsert,
} from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

interface CG_Token {
  id: string;
  name: string;
  symbol: string;
  platforms: { solana?: string };
}

interface CG_TokenMeta {
  platforms: {
    solana: string;
  };
  name: string;
  description?: {
    en?: string;
  };
  symbol: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
}

interface CG_TokenMarketData {
  id: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  // These fields only available if price_percentage_change is set accordingly
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_24h_in_currency: number;
  price_change_percentage_14d_in_currency: number;
  price_change_percentage_30d_in_currency: number;
  price_change_percentage_200d_in_currency: number;
  price_change_percentage_1y_in_currency: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_date: string;
  ath_change_percentage: number;
  atl: number;
  atl_date: string;
  atl_change_percentage: number;
}

interface CG_TokenMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

async function getCoinGeckoIdList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  // Check freshness of data (for CG token list we update all entries at once)
  const freshCheck = await db
    .select({
      lastRefresh: coinGeckoTokenListMeta.lastRefresh,
    })
    .from(coinGeckoTokenListMeta)
    .limit(1);

  const thresholdDate = new Date(Date.now() - CG_TOKEN_LIST_TTL_MS);

  if (freshCheck.length == 0 || freshCheck[0].lastRefresh < thresholdDate) {
    // Pull new data and conveniently get the required results
    const idLookup = await fetchCgTokenList(tokenAddresses);
    // Update last refresh time
    await db.update(coinGeckoTokenListMeta).set({
      lastRefresh: new Date(),
    });
    return idLookup;
  } else {
    // In TTL, query with what we already had
    const res = await db
      .select({
        id: coinGeckoTokenList.coinGeckoId,
        address: coinGeckoTokenList.tokenAddress,
      })
      .from(coinGeckoTokenList)
      .where(inArray(coinGeckoTokenList.tokenAddress, tokenAddresses))
      .limit(tokenAddresses.length);
    const idLookup = Object.fromEntries(
      res.map(({ id, address }) => [address, id]),
    );
    return idLookup;
  }
}

async function fetchTokenMetaList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const idLookup =
    (await getCoinGeckoIdList(tokenAddresses)) ??
    (await fetchCgTokenList(tokenAddresses));

  if (!idLookup) {
    return null;
  }

  const rawMetaList = await Promise.all(
    Object.values(idLookup)
      .filter((id) => id != null)
      .map(async (id) => {
        const cgEndpoint = cg.getEndpoint(`/coins/${id}`);
        const req = new Request(cgEndpoint, {
          method: "GET",
          headers: cg.getRequiredHeaders(),
        });

        const resp = await fetch(req);
        if (resp.ok) {
          const rawMeta: CG_TokenMeta = await resp.json();
          return rawMeta;
        } else {
          return null;
        }
      }),
  );

  const metaDataList = rawMetaList
    .filter((rawMeta) => rawMeta != null)
    .map(
      (rawMeta): TokenMetaInsert => ({
        address: rawMeta.platforms.solana,
        symbol: rawMeta.symbol,
        name: rawMeta.name,
        description: rawMeta.description?.en || null,
        imageUrl: rawMeta.image.small,
      }),
    );

  return await db
    .insert(tokenMeta)
    .values(metaDataList)
    .onConflictDoUpdate({
      target: [tokenMeta.address],
      set: {
        name: excluded(tokenMeta.name),
        symbol: excluded(tokenMeta.symbol),
        imageUrl: excluded(tokenMeta.imageUrl),
      },
    })
    .returning();
}

export async function getTokenMetaList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const thresholdDate = new Date(Date.now() - TOKEN_META_TTL_MS);

  const res = await db
    .select()
    .from(tokenMeta)
    .where(
      and(
        gte(tokenMeta.updatedAt, thresholdDate),
        inArray(tokenMeta.address, tokenAddresses),
      ),
    )
    .limit(tokenAddresses.length);

  const metaDataLookup = Object.fromEntries(
    res.map((meta) => [meta.address, meta]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !metaDataLookup[address],
  );

  const refreshed = await fetchTokenMetaList(staleAddresses);

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}

async function fetchCgTokenList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const cgEndpoint = cg.getEndpoint("/coins/list");
  cgEndpoint.search = new URLSearchParams({
    include_platform: "true",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (resp.ok) {
    const res: CG_Token[] = await resp.json();
    const solanaTokens = res
      .filter((rawToken) => rawToken.platforms.solana)
      .map(
        (rawToken): CoingeckoTokenListInsert => ({
          coinGeckoId: rawToken.id,
          tokenAddress: rawToken.platforms.solana!,
        }),
      );

    const idLookup = Object.fromEntries(
      solanaTokens
        .filter((t) => tokenAddresses.includes(t.tokenAddress))
        .map(({ coinGeckoId, tokenAddress }) => [tokenAddress, coinGeckoId]),
    );

    await db
      .insert(coinGeckoTokenList)
      .values(solanaTokens)
      .onConflictDoUpdate({
        target: [coinGeckoTokenList.tokenAddress],
        set: { coinGeckoId: excluded(coinGeckoTokenList.coinGeckoId) },
      });

    return idLookup;
  } else {
    return null;
  }
}

export async function getTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const thresholdDate = new Date(Date.now() - TOKEN_MARKET_DATA_TTL_MS);
  const res = await db
    .select()
    .from(tokenMarketData)
    .where(
      and(
        gte(tokenMarketData.updatedAt, thresholdDate),
        inArray(tokenMarketData.address, tokenAddresses),
      ),
    )
    .limit(tokenAddresses.length);

  const marketDataLookup = Object.fromEntries(
    res.map((marketData) => [marketData.address, marketData]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !marketDataLookup[address],
  );
  const refreshed = await fetchTokenMarketData(staleAddresses);

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}

async function fetchTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const idLookup =
    (await getCoinGeckoIdList(tokenAddresses)) ??
    (await fetchCgTokenList(tokenAddresses));

  if (!idLookup) {
    return null;
  }

  const cgEndpoint = cg.getEndpoint(`/coins/markets`);

  cgEndpoint.search = new URLSearchParams({
    ids: Object.values(idLookup)
      .filter((id) => id != null)
      .join(","),
    vs_currency: "usd",
    order: "market_cap_desc",
    price_change_percentage: "1h,24h,14d,30d,200d,1y",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });
  const resp = await fetch(req);

  if (resp.ok) {
    const res: CG_TokenMarketData[] = await resp.json();

    const addressLookup = Object.fromEntries(
      Object.entries(idLookup)
        .filter(([, id]) => id != null)
        .map(([address, id]) => [id, address]),
    );

    console.log(res);
    const marketDataList = res
      .filter((rawMarketData) => rawMarketData.market_cap_rank != null)
      .map(
      (rawMarketData): TokenMarketDataInsert => ({
        address: addressLookup[rawMarketData.id],
        priceUsd: rawMarketData.current_price,
        marketCap: rawMarketData.market_cap,
        marketCapRank: rawMarketData.market_cap_rank,
        fullyDilutedValuation: rawMarketData.fully_diluted_valuation,
        volume24h: rawMarketData.total_volume,
        high24h: rawMarketData.high_24h,
        low24h: rawMarketData.low_24h,
        priceChange24h: rawMarketData.price_change_24h,
        priceChangePercentage1h:
          rawMarketData.price_change_percentage_1h_in_currency,
        priceChangePercentage24h:
          rawMarketData.price_change_percentage_24h_in_currency,
        priceChangePercentage14d:
          rawMarketData.price_change_percentage_14d_in_currency,
        priceChangePercentage30d:
          rawMarketData.price_change_percentage_30d_in_currency,
        priceChangePercentage200d:
          rawMarketData.price_change_percentage_200d_in_currency,
        priceChangePercentage1y:
          rawMarketData.price_change_percentage_1y_in_currency,
        marketCapChange24h: rawMarketData.market_cap_change_24h,
        marketCapChangePercentage24h:
          rawMarketData.market_cap_change_percentage_24h,
        circulatingSupply: rawMarketData.circulating_supply,
        totalSupply: rawMarketData.total_supply,
        maxSupply: rawMarketData.max_supply,
        ath: rawMarketData.ath,
        athDate: new Date(rawMarketData.ath_date),
        athChangePercentage: rawMarketData.ath_change_percentage,
        atl: rawMarketData.atl,
        atlDate: new Date(rawMarketData.ath_date),
        atlChangePercentage: rawMarketData.atl_change_percentage,
      }),
    );

    return await db
      .insert(tokenMarketData)
      .values(marketDataList)
      .onConflictDoUpdate({
        target: [tokenMarketData.address],
        set: {
          // Had to type all the fields here since unfortunately that is how Postgres works
          priceUsd: excluded(tokenMarketData.priceUsd),
          marketCap: excluded(tokenMarketData.marketCap),
          marketCapRank: excluded(tokenMarketData.marketCapRank),
          fullyDilutedValuation: excluded(
            tokenMarketData.fullyDilutedValuation,
          ),
          volume24h: excluded(tokenMarketData.volume24h),
          high24h: excluded(tokenMarketData.high24h),
          low24h: excluded(tokenMarketData.low24h),
          priceChange24h: excluded(tokenMarketData.priceChange24h),
          priceChangePercentage1h: excluded(
            tokenMarketData.priceChangePercentage1h,
          ),
          priceChangePercentage24h: excluded(
            tokenMarketData.priceChangePercentage24h,
          ),
          priceChangePercentage14d: excluded(
            tokenMarketData.priceChangePercentage14d,
          ),
          priceChangePercentage30d: excluded(
            tokenMarketData.priceChangePercentage30d,
          ),
          priceChangePercentage200d: excluded(
            tokenMarketData.priceChangePercentage200d,
          ),
          priceChangePercentage1y: excluded(
            tokenMarketData.priceChangePercentage1y,
          ),
          marketCapChange24h: excluded(tokenMarketData.marketCapChange24h),
          marketCapChangePercentage24h: excluded(
            tokenMarketData.marketCapChangePercentage24h,
          ),
          circulatingSupply: excluded(tokenMarketData.circulatingSupply),
          totalSupply: excluded(tokenMarketData.totalSupply),
          maxSupply: excluded(tokenMarketData.maxSupply),
          ath: excluded(tokenMarketData.ath),
          athChangePercentage: excluded(tokenMarketData.athChangePercentage),
          atl: excluded(tokenMarketData.atl),
          atlChangePercentage: excluded(tokenMarketData.atlChangePercentage),
        },
      })
      .returning();
  }
  return null;
}

export async function get24hTokenMarketChart(tokenAddress: string) {
  const to = new Date().getTime();
  const from = to - 86_400_000;

  const chartData = await db
    .select()
    .from(tokenMarketChart24h)
    .where(
      and(
        eq(tokenMarketChart24h.address, tokenAddress),
        gte(tokenMarketChart24h.unixTimestampMs, from),
        lte(tokenMarketChart24h.unixTimestampMs, to),
      ),
    );

  if (chartData.length == 0) {
    return fetch24hTokenMarketChart(tokenAddress);
  }

  const latestUpdate = chartData[chartData.length - 1].unixTimestampMs;
  const isStale =
    new Date().getTime() - latestUpdate > TOKEN_CHART_24H_UPDATE_THRESHOLD;

  if (isStale) {
    const newerChartData = await fetch24hTokenMarketChart(
      tokenAddress,
      latestUpdate,
    );

    if (newerChartData) {
      return [...chartData, ...newerChartData];
    }
  }

  return chartData;
}

export async function fetch24hTokenMarketChart(
  tokenAddress: string,
  latestUpdateUnixMs: number | null = null,
) {
  if (!tokenAddress) {
    return [];
  }

  const cgIdLookup = await getCoinGeckoIdList([tokenAddress]);
  const cgId = cgIdLookup ? cgIdLookup[tokenAddress] : null;

  if (!cgId) {
    return [];
  }

  const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart/range`);

  const to = new Date().getTime();
  let from = to - 86_400_000;

  // If possible just load from the latest availale data.
  // It won't save an API call but may increase query speed (I guess)
  if (latestUpdateUnixMs && from < latestUpdateUnixMs) {
    from = latestUpdateUnixMs;
  }

  // "from" and "to" can either be in seconds or miliseconds.
  // Using miliseconds here
  cgEndpoint.search = new URLSearchParams({
    vs_currency: "usd",
    from: from.toString(),
    to: to.toString(),
  }).toString();
  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (resp.ok) {
    const res: CG_TokenMarketChart = await resp.json();
    const chartDataPoints = res.prices.map(
      ([timestamp, price], index): TokenMarketChart24hInsert => ({
        address: tokenAddress,
        unixTimestampMs: timestamp,
        price: price,
        marketCap: res.market_caps[index][1],
        totalVolume: res.total_volumes[index][1],
      }),
    );
    const chartData = await db
      .insert(tokenMarketChart24h)
      .values(chartDataPoints)
      .onConflictDoUpdate({
        target: [
          tokenMarketChart24h.address,
          tokenMarketChart24h.unixTimestampMs,
        ],
        set: {
          price: excluded(tokenMarketChart24h.price),
          marketCap: excluded(tokenMarketChart24h.marketCap),
          totalVolume: excluded(tokenMarketChart24h.totalVolume),
        },
      })
      .returning();

    return chartData;
  }

  return [];
}
