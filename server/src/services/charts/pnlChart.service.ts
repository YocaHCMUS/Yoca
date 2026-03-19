import {
  getCumulativePnL,
  type PnLAggregation,
  type PnLDataPoint,
} from "@sv/services/wallet/walletData.service.js";

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
type Aggregation = PnLAggregation;

interface SingleWalletPnL {
  dailyPnL: PnLDataPoint[];
  cumulativePnL: PnLDataPoint[];
  startBalance: number;
  endBalance: number;
  realizedPnL?: number;
}

interface MultiWalletPnLItem extends SingleWalletPnL {
  walletAddress: string;
  walletName: string;
}

export type HistoricalPnLResponse =
  | {
    dailyPnL: PnLDataPoint[];
    cumulativePnL: PnLDataPoint[];
    realizedPnL?: number;
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

export async function getHistoricalPnLData(
  wallets: string[] = [],
  timePeriod: TimePeriod = "30D",
  aggregation: Aggregation = "daily",
): Promise<HistoricalPnLResponse> {
  const normalizedWallets = wallets.map((w) => w.trim()).filter(Boolean);

  if (normalizedWallets.length === 0) {
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

  if (normalizedWallets.length >= 2) {
    const walletPnLItems = await Promise.all(
      normalizedWallets.map((walletAddress) =>
        getCumulativePnL(walletAddress, timePeriod, aggregation),
      ),
    );

    const walletsResponse: MultiWalletPnLItem[] = walletPnLItems.map(
      (pnl, index) => ({
        walletAddress: normalizedWallets[index],
        walletName: DEFAULT_WALLET_NAMES[index % DEFAULT_WALLET_NAMES.length],
        dailyPnL: pnl.dailyPnL,
        cumulativePnL: pnl.cumulativePnL,
        startBalance: pnl.startBalance,
        endBalance: pnl.endBalance,
        realizedPnL: pnl.realizedPnL,
      }),
    );

    return {
      wallets: walletsResponse,
      metadata: {
        currency: "USD",
      },
    };
  }

  const walletPnL = await getCumulativePnL(
    normalizedWallets[0],
    timePeriod,
    aggregation,
  );

  return {
    dailyPnL: walletPnL.dailyPnL,
    cumulativePnL: walletPnL.cumulativePnL,
    realizedPnL: walletPnL.realizedPnL,
    metadata: {
      currency: "USD",
      startBalance: walletPnL.startBalance,
      endBalance: walletPnL.endBalance,
    },
  };
}
