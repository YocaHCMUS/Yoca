import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const hoisted = vi.hoisted(() => {
    const getWalletBalancesMock = vi.fn();
    const fetchHeliusSolanaPortfolioMock = vi.fn();
    const fetchAllTransactionHistoryMock = vi.fn();
    const getCachedWalletTransactionsHeliusMock = vi.fn();
    const getTokenMarketDataMock = vi.fn();
    const getTokenHistoricalDataMock = vi.fn();
    const getHourlyTokenMarketChartMock = vi.fn();
    const getDailyTokenMarketChartMock = vi.fn();
    const saveTransactionsHeliusCacheMock = vi.fn();

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
        getHourlyTokenMarketChartMock,
        getDailyTokenMarketChartMock,
        saveTransactionsHeliusCacheMock,
        db,
    };
});

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/services/balances.js", () => ({
    getWalletBalances: hoisted.getWalletBalancesMock,
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
    saveTransactionsHeliusCache: hoisted.saveTransactionsHeliusCacheMock,
    saveTransfersCache: vi.fn(async () => undefined),
}));

vi.mock("@sv/services/tokens/token-market-data.js", () => ({
    getTokenMarketData: hoisted.getTokenMarketDataMock,
}));

vi.mock("@sv/services/tokens/token-history.js", () => ({
    getTokenHistoricalData: hoisted.getTokenHistoricalDataMock,
}));

vi.mock("@sv/services/tokens/token-chart.js", () => ({
    getHourlyTokenMarketChart: hoisted.getHourlyTokenMarketChartMock,
    getDailyTokenMarketChart: hoisted.getDailyTokenMarketChartMock,
}));

import {
    getCumulativePnL,
    getWalletBalanceHistory,
    getWalletTokenBalanceHistory,
    getWalletTransactionHelius,
} from "../../src/services/wallet/walletData.service.ts";

function getSeriesValueByDate(
    series: Array<{ date: string; value: number }>,
    day: string,
): number {
    const found = series.find((point) => point.date.startsWith(`${day}T`));
    expect(found).toBeDefined();
    return found!.value;
}

