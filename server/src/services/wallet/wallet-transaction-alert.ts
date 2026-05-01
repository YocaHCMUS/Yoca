import { db } from "@sv/db";
import {
  alerts,
  tradingAlertConditions,
  tradingAlertScopes,
  UserAlertPeriod,
  walletMetrics1m,
  type UserTradingScopeSelect,
} from "@sv/db/alerts";
import { validate } from "@sv/middlewares/validation";
import { excluded } from "@sv/util/orm-sql";
import { eq, sql } from "drizzle-orm";
import {
  EnhancedNativeTransfer,
  EnhancedTokenTransfer,
  EnhancedTransaction,
} from "helius-sdk/enhanced/types";
import { Hono } from "hono";
import { z } from "zod";
import { getTokenMarketData } from "../tokens";

function getBucketFromTx(tx: EnhancedTransaction): Date {
  const ts = tx.timestamp ?? Math.floor(Date.now() / 1000);
  const d = new Date(ts * 1000);
  d.setSeconds(0, 0);
  return d;
}

function getPeriodStart(period: UserAlertPeriod): Date {
  const now = Date.now();

  switch (period) {
    case "30m":
      return new Date(now - 30 * 60 * 1000);
    case "1h":
      return new Date(now - 60 * 60 * 1000);
    case "6h":
      return new Date(now - 6 * 60 * 60 * 1000);
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    default:
      console.error(`Period ${period} was not implemented`);
      return new Date(now);
  }
}

async function getTokenPrices(tokenAddresses: string[]) {
  const marketData = await getTokenMarketData(tokenAddresses);
  const priceData: Record<string, number> = {};
  tokenAddresses.forEach((address) => {
    if (marketData[address]) {
      priceData[address] = marketData[address].priceUsd;
    }
  });
  return priceData;
}

function filterTransfersByScope(
  tx: EnhancedTransaction,
  scope: UserTradingScopeSelect,
  feePayer: string,
): {
  tokenTransfers: EnhancedTokenTransfer[];
  nativeTransfers: EnhancedNativeTransfer[];
} {
  let tokenTransfers = [...(tx.tokenTransfers || [])];
  let nativeTransfers = [...(tx.nativeTransfers || [])];

  if (scope.tokenAddress) {
    tokenTransfers = tokenTransfers.filter((t) => t.mint == scope.tokenAddress);
  }

  if (scope.counterpartyAddress) {
    tokenTransfers = tokenTransfers.filter(
      (t) =>
        t.fromUserAccount == scope.counterpartyAddress ||
        t.toUserAccount == scope.counterpartyAddress,
    );
    nativeTransfers = nativeTransfers.filter(
      (t) =>
        t.fromUserAccount == scope.counterpartyAddress ||
        t.toUserAccount == scope.counterpartyAddress,
    );
  }

  if (scope.direction != "both") {
    const isBuy = scope.direction == "buy";
    tokenTransfers = tokenTransfers.filter((t) =>
      isBuy ? t.toUserAccount == feePayer : t.fromUserAccount == feePayer,
    );
    nativeTransfers = nativeTransfers.filter((t) =>
      isBuy ? t.toUserAccount == feePayer : t.fromUserAccount == feePayer,
    );
  }

  return { tokenTransfers, nativeTransfers };
}

async function calculateScopedVolume(
  tokenTransfers: EnhancedTokenTransfer[],
  nativeTransfers: EnhancedNativeTransfer[],
): Promise<number> {
  let volumeUsd = 0;

  if (tokenTransfers.length > 0) {
    const tokenMints = tokenTransfers.map((t) => t.mint);
    const tokenPrices = await getTokenPrices(tokenMints);
    volumeUsd += tokenTransfers.reduce(
      (acc, curr) =>
        acc + Number(curr.tokenAmount) * (tokenPrices[curr.mint] || 0),
      0,
    );
  }

  if (nativeTransfers.length > 0) {
    volumeUsd += nativeTransfers.reduce(
      (acc, curr) => acc + curr.amount / 1e9,
      0,
    );
  }

  return volumeUsd;
}

function calculateScopedTradeCount(
  tokenTransfers: EnhancedTokenTransfer[],
  nativeTransfers: EnhancedNativeTransfer[],
): number {
  return tokenTransfers.length + nativeTransfers.length;
}

