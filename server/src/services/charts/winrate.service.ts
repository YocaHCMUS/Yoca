import { mapWithConcurrency } from "@sv/util/concurrency.js";
import type { WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
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
}

interface WinrateResponse {
  wallets: WalletWinrateData[];
  metadata: {
    period: string;
    timestamp: number;
  };
}

const DEFAULT_WALLET_NAMES = ["Main Wallet", "Trading Wallet", "Cold Storage"];
const MAX_WALLET_CHART_CONCURRENCY = 4;

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

async function calculateWalletWinrate(
  walletAddress: string,
  walletName: string,
  timePeriod: WalletTimePeriod
): Promise<WalletWinrateData> {
  const winningPnLs: number[] = [];
  const losingPnLs: number[] = [];
  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  try {
    const pnlDetails = await fetchBirdeyeTokenPnLDetails(walletAddress, {
      limit: 100,
      offset: 0,
      duration: "all",
    });

    if (pnlDetails.tokens && Array.isArray(pnlDetails.tokens)) {
      for (const token of pnlDetails.tokens) {
        if (!token.pnl_percent) continue;

        const pnlPercent = typeof token.pnl_percent === 'number' 
          ? token.pnl_percent 
          : parseFloat(token.pnl_percent as string);

        if (!isFinite(pnlPercent)) continue;

        totalTrades++;

        if (pnlPercent > 0) {
          winningTrades++;
          winningPnLs.push(pnlPercent);
        } else {
          losingTrades++;
          losingPnLs.push(pnlPercent);
        }
      }
    }
  } catch (error) {
    console.error(`[WalletWinrate] Failed to fetch PnL details for ${walletAddress}:`, error);
  }

  if (totalTrades === 0) {
    return {
      walletAddress,
      walletName,
      winrate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winningDistribution: [],
      losingDistribution: [],
    };
  }

  const winrate = (winningTrades / totalTrades) * 100;

  return {
    walletAddress,
    walletName,
    winrate: Math.round(winrate * 100) / 100,
    totalTrades,
    winningTrades,
    losingTrades,
    winningDistribution: generateDistributionBins(winningPnLs),
    losingDistribution: generateDistributionBins(losingPnLs),
  };
}

export async function getWinrateData(
  wallets: string[] = [],
  period: WalletTimePeriod = "30D"
): Promise<WinrateResponse> {
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
    async (walletAddress, index) =>
      calculateWalletWinrate(
        walletAddress,
        DEFAULT_WALLET_NAMES[index % DEFAULT_WALLET_NAMES.length],
        period
      )
  );

  return {
    wallets: winrateItems,
    metadata: {
      period,
      timestamp: Date.now(),
    },
  };
}
