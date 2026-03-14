import { UPDATE_TRENDING_TOKENS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { trendingTokens } from "@sv/db/schema.js";
import * as bds from "@sv/util/util-birdeye.js";
import { asc } from "drizzle-orm";
import { getCoinGeckoIdList } from "./token-list.js";

const TRENDING_RESULT_LIMIT = 10;
const BIRDEYE_TRENDING_LIMIT = 20;
const TRENDING_MAX_FETCH_ROUNDS = 10;

export type BDS_TrendingList = {
  success: boolean;
  data: {
    updateUnixTime: number;
    updateTime: string;
    tokens: Array<{
      address: string;
      decimals: number;
      liquidity: number;
      logoURI: string;
      name: string;
      symbol: string;
      volume24hUSD: number;
      volume24hChangePercent: number;
      rank: number;
      price: number;
      price24hChangePercent: number;
      fdv: number;
      marketcap: number;
    }>;
    total: number;
  };
};

async function fetchTrendingPage(params: {
  offset: number;
  limit: number;
}): Promise<BDS_TrendingList | null> {
  const bdsEndpoint = bds.getEndpoint("/defi/token_trending");

  bdsEndpoint.search = new URLSearchParams({
    sort_by: "rank",
    sort_type: "asc",
    interval: "24h",
    offset: String(params.offset),
    limit: String(params.limit),
  }).toString();

  const req = new Request(bdsEndpoint, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (!resp.ok) {
    return null;
  }

  const res: BDS_TrendingList = await resp.json();
  if (!res.success) {
    return null;
  }

  return res;
}
// lấy ít dữ liệu 
// làm theo hướng sẽ fetch tối thiểu bao nhiêu đồn
// https://docs.birdeye.so/reference/get-defi-token_trending
export async function getTrendingTokens() {
  const result = await db
    .select()
    .from(trendingTokens)
    .orderBy(asc(trendingTokens.rank));

  const thresholdTime = new Date(Date.now() - UPDATE_TRENDING_TOKENS_TTL_MS);

  if (result.length > 0 && result[0].updatedAt > thresholdTime) {
    return result;
  }

  let fetchCount = 0;
  let offset = 0;
  const selectedAddresses: string[] = [];
  const seenAddresses = new Set<string>();

  for (let round = 0; round < TRENDING_MAX_FETCH_ROUNDS; round++) {
    console.info(
      `[token-trending] Sending Birdeye request #${fetchCount + 1} (offset=${offset}, limit=${BIRDEYE_TRENDING_LIMIT})`,
    );

    const page = await fetchTrendingPage({
      offset,
      limit: BIRDEYE_TRENDING_LIMIT,
    });
    fetchCount += 1;

    if (page == null) {
      console.info(
        `[token-trending] Birdeye requests sent before failure: ${fetchCount}`,
      );
      return null;
    }

    const pageAddresses = page.data.tokens.map((token) => token.address);
    const cgLookup = await getCoinGeckoIdList(pageAddresses);
    const cgAddressSet = new Set(Object.keys(cgLookup));

    for (const address of pageAddresses) {
      if (cgAddressSet.has(address) && !seenAddresses.has(address)) {
        seenAddresses.add(address);
        selectedAddresses.push(address);
      }

      if (selectedAddresses.length >= TRENDING_RESULT_LIMIT) {
        break;
      }
    }

    console.info(
      `[token-trending] Collected CoinGecko tokens: ${selectedAddresses.length}/${TRENDING_RESULT_LIMIT}`,
    );

    if (selectedAddresses.length >= TRENDING_RESULT_LIMIT) {
      break;
    }

    if (page.data.tokens.length < BIRDEYE_TRENDING_LIMIT) {
      break;
    }

    offset += BIRDEYE_TRENDING_LIMIT;
  }

  console.info(`[token-trending] Total Birdeye requests sent: ${fetchCount}`);

  if (selectedAddresses.length === 0) {
    return [];
  }

  await db.delete(trendingTokens);
  return await db
    .insert(trendingTokens)
    .values(
      selectedAddresses.map((address, index) => ({
        address,
        rank: index + 1,
      })),
    )
    .returning();
}
