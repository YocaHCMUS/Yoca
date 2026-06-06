import { mapWithConcurrency } from "@sv/util/concurrency.js";
import type { WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
import type { BirdeyeTokenPnlDetailsToken } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { fetchBirdeyeTokenPnLDetails } from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";

interface WinrateBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

interface WalletWinrateData {
  walletAddress: string;
  walletName?: string;
  winrate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winningDistribution: WinrateBin[];
  losingDistribution: WinrateBin[];
  avgWinUsd: number; // Thêm trường này
  avgLossUsd: number; 
}

interface WinrateResponse {
  wallets: WalletWinrateData[];
  metadata: {
    period: string;
    timestamp: number;
  };
}

const MAX_WALLET_CHART_CONCURRENCY = 4;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type WinrateRange = "24H" | "7D" | "30D" | "All";

const DISTRIBUTION_BINS = [
  { range: "0-5%", min: 0, max: 5 },
  { range: "5-10%", min: 5, max: 10 },
  { range: "10-20%", min: 10, max: 20 },
  { range: "20-50%", min: 20, max: 50 },
  { range: "50-100%", min: 50, max: 100 },
  { range: ">100%", min: 100, max: Infinity },
];

function generateDistributionBins(pnlValues: number[]): WinrateBin[] {
  const bins = DISTRIBUTION_BINS.map(b => ({ ...b, count: 0 }));

  for (const pnl of pnlValues) {
    const absPnl = Math.abs(pnl);
    for (const bin of bins) {
      if (absPnl >= bin.min && (absPnl < bin.max || bin.max === Infinity)) {
        bin.count++;
        break;
      }
    }
  }

  return bins.filter(b => b.count > 0);
}

function resolveWinrateRange(period: WalletTimePeriod): WinrateRange {
  if (period === "24H" || period === "7D" || period === "30D") {
    return period;
  }

  return "All";
}

function resolveRangeStartMs(range: WinrateRange, nowMs: number): number | null {
  if (range === "All") {
    return null;
  }

  if (range === "24H") {
    return nowMs - ONE_DAY_MS;
  }

  if (range === "7D") {
    return nowMs - 7 * ONE_DAY_MS;
  }

  return nowMs - 30 * ONE_DAY_MS;
}

function toTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const parsedAsNumber = Number(value);
    if (Number.isFinite(parsedAsNumber)) {
      return parsedAsNumber > 1e12 ? parsedAsNumber : parsedAsNumber * 1000;
    }

    const parsedAsDate = Date.parse(value);
    if (Number.isFinite(parsedAsDate)) {
      return parsedAsDate;
    }
  }

  return null;
}

function extractTokenTimestampMs(token: BirdeyeTokenPnlDetailsToken): number | null {
  const rawToken = token as Record<string, unknown>;

  return (
    toTimestampMs(rawToken.last_trade_unix_time) ??
    toTimestampMs(rawToken.lastTradeUnixTime) ??
    toTimestampMs(rawToken.blockTime) ??
    toTimestampMs(rawToken.block_time) ??
    toTimestampMs(rawToken.blockTimestamp) ??
    toTimestampMs(rawToken.timestamp)
  );
}

function filterTokensByRange(
  tokens: BirdeyeTokenPnlDetailsToken[],
  period: WalletTimePeriod,
  nowMs: number = Date.now(),
): BirdeyeTokenPnlDetailsToken[] {
  const range = resolveWinrateRange(period);
  const rangeStartMs = resolveRangeStartMs(range, nowMs);

  if (rangeStartMs == null) {
    return tokens;
  }

  return tokens.filter((token) => {
    const timestampMs = extractTokenTimestampMs(token);
    return timestampMs != null && timestampMs >= rangeStartMs && timestampMs <= nowMs;
  });
}

function calculateWinrate(tokens: BirdeyeTokenPnlDetailsToken[]) {
  let winningPnLs: number[] = [];
  let losingPnLs: number[] = [];
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  
  // THÊM CÁC BIẾN NÀY ĐỂ TÍNH TỔNG USD
  let totalWinUsd = 0;
  let totalLossUsd = 0;

  for (const token of tokens) {
    const pnlPercent = token.pnl?.total_percent;
    // Giả sử Birdeye trả về giá trị PnL tuyệt đối (USD) trong token.pnl.realized_pnl hoặc tương tự
    const pnlUsd = token.pnl?.realized_profit_usd ?? 0; 

    if (pnlPercent === null || pnlPercent === undefined || !isFinite(pnlPercent)) continue;

    totalTrades++;

    if (pnlPercent > 0) {
      winningTrades++;
      winningPnLs.push(pnlPercent);
      totalWinUsd += pnlUsd;
    } else {
      losingTrades++;
      losingPnLs.push(pnlPercent);
      totalLossUsd += Math.abs(pnlUsd); // Lấy giá trị tuyệt đối cho avg loss
    }
  }

  return {
    winningPnLs,
    losingPnLs,
    totalTrades,
    winningTrades,
    losingTrades,
    avgWinUsd: winningTrades > 0 ? totalWinUsd / winningTrades : 0,
    avgLossUsd: losingTrades > 0 ? totalLossUsd / losingTrades : 0
  };
}

