import type { WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";
import type { HeliusEnhancedTransaction } from "@sv/services/transactions.js";
import {
  toIsoTimestamp,
} from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { classifyTransaction } from "./helius-to-swap.js";

export function mapHeliusTxToTransfers(
  tx: HeliusEnhancedTransaction,
  walletAddress: string,
): WalletTransfer[] {
  if (classifyTransaction(tx, walletAddress) === "swap") return [];

  const tsSec = Number(tx.timestamp ?? tx.info?.timestamp ?? 0);
  if (!tsSec) return [];

  const blockTimestampIso = toIsoTimestamp(tsSec);
  if (!blockTimestampIso) return [];

  const txnSig = String(tx.signature ?? "").trim();
  if (!txnSig) return [];

  const tokenTransfers = tx.tokenTransfers ?? [];
  const transfers: WalletTransfer[] = [];

  for (let i = 0; i < tokenTransfers.length; i++) {
    const tt = tokenTransfers[i];
    const mint = String(tt.mint ?? "").trim();
    const amount = Number(tt.tokenAmount ?? tt.amount ?? 0);
    const from = String(tt.fromUserAccount ?? tt.fromWallet ?? "").trim();
    const to = String(tt.toUserAccount ?? tt.toWallet ?? "").trim();

    if (!mint || amount <= 0 || !from || !to) continue;

    transfers.push({
      from,
      to,
      amount,
      timestamp: blockTimestampIso,
      tokenAddress: mint,
      tokenSymbol: String(tt.symbol ?? tt.tokenSymbol ?? "").trim() || "unknown",
      transactionSignature: txnSig,
      instructionIndex: i,
    });
  }

  return transfers;
}

export function mapHeliusTxsToTransfers(
  txs: HeliusEnhancedTransaction[],
  walletAddress: string,
): WalletTransfer[] {
  const transfers: WalletTransfer[] = [];
  for (const tx of txs) {
    const mapped = mapHeliusTxToTransfers(tx, walletAddress);
    transfers.push(...mapped);
  }
  return transfers;
}
