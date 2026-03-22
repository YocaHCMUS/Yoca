import { db } from "@sv/db/index.js";
import { walletSwap, walletTransactionsMeta, walletOverviewCache, walletTransactions, tokenTransfers, walletHeliusTransactions, walletSwapMeta, walletTransferMeta, walletBalanceHistoryCache } from "@sv/db/schema.js";
import { eq, sql } from "drizzle-orm";
import type { WalletSwap, WalletOverview, WalletTransaction, WalletTransfer, WalletTransactionHelius, BalanceDataPoint, WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";


export async function saveSwapsCache(
  address: string,
  transactions: WalletSwap[],
) {
  try {
    if (transactions.length > 0) {
      // Deduplicate by transaction hash to avoid multiple rows with the same
      // (address, signature) primary key when providers return several
      // legs for a single on-chain transaction.
      const uniqueBySignature = new Map<string, WalletSwap>();
      for (const tx of transactions) {
        if (!uniqueBySignature.has(tx.signature)) {
          uniqueBySignature.set(tx.signature, tx);
        }
      }

      const uniqueTransactions = Array.from(uniqueBySignature.values());

      const rows = uniqueTransactions.map((tx) => ({
        address: tx.walletAddress,
        signature: tx.signature,
        blockTimestamp: new Date(Date.parse(tx.timestamp) || Date.now()),
        slot: tx.slot,
        fee: tx.fee,
        feePayer: tx.feePayer,
        transactionType: tx.transactionType ?? null,
        subCategory: tx.subCategory ?? null,
        blockNumber: tx.blockNumber ?? null,
        exchange: tx.exchange ?? null,
        pair: tx.pair ?? null,
        sold: tx.sold ?? null,
        bought: tx.bought ?? null,
        baseQuotePrice: tx.baseQuotePrice ?? null,
        totalValueUsd: tx.totalValueUsd ?? null,
        source: tx.source ?? null,
        // First two entries are the swap legs
        swapBalanceChanges: tx.balanceChanges,
        feeBalanceChanges: tx.feeChanges,
      }));

      await db.insert(walletSwap).values(rows).onConflictDoNothing();
    }
    await db
      .insert(walletSwapMeta)
      .values({ address })
      .onConflictDoUpdate({
        target: [walletSwapMeta.address],
        set: { fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
  }
}

export async function saveOverviewCache(overview: WalletOverview): Promise<void> {
  try {
    await db
      .insert(walletOverviewCache)
      .values({
        address: overview.address,
        totalAssetValueUsd: overview.totalAssetValueUsd,
        tradingVolumeUsd24h: overview.tradingVolumeUsd24h ?? null,
        pnlUsdTotal: overview.pnlUsdTotal ?? null,
        transactionCount24h: overview.transactionCount24h ?? null,
        tokensTradedCount: overview.tokensTradedCount ?? null,
        tokensHoldingCount: overview.tokensHoldingCount,
      })
      .onConflictDoUpdate({
        target: [walletOverviewCache.address],
        set: {
          totalAssetValueUsd: overview.totalAssetValueUsd,
          tradingVolumeUsd24h: overview.tradingVolumeUsd24h ?? null,
          pnlUsdTotal: overview.pnlUsdTotal ?? null,
          transactionCount24h: overview.transactionCount24h ?? null,
          tokensTradedCount: overview.tokensTradedCount ?? null,
          tokensHoldingCount: overview.tokensHoldingCount,
          fetchedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("Failed to save wallet overview cache", err);
  }
}

export async function saveTransactionsCache(
  address: string,
  transactions: WalletTransaction[],
): Promise<void> {
  try {
    await db.delete(walletTransactions).where(
      eq(walletTransactions.address, address)
    );

    if (transactions.length > 0) {
      // Deduplicate by transaction hash to avoid multiple rows with the same
      // (address, hash) primary key when providers return several
      // legs for a single on-chain transaction.
      const uniqueByHash = new Map<string, WalletTransaction>();
      for (const tx of transactions) {
        if (!uniqueByHash.has(tx.hash)) {
          uniqueByHash.set(tx.hash, tx);
        }
      }

      const uniqueTransactions = Array.from(uniqueByHash.values());

      const rows = uniqueTransactions.map((tx) => ({
        address,
        hash: tx.hash,
        blockTimestamp: new Date(Date.parse(tx.timestamp) || Date.now()),
        fromAddress: tx.from,
        toAddress: tx.to,
        receiptStatus: tx.status === true ? 1 : tx.status === false ? 0 : null,
        fee: tx.fee ?? null,
        mainAction: tx.mainAction ?? null,
        direction: tx.direction ?? null,
        primaryTokenSymbol: tx.primaryTokenSymbol ?? null,
        primaryTokenAmount: tx.primaryTokenAmount ?? null,
        primaryTokenAddress: tx.primaryTokenAddress ?? null,
        // Price fields are response-time enrichments and are not persisted.
        priceUsd: null,
        totalUsd: null,
        tokens: tx.tokens ?? null,
      }));

      await db.insert(walletTransactions).values(rows);
    }
    await db
      .insert(walletTransactionsMeta)
      .values({ address })
      .onConflictDoUpdate({
        target: [walletTransactionsMeta.address],
        set: { fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
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
): Promise<void> {
  try {
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
        // amountUsd is required by schema but not provided by API at fetch time.
        // Set to 0 as placeholder; real-time pricing is handled via enrichWithSolanaTokenPrices.
        amountUsd: 0,
        blockTime: new Date(Date.parse(t.timestamp) || Date.now()),
        tokenAddress: t.tokenAddress,
        tokenSymbol: t.tokenSymbol,
        transactionSignature: t.transactionSignature,
        instructionIndex: t.instructionIndex,
      }));

      await db.insert(tokenTransfers).values(rows).onConflictDoNothing();
    }
    await db
      .insert(walletTransferMeta)
      .values({ address })
      .onConflictDoUpdate({
        target: [walletTransferMeta.address],
        set: { fetchedAt: new Date() },
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

