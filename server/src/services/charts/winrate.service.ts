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
  let totalWinUsd = 0;
  let totalLossUsd = 0;

  for (const token of tokens) {
    const pnlPercent = token.pnl?.total_percent;
    const pnlUsd = token.pnl?.realized_profit_usd ?? 0; 
    
    // Tuỳ chọn: Lấy thêm volume để lọc các lệnh rác (ví dụ giao dịch < $1)
    // const volumeUsd = token.pnl?.total_volume_usd ?? 0;

    // Bỏ qua nếu data lỗi
    if (pnlPercent === null || pnlPercent === undefined || !isFinite(pnlPercent)) continue;
    
    // [BỘ LỌC SPAM] - Mở comment dòng dưới nếu muốn bỏ qua các token có khối lượng < 1 USD
    // if (volumeUsd < 1) continue;

    // Không tính các lệnh hoà vốn (0%) vào Win/Loss
    if (pnlPercent === 0 && pnlUsd === 0) continue;

    totalTrades++;

    if (pnlPercent > 0) {
      winningTrades++;
      winningPnLs.push(pnlPercent);
      totalWinUsd += pnlUsd;
    } else if (pnlPercent < 0) {
      losingTrades++;
      losingPnLs.push(pnlPercent);
      totalLossUsd += Math.abs(pnlUsd); 
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
  let allTokens: BirdeyeTokenPnlDetailsToken[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  try {
    // 1. Fetch toàn bộ token bằng vòng lặp Pagination
    while (hasMore) {
      const pnlDetails = await fetchBirdeyeTokenPnLDetails(walletAddress, {
        limit,
        offset,
        duration: "all",
      });

      if (pnlDetails.tokens && Array.isArray(pnlDetails.tokens) && pnlDetails.tokens.length > 0) {
        allTokens = allTokens.concat(pnlDetails.tokens);
        offset += limit;
        
        // Nếu số token trả về ít hơn limit, nghĩa là đã đến trang cuối
        if (pnlDetails.tokens.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[WalletWinrate] Fetched Total ${allTokens.length} tokens for ${walletAddress}`);

  } catch (error) {
    console.error(`[WalletWinrate] Failed to fetch PnL details for ${walletAddress}:`, error);
  }

  // Nếu không có token nào
  if (allTokens.length === 0) {
    return {
      walletAddress, walletName, winrate: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0,
      winningDistribution: [], losingDistribution: [], avgWinUsd: 0, avgLossUsd: 0,
    };
  }

  // 2. Lọc theo thời gian và tính toán
  const filteredTokens = filterTokensByRange(allTokens, timePeriod);
  const winrateStats = calculateWinrate(filteredTokens);

  if (winrateStats.totalTrades === 0) {
    return {
      walletAddress, walletName, winrate: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0,
      winningDistribution: [], losingDistribution: [], avgWinUsd: 0, avgLossUsd: 0,
    };
  }

  const winrate = (winrateStats.winningTrades / winrateStats.totalTrades) * 100;
  
  // 3. FIX LỖI LOGIC: Truyền đúng giá trị USD đã tính từ winrateStats
  const chartData = {
    walletAddress,
    walletName,
    winrate: Math.round(winrate * 100) / 100,
    totalTrades: winrateStats.totalTrades,
    winningTrades: winrateStats.winningTrades,
    losingTrades: winrateStats.losingTrades,
    winningDistribution: generateDistributionBins(winrateStats.winningPnLs),
    losingDistribution: generateDistributionBins(winrateStats.losingPnLs),
    avgWinUsd: winrateStats.avgWinUsd,   // <-- Đã sửa: Không dùng mảng phần trăm nữa
    avgLossUsd: winrateStats.avgLossUsd, // <-- Đã sửa: Không dùng mảng phần trăm nữa
  };

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
