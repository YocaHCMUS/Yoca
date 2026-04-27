import { useLocalization } from "@/contexts/LocalizationContext";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import type { Edge, Node } from "reactflow";
import ReactFlow, {
    Background,
    Controls,
    useEdgesState,
    useNodesState
} from "reactflow";
import "reactflow/dist/style.css";
import { TransactionActionsList } from "./components/TransactionActionsList";
import { TransactionOverviewPanel } from "./components/TransactionOverviewPanel";
import { CurvedEdge } from "./edges/CurvedEdge";
import styles from "./index.module.scss";
import { WalletNode } from "./nodes/WalletNode";
import { HoverContext } from "./shared/HoverContext";
import type { SummaryFlow } from "./shared/types";

/* ─── Per-token color palette ─── */
const TOKEN_COLORS = [
  "#f43f5e", // rose
  "#22c55e", // green
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
  "#84cc16", // lime
];

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

function shortAddr(address: string, len = 4): string {
  if (!address || typeof address !== "string") return "unknown";
  if (address.length <= len * 2 + 3) return address;
  return `${address.slice(0, len)}...${address.slice(-len)}`;
}

function isAddressLikeSymbol(value: unknown, mint: string): boolean {
  const symbol = String(value ?? "").trim();
  if (!symbol) return false;

  const normalizedSymbol = symbol.toLowerCase();
  const normalizedMint = String(mint ?? "").trim().toLowerCase();
  if (normalizedMint && normalizedSymbol === normalizedMint) {
    return true;
  }

  // Helius/providers may send a short-address placeholder (e.g. Abcd...Wxyz) as tokenSymbol.
  if (/^[1-9A-HJ-NP-Za-km-z]{3,8}\.\.\.[1-9A-HJ-NP-Za-km-z]{3,8}$/.test(symbol)) {
    return true;
  }

  return false;
}

function resolveDisplaySymbol(transfer: any, mint: string): string {
  if (mint === WRAPPED_SOL_MINT) {
    return "WSOL";
  }

  const candidates = [transfer.symbol, transfer.tokenSymbol, transfer.tokenName];
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (!text) continue;
    if (!isAddressLikeSymbol(text, mint)) {
      return text;
    }
  }

  return shortAddr(mint, 4);
}

function mintColor(mint: string): string {
  let hash = 0;
  for (let i = 0; i < mint.length; i += 1) {
    hash = (hash * 31 + mint.charCodeAt(i)) >>> 0;
  }
  return TOKEN_COLORS[hash % TOKEN_COLORS.length];
}

function formatUtcTimestamp(timestampSec: number): string {
  if (!Number.isFinite(timestampSec) || timestampSec <= 0) return "Unknown";
  const date = new Date(timestampSec * 1000);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${hh}:${mm}:${ss} ${month} ${day}, ${year} (UTC)`;
}

function formatRelativeMinutes(timestampSec: number): string {
  if (!Number.isFinite(timestampSec) || timestampSec <= 0) return "Unknown";
  const deltaSec = Math.max(0, Math.floor(Date.now() / 1000) - Math.floor(timestampSec));
  const minutes = Math.floor(deltaSec / 60);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} mins ago`;
}

function formatLamportsFee(lamports: number): string {
  if (!Number.isFinite(lamports) || lamports < 0) return "Unknown";
  const sol = lamports / 1e9;
  return `${sol.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 9,
  })} SOL`;
}

function formatTokenAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 9,
  });
}