async function calculateWalletWinrate(
  walletAddress: string,
  walletName: string,
  timePeriod: WalletTimePeriod
): Promise<WalletWinrateData> {
  let winningPnLs: number[] = [];
  let losingPnLs: number[] = [];
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  try {
    const pnlDetails = await fetchBirdeyeTokenPnLDetails(walletAddress, {
      limit: 100,
      offset: 0,
      duration: "all",
    });

    console.log("[WalletWinrate] RAW BIRDEYE RESPONSE:", JSON.stringify(pnlDetails, null, 2));

    if (pnlDetails.tokens && Array.isArray(pnlDetails.tokens)) {
      const filteredTokens = filterTokensByRange(pnlDetails.tokens, timePeriod);

      console.log(`[WalletWinrate] Processing ${filteredTokens.length}/${pnlDetails.tokens.length} tokens from Birdeye for period ${timePeriod}`);

      const winrateStats = calculateWinrate(filteredTokens);
      winningPnLs = winrateStats.winningPnLs;
      losingPnLs = winrateStats.losingPnLs;
      totalTrades = winrateStats.totalTrades;
      winningTrades = winrateStats.winningTrades;
      losingTrades = winrateStats.losingTrades;

      console.log(`[WalletWinrate] CALC INPUT (Birdeye items): totalTrades=${totalTrades}, winning=${winningTrades}, losing=${losingTrades}`);
    } else {
      console.log("[WalletWinrate] No tokens array in pnlDetails response");
    }
  } catch (error) {
    console.error(`[WalletWinrate] Failed to fetch PnL details for ${walletAddress}:`, error);
  }

  if (totalTrades === 0) {
    console.log(`[WalletWinrate] No valid trades found for wallet ${walletAddress}`);
    return {
      walletAddress,
      walletName,
      winrate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winningDistribution: [],
      losingDistribution: [],
      avgWinUsd: 0,
      avgLossUsd: 0,
    };
  }

  const winrate = (winningTrades / totalTrades) * 100;
  const chartData = {
    walletAddress,
    walletName,
    winrate: Math.round(winrate * 100) / 100,
    totalTrades,
    winningTrades,
    losingTrades,
    winningDistribution: generateDistributionBins(winningPnLs),
    losingDistribution: generateDistributionBins(losingPnLs),
    avgWinUsd: winningTrades > 0 ? winningPnLs.reduce((sum, val) => sum + val, 0) / winningTrades : 0,
    avgLossUsd: losingTrades > 0 ? losingPnLs.reduce((sum, val) => sum + val, 0) / losingTrades : 0,
  };

  console.log(`[WalletWinrate] FINAL CHART DATA:`, JSON.stringify(chartData, null, 2));

  return chartData;
}

export async function getWinrateData(
  wallets: string[] = [],
  period: WalletTimePeriod = "30D"
): Promise<WinrateResponse> {
  console.log(`[getWinrateData] Starting winrate calculation for period: ${period}, wallets: ${wallets.join(', ')}`);
  
  const normalizedWallets = wallets.map((w) => w.trim()).filter(Boolean);

  if (normalizedWallets.length === 0) {
    console.log("[getWinrateData] No wallets provided, returning empty response");
    return {
      wallets: [],
      metadata: {
        period,
        timestamp: Date.now(),
      },
    };
  }

  const winrateItems = await mapWithConcurrency(
    normalizedWallets,
    MAX_WALLET_CHART_CONCURRENCY,
    async (walletAddress) =>
      calculateWalletWinrate(
        walletAddress,
        walletAddress,
        period
      )
  );

  const response: WinrateResponse = {
    wallets: winrateItems,
    metadata: {
      period,
      timestamp: Date.now(),
    },
  };

  console.log("[getWinrateData] Final winrate response:", JSON.stringify(response, null, 2));
  
  return response;
}