function getPointValueByDay(
    series: Array<{ timestamp: number; value: number }>,
    day: string,
): number {
    const targetTs = new Date(`${day}T00:00:00.000Z`).getTime();
    const point = series.find((item) => item.timestamp === targetTs);
    expect(point).toBeDefined();
    return point!.value;
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
        hoisted.getHourlyTokenMarketChartMock.mockReset();
        hoisted.getDailyTokenMarketChartMock.mockReset();
        hoisted.saveTransactionsHeliusCacheMock.mockReset();

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
        hoisted.saveTransactionsHeliusCacheMock.mockResolvedValue(undefined);
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

describe("walletData.service - balance history historical valuation", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));

        hoisted.getWalletBalancesMock.mockReset();
        hoisted.fetchHeliusSolanaPortfolioMock.mockReset();
        hoisted.fetchAllTransactionHistoryMock.mockReset();
        hoisted.getCachedWalletTransactionsHeliusMock.mockReset();
        hoisted.getTokenMarketDataMock.mockReset();
        hoisted.getHourlyTokenMarketChartMock.mockReset();
        hoisted.getDailyTokenMarketChartMock.mockReset();
        hoisted.saveTransactionsHeliusCacheMock.mockReset();

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
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.fetchAllTransactionHistoryMock.mockResolvedValue([]);
        hoisted.saveTransactionsHeliusCacheMock.mockResolvedValue(undefined);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 100 },
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([]);
        hoisted.getDailyTokenMarketChartMock.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("values balance history from historical prices and transaction-derived snapshots", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 100,
                priceUsd: 5,
                valueUsd: 500,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-deposit",
                    timestamp: "2026-03-11T12:00:00.000Z",
                    slot: 1,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [
                        { mint: SOL_MINT, amount: 10, decimals: 0 },
                    ],
                },
                {
                    walletAddress: "wallet-1",
                    signature: "sig-withdraw",
                    timestamp: "2026-03-09T12:00:00.000Z",
                    slot: 2,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [
                        { mint: SOL_MINT, amount: -20, decimals: 0 },
                    ],
                },
            ],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([
            { unixTimestampMs: new Date("2026-03-05T00:00:00.000Z").getTime(), price: 1 },
            { unixTimestampMs: new Date("2026-03-06T00:00:00.000Z").getTime(), price: 1.5 },
            { unixTimestampMs: new Date("2026-03-07T00:00:00.000Z").getTime(), price: 2 },
            { unixTimestampMs: new Date("2026-03-08T00:00:00.000Z").getTime(), price: 2.5 },
            { unixTimestampMs: new Date("2026-03-09T00:00:00.000Z").getTime(), price: 3 },
            { unixTimestampMs: new Date("2026-03-10T00:00:00.000Z").getTime(), price: 3.5 },
            { unixTimestampMs: new Date("2026-03-11T00:00:00.000Z").getTime(), price: 4 },
            { unixTimestampMs: new Date("2026-03-12T00:00:00.000Z").getTime(), price: 5 },
        ]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 5 },
        });

        const result = await getWalletBalanceHistory("wallet-1", "solana", "7D");

        expect(result.length).toBe(8);
        expect(getSeriesValueByDate(result, "2026-03-05")).toBe(110);
        expect(getSeriesValueByDate(result, "2026-03-09")).toBe(330);
        expect(getSeriesValueByDate(result, "2026-03-10")).toBe(315);
        expect(getSeriesValueByDate(result, "2026-03-12")).toBe(500);

        const expectedToSec = Math.floor(Date.now() / 1000);
        const expectedFromSec = expectedToSec - 7 * 24 * 60 * 60;
        expect(hoisted.getCachedWalletTransactionsHeliusMock).toHaveBeenCalledWith(
            "wallet-1",
            "solana",
            { fromSec: expectedFromSec, toSec: expectedToSec },
        );
    });

    it("uses nearest-prior historical prices and falls back to current price before first chart point", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 10,
                priceUsd: 100,
                valueUsd: 1000,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([
            { unixTimestampMs: new Date("2026-03-06T12:00:00.000Z").getTime(), price: 2 },
            { unixTimestampMs: new Date("2026-03-09T12:00:00.000Z").getTime(), price: 4 },
        ]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 100 },
        });

        const result = await getWalletBalanceHistory("wallet-1", "solana", "7D");

        expect(getSeriesValueByDate(result, "2026-03-05")).toBe(1000);
        expect(getSeriesValueByDate(result, "2026-03-06")).toBe(1000);
        expect(getSeriesValueByDate(result, "2026-03-07")).toBe(20);
        expect(getSeriesValueByDate(result, "2026-03-09")).toBe(20);
        expect(getSeriesValueByDate(result, "2026-03-10")).toBe(40);
    });

    it("falls back to current token prices when chart history is missing", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 12,
                priceUsd: 75,
                valueUsd: 900,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 75 },
        });

        const result = await getWalletBalanceHistory("wallet-1", "solana", "7D");

        expect(result.length).toBe(8);
        const uniqueValues = new Set(result.map((point) => point.value));
        expect(uniqueValues.size).toBe(1);
        expect(Array.from(uniqueValues)[0]).toBe(900);
    });

    it("normalizes SOL-like portfolio mints before price lookup in token mode", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: "11111111111111111111111111111111",
                symbol: "SOL",
                amount: 10,
                priceUsd: 100,
                valueUsd: 1000,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getTokenHistoricalDataMock.mockResolvedValue(null);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 100 },
        });

        const result = await getWalletTokenBalanceHistory("wallet-1", "solana", "SOL", "7D");

        expect(result.tokenAddress).toBe(SOL_MINT);
        expect(result.usdSeries.length).toBeGreaterThan(1);
        expect(result.usdSeries.every((point) => point.value === 1000)).toBe(true);
        expect(hoisted.getTokenMarketDataMock).toHaveBeenCalledWith([SOL_MINT]);
    });

    it("returns a deterministic safe series when historical and current prices are both missing", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 12,
                priceUsd: undefined,
                valueUsd: 0,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({});

        const result = await getWalletBalanceHistory("wallet-1", "solana", "7D");

        expect(result.length).toBe(8);
        expect(result.every((point) => Number.isFinite(point.value))).toBe(true);
        expect(result.every((point) => point.value === 0)).toBe(true);
    });

    it("keeps timestamp alignment and matches cumulative PnL valuation baseline", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 100,
                priceUsd: 5,
                valueUsd: 500,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-deposit",
                    timestamp: "2026-03-11T12:00:00.000Z",
                    slot: 1,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [
                        { mint: SOL_MINT, amount: 10, decimals: 0 },
                    ],
                },
                {
                    walletAddress: "wallet-1",
                    signature: "sig-withdraw",
                    timestamp: "2026-03-09T12:00:00.000Z",
                    slot: 2,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [
                        { mint: SOL_MINT, amount: -20, decimals: 0 },
                    ],
                },
            ],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([
            { unixTimestampMs: new Date("2026-03-05T00:00:00.000Z").getTime(), price: 1 },
            { unixTimestampMs: new Date("2026-03-06T00:00:00.000Z").getTime(), price: 1.5 },
            { unixTimestampMs: new Date("2026-03-07T00:00:00.000Z").getTime(), price: 2 },
            { unixTimestampMs: new Date("2026-03-08T00:00:00.000Z").getTime(), price: 2.5 },
            { unixTimestampMs: new Date("2026-03-09T00:00:00.000Z").getTime(), price: 3 },
            { unixTimestampMs: new Date("2026-03-10T00:00:00.000Z").getTime(), price: 3.5 },
            { unixTimestampMs: new Date("2026-03-11T00:00:00.000Z").getTime(), price: 4 },
            { unixTimestampMs: new Date("2026-03-12T00:00:00.000Z").getTime(), price: 5 },
        ]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 5 },
        });

        const [balanceHistory, pnl] = await Promise.all([
            getWalletBalanceHistory("wallet-1", "solana", "7D"),
            getCumulativePnL("wallet-1", "solana", "7D", "daily"),
        ]);

        expect(balanceHistory.length).toBe(8);
        expect(balanceHistory.length).toBe(pnl.cumulativePnL.length);
        expect(balanceHistory[0].timestamp).toBe(new Date("2026-03-05T00:00:00.000Z").getTime());
        expect(balanceHistory[balanceHistory.length - 1].timestamp).toBe(
            new Date("2026-03-12T00:00:00.000Z").getTime(),
        );

        for (let i = 0; i < balanceHistory.length; i++) {
            expect(balanceHistory[i].timestamp).toBe(pnl.cumulativePnL[i].timestamp);
            expect(balanceHistory[i].value).toBe(
                Number((pnl.startBalance + pnl.cumulativePnL[i].value).toFixed(2)),
            );
        }
    });
});

