import { TOKEN_POOLS_TTL_MS as TOKEN_TOP_POOLS_TTL_MS } from "@sv/config/constants.js";
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
import type { CG_TopPoolData } from "../_types/token_raw_responses.js";

interface PoolAttributes {
  name: string;
  address: string;
  volume_usd: Record<string, string>;
  buy_volume_usd: Record<string, string>;
  sell_volume_usd: Record<string, string>;
  net_buy_volume_usd: Record<string, string>;
  reserve_in_usd: string;
  market_cap_usd: string | null;
  fdv_usd: string | null;
  base_token_price_usd: string | null;
  quote_token_price_usd: string | null;
  base_token_price_quote_token: string | null;
  price_change_percentage: Record<string, string>;
  transactions: {
    h24: {
      buys: number;
      sells: number;
      buyers: number;
      sellers: number;
    };
  };
}

interface PoolResponse {
  data: Array<{
    attributes: PoolAttributes;
    relationships: {
      quote_token?: {
        data?: {
          id: string;
        };
      };
      dex?: {
        data?: {
          id: string;
        };
      };
    };
  }>;
  included?: Array<{
    type: string;
    id: string;
    attributes: {
      name?: string;
      symbol?: string;
    };
  }>;
}

function trimIdPrefix(id: string, prefix: string = "solana_"): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

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
        poolAddress: raw.attributes.address,
        rank: idx,
        tokenAddress: tokenAddress,
      },
      data: {
        poolAddress: raw.attributes.address,
        dexId: raw.relationships.dex.data.id,
        liquidityUsd: Number(raw.attributes.reserve_in_usd),
        poolCreatedAt: new Date(raw.attributes.pool_created_at),
        poolName: raw.attributes.name,

        baseToQuote: Number(raw.attributes.base_token_price_quote_token),
        baseAddress: trimIdPrefix(raw.relationships.base_token.data.id),
        quoteAddress: trimIdPrefix(raw.relationships.base_token.data.id),
        buys1h: raw.attributes.transactions.h1.buys,
        buys24h: raw.attributes.transactions.h1.buys,
        buys6h: raw.attributes.transactions.h6.buys,
        volume1h: Number(raw.attributes.volume_usd.h1),
        volume6h: Number(raw.attributes.volume_usd.h6),
        volume24h: Number(raw.attributes.volume_usd.h24),
        sells1h: raw.attributes.transactions.h1.sells,
        sells24h: raw.attributes.transactions.h1.sells,
        sells6h: raw.attributes.transactions.h6.sells,
      },
    }),
  );

  await db
    .insert(tokenPoolData)
    .values(poolDataList.map((pool) => pool.data))
    .onConflictDoUpdate({
      target: [tokenPoolData.poolAddress],
      set: excludedAuto(tokenPoolData, [tokenPoolData.poolAddress]),
    });

  return await db
    .insert(tokenTopPools)
    .values(poolDataList.map((pool) => pool.rankInfo))
    .onConflictDoUpdate({
      target: [tokenTopPools.tokenAddress, tokenTopPools.rank],
      set: excludedAuto(tokenTopPools, [
        tokenTopPools.tokenAddress,
        tokenTopPools.rank,
      ]),
    })
    .returning();
}

export async function getTokenTopPools(tokenAddress: string) {
  const res = await db
    .select()
    .from(tokenTopPools)
    .where(eq(tokenTopPools.tokenAddress, tokenAddress))
    .orderBy(tokenTopPools.rank);

  let stale = false;

  if (res.length > 0) {
    const latestUpdate = res.reduce((latest, cur) =>
      cur.updatedAt > latest.updatedAt ? cur : latest,
    );

    const thresholdDate = new Date(Date.now() - TOKEN_TOP_POOLS_TTL_MS);
    stale = latestUpdate.updatedAt < thresholdDate;
  }

  if (stale) {
    return await fetchTokenTopPools(tokenAddress);
  }
  return res;
}
