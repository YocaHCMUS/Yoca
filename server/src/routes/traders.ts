import { TRADER_GAINEERS_LOSERS_TTL_MS } from "@sv/config/constants.js";
import { setErr } from "@sv/config/errors.js";
import { db } from "@sv/db/index.js";
import { topTraders } from "@sv/db/schema.js";
import { trackedFetch } from "@sv/services/tracking/apiCallTracker.service.js";
import { statusCode } from "@sv/util/responses.js";
import * as bds from "@sv/util/util-birdeye.js";
import { asc } from "drizzle-orm";
import { Hono } from "hono";

export type BDS_TopTraders = {
  data: {
    items: Array<{
      network: string;
      address: string;
      pnl: number;
      volume: number;
      trade_count: number;
    }>;
  };
  success: boolean;
};

// https://docs.birdeye.so/reference/get-defi-v3-trader-gainers-losers
export async function getTraderGainersLosers(sortType: "asc" | "desc") {
  const bdsEndpoint = bds.getEndpoint("/trader/gainers-losers");

  bdsEndpoint.search = new URLSearchParams({
    type: "1W",
    sort_by: "PnL",
    sort_type: sortType,
  }).toString();

  const { headers, apiKey } = bds.getRequiredHeadersWithMetadata();
  const resp = await trackedFetch({
    provider: "birdeye",
    url: bdsEndpoint,
    init: {
      method: "GET",
      headers,
    },
    apiKey,
    serviceFile: "server/src/routes/traders.ts",
    functionName: "getTraderGainersLosers",
  });

  if (!resp.ok) {
    return null;
  }

  const res = (await resp.json()) as BDS_TopTraders;

  if (!res.success) {
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

export async function getTopTraders() {
  const cached = await db
    .select()
    .from(topTraders)
    .orderBy(asc(topTraders.rank));

  const thresholdTime = new Date(Date.now() - TRADER_GAINEERS_LOSERS_TTL_MS);

  if (cached.length > 0 && cached[0].updatedAt > thresholdTime) {
    return cached;
  }

  const items = await getTraderGainersLosers("desc");
  if (!items) return cached.length > 0 ? cached : null;

  await db.delete(topTraders);
  await db.insert(topTraders).values(items);

  return await db.select().from(topTraders).orderBy(asc(topTraders.rank));
}

const app = new Hono()
  .get("/top", async (c) => {
    try {
      const topTraders = await getTopTraders();

      if (topTraders) {
        return c.json(topTraders, statusCode.Ok);
      }

      return c.json(
        setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
        statusCode.BadGateway,
      );
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/losers", async (c) => {
    try {
      const losers = await getTraderGainersLosers("asc");

      if (losers) {
        return c.json(losers, statusCode.Ok);
      }

      return c.json(
        setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
        statusCode.BadGateway,
      );
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  });

export default app;
