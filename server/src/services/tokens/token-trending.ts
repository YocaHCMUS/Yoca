// import { TRENDING_TOKENS_TTL_MS } from "@sv/config/constants.js";
// import { db } from "@sv/db/index.js";
// import { trendingTokens, type TrendingTokenInsert } from "@sv/db/schema.js";
// import * as cg from "@sv/util/util-coingecko.js";
// import { gte } from "drizzle-orm";

// interface TrendingCoinItem {
//   item: {
//     id: string;
//     name: string;
//     symbol: string;
//     thumb: string;
//     data?: {
//       price_change_percentage_24h?: {
//         usd?: number;
//       };
//     };
//   };
// }

// interface TrendingResponse {
//   coins: TrendingCoinItem[];
// }

// /**
//  * Fetch trending tokens from CoinGecko API
//  */
// async function fetchTrendingTokens(): Promise<TrendingTokenInsert[]> {
//   const cgEndpoint = cg.getEndpoint("/search/trending");

//   const req = new Request(cgEndpoint, {
//     method: "GET",
//     headers: cg.getRequiredHeaders(),
//   });

//   const resp = await fetch(req);

//   if (!resp.ok) {
//     console.error(`Trending Tokens API error: ${resp.status}`);
//     return [];
//   }

//   const data: TrendingResponse = await resp.json();

//   return data.coins.slice(0, 10).map((item, index) => ({
//     id: `${item.item.id}-${Date.now()}`, // Unique ID with timestamp
//     coinGeckoId: item.item.id,
//     name: item.item.name,
//     symbol: item.item.symbol,
//     thumb: item.item.thumb || null,
//     priceChangePercentage24h:
//       item.item.data?.price_change_percentage_24h?.usd || 0,
//     rank: index + 1,
//   }));
// }
import * as bds from "@sv/util/util-birdeye.js";

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

// https://docs.birdeye.so/reference/get-defi-token_trending
export async function getTrendingTokens() {
  const bdsEndpoint = bds.getEndpoint("/defi/token_trending");

  bdsEndpoint.search = new URLSearchParams({
    sort_by: "rank",
    sort_type: "asc",
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
  return res;
}