function formatUsdValue(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  })}`;
}

function prettifySourceText(source: string): string {
  const raw = String(source ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTransactionSummaryText(tx: any, signer: string): string {
  const summaryCandidates = [
    tx?.summary,
    tx?.transactionSummary,
    tx?.meta?.summary,
    tx?.events?.summary,
  ];

  for (const candidate of summaryCandidates) {
    const raw = String(candidate ?? "").trim();
    if (raw) {
      return raw;
    }
  }

  const tokenTransfers = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
  const outflows = tokenTransfers.filter((tt: any) => {
    const from = String(tt?.fromWallet ?? tt?.fromUserAccount ?? "").trim();
    const amount = Number(tt?.amount ?? tt?.tokenAmount ?? 0);
    return from === signer && Number.isFinite(amount) && amount > 0;
  });
  const inflows = tokenTransfers.filter((tt: any) => {
    const to = String(tt?.toWallet ?? tt?.toUserAccount ?? "").trim();
    const amount = Number(tt?.amount ?? tt?.tokenAmount ?? 0);
    return to === signer && Number.isFinite(amount) && amount > 0;
  });

  const byLargestAmount = (a: any, b: any) => {
    const aAmount = Number(a?.amount ?? a?.tokenAmount ?? 0);
    const bAmount = Number(b?.amount ?? b?.tokenAmount ?? 0);
    return bAmount - aAmount;
  };

  const out = [...outflows].sort(byLargestAmount)[0];
  const into = [...inflows].sort(byLargestAmount)[0];

  const sourceName = prettifySourceText(
    String(tx?.source ?? tx?.events?.swap?.source ?? tx?.programName ?? ""),
  );

  if (out && into) {
    const outMint = String(out?.tokenAddress ?? out?.mint ?? "").trim();
    const inMint = String(into?.tokenAddress ?? into?.mint ?? "").trim();
    const outAmount = Number(out?.amount ?? out?.tokenAmount ?? 0);
    const inAmount = Number(into?.amount ?? into?.tokenAmount ?? 0);
    const outSymbol = resolveDisplaySymbol(out, outMint);
    const inSymbol = resolveDisplaySymbol(into, inMint);
    const usdText = formatUsdValue(Number(out?.valueUsd ?? 0));

    return [
      "Swap",
      formatTokenAmount(outAmount),
      usdText ?? "",
      outSymbol,
      "for",
      formatTokenAmount(inAmount),
      inSymbol,
      sourceName ? `on ${sourceName}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const first = tokenTransfers[0];
  if (first) {
    const mint = String(first?.tokenAddress ?? first?.mint ?? "").trim();
    const amount = Number(first?.amount ?? first?.tokenAmount ?? 0);
    const symbol = resolveDisplaySymbol(first, mint);
    const from = String(first?.fromWallet ?? first?.fromUserAccount ?? "").trim();
    const to = String(first?.toWallet ?? first?.toUserAccount ?? "").trim();
    return `Transfer ${formatTokenAmount(amount)} ${symbol} from ${shortAddr(from, 4)} to ${shortAddr(to, 4)}`;
  }

  return "Summary unavailable";
}

function isRentExemptLikeLamports(amountLamports: number): boolean {
  if (!Number.isFinite(amountLamports) || amountLamports <= 0) return false;

  // Common ATA rent deposits seen in enhanced tx data.
  const commonRentDeposits = [2_039_280, 2_074_080];
  return commonRentDeposits.some((rent) => Math.abs(amountLamports - rent) <= 120_000);
}

type InstructionFrame = {
  order: number;
  programId: string;
  accounts: Set<string>;
};

function flattenInstructionFrames(instructions: any[]): InstructionFrame[] {
  const frames: InstructionFrame[] = [];
  let order = 0;

  for (const ins of instructions) {
    const topAccounts = Array.isArray(ins?.accounts)
      ? ins.accounts.map((a: unknown) => String(a ?? "").trim()).filter(Boolean)
      : [];

    frames.push({
      order: order++,
      programId: String(ins?.programId ?? ""),
      accounts: new Set(topAccounts),
    });

    const inners = Array.isArray(ins?.innerInstructions) ? ins.innerInstructions : [];
    for (const inner of inners) {
      const innerAccounts = Array.isArray(inner?.accounts)
        ? inner.accounts.map((a: unknown) => String(a ?? "").trim()).filter(Boolean)
        : [];

      frames.push({
        order: order++,
        programId: String(inner?.programId ?? ""),
        accounts: new Set(innerAccounts),
      });
    }
  }

  return frames;
}

