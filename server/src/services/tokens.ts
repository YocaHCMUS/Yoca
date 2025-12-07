import {
  CG_TOKEN_LIST_TTL_MS,
  TOKEN_MARKET_DATA_TTL_MS,
  TOKEN_META_TTL_MS,
} from "@/config/constants.js";
import { db } from "@/db/index.js";
import {
  coinGeckoTokenList,
  tableMeta,
  tokenMarketData,
  tokenMeta,
  type TokenMarketDataInsert,
} from "@/db/schema.js";
import { excluded } from "@/util/orm-sql.js";
import * as cg from "@/util/util-coingecko.js";
import { and, eq, getTableName, gte, inArray } from "drizzle-orm";

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
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  atl: number;
  atl_change_percentage: number;
}

async function getCoinGeckoIdList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  // Check freshness of data (for CG token list we update all entries at once)
  const freshCheck = await db
    .select({
      lastRefresh: tableMeta.lastRefresh,
    })
    .from(tableMeta)
    .where(eq(tableMeta.tableName, getTableName(tokenMeta)))
    .limit(1);

  const thresholdDate = new Date(Date.now() - CG_TOKEN_LIST_TTL_MS);

  if (freshCheck.length == 0 || freshCheck[0].lastRefresh < thresholdDate) {
    // Pull new data and conveniently get the required results
    const idLookup = await pullCgTokenList(tokenAddresses);
    // Update last refresh time
    await db
      .insert(tableMeta)
      .values({
        tableName: getTableName(tokenMeta),
        lastRefresh: new Date(),
      })
      .onConflictDoUpdate({
        target: [tableMeta.tableName],
        set: {
          lastRefresh: new Date(),
        },
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
    (await pullCgTokenList(tokenAddresses));

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
    .map((rawMeta) => ({
      address: rawMeta.platforms.solana,
      symbol: rawMeta.symbol,
      name: rawMeta.name,
      imageUrl: rawMeta.image.small,
    }));

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

async function pullCgTokenList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const cgEndpoint = cg.getEndpoint("/coins/list");
  cgEndpoint.searchParams.append("include_platform", "true");
  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (resp.ok) {
    const res: CG_Token[] = await resp.json();
    const solanaTokens = res
      .filter((rawToken) => rawToken.platforms.solana)
      .map((rawToken) => ({
        coinGeckoId: rawToken.id,
        tokenAddress: rawToken.platforms.solana!,
      }));

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
    (await pullCgTokenList(tokenAddresses));

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
    price_percentage_change: "1h",
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

    const marketDataList: TokenMarketDataInsert[] = res.map(
      (rawMakertData) => ({
        address: addressLookup[rawMakertData.id],
        priceUsd: rawMakertData.current_price,
        marketCap: rawMakertData.market_cap,
        marketCapRank: rawMakertData.market_cap_rank,
        fullyDilutedValuation: rawMakertData.fully_diluted_valuation,
        totalVolume: rawMakertData.total_volume,
        high24h: rawMakertData.high_24h,
        low24h: rawMakertData.low_24h,
        priceChange24h: rawMakertData.price_change_24h,
        priceChangePercentage24h: rawMakertData.price_change_percentage_24h,
        marketCapChange24h: rawMakertData.market_cap_change_24h,
        marketCapChangePercentage24h:
          rawMakertData.market_cap_change_percentage_24h,
        circulatingSupply: rawMakertData.circulating_supply,
        totalSupply: rawMakertData.total_supply,
        maxSupply: rawMakertData.max_supply,
        ath: rawMakertData.ath,
        athChangePercentage: rawMakertData.ath_change_percentage,
        atl: rawMakertData.atl,
        atlChangePercentage: rawMakertData.atl_change_percentage,
      }),
    );

    return await db
      .insert(tokenMarketData)
      .values(marketDataList)
      .onConflictDoUpdate({
        target: [tokenMarketData.address],
        set: {
          priceUsd: excluded(tokenMarketData.priceUsd),
          marketCap: excluded(tokenMarketData.marketCap),
          marketCapRank: excluded(tokenMarketData.marketCapRank),
          fullyDilutedValuation: excluded(
            tokenMarketData.fullyDilutedValuation,
          ),
          totalVolume: excluded(tokenMarketData.totalVolume),
          high24h: excluded(tokenMarketData.high24h),
          low24h: excluded(tokenMarketData.low24h),
          priceChange24h: excluded(tokenMarketData.priceChange24h),
          priceChangePercentage24h: excluded(
            tokenMarketData.priceChangePercentage24h,
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
