import { TRADER_GAINEERS_LOSERS_TTL_MS } from "@sv/config/constants.js";
import { setErr } from "@sv/config/errors.js";
import { db } from "@sv/db/index.js";
import { topLosers, topTraders } from "@sv/db/schema.js";
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

  const req = new Request(bdsEndpoint, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    console.log(await resp.json());
    return null;
  }

  const res = (await resp.json()) as BDS_TopTraders;

  console.log(res);

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
  if (!items) return cached.length > 0 ? cached : [];

  await db.delete(topTraders);
  await db.insert(topTraders).values(items);

  return await db.select().from(topTraders).orderBy(asc(topTraders.rank));
}

export async function getTopLosers() {
  const cached = await db
    .select()
    .from(topLosers)
    .orderBy(asc(topLosers.rank));

  const thresholdTime = new Date(Date.now() - TRADER_GAINEERS_LOSERS_TTL_MS);

  if (cached.length > 0 && cached[0].updatedAt > thresholdTime) {
    return cached;
  }

  const items = await getTraderGainersLosers("asc");
  if (!items) return cached.length > 0 ? cached : [];

  await db.delete(topLosers);
  await db.insert(topLosers).values(items);

  return await db
    .select()
    .from(topLosers)
    .orderBy(asc(topLosers.rank));
}

const app = new Hono()
  .get("/top", async (c) => {
    try {
      const traders = await getTopTraders();

      if (traders) {
        return c.json(traders, statusCode.Ok);
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
      const losers = await getTopLosers();

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
