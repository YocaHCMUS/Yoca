import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const hoisted = vi.hoisted(() => {
    const getWalletBalancesMock = vi.fn();
    const fetchHeliusSolanaPortfolioMock = vi.fn();
    const getCachedWalletTransactionsHeliusMock = vi.fn();
    const getTokenMarketDataMock = vi.fn();
    const saveOverviewCacheMock = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    const overviewCacheRows: Array<Record<string, unknown>> = [];

    const db = {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => overviewCacheRows),
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
        execute: vi.fn(async () => undefined),
    };

    const schema = {
        walletOverviewCache: {
            name: "walletOverviewCache",
            address: "walletOverviewCache.address",
            chain: "walletOverviewCache.chain",
            fetchedAt: "walletOverviewCache.fetchedAt",
        },
        walletPortfolioCache: {
            name: "walletPortfolioCache",
            address: "walletPortfolioCache.address",
            chain: "walletPortfolioCache.chain",
        },
        walletExchangeCountsCache: {
            name: "walletExchangeCountsCache",
            address: "walletExchangeCountsCache.address",
            chain: "walletExchangeCountsCache.chain",
        },
    };

    return {
        getWalletBalancesMock,
        fetchHeliusSolanaPortfolioMock,
        getCachedWalletTransactionsHeliusMock,
        getTokenMarketDataMock,
        saveOverviewCacheMock,
        fetchMock,
        overviewCacheRows,
        db,
        schema,
    };
});

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/db/schema.js", () => hoisted.schema);

vi.mock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ op: "and", args }),
    desc: (...args: unknown[]) => ({ op: "desc", args }),
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    sql: Object.assign(
        (strings: TemplateStringsArray, ...values: unknown[]) => ({
            op: "sql",
            strings: Array.from(strings),
            values,
        }),
        { placeholder: (name: string) => ({ op: "placeholder", name }) },
    ),
}));

vi.mock("@sv/services/balances.js", () => ({
    getWalletBalances: hoisted.getWalletBalancesMock,
}));

vi.mock("@sv/services/wallet/fetchers/walletDataFetcher.service.js", () => ({
    fetchAllTransactionHistory: vi.fn(async () => []),
    fetchAllTransactionHistoryChunk: vi.fn(async () => ({
        transactions: [],
        nextCursor: null,
        hasMore: false,
        pagesFetched: 0,
        stopReason: "provider-end",
    })),
    fetchHeliusSolanaPortfolio: hoisted.fetchHeliusSolanaPortfolioMock,
    fetchMoralisSolanaSwap: vi.fn(async () => []),
    fetchHeliusSolanaSwap: vi.fn(async () => []),
    fetchHeliusSolanaTransactions: vi.fn(async () => []),
    fetchHeliusSolanaTransfers: vi.fn(async () => []),
    timePeriodToFromSec: vi.fn(() => 0),
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: hoisted.getCachedWalletTransactionsHeliusMock,
    getCachedWalletSwaps: vi.fn(async () => null),
    getCachedWalletTransactions: vi.fn(async () => null),
    getCachedWalletTransfers: vi.fn(async () => null),
}));

vi.mock("@sv/services/wallet/db/walletDataCacher.js", () => ({
    saveOverviewCache: hoisted.saveOverviewCacheMock,
    saveSwapsCache: vi.fn(async () => undefined),
    saveTransactionsCache: vi.fn(async () => undefined),
    saveTransactionsHeliusCache: vi.fn(async () => undefined),
    saveTransfersCache: vi.fn(async () => undefined),
}));

vi.mock("@sv/services/tokens/token-market-data.js", () => ({
    getTokenMarketData: hoisted.getTokenMarketDataMock,
}));

vi.mock("@sv/services/tokens/token-chart.js", () => ({
    getHourlyTokenMarketChart: vi.fn(async () => []),
    getDailyTokenMarketChart: vi.fn(async () => []),
}));

vi.mock("@sv/services/tokens/token-history.js", () => ({
    getTokenHistoricalData: vi.fn(async () => null),
}));

vi.mock("@sv/util/util-helius.js", () => ({
    resolveChainForAddress: (_address: string, _requestedChain: string) => "solana",
}));