async function getTransactionVolume(tx: EnhancedTransaction): Promise<number> {
  let volumeUsd = 0;

  if (tx.tokenTransfers) {
    const tokenAddresses = tx.tokenTransfers.map((tx) => tx.mint);
    const tokenPrices = await getTokenPrices(tokenAddresses);
    volumeUsd += tx.tokenTransfers.reduce(
      (acc, curr) =>
        acc + Number(curr.tokenAmount) * (tokenPrices[curr.mint] || 0),
      0,
    );
  }

  if (tx.nativeTransfers) {
    volumeUsd += tx.nativeTransfers.reduce(
      (acc, curr) => acc + curr.amount / 1e9,
      0,
    );
  }

  return volumeUsd;
}

function getTradeCount(tx: EnhancedTransaction): number {
  return (tx.tokenTransfers?.length ?? 0) + (tx.nativeTransfers?.length ?? 0);
}

async function upsertWalletMetrics(
  wallet: string,
  bucketTs: Date,
  volumeUsd: number,
  tradeCount: number,
) {
  await db
    .insert(walletMetrics1m)
    .values({
      wallet,
      bucketTs,
      volumeUsd,
      tradeCount,
    })
    .onConflictDoUpdate({
      target: [walletMetrics1m.wallet, walletMetrics1m.bucketTs],
      set: {
        volumeUsd: sql<number>`${walletMetrics1m.volumeUsd} + ${excluded(walletMetrics1m.volumeUsd)}`,
        tradeCount: sql<number>`${walletMetrics1m.tradeCount} + ${excluded(walletMetrics1m.tradeCount)}`,
      },
    });
}

function evaluateCondition(
  value: number,
  operator: string,
  threshold: number,
): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "eq":
      return value == threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

async function monitorTransaction(tx: EnhancedTransaction) {
  if (!tx.feePayer) return;

  const wallet = tx.feePayer;

  const volumeUsd = await getTransactionVolume(tx);
  const tradeCount = getTradeCount(tx);
  const bucketTs = getBucketFromTx(tx);

  // store aggregated metric
  await upsertWalletMetrics(wallet, bucketTs, volumeUsd, tradeCount);

  // get scopes
  const scopes = await db
    .select()
    .from(tradingAlertScopes)
    .where(eq(tradingAlertScopes.walletAddress, wallet));

  if (scopes.length == 0) return;

  for (const scope of scopes) {
    const conditions = await db
      .select()
      .from(tradingAlertConditions)
      .where(eq(tradingAlertConditions.alertId, scope.alertId));

    const [alert] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, scope.alertId))
      .limit(1);

    if (!alert) continue;

    // Filter transfers once for this scope
    const { tokenTransfers, nativeTransfers } = filterTransfersByScope(
      tx,
      scope,
      wallet,
    );

    // Get scoped metrics from filtered transfers
    const scopedVolumeUsd = await calculateScopedVolume(
      tokenTransfers,
      nativeTransfers,
    );
    const scopedTradeCount = calculateScopedTradeCount(
      tokenTransfers,
      nativeTransfers,
    );

    for (const condition of conditions) {
      let metricValue = 0;

      if (condition.aggregation == "volume_usd") {
        metricValue = scopedVolumeUsd;
      } else if (condition.aggregation == "trade_count") {
        metricValue = scopedTradeCount;
      }

      const isSatisfied = evaluateCondition(
        metricValue,
        condition.conditionOp,
        condition.value,
      );

      if (isSatisfied) {
        console.log(`[ALERT] ${alert.name} triggered for wallet ${wallet}`);
        console.log(`Aggregation: ${metricValue}`);
      }
    }
  }
}

const webhookSchema: z.ZodType<EnhancedTransaction> = z.object({
  description: z.string().optional(),
  type: z.string().optional(),
  source: z.string().optional(),
  fee: z.number().optional(),
  feePayer: z.string().optional(),
  signature: z.string(),
  slot: z.number().optional(),
  timestamp: z.number().optional(),
  nativeTransfers: z.array(z.any()).optional(),
  tokenTransfers: z.array(z.any()).optional(),
  accountData: z.array(z.unknown()).optional(),
  transactionError: z.unknown().optional(),
  instructions: z.array(z.any()).optional(),
  events: z.record(z.string(), z.unknown()).optional(),
});

const app = new Hono().post(
  "/helius",
  validate("json", webhookSchema),
  async (c) => {
    const payload = c.req.valid("json");

    await monitorTransaction(payload);

    return c.json({ status: "ok" }, 200);
  },
);
