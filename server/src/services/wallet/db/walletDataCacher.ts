import { db } from "@sv/db/index.js";
import { walletSwap, walletTransactionsMeta, walletOverviewCache, walletTransactions, tokenTransfers, walletHeliusTransactions, walletSwapMeta, walletTransferMeta, walletBalanceHistoryCache, walletFirstFund, walletPnlDataCache, walletPnlDataMeta } from "@sv/db/schema.js";
import { eq, sql } from "drizzle-orm";
import type { WalletSwap, WalletOverview, WalletTransaction, WalletTransfer, WalletTransactionHelius, BalanceDataPoint, WalletTimePeriod, HeliusWalletFirstFund } from "@sv/services/wallet/dtos/walletDataObjects.js";

export async function saveSwapsCache(
  address: string,
  transactions: WalletSwap[],
  from: number,
  to: number
) {
  try {
    // let coverageFromMs: number | undefined;
    // let coverageToMs: number | undefined;

    if (transactions.length > 0) {
      // Deduplicate by transaction hash to avoid multiple rows with the same
      // (address, signature) primary key when providers return several
      // legs for a single on-chain transaction.

      const uniqueBySignature = new Map<string, WalletSwap>();
      for (const tx of transactions) {
        if (!uniqueBySignature.has(tx.transactionHash)) {
          uniqueBySignature.set(tx.transactionHash, tx);
        }
      }

      const uniqueTransactions = Array.from(uniqueBySignature.values());
      const rows = uniqueTransactions.map((tx) => {
        return {
          transactionHash: tx.transactionHash,
          transactionType: tx.transactionType,
          blockTimestampMs: new Date(Date.parse(tx.blockTimestampIso) || Date.now()).getTime(),

          subcategory: tx.subcategory,

          walletAddress: tx.walletAddress,
          pairAddress: tx.pairAddress,

          tokensInvoled: tx.tokensInvolved,

          boughtTokenAddress: tx.bought.address,
          boughtTokenAmount: tx.bought.amount,
          boughtTokenPriceUsd: tx.bought.priceUsd,

          soldTokenAddress: tx.sold.address,
          soldTokenAmount: tx.sold.amount,
          soldTokenPriceUsd: tx.sold.priceUsd,

          totalValueUsd: tx.totalValueUsd,
          baseQuotePrice: tx.baseQuotePrice,
          providerSource: (tx as unknown as Record<string, unknown>).providerSource as string | undefined ?? "helius",
        };
      });

      // const coverageBounds = rows.length > 0
      //   ? rows.reduce(
      //     (bounds, row) => ({
      //       fromMs: Math.min(bounds.fromMs, row.blockTimestampMs),
      //       toMs: Math.max(bounds.toMs, row.blockTimestampMs),
      //     }),
      //     {
      //       fromMs: Number.POSITIVE_INFINITY,
      //       toMs: Number.NEGATIVE_INFINITY,
      //     },
      //   )
      //   : null;

      // coverageFromMs = coverageBounds
      //   ? coverageBounds.fromMs
      //   : undefined;
      // coverageToMs = coverageBounds
      //   ? coverageBounds.toMs
      //   : undefined;

      await db.insert(walletSwap).values(rows).onConflictDoNothing();
    }
    await db
      .insert(walletSwapMeta)
      .values({ address })
      .onConflictDoUpdate({
        target: [walletSwapMeta.address],
        set: {
          fetchedAt: new Date(),
          coveredFromSec: Math.floor(from / 1000),
          coveredToSec: Math.floor(to / 1000),
        },
      });
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
  }
}

