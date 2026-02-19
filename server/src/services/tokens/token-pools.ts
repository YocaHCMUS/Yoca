import {
  TOKEN_POOL_DATA_TTL_MS,
  TOKEN_POOLS_TTL_MS as TOKEN_TOP_POOLS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenPoolData,
  tokenTopPools,
  type TokenPoolDataInsert,
  type TokenTopPoolInsert,
} from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { eq } from "drizzle-orm";
import type {
  CG_PoolData,
  CG_TopPoolData,
} from "../_types/token_raw_responses.js";

const complementaryFields: (keyof TokenPoolDataInsert)[] = [
  "buyVolumeUsd1h",
  "buyVolumeUsd6h",
  "buyVolumeUsd24h",
  "sellVolumeUsd1h",
  "sellVolumeUsd6h",
  "sellVolumeUsd24h",
];

function trimIdPrefix(id: string, prefix: string = "solana_"): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

// https://docs.coingecko.com/v3.0.1/reference/top-pools-contract-address
async function fetchTokenTopPools(tokenAddress: string) {
  const cgEndpoint = cg.getEndpoint(
    `/onchain/networks/solana/tokens/${tokenAddress}/pools`,
  );

  cgEndpoint.search = new URLSearchParams({
    include: "base_token,quote_token,dex",
    sort: "h24_volume_usd_liquidity_desc",
    page: "1",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return [];
  }

  const res: CG_TopPoolData = await resp.json();
  const poolDataList = res.data.map(
    (
      raw,
      idx,
    ): { rankInfo: TokenTopPoolInsert; data: TokenPoolDataInsert } => ({
      rankInfo: {
        tokenAddress: tokenAddress,
        poolAddress: raw.attributes.address,
        rank: idx,
      },
      data: {
        poolAddress: raw.attributes.address,
        poolName: raw.attributes.name,

        baseAddress: trimIdPrefix(raw.relationships.base_token.data.id),
        quoteAddress: trimIdPrefix(raw.relationships.quote_token.data.id),

        dexId: raw.relationships.dex.data.id,

        poolCreatedAt: new Date(raw.attributes.pool_created_at),
        liquidityUsd: Number(raw.attributes.reserve_in_usd),

        marketCapUsd: Number(raw.attributes.market_cap_usd),
        fdvUsd: Number(raw.attributes.fdv_usd),

        baseTokenPriceUsd: Number(raw.attributes.base_token_price_usd),
        quoteTokenPriceUsd: Number(raw.attributes.quote_token_price_usd),

        baseTokenPriceSol: Number(
          raw.attributes.base_token_price_native_currency,
        ),
        quoteTokenPriceSol: Number(
          raw.attributes.quote_token_price_native_currency,
        ),

        priceChangePercentage1h: Number(
          raw.attributes.price_change_percentage.h1,
        ),
        priceChangePercentage6h: Number(
          raw.attributes.price_change_percentage.h6,
        ),
        priceChangePercentage24h: Number(
          raw.attributes.price_change_percentage.h24,
        ),

        buys1h: raw.attributes.transactions.h1.buys,
        buys6h: raw.attributes.transactions.h6.buys,
        buys24h: raw.attributes.transactions.h24.buys,

        sells1h: raw.attributes.transactions.h1.sells,
        sells6h: raw.attributes.transactions.h6.sells,
        sells24h: raw.attributes.transactions.h24.sells,

        buyers1h: raw.attributes.transactions.h1.buyers,
        buyers6h: raw.attributes.transactions.h6.buyers,
        buyers24h: raw.attributes.transactions.h24.buyers,

        sellers1h: raw.attributes.transactions.h1.sellers,
        sellers6h: raw.attributes.transactions.h6.sellers,
        sellers24h: raw.attributes.transactions.h24.sellers,

        volumeUsd1h: Number(raw.attributes.volume_usd.h1),
        volumeUsd6h: Number(raw.attributes.volume_usd.h6),
        volumeUsd24h: Number(raw.attributes.volume_usd.h24),

        buyVolumeUsd1h: null,
        buyVolumeUsd6h: null,
        buyVolumeUsd24h: null,

        sellVolumeUsd1h: null,
        sellVolumeUsd6h: null,
        sellVolumeUsd24h: null,
      },
    }),
  );

  await db
    .insert(tokenTopPools)
    .values(poolDataList.map((pool) => pool.rankInfo))
    .onConflictDoUpdate({
      target: [tokenTopPools.tokenAddress, tokenTopPools.rank],
      set: excludedAuto(tokenTopPools, [
        tokenTopPools.tokenAddress,
        tokenTopPools.rank,
      ]),
    });
  await db
    .insert(tokenPoolData)
    .values(poolDataList.map((poolData) => poolData.data))
    .onConflictDoUpdate({
      target: [tokenPoolData.poolAddress],
      set: excludedAuto(tokenPoolData, [tokenPoolData.poolAddress]),
    });

  return poolDataList;
}

export async function getTokenTopPools(tokenAddress: string) {
  const res = await db
    .select({
      rankInfo: tokenTopPools,
      data: tokenPoolData,
    })
    .from(tokenTopPools)
    .innerJoin(
      tokenPoolData,
      eq(tokenTopPools.poolAddress, tokenPoolData.poolAddress),
    )
    .where(eq(tokenTopPools.tokenAddress, tokenAddress))
    .orderBy(tokenTopPools.rank);

  let stale = false;

  if (res.length > 0) {
    const latestUpdate = res.reduce((latest, cur) =>
      cur.rankInfo.updatedAt > latest.rankInfo.updatedAt ? cur : latest,
    );

    const thresholdDate = new Date(Date.now() - TOKEN_TOP_POOLS_TTL_MS);
    stale = latestUpdate.rankInfo.updatedAt < thresholdDate;
  } else {
    stale = true;
  }

  if (stale) {
    return await fetchTokenTopPools(tokenAddress);
  }

  return res;
}

async function fetchPoolData(poolAddress: string) {
  const cgEndpoint = cg.getOnchainEndpoint(
    `/networks/solana/pools/${poolAddress}`,
  );

  cgEndpoint.search = new URLSearchParams({
    include: "base_token,quote_token,dex",
    include_volume_breakdown: "true",
    include_composition: "true",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return null;
  }

  const res: CG_PoolData = await resp.json();
  const raw = res.data;
  const poolData: TokenPoolDataInsert = {
    poolAddress: raw.attributes.address,
    poolName: raw.attributes.name,

    baseAddress: trimIdPrefix(raw.relationships.base_token.data.id),
    quoteAddress: trimIdPrefix(raw.relationships.quote_token.data.id),

    dexId: raw.relationships.dex.data.id,

    poolCreatedAt: new Date(raw.attributes.pool_created_at),
    liquidityUsd: Number(raw.attributes.reserve_in_usd),

    marketCapUsd: Number(raw.attributes.market_cap_usd),
    fdvUsd: Number(raw.attributes.fdv_usd),

    baseTokenPriceUsd: Number(raw.attributes.base_token_price_usd),
    quoteTokenPriceUsd: Number(raw.attributes.quote_token_price_usd),

    baseTokenPriceSol: Number(raw.attributes.base_token_price_native_currency),
    quoteTokenPriceSol: Number(
      raw.attributes.quote_token_price_native_currency,
    ),

    priceChangePercentage1h: Number(raw.attributes.price_change_percentage.h1),
    priceChangePercentage6h: Number(raw.attributes.price_change_percentage.h6),
    priceChangePercentage24h: Number(
      raw.attributes.price_change_percentage.h24,
    ),

    buys1h: raw.attributes.transactions.h1.buys,
    buys6h: raw.attributes.transactions.h6.buys,
    buys24h: raw.attributes.transactions.h24.buys,

    sells1h: raw.attributes.transactions.h1.sells,
    sells6h: raw.attributes.transactions.h6.sells,
    sells24h: raw.attributes.transactions.h24.sells,

    buyers1h: raw.attributes.transactions.h1.buyers,
    buyers6h: raw.attributes.transactions.h6.buyers,
    buyers24h: raw.attributes.transactions.h24.buyers,

    sellers1h: raw.attributes.transactions.h1.sellers,
    sellers6h: raw.attributes.transactions.h6.sellers,
    sellers24h: raw.attributes.transactions.h24.sellers,

    volumeUsd1h: Number(raw.attributes.volume_usd.h1),
    volumeUsd6h: Number(raw.attributes.volume_usd.h6),
    volumeUsd24h: Number(raw.attributes.volume_usd.h24),

    buyVolumeUsd1h: Number(raw.attributes.buy_volume_usd.h1),
    buyVolumeUsd6h: Number(raw.attributes.buy_volume_usd.h6),
    buyVolumeUsd24h: Number(raw.attributes.buy_volume_usd.h24),

    sellVolumeUsd1h: Number(raw.attributes.sell_volume_usd.h1),
    sellVolumeUsd6h: Number(raw.attributes.sell_volume_usd.h6),
    sellVolumeUsd24h: Number(raw.attributes.sell_volume_usd.h24),
  };

  const [inserted] = await db
    .insert(tokenPoolData)
    .values(poolData)
    .onConflictDoUpdate({
      target: [tokenPoolData.poolAddress],
      set: excludedAuto(tokenPoolData, tokenPoolData.poolAddress),
    })
    .returning();

  return inserted || null;
}

export async function getTokenPoolData(poolAddress: string) {
  const [poolData] = await db
    .select()
    .from(tokenPoolData)
    .where(eq(tokenPoolData.poolAddress, poolAddress))
    .limit(1);

  let stale = false;
  if (poolData) {
    const thresholdDate = new Date(Date.now() - TOKEN_POOL_DATA_TTL_MS);
    const incomplete = complementaryFields.some(
      (field) => poolData[field] == null,
    );
    stale = poolData.updatedAt < thresholdDate || incomplete;
  } else {
    stale = true;
  }

  if (stale) {
    return await fetchPoolData(poolAddress);
  }

  return poolData;
}

export async function getTokenPoolDataList(poolAddresses: string[]) {
  const results = await Promise.all(
    poolAddresses.map((address) => getTokenPoolData(address)),
  );

  return results.filter((pool) => pool != null);
}