vi.mock("@sv/util/util-moralis.js", () => ({
    getEndpoint: (path: string) => new URL(`https://moralis.local${path}`),
    getRequiredHeaders: () => ({ "X-API-Key": "test" }),
}));

vi.mock("@sv/util/util-birdeye.js", () => ({}));

import { getWalletOverview } from "../../src/services/wallet/walletData.service.ts";

function okJson(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as Response;
}

describe("walletData.service - getWalletOverview", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"));

        hoisted.getWalletBalancesMock.mockReset();
        hoisted.fetchHeliusSolanaPortfolioMock.mockReset();
        hoisted.getCachedWalletTransactionsHeliusMock.mockReset();
        hoisted.getTokenMarketDataMock.mockReset();
        hoisted.saveOverviewCacheMock.mockClear();
        hoisted.fetchMock.mockReset();
        hoisted.overviewCacheRows.length = 0;

        hoisted.getWalletBalancesMock.mockResolvedValue(null);
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([]);
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: 0 },
            coveredRange: { earliestSec: 0, latestSec: 0 },
            isFullyCovered: true,
        });
        hoisted.getTokenMarketDataMock.mockResolvedValue({});

        hoisted.fetchMock.mockResolvedValue(okJson({ result: [], cursor: null }));
        vi.stubGlobal("fetch", hoisted.fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("returns fresh cached overview and skips provider fetches", async () => {
        hoisted.overviewCacheRows.push({
            totalAssetValueUsd: "1250.5",
            tradingVolumeUsd24h: "22.5",
            pnlUsdTotal: "-1.25",
            transactionCount24h: 3,
            tokensTradedCount: 2,
            tokensHoldingCount: 7,
            fetchedAt: new Date("2026-03-14T11:59:00.000Z"),
        });

        const result = await getWalletOverview("wallet-1", "solana");

        expect(result.totalAssetValueUsd).toBe(1250.5);
        expect(result.tradingVolumeUsd24h).toBe(22.5);
        expect(result.pnlUsdTotal).toBe(-1.25);
        expect(result.transactionCount24h).toBe(3);
        expect(result.tokensTradedCount).toBe(2);
        expect(result.tokensHoldingCount).toBe(7);

        expect(hoisted.getWalletBalancesMock).not.toHaveBeenCalled();
        expect(hoisted.fetchHeliusSolanaPortfolioMock).not.toHaveBeenCalled();
        expect(hoisted.saveOverviewCacheMock).not.toHaveBeenCalled();
    });

    it("computes holdings from Helius portfolio path and persists overview", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: "token-a",
                amount: 1,
                valueUsd: 50,
                symbol: "A",
            },
            {
                tokenAddress: "token-b",
                amount: 3,
                valueUsd: 70,
                symbol: "B",
            },
        ]);

        const result = await getWalletOverview("wallet-1", "solana");

        expect(result.totalAssetValueUsd).toBe(120);
        expect(result.tokensHoldingCount).toBe(2);
        expect(result.transactionCount24h).toBe(0);
        expect(result.tokensTradedCount).toBe(0);
        expect(hoisted.fetchHeliusSolanaPortfolioMock).toHaveBeenCalledTimes(1);
        expect(hoisted.saveOverviewCacheMock).toHaveBeenCalledTimes(1);
    });

    it("computes Solana activity metrics from Helius transaction changes", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 4,
                valueUsd: 400,
            },
        ]);

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-1",
                    timestamp: "2026-03-14T11:30:00.000Z",
                    slot: 1,
                    fee: 0.00001,
                    feePayer: "payer",
                    balanceChanges: [{ mint: "SOL", amount: 1_000_000_000, decimals: 9 }],
                },
                {
                    walletAddress: "wallet-1",
                    signature: "sig-2",
                    timestamp: "2026-03-14T11:40:00.000Z",
                    slot: 2,
                    fee: 0.00001,
                    feePayer: "payer",
                    balanceChanges: [{ mint: "SOL", amount: -500_000_000, decimals: 9 }],
                },
            ],
            requestedRange: { fromSec: 0, toSec: 0 },
            coveredRange: { earliestSec: 0, latestSec: 0 },
            isFullyCovered: true,
        });

        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 100 },
        });

        const result = await getWalletOverview("wallet-1", "solana");

        expect(result.totalAssetValueUsd).toBe(400);
        expect(result.transactionCount24h).toBe(2);
        expect(result.tokensTradedCount).toBe(1);
        expect(result.tradingVolumeUsd24h).toBe(150);
        expect(result.pnlUsdTotal).toBe(50);
    });

    it("normalizes non-solana chain input to Solana processing", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
                amount: 3,
                valueUsd: 300,
            },
        ]);

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-eth-input",
                    timestamp: "2026-03-14T11:50:00.000Z",
                    slot: 3,
                    fee: 0.00001,
                    feePayer: "payer",
                    balanceChanges: [{ mint: "SOL", amount: 1_000_000_000, decimals: 9 }],
                },
            ],
            requestedRange: { fromSec: 0, toSec: 0 },
            coveredRange: { earliestSec: 0, latestSec: 0 },
            isFullyCovered: true,
        });

        hoisted.getTokenMarketDataMock.mockResolvedValue({
            [SOL_MINT]: { priceUsd: 100 },
        });

        const result = await getWalletOverview("wallet-1", "eth" as never);

        expect(result.chain).toBe("solana");
        expect(result.totalAssetValueUsd).toBe(300);
        expect(result.transactionCount24h).toBe(1);
        expect(result.tokensTradedCount).toBe(1);
        expect(result.tradingVolumeUsd24h).toBe(100);
        expect(result.pnlUsdTotal).toBe(100);
        expect(hoisted.fetchMock).not.toHaveBeenCalled();
    });

    it("does not crash when token pricing is missing", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: "mint-unknown",
                symbol: "UNK",
                amount: 5,
                valueUsd: 0,
            },
        ]);

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-1",
                    timestamp: "2026-03-14T11:45:00.000Z",
                    slot: 1,
                    fee: 0.00001,
                    feePayer: "payer",
                    balanceChanges: [{ mint: "mint-unknown", amount: 1000, decimals: 3 }],
                },
            ],
            requestedRange: { fromSec: 0, toSec: 0 },
            coveredRange: { earliestSec: 0, latestSec: 0 },
            isFullyCovered: true,
        });

        hoisted.getTokenMarketDataMock.mockResolvedValue({});

        const result = await getWalletOverview("wallet-1", "solana");

        expect(result.transactionCount24h).toBe(1);
        expect(result.tokensTradedCount).toBe(1);
        expect(result.tradingVolumeUsd24h).toBeNull();
        expect(result.pnlUsdTotal).toBeNull();
    });

    it("retains holdings and reuses cached activity metrics on activity provider failure", async () => {
        hoisted.overviewCacheRows.push({
            totalAssetValueUsd: "500",
            tradingVolumeUsd24h: "123",
            pnlUsdTotal: "45",
            transactionCount24h: 9,
            tokensTradedCount: 4,
            tokensHoldingCount: 2,
            fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
        });

        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([
            {
                tokenAddress: "mint-a",
                amount: 2,
                valueUsd: 200,
                symbol: "MINTA",
            },
        ]);

        hoisted.getCachedWalletTransactionsHeliusMock.mockRejectedValue(
            new Error("simulated activity provider failure"),
        );

        const result = await getWalletOverview("wallet-1", "solana");

        expect(result.totalAssetValueUsd).toBe(200);
        expect(result.tokensHoldingCount).toBe(1);
        expect(result.transactionCount24h).toBe(9);
        expect(result.tokensTradedCount).toBe(4);
        expect(result.tradingVolumeUsd24h).toBe(123);
        expect(result.pnlUsdTotal).toBe(45);

        expect(hoisted.saveOverviewCacheMock).toHaveBeenCalledTimes(1);
        expect(hoisted.saveOverviewCacheMock).toHaveBeenCalledWith(
            expect.objectContaining({
                transactionCount24h: 9,
                tokensTradedCount: 4,
                tradingVolumeUsd24h: 123,
                pnlUsdTotal: 45,
            }),
        );
    });
});
