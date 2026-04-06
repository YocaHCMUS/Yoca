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

    console.log("[WalletWinrate] RAW BIRDEYE RESPONSE:", JSON.stringify(pnlDetails, null, 2));

    if (pnlDetails.tokens && Array.isArray(pnlDetails.tokens)) {
      console.log(`[WalletWinrate] Processing ${pnlDetails.tokens.length} tokens from Birdeye`);
      
      for (const token of pnlDetails.tokens) {
        console.log(`[WalletWinrate] Token: ${token.symbol || 'UNKNOWN'}, PnL data:`, JSON.stringify(token.pnl, null, 2));
        
        // Extract PnL percentage from the correct Birdeye property
        // Birdeye returns pnl.total_percent for the overall PnL percentage of the token position
        const pnlPercent = token.pnl?.total_percent;

        if (pnlPercent === null || pnlPercent === undefined || !isFinite(pnlPercent)) {
          console.log(`[WalletWinrate] Skipping token ${token.symbol}: pnlPercent is not a valid number (${pnlPercent})`);
          continue;
        }

        totalTrades++;
        console.log(`[WalletWinrate] Token ${token.symbol} PnL: ${pnlPercent}%`);

        if (pnlPercent > 0) {
          winningTrades++;
          winningPnLs.push(pnlPercent);
        } else {
          losingTrades++;
          losingPnLs.push(pnlPercent);
        }
      }
      
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
