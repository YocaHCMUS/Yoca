import { mapWithConcurrency } from "@sv/util/concurrency.js";
import type {
  BirdeyePnlDuration,
  BirdeyeTokenPnlDetailsToken,
  WalletTimePeriod,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
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
  avgWinUsd: number;
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

const DISTRIBUTION_BINS = [
  { range: "0-5%", min: 0, max: 5 },
  { range: "5-10%", min: 5, max: 10 },
  { range: "10-20%", min: 10, max: 20 },
  { range: "20-50%", min: 20, max: 50 },
  { range: "50-100%", min: 50, max: 100 },
  { range: ">100%", min: 100, max: Infinity },
];

function mapPeriodToBirdeyeDuration(period: WalletTimePeriod): BirdeyePnlDuration {
  if (period === "24H") return "24h";
  if (period === "7D") return "7d";
  if (period === "30D") return "30d";
  if (period === "90D") return "90d";
  return "all";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function generateDistributionBins(pnlValues: number[]): WinrateBin[] {
  const bins = DISTRIBUTION_BINS.map((b) => ({ ...b, count: 0 }));

  for (const pnl of pnlValues) {
    const absPnl = Math.abs(pnl);
    for (const bin of bins) {
      if (absPnl >= bin.min && (absPnl < bin.max || bin.max === Infinity)) {
        bin.count++;
        break;
      }
    }
  }

  return bins.filter((b) => b.count > 0);
}

function calculateWinrate(tokens: BirdeyeTokenPnlDetailsToken[]) {
  const winningPnLs: number[] = [];
  const losingPnLs: number[] = [];
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalWinUsd = 0;
  let totalLossUsd = 0;

  for (const token of tokens) {
    // Token PnL Win Rate phải dùng cùng một chuẩn: realized_profit_usd.
    // Không dùng total_percent để phân loại thắng/thua vì total_percent có thể lệch với PnL đã chốt.
    const realizedPnlUsd = toFiniteNumber(token.pnl?.realized_profit_usd);
    const realizedPnlPercent = toFiniteNumber(token.pnl?.realized_profit_percent);

    if (realizedPnlUsd == null || realizedPnlUsd === 0) continue;

    totalTrades++;

    if (realizedPnlUsd > 0) {
      winningTrades++;
      winningPnLs.push(realizedPnlPercent ?? realizedPnlUsd);
      totalWinUsd += realizedPnlUsd;
      continue;
    }

    losingTrades++;
    losingPnLs.push(realizedPnlPercent ?? realizedPnlUsd);
    totalLossUsd += Math.abs(realizedPnlUsd);
  }

  return {
    winningPnLs,
    losingPnLs,
    totalTrades,
    winningTrades,
    losingTrades,
    avgWinUsd: winningTrades > 0 ? totalWinUsd / winningTrades : 0,
    avgLossUsd: losingTrades > 0 ? totalLossUsd / losingTrades : 0,
  };
}

async function fetchAllTokenPnlDetails(
  walletAddress: string,
  duration: BirdeyePnlDuration,
): Promise<BirdeyeTokenPnlDetailsToken[]> {
  const allTokens: BirdeyeTokenPnlDetailsToken[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const pnlDetails = await fetchBirdeyeTokenPnLDetails(walletAddress, {
      limit,
      offset,
      duration,
    });

    const tokens = Array.isArray(pnlDetails.tokens) ? pnlDetails.tokens : [];
    if (tokens.length === 0) break;

    allTokens.push(...tokens);

    if (tokens.length < limit) break;
    offset += limit;
  }

  return allTokens;
}

async function calculateWalletWinrate(
  walletAddress: string,
  walletName: string,
  timePeriod: WalletTimePeriod,
): Promise<WalletWinrateData> {
  let tokens: BirdeyeTokenPnlDetailsToken[] = [];

  try {
    const duration = mapPeriodToBirdeyeDuration(timePeriod);

    // Lấy PnL details đúng theo period hiện tại.
    // Không lấy duration="all" rồi tự lọc last_trade, vì sẽ dùng PnL all-time của token và làm lệch Avg Win/Loss.
    tokens = await fetchAllTokenPnlDetails(walletAddress, duration);

    console.log(
      `[WalletWinrate] Fetched ${tokens.length} token PnL rows for ${walletAddress}, duration=${duration}`,
    );
  } catch (error) {
    console.error(
      `[WalletWinrate] Failed to fetch PnL details for ${walletAddress}:`,
      error,
    );
  }

  const winrateStats = calculateWinrate(tokens);

  if (winrateStats.totalTrades === 0) {
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

  const winrate = (winrateStats.winningTrades / winrateStats.totalTrades) * 100;

  return {
    walletAddress,
    walletName,
    winrate: Math.round(winrate * 100) / 100,
    totalTrades: winrateStats.totalTrades,
    winningTrades: winrateStats.winningTrades,
    losingTrades: winrateStats.losingTrades,
    winningDistribution: generateDistributionBins(winrateStats.winningPnLs),
    losingDistribution: generateDistributionBins(winrateStats.losingPnLs),
    avgWinUsd: winrateStats.avgWinUsd,
    avgLossUsd: winrateStats.avgLossUsd,
  };
}

export async function getWinrateData(
  wallets: string[] = [],
  period: WalletTimePeriod = "30D",
): Promise<WinrateResponse> {
  console.log(
    `[getWinrateData] Starting winrate calculation for period: ${period}, wallets: ${wallets.join(", ")}`,
  );

  const normalizedWallets = wallets.map((w) => w.trim()).filter(Boolean);

  if (normalizedWallets.length === 0) {
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
    async (walletAddress) => calculateWalletWinrate(walletAddress, walletAddress, period),
  );

  return {
    wallets: winrateItems,
    metadata: {
      period,
      timestamp: Date.now(),
    },
  };
}
