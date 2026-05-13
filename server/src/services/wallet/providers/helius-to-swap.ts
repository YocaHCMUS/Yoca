import type {
  WalletSwap,
  WalletSwapTokenChange,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import type { HeliusEnhancedTransaction } from "@sv/services/transactions.js";
import { toIsoTimestamp } from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { exchangeName, exchangeLogo } from "./exchange-registry.js";

export function classifyTransaction(
  tx: HeliusEnhancedTransaction,
  walletAddress: string,
): "swap" | "transfer" {
  if (tx.events?.swap) return "swap";

  const transfers = tx.tokenTransfers ?? [];
  const outMints = new Set<string>();
  const inMints = new Set<string>();

  for (const t of transfers) {
    const mint = String(t.mint ?? "").trim();
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    if (!mint || amount <= 0) continue;
    if (t.fromUserAccount === walletAddress) outMints.add(mint);
    if (t.toUserAccount === walletAddress) inMints.add(mint);
  }

  if (outMints.size > 0 && inMints.size > 0) {
    const allMints = new Set([...outMints, ...inMints]);
    if (allMints.size > 1) return "swap";
  }

  return "transfer";
}

function buildSwapLeg(
  mint: string,
  amount: number,
  symbol: string | null,
): WalletSwapTokenChange {
  return {
    address: mint || "unknown",
    amount,
    symbol,
    name: null,
    logoUri: null,
    priceUsd: 0,
    valueUsd: 0,
  };
}

export function mapHeliusTxToSwap(
  tx: HeliusEnhancedTransaction,
  walletAddress: string,
): WalletSwap | null {
  const txnHash = String(tx.signature ?? "").trim();
  if (!txnHash) return null;

  const tsSec = Number(tx.timestamp ?? tx.info?.timestamp ?? 0);
  if (!tsSec) return null;

  const blockTimestampIso = toIsoTimestamp(tsSec);
  if (!blockTimestampIso) return null;

  const transfers = tx.tokenTransfers ?? [];
  const signer = walletAddress;

  const source = String(
    tx.source ?? tx.events?.swap?.source ?? tx.programName ?? "",
  ).trim();

  const outflows: Array<{ mint: string; amount: number }> = [];
  const inflows: Array<{ mint: string; amount: number }> = [];

  for (const t of transfers) {
    const mint = String(t.mint ?? "").trim();
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    if (!mint || amount <= 0) continue;
    if (t.fromUserAccount === signer) outflows.push({ mint, amount });
    if (t.toUserAccount === signer) inflows.push({ mint, amount });
  }

  if (outflows.length === 0 || inflows.length === 0) return null;

  const sold = outflows.reduce((best, curr) =>
    curr.amount > best.amount ? curr : best,
  );
  const bought = inflows.reduce((best, curr) =>
    curr.amount > best.amount ? curr : best,
  );

  const tokensInvolved = [...new Set([sold.mint, bought.mint])].join(",");

  const txTypeRaw = tx.events?.swap?.source ?? source;
  const transactionType = txTypeRaw.toUpperCase() || "SWAP";

  return {
    transactionHash: txnHash,
    transactionType,
    blockTimestampIso,
    subcategory: null,
    walletAddress: signer,
    pairAddress: "unknown",
    tokensInvolved,
    exchangeAddress: source || "unknown",
    exchangeName: exchangeName(source) || "Unknown",
    exchangeLogo: exchangeLogo(source) || "",
    bought: buildSwapLeg(bought.mint, bought.amount, null),
    sold: buildSwapLeg(sold.mint, sold.amount, null),
    totalValueUsd: null,
    baseQuotePrice: null,
  };
}

export function mapHeliusTxsToSwaps(
  txs: HeliusEnhancedTransaction[],
  walletAddress: string,
): WalletSwap[] {
  const swaps: WalletSwap[] = [];
  for (const tx of txs) {
    if (classifyTransaction(tx, walletAddress) !== "swap") continue;
    const mapped = mapHeliusTxToSwap(tx, walletAddress);
    if (mapped) swaps.push(mapped);
  }
  return swaps;
}
