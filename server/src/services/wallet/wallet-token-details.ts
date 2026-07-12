import {
    WALLET_TOKEN_DETAILS_FETCH_LIMIT,
    WALLET_TOKEN_DETAILS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
    walletTokenDetails,
    type WalletTokenDetailsInsert,
    type WalletTokenDetailsSelect,
} from "@sv/db/schema.js";
import { validateApiResult } from "@sv/middlewares/validation.js";
import {
    mbl_WalletPositionsSchema,
    type MBL_WalletPositions,
} from "@sv/services/_types/wallet-raw-responses.js";
import { excludedAutoFromInsert } from "@sv/util/orm-sql.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import * as mobula from "@sv/util/util-mobula.js";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";

export async function fetchTokenDetails(
  wallet: string,
): Promise<WalletTokenDetailsSelect[] | null> {
  const endpoint = mobula.getEndpoint("/2/wallet/positions");
  endpoint.search = new URLSearchParams({
    wallet,
    blockchains: "solana:solana",
    limit: String(WALLET_TOKEN_DETAILS_FETCH_LIMIT),
    sortBy: "lastActivity",
    order: "desc",
    includeFees: "false",
    includeAllBalances: "false",
    onlyOpen: "false",
  }).toString();

  const response = await rlFetch(endpoint, {
    method: "GET",
    headers: mobula.getRequiredHeaders(),
    rlLimiter: mobula.limiter,
  });
  const result = await validateApiResult(
    mbl_WalletPositionsSchema,
    response,
  );
  if (!result) return null;

  const positions: MBL_WalletPositions["data"] = result.data;

  const updatedAtMs = dayjs.utc().valueOf();
  const values = positions.map((position): WalletTokenDetailsInsert => {
    const costOfQuantitySold = Math.max(
      0,
      position.volumeSell - position.realizedPnlUSD,
    );
    const unrealizedCostBasis = Math.max(
      0,
      position.amountUSD - position.unrealizedPnlUSD,
    );

    return {
      address: wallet,
      tokenAddress: position.token.address,
      symbol: position.token.symbol,
      lastTradeUnixTime: position.lastDate
        ? dayjs.utc(position.lastDate).unix()
        : 0,
      totalBuyCount: position.buys,
      totalSellCount: position.sells,
      totalTradeCount: position.buys + position.sells,
      totalBoughtAmount: position.volumeBuyToken,
      totalSoldAmount: position.volumeSellToken,
      balanceAmount: position.balance,
      costOfQuantitySold,
      totalBoughtUsd: position.volumeBuy,
      totalSoldUsd: position.volumeSell,
      currentValue: position.amountUSD,
      realizedProfitUsd: position.realizedPnlUSD,
      realizedProfitPercent:
        costOfQuantitySold > 0
          ? position.realizedPnlUSD / costOfQuantitySold
          : 0,
      unrealizedProfitUsd: position.unrealizedPnlUSD,
      unrealizedProfitPercent:
        unrealizedCostBasis > 0
          ? position.unrealizedPnlUSD / unrealizedCostBasis
          : 0,
      avgBuyCost: position.avgBuyPriceUSD ?? 0,
      avgSellCost: position.avgSellPriceUSD ?? 0,
      updatedAtMs,
    };
  });

  if (values.length == 0) return [];

  return db
    .insert(walletTokenDetails)
    .values(values)
    .onConflictDoUpdate({
      target: [walletTokenDetails.address, walletTokenDetails.tokenAddress],
      set: excludedAutoFromInsert(
        walletTokenDetails,
        [walletTokenDetails.address, walletTokenDetails.tokenAddress],
        values,
      ),
    })
    .returning();
}

export async function getTokenDetails(
  wallet: string,
): Promise<WalletTokenDetailsSelect[] | null> {
  const stored = await db
    .select()
    .from(walletTokenDetails)
    .where(eq(walletTokenDetails.address, wallet));

  if (
    stored.length > 0 &&
    stored[0].updatedAtMs >=
      dayjs.utc().valueOf() - WALLET_TOKEN_DETAILS_TTL_MS
  ) {
    return stored;
  }

  try {
    const refreshed = await fetchTokenDetails(wallet);
    return refreshed ?? (stored.length > 0 ? stored : null);
  } catch (error) {
    if (stored.length > 0) {
      console.warn("Mobula wallet positions failed; returning stored data", {
        wallet,
        error,
      });
      return stored;
    }

    throw error;
  }
}
