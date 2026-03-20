import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const fetchAllTransactionHistoryChunkMock = vi.fn();
    const fetchAllTransactionHistoryMock = vi.fn();
    const getCachedWalletTransactionsHeliusMock = vi.fn();
    const saveTransactionsHeliusCacheMock = vi.fn(async () => undefined);

    const db = {
        execute: vi.fn(async () => undefined),
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
    };

    return {
        fetchAllTransactionHistoryChunkMock,
        fetchAllTransactionHistoryMock,
        getCachedWalletTransactionsHeliusMock,
        saveTransactionsHeliusCacheMock,
        db,
    };
});

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/db/schema.js", () => ({
    walletOverviewCache: {
        address: "walletOverviewCache.address",
        fetchedAt: "walletOverviewCache.fetchedAt",
    },
    walletPortfolioCache: {
        address: "walletPortfolioCache.address",
    },
}));

vi.mock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ op: "and", args }),
    desc: (...args: unknown[]) => ({ op: "desc", args }),
    eq: (...args: unknown[]) => ({ op: "eq", args }),
}));

vi.mock("@sv/services/wallet/fetchers/walletDataFetcher.service.js", () => ({
    fetchAllTransactionHistory: hoisted.fetchAllTransactionHistoryMock,
    fetchAllTransactionHistoryChunk: hoisted.fetchAllTransactionHistoryChunkMock,
    fetchHeliusSolanaPortfolio: vi.fn(async () => []),
    fetchMoralisSolanaSwap: vi.fn(async () => []),
    fetchMoralisSolanaSwapChunk: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
    fetchHeliusSolanaSwap: vi.fn(async () => []),
    fetchHeliusSolanaSwapChunk: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
    fetchHeliusSolanaTransactions: vi.fn(async () => []),
    fetchHeliusSolanaTransfers: vi.fn(async () => []),
    fetchHeliusSolanaTransfersChunk: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
    timePeriodToFromSec: vi.fn(() => 0),
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: hoisted.getCachedWalletTransactionsHeliusMock,
    getCachedWalletSwapsChunk: vi.fn(async () => ({ available: false, cursorMatched: false, items: [], nextCursor: null, hasMore: false })),
    getCachedWalletSwaps: vi.fn(async () => null),
    getCachedWalletTransactions: vi.fn(async () => null),
    getCachedWalletTransfersChunk: vi.fn(async () => ({ available: false, cursorMatched: false, items: [], nextCursor: null, hasMore: false })),
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
    getTokenMarketData: vi.fn(async () => ({})),
}));

vi.mock("@sv/services/tokens/token-chart.js", () => ({
    getHourlyTokenMarketChart: vi.fn(async () => []),
    getDailyTokenMarketChart: vi.fn(async () => []),
}));

vi.mock("@sv/services/tokens/token-history.js", () => ({
    getTokenHistoricalData: vi.fn(async () => null),
}));

vi.mock("@sv/services/tokens/token-info.js", () => ({
    getTokenMeta: vi.fn(async () => []),
}));

import { getWalletTransactionHelius } from "../../src/services/wallet/walletData.service.ts";

function buildTx(signature: string, tsSec: number) {
    return {
        walletAddress: "wallet-1",
        signature,
        timestamp: new Date(tsSec * 1000).toISOString(),
        slot: 1,
        fee: 0,
        feePayer: "wallet-1",
        balanceChanges: [],
    };
}

describe("getWalletTransactionHelius - bounded provider path", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        hoisted.fetchAllTransactionHistoryChunkMock.mockResolvedValue({
            transactions: [],
            nextCursor: null,
            hasMore: false,
            pagesFetched: 1,
            stopReason: "provider-end",
        });
        hoisted.fetchAllTransactionHistoryMock.mockResolvedValue([]);

        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValue({
            transactions: [],
            requestedRange: { fromSec: 0, toSec: 0 },
            coveredRange: { earliestSec: null, latestSec: null },
            isFullyCovered: false,
        });
    });

    it("uses chunk fetcher when cursor is provided and skips cache-range lookup", async () => {
        hoisted.fetchAllTransactionHistoryChunkMock.mockResolvedValueOnce({
            transactions: [buildTx("sig-1", 200), buildTx("sig-2", 190)],
            nextCursor: "sig-next",
            hasMore: true,
            pagesFetched: 3,
            stopReason: "max-pages",
        });

        const result = await getWalletTransactionHelius("wallet-1", {
            fromSec: 180,
            toSec: 210,
            before: "sig-cursor",
        });

        expect(hoisted.fetchAllTransactionHistoryChunkMock).toHaveBeenCalledWith(
            "wallet-1",
            { fromSec: 180, toSec: 210 },
            expect.objectContaining({
                beforeCursor: "sig-cursor",
                maxTransactions: 1500,
            }),
        );
        expect(hoisted.getCachedWalletTransactionsHeliusMock).not.toHaveBeenCalled();
        expect(hoisted.saveTransactionsHeliusCacheMock).toHaveBeenCalledWith(
            "wallet-1",
            expect.any(Array),
        );
        expect(result.transactions.map((tx) => tx.signature)).toEqual(["sig-1", "sig-2"]);
    });

    it("uses chunk fetcher with clamped limit when limit is provided", async () => {
        await getWalletTransactionHelius("wallet-1", {
            fromSec: 100,
            toSec: 200,
            limit: 120,
        });

        expect(hoisted.fetchAllTransactionHistoryChunkMock).toHaveBeenCalledWith(
            "wallet-1",
            { fromSec: 100, toSec: 200 },
            expect.objectContaining({
                beforeCursor: undefined,
                maxTransactions: 120,
                maxPages: 5,
            }),
        );
        expect(hoisted.getCachedWalletTransactionsHeliusMock).not.toHaveBeenCalled();
    });

    it("keeps cache coverage path for unbounded requests", async () => {
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValueOnce({
            transactions: [buildTx("sig-cache", 190)],
            requestedRange: { fromSec: 180, toSec: 200 },
            coveredRange: { earliestSec: 150, latestSec: 220 },
            isFullyCovered: true,
        });

        const result = await getWalletTransactionHelius("wallet-1", {
            fromSec: 180,
            toSec: 200,
        });

        expect(hoisted.getCachedWalletTransactionsHeliusMock).toHaveBeenCalledTimes(1);
        expect(hoisted.fetchAllTransactionHistoryChunkMock).not.toHaveBeenCalled();
        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].signature).toBe("sig-cache");
    });
});
