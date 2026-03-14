import { RECENT_TRADES_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { recentTrades, type RecentTradeInsert } from "@sv/db/schema.js";
import * as bds from "@sv/util/util-birdeye.js";
import { desc } from "drizzle-orm";
import type { BDS_RecentTrades } from "./_types/token_raw_responses.js";

async function fetchRecentTrades(): Promise<RecentTradeInsert[]> {
  const bdsEndpoint = bds.getEndpoint("/defi/v3/txs/recent");

  bdsEndpoint.search = new URLSearchParams({
    limit: "500",
    tx_type: "swap",
  }).toString();

  const req = new Request(bdsEndpoint, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return [];
  }

  const res: BDS_RecentTrades = await resp.json();
  const trades = res.data.items.map(
    (raw): RecentTradeInsert => ({
      id: raw.tx_hash,

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

      txHash: raw.tx_hash,
      blockUnixTime: raw.block_unix_time,
      volumeUsd: raw.volume_usd,

      owner: raw.owner,
      source: raw.source,
      poolId: raw.pool_id,
    }),
  );

  return await db
    .insert(recentTrades)
    .values(trades)
    .onConflictDoUpdate({
      target: [recentTrades.id],
      set: {
        updatedAt: new Date(),
      },
    })
    .returning();
}

export async function getRecentTrades() {
  const cached = await db
    .select()
    .from(recentTrades)
    .orderBy(desc(recentTrades.blockUnixTime))
    .limit(500);

  let stale = false;

  if (cached.length > 0) {
    const latestUpdate = cached.reduce((latest, cur) =>
      cur.updatedAt > latest.updatedAt ? cur : latest,
    );

    const thresholdDate = new Date(Date.now() - RECENT_TRADES_TTL_MS);
    stale = latestUpdate.updatedAt < thresholdDate;
  } else {
    stale = true;
  }

  if (stale) {
    return await fetchRecentTrades();
  }

  return cached;
}
