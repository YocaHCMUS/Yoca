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

// /**
//  * Get trending tokens with caching
//  */
// export async function getTrendingTokens() {
//   const thresholdDate = new Date(Date.now() - TRENDING_TOKENS_TTL_MS);

//   const cached = await db
//     .select()
//     .from(trendingTokens)
//     .where(gte(trendingTokens.updatedAt, thresholdDate))
//     .orderBy(trendingTokens.rank)
//     .limit(10);

//   if (cached.length > 0) {
//     return cached;
//   }

//   // Fetch fresh data
//   const tokens = await fetchTrendingTokens();

//   if (tokens.length === 0) {
//     return [];
//   }

//   // Clear old trending tokens (they change frequently)
//   await db.delete(trendingTokens);

//   // Store in database
//   const inserted = await db.insert(trendingTokens).values(tokens).returning();

//   return inserted;
// }