export async function saveOverviewCache(overview: WalletOverview): Promise<void> {
  try {
    const now = new Date();
    const period24h = overview.periods["24H"];
    const period7d = overview.periods["7D"];
    const period30d = overview.periods["30D"];
    const period90d = overview.periods["90D"];
    const periodAll = overview.periods["All"];

    const keepIfNull = <T>(value: T | null | undefined): T | undefined =>
      value == null ? undefined : value;

    await db
      .insert(walletOverviewCache)
      .values({
        address: overview.address,
        totalAssetValueUsd: overview.holdings.totalAssetValueUsd,
        totalAssetValueChange24hPercent: overview.holdings.change24hPercent,
        tradingVolumeUsd24h: period24h.tradingVolumeUsd,
        tradingVolumeUsd7d: period7d.tradingVolumeUsd,
        tradingVolumeUsd30d: period30d.tradingVolumeUsd,
        tradingVolumeUsd90d: period90d.tradingVolumeUsd,
        tradingVolumeUsdAll: periodAll.tradingVolumeUsd,
        pnlUsdTotal: period24h.pnl.totalUsd,
        pnlTotalUsd24h: period24h.pnl.totalUsd,
        pnlTotalUsd7d: period7d.pnl.totalUsd,
        pnlTotalUsd30d: period30d.pnl.totalUsd,
        pnlTotalUsd90d: period90d.pnl.totalUsd,
        pnlTotalUsdAll: periodAll.pnl.totalUsd,
        pnlRealizedUsd24h: period24h.pnl.realizedUsd,
        pnlRealizedUsd7d: period7d.pnl.realizedUsd,
        pnlRealizedUsd30d: period30d.pnl.realizedUsd,
        pnlRealizedUsd90d: period90d.pnl.realizedUsd,
        pnlRealizedUsdAll: periodAll.pnl.realizedUsd,
        pnlUnrealizedUsd24h: period24h.pnl.unrealizedUsd,
        pnlUnrealizedUsd7d: period7d.pnl.unrealizedUsd,
        pnlUnrealizedUsd30d: period30d.pnl.unrealizedUsd,
        pnlUnrealizedUsd90d: period90d.pnl.unrealizedUsd,
        pnlUnrealizedUsdAll: periodAll.pnl.unrealizedUsd,
        transactionCount24h: period24h.transactionCount,
        transactionCount7d: period7d.transactionCount,
        transactionCount30d: period30d.transactionCount,
        transactionCount90d: period90d.transactionCount,
        transactionCountAll: periodAll.transactionCount,
        tokensTradedCount: period24h.tokensTradedCount,
        tokensTradedCount24h: period24h.tokensTradedCount,
        tokensTradedCount7d: period7d.tokensTradedCount,
        tokensTradedCount30d: period30d.tokensTradedCount,
        tokensTradedCount90d: period90d.tokensTradedCount,
        tokensTradedCountAll: periodAll.tokensTradedCount,
        buyTxCount24h: period24h.buy.transactionCount,
        buyTxCount7d: period7d.buy.transactionCount,
        buyTxCount30d: period30d.buy.transactionCount,
        buyTxCount90d: period90d.buy.transactionCount,
        buyTxCountAll: periodAll.buy.transactionCount,
        sellTxCount24h: period24h.sell.transactionCount,
        sellTxCount7d: period7d.sell.transactionCount,
        sellTxCount30d: period30d.sell.transactionCount,
        sellTxCount90d: period90d.sell.transactionCount,
        sellTxCountAll: periodAll.sell.transactionCount,
        buyVolumeUsd24h: period24h.buy.volumeUsd,
        buyVolumeUsd7d: period7d.buy.volumeUsd,
        buyVolumeUsd30d: period30d.buy.volumeUsd,
        buyVolumeUsd90d: period90d.buy.volumeUsd,
        buyVolumeUsdAll: periodAll.buy.volumeUsd,
        sellVolumeUsd24h: period24h.sell.volumeUsd,
        sellVolumeUsd7d: period7d.sell.volumeUsd,
        sellVolumeUsd30d: period30d.sell.volumeUsd,
        sellVolumeUsd90d: period90d.sell.volumeUsd,
        sellVolumeUsdAll: periodAll.sell.volumeUsd,
        tokensHoldingCount: overview.holdings.tokensHoldingCount,
        holdingsFetchedAt: now,
        activityFetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [walletOverviewCache.address],
        set: {
          totalAssetValueUsd: overview.holdings.totalAssetValueUsd,
          totalAssetValueChange24hPercent: keepIfNull(overview.holdings.change24hPercent),
          tradingVolumeUsd24h: keepIfNull(period24h.tradingVolumeUsd),
          tradingVolumeUsd7d: keepIfNull(period7d.tradingVolumeUsd),
          tradingVolumeUsd30d: keepIfNull(period30d.tradingVolumeUsd),
          tradingVolumeUsd90d: keepIfNull(period90d.tradingVolumeUsd),
          tradingVolumeUsdAll: keepIfNull(periodAll.tradingVolumeUsd),
          pnlUsdTotal: keepIfNull(period24h.pnl.totalUsd),
          pnlTotalUsd24h: keepIfNull(period24h.pnl.totalUsd),
          pnlTotalUsd7d: keepIfNull(period7d.pnl.totalUsd),
          pnlTotalUsd30d: keepIfNull(period30d.pnl.totalUsd),
          pnlTotalUsd90d: keepIfNull(period90d.pnl.totalUsd),
          pnlTotalUsdAll: keepIfNull(periodAll.pnl.totalUsd),
          pnlRealizedUsd24h: keepIfNull(period24h.pnl.realizedUsd),
          pnlRealizedUsd7d: keepIfNull(period7d.pnl.realizedUsd),
          pnlRealizedUsd30d: keepIfNull(period30d.pnl.realizedUsd),
          pnlRealizedUsd90d: keepIfNull(period90d.pnl.realizedUsd),
          pnlRealizedUsdAll: keepIfNull(periodAll.pnl.realizedUsd),
          pnlUnrealizedUsd24h: keepIfNull(period24h.pnl.unrealizedUsd),
          pnlUnrealizedUsd7d: keepIfNull(period7d.pnl.unrealizedUsd),
          pnlUnrealizedUsd30d: keepIfNull(period30d.pnl.unrealizedUsd),
          pnlUnrealizedUsd90d: keepIfNull(period90d.pnl.unrealizedUsd),
          pnlUnrealizedUsdAll: keepIfNull(periodAll.pnl.unrealizedUsd),
          transactionCount24h: keepIfNull(period24h.transactionCount),
          transactionCount7d: keepIfNull(period7d.transactionCount),
          transactionCount30d: keepIfNull(period30d.transactionCount),
          transactionCount90d: keepIfNull(period90d.transactionCount),
          transactionCountAll: keepIfNull(periodAll.transactionCount),
          tokensTradedCount: keepIfNull(period24h.tokensTradedCount),
          tokensTradedCount24h: keepIfNull(period24h.tokensTradedCount),
          tokensTradedCount7d: keepIfNull(period7d.tokensTradedCount),
          tokensTradedCount30d: keepIfNull(period30d.tokensTradedCount),
          tokensTradedCount90d: keepIfNull(period90d.tokensTradedCount),
          tokensTradedCountAll: keepIfNull(periodAll.tokensTradedCount),
          buyTxCount24h: keepIfNull(period24h.buy.transactionCount),
          buyTxCount7d: keepIfNull(period7d.buy.transactionCount),
          buyTxCount30d: keepIfNull(period30d.buy.transactionCount),
          buyTxCount90d: keepIfNull(period90d.buy.transactionCount),
          buyTxCountAll: keepIfNull(periodAll.buy.transactionCount),
          sellTxCount24h: keepIfNull(period24h.sell.transactionCount),
          sellTxCount7d: keepIfNull(period7d.sell.transactionCount),
          sellTxCount30d: keepIfNull(period30d.sell.transactionCount),
          sellTxCount90d: keepIfNull(period90d.sell.transactionCount),
          sellTxCountAll: keepIfNull(periodAll.sell.transactionCount),
          buyVolumeUsd24h: keepIfNull(period24h.buy.volumeUsd),
          buyVolumeUsd7d: keepIfNull(period7d.buy.volumeUsd),
          buyVolumeUsd30d: keepIfNull(period30d.buy.volumeUsd),
          buyVolumeUsd90d: keepIfNull(period90d.buy.volumeUsd),
          buyVolumeUsdAll: keepIfNull(periodAll.buy.volumeUsd),
          sellVolumeUsd24h: keepIfNull(period24h.sell.volumeUsd),
          sellVolumeUsd7d: keepIfNull(period7d.sell.volumeUsd),
          sellVolumeUsd30d: keepIfNull(period30d.sell.volumeUsd),
          sellVolumeUsd90d: keepIfNull(period90d.sell.volumeUsd),
          sellVolumeUsdAll: keepIfNull(periodAll.sell.volumeUsd),
          tokensHoldingCount: overview.holdings.tokensHoldingCount,
          holdingsFetchedAt: now,
          activityFetchedAt: now,
          fetchedAt: now,
        },
      });
  } catch (err) {
    console.error("Failed to save wallet overview cache", err);
  }
}

