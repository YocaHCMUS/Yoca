import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const hoisted = vi.hoisted(() => {
    const fetchHeliusSolanaTransfersMock = vi.fn(async (): Promise<unknown[]> => []);
    const fetchHeliusSolanaSwapMock = vi.fn(async (): Promise<unknown[]> => []);
    const getCachedWalletTransfersMock = vi.fn(async () => null);
    const getCachedWalletTransfersChunkMock = vi.fn(async (): Promise<unknown> => ({
        available: false,
        cursorMatched: false,
        items: [] as unknown[],
        nextCursor: null,
        hasMore: false,
    }));
    const getCachedWalletSwapsMock = vi.fn(async () => null);
    const getCachedWalletSwapsChunkMock = vi.fn(async (): Promise<unknown> => ({
        available: false,
        cursorMatched: false,
        items: [] as unknown[],
        nextCursor: null,
        hasMore: false,
    }));
    const saveTransfersCacheMock = vi.fn(async () => undefined);
    const saveSwapsCacheMock = vi.fn(async () => undefined);
    const getTokenMetaMock = vi.fn(async (): Promise<unknown[]> => []);
    const getTokenMarketDataMock = vi.fn(async (): Promise<Record<string, unknown>> => ({}));

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
        fetchHeliusSolanaTransfersMock,
        fetchHeliusSolanaSwapMock,
        getCachedWalletTransfersMock,
        getCachedWalletTransfersChunkMock,
        getCachedWalletSwapsMock,
        getCachedWalletSwapsChunkMock,
        saveTransfersCacheMock,
        saveSwapsCacheMock,
        getTokenMetaMock,
        getTokenMarketDataMock,
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
    fetchAllTransactionHistoryChunk: vi.fn(async () => ({
        transactions: [],
        nextCursor: null,
        hasMore: false,
        pagesFetched: 0,
        stopReason: "provider-end",
    })),
    fetchHeliusSolanaPortfolio: vi.fn(async () => []),
    fetchMoralisSolanaSwap: vi.fn(async () => []),
    fetchMoralisSolanaSwapChunk: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
    fetchHeliusSolanaSwap: hoisted.fetchHeliusSolanaSwapMock,
    fetchHeliusSolanaSwapChunk: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
    fetchHeliusSolanaTransactions: vi.fn(async () => []),
    fetchHeliusSolanaTransfers: hoisted.fetchHeliusSolanaTransfersMock,
    fetchHeliusSolanaTransfersChunk: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })),
    timePeriodToFromSec: vi.fn(() => 0),
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: vi.fn(async () => null),
    getCachedWalletSwapsChunk: hoisted.getCachedWalletSwapsChunkMock,
    getCachedWalletSwaps: hoisted.getCachedWalletSwapsMock,
    getCachedWalletTransactions: vi.fn(async () => null),
    getCachedWalletTransfersChunk: hoisted.getCachedWalletTransfersChunkMock,
    getCachedWalletTransfers: hoisted.getCachedWalletTransfersMock,
}));

