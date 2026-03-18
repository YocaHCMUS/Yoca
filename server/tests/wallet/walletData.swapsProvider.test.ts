import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const fetchHeliusSolanaSwapMock = vi.fn(async () => []);
    const fetchMoralisSolanaSwapMock = vi.fn(async () => []);
    const getCachedWalletSwapsMock = vi.fn(async () => null);
    const saveSwapsCacheMock = vi.fn(async () => undefined);

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
        fetchHeliusSolanaSwapMock,
        fetchMoralisSolanaSwapMock,
        getCachedWalletSwapsMock,
        saveSwapsCacheMock,
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
    fetchMoralisSolanaSwap: hoisted.fetchMoralisSolanaSwapMock,
    fetchHeliusSolanaSwap: hoisted.fetchHeliusSolanaSwapMock,
    fetchHeliusSolanaTransactions: vi.fn(async () => []),
    fetchHeliusSolanaTransfers: vi.fn(async () => []),
    timePeriodToFromSec: vi.fn(() => 0),
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: vi.fn(async () => null),
    getCachedWalletSwaps: hoisted.getCachedWalletSwapsMock,
    getCachedWalletTransactions: vi.fn(async () => null),
    getCachedWalletTransfers: vi.fn(async () => null),
}));

vi.mock("@sv/services/wallet/db/walletDataCacher.js", () => ({
    saveOverviewCache: vi.fn(async () => undefined),
    saveSwapsCache: hoisted.saveSwapsCacheMock,
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

import { getWalletSwaps } from "../../src/services/wallet/walletData.service.ts";

describe("walletData.service - getWalletSwaps provider selection", () => {
    beforeEach(() => {
        hoisted.fetchHeliusSolanaSwapMock.mockReset();
        hoisted.fetchMoralisSolanaSwapMock.mockReset();
        hoisted.getCachedWalletSwapsMock.mockReset();
        hoisted.saveSwapsCacheMock.mockReset();
        hoisted.getCachedWalletSwapsMock.mockResolvedValue(null);

        delete process.env.SWAP_PROVIDER_SOURCE;
        delete process.env.SWAP_PROVIDER_FALLBACK_TO_HELIUS;
    });

    afterEach(() => {
        delete process.env.SWAP_PROVIDER_SOURCE;
        delete process.env.SWAP_PROVIDER_FALLBACK_TO_HELIUS;
    });

    it("uses Moralis fetcher when SWAP_PROVIDER_SOURCE=moralis", async () => {
        process.env.SWAP_PROVIDER_SOURCE = "moralis";
        hoisted.fetchMoralisSolanaSwapMock.mockResolvedValueOnce([]);

        const result = await getWalletSwaps("wallet-1", "solana", { from: "7d" });

        expect(result.swaps).toEqual([]);
        expect(hoisted.fetchMoralisSolanaSwapMock).toHaveBeenCalledTimes(1);
        expect(hoisted.fetchHeliusSolanaSwapMock).not.toHaveBeenCalled();
    });

    it("falls back to Helius when Moralis fails and fallback is enabled", async () => {
        process.env.SWAP_PROVIDER_SOURCE = "moralis";
        hoisted.fetchMoralisSolanaSwapMock.mockRejectedValueOnce(new Error("moralis-down"));
        hoisted.fetchHeliusSolanaSwapMock.mockResolvedValueOnce([]);

        const result = await getWalletSwaps("wallet-2", "solana", { from: "24h" });

        expect(result.swaps).toEqual([]);
        expect(hoisted.fetchMoralisSolanaSwapMock).toHaveBeenCalledTimes(1);
        expect(hoisted.fetchHeliusSolanaSwapMock).toHaveBeenCalledTimes(1);
    });

    it("does not call Helius fallback when SWAP_PROVIDER_FALLBACK_TO_HELIUS=false", async () => {
        process.env.SWAP_PROVIDER_SOURCE = "moralis";
        process.env.SWAP_PROVIDER_FALLBACK_TO_HELIUS = "false";

        hoisted.fetchMoralisSolanaSwapMock.mockRejectedValueOnce(new Error("moralis-down"));

        const result = await getWalletSwaps("wallet-3", "solana", { from: "7d" });

        expect(result.swaps).toEqual([]);
        expect(hoisted.fetchMoralisSolanaSwapMock).toHaveBeenCalledTimes(1);
        expect(hoisted.fetchHeliusSolanaSwapMock).not.toHaveBeenCalled();
    });
});
