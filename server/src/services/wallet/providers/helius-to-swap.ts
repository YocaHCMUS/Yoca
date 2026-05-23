import type {
  WalletSwap,
  WalletSwapTokenChange,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import type { HeliusEnhancedTransaction } from "@sv/services/transactions.js";
import { toIsoTimestamp } from "@sv/services/wallet/fetchers/walletProviderMappers.js";


const SOL_MINT = "So11111111111111111111111111111111111111112";
const RENT_LIKE_LAMPORTS = [2_039_280, 2_074_080];

function buildTokenAccountOwnership(
  tokenTransfers: HeliusEnhancedTransaction["tokenTransfers"],
): Map<string, string> {
  const ownership = new Map<string, string>();
  console.log("Building token account ownership map from token transfers:", tokenTransfers);
  for (const t of tokenTransfers ?? []) {
    const fromTA = t.fromTokenAccount ?? "";
    const toTA = t.toTokenAccount ?? "";
    const fromUA = t.fromUserAccount ?? "";
    const toUA = t.toUserAccount ?? "";
    if (fromTA && fromUA) ownership.set(fromTA, fromUA);
    if (toTA && toUA) ownership.set(toTA, toUA);
  }
  return ownership;
}

function resolveOwner(
  account: string,
  ownershipMap: Map<string, string>,
): string {
  return ownershipMap.get(account) ?? account;
}

export function isRentExemptLikeLamports(amountLamports: number): boolean {
  if (!Number.isFinite(amountLamports) || amountLamports <= 0) return false;
  return RENT_LIKE_LAMPORTS.some(
    (rent) => Math.abs(amountLamports - rent) <= 120_000,
  );
}

function buildSwapLeg(mint: string, amount: number): WalletSwapTokenChange {
  return {
    address: mint || "unknown",
    amount,
    symbol: null,
    name: null,
    logoUri: null,
    priceUsd: 0,
    valueUsd: 0,
  };
}

export function classifyTransaction(
  tx: HeliusEnhancedTransaction,
  walletAddress: string,
): "swap" | "transfer" {
  if (tx.type === "SWAP" || tx.events?.swap) return "swap";

  const tokenTransfers = tx.tokenTransfers ?? [];
  const nativeTransfers = tx.nativeTransfers ?? [];
  const ownership = buildTokenAccountOwnership(tokenTransfers);

  const hasTokenOut = tokenTransfers.some((t) => {
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    if (amount <= 0) return false;
    const fromOwner = resolveOwner(String(t.fromUserAccount ?? ""), ownership);
    const toOwner = resolveOwner(String(t.toUserAccount ?? ""), ownership);
    return fromOwner === walletAddress && toOwner !== walletAddress;
  });

  const hasTokenIn = tokenTransfers.some((t) => {
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    if (amount <= 0) return false;
    const fromOwner = resolveOwner(String(t.fromUserAccount ?? ""), ownership);
    const toOwner = resolveOwner(String(t.toUserAccount ?? ""), ownership);
    return toOwner === walletAddress && fromOwner !== walletAddress;
  });

  let hasNativeOut = false;
  let hasNativeIn = false;
  for (const nt of nativeTransfers) {
    const amount = Number(nt.amount ?? 0);
    if (amount <= 0 || isRentExemptLikeLamports(amount)) continue;
    const fromOwner = resolveOwner(String(nt.fromUserAccount ?? ""), ownership);
    const toOwner = resolveOwner(String(nt.toUserAccount ?? ""), ownership);
    if (fromOwner === walletAddress && toOwner !== walletAddress) hasNativeOut = true;
    if (toOwner === walletAddress && fromOwner !== walletAddress) hasNativeIn = true;
  }

  // SOL/TOKEN pair swap
  if (hasTokenIn && hasNativeOut) return "swap";
  if (hasTokenOut && hasNativeIn) return "swap";

  const outMints = new Set<string>();
  const inMints = new Set<string>();
  for (const t of tokenTransfers) {
    const mint = String(t.mint ?? "").trim();
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    if (!mint || amount <= 0) continue;
    const fromOwner = resolveOwner(String(t.fromUserAccount ?? ""), ownership);
    const toOwner = resolveOwner(String(t.toUserAccount ?? ""), ownership);
    if (fromOwner === walletAddress && toOwner !== walletAddress) outMints.add(mint);
    if (toOwner === walletAddress && fromOwner !== walletAddress) inMints.add(mint);
  }

  // TOKEN/TOKEN swap
  if (outMints.size > 0 && inMints.size > 0) {
    const allMints = new Set([...outMints, ...inMints]);
    if (allMints.size > 1) return "swap";
  }

  return "transfer";
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

  const signer = walletAddress;

  const tokenTransfers = tx.tokenTransfers ?? [];
  const nativeTransfers = tx.nativeTransfers ?? [];
  const ownership = buildTokenAccountOwnership(tokenTransfers);

  console.log("Ownership map:", ownership);

  const NET_ZERO_THRESHOLD = 1e-10;
  const netMap = new Map<string, number>();

  for (const t of tokenTransfers) {
    const mint = String(t.mint ?? "").trim();
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    if (!mint || amount <= 0) continue;
    const fromOwner = resolveOwner(String(t.fromUserAccount ?? ""), ownership);
    const toOwner = resolveOwner(String(t.toUserAccount ?? ""), ownership);
    if (fromOwner === toOwner) continue;
    if (fromOwner === signer) netMap.set(mint, (netMap.get(mint) ?? 0) - amount);
    if (toOwner === signer) netMap.set(mint, (netMap.get(mint) ?? 0) + amount);
  }

  for (const nt of nativeTransfers) {
    const amount = Number(nt.amount ?? 0);
    if (amount <= 0 || isRentExemptLikeLamports(amount)) continue;
    const solAmount = amount / 1e9;
    const fromOwner = resolveOwner(String(nt.fromUserAccount ?? ""), ownership);
    const toOwner = resolveOwner(String(nt.toUserAccount ?? ""), ownership);
    if (fromOwner === toOwner) continue;
    if (fromOwner === signer) netMap.set(SOL_MINT, (netMap.get(SOL_MINT) ?? 0) - solAmount);
    if (toOwner === signer) netMap.set(SOL_MINT, (netMap.get(SOL_MINT) ?? 0) + solAmount);
  }

  const outflows: Array<{ mint: string; amount: number }> = [];
  const inflows: Array<{ mint: string; amount: number }> = [];
  for (const [mint, net] of netMap) {
    if (Math.abs(net) <= NET_ZERO_THRESHOLD) continue;
    if (net < 0) outflows.push({ mint, amount: -net });
    else inflows.push({ mint, amount: net });
  }

  const counterparty = "unknown";
  let bought: WalletSwapTokenChange | null = null;
  let sold: WalletSwapTokenChange | null = null;

  if (outflows.length > 0 && inflows.length > 0) {
    const maxOut = outflows.reduce((a, b) => (a.amount > b.amount ? a : b));
    const maxIn = inflows.reduce((a, b) => (a.amount > b.amount ? a : b));
    sold = buildSwapLeg(maxOut.mint, maxOut.amount);
    bought = buildSwapLeg(maxIn.mint, maxIn.amount);
  } else {
    return null;
  }

  const tokensInvolved = [sold.address, bought.address]
    .filter((a, i, arr) => arr.indexOf(a) === i)
    .join(",");

  const transactionType = "SWAP";

  return {
    transactionHash: txnHash,
    transactionType,
    blockTimestampIso,
    subcategory: null,
    walletAddress: signer,
    pairAddress: counterparty,
    tokensInvolved,
    bought,
    sold,
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
