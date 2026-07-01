import type { WalletAnalysisSelect } from "@sv/db/schema";
import type { PnLDataPoint } from "@sv/services/wallet/dtos/walletDataObjects";
import {
  fetchWalletAnalysis,
  getWalletAnalysis,
  type WinratePeriod,
} from "../wallet-analysis";
import dayjs from "dayjs";

export interface WalletPnLData {
  walletAddress: string;
  walletName?: string;
  dailyPnL: PnLDataPoint[];
  cumulativePnL: PnLDataPoint[];
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

function mapStoredAnalysisToPnLResponse(
  row: WalletAnalysisSelect,
): WalletPnLData {
  const sourceDays =
    row.calendarBreakdown.length > 0
      ? row.calendarBreakdown.map((day) => ({
          date: day.date,
          realizedPnlUsd: day.realizedPnlUSD,
        }))
      : row.periodTimeframes.map((timeframe) => ({
          date: timeframe.date,
          realizedPnlUsd: timeframe.realized,
        }));

  const dailyPnL = sourceDays
    .map((day) => ({
      timestamp: dayjs.utc(day.date).startOf("day").valueOf(),
      value: day.realizedPnlUsd,
    }))
    .filter((day) => Number.isFinite(day.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);

  let cumulativeValue = 0;
  const cumulativePnL = dailyPnL.map((day) => {
    cumulativeValue += day.value;
    return {
      timestamp: day.timestamp,
      value: cumulativeValue,
    };
  });

  return {
    walletAddress: row.walletAddress,
    walletName: row.walletAddress,
    dailyPnL,
    cumulativePnL,
    totalPnL: row.pnlTotalUsd,
    realizedPnL: row.pnlRealizedUsd,
    unrealizedPnL: row.pnlUnrealizedUsd,
  };
}

export async function fetchWalletPnLData(
  walletAddress: string,
  period: WinratePeriod,
): Promise<WalletPnLData> {
  return mapStoredAnalysisToPnLResponse(
    await fetchWalletAnalysis(walletAddress, period),
  );
}

export async function getWalletPnLData(
  walletAddress: string,
  period: WinratePeriod,
): Promise<WalletPnLData> {
  return mapStoredAnalysisToPnLResponse(
    await getWalletAnalysis(walletAddress, period),
  );
}

export async function getPnLData(
  wallets: string[] = [],
  period: WinratePeriod = "30D",
): Promise<WalletPnLData[]> {
  const normalizedWallets = Array.from(
    new Set(wallets.map((wallet) => wallet.trim()).filter(Boolean)),
  );
  const pnlItems = await Promise.all(
    normalizedWallets.map((walletAddress) =>
      getWalletPnLData(walletAddress, period),
    ),
  );

  return pnlItems;
}