// not very optimised I know, this will have some overlap with swap db
export async function saveTransactionsHeliusCache(
  address: string,
  transactions: WalletTransactionHelius[],
  coveredRange?: { fromSec: number; toSec: number },
) {
  try {
    if (transactions.length > 0) {

      const uniqueBySignature = new Map<string, WalletTransactionHelius>();
      for (const tx of transactions) {
        if (!uniqueBySignature.has(tx.signature)) {
          uniqueBySignature.set(tx.signature, tx);
        }
      }

      const uniqueTransactions = Array.from(uniqueBySignature.values());

      const rows = uniqueTransactions.map((tx) => ({
        address: tx.walletAddress,
        signature: tx.signature,
        timestamp: new Date(Date.parse(tx.timestamp) || Date.now()),
        slot: tx.slot,
        fee: tx.fee,
        feePayer: tx.feePayer,
        // First two entries are the swap legs
        balanceChanges: tx.balanceChanges,
      }));

      await db.insert(walletHeliusTransactions).values(rows).onConflictDoNothing();
    }

    // Always update meta after every sync — including zero-row syncs — so the
    // next request can use the persisted coverage bounds to skip redundant
    // Helius fetches (Bug 4 fix).
    if (coveredRange != null) {
      const { fromSec, toSec } = coveredRange;
      await db
        .insert(walletTransactionsMeta)
        .values({ address, coveredFromSec: fromSec, coveredToSec: toSec })
        .onConflictDoUpdate({
          target: [walletTransactionsMeta.address],
          // Grow the persisted window: take the minimum lower bound (LEAST) and
          // the maximum upper bound (GREATEST) so that repeated partial syncs
          // accumulate into a continuously widening covered range.
          set: {
            fetchedAt: new Date(),
            coveredFromSec: sql`LEAST(COALESCE(wallet_transactions_meta.covered_from_sec, ${fromSec}), ${fromSec})`,
            coveredToSec: sql`GREATEST(COALESCE(wallet_transactions_meta.covered_to_sec, ${toSec}), ${toSec})`,
          },
        });
    } else {
      await db
        .insert(walletTransactionsMeta)
        .values({ address })
        .onConflictDoUpdate({
          target: [walletTransactionsMeta.address],
          set: { fetchedAt: new Date() },
        });
    }
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
  }
}

