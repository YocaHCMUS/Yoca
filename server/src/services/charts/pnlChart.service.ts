import {
  getWalletBalanceHistory,
} from "@sv/services/wallet/walletData.service.js";
import type { SupportedChain } from "@sv/services/wallet/dtos/walletDataObjects.js";

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
type Aggregation = "daily" | "weekly" | "monthly";

interface PnLPoint {
  timestamp: number;
  value: number;
}

interface SingleWalletPnL {
  dailyPnL: PnLPoint[];
  cumulativePnL: PnLPoint[];
  startBalance: number;
  endBalance: number;
}

interface MultiWalletPnLItem extends SingleWalletPnL {
  walletAddress: string;
  walletName: string;
}

export type HistoricalPnLResponse =
  | {
      dailyPnL: PnLPoint[];
      cumulativePnL: PnLPoint[];
      metadata: {
        currency: "USD";
        startBalance: number;
        endBalance: number;
      };
    }
  | {
      wallets: MultiWalletPnLItem[];
      metadata: {
        currency: "USD";
      };
    };

const DEFAULT_WALLET_NAMES = ["Main Wallet", "Trading Wallet", "Cold Storage"];

function getIntervalMs(aggregation: Aggregation): number {
  if (aggregation === "weekly") {
    return 7 * 24 * 60 * 60 * 1000;
  }
  if (aggregation === "monthly") {
    return 30 * 24 * 60 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function aggregateBalancePoints(
  points: Array<{ timestamp: number; value: number }>,
  aggregation: Aggregation,
): Array<{ timestamp: number; value: number }> {
  if (points.length <= 1 || aggregation === "daily") {
    return points;
  }

  const intervalMs = getIntervalMs(aggregation);
  const firstTs = points[0].timestamp;
  const buckets = new Map<number, { timestamp: number; value: number }>();

  for (const point of points) {
    const bucketIndex = Math.floor((point.timestamp - firstTs) / intervalMs);
    // Keep last point per bucket to represent end-of-period balance.
    buckets.set(bucketIndex, point);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, point]) => point);
}

function buildPnLFromBalances(
  balances: Array<{ timestamp: number; value: number }>,
): SingleWalletPnL {
  if (balances.length === 0) {
    return {
      dailyPnL: [],
      cumulativePnL: [],
      startBalance: 0,
      endBalance: 0,
    };
  }

  const dailyPnL: PnLPoint[] = [];
  const cumulativePnL: PnLPoint[] = [];

  let runningCumulative = 0;
  for (let i = 0; i < balances.length; i++) {
    const point = balances[i];
    const prevValue = i > 0 ? balances[i - 1].value : point.value;
    const delta = i > 0 ? point.value - prevValue : 0;

    runningCumulative += delta;

    dailyPnL.push({
      timestamp: point.timestamp,
      value: round2(delta),
    });

    cumulativePnL.push({
      timestamp: point.timestamp,
      value: round2(runningCumulative),
    });
  }

  return {
    dailyPnL,
    cumulativePnL,
    startBalance: round2(balances[0].value),
    endBalance: round2(balances[balances.length - 1].value),
  };
}

export async function getHistoricalPnLData(
  wallets: string[] = [],
  timePeriod: TimePeriod = "30D",
  aggregation: Aggregation = "daily",
  chain: SupportedChain = "solana",
): Promise<HistoricalPnLResponse> {
  const normalizedWallets = wallets.map((w) => w.trim()).filter(Boolean);

  if (normalizedWallets.length >= 2) {
    const walletHistories = await Promise.all(
      normalizedWallets.map((address) => getWalletBalanceHistory(address, chain, timePeriod)),
    );

    const walletItems: MultiWalletPnLItem[] = walletHistories.map((history, idx) => {
      const aggregated = aggregateBalancePoints(history, aggregation);
      const pnl = buildPnLFromBalances(aggregated);

      return {
        walletAddress: normalizedWallets[idx],
        walletName: DEFAULT_WALLET_NAMES[idx % DEFAULT_WALLET_NAMES.length],
        dailyPnL: pnl.dailyPnL,
        cumulativePnL: pnl.cumulativePnL,
        startBalance: pnl.startBalance,
        endBalance: pnl.endBalance,
      };
    });

    return {
      wallets: walletItems,
      metadata: { currency: "USD" },
    };
  }

  const singleWallet = normalizedWallets[0];
  if (!singleWallet) {
    return {
      dailyPnL: [],
      cumulativePnL: [],
      metadata: {
        currency: "USD",
        startBalance: 0,
        endBalance: 0,
      },
    };
  }

  const balanceHistory = await getWalletBalanceHistory(singleWallet, chain, timePeriod);
  const aggregated = aggregateBalancePoints(balanceHistory, aggregation);
  const pnl = buildPnLFromBalances(aggregated);

  return {
    dailyPnL: pnl.dailyPnL,
    cumulativePnL: pnl.cumulativePnL,
    metadata: {
      currency: "USD",
      startBalance: pnl.startBalance,
      endBalance: pnl.endBalance,
    },
  };
}
