import { mapWithConcurrency } from "@sv/util/concurrency.js";

import type {
    PnLDataPoint,
    WalletTimePeriod,
    PnLAggregation,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import { getCumulativePnL } from "@sv/services/wallet/walletCharts.service.js";

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
const MAX_WALLET_CHART_CONCURRENCY = 2;

export async function getHistoricalPnLData(
    wallets: string[] = [],
    timePeriod: WalletTimePeriod = "30D",
    aggregation: PnLAggregation = "daily",
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
        const walletPnLItems = await mapWithConcurrency(
            normalizedWallets,
            MAX_WALLET_CHART_CONCURRENCY,
            async (walletAddress) => getCumulativePnL(walletAddress, timePeriod, aggregation),
        );

        const walletsResponse: MultiWalletPnLItem[] = walletPnLItems.map((pnl, index) => ({
            walletAddress: normalizedWallets[index],
            walletName: DEFAULT_WALLET_NAMES[index % DEFAULT_WALLET_NAMES.length],
            dailyPnL: pnl.dailyPnL,
            cumulativePnL: pnl.cumulativePnL,
            startBalance: pnl.startBalance,
            endBalance: pnl.endBalance,
            realizedPnL: pnl.realizedPnL,
        }));

        return {
            wallets: walletsResponse,
            metadata: {
                currency: "USD",
            },
        };
    }

    const walletPnL = await getCumulativePnL(normalizedWallets[0], timePeriod, aggregation);

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
