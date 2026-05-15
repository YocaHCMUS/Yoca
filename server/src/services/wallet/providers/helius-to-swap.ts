import type {
  WalletSwap,
  WalletSwapTokenChange,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import type {
  HeliusEnhancedTransaction,
  HeliusEnhancedNativeTransfer,
} from "@sv/services/transactions.js";
import { toIsoTimestamp } from "@sv/services/wallet/fetchers/walletProviderMappers.js";


const SOL_MINT = "So11111111111111111111111111111111111111112";
const SYSTEM_PROGRAMS = new Set([
  "ComputeBudget111111111111111111111111111111",
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
]);
const RENT_LIKE_LAMPORTS = [2_039_280, 2_074_080];

function isRentExemptLikeLamports(amountLamports: number): boolean {
  if (!Number.isFinite(amountLamports) || amountLamports <= 0) return false;
  return RENT_LIKE_LAMPORTS.some(
    (rent) => Math.abs(amountLamports - rent) <= 120_000,
  );
}

function extractSwapProgramId(
  tx: HeliusEnhancedTransaction,
): string | null {
  const instructions = tx.instructions ?? [];
  for (const ins of instructions) {
    const programId = String(ins.programId ?? "").trim();
    if (programId && !SYSTEM_PROGRAMS.has(programId)) {
      return programId;
    }
  }
  return null;
}

function findSwapNativeTransfer(
  nativeTransfers: HeliusEnhancedNativeTransfer[] | undefined,
  walletAddress: string,
  direction: "from" | "to",
): { lamports: number; counterparty: string } | null {
  let bestLamports = 0;
  let bestCounterparty = "";
  for (const nt of nativeTransfers ?? []) {
    const amount = Number(nt.amount ?? 0);
    if (amount <= 0 || isRentExemptLikeLamports(amount)) continue;
    const sender = String(nt.fromUserAccount ?? "").trim();
    const receiver = String(nt.toUserAccount ?? "").trim();
    if (direction === "from" && sender === walletAddress && amount > bestLamports) {
      bestLamports = amount;
      bestCounterparty = receiver;
    }
    if (direction === "to" && receiver === walletAddress && amount > bestLamports) {
      bestLamports = amount;
      bestCounterparty = sender;
    }
  }
  return bestLamports > 0 ? { lamports: bestLamports, counterparty: bestCounterparty } : null;
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

  const hasTokenOut = tokenTransfers.some(
    (t) =>
      t.fromUserAccount === walletAddress &&
      Number(t.tokenAmount ?? t.amount ?? 0) > 0,
  );

  const hasTokenIn = tokenTransfers.some(
    (t) =>
      t.toUserAccount === walletAddress &&
      Number(t.tokenAmount ?? t.amount ?? 0) > 0,
  );

  let hasNativeOut = false;
  let hasNativeIn = false;
  for (const nt of nativeTransfers) {
    const amount = Number(nt.amount ?? 0);
    if (amount <= 0 || isRentExemptLikeLamports(amount)) continue;
    if (nt.fromUserAccount === walletAddress) hasNativeOut = true;
    if (nt.toUserAccount === walletAddress) hasNativeIn = true;
  }

  // SOL/TOKEN pair swap
  if (hasTokenIn && hasNativeOut) return "swap";
  if (hasTokenOut && hasNativeIn) return "swap";

  const outMints = new Set<string>();
  const inMints = new Set<string>();
  for (const t of tokenTransfers) {
    const mint = String(t.mint ?? "").trim();
    if (!mint || Number(t.tokenAmount ?? t.amount ?? 0) <= 0) continue;
    if (t.fromUserAccount === walletAddress) outMints.add(mint);
    if (t.toUserAccount === walletAddress) inMints.add(mint);
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
  const source = String(
    tx.source ?? "",
  ).trim();
  const programId = extractSwapProgramId(tx);

  const tokenTransfers = tx.tokenTransfers ?? [];
  const nativeTransfers = tx.nativeTransfers ?? [];

  const outflows: Array<{ mint: string; amount: number; counterParty: string }> = [];
  const inflows: Array<{ mint: string; amount: number; counterParty: string }> = [];

  for (const t of tokenTransfers) {
    const mint = String(t.mint ?? "").trim();
    const amount = Number(t.tokenAmount ?? t.amount ?? 0);
    const fromAccount = t.fromUserAccount || ""
    const toAccount = t.toUserAccount || ""
    if (!mint || amount <= 0) continue;
    if (fromAccount === signer) outflows.push({ mint, amount, counterParty: toAccount });
    if (toAccount === signer) inflows.push({ mint, amount, counterParty: fromAccount });
  }

  let counterparty: string;
  let bought: WalletSwapTokenChange | null = null;
  let sold: WalletSwapTokenChange | null = null;

  if (outflows.length > 0 && inflows.length > 0) {
    const maxOut = outflows.reduce((a, b) => (a.amount > b.amount ? a : b));
    const maxIn = inflows.reduce((a, b) => (a.amount > b.amount ? a : b));
    sold = buildSwapLeg(maxOut.mint, maxOut.amount);
    bought = buildSwapLeg(maxIn.mint, maxIn.amount);
    counterparty = maxOut.counterParty || maxIn.counterParty || "unknown";
  } else if (outflows.length > 0) {
    const nativeInflow = findSwapNativeTransfer(nativeTransfers, signer, "to");
    if (!nativeInflow) return null;
    const maxOut = outflows.reduce((a, b) => (a.amount > b.amount ? a : b));
    sold = buildSwapLeg(maxOut.mint, maxOut.amount);
    bought = buildSwapLeg(SOL_MINT, nativeInflow.lamports / 1e9);
    counterparty = nativeInflow.counterparty;
  } else if (inflows.length > 0) {
    const nativeOutflow = findSwapNativeTransfer(nativeTransfers, signer, "from");
    if (!nativeOutflow) return null;
    const maxIn = inflows.reduce((a, b) => (a.amount > b.amount ? a : b));
    bought = buildSwapLeg(maxIn.mint, maxIn.amount);
    sold = buildSwapLeg(SOL_MINT, nativeOutflow.lamports / 1e9);
    counterparty = nativeOutflow.counterparty;
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
