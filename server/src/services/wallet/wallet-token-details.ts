import { WALLET_TOKEN_DETAILS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  walletTokenDetails,
  type WalletTokenDetailsInsert,
} from "@sv/db/schema.js";
import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import { excludedAutoFromInsert } from "@sv/util/orm-sql.js";
import * as bds from "@sv/util/util-birdeye.js";
import { eq } from "drizzle-orm";
import { bds_WalletTokenDetailsSchema } from "../_types/wallet-raw-responses.js";

export async function getTokenDetails(wallet: string) {
  const dbRes = await db
    .select()
    .from(walletTokenDetails)
    .where(eq(walletTokenDetails.address, wallet));

  let isStale = false;
  if (dbRes.length == 0) {
    isStale = true;
  } else {
    const thresholdDate = new Date(Date.now() - WALLET_TOKEN_DETAILS_TTL_MS);
    isStale = dbRes[0].updatedAt < thresholdDate;
  }

  if (!isStale) {
    return dbRes;
  }

  const bdsEnpoint = bds.getEndpoint("/wallet/v2/pnl/details");
  const req = new Request(bdsEnpoint, {
    method: "POST",
    headers: bds.getRequiredHeaders(),
    body: JSON.stringify({
      duration: "all",
      sort_type: "desc",
      sort_by: "last_trade",
      limit: 100,
      wallet,
    }),
  });

  const resp = await fetch(req);
  const res = await getTrackedApiResult(bds_WalletTokenDetailsSchema, resp);
  if (res == undefined) {
    return null;
  }

  const tokenDetails = (res?.data?.tokens ?? []).map(
    (tokenDetail): WalletTokenDetailsInsert => ({
      symbol: tokenDetail.symbol,
      address: tokenDetail.address,
      tokenAddress: tokenDetail.address,
      lastTradeUnixTime: tokenDetail.last_trade_unix_time,
      totalBuyCount: tokenDetail.counts.total_buy,
      totalSellCount: tokenDetail.counts.total_sell,
      totalTradeCount: tokenDetail.counts.total_trade,
      totalBoughtAmount: tokenDetail.quantity.total_bought_amount,
      totalSoldAmount: tokenDetail.quantity.total_sold_amount,
      balanceAmount: tokenDetail.quantity.holding,
      costOfQuantitySold: tokenDetail.cashflow_usd.cost_of_quantity_sold,
      totalBoughtUsd: tokenDetail.cashflow_usd.total_invested,
      totalSoldUsd: tokenDetail.cashflow_usd.total_sold,
      currentValue: tokenDetail.cashflow_usd.current_value,
      realizedProfitUsd: tokenDetail.pnl.realized_profit_usd,
      realizedProfitPercent: tokenDetail.pnl.realized_profit_percent,
      unrealizedProfitUsd: tokenDetail.pnl.unrealized_usd,
      unrealizedProfitPercent: tokenDetail.pnl.unrealized_percent,
      avgBuyCost: tokenDetail.pricing.avg_buy_cost ?? 0,
      avgSellCost: tokenDetail.pricing.avg_sell_cost ?? 0,
    }),
  );

  const filteredTokenDetails = tokenDetails.filter(
    (detail) =>
      !isNaN(detail.totalBoughtAmount) &&
      !isNaN(detail.totalSoldAmount) &&
      !isNaN(detail.balanceAmount) &&
      !isNaN(detail.costOfQuantitySold) &&
      !isNaN(detail.totalBoughtUsd) &&
      !isNaN(detail.totalSoldUsd) &&
      !isNaN(detail.currentValue) &&
      !isNaN(detail.realizedProfitUsd) &&
      !isNaN(detail.realizedProfitPercent) &&
      !isNaN(detail.unrealizedProfitUsd) &&
      !isNaN(detail.unrealizedProfitPercent) &&
      !isNaN(detail.avgBuyCost) &&
      !isNaN(detail.avgSellCost),
  );

  return await db
    .insert(walletTokenDetails)
    .values(filteredTokenDetails)
    .onConflictDoUpdate({
      target: [walletTokenDetails.address, walletTokenDetails.tokenAddress],
      set: excludedAutoFromInsert(
        walletTokenDetails,
        [walletTokenDetails.address, walletTokenDetails.tokenAddress],
        filteredTokenDetails,
      ),
    })
    .returning();
}
