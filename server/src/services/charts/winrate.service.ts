import {
    WALLET_WINRATE_24H_TTL_MS,
    WALLET_WINRATE_30D_TTL_MS,
    WALLET_WINRATE_7D_TTL_MS,
    WALLET_WINRATE_90D_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
    walletAnalyses,
    type WalletAnalysisSelect,
} from "@sv/db/schema.js";
import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import { mbl_WalletAnalysisSchema } from "@sv/services/_types/wallet-raw-responses.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import * as mobula from "@sv/util/util-mobula.js";
import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";

export type WinratePeriod = "24H" | "7D" | "30D" | "90D";

export interface WinrateBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

export interface WalletWinrateData {
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

export interface WinrateResponse {
  wallets: WalletWinrateData[];
  metadata: {
    period: string;
    timestamp: number;
  };
}

const WINRATE_TTL_BY_PERIOD: Record<WinratePeriod, number> = {
  "24H": WALLET_WINRATE_24H_TTL_MS,
  "7D": WALLET_WINRATE_7D_TTL_MS,
  "30D": WALLET_WINRATE_30D_TTL_MS,
  "90D": WALLET_WINRATE_90D_TTL_MS,
};

const MOBULA_PERIOD_BY_WINRATE_PERIOD: Record<WinratePeriod, string> = {
  "24H": "1d",
  "7D": "7d",
  "30D": "30d",
  "90D": "90d",
};

function mapStoredWinrateToResponse(
  row: WalletAnalysisSelect,
): WalletWinrateData {
  return {
    walletAddress: row.walletAddress,
    walletName: row.walletAddress,
    winrate: row.winrate,
    totalTrades: row.totalTrades,
    winningTrades: row.winningTrades,
    losingTrades: row.losingTrades,
    winningDistribution: [
      { range: "0%-50%", count: row.win0To50Count, min: 0, max: 50 },
      { range: "50%-200%", count: row.win50To200Count, min: 50, max: 200 },
      { range: "200%-500%", count: row.win200To500Count, min: 200, max: 500 },
      { range: ">500%", count: row.winOver500Count, min: 500, max: Infinity },
    ],
    losingDistribution: [
      { range: "-50%-0%", count: row.loss0To50Count, min: 0, max: 50 },
      { range: "<-50%", count: row.lossOver50Count, min: 50, max: Infinity },
    ],
    avgWinUsd: row.avgWinUsd,
    avgLossUsd: row.avgLossUsd,
  };
}

export async function fetchWalletAnalysis(
  walletAddress: string,
  period: WinratePeriod,
): Promise<WalletAnalysisSelect> {
  const endpoint = mobula.getEndpoint("/2/wallet/analysis");
  endpoint.search = new URLSearchParams({
    wallet: walletAddress,
    blockchain: "solana:solana",
    period: MOBULA_PERIOD_BY_WINRATE_PERIOD[period],
  }).toString();

  const response = await rlFetch(endpoint, {
    method: "GET",
    headers: mobula.getRequiredHeaders(),
    rlLimiter: mobula.limiter,
  });
  const result = await getTrackedApiResult(mbl_WalletAnalysisSchema, response);
  if (!result) {
    throw new Error(`Mobula wallet analysis returned invalid data (${response.status})`);
  }

  const distribution = result.data.winRateDistribution;
  const win0To50Count = distribution["0%-50%"];
  const win50To200Count = distribution["50%-200%"];
  const win200To500Count = distribution["200%-500%"];
  const winOver500Count = distribution[">500%"];
  const loss0To50Count = distribution["-50%-0%"];
  const lossOver50Count = distribution["<-50%"];
  const winningTrades =
    win0To50Count + win50To200Count + win200To500Count + winOver500Count;
  const losingTrades = loss0To50Count + lossOver50Count;
  const totalTrades = winningTrades + losingTrades;
  const totalWinUsd = result.data.stat.winRealizedPnl;
  const totalLossUsd = Math.max(
    0,
    totalWinUsd - result.data.stat.periodRealizedPnlUSD,
  );
  const fetchedAtMs = dayjs.utc().valueOf();

  const rows = await db
    .insert(walletAnalyses)
    .values({
      walletAddress,
      period,
      winrate: result.data.stat.winRealizedPnlRate,
      totalTrades,
      winningTrades,
      losingTrades,
      avgWinUsd: winningTrades > 0 ? totalWinUsd / winningTrades : 0,
      avgLossUsd: losingTrades > 0 ? totalLossUsd / losingTrades : 0,
      win0To50Count,
      win50To200Count,
      win200To500Count,
      winOver500Count,
      loss0To50Count,
      lossOver50Count,
      buyVolumeUsd: result.data.stat.periodVolumeBuy,
      sellVolumeUsd: result.data.stat.periodVolumeSell,
      buyTransactionCount: result.data.stat.periodBuys,
      sellTransactionCount: result.data.stat.periodSells,
      transactionCount:
        result.data.stat.periodBuys + result.data.stat.periodSells,
      tokensTradedCount: result.data.stat.periodTradingTokens,
      pnlTotalUsd: result.data.stat.periodTotalPnlUSD,
      pnlRealizedUsd: result.data.stat.periodRealizedPnlUSD,
      pnlUnrealizedUsd:
        result.data.stat.periodTotalPnlUSD -
        result.data.stat.periodRealizedPnlUSD,
      fetchedAtMs,
    })
    .onConflictDoUpdate({
      target: [walletAnalyses.walletAddress, walletAnalyses.period],
      set: {
        winrate: result.data.stat.winRealizedPnlRate,
        totalTrades,
        winningTrades,
        losingTrades,
        avgWinUsd: winningTrades > 0 ? totalWinUsd / winningTrades : 0,
        avgLossUsd: losingTrades > 0 ? totalLossUsd / losingTrades : 0,
        win0To50Count,
        win50To200Count,
        win200To500Count,
        winOver500Count,
        loss0To50Count,
        lossOver50Count,
        buyVolumeUsd: result.data.stat.periodVolumeBuy,
        sellVolumeUsd: result.data.stat.periodVolumeSell,
        buyTransactionCount: result.data.stat.periodBuys,
        sellTransactionCount: result.data.stat.periodSells,
        transactionCount:
          result.data.stat.periodBuys + result.data.stat.periodSells,
        tokensTradedCount: result.data.stat.periodTradingTokens,
        pnlTotalUsd: result.data.stat.periodTotalPnlUSD,
        pnlRealizedUsd: result.data.stat.periodRealizedPnlUSD,
        pnlUnrealizedUsd:
          result.data.stat.periodTotalPnlUSD -
          result.data.stat.periodRealizedPnlUSD,
        fetchedAtMs,
      },
    })
    .returning();

  const saved = rows[0];
  if (!saved) {
    throw new Error("Failed to persist Mobula wallet analysis");
  }

  return saved;
}

export async function fetchWalletWinrateData(
  walletAddress: string,
  period: WinratePeriod,
): Promise<WalletWinrateData> {
  return mapStoredWinrateToResponse(
    await fetchWalletAnalysis(walletAddress, period),
  );
}

export async function getWalletAnalysis(
  walletAddress: string,
  period: WinratePeriod,
): Promise<WalletAnalysisSelect> {
  const storedRows = await db
    .select()
    .from(walletAnalyses)
    .where(
      and(
        eq(walletAnalyses.walletAddress, walletAddress),
        eq(walletAnalyses.period, period),
      ),
    )
    .limit(1);
  const stored = storedRows[0];

  if (
    stored &&
    stored.fetchedAtMs >=
      dayjs.utc().valueOf() - WINRATE_TTL_BY_PERIOD[period]
  ) {
    return stored;
  }

  try {
    return await fetchWalletAnalysis(walletAddress, period);
  } catch (error) {
    if (stored) {
      console.warn("Mobula win-rate refresh failed; returning stored data", {
        walletAddress,
        period,
        error,
      });
      return stored;
    }

    throw error;
  }
}

export async function getWalletWinrateData(
  walletAddress: string,
  period: WinratePeriod,
): Promise<WalletWinrateData> {
  return mapStoredWinrateToResponse(
    await getWalletAnalysis(walletAddress, period),
  );
}

export async function getWinrateData(
  wallets: string[] = [],
  period: WinratePeriod = "30D",
): Promise<WinrateResponse> {
  const normalizedWallets = Array.from(
    new Set(wallets.map((wallet) => wallet.trim()).filter(Boolean)),
  );
  const winrateItems = await Promise.all(
    normalizedWallets.map((walletAddress) =>
      getWalletWinrateData(walletAddress, period),
    ),
  );

  return {
    wallets: winrateItems,
    metadata: {
      period,
      timestamp: dayjs.utc().valueOf(),
    },
  };
}
