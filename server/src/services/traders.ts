import { TRADER_GAINEERS_LOSERS_TTL_MS as TRADER_GAINERS_LOSERS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { topLosers, topTraders } from "@sv/db/schema.js";
import { getApiResult } from "@sv/middlewares/validation.js";
import { bds_TopTradersSchema } from "@sv/services/_types/trade_raw_responses.js";
import * as bds from "@sv/util/util-birdeye.js";
import { asc } from "drizzle-orm";

async function fetchTraderGainersLosers(sortType: "asc" | "desc") {
  const bdsEndpoint = bds.getEndpoint("/trader/gainers-losers");

  bdsEndpoint.search = new URLSearchParams({
    type: "1W",
    sort_by: "PnL",
    sort_type: sortType,
  }).toString();

  const req = new Request(bdsEndpoint, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  const res = await getApiResult(bds_TopTradersSchema, resp);

  if (!res) {
    return null;
  }

  return res.data.items.map((trader, index) => ({
    address: trader.address,
    rank: index + 1,
    pnl: trader.pnl,
    volume: trader.volume,
    tradeCount: trader.trade_count,
  }));
}

export async function getTopGainers() {
  const cached = await db
    .select()
    .from(topTraders)
    .orderBy(asc(topTraders.rank));

  const thresholdTime = new Date(Date.now() - TRADER_GAINERS_LOSERS_TTL_MS);

  if (cached.length > 0 && cached[0].updatedAt > thresholdTime) {
    return cached;
  }

  const items = await fetchTraderGainersLosers("desc");
  if (!items) return cached.length > 0 ? cached : [];

  await db.delete(topTraders);
  await db.insert(topTraders).values(items);

  return await db.select().from(topTraders).orderBy(asc(topTraders.rank));
}

export async function getTopLosers() {
  const cached = await db.select().from(topLosers).orderBy(asc(topLosers.rank));

  const thresholdTime = new Date(Date.now() - TRADER_GAINERS_LOSERS_TTL_MS);

  if (cached.length > 0 && cached[0].updatedAt > thresholdTime) {
    return cached;
  }

  const items = await fetchTraderGainersLosers("asc");
  if (!items) return cached.length > 0 ? cached : [];

  await db.delete(topLosers);
  await db.insert(topLosers).values(items);

  return await db.select().from(topLosers).orderBy(asc(topLosers.rank));
}
