import {
  RECENT_TRADES_TTL_MS,
  TRADER_GAINEERS_LOSERS_TTL_MS as TRADER_GAINERS_LOSERS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  recentTrades,
  topLosers,
  topTraders,
  type RecentTradeInsert,
} from "@sv/db/schema.js";
import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import { bds_TopTradersSchema } from "@sv/services/_types/trade-raw-responses.js";
import * as bds from "@sv/util/util-birdeye.js";
import { and, asc, desc, gte } from "drizzle-orm";
import { bds_RecentTradesSchema } from "./_types/token-raw-responses.js";

type TimeWindow = "6h" | "12h" | "24h";
type SortBy = "volume" | "time";

interface GetRecentTradesOptions {
  timeWindow?: TimeWindow;
  usdThreshold?: number;
  sortBy?: SortBy;
}

async function fetchRecentTrades() {
  const bdsEndpoint = bds.getEndpoint("/defi/v3/txs/recent");

  bdsEndpoint.search = new URLSearchParams({
    limit: "50",
    tx_type: "swap",
  }).toString();

  const req = new Request(bdsEndpoint, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  const res = await getTrackedApiResult(bds_RecentTradesSchema, resp);

  if (!res) {
    return null;
  }

  const trades = res.data.items.map(
    (raw): RecentTradeInsert => ({
      transactionHash: raw.tx_hash,
      instructionIndex: raw.ins_index,
      innerInstructionIndex: raw.inner_ins_index,

      baseSymbol: raw.base.symbol,
      baseAddress: raw.base.address,
      baseDecimals: raw.base.decimals,
      basePrice: raw.base.price,
      baseAmount: raw.base.amount,

      quoteSymbol: raw.quote.symbol,
      quoteAddress: raw.quote.address,
      quoteDecimals: raw.quote.decimals,
      quotePrice: raw.quote.price,
      quoteAmount: raw.quote.amount,

      blockUnixTime: raw.block_unix_time,
      volumeUsd: raw.volume_usd,

      owner: raw.owner,
      source: raw.source,
      poolAddress: raw.pool_id,
    }),
  );

  await db.delete(recentTrades);
  return await db.insert(recentTrades).values(trades).returning();
}

export async function getRecentTrades(options: GetRecentTradesOptions = {}) {
  const { timeWindow = "24h", usdThreshold = 1, sortBy = "volume" } = options;

  const existing = await db
    .select()
    .from(recentTrades)
    .orderBy(desc(recentTrades.blockUnixTime))
    .limit(50);

  let isStale = false;

  if (existing.length == 0) {
    isStale = true;
  } else {
    const latestUpdate = existing.reduce((latest, cur) =>
      cur.updatedAt > latest.updatedAt ? cur : latest,
    );

    const thresholdDate = new Date(Date.now() - RECENT_TRADES_TTL_MS);
    isStale = latestUpdate.updatedAt < thresholdDate;
  }

  if (isStale) {
    await fetchRecentTrades();
  }

  const timeWindowMs = getTimeWindowMs(timeWindow);
  const cutoffTime = new Date(Date.now() - timeWindowMs);
  const cutoffUnixTime = Math.floor(cutoffTime.getTime() / 1000);

  // Determine sort order based on sortBy parameter
  const orderBy =
    sortBy == "volume"
      ? desc(recentTrades.volumeUsd)
      : desc(recentTrades.blockUnixTime);

  const trades = await db
    .select()
    .from(recentTrades)
    .where(
      and(
        gte(recentTrades.blockUnixTime, cutoffUnixTime),
        gte(recentTrades.volumeUsd, usdThreshold),
      ),
    )
    .orderBy(orderBy)
    .limit(50);

  return trades;
}

function getTimeWindowMs(timeWindow: TimeWindow): number {
  const timeWindowMap: Record<TimeWindow, number> = {
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  };
  return timeWindowMap[timeWindow];
}

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
  const res = await getTrackedApiResult(bds_TopTradersSchema, resp);

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
  if (items == null) return null;
  if (items.length == 0) return [];

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
  if (items == null) return null;

  await db.delete(topLosers);
  await db.insert(topLosers).values(items);

  return await db.select().from(topLosers).orderBy(asc(topLosers.rank));
}