describe("walletData.service - cumulative PnL", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));

        hoisted.getWalletBalancesMock.mockReset();
        hoisted.fetchHeliusSolanaPortfolioMock.mockReset();
        hoisted.fetchAllTransactionHistoryMock.mockReset();
        hoisted.getCachedWalletTransactionsHeliusMock.mockReset();
        hoisted.getTokenMarketDataMock.mockReset();
        hoisted.getHourlyTokenMarketChartMock.mockReset();
        hoisted.getDailyTokenMarketChartMock.mockReset();
        hoisted.saveTransactionsHeliusCacheMock.mockReset();

        hoisted.getWalletBalancesMock.mockReturnValue(null);
        hoisted.fetchAllTransactionHistoryMock.mockResolvedValue([]);
        hoisted.saveTransactionsHeliusCacheMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("computes cumulative PnL from historical prices and token balance snapshots", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 100,
                priceUsd: 5,
                valueUsd: 500,
            },
        ]);

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-deposit",
                    timestamp: "2026-03-11T12:00:00.000Z",
                    slot: 1,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [
                        { mint: SOL_MINT, amount: 10, decimals: 0 },
                    ],
                },
                {
                    walletAddress: "wallet-1",
                    signature: "sig-withdraw",
                    timestamp: "2026-03-09T12:00:00.000Z",
                    slot: 2,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [
                        { mint: SOL_MINT, amount: -20, decimals: 0 },
                    ],
                },
            ],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });

        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([
            { unixTimestampMs: new Date("2026-03-05T00:00:00.000Z").getTime(), price: 1 },
            { unixTimestampMs: new Date("2026-03-06T00:00:00.000Z").getTime(), price: 1.5 },
            { unixTimestampMs: new Date("2026-03-07T00:00:00.000Z").getTime(), price: 2 },
            { unixTimestampMs: new Date("2026-03-08T00:00:00.000Z").getTime(), price: 2.5 },
            { unixTimestampMs: new Date("2026-03-09T00:00:00.000Z").getTime(), price: 3 },
            { unixTimestampMs: new Date("2026-03-10T00:00:00.000Z").getTime(), price: 3.5 },
            { unixTimestampMs: new Date("2026-03-11T00:00:00.000Z").getTime(), price: 4 },
            { unixTimestampMs: new Date("2026-03-12T00:00:00.000Z").getTime(), price: 5 },
        ]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 5 },
        });

        const result = await getCumulativePnL("wallet-1", "solana", "7D", "daily");

        expect(result.dailyPnL.length).toBe(8);
        expect(result.cumulativePnL.length).toBe(8);
        expect(result.startBalance).toBe(110);
        expect(result.endBalance).toBe(500);

        expect(getPointValueByDay(result.dailyPnL, "2026-03-10")).toBe(-15);
        expect(getPointValueByDay(result.dailyPnL, "2026-03-12")).toBe(140);

        expect(getPointValueByDay(result.cumulativePnL, "2026-03-05")).toBe(0);
        expect(getPointValueByDay(result.cumulativePnL, "2026-03-12")).toBe(390);
    });

    it("returns zero-valued series when token prices are missing", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 50,
                priceUsd: undefined,
                valueUsd: 0,
            },
        ]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: Math.floor(Date.now() / 1000) },
            coveredRange: { earliestSec: 0, latestSec: Math.floor(Date.now() / 1000) },
            isFullyCovered: true,
        });
        hoisted.getHourlyTokenMarketChartMock.mockResolvedValue([]);
        hoisted.getDailyTokenMarketChartMock.mockResolvedValue([]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({});

        const result = await getCumulativePnL("wallet-1", "solana", "7D", "daily");

        expect(result.dailyPnL.length).toBeGreaterThan(1);
        expect(result.cumulativePnL.length).toBe(result.dailyPnL.length);
        expect(result.startBalance).toBe(0);
        expect(result.endBalance).toBe(0);
        expect(result.dailyPnL.every((point) => point.value === 0)).toBe(true);
        expect(result.cumulativePnL.every((point) => point.value === 0)).toBe(true);
    });
});