export async function saveTransfersCache(
  address: string,
  transfers: WalletTransfer[],
  from: number,
  to: number
): Promise<void> {
  try {
    // let coverageFromMs: number | undefined;
    // let coverageToMs: number | undefined;
    let firstAddress: string | undefined;
    let lastAddress: string | undefined;


    if (transfers.length > 0) {
      // Deduplicate by transaction signature + instruction index to avoid multiple rows
      // with the same primary key when providers return duplicate transfer records.
      const uniqueKey = (t: WalletTransfer) => `${t.transactionSignature}-${t.instructionIndex}`;
      const uniqueByKey = new Map<string, WalletTransfer>();
      for (const transfer of transfers) {
        const key = uniqueKey(transfer);
        if (!uniqueByKey.has(key)) {
          uniqueByKey.set(key, transfer);
        }
      }

      const uniqueTransfers = Array.from(uniqueByKey.values());

      const rows = uniqueTransfers.map((t) => ({
        address,
        fromOwner: t.from,
        toOwner: t.to,
        amount: t.amount,
        amountUsd: t.amountUsd ?? 0,
        blockTime: new Date(Date.parse(t.timestamp) || Date.now()),
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        transactionSignature: t.transactionSignature,
        instructionIndex: t.instructionIndex,
      }));

      const coverageBounds = rows.length > 0
        ? rows.reduce(
          (bounds, row) => (
            {
              fromMs: Math.min(bounds.fromMs, row.blockTime.getTime()),
              toMs: Math.max(bounds.toMs, row.blockTime.getTime()),
              lastAddress: bounds.fromMs < row.blockTime.getTime() ? bounds.lastAddress : row.address,
              firstAddress: bounds.toMs < row.blockTime.getTime() ? row.address : bounds.firstAddress
            }),
          {
            fromMs: Number.POSITIVE_INFINITY,
            toMs: Number.NEGATIVE_INFINITY,
            lastAddress: "",
            firstAddress: ""
          },
        )
        : null;

      // coverageFromMs = coverageBounds
      //   ? coverageBounds.fromMs
      //   : undefined;
      // coverageToMs = coverageBounds
      //   ? coverageBounds.toMs
      //   : undefined;

      firstAddress = coverageBounds
        ? coverageBounds.firstAddress
        : undefined;

      lastAddress = coverageBounds
        ? coverageBounds.lastAddress
        : undefined;


      await db.insert(tokenTransfers).values(rows).onConflictDoNothing();
    }

    await db
      .insert(walletTransferMeta)
      .values({ address })
      .onConflictDoUpdate({
        target: [walletTransferMeta.address],
        set: {
          fetchedAt: new Date(),
          coveredFromSec: Math.floor(from / 1000),
          coveredToSec: Math.floor(to / 1000),
          coveredFromCursor: lastAddress,
          coveredToCursor: firstAddress
        },
      });
  } catch (err) {
    console.error("Failed to save wallet transfers cache", err);
  }
}

