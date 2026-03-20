import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const getCachedWalletSwapsChunkMock = vi.fn(async () => ({
        available: false,
        cursorMatched: false,
        items: [],
        nextCursor: null,
        hasMore: false,
    }));

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
            fetchedAt: "walletExchangeCountsCache.fetchedAt",
        },
    };

    return {
        getCachedWalletSwapsChunkMock,
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
    getWalletBalances: vi.fn(async () => null),
}));

vi.mock("@sv/services/wallet/fetchers/walletDataFetcher.service.js", () => ({
    fetchAllTransactionHistory: vi.fn(async () => []),
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
    getCachedWalletTransactionsHelius: vi.fn(async () => null),
    getCachedWalletSwapsChunk: hoisted.getCachedWalletSwapsChunkMock,
    getCachedWalletSwaps: vi.fn(async () => null),
    getCachedWalletTransactions: vi.fn(async () => null),
    getCachedWalletTransfersChunk: vi.fn(async () => ({ available: false, cursorMatched: false, items: [], nextCursor: null, hasMore: false })),
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

vi.mock("@sv/util/util-helius.js", () => ({
    resolveChainForAddress: (_address: string, requestedChain: string) => requestedChain || "solana",
}));

vi.mock("@sv/util/util-moralis.js", () => ({
    getEndpoint: (path: string) => new URL(`https://moralis.local${path}`),
    getRequiredHeaders: () => ({ "X-API-Key": "test" }),
}));

vi.mock("@sv/util/util-birdeye.js", () => ({}));

import { getWalletExchangeCounts } from "../../src/services/wallet/walletData.service.ts";

function buildSwap(overrides: Record<string, unknown> = {}) {
    return {
        walletAddress: "wallet-1",
        signature: "sig-default",
        timestamp: "2026-03-18T10:00:00.000Z",
        slot: 123,
        fee: 0,
        feePayer: "wallet-1",
        balanceChanges: [],
        feeChanges: [],
        exchange: null,
        pair: null,
        sold: {
            mint: "mint-sold",
            amount: -1,
            decimals: 6,
            valueUsd: 50,
        },
        bought: {
            mint: "mint-bought",
            amount: 1,
            decimals: 6,
            valueUsd: 50,
        },
        totalValueUsd: 50,
        ...overrides,
    };
}

describe("walletData.service - getWalletExchangeCounts", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-19T12:00:00.000Z"));
        hoisted.getCachedWalletSwapsChunkMock.mockReset();
        hoisted.getCachedWalletSwapsChunkMock.mockResolvedValue({
            available: false,
            cursorMatched: false,
            items: [],
            nextCursor: null,
            hasMore: false,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("aggregates exchanges with bucket priority and dedupe using transaction-count scan", async () => {
        hoisted.getCachedWalletSwapsChunkMock.mockResolvedValueOnce({
            available: true,
            cursorMatched: true,
            hasMore: false,
            nextCursor: null,
            items: [
                buildSwap({
                    signature: "sig-1",
                    exchange: { name: "Jupiter", address: "dex-1" },
                    pair: { label: "Ignored Pair", address: "pair-ignored" },
                    bought: { mint: "mint-a", amount: 1, decimals: 6, valueUsd: 120 },
                    sold: { mint: "mint-b", amount: -1, decimals: 6, valueUsd: 100 },
                    totalValueUsd: 120,
                }),
                buildSwap({
                    signature: "sig-1",
                    exchange: { name: "Jupiter", address: "dex-1" },
                    bought: { mint: "mint-a", amount: 1, decimals: 6, valueUsd: 999 },
                    sold: { mint: "mint-b", amount: -1, decimals: 6, valueUsd: 999 },
                    totalValueUsd: 999,
                }),
                buildSwap({
                    signature: "sig-2",
                    exchange: null,
                    pair: { label: "Raydium CLMM", address: "pair-1" },
                    bought: null,
                    sold: { mint: "mint-c", amount: -1, decimals: 6, valueUsd: 50 },
                    totalValueUsd: 50,
                }),
                buildSwap({
                    signature: "sig-3",
                    exchange: null,
                    pair: null,
                    bought: { mint: "mint-d", amount: 1, decimals: 6, valueUsd: null },
                    sold: { mint: "mint-e", amount: -1, decimals: 6, valueUsd: null },
                    totalValueUsd: 80,
                }),
                buildSwap({
                    signature: "sig-old",
                    timestamp: "2025-12-01T10:00:00.000Z",
                    exchange: { name: "Old Exchange", address: "old-1" },
                    bought: { mint: "mint-z", amount: 1, decimals: 6, valueUsd: 77 },
                    sold: { mint: "mint-y", amount: -1, decimals: 6, valueUsd: 60 },
                    totalValueUsd: 77,
                }),
            ],
        });

        const result = await getWalletExchangeCounts("wallet-1", {
            period: "30D",
            limit: 10,
        });

        expect(result.metadata).toMatchObject({
            period: "30D",
            metric: "count",
            source: "cache",
            limit: 10,
            truncated: false,
        });

        expect(result.exchanges).toHaveLength(4);

        const jupiter = result.exchanges.find((row) => row.name === "Jupiter");
        const raydium = result.exchanges.find((row) => row.name === "Raydium CLMM");
        const unknown = result.exchanges.find((row) => row.name === "Unknown");
        const oldExchange = result.exchanges.find((row) => row.name === "Old Exchange");

        expect(jupiter).toMatchObject({
            deposits: 1,
            withdrawals: 1,
            depositsVolume: 120,
            withdrawalsVolume: 100,
        });

        expect(raydium).toMatchObject({
            deposits: 0,
            withdrawals: 1,
            depositsVolume: 0,
            withdrawalsVolume: 50,
        });

        expect(unknown).toMatchObject({
            deposits: 1,
            withdrawals: 1,
            depositsVolume: 40,
            withdrawalsVolume: 40,
        });

        expect(oldExchange).toMatchObject({
            deposits: 1,
            withdrawals: 1,
            depositsVolume: 77,
            withdrawalsVolume: 60,
        });
    });

    it("uses totalValueUsd split fallback when one side volume is missing", async () => {
        hoisted.getCachedWalletSwapsChunkMock.mockResolvedValueOnce({
            available: true,
            cursorMatched: true,
            hasMore: false,
            nextCursor: null,
            items: [
                buildSwap({
                    signature: "sig-split",
                    exchange: { name: "Meteora", address: "dex-2" },
                    bought: { mint: "mint-a", amount: 1, decimals: 6, valueUsd: null },
                    sold: { mint: "mint-b", amount: -1, decimals: 6, valueUsd: 30 },
                    totalValueUsd: 90,
                }),
            ],
        });

        const result = await getWalletExchangeCounts("wallet-1", {
            period: "30D",
            limit: 10,
        });

        expect(result.exchanges).toHaveLength(1);
        expect(result.exchanges[0]).toMatchObject({
            name: "Meteora",
            deposits: 1,
            withdrawals: 1,
            depositsVolume: 60,
            withdrawalsVolume: 30,
        });
    });

    it("normalizes invalid period and clamps transaction limit", async () => {
        hoisted.getCachedWalletSwapsChunkMock.mockResolvedValueOnce({
            available: true,
            cursorMatched: true,
            hasMore: false,
            nextCursor: null,
            items: [],
        });

        const result = await getWalletExchangeCounts("wallet-1", {
            period: "bad-period",
            limit: 999999,
        });

        expect(result.metadata.period).toBe("30D");
        expect(result.metadata.limit).toBe(10000);
        expect(result.exchanges).toEqual([]);
    });
});