describe("walletData.service - cache coverage sync behavior", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));

        hoisted.fetchAllTransactionHistoryMock.mockReset();
        hoisted.getCachedWalletTransactionsHeliusMock.mockReset();
        hoisted.saveTransactionsHeliusCacheMock.mockReset();
        hoisted.getHourlyTokenMarketChartMock.mockReset();
        hoisted.getDailyTokenMarketChartMock.mockReset();

        hoisted.fetchAllTransactionHistoryMock.mockResolvedValue([]);
        hoisted.saveTransactionsHeliusCacheMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("runs tail backfill even when requested-range cache slice is empty", async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const fromSec = nowSec - 30 * 24 * 60 * 60;
        const coveredEarliestSec = fromSec + 10 * 24 * 60 * 60;

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec, toSec: nowSec },
            coveredRange: { earliestSec: coveredEarliestSec, latestSec: nowSec },
            isFullyCovered: false,
        });

        await getWalletTransactionHelius("wallet-1", "solana", { fromSec, toSec: nowSec });

        expect(hoisted.fetchAllTransactionHistoryMock).toHaveBeenCalledTimes(1);
        const fetchCall = hoisted.fetchAllTransactionHistoryMock.mock.calls[0];
        expect(fetchCall[0]).toBe("wallet-1");
        expect(fetchCall[1]).toEqual({
            fromSec,
            toSec: coveredEarliestSec - 1,
        });
        expect(fetchCall[2]).toBeUndefined();

        expect(hoisted.saveTransactionsHeliusCacheMock).toHaveBeenCalledWith(
            "wallet-1",
            "solana",
            [],
            { fromSec, toSec: nowSec },
        );
    });

    it("uses oldest cached signature as beforeCursor during tail backfill", async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const fromSec = nowSec - 30 * 24 * 60 * 60;
        const coveredEarliestSec = fromSec + 10 * 24 * 60 * 60;
        const oldestSignature = "sig-oldest-cache";

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-newer-cache",
                    timestamp: new Date((nowSec - 60) * 1000).toISOString(),
                    slot: 10,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [],
                },
                {
                    walletAddress: "wallet-1",
                    signature: oldestSignature,
                    timestamp: new Date((coveredEarliestSec + 5) * 1000).toISOString(),
                    slot: 11,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [],
                },
            ],
            requestedRange: { fromSec, toSec: nowSec },
            coveredRange: { earliestSec: coveredEarliestSec, latestSec: nowSec },
            isFullyCovered: false,
        });

        await getWalletTransactionHelius("wallet-1", "solana", { fromSec, toSec: nowSec });

        expect(hoisted.fetchAllTransactionHistoryMock).toHaveBeenCalledTimes(1);
        const fetchCall = hoisted.fetchAllTransactionHistoryMock.mock.calls[0];
        expect(fetchCall[0]).toBe("wallet-1");
        expect(fetchCall[1]).toEqual({
            fromSec,
            toSec: coveredEarliestSec - 1,
        });
        expect(fetchCall[2]).toEqual({ beforeCursor: oldestSignature });
    });

    it("does not widen coverage bounds when a required gap fetch fails", async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const fromSec = nowSec - 30 * 24 * 60 * 60;
        const coveredEarliestSec = fromSec + 10 * 24 * 60 * 60;

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec, toSec: nowSec },
            coveredRange: { earliestSec: coveredEarliestSec, latestSec: nowSec },
            isFullyCovered: false,
        });
        hoisted.fetchAllTransactionHistoryMock.mockRejectedValueOnce(new Error("tail fetch failed"));

        await getWalletTransactionHelius("wallet-1", "solana", { fromSec, toSec: nowSec });

        expect(hoisted.saveTransactionsHeliusCacheMock).toHaveBeenCalledTimes(1);
        const saveCall = hoisted.saveTransactionsHeliusCacheMock.mock.calls[0];
        expect(saveCall[0]).toBe("wallet-1");
        expect(saveCall[1]).toBe("solana");
        expect(saveCall[2]).toEqual([]);
        expect(saveCall[3]).toBeUndefined();
    });
});
