import { WALLET_SWAPS_TTL_MS } from "@sv/config/constants";
import { db } from "@sv/db/index";
import { walletTokenTrades, WalletTokenTradesInsert } from "@sv/db/schema";
import { getTrackedApiResult } from "@sv/middlewares/validation";
import * as mrl from "@sv/util/util-moralis";
import { and, eq } from "drizzle-orm";
import { mrl_WalletTokenSwapsSchema } from "../_types/wallet-raw-responses";

async function fetchWalletTokenSwaps(
  walletAddress: string,
  tokenAddress: string,
  fromDate?: string,
) {
  const mrlEnpoint = mrl.getEndpoint(`/account/mainnet/${walletAddress}/swaps`);
  const params: Record<string, string> = {
    tokenAddress,
    order: "DESC",
  };

  if (fromDate) {
    params.fromDate = fromDate;
  }

  mrlEnpoint.search = new URLSearchParams(params).toString();

  const req = new Request(mrlEnpoint, {
    method: "GET",
    headers: mrl.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  const res = await getTrackedApiResult(mrl_WalletTokenSwapsSchema, resp);

  if (!res) {
    return null;
  }

  const trades = res.result.map(
    (raw): WalletTokenTradesInsert => ({
      address: walletAddress,
      poolAddress: raw.pairAddress,
      tokenAddress,
      transactionHash: raw.transactionHash,
      baseAmount:
        raw.transactionType == "buy"
          ? Number(raw.bought.amount)
          : Number(raw.sold.amount),
      quoteAmount:
        raw.transactionType == "sell"
          ? Number(raw.sold.amount)
          : Number(raw.bought.amount),
      blockUnixTimeMs: new Date(raw.blockTimestamp).getTime(),
      volumeUsd: raw.totalValueUsd,
      baseTokenAddress: raw.baseToken,
      quoteTokenAddress: raw.quoteToken,
      tradeAction: raw.transactionType,
      exchangeName: raw.exchangeName,
      basePrice:
        raw.transactionType == "buy"
          ? Number(raw.bought.usdPrice)
          : Number(raw.sold.usdPrice),
      quotePrice:
        raw.transactionType == "buy"
          ? Number(raw.sold.usdPrice)
          : Number(raw.bought.usdPrice),
      exchangeProgramAddress: null,
      poolName: null,
    }),
  );

  const inserted = await db
    .insert(walletTokenTrades)
    .values(trades)
    .returning();

  return inserted;
}

export async function getWalletTokenTrades(
  walletAddress: string,
  tokenAddress: string,
) {
  const existing = await db
    .select()
    .from(walletTokenTrades)
    .where(
      and(
        eq(walletTokenTrades.address, walletAddress),
        eq(walletTokenTrades.tokenAddress, tokenAddress),
      ),
    )
    .orderBy(walletTokenTrades.blockUnixTimeMs);

  if (existing.length > 0) {
    const latestUpdate = existing[existing.length - 1].updatedAt;
    const thresholdDate = new Date(Date.now() - WALLET_SWAPS_TTL_MS);

    if (latestUpdate >= thresholdDate) {
      return existing;
    }
  }

  const fromDate =
    existing.length > 0
      ? new Date(existing[existing.length - 1].blockUnixTimeMs).toISOString()
      : undefined;

  const newTrades = await fetchWalletTokenSwaps(
    walletAddress,
    tokenAddress,
    fromDate,
  );

  if (!newTrades) {
    return existing.length > 0 ? existing : null;
  }

  return [...existing, ...newTrades];
}
