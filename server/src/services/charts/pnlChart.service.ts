import {
  getCumulativePnLChunk,
  getCumulativePnL,
  resolveWalletTimeRangeSec,
  type ChartChunkInfo,
  type ChartChunkState,
  type ChartPageInfo,
  type PnLAggregation,
  type PnLDataPoint,
} from "@sv/services/wallet/walletData.service.js";
import { mapWithConcurrency } from "@sv/util/concurrency.js";

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
type Aggregation = PnLAggregation;
const MAX_WALLET_CHART_CONCURRENCY = 2;

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

type HistoricalPnLChunkResponse = HistoricalPnLResponse & {
  pageInfo?: ChartPageInfo;
  chunkInfo?: ChartChunkInfo;
  cursorState?: ChartChunkState;
};

type HistoricalPnLChunkOptions = {
  limit?: number;
  requestedFromSec?: number;
  requestedToSec?: number;
  chunkToSec?: number;
  heliusCursor?: string | null;
};

const DEFAULT_WALLET_NAMES = ["Main Wallet", "Trading Wallet", "Cold Storage"];

export async function getHistoricalPnLData(
  wallets: string[] = [],
  timePeriod: TimePeriod = "30D",
  aggregation: Aggregation = "daily",
  chunkOptions?: HistoricalPnLChunkOptions,
): Promise<HistoricalPnLChunkResponse> {
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

  const shouldUseChunking =
    chunkOptions != null &&
    (
      chunkOptions.limit != null ||
      chunkOptions.chunkToSec != null ||
      chunkOptions.requestedFromSec != null ||
      chunkOptions.requestedToSec != null ||
      chunkOptions.heliusCursor != null
    );

  if (shouldUseChunking) {
    const nowSec = Math.floor(Date.now() / 1000);
    const resolvedRange =
      chunkOptions.requestedFromSec != null || chunkOptions.requestedToSec != null
        ? {
          fromSec: Math.max(0, Math.floor(chunkOptions.requestedFromSec ?? 0)),
          toSec: Math.max(
            Math.max(0, Math.floor(chunkOptions.requestedFromSec ?? 0)),
            Math.floor(chunkOptions.requestedToSec ?? nowSec),
          ),
        }
        : resolveWalletTimeRangeSec(timePeriod, nowSec);

    if (normalizedWallets.length >= 2) {
      const walletPnLItems = await mapWithConcurrency(
        normalizedWallets,
        MAX_WALLET_CHART_CONCURRENCY,
        async (walletAddress) =>
          getCumulativePnLChunk(walletAddress, {
            timePeriod,
            aggregation,
            limit: chunkOptions.limit,
            requestedFromSec: resolvedRange.fromSec,
            requestedToSec: resolvedRange.toSec,
            chunkToSec: chunkOptions.chunkToSec,
            heliusCursor: chunkOptions.heliusCursor,
          }),
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

      const firstChunk = walletPnLItems[0];
      return {
        wallets: walletsResponse,
        metadata: {
          currency: "USD",
        },
        pageInfo: {
          pageSize: chunkOptions.limit ?? 0,
          hasMore: firstChunk?.chunkState.hasMore ?? false,
          nextCursor: null,
          source: "mixed",
        },
        chunkInfo: firstChunk?.chunkInfo,
        cursorState: firstChunk?.chunkState,
      };
    }

    const walletPnL = await getCumulativePnLChunk(normalizedWallets[0], {
      timePeriod,
      aggregation,
      limit: chunkOptions.limit,
      requestedFromSec: resolvedRange.fromSec,
      requestedToSec: resolvedRange.toSec,
      chunkToSec: chunkOptions.chunkToSec,
      heliusCursor: chunkOptions.heliusCursor,
    });

    return {
      dailyPnL: walletPnL.dailyPnL,
      cumulativePnL: walletPnL.cumulativePnL,
      realizedPnL: walletPnL.realizedPnL,
      metadata: {
        currency: "USD",
        startBalance: walletPnL.startBalance,
        endBalance: walletPnL.endBalance,
      },
      pageInfo: {
        pageSize: chunkOptions.limit ?? 0,
        hasMore: walletPnL.chunkState.hasMore,
        nextCursor: null,
        source: "mixed",
      },
      chunkInfo: walletPnL.chunkInfo,
      cursorState: walletPnL.chunkState,
    };
  }

  if (normalizedWallets.length >= 2) {
    const walletPnLItems = await mapWithConcurrency(
      normalizedWallets,
      MAX_WALLET_CHART_CONCURRENCY,
      async (walletAddress) =>
        getCumulativePnL(walletAddress, timePeriod, aggregation),
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
