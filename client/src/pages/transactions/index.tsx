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

/** Mirrors server/src/services/transactions.raw-parser.ts */
type ParsedTransfer = {
  order: number;
  level: "inner" | "outer";
  stackHeight: number;
  fromAddr: string;
  toAddr: string;
  /** Raw ATA address (original source) when resolved to wallet owner */
  fromTokenAddr?: string;
  /** Raw ATA address (original destination) when resolved to wallet owner */
  toTokenAddr?: string;
  mint: string;
  amount: number;
  rawAmount: string;
  decimals: number;
  kind: "spl" | "native";
  programId: string;
};

type TokenTransferLike = {
  symbol?: unknown;
  tokenSymbol?: unknown;
  tokenName?: unknown;
  fromWallet?: unknown;
  fromUserAccount?: unknown;
  toWallet?: unknown;
  toUserAccount?: unknown;
  amount?: unknown;
  tokenAmount?: unknown;
  tokenAddress?: unknown;
  mint?: unknown;
  valueUsd?: unknown;
};

type TransactionSummaryLike = RawParsedTransaction & {
  summary?: unknown;
  transactionSummary?: unknown;
  meta?: { summary?: unknown };
  events?: { summary?: unknown; swap?: { source?: unknown } };
  source?: unknown;
  programName?: unknown;
  tokenTransfers?: TokenTransferLike[];
};
type RawParsedTransaction = {
  signature: string;
  slot: number;
  blockTime: number | null;
  feePayer: string;
  fee: number;
  err: unknown;
  transfers: ParsedTransfer[];
  /** mint → symbol from server DB lookup */
  mintSymbols: Record<string, string>;
  preTokenBalances?: unknown[];
  postTokenBalances?: unknown[];
};

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

function resolveDisplaySymbol(transfer: TokenTransferLike, mint: string): string {
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

function buildTransactionSummaryText(tx: TransactionSummaryLike, signer: string): string {
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

  const tokenTransfers: TokenTransferLike[] = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : [];
  const outflows = tokenTransfers.filter((tt: TokenTransferLike) => {
    const from = String(tt?.fromWallet ?? tt?.fromUserAccount ?? "").trim();
    const amount = Number(tt?.amount ?? tt?.tokenAmount ?? 0);
    return from === signer && Number.isFinite(amount) && amount > 0;
  });
  const inflows = tokenTransfers.filter((tt: TokenTransferLike) => {
    const to = String(tt?.toWallet ?? tt?.toUserAccount ?? "").trim();
    const amount = Number(tt?.amount ?? tt?.tokenAmount ?? 0);
    return to === signer && Number.isFinite(amount) && amount > 0;
  });

  const byLargestAmount = (a: TokenTransferLike, b: TokenTransferLike) => {
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
  const [transactionDetails, setTransactionDetails] = useState<RawParsedTransaction | null>(null);
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

        // Use /raw/:txHash — transfers are already in correct on-chain execution order
        const response = await fetch(
          `${base}/api/transactions/raw/${encodeURIComponent(txHash)}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to load transaction (${response.status})`);
        }

        const data = await response.json() as RawParsedTransaction;
        setTransactionDetails(data);
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

  const [nodes, setNodes, onNodesChange] = useNodesState<Record<string, unknown>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Record<string, unknown>>([]);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [hoveredPair, setHoveredPair] = useState<string | null>(null);
  const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);
  const [actionsList, setActionsList] = useState<SummaryFlow[]>([]);
  /** null = show all; 1..n = replay step */
  const [playStep, setPlayStep] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalSteps, setTotalSteps] = useState(0);

  // Reset replay when tx changes
  useEffect(() => { setPlayStep(null); setIsPlaying(false); }, [txHash]);

  // Auto-advance playStep while playing
  useEffect(() => {
    if (!isPlaying) return;
    if (playStep !== null && playStep >= totalSteps) {
      setIsPlaying(false);
      return;
    }
    const t = setTimeout(() => {
      setPlayStep(prev => (prev == null ? 1 : prev + 1));
    }, 750);
    return () => clearTimeout(t);
  }, [isPlaying, playStep, totalSteps]);

  // Sync playStep into edge data whenever it changes
  useEffect(() => {
    setEdges(prev => prev.map(e => ({
      ...e,
      data: { ...e.data, playStep, totalSteps },
    })));
  }, [playStep, totalSteps]);

  // Sync playStep into node data whenever it changes
  useEffect(() => {
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, playStep },
    })));
  }, [playStep]);

  useEffect(() => {
    if (!transactionDetails || !txHash) {
      setNodes([]); setEdges([]); setActionsList([]);
      return;
    }

    const tx = transactionDetails;
    const signer: string = tx.feePayer ?? "";
    const mintSymbols = tx.mintSymbols ?? {};

    const rawTransfers = tx.transfers ?? [];
    if (rawTransfers.length === 0) {
      setNodes([]); setEdges([]); setActionsList([]);
      return;
    }

    /* ── Direct mapper from ParsedTransfer[] → SummaryFlow[] ──
     * Transfers are already in correct on-chain execution order (from the raw parser).
     * No heuristics needed — just assign sequenceNo = order. */
    const uniqueMints = Array.from(new Set(rawTransfers.map((t: ParsedTransfer) => t.mint)));
    const mintColorMap: Record<string, string> = {};
    uniqueMints.forEach((mint: string) => { mintColorMap[mint] = mintColor(mint); });

    const flows: SummaryFlow[] = rawTransfers.map((t: ParsedTransfer, i: number) => {
      const pair = [t.fromAddr, t.toAddr].sort().join("-");
      const displaySymbol =
        t.mint === "SOL" ? "SOL" : (mintSymbols[t.mint] ?? shortAddr(t.mint, 4));
      return {
        id: `flow-${i}`,
        sequenceNo: t.order,
        rawIndex: t.order,
        fromAddr: t.fromAddr,
        toAddr: t.toAddr,
        fromTokenAddr: undefined,
        toTokenAddr: undefined,
        amount: t.amount,
        valueUsd: 0,
        valueUsdSource: "none" as const,
        symbol: displaySymbol,
        tokenMint: t.mint,
        isNative: t.kind === "native",
        color: mintColorMap[t.mint] ?? "#94a3b8",
        pairKey: pair,
      };
    });

    // Actions list shows ALL transfers (wallet-resolved addresses, correct sequence)
    setActionsList(flows);

    /* ── Graph flow builder ──────────────────────────────────────────────────
     * Self-loops (fromAddr === toAddr) happen when a wallet sends to its own ATA.
     * Instead of hiding them, use the raw ATA address as the graph TARGET so we
     * get a visible edge (e.g. 7zMABP → 7QM7cd for the SOL→WSOL wrap).
     *
     * Crucially: subsequent transfers still use the resolved wallet as source,
     * NOT the ATA. This matches Solscan Tx Maps exactly.
     * ─────────────────────────────────────────────────────────────────────────*/
    const graphFlows: SummaryFlow[] = rawTransfers.map((t: ParsedTransfer, i: number) => {
      const f = flows[i];

      const graphFrom = f.fromAddr;
      let graphTo   = f.toAddr;

      // Self-loop: wallet → own ATA. Use the raw ATA address as target.
      if (graphFrom === graphTo && t.toTokenAddr) {
        graphTo = t.toTokenAddr;
      }

      const pair = [graphFrom, graphTo].sort().join("-");
      return { ...f, fromAddr: graphFrom, toAddr: graphTo, pairKey: pair };
    });


    /* Build graph nodes */
    const positions = buildGraphLayout(graphFlows, signer);

    const walletTokens: Record<string, Set<string>> = {};
    positions.forEach(p => walletTokens[p.addr] = new Set());
    graphFlows.forEach(f => {
      if (walletTokens[f.fromAddr]) walletTokens[f.fromAddr].add(f.tokenMint);
      if (walletTokens[f.toAddr]) walletTokens[f.toAddr].add(f.tokenMint);
    });

    const xPosMap: Record<string, number> = {};
    const yPosMap: Record<string, number> = {};
    positions.forEach(p => xPosMap[p.addr] = p.x);
    positions.forEach(p => yPosMap[p.addr] = p.y);

    // Compute the first step at which each node becomes visible (min sequenceNo of touching edges)
    const firstAppearByAddr = new Map<string, number>();
    graphFlows.forEach(f => {
      const seq = f.sequenceNo;
      if (!firstAppearByAddr.has(f.fromAddr) || seq < firstAppearByAddr.get(f.fromAddr)!) {
        firstAppearByAddr.set(f.fromAddr, seq);
      }
      if (!firstAppearByAddr.has(f.toAddr) || seq < firstAppearByAddr.get(f.toAddr)!) {
        firstAppearByAddr.set(f.toAddr, seq);
      }
    });

    const nodesData: Node[] = positions.map(({ addr, x, y }) => {
      return {
        id: addr,
        type: "wallet",
        position: { x, y: y - 30 },
        data: {
          address: addr,
          shortAddress: shortAddr(addr, 6),
          isSigner: addr === signer,
          activeTokens: Array.from(walletTokens[addr] ?? []),
          label: null,
          labelColor: null,
          labelIcon: null,
          firstAppearStep: firstAppearByAddr.get(addr) ?? 1,
          playStep: null, // will be synced by separate useEffect
        },
      };
    });


    /* Build graph edges */
    // Detect bidirectional pairs: if A→B and B→A both exist,
    // the first one seen is straight, the rest are curved arcs.
    const directedSet = new Set<string>();
    graphFlows.forEach(f => directedSet.add(`${f.fromAddr}→${f.toAddr}`));

    // Track how many edges share the same undirected pair
    const pairTotals = new Map<string, number>();
    graphFlows.forEach(f => {
      const key = f.fromAddr < f.toAddr ? `${f.fromAddr}-${f.toAddr}` : `${f.toAddr}-${f.fromAddr}`;
      pairTotals.set(key, (pairTotals.get(key) || 0) + 1);
    });
    const pairSeen = new Map<string, number>();
    const directionTotals = new Map<string, number>();
    graphFlows.forEach((f) => {
      const key = `${f.fromAddr}→${f.toAddr}`;
      directionTotals.set(key, (directionTotals.get(key) ?? 0) + 1);
    });
    const directionSeen = new Map<string, number>();

    const edgesData: Edge[] = graphFlows.map((flow) => {
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
        if (Math.abs(parallelOffset) < 6) {
          parallelOffset = centeredLane >= 0 ? 16 : -16;
        }
        labelShift = centeredLane * 0.14;
      }

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
          playStep: null,          // synced by useEffect
          totalSteps: graphFlows.length,
        },
      };
    });

    setNodes(nodesData);
    setEdges(edgesData);
    setTotalSteps(graphFlows.length);
    setPlayStep(null);
    setIsPlaying(false);
  }, [transactionDetails, txHash]);


  /* Loading / error states */
  if (!txHash) return <div className={styles.state}>Missing transaction hash in URL.</div>;
  if (isLoading) return <div className={styles.state}><div className={styles.spinner} />Loading transaction…</div>;
  if (loadError) return <div className={styles.state}>Failed to load transaction data.</div>;
  if (nodes.length === 0 && !isLoading) {
    return <div className={styles.state}>No transfer data found for this transaction.</div>;
  }

  const tx = transactionDetails;
  const txSigner = String(tx?.feePayer ?? "").trim();
  const txTimestamp = Number(tx?.blockTime ?? 0);
  const txFeeLamports = Number(tx?.fee ?? Number.NaN);
  const txStatus = tx?.err ? "Failed" : "Success";
  const txTimeText = `${formatRelativeMinutes(txTimestamp)} \u2022 ${formatUtcTimestamp(txTimestamp)}`;
  const txFeeText = formatLamportsFee(txFeeLamports);
  const txSummaryText = tx ? buildTransactionSummaryText(tx, txSigner) : "";
  const txSummaryFallback = tx?.transfers?.[0]
    ? `${tx.transfers.length} transfer${tx.transfers.length > 1 ? "s" : ""} parsed`
    : "Summary unavailable";

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

            {/* Replay player bar */}
            {totalSteps > 0 && (
              <div className={styles.playerBar}>
                {/* Play / Pause / Restart button */}
                <button
                  className={`${styles.playBtn} ${isPlaying ? styles.playBtnActive : ""}`}
                  title={isPlaying ? "Pause" : playStep !== null && playStep >= totalSteps ? "Restart" : "Play transaction"}
                  onClick={() => {
                    if (playStep !== null && playStep >= totalSteps && !isPlaying) {
                      // Restart
                      setPlayStep(0);
                      setIsPlaying(true);
                    } else {
                      setIsPlaying(p => !p);
                      if (playStep === null) setPlayStep(0);
                    }
                  }}
                >
                  {isPlaying ? (
                    /* Pause icon */
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : playStep !== null && playStep >= totalSteps ? (
                    /* Restart icon */
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.5 2.5L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  ) : (
                    /* Play icon */
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </button>

                {/* Step dots */}
                <div className={styles.stepDots}>
                  {Array.from({ length: totalSteps }, (_, i) => {
                    const stepNum = i + 1;
                    const isActive = playStep === stepNum;
                    const isPlayed = playStep !== null && stepNum < playStep;
                    return (
                      <div
                        key={i}
                        className={`${styles.stepDot} ${isPlayed ? styles.stepDotPlayed : ""} ${isActive ? styles.stepDotActive : ""}`}
                        title={`Step ${stepNum}`}
                        onClick={() => { setPlayStep(stepNum); setIsPlaying(false); }}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })}
                </div>

                {/* Step counter */}
                <span className={styles.stepCounter}>
                  {playStep == null ? `${totalSteps} steps` : `${Math.min(playStep, totalSteps)} / ${totalSteps}`}
                </span>

                {/* Reset to show-all */}
                {playStep !== null && (
                  <button
                    onClick={() => { setPlayStep(null); setIsPlaying(false); }}
                    title="Show all"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, display: "flex", alignItems: "center" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}
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
            txSummaryText={txSummaryText || txSummaryFallback}
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