function inferEventOrder(
  frames: InstructionFrame[],
  event: {
    fromUser?: string;
    toUser?: string;
    fromToken?: string;
    toToken?: string;
    mint?: string;
    isNative: boolean;
  },
  fallbackOrder: number,
): number {
  if (frames.length === 0) return fallbackOrder;

  let bestOrder = fallbackOrder;
  let bestScore = -1;

  for (const frame of frames) {
    let score = 0;
    const has = (addr?: string) => Boolean(addr && frame.accounts.has(addr));

    if (event.isNative) {
      if (has(event.fromUser) && has(event.toUser)) score += 8;
    } else {
      if (has(event.fromToken) && has(event.toToken)) score += 10;
      if (has(event.fromUser) && has(event.toUser)) score += 7;
      if (has(event.mint)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestOrder = frame.order;
    } else if (score === bestScore && score > 0 && frame.order < bestOrder) {
      bestOrder = frame.order;
    }
  }

  return bestScore > 0 ? bestOrder : fallbackOrder;
}


/* ─── Core: build summary flows from raw data ─── */
function buildSummaryFlows(
  tokenTransfers: any[],
  nativeTransfers: any[],
  instructions: any[],
  signer: string,
  txFeeLamports: number,
  accountData: any[] = [],
): Omit<SummaryFlow, "color" | "pairKey">[] {
  const frames = flattenInstructionFrames(instructions ?? []);

  const tokenAccountOwner = new Map<string, string>();

  for (const tt of tokenTransfers) {
    const fromToken = String(tt.fromTokenAccount ?? "").trim();
    const toToken = String(tt.toTokenAccount ?? "").trim();
    const fromUser = String(tt.fromUserAccount ?? tt.fromWallet ?? "").trim();
    const toUser = String(tt.toUserAccount ?? tt.toWallet ?? "").trim();

    if (fromToken && fromUser) tokenAccountOwner.set(fromToken, fromUser);
    if (toToken && toUser) tokenAccountOwner.set(toToken, toUser);
  }

  for (const row of accountData) {
    const changes = Array.isArray(row?.tokenBalanceChanges)
      ? row.tokenBalanceChanges
      : [];
    for (const change of changes) {
      const tokenAccount = String(change?.tokenAccount ?? "").trim();
      const userAccount = String(change?.userAccount ?? "").trim();
      if (tokenAccount && userAccount) {
        tokenAccountOwner.set(tokenAccount, userAccount);
      }
    }
  }

  const canonicalWallet = (wallet: string, tokenAccount?: string): string => {
    const byToken = String(tokenAccount ?? "").trim();
    if (byToken) {
      const owner = tokenAccountOwner.get(byToken);
      if (owner) return owner;
    }

    const owner = tokenAccountOwner.get(wallet);
    return owner ?? wallet;
  };

  // Token accounts are utility accounts (ATA/temporary) and can receive rent create/close transfers.
  const tokenAccounts = new Set<string>();
  for (const tt of tokenTransfers) {
    const fromToken = String(tt.fromTokenAccount ?? "").trim();
    const toToken = String(tt.toTokenAccount ?? "").trim();
    if (fromToken) tokenAccounts.add(fromToken);
    if (toToken) tokenAccounts.add(toToken);
  }
  for (const row of accountData) {
    const changes = Array.isArray(row?.tokenBalanceChanges)
      ? row.tokenBalanceChanges
      : [];
    for (const change of changes) {
      const tokenAccount = String(change?.tokenAccount ?? "").trim();
      if (tokenAccount) tokenAccounts.add(tokenAccount);
    }
  }

  const nativeMaxByDirection = new Map<string, number>();
  const nativeSmallTokenTouchFrequency = new Map<number, number>();
  for (const nt of nativeTransfers) {
    const fromWallet = String(nt?.fromWallet ?? nt?.fromUserAccount ?? "").trim();
    const toWallet = String(nt?.toWallet ?? nt?.toUserAccount ?? "").trim();
    const amountLamports = Number(nt?.amount ?? 0);

    if (!fromWallet || !toWallet || !Number.isFinite(amountLamports) || amountLamports <= 0) {
      continue;
    }

    const key = `${fromWallet}→${toWallet}`;
    const prev = nativeMaxByDirection.get(key) ?? 0;
    if (amountLamports > prev) {
      nativeMaxByDirection.set(key, amountLamports);
    }

    const touchesTokenAccount = tokenAccounts.has(fromWallet) || tokenAccounts.has(toWallet);
    if (touchesTokenAccount && amountLamports <= 5_000_000) {
      const rounded = Math.round(amountLamports);
      nativeSmallTokenTouchFrequency.set(rounded, (nativeSmallTokenTouchFrequency.get(rounded) ?? 0) + 1);
    }
  }

  const shouldHideNative = (fromWallet: string, toWallet: string, amountLamports: number): boolean => {
    const fromIsTokenAccount = tokenAccounts.has(fromWallet);
    const toIsTokenAccount = tokenAccounts.has(toWallet);

    // Solscan-style visualization: hide native movements that touch token accounts
    // (ATA rent, wrap/unwrap plumbing, create/close account bookkeeping).
    if (fromIsTokenAccount || toIsTokenAccount) {
      const touchesSigner = fromWallet === signer || toWallet === signer;
      const feeBase = Number.isFinite(txFeeLamports) && txFeeLamports > 0 ? txFeeLamports : 5000;
      const isTinyPlumbingAmount = amountLamports <= Math.max(1_000_000, feeBase * 20);
      const reverseMaxLamports = nativeMaxByDirection.get(`${toWallet}→${fromWallet}`) ?? 0;
      const isTinyReverseLeg =
        reverseMaxLamports > 0 &&
        amountLamports <= 10_000_000 &&
        amountLamports * 8 <= reverseMaxLamports;
      const isRentLike = isRentExemptLikeLamports(amountLamports);
      const roundedAmount = Math.round(amountLamports);
      const isRepeatedSmallTokenTouch =
        amountLamports <= 5_000_000 &&
        (nativeSmallTokenTouchFrequency.get(roundedAmount) ?? 0) >= 2;

      // Hide ATA rent deposits/refunds (Solscan keeps these in actions/balance change, not graph lines).
      if (touchesSigner && (isRentLike || isRepeatedSmallTokenTouch)) {
        return true;
      }

      // Hide tiny reverse signer<->token-account legs (typically close-account refunds).
      if (touchesSigner && isTinyReverseLeg) {
        return true;
      }

      // Keep meaningful signer-related wrap transfers, hide tiny fee/rent-like plumbing lines.
      if (touchesSigner && !isTinyPlumbingAmount) {
        return false;
      }

      return true;
    }

    return false;
  };

  /* STEP 2 — Keep each token transfer as an execution event */
  const events: Omit<SummaryFlow, "color" | "pairKey" | "id" | "sequenceNo">[] = [];

  for (let i = 0; i < tokenTransfers.length; i += 1) {
    const tt = tokenTransfers[i];
    const rawFrom = String(tt.fromWallet ?? tt.fromUserAccount ?? "").trim();
    const rawTo = String(tt.toWallet ?? tt.toUserAccount ?? "").trim();
    const fromToken = String(tt.fromTokenAccount ?? "").trim();
    const toToken = String(tt.toTokenAccount ?? "").trim();
    const fromWallet = canonicalWallet(rawFrom, fromToken);
    const toWallet = canonicalWallet(rawTo, toToken);
    const tokenAddress = String(tt.tokenAddress ?? tt.mint ?? "").trim();
    const amount = Number(tt.amount ?? tt.tokenAmount ?? 0);

    if (!fromWallet || !toWallet || !tokenAddress || !Number.isFinite(amount) || amount === 0) {
      continue;
    }

    if (fromWallet === toWallet) {
      continue;
    }

    const symbol = resolveDisplaySymbol(tt, tokenAddress);

    const eventOrder = inferEventOrder(
      frames,
      {
        fromUser: fromWallet,
        toUser: toWallet,
        fromToken,
        toToken,
        mint: tokenAddress,
        isNative: false,
      },
      i,
    );

    events.push({
      rawIndex: eventOrder,
      fromAddr: fromWallet,
      toAddr: toWallet,
      fromTokenAddr: fromToken || undefined,
      toTokenAddr: toToken || undefined,
      amount,
      valueUsd: Number(tt.valueUsd ?? 0),
      valueUsdSource: String(tt.valueUsdSource ?? "none") as "historical" | "inferred" | "none",
      symbol,
      tokenMint: tokenAddress,
      isNative: false,
    });
  }

  /* STEP 3 — Keep each native transfer as an execution event */
  const nativeOffset = Math.max(tokenTransfers.length, frames.length + tokenTransfers.length);
  const seenNativeTransfers = new Set<string>();
  const aggregatedSignerTokenNative = new Map<
    string,
    {
      rawIndex: number;
      fromAddr: string;
      toAddr: string;
      amountLamports: number;
      valueUsd: number;
      valueUsdSource: "historical" | "inferred" | "none";
    }
  >();

  for (let i = 0; i < nativeTransfers.length; i += 1) {
    const nt = nativeTransfers[i];
    const fromWallet = String(nt.fromWallet ?? nt.fromUserAccount ?? "").trim();
    const toWallet = String(nt.toWallet ?? nt.toUserAccount ?? "").trim();
    const amountLamports = Number(nt.amount ?? 0);
    const roundedAmount = Number.isFinite(amountLamports) ? Math.round(amountLamports) : 0;

    if (!fromWallet || !toWallet || !Number.isFinite(amountLamports) || amountLamports === 0) {
      continue;
    }

    // Some providers emit duplicate native rows for the same movement.
    const dedupeKey = `${fromWallet}→${toWallet}:${roundedAmount}`;
    if (seenNativeTransfers.has(dedupeKey)) {
      continue;
    }
    seenNativeTransfers.add(dedupeKey);

    if (shouldHideNative(fromWallet, toWallet, amountLamports)) {
      continue;
    }

    const eventOrder = inferEventOrder(
      frames,
      {
        fromUser: fromWallet,
        toUser: toWallet,
        isNative: true,
      },
      nativeOffset + i,
    );

    const touchesTokenAccount = tokenAccounts.has(fromWallet) || tokenAccounts.has(toWallet);
    const touchesSigner = fromWallet === signer || toWallet === signer;

    // Solscan-like cleanup: collapse signer<->token-account native plumbing into one net SOL line.
    if (touchesTokenAccount && touchesSigner) {
      const aggregateKey = `${fromWallet}→${toWallet}`;
      const existing = aggregatedSignerTokenNative.get(aggregateKey);

      if (existing) {
        existing.amountLamports += amountLamports;
        existing.valueUsd += Number(nt.valueUsd ?? 0);
        existing.rawIndex = Math.min(existing.rawIndex, eventOrder);

        const src = String(nt.valueUsdSource ?? "none") as "historical" | "inferred" | "none";
        if (existing.valueUsdSource === "none" && src !== "none") {
          existing.valueUsdSource = src;
        }
      } else {
        aggregatedSignerTokenNative.set(aggregateKey, {
          rawIndex: eventOrder,
          fromAddr: fromWallet,
          toAddr: toWallet,
          amountLamports,
          valueUsd: Number(nt.valueUsd ?? 0),
          valueUsdSource: String(nt.valueUsdSource ?? "none") as "historical" | "inferred" | "none",
        });
      }

      continue;
    }

    events.push({
      rawIndex: eventOrder,
      fromAddr: fromWallet,
      toAddr: toWallet,
      fromTokenAddr: undefined,
      toTokenAddr: undefined,
      amount: amountLamports / 1e9,
      valueUsd: Number(nt.valueUsd ?? 0),
      valueUsdSource: String(nt.valueUsdSource ?? "none") as "historical" | "inferred" | "none",
      symbol: "SOL",
      tokenMint: "SOL",
      isNative: true,
    });
  }

  for (const agg of aggregatedSignerTokenNative.values()) {
    events.push({
      rawIndex: agg.rawIndex,
      fromAddr: agg.fromAddr,
      toAddr: agg.toAddr,
      fromTokenAddr: undefined,
      toTokenAddr: undefined,
      amount: agg.amountLamports / 1e9,
      valueUsd: agg.valueUsd,
      valueUsdSource: agg.valueUsdSource,
      symbol: "SOL",
      tokenMint: "SOL",
      isNative: true,
    });
  }

  /* STEP 4 — Final ordered flow list for sequence-driven UI/animation */
  events.sort((a, b) => a.rawIndex - b.rawIndex);

  const flows: Omit<SummaryFlow, "color" | "pairKey">[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    flows.push({
      id: `flow-${i}`,
      sequenceNo: i + 1,
      rawIndex: ev.rawIndex,
      fromAddr: ev.fromAddr,
      toAddr: ev.toAddr,
      fromTokenAddr: ev.fromTokenAddr,
      toTokenAddr: ev.toTokenAddr,
      amount: ev.amount,
      valueUsd: ev.valueUsd,
      valueUsdSource: ev.valueUsdSource,
      symbol: ev.symbol,
      tokenMint: ev.tokenMint,
      isNative: ev.isNative,
    });
  }

  return flows;
}

/* ─── Layered layout engine (Solscan-like left→right flow) ─── */
const COL_SPACING = 460;
const BASE_ROW_SPACING = 150;
const BASE_Y = 300;
const START_X = 140;

function buildGraphLayout(flows: SummaryFlow[], signer: string) {
  const allAddrs = new Set<string>();
  const undirectedNeighbors = new Map<string, Set<string>>();
  const outgoingNeighbors = new Map<string, Set<string>>();
  const weightedNeighbors = new Map<string, Map<string, number>>();
  const flowVolumeByAddr = new Map<string, number>();
  const degreeByAddr = new Map<string, number>();

  const touch = (map: Map<string, Set<string>>, a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)?.add(b);
  };

  const touchWeight = (a: string, b: string, amount: number) => {
    if (!weightedNeighbors.has(a)) weightedNeighbors.set(a, new Map());
    const m = weightedNeighbors.get(a) as Map<string, number>;
    m.set(b, (m.get(b) ?? 0) + Math.max(1, Math.abs(amount)));
    flowVolumeByAddr.set(a, (flowVolumeByAddr.get(a) ?? 0) + Math.abs(amount));
  };

  for (const f of flows) {
    allAddrs.add(f.fromAddr);
    allAddrs.add(f.toAddr);
    touch(undirectedNeighbors, f.fromAddr, f.toAddr);
    touch(undirectedNeighbors, f.toAddr, f.fromAddr);
    touch(outgoingNeighbors, f.fromAddr, f.toAddr);
    touchWeight(f.fromAddr, f.toAddr, f.amount);
    touchWeight(f.toAddr, f.fromAddr, f.amount);
  }

  allAddrs.forEach((addr) => {
    degreeByAddr.set(addr, undirectedNeighbors.get(addr)?.size ?? 0);
  });

  // Prefer directional BFS so flow mostly reads left->right like Solscan.
  const layerByAddr = new Map<string, number>();
  const queue: string[] = [signer];
  if (allAddrs.has(signer)) {
    layerByAddr.set(signer, 0);
  }

  while (queue.length > 0) {
    const curr = queue.shift() as string;
    const nextLayer = (layerByAddr.get(curr) ?? 0) + 1;
    for (const nb of outgoingNeighbors.get(curr) ?? []) {
      if (!layerByAddr.has(nb)) {
        layerByAddr.set(nb, nextLayer);
        queue.push(nb);
      }
    }
  }

  // Fallback for nodes not reached by directional flow.
  const fallbackDist = new Map<string, number>();
  if (allAddrs.has(signer)) {
    fallbackDist.set(signer, 0);
    const q2: string[] = [signer];
    while (q2.length > 0) {
      const curr = q2.shift() as string;
      const nextDist = (fallbackDist.get(curr) ?? 0) + 1;
      for (const nb of undirectedNeighbors.get(curr) ?? []) {
        if (!fallbackDist.has(nb)) {
          fallbackDist.set(nb, nextDist);
          q2.push(nb);
        }
      }
    }
  }

  const currentMaxLayer = Math.max(0, ...Array.from(layerByAddr.values()));
  allAddrs.forEach((addr) => {
    if (!layerByAddr.has(addr)) {
      const fallback = fallbackDist.get(addr);
      layerByAddr.set(addr, fallback !== undefined ? Math.max(1, fallback) : currentMaxLayer + 1);
    }
  });

  const buckets = new Map<number, string[]>();
  for (const addr of allAddrs) {
    const layer = layerByAddr.get(addr) ?? 0;
    const list = buckets.get(layer) ?? [];
    list.push(addr);
    buckets.set(layer, list);
  }

  // Initial stable sorting by weight/degree.
  for (const [, addrs] of buckets) {
    addrs.sort((a, b) => {
      if (a === signer) return -1;
      if (b === signer) return 1;

      const volumeDiff = (flowVolumeByAddr.get(b) ?? 0) - (flowVolumeByAddr.get(a) ?? 0);
      if (Math.abs(volumeDiff) > 1e-9) return volumeDiff;

      const degreeDiff = (degreeByAddr.get(b) ?? 0) - (degreeByAddr.get(a) ?? 0);
      if (degreeDiff !== 0) return degreeDiff;

      return a.localeCompare(b);
    });
  }

  const sortedLayers = Array.from(buckets.keys()).sort((a, b) => a - b);
  const indexMap = new Map<string, number>();
  const refreshIndexMap = () => {
    for (const layer of sortedLayers) {
      const list = buckets.get(layer) ?? [];
      list.forEach((addr, idx) => indexMap.set(addr, idx));
    }
  };

  const barycenterScore = (addr: string, refLayer: number): number => {
    const refs = weightedNeighbors.get(addr);
    if (!refs || refs.size === 0) return Number.POSITIVE_INFINITY;

    let weightedSum = 0;
    let totalWeight = 0;
    for (const [nb, weight] of refs.entries()) {
      if ((layerByAddr.get(nb) ?? -1) !== refLayer) continue;
      const idx = indexMap.get(nb);
      if (idx === undefined) continue;
      weightedSum += idx * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : Number.POSITIVE_INFINITY;
  };

  // Two-way barycentric sweeps reduce line crossing for multi-branch transactions.
  refreshIndexMap();
  for (let sweep = 0; sweep < 2; sweep += 1) {
    for (let i = 1; i < sortedLayers.length; i += 1) {
      const layer = sortedLayers[i];
      const prevLayer = sortedLayers[i - 1];
      const list = buckets.get(layer) ?? [];
      list.sort((a, b) => {
        const aScore = barycenterScore(a, prevLayer);
        const bScore = barycenterScore(b, prevLayer);
        if (aScore !== bScore) return aScore - bScore;
        return a.localeCompare(b);
      });
      buckets.set(layer, list);
      refreshIndexMap();
    }

    for (let i = sortedLayers.length - 2; i >= 0; i -= 1) {
      const layer = sortedLayers[i];
      if (layer === 0) continue;
      const nextLayer = sortedLayers[i + 1];
      const list = buckets.get(layer) ?? [];
      list.sort((a, b) => {
        const aScore = barycenterScore(a, nextLayer);
        const bScore = barycenterScore(b, nextLayer);
        if (aScore !== bScore) return aScore - bScore;
        return a.localeCompare(b);
      });
      buckets.set(layer, list);
      refreshIndexMap();
    }
  }

  const positions: { addr: string; x: number; y: number }[] = [];
  const maxBucketSize = Math.max(1, ...Array.from(buckets.values()).map((v) => v.length));
  const rowSpacing = Math.max(BASE_ROW_SPACING, Math.min(210, BASE_ROW_SPACING + (maxBucketSize - 2) * 10));

  for (const [layer, addrs] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    const x = START_X + layer * COL_SPACING;
    const totalHeight = (addrs.length - 1) * rowSpacing;
    const startY = BASE_Y - totalHeight / 2;
    addrs.forEach((addr, i) => {
      positions.push({ addr, x, y: startY + i * rowSpacing });
    });
  }

  return positions;
}

/* ─── Component ─── */
const nodeTypes = { wallet: WalletNode };
const edgeTypes = { curved: CurvedEdge };

export function TransactionGraphPage() {
  const { txHash } = useParams<{ txHash: string }>();
  const { fmt } = useLocalization();
  const [transactionDetails, setTransactionDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (!txHash) {
      setTransactionDetails(null);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    const controller = new AbortController();
    const apiDomain =
      import.meta.env.VITE_CLIENT_API_DOMAIN || window.location.origin;
    const base = apiDomain.replace(/\/$/, "");

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetch(
          `${base}/api/transactions/${encodeURIComponent(txHash)}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to load transaction (${response.status})`);
        }

        const data = await response.json();
        setTransactionDetails(Array.isArray(data) ? data[0] : data);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setTransactionDetails(null);
        setLoadError(
          error instanceof Error
            ? error
            : new Error("Failed to load transaction data"),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [txHash]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [hoveredPair, setHoveredPair] = useState<string | null>(null);
  const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);
  const [actionsList, setActionsList] = useState<SummaryFlow[]>([]);

  useEffect(() => {
    if (!transactionDetails || !txHash) {
      setNodes([]); setEdges([]); setActionsList([]);
      return;
    }

    const tx = transactionDetails as any;
    const signer: string = tx.info?.feePayer ?? "";
    const txFeeLamports = Number(tx.info?.fee ?? tx.fee ?? Number.NaN);
    const tokenTransfers = tx.tokenTransfers ?? [];
    const nativeTransfers = tx.nativeTransfers ?? [];

    if (tokenTransfers.length === 0 && nativeTransfers.length === 0) {
      setNodes([]); setEdges([]); setActionsList([]);
      return;
    }

    /* Build summary flows */
    const rawFlows = buildSummaryFlows(
      tokenTransfers,
      nativeTransfers,
      tx.instructions ?? [],
      signer,
      txFeeLamports,
      tx.accountData ?? [],
    );

    /* Assign per-token colors */
    const uniqueMints = Array.from(new Set(rawFlows.map(f => f.tokenMint)));
    const mintColorMap: Record<string, string> = {};
    uniqueMints.forEach((mint) => {
      mintColorMap[mint] = mintColor(mint);
    });

    const flows: SummaryFlow[] = rawFlows.map(f => {
      const pair = [f.fromAddr, f.toAddr].sort().join('-');
      return {
        ...f,
        color: mintColorMap[f.tokenMint] ?? "#94a3b8",
        pairKey: pair
      };
    });

    setActionsList(flows);

    /* Build graph nodes */
    const positions = buildGraphLayout(flows, signer);

    const walletTokens: Record<string, Set<string>> = {};
    positions.forEach(p => walletTokens[p.addr] = new Set());
    flows.forEach(f => {
      if (walletTokens[f.fromAddr]) walletTokens[f.fromAddr].add(f.tokenMint);
      if (walletTokens[f.toAddr]) walletTokens[f.toAddr].add(f.tokenMint);
    });

    const xPosMap: Record<string, number> = {};
    const yPosMap: Record<string, number> = {};
    positions.forEach(p => xPosMap[p.addr] = p.x);
    positions.forEach(p => yPosMap[p.addr] = p.y);

    const nodesData: Node[] = positions.map(({ addr, x, y }) => {
      return {
        id: addr,
        type: "wallet",
        position: { x, y: y - 30 },
        data: {
          address: addr,
          shortAddress: addr === signer ? shortAddr(addr, 6) : shortAddr(addr, 6),
          isSigner: addr === signer,
          activeTokens: Array.from(walletTokens[addr] ?? []),
          label: null,
          labelColor: null,
          labelIcon: null,
        },
      };
    });

    /* Build graph edges */
    // Detect bidirectional pairs: if A→B and B→A both exist,
    // the first one seen is straight, the rest are curved arcs.
    const directedSet = new Set<string>();
    flows.forEach(f => directedSet.add(`${f.fromAddr}→${f.toAddr}`));

    // Track how many edges share the same undirected pair
    const pairTotals = new Map<string, number>();
    flows.forEach(f => {
      const key = f.fromAddr < f.toAddr ? `${f.fromAddr}-${f.toAddr}` : `${f.toAddr}-${f.fromAddr}`;
      pairTotals.set(key, (pairTotals.get(key) || 0) + 1);
    });
    const pairSeen = new Map<string, number>();
    const directionTotals = new Map<string, number>();
    flows.forEach((f) => {
      const key = `${f.fromAddr}→${f.toAddr}`;
      directionTotals.set(key, (directionTotals.get(key) ?? 0) + 1);
    });
    const directionSeen = new Map<string, number>();

    const edgesData: Edge[] = flows.map((flow, i) => {
      const sourceX = xPosMap[flow.fromAddr] ?? 0;
      const targetX = xPosMap[flow.toAddr] ?? 0;
      const sourceY = yPosMap[flow.fromAddr] ?? 0;
      const targetY = yPosMap[flow.toAddr] ?? 0;
      const dx = targetX - sourceX;
      const dy = targetY - sourceY;
      const isVerticalDominant = Math.abs(dy) > Math.abs(dx) * 0.8;
      const isSourceLeft = sourceX <= targetX;

      let sourceHandle = isSourceLeft ? "source-right" : "source-left";
      let targetHandle = isSourceLeft ? "target-left" : "target-right";

      if (isVerticalDominant) {
        const sourceIsAbove = sourceY <= targetY;
        sourceHandle = sourceIsAbove ? "source-bottom" : "source-top";
        targetHandle = sourceIsAbove ? "target-top" : "target-bottom";
      }
      const directionKey = `${flow.fromAddr}→${flow.toAddr}`;
      const reverseKey = `${flow.toAddr}→${flow.fromAddr}`;
      const directionCount = directionTotals.get(directionKey) ?? 1;
      const directionIndex = directionSeen.get(directionKey) ?? 0;
      directionSeen.set(directionKey, directionIndex + 1);

      const pairKey = flow.fromAddr < flow.toAddr
        ? `${flow.fromAddr}-${flow.toAddr}`
        : `${flow.toAddr}-${flow.fromAddr}`;
      const total = pairTotals.get(pairKey) || 1;
      const seen = pairSeen.get(pairKey) || 0;
      pairSeen.set(pairKey, seen + 1);

      // Bidirectional check: does the reverse direction also exist?
      const reverseExists = directedSet.has(reverseKey);

      // Compute curve lanes so parallel edges and opposite directions do not overlap.
      let isCurved = false;
      let parallelOffset = 0;
      let labelShift = 0;

      if (reverseExists) {
        // Rule: for A↔B, keep one direction straight (left→right), reverse direction slightly curved.
        // If a direction has multiple transfers, only the first keeps this rule and the rest fan out.
        const isPrimaryStraightDirection = isSourceLeft;
        if (isPrimaryStraightDirection && directionIndex === 0) {
          isCurved = false;
          parallelOffset = 0;
          labelShift = 0;
        } else {
          isCurved = true;
          const side = isSourceLeft ? -1 : 1;
          const centeredLane = directionIndex - (directionCount - 1) / 2;
          parallelOffset = side * (36 + Math.abs(centeredLane) * 24);
          if (centeredLane !== 0) {
            parallelOffset += side * centeredLane * 8;
          }
          labelShift = centeredLane * 0.12;
        }
      } else if (directionCount > 1 || total > 1) {
        isCurved = true;
        const centeredLane = directionIndex - (directionCount - 1) / 2;
        parallelOffset = centeredLane * 32;
        // Avoid perfectly straight center lane when multiple labels would stack.
        if (Math.abs(parallelOffset) < 6) {
          parallelOffset = centeredLane >= 0 ? 16 : -16;
        }
        labelShift = centeredLane * 0.14;
      }

      // Add a tiny fallback offset when many edges share a pair.
      if (total > 3) {
        parallelOffset += (seen - (total - 1) / 2) * 4;
      }

      return {
        id: flow.id,
        source: flow.fromAddr,
        target: flow.toAddr,
        sourceHandle,
        targetHandle,
        type: "curved",
        data: {
          sequenceText: flow.sequenceNo.toString(),
          amountText: fmt.num.unit(flow.amount, ""),
          symbolText: flow.symbol,
          tokenAddress: flow.tokenMint,
          pairKey: flow.pairKey,
          color: flow.color,
          parallelOffset,
          isCurved,
          labelShift,
        },
      };
    });

    setNodes(nodesData);
    setEdges(edgesData);
  }, [transactionDetails, txHash]);

  /* Loading / error states */
  if (!txHash) return <div className={styles.state}>Missing transaction hash in URL.</div>;
  if (isLoading) return <div className={styles.state}><div className={styles.spinner} />Loading transaction…</div>;
  if (loadError) return <div className={styles.state}>Failed to load transaction data.</div>;
  if (nodes.length === 0 && !isLoading) {
    return <div className={styles.state}>No transfer data found for this transaction.</div>;
  }

  const tx = (transactionDetails ?? {}) as any;
  const txSigner = String(tx.info?.feePayer ?? tx.feePayer ?? "").trim();
  const txTimestamp = Number(tx.info?.timestamp ?? tx.timestamp ?? 0);
  const txFeeLamports = Number(tx.info?.fee ?? tx.fee ?? Number.NaN);
  const txStatus = tx.transactionError ? "Failed" : "Success";
  const txTimeText = `${formatRelativeMinutes(txTimestamp)} • ${formatUtcTimestamp(txTimestamp)}`;
  const txFeeText = formatLamportsFee(txFeeLamports);
  const txSummaryText = buildTransactionSummaryText(tx, txSigner);

  /* Render */
  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerLabel}>Transaction Visualization</span>
        <span className={styles.headerHash}>{shortAddr(txHash, 6)}</span>
      </div>

      {/* Main layout */}
      <div className={styles.layoutMain}>
        {/* Graph */}
        <div className={styles.chartWrap}>
          <HoverContext.Provider value={{ hoveredToken, setHoveredToken, hoveredPair, setHoveredPair, hoveredAddress, setHoveredAddress }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultViewport={{ x: 260, y: 220, zoom: 0.96 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e5e7eb" gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </HoverContext.Provider>
        </div>

        {/* Transaction Actions panel */}
        <div className={styles.actionsPanel}>
          <TransactionOverviewPanel
            txHash={txHash}
            txSigner={txSigner}
            txTimeText={txTimeText}
            txFeeText={txFeeText}
            txStatus={txStatus}
            txSummaryText={txSummaryText}
          />

          <TransactionActionsList
            actionsList={actionsList}
            hoveredToken={hoveredToken}
            hoveredAddress={hoveredAddress}
            setHoveredToken={setHoveredToken}
            formatAmount={(amount) => fmt.num.unit(amount, "")}
            shortAddress={shortAddr}
          />
        </div>
      </div>
    </div>
  );
}

export default TransactionGraphPage;
