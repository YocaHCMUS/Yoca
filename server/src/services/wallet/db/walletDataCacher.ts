import { db } from "@sv/db/index.js";
import { walletSwap, walletTransactionsMeta, walletOverviewCache, walletTransactions, tokenTransfers, walletHeliusTransactions, walletSwapMeta, walletTransferMeta } from "@sv/db/schema.js";
import { and, eq } from "drizzle-orm";
import type { WalletSwap, WalletOverview, WalletTransaction, WalletTransfer, WalletTransactionHelius } from "@sv/services/wallet/dtos/walletDataObjects.js";


export async function saveSwapsCache(
  address: string,
  chain: string,
  transactions: WalletSwap[],
) {
  try {
    if (transactions.length > 0) {
      // Deduplicate by transaction hash to avoid multiple rows with the same
      // (address, chain, hash) primary key when providers return several
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
        chain: 'Solana',
        signature: tx.signature,
        blockTimestamp: new Date(Date.parse(tx.timestamp) || Date.now()),
        slot: tx.slot,
        fee: tx.fee,
        feePayer: tx.feePayer,
        // First two entries are the swap legs
        swapBalanceChanges: tx.balanceChanges,
        feeBalanceChanges: tx.feeChanges,
      }));

      await db.insert(walletSwap).values(rows);
    }
    await db
      .insert(walletSwapMeta)
      .values({ address, chain })
      .onConflictDoUpdate({
        target: [walletSwapMeta.address, walletSwapMeta.chain],
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
        chain: overview.chain,
        totalAssetValueUsd: overview.totalAssetValueUsd,
        tradingVolumeUsd24h: overview.tradingVolumeUsd24h ?? null,
        pnlUsdTotal: overview.pnlUsdTotal ?? null,
        transactionCount24h: overview.transactionCount24h ?? null,
        tokensTradedCount: overview.tokensTradedCount ?? null,
        tokensHoldingCount: overview.tokensHoldingCount,
      })
      .onConflictDoUpdate({
        target: [walletOverviewCache.address, walletOverviewCache.chain],
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
  chain: string,
  transactions: WalletTransaction[],
): Promise<void> {
  try {
    await db.delete(walletTransactions).where(
      and(
        eq(walletTransactions.address, address),
        eq(walletTransactions.chain, chain),
      ),
    );

    if (transactions.length > 0) {
      // Deduplicate by transaction hash to avoid multiple rows with the same
      // (address, chain, hash) primary key when providers return several
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
        chain,
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
      .values({ address, chain })
      .onConflictDoUpdate({
        target: [walletTransactionsMeta.address, walletTransactionsMeta.chain],
        set: { fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
  }
}

// not very optimised I know, this will have some overlap with swap db
export async function saveTransactionsHeliusCache(  
  address: string,
  chain: string,
  transactions: WalletTransactionHelius[],
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
        chain: 'Solana',
        signature: tx.signature,
        timestamp: new Date(Date.parse(tx.timestamp) || Date.now()),
        slot: tx.slot,
        fee: tx.fee,
        feePayer: tx.feePayer,
        // First two entries are the swap legs
        balanceChanges: tx.balanceChanges,
      }));

      await db.insert(walletHeliusTransactions).values(rows);
    }
    await db
      .insert(walletTransactionsMeta)
      .values({ address, chain })
      .onConflictDoUpdate({
        target: [walletTransactionsMeta.address, walletTransactionsMeta.chain],
        set: { fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
  }
}

export async function saveTransfersCache(
  address: string,
  chain: string,
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
        chain,
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

      await db.insert(tokenTransfers).values(rows);
    }
    await db
      .insert(walletTransferMeta)
      .values({ address, chain })
      .onConflictDoUpdate({
        target: [walletTransferMeta.address, walletTransferMeta.chain],
        set: { fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet transfers cache", err);
  }
}