vi.mock("@sv/services/wallet/db/walletDataCacher.js", () => ({
    saveOverviewCache: vi.fn(async () => undefined),
    saveSwapsCache: hoisted.saveSwapsCacheMock,
    saveTransactionsCache: vi.fn(async () => undefined),
    saveTransactionsHeliusCache: vi.fn(async () => undefined),
    saveTransfersCache: hoisted.saveTransfersCacheMock,
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

vi.mock("@sv/services/tokens/token-info.js", () => ({
    getTokenMeta: hoisted.getTokenMetaMock,
}));

vi.mock("@sv/util/util-helius.js", () => ({
    resolveChainForAddress: (_address: string, requestedChain: string) => requestedChain || "solana",
}));

vi.mock("@sv/util/util-moralis.js", () => ({
    getEndpoint: (path: string) => new URL(`https://moralis.local${path}`),
    getRequiredHeaders: () => ({ "X-API-Key": "test" }),
}));

vi.mock("@sv/util/util-birdeye.js", () => ({}));

import {
    getWalletSwaps,
    getWalletTransfers,
} from "../../src/services/wallet/walletData.service.ts";

describe("walletData.service - transfer/swap token enrichment", () => {
    beforeEach(() => {
        hoisted.fetchHeliusSolanaTransfersMock.mockReset();
        hoisted.fetchHeliusSolanaSwapMock.mockReset();
        hoisted.getCachedWalletTransfersMock.mockReset();
        hoisted.getCachedWalletTransfersChunkMock.mockReset();
        hoisted.getCachedWalletSwapsMock.mockReset();
        hoisted.getCachedWalletSwapsChunkMock.mockReset();
        hoisted.saveTransfersCacheMock.mockReset();
        hoisted.saveSwapsCacheMock.mockReset();
        hoisted.getTokenMetaMock.mockReset();
        hoisted.getTokenMarketDataMock.mockReset();

        hoisted.fetchHeliusSolanaTransfersMock.mockResolvedValue([]);
        hoisted.fetchHeliusSolanaSwapMock.mockResolvedValue([]);
        hoisted.getCachedWalletTransfersMock.mockResolvedValue(null);
        hoisted.getCachedWalletTransfersChunkMock.mockResolvedValue({
            available: false,
            cursorMatched: false,
            items: [],
            nextCursor: null,
            hasMore: false,
        });
        hoisted.getCachedWalletSwapsMock.mockResolvedValue(null);
        hoisted.getCachedWalletSwapsChunkMock.mockResolvedValue({
            available: false,
            cursorMatched: false,
            items: [],
            nextCursor: null,
            hasMore: false,
        });
        hoisted.getTokenMetaMock.mockResolvedValue([]);
        hoisted.getTokenMarketDataMock.mockResolvedValue({});

        delete process.env.SWAP_PROVIDER_SOURCE;
        delete process.env.SWAP_PROVIDER_FALLBACK_TO_HELIUS;
    });

    afterEach(() => {
        delete process.env.SWAP_PROVIDER_SOURCE;
        delete process.env.SWAP_PROVIDER_FALLBACK_TO_HELIUS;
    });

    it("enriches provider-path transfers with token metadata and USD values", async () => {
        hoisted.fetchHeliusSolanaTransfersMock.mockResolvedValueOnce([
            {
                from: "wallet-1",
                to: "wallet-2",
                amount: 2,
                timestamp: "2026-03-19T10:00:00.000Z",
                tokenAddress: "mint-usdc",
                tokenSymbol: "unknown",
                transactionSignature: "sig-transfer-1",
                instructionIndex: 0,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-usdc",
                symbol: "USDC",
                name: "USD Coin",
                imageUrl: "https://cdn.example.com/usdc.png",
            },
        ]);

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-usdc": { priceUsd: 1.5 },
        });

        const result = await getWalletTransfers("wallet-1", { from: "24h" });

        expect(result.pageInfo.source).toBe("provider");
        expect(result.transfers[0]).toEqual(
            expect.objectContaining({
                tokenAddress: "mint-usdc",
                tokenSymbol: "USDC",
                tokenName: "USD Coin",
                tokenLogoUri: "https://cdn.example.com/usdc.png",
                priceUsd: 1.5,
                amountUsd: 3,
            }),
        );
        expect(hoisted.saveTransfersCacheMock).toHaveBeenCalledTimes(1);
        expect(hoisted.getTokenMetaMock).toHaveBeenCalledWith(["mint-usdc"]);
    });

    it("normalizes SOL aliases for transfer enrichment lookups", async () => {
        hoisted.fetchHeliusSolanaTransfersMock.mockResolvedValueOnce([
            {
                from: "wallet-1",
                to: "wallet-2",
                amount: 0.5,
                timestamp: "2026-03-19T10:00:00.000Z",
                tokenAddress: "native",
                tokenSymbol: "",
                transactionSignature: "sig-transfer-sol",
                instructionIndex: 0,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: SOL_MINT,
                symbol: "SOL",
                name: "Solana",
                imageUrl: "https://cdn.example.com/sol.png",
            },
        ]);

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            [SOL_MINT]: { priceUsd: 100 },
        });

        const result = await getWalletTransfers("wallet-1", { from: "24h" });

        expect(result.transfers[0]).toEqual(
            expect.objectContaining({
                tokenSymbol: "SOL",
                tokenName: "Solana",
                tokenLogoUri: "https://cdn.example.com/sol.png",
                priceUsd: 100,
                amountUsd: 50,
            }),
        );
        expect(hoisted.getTokenMetaMock).toHaveBeenCalledWith([SOL_MINT]);
    });

    it("keeps provider transfer symbol/name while filling missing logo", async () => {
        hoisted.fetchHeliusSolanaTransfersMock.mockResolvedValueOnce([
            {
                from: "wallet-1",
                to: "wallet-2",
                amount: 5,
                timestamp: "2026-03-19T10:00:00.000Z",
                tokenAddress: "mint-usdt",
                tokenSymbol: "USDT",
                tokenName: "Provider Tether",
                tokenLogoUri: undefined,
                transactionSignature: "sig-transfer-2",
                instructionIndex: 0,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-usdt",
                symbol: "META",
                name: "Meta Name",
                imageUrl: "https://cdn.example.com/usdt.png",
            },
        ]);

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-usdt": { priceUsd: 1 },
        });

        const result = await getWalletTransfers("wallet-1", { from: "24h" });

        expect(result.transfers[0]).toEqual(
            expect.objectContaining({
                tokenSymbol: "USDT",
                tokenName: "Provider Tether",
                tokenLogoUri: "https://cdn.example.com/usdt.png",
            }),
        );
    });

    it("continues transfer enrichment when token metadata service fails", async () => {
        hoisted.fetchHeliusSolanaTransfersMock.mockResolvedValueOnce([
            {
                from: "wallet-1",
                to: "wallet-2",
                amount: 3,
                timestamp: "2026-03-19T10:00:00.000Z",
                tokenAddress: "mint-1",
                tokenSymbol: "unknown",
                transactionSignature: "sig-transfer-3",
                instructionIndex: 0,
            },
        ]);

        hoisted.getTokenMetaMock.mockRejectedValueOnce(new Error("token-meta-down"));
        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-1": { priceUsd: 2 },
        });

        const result = await getWalletTransfers("wallet-1", { from: "24h" });

        expect(result.transfers[0].tokenSymbol).toBe("unknown");
        expect(result.transfers[0].priceUsd).toBe(2);
        expect(result.transfers[0].amountUsd).toBe(6);
    });

    it("continues transfer enrichment when market-data service fails", async () => {
        hoisted.fetchHeliusSolanaTransfersMock.mockResolvedValueOnce([
            {
                from: "wallet-1",
                to: "wallet-2",
                amount: 3,
                timestamp: "2026-03-19T10:00:00.000Z",
                tokenAddress: "mint-2",
                tokenSymbol: "",
                transactionSignature: "sig-transfer-4",
                instructionIndex: 0,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-2",
                symbol: "BONK",
                name: "Bonk",
                imageUrl: "https://cdn.example.com/bonk.png",
            },
        ]);
        hoisted.getTokenMarketDataMock.mockRejectedValueOnce(new Error("market-data-down"));

        const result = await getWalletTransfers("wallet-1", { from: "24h" });

        expect(result.transfers[0]).toEqual(
            expect.objectContaining({
                tokenSymbol: "BONK",
                tokenName: "Bonk",
                tokenLogoUri: "https://cdn.example.com/bonk.png",
            }),
        );
        expect(result.transfers[0].priceUsd).toBeUndefined();
        expect(result.transfers[0].amountUsd).toBeUndefined();
    });

    it("enriches swap balance-change metadata and USD fields", async () => {
        hoisted.fetchHeliusSolanaSwapMock.mockResolvedValueOnce([
            {
                walletAddress: "wallet-1",
                signature: "swap-1",
                timestamp: "2026-03-19T10:00:00.000Z",
                slot: 1,
                fee: 5000,
                feePayer: "wallet-1",
                balanceChanges: [
                    { mint: "mint-a", amount: -2, decimals: 6, symbol: "" },
                    { mint: "mint-b", amount: 1, decimals: 6, symbol: null },
                ],
                feeChanges: [],
                totalValueUsd: null,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-a",
                symbol: "AAA",
                name: "Token AAA",
                imageUrl: "https://cdn.example.com/aaa.png",
            },
            {
                address: "mint-b",
                symbol: "BBB",
                name: "Token BBB",
                imageUrl: "https://cdn.example.com/bbb.png",
            },
        ]);

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-a": { priceUsd: 10 },
            "mint-b": { priceUsd: 20 },
        });

        const result = await getWalletSwaps("wallet-1", { from: "24h" });

        expect(result.swaps).toHaveLength(1);
        expect(result.swaps[0].balanceChanges[0]).toEqual(
            expect.objectContaining({
                symbol: "AAA",
                name: "Token AAA",
                logoUri: "https://cdn.example.com/aaa.png",
                priceUsd: 10,
                valueUsd: 20,
            }),
        );
        expect(result.swaps[0].balanceChanges[1]).toEqual(
            expect.objectContaining({
                symbol: "BBB",
                name: "Token BBB",
                logoUri: "https://cdn.example.com/bbb.png",
                priceUsd: 20,
                valueUsd: 20,
            }),
        );
        expect(result.swaps[0].totalValueUsd).toBe(20);
    });

    it("keeps provider swap symbol/name while filling missing logo", async () => {
        hoisted.fetchHeliusSolanaSwapMock.mockResolvedValueOnce([
            {
                walletAddress: "wallet-1",
                signature: "swap-2",
                timestamp: "2026-03-19T10:00:00.000Z",
                slot: 1,
                fee: 5000,
                feePayer: "wallet-1",
                balanceChanges: [
                    {
                        mint: "mint-provider",
                        amount: -1,
                        decimals: 6,
                        symbol: "PROVIDER",
                        name: "Provider Name",
                        logoUri: null,
                    },
                ],
                feeChanges: [],
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-provider",
                symbol: "META",
                name: "Meta Name",
                imageUrl: "https://cdn.example.com/provider.png",
            },
        ]);

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-provider": { priceUsd: 5 },
        });

        const result = await getWalletSwaps("wallet-1", { from: "24h" });

        expect(result.swaps[0].balanceChanges[0]).toEqual(
            expect.objectContaining({
                symbol: "PROVIDER",
                name: "Provider Name",
                logoUri: "https://cdn.example.com/provider.png",
            }),
        );
    });

    it("enriches cached transfer chunk records", async () => {
        hoisted.getCachedWalletTransfersChunkMock.mockResolvedValueOnce({
            available: true,
            cursorMatched: true,
            items: [
                {
                    from: "wallet-1",
                    to: "wallet-2",
                    amount: 1,
                    timestamp: "2026-03-19T10:00:00.000Z",
                    tokenAddress: "mint-cache",
                    tokenSymbol: "",
                    transactionSignature: "sig-cache",
                    instructionIndex: 0,
                },
            ],
            nextCursor: null,
            hasMore: false,
        });

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-cache",
                symbol: "CACHE",
                name: "Cached Token",
                imageUrl: "https://cdn.example.com/cache.png",
            },
        ]);
        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-cache": { priceUsd: 4 },
        });

        const result = await getWalletTransfers("wallet-1", { cursor: undefined });

        expect(result.pageInfo.source).toBe("cache");
        expect(result.transfers[0]).toEqual(
            expect.objectContaining({
                tokenSymbol: "CACHE",
                tokenName: "Cached Token",
                tokenLogoUri: "https://cdn.example.com/cache.png",
                priceUsd: 4,
                amountUsd: 4,
            }),
        );
        expect(hoisted.fetchHeliusSolanaTransfersMock).not.toHaveBeenCalled();
    });
});