/**
 * Save wallet balance history cache to database
 * Only caches historical data up to yesterday's end; today's point is never persisted
 * @param address - wallet address
 * @param timePeriod - time period (7D, 30D, 60D, 90D, 1Y, All, 24H)
 * @param points - balance data points (historical only, excludes today)
 * @param coveredFromMs - earliest UTC day-start millisecond in cached data
 * @param coveredToMs - latest UTC day-start millisecond in cached data (never includes today)
 */
/**
 * Save wallet balance history cache to database
 * Only caches historical data up to yesterday's end; today's point is never persisted
 * @param address - wallet address
 * @param timePeriod - time period (7D, 30D, 60D, 90D, 1Y, All, 24H)
 * @param points - balance data points (historical only, excludes today)
 * @param coveredFromMs - earliest UTC day-start millisecond in cached data
 * @param coveredToMs - latest UTC day-start millisecond in cached data (never includes today)
 */
export async function saveBalanceHistoryCache(
  address: string,
  timePeriod: WalletTimePeriod,
  points: BalanceDataPoint[],
  coveredFromMs: number,
  coveredToMs: number,
): Promise<void> {
  try {
    await db
      .insert(walletBalanceHistoryCache)
      .values({
        address,
        timePeriod,
        data: points as any,
        coveredFromMs,
        coveredToMs,
      })
      .onConflictDoUpdate({
        target: [walletBalanceHistoryCache.address, walletBalanceHistoryCache.timePeriod],
        set: {
          data: points as any,
          fetchedAt: new Date(),
          coveredFromMs,
          coveredToMs,
        },
      });
  } catch (err) {
    console.error("Failed to save wallet balance history cache", err);
  }
}

export async function saveWalletFirstFundCache(
  firstFund: HeliusWalletFirstFund,
) {
  try {
    await db
      .insert(walletFirstFund)
      .values(firstFund)
      .onConflictDoUpdate({
        target: [walletFirstFund.reciepient],
        set: {
          ...firstFund,
        },
      });
  } catch (err) {
    console.error("Failed to save wallet first fund cache", err);
  }
}

/**
 * Save wallet PnL data cache and metadata.
 *
 * Accepts:
 * - address: wallet address
 * - timePeriod: e.g. "7D"
 * - aggregation: e.g. "daily", "hourly"
 * - dailyData: array of daily PnL records with {dayStartMs, dailyPnl, cumulativePnl, dayOpen, dayClose}
 * - coverageFromMs, coverageToMs: PnL cache coverage range
 * - sourceBalanceRangeFromMs, sourceBalanceRangeToMs: balance history source range
 * - sourceTransferRangeFromMs, sourceTransferRangeToMs: transfer history source range
 *
 * Upserts both walletPnlDataCache (per-day rows) and walletPnlDataMeta (coverage) in two operations.
 */
export async function saveWalletPnlCache(
  address: string,
  timePeriod: string,
  aggregation: string,
  dailyData: Array<{
    dayStartMs: number;
    dailyPnl: number | string;
    cumulativePnl: number | string;
    dayOpen: number | string;
    dayClose: number | string;
  }>,
  coverageFromMs: number,
  coverageToMs: number,
  sourceBalanceRangeFromMs: number,
  sourceBalanceRangeToMs: number,
  sourceTransferRangeFromMs: number,
  sourceTransferRangeToMs: number,
): Promise<void> {
  try {
    // Insert/upsert daily PnL rows. Each day gets its own row with (address, timePeriod, aggregation, dayStartMs) as PK.
    if (dailyData.length > 0) {
      const rows = dailyData.map((d) => ({
        address,
        timePeriod,
        aggregation,
        dayStartMs: d.dayStartMs,
        dailyPnl: Number(d.dailyPnl),
        cumulativePnl: Number(d.cumulativePnl),
        dayOpen: Number(d.dayOpen),
        dayClose: Number(d.dayClose),
        computedAt: new Date(),
      }));

      await db.insert(walletPnlDataCache).values(rows).onConflictDoNothing();
    }

    // Upsert metadata to track coverage and source ranges.
    await db
      .insert(walletPnlDataMeta)
      .values({
        address,
        timePeriod,
        aggregation,
        coverageFromMs,
        coverageToMs,
        sourceBalanceRangeFromMs,
        sourceBalanceRangeToMs,
        sourceTransferRangeFromMs,
        sourceTransferRangeToMs,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [walletPnlDataMeta.address, walletPnlDataMeta.timePeriod, walletPnlDataMeta.aggregation],
        set: {
          coverageFromMs,
          coverageToMs,
          sourceBalanceRangeFromMs,
          sourceBalanceRangeToMs,
          sourceTransferRangeFromMs,
          sourceTransferRangeToMs,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("Failed to save wallet PnL cache", err);
  }
}