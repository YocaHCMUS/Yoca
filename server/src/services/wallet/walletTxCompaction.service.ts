import type { WalletSwap, WalletTransfer } from "./dtos/walletDataObjects.js";
import type { PnLComputedResult } from "./walletAiSwapSummary.service.js";
import { isBaseAsset } from "./walletDayActivity.service.js";
import { roundUsd } from "./walletNormalization.utils.js";

const SAMPLE_TX_HASH_LIMIT = 5;

type SwapAction = "buy" | "sell" | "both";

interface TokenSummary {
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  logoUri: string | null;
  buyAmount: number;
  sellAmount: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  tradeCount: number;
  sampleTxHashes: string[];
}

interface TransferTokenSummary {
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  logoUri: string | null;
  inAmount: number;
  outAmount: number;
  inValueUsd: number;
  outValueUsd: number;
  transferCount: number;
  sampleTxHashes: string[];
}

function addSample(target: string[], signature: string): void {
  if (!signature || target.includes(signature) || target.length >= SAMPLE_TX_HASH_LIMIT) return;
  target.push(signature);
}

function inferSwapAction(swap: WalletSwap): SwapAction {
  const soldIsBase = isBaseAsset(swap.sold?.address);
  const boughtIsBase = isBaseAsset(swap.bought?.address);
  if (soldIsBase && !boughtIsBase) return "buy";
  if (!soldIsBase && boughtIsBase) return "sell";
  return "both";
}

function getOrCreateSwapToken(map: Map<string, TokenSummary>, token: WalletSwap["bought"]): TokenSummary {
  const existing = map.get(token.address);
  if (existing) return existing;
  const next: TokenSummary = {
    tokenAddress: token.address,
    symbol: token.symbol,
    name: token.name,
    logoUri: token.logoUri,
    buyAmount: 0,
    sellAmount: 0,
    buyVolumeUsd: 0,
    sellVolumeUsd: 0,
    tradeCount: 0,
    sampleTxHashes: [],
  };
  map.set(token.address, next);
  return next;
}

function getOrCreateTransferToken(map: Map<string, TransferTokenSummary>, transfer: WalletTransfer): TransferTokenSummary {
  const existing = map.get(transfer.tokenAddress);
  if (existing) return existing;
  const next: TransferTokenSummary = {
    tokenAddress: transfer.tokenAddress,
    symbol: transfer.tokenSymbol ?? null,
    name: transfer.tokenName ?? null,
    logoUri: transfer.tokenLogoUri ?? null,
    inAmount: 0,
    outAmount: 0,
    inValueUsd: 0,
    outValueUsd: 0,
    transferCount: 0,
    sampleTxHashes: [],
  };
  map.set(transfer.tokenAddress, next);
  return next;
}

export function compactWalletSwaps(swaps: WalletSwap[]): Record<string, unknown> {
  let buyVolumeUsd = 0;
  let sellVolumeUsd = 0;
  let buyTxCount = 0;
  let sellTxCount = 0;
  const tokenMap = new Map<string, TokenSummary>();
  const sampleTxHashes: string[] = [];

  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  for (const swap of swaps) {
    const valueUsd = swap.totalValueUsd ?? 0;
    const action = inferSwapAction(swap);
    addSample(sampleTxHashes, swap.transactionHash);

    if (!firstTimestamp || Date.parse(swap.blockTimestampIso) < Date.parse(firstTimestamp)) firstTimestamp = swap.blockTimestampIso;
    if (!lastTimestamp || Date.parse(swap.blockTimestampIso) > Date.parse(lastTimestamp)) lastTimestamp = swap.blockTimestampIso;

    if (action === "buy" || action === "both") {
      buyTxCount++;
      buyVolumeUsd += valueUsd;
    }
    if (action === "sell" || action === "both") {
      sellTxCount++;
      sellVolumeUsd += valueUsd;
    }

    const bought = getOrCreateSwapToken(tokenMap, swap.bought);
    bought.buyAmount += swap.bought.amount;
    bought.buyVolumeUsd += valueUsd;
    bought.tradeCount++;
    addSample(bought.sampleTxHashes, swap.transactionHash);

    const sold = getOrCreateSwapToken(tokenMap, swap.sold);
    sold.sellAmount += swap.sold.amount;
    sold.sellVolumeUsd += valueUsd;
    sold.tradeCount++;
    addSample(sold.sampleTxHashes, swap.transactionHash);
  }

  const tokens = Array.from(tokenMap.values())
    .map((token) => ({
      ...token,
      buyVolumeUsd: roundUsd(token.buyVolumeUsd),
      sellVolumeUsd: roundUsd(token.sellVolumeUsd),
      totalVolumeUsd: roundUsd(token.buyVolumeUsd + token.sellVolumeUsd),
    }))
    .sort((left, right) => right.totalVolumeUsd - left.totalVolumeUsd);

  return {
    totalTrades: swaps.length,
    totalVolumeUsd: roundUsd(buyVolumeUsd + sellVolumeUsd),
    buyTxCount,
    sellTxCount,
    buyVolumeUsd: roundUsd(buyVolumeUsd),
    sellVolumeUsd: roundUsd(sellVolumeUsd),
    totalTokensTraded: tokenMap.size,
    firstTimestamp,
    lastTimestamp,
    sampleTxHashes,
    tokens,
  };
}

