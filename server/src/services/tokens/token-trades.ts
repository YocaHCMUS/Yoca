import { POOL_TRADES_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { poolTrades, type PoolTradeInsert } from "@sv/db/schema.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte } from "drizzle-orm";

interface TradeAttributes {
  kind: "buy" | "sell";
  price_to_in_usd: string;
  price_from_in_usd: string;
  price_to_in_currency_token: string;
  price_from_in_currency_token: string;
  volume_in_usd: string;
  to_token_amount: string;
  from_token_amount: string;
  tx_from_address: string;
  block_timestamp: string;
  tx_hash: string;
}

interface TradeResponse {
  data: Array<{
    id: string;
    attributes: TradeAttributes;
  }>;
}

/**
 * Fetch pool trades from CoinGecko API
 */
async function fetchPoolTrades(
  poolAddress: string,
  network: string = "solana",
): Promise<PoolTradeInsert[]> {
  const cgEndpoint = cg.getEndpoint(
    `/onchain/networks/${network}/pools/${poolAddress}/trades`,
  );

  cgEndpoint.search = new URLSearchParams({
    token: "base",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    console.error(`Pool Trades API error: ${resp.status}`);
    return [];
  }

  const json: TradeResponse = await resp.json();
  const data = json.data || [];

  return data.map((item) => {
    const attr = item.attributes;
    const kind = attr.kind || "buy";

    const priceUsd =
      kind === "buy" ? attr.price_to_in_usd : attr.price_from_in_usd;
    const priceQuote =
      kind === "buy"
        ? attr.price_to_in_currency_token
        : attr.price_from_in_currency_token;
    const amount =
      kind === "buy" ? attr.to_token_amount : attr.from_token_amount;

    return {
      id: item.id,
      poolAddress,
      network,
      type: kind,
      kind,
      priceUsd: parseFloat(priceUsd || "0"),
      priceQuote: parseFloat(priceQuote || "0"),
      volumeUsd: parseFloat(attr.volume_in_usd || "0"),
      amount: parseFloat(amount || "0"),
      baseTokenAmount: parseFloat(attr.to_token_amount || "0"),
      quoteTokenAmount: parseFloat(attr.from_token_amount || "0"),
      fromAddress: attr.tx_from_address || "",
      txHash: attr.tx_hash || "",
      timestamp: new Date(attr.block_timestamp),
    };
  });
}

/**
 * Get pool trades with caching
 */
export async function getPoolTrades(
  poolAddress: string,
  network: string = "solana",
) {
  const thresholdDate = new Date(Date.now() - POOL_TRADES_TTL_MS);

  // Check cache
  const cached = await db
    .select()
    .from(poolTrades)
    .where(
      and(
        eq(poolTrades.poolAddress, poolAddress),
        eq(poolTrades.network, network),
        gte(poolTrades.createdAt, thresholdDate),
      ),
    )
    .orderBy(poolTrades.timestamp)
    .limit(100);

  if (cached.length > 0) {
    return cached;
  }

  // Fetch fresh data
  const trades = await fetchPoolTrades(poolAddress, network);

  if (trades.length === 0) {
    return [];
  }

  // Store in database
  const inserted = await db
    .insert(poolTrades)
    .values(trades)
    .onConflictDoNothing()
    .returning();

  return inserted.length > 0 ? inserted : trades;
}
