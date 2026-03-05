import { UPDATE_TOP_TOKENS_BY_MARKET_CAP_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenMarketData,
  topTokensByMarketCap,
  type TopTokensByMarketCapInsert,
} from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { asc, eq } from "drizzle-orm";
import type { CG_CoinMarkets } from "../_types/token_raw_responses.js";
import { getAddressesByCoinGeckoId } from "./token-list.js";
import { getMarketDataFromRaw } from "./token-market-data.js";

// https://docs.coingecko.com/v3.0.1/reference/coins-markets
export async function getTopTokensByMarketCap() {
  const dbRes = await db
    .select({
      address: topTokensByMarketCap.address,
      rank: topTokensByMarketCap.rank,
      marketData: tokenMarketData,
      rankUpdatedAt: topTokensByMarketCap.updatedAt,
      marketDataUpdatedAt: tokenMarketData.updatedAt,
    })
    .from(topTokensByMarketCap)
    .leftJoin(
      tokenMarketData,
      eq(topTokensByMarketCap.address, tokenMarketData.address),
    )
    .orderBy(asc(topTokensByMarketCap.rank));

  const thresholdDate = new Date(
    Date.now() - UPDATE_TOP_TOKENS_BY_MARKET_CAP_TTL_MS,
  );

  if (dbRes.length > 0 && dbRes[0].rankUpdatedAt > thresholdDate) {
    return dbRes;
  }

  const cgEndpoint = cg.getEndpoint("/coins/markets");

  cgEndpoint.search = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: "250",
    price_change_percentage: "1h,24h,7d,14d,30d,200d,1y",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return null;
  }

  const res: CG_CoinMarkets = await resp.json();
  const cgIds = res.map((raw) => raw.id);
  const cgIdToAddress = await getAddressesByCoinGeckoId(cgIds);

  const solanaRes = res.filter((raw) => cgIdToAddress[raw.id]);

  const topTokenInsert = solanaRes.map(
    (raw, index): TopTokensByMarketCapInsert => ({
      address: cgIdToAddress[raw.id],
      rank: index + 1,
    }),
  );

  await db.delete(topTokensByMarketCap);
  await db.insert(topTokensByMarketCap).values(topTokenInsert).returning();

  const marketDataList = solanaRes.map((raw) =>
    getMarketDataFromRaw(cgIdToAddress[raw.id], raw),
  );

  await db
    .insert(tokenMarketData)
    .values(marketDataList)
    .onConflictDoUpdate({
      target: [tokenMarketData.address],
      set: excludedAuto(tokenMarketData, tokenMarketData.address),
    });

  return await db
    .select({
      rank: topTokensByMarketCap.rank,
      marketData: tokenMarketData,
    })
    .from(topTokensByMarketCap)
    .innerJoin(
      tokenMarketData,
      eq(topTokensByMarketCap.address, tokenMarketData.address),
    )
    .orderBy(topTokensByMarketCap.rank);
}