export function compactWalletTransfers(transfers: WalletTransfer[], walletAddress: string): Record<string, unknown> {
  let inCount = 0;
  let outCount = 0;
  let inValueUsd = 0;
  let outValueUsd = 0;
  const tokenMap = new Map<string, TransferTokenSummary>();
  const sampleTxHashes: string[] = [];
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  for (const transfer of transfers) {
    const valueUsd = transfer.amountUsd ?? 0;
    const direction = transfer.to === walletAddress ? "in" : transfer.from === walletAddress ? "out" : "unknown";
    addSample(sampleTxHashes, transfer.transactionSignature);

    if (!firstTimestamp || Date.parse(transfer.timestamp) < Date.parse(firstTimestamp)) firstTimestamp = transfer.timestamp;
    if (!lastTimestamp || Date.parse(transfer.timestamp) > Date.parse(lastTimestamp)) lastTimestamp = transfer.timestamp;

    const token = getOrCreateTransferToken(tokenMap, transfer);
    token.transferCount++;
    addSample(token.sampleTxHashes, transfer.transactionSignature);

    if (direction === "in") {
      inCount++;
      inValueUsd += valueUsd;
      token.inAmount += transfer.amount;
      token.inValueUsd += valueUsd;
    } else if (direction === "out") {
      outCount++;
      outValueUsd += valueUsd;
      token.outAmount += transfer.amount;
      token.outValueUsd += valueUsd;
    }
  }

  const tokens = Array.from(tokenMap.values())
    .map((token) => ({
      ...token,
      inValueUsd: roundUsd(token.inValueUsd),
      outValueUsd: roundUsd(token.outValueUsd),
      totalValueUsd: roundUsd(token.inValueUsd + token.outValueUsd),
    }))
    .sort((left, right) => right.totalValueUsd - left.totalValueUsd);

  return {
    totalTransfers: transfers.length,
    totalValueUsd: roundUsd(inValueUsd + outValueUsd),
    inCount,
    outCount,
    inValueUsd: roundUsd(inValueUsd),
    outValueUsd: roundUsd(outValueUsd),
    totalTokensTransferred: tokenMap.size,
    firstTimestamp,
    lastTimestamp,
    sampleTxHashes,
    tokens,
  };
}

interface PnLTokenSummary {
  address: string;
  symbol: string | null;
  name: string | null;
  pnlUsd: number;
  trades: number;
  wins: number;
  exits: number;
  winRate: number;
  totalEntered: number;
  totalExited: number;
}

export function compactWalletPnL(data: PnLComputedResult): Record<string, unknown> {
  const tokens: PnLTokenSummary[] = (data.allTokenBreakdowns ?? []).map((b) => ({
    address: b.address,
    symbol: b.symbol,
    name: b.name,
    pnlUsd: b.pnlUsd,
    trades: b.trades,
    wins: b.wins,
    exits: b.exits,
    winRate: b.exits > 0 ? roundUsd((b.wins / b.exits) * 100) : 0,
    totalEntered: roundUsd(b.totalEntered),
    totalExited: roundUsd(b.totalExited),
  })).sort((a, b) => b.pnlUsd - a.pnlUsd);

  const topGainer = tokens.length > 0 ? tokens[0] : null;
  const topLoser = tokens.length > 1 ? tokens[tokens.length - 1] : null;

  return {
    tradeCount: data.tradeCount,
    realizedPnlUsd: roundUsd(data.realizedPnlUsd),
    winRate: roundUsd(data.winningPercentage),
    totalBoughtUsd: roundUsd(data.totalBoughtUsd),
    totalSoldUsd: roundUsd(data.totalSoldUsd),
    tokenCount: tokens.length,
    topGainer: topGainer != null && topGainer.pnlUsd > 0 ? topGainer : null,
    topLoser: topLoser != null && topLoser.pnlUsd < 0 ? topLoser : null,
    tokens: tokens.slice(0, 20),
  };
}
