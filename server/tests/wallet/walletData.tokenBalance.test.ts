import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const hoisted = vi.hoisted(() => {
    const getWalletBalancesMock = vi.fn();
    const fetchHeliusSolanaPortfolioMock = vi.fn();
    const fetchAllTransactionHistoryMock = vi.fn();
    const getCachedWalletTransactionsHeliusMock = vi.fn();
    const getTokenMarketDataMock = vi.fn();
    const getTokenHistoricalDataMock = vi.fn();

    const db = {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => []),
                    orderBy: vi.fn(() => ({
                        limit: async () => [],
                        then: (resolve: (value: unknown[]) => void) => resolve([]),
                    })),
                })),
                orderBy: vi.fn(() => ({
                    limit: async () => [],
                    then: (resolve: (value: unknown[]) => void) => resolve([]),
                })),
            })),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                onConflictDoUpdate: vi.fn(async () => undefined),
                onConflictDoNothing: vi.fn(async () => undefined),
                returning: vi.fn(async () => []),
            })),
        })),
        delete: vi.fn(() => ({
            where: vi.fn(async () => undefined),
        })),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(async () => undefined),
            })),
        })),
        execute: vi.fn(async () => undefined),
    };

    return {
        getWalletBalancesMock,
        fetchHeliusSolanaPortfolioMock,
        fetchAllTransactionHistoryMock,
        getCachedWalletTransactionsHeliusMock,
        getTokenMarketDataMock,
        getTokenHistoricalDataMock,
        db,
    };
});

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/routes/balances.js", () => ({
    default: {
        get: hoisted.getWalletBalancesMock,
    },
}));

vi.mock("@sv/services/wallet/fetchers/walletDataFetcher.service.js", () => ({
    fetchAllTransactionHistory: hoisted.fetchAllTransactionHistoryMock,
    fetchHeliusSolanaPortfolio: hoisted.fetchHeliusSolanaPortfolioMock,
    fetchHeliusSolanaSwap: vi.fn(async () => []),
    fetchHeliusSolanaTransactions: vi.fn(async () => []),
    fetchHeliusSolanaTransfers: vi.fn(async () => []),
    timePeriodToFromSec: (timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All") => {
        const nowSec = Math.floor(Date.now() / 1000);
        const daySec = 24 * 60 * 60;
        switch (timePeriod) {
            case "7D":
                return nowSec - 7 * daySec;
            case "30D":
                return nowSec - 30 * daySec;
            case "60D":
                return nowSec - 60 * daySec;
            case "90D":
                return nowSec - 90 * daySec;
            case "1Y":
                return nowSec - 365 * daySec;
            case "All":
                return 0;
        }
    },
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: hoisted.getCachedWalletTransactionsHeliusMock,
    getCachedWalletSwaps: vi.fn(async () => null),
    getCachedWalletTransactions: vi.fn(async () => null),
    getCachedWalletTransfers: vi.fn(async () => null),
}));

vi.mock("@sv/services/wallet/db/walletDataCacher.js", () => ({
    saveOverviewCache: vi.fn(async () => undefined),
    saveSwapsCache: vi.fn(async () => undefined),
    saveTransactionsCache: vi.fn(async () => undefined),
    saveTransactionsHeliusCache: vi.fn(async () => undefined),
    saveTransfersCache: vi.fn(async () => undefined),
}));

vi.mock("@sv/services/tokens/token-market-data.js", () => ({
    getTokenMarketData: hoisted.getTokenMarketDataMock,
}));

vi.mock("@sv/services/tokens/token-history.js", () => ({
    getTokenHistoricalData: hoisted.getTokenHistoricalDataMock,
}));

import { getWalletTokenBalanceHistory } from "../../src/services/wallet/walletData.service.ts";

function getSeriesValueByDate(
    series: Array<{ date: string; value: number }>,
    day: string,
): number {
    const found = series.find((point) => point.date.startsWith(`${day}T`));
    expect(found).toBeDefined();
    return found!.value;
}

describe("walletData.service - token USD historical pricing", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));

        hoisted.getWalletBalancesMock.mockReset();
        hoisted.fetchHeliusSolanaPortfolioMock.mockReset();
        hoisted.fetchAllTransactionHistoryMock.mockReset();
        hoisted.getCachedWalletTransactionsHeliusMock.mockReset();
        hoisted.getTokenMarketDataMock.mockReset();
        hoisted.getTokenHistoricalDataMock.mockReset();

        hoisted.getWalletBalancesMock.mockReturnValue(null);
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                name: "Solana",
                amount: 10,
                priceUsd: 100,
                valueUsd: 1000,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: 0 },
            coveredRange: { earliestSec: 0, latestSec: 0 },
            isFullyCovered: true,
        });
        hoisted.fetchAllTransactionHistoryMock.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("maps usdSeries to nearest prior historical price and falls back for missing earlier dates", async () => {
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 100 },
        });
        hoisted.getTokenHistoricalDataMock.mockResolvedValue([
            {
                dateStr: "2026-03-06",
                timestampMs: new Date("2026-03-06T00:00:00.000Z").getTime(),
                price: 2,
                marketCap: null,
                volume: null,
            },
            {
                dateStr: "2026-03-08",
                timestampMs: new Date("2026-03-08T00:00:00.000Z").getTime(),
                price: 3,
                marketCap: null,
                volume: null,
            },
            {
                dateStr: "2026-03-10",
                timestampMs: new Date("2026-03-10T00:00:00.000Z").getTime(),
                price: 4,
                marketCap: null,
                volume: null,
            },
        ]);

        const result = await getWalletTokenBalanceHistory("wallet-1", "solana", "SOL", "7D");

        expect(result.tokenSeries.length).toBe(result.usdSeries.length);

        expect(getSeriesValueByDate(result.usdSeries, "2026-03-05")).toBe(1000);
        expect(getSeriesValueByDate(result.usdSeries, "2026-03-06")).toBe(20);
        expect(getSeriesValueByDate(result.usdSeries, "2026-03-09")).toBe(30);
        expect(getSeriesValueByDate(result.usdSeries, "2026-03-11")).toBe(40);
    });

    it("falls back to current price for all points when historical prices are unavailable", async () => {
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 75 },
        });
        hoisted.getTokenHistoricalDataMock.mockResolvedValue(null);

        const result = await getWalletTokenBalanceHistory("wallet-1", "solana", "SOL", "7D");

        expect(result.tokenSeries.length).toBe(result.usdSeries.length);
        expect(result.tokenSeries.length).toBeGreaterThan(1);

        const uniqueUsdValues = new Set(result.usdSeries.map((point) => point.value));
        expect(uniqueUsdValues.size).toBe(1);
        expect(Array.from(uniqueUsdValues)[0]).toBe(750);

        for (let i = 0; i < result.tokenSeries.length; i++) {
            expect(result.tokenSeries[i].timestamp).toBe(result.usdSeries[i].timestamp);
        }
    });
});
