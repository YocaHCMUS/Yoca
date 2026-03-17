import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const getWalletBalancesMock = vi.fn();
    const fetchHeliusSolanaPortfolioMock = vi.fn();
    const getTokenMetaMock = vi.fn();
    const cachedPortfolioRows: Array<Record<string, unknown>> = [];
    const upsertPayloads: Array<Record<string, unknown>> = [];

    const db = {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => cachedPortfolioRows),
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
            values: vi.fn((payload: Record<string, unknown>) => {
                upsertPayloads.push(payload);
                return {
                    onConflictDoUpdate: vi.fn(async () => undefined),
                    onConflictDoNothing: vi.fn(async () => undefined),
                    returning: vi.fn(async () => []),
                };
            }),
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
        getTokenMetaMock,
        cachedPortfolioRows,
        upsertPayloads,
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
    fetchHeliusSolanaPortfolio: hoisted.fetchHeliusSolanaPortfolioMock,
    fetchHeliusSolanaSwap: vi.fn(async () => []),
    fetchHeliusSolanaTransactions: vi.fn(async () => []),
    fetchHeliusSolanaTransfers: vi.fn(async () => []),
    timePeriodToFromSec: vi.fn(() => 0),
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: vi.fn(async () => null),
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

import { getWalletPortfolio } from "../../src/services/wallet/walletData.service.ts";

describe("walletData.service - getWalletPortfolio metadata enrichment", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-16T10:00:00.000Z"));

        hoisted.getWalletBalancesMock.mockReset();
        hoisted.fetchHeliusSolanaPortfolioMock.mockReset();
        hoisted.getTokenMetaMock.mockReset();
        hoisted.db.insert.mockClear();
        hoisted.cachedPortfolioRows.length = 0;
        hoisted.upsertPayloads.length = 0;

        hoisted.getWalletBalancesMock.mockResolvedValue(null);
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([]);
        hoisted.getTokenMetaMock.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("fills missing symbol, name, and logoUri from token info fallback", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "mint-1",
                symbol: "",
                name: undefined,
                logoUri: undefined,
                amount: 10,
                valueUsd: 25,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                imageUrl: "https://cdn.example/usdc.png",
            },
        ]);

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(result).toEqual([
            expect.objectContaining({
                tokenAddress: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
                amount: 10,
                valueUsd: 25,
            }),
        ]);
        expect(hoisted.getTokenMetaMock).toHaveBeenCalledWith(["mint-1"]);
    });

    it("normalizes non-canonical SOL alias to WSOL mint for enrichment lookup", async () => {
        const SOL_ALIAS_MINT = "So11111111111111111111111111111111111111111";
        const WSOL_MINT = "So11111111111111111111111111111111111111112";

        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: SOL_ALIAS_MINT,
                symbol: "",
                name: undefined,
                logoUri: undefined,
                amount: 1,
                valueUsd: 200,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: WSOL_MINT,
                symbol: "SOL",
                name: "Solana",
                imageUrl: "https://cdn.example/sol.png",
            },
        ]);

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(hoisted.getTokenMetaMock).toHaveBeenCalledWith([WSOL_MINT]);
        expect(result[0]).toEqual(
            expect.objectContaining({
                tokenAddress: SOL_ALIAS_MINT,
                symbol: "SOL",
                name: "Solana",
                logoUri: "https://cdn.example/sol.png",
            }),
        );
    });

    it("never overwrites provider symbol and name while still filling missing logoUri", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "mint-1",
                symbol: "PROVIDER",
                name: "Provider Token",
                logoUri: undefined,
                amount: 2,
                valueUsd: 10,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-1",
                symbol: "FALLBACK",
                name: "Fallback Name",
                imageUrl: "https://cdn.example/fallback.png",
            },
        ]);

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(result[0]).toEqual(
            expect.objectContaining({
                symbol: "PROVIDER",
                name: "Provider Token",
                logoUri: "https://cdn.example/fallback.png",
            }),
        );
    });

    it("skips enrichment for invalid token addresses", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "",
                symbol: "",
                name: undefined,
                logoUri: undefined,
                amount: 1,
                valueUsd: 1,
            },
        ]);

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(result[0].tokenAddress).toBe("");
        expect(result[0].symbol).toBe("");
        expect(hoisted.getTokenMetaMock).not.toHaveBeenCalled();
    });

    it("returns original portfolio when token metadata enrichment fails", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "mint-1",
                symbol: "",
                name: undefined,
                logoUri: undefined,
                amount: 1,
                valueUsd: 10,
            },
        ]);

        hoisted.getTokenMetaMock.mockRejectedValueOnce(new Error("token-meta-failure"));

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(result).toEqual([
            expect.objectContaining({
                tokenAddress: "mint-1",
                symbol: "",
                name: undefined,
                logoUri: undefined,
                valueUsd: 10,
            }),
        ]);
    });

    it("refreshes cached portfolio metadata on fresh cache hit only when rows change", async () => {
        hoisted.cachedPortfolioRows.push({
            data: [
                {
                    tokenAddress: "mint-1",
                    symbol: "unknown",
                    name: undefined,
                    amount: 3,
                    valueUsd: 12,
                },
            ],
            fetchedAt: new Date("2026-03-16T09:59:00.000Z"),
        });

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: "mint-1",
                symbol: "USDT",
                name: "Tether USD",
                imageUrl: "https://cdn.example/usdt.png",
            },
        ]);

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(result[0]).toEqual(
            expect.objectContaining({
                symbol: "USDT",
                name: "Tether USD",
                logoUri: "https://cdn.example/usdt.png",
            }),
        );
        expect(hoisted.getWalletBalancesMock).not.toHaveBeenCalled();
        expect(hoisted.fetchHeliusSolanaPortfolioMock).not.toHaveBeenCalled();
        expect(hoisted.db.insert).toHaveBeenCalledTimes(1);
        expect(hoisted.upsertPayloads[0].data).toEqual([
            expect.objectContaining({
                symbol: "USDT",
                name: "Tether USD",
                logoUri: "https://cdn.example/usdt.png",
            }),
        ]);
    });

    it("avoids cache writes when fresh cached metadata is already complete", async () => {
        hoisted.cachedPortfolioRows.push({
            data: [
                {
                    tokenAddress: "mint-1",
                    symbol: "USDC",
                    name: "USD Coin",
                    logoUri: "https://cdn.example/usdc.png",
                    amount: 4,
                    valueUsd: 4,
                },
            ],
            fetchedAt: new Date("2026-03-16T09:59:00.000Z"),
        });

        const result = await getWalletPortfolio("wallet-1", "solana");

        expect(result[0]).toEqual(
            expect.objectContaining({
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
            }),
        );
        expect(hoisted.getTokenMetaMock).not.toHaveBeenCalled();
        expect(hoisted.db.insert).not.toHaveBeenCalled();
    });
});

// ─── Custom integration-style tests for a known Solana wallet ────────────────
const REAL_WALLET = "DnrWQNmeVR6sWNBXmK4aVVH6bFPdYuC435hT9FtfdGn8";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_LOGO =
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png";
const WSOL_LOGO =
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

describe(`getWalletPortfolio – wallet ${REAL_WALLET}`, () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-17T10:00:00.000Z"));

        hoisted.getWalletBalancesMock.mockReset();
        hoisted.fetchHeliusSolanaPortfolioMock.mockReset();
        hoisted.getTokenMetaMock.mockReset();
        hoisted.db.insert.mockClear();
        hoisted.cachedPortfolioRows.length = 0;
        hoisted.upsertPayloads.length = 0;

        hoisted.getWalletBalancesMock.mockResolvedValue(null);
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValue([]);
        hoisted.getTokenMetaMock.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("stores logoUri in DB when Helius provides it directly", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: USDC_MINT,
                symbol: "USDC",
                name: "USD Coin",
                logoUri: USDC_LOGO,
                amount: 150.5,
                priceUsd: 1.0,
                valueUsd: 150.5,
            },
            {
                tokenAddress: WSOL_MINT,
                symbol: "SOL",
                name: "Solana",
                logoUri: WSOL_LOGO,
                amount: 2.5,
                priceUsd: 200.0,
                valueUsd: 500.0,
            },
        ]);

        const result = await getWalletPortfolio(REAL_WALLET, "solana");

        // logoUri must be present in the returned portfolio items
        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ tokenAddress: USDC_MINT, logoUri: USDC_LOGO }),
                expect.objectContaining({ tokenAddress: WSOL_MINT, logoUri: WSOL_LOGO }),
            ]),
        );

        // logoUri must be persisted to the DB cache
        expect(hoisted.db.insert).toHaveBeenCalledTimes(1);
        const stored = hoisted.upsertPayloads[0].data as Array<Record<string, unknown>>;
        const storedByMint = Object.fromEntries(stored.map((r) => [r.tokenAddress, r]));
        expect(storedByMint[USDC_MINT].logoUri).toBe(USDC_LOGO);
        expect(storedByMint[WSOL_MINT].logoUri).toBe(WSOL_LOGO);

        // SIM/DB balances must NOT be called — Helius is the primary source for Solana
        expect(hoisted.getWalletBalancesMock).not.toHaveBeenCalled();
    });

    it("enriches and stores logoUri via token-info fallback when Helius omits it", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: USDC_MINT,
                symbol: "USDC",
                name: "USD Coin",
                logoUri: undefined, // Helius omitted the logo
                amount: 150.5,
                priceUsd: 1.0,
                valueUsd: 150.5,
            },
        ]);

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: USDC_MINT,
                symbol: "USDC",
                name: "USD Coin",
                imageUrl: USDC_LOGO,
            },
        ]);

        const result = await getWalletPortfolio(REAL_WALLET, "solana");

        // fallback logoUri must appear in the returned item
        expect(result[0]).toEqual(
            expect.objectContaining({ tokenAddress: USDC_MINT, logoUri: USDC_LOGO }),
        );

        // fallback logoUri must be persisted in the DB cache row
        expect(hoisted.db.insert).toHaveBeenCalledTimes(1);
        const stored = hoisted.upsertPayloads[0].data as Array<Record<string, unknown>>;
        expect(stored[0].logoUri).toBe(USDC_LOGO);
    });

    it("persists enriched logoUri in DB after a stale-metadata cache hit", async () => {
        // Simulate a cached row for this wallet where logoUri was never stored
        hoisted.cachedPortfolioRows.push({
            data: [
                {
                    tokenAddress: WSOL_MINT,
                    symbol: "SOL",
                    name: "Solana",
                    logoUri: undefined,
                    amount: 2.5,
                    valueUsd: 500.0,
                },
            ],
            fetchedAt: new Date("2026-03-17T09:59:00.000Z"), // within TTL → cache hit
        });

        hoisted.getTokenMetaMock.mockResolvedValueOnce([
            {
                address: WSOL_MINT,
                symbol: "SOL",
                name: "Solana",
                imageUrl: WSOL_LOGO,
            },
        ]);

        const result = await getWalletPortfolio(REAL_WALLET, "solana");

        // enriched logoUri must be returned
        expect(result[0]).toEqual(
            expect.objectContaining({ tokenAddress: WSOL_MINT, logoUri: WSOL_LOGO }),
        );

        // external fetcher must NOT have been called (cache was fresh)
        expect(hoisted.getWalletBalancesMock).not.toHaveBeenCalled();
        expect(hoisted.fetchHeliusSolanaPortfolioMock).not.toHaveBeenCalled();

        // enriched data must have been written back to DB
        expect(hoisted.db.insert).toHaveBeenCalledTimes(1);
        const stored = hoisted.upsertPayloads[0].data as Array<Record<string, unknown>>;
        expect(stored[0].logoUri).toBe(WSOL_LOGO);
    });

    it("uses Helius as primary for Solana and does not touch balances fallback", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: USDC_MINT,
                symbol: "USDC",
                name: "USD Coin",
                logoUri: USDC_LOGO,
                amount: 50,
                priceUsd: 1,
                valueUsd: 50,
            },
        ]);

        // SIM would return different (metadata-less) data — it must not be reached
        hoisted.getWalletBalancesMock.mockResolvedValueOnce([
            {
                tokenAddress: USDC_MINT,
                amount: 50,
                valueUsd: 50,
            },
        ]);

        const result = await getWalletPortfolio(REAL_WALLET, "solana");

        expect(result[0].logoUri).toBe(USDC_LOGO);
        expect(hoisted.getWalletBalancesMock).not.toHaveBeenCalled();
    });

    it("returns empty Solana portfolio when Helius fails and does not invoke fallback enrichment", async () => {
        hoisted.fetchHeliusSolanaPortfolioMock.mockRejectedValueOnce(new Error("helius-unavailable"));

        const result = await getWalletPortfolio(REAL_WALLET, "solana");

        expect(result).toEqual([]);
        expect(hoisted.getWalletBalancesMock).not.toHaveBeenCalled();
        expect(hoisted.getTokenMetaMock).not.toHaveBeenCalled();
    });

    it("keeps obscure Helius tokens without metadata when token-info has no matches", async () => {
        const OBSCURE_MINT_A = "Bbzu6iYnXZ7PDHMwx8nuaS2dubbkKsvfpDekfuNhUGAZ";
        const OBSCURE_MINT_B = "E6qhkEqtwzJ9rwd2vyDxH74n67Y8Z7vz8NwxaxCogjN4";

        hoisted.fetchHeliusSolanaPortfolioMock.mockResolvedValueOnce([
            { tokenAddress: OBSCURE_MINT_A, symbol: "", name: undefined, logoUri: undefined, amount: 33300805, valueUsd: 9850 },
            { tokenAddress: OBSCURE_MINT_B, symbol: "", name: undefined, logoUri: undefined, amount: 34002773, valueUsd: 8337 },
        ]);

        // token-info returns nothing for obscure mints -> enrichment is no-op
        hoisted.getTokenMetaMock.mockResolvedValueOnce([]);

        const result = await getWalletPortfolio(REAL_WALLET, "solana");

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ tokenAddress: OBSCURE_MINT_A, symbol: "", logoUri: undefined }),
                expect.objectContaining({ tokenAddress: OBSCURE_MINT_B, symbol: "", logoUri: undefined }),
            ]),
        );

        expect(hoisted.getTokenMetaMock).toHaveBeenCalledWith(
            expect.arrayContaining([OBSCURE_MINT_A, OBSCURE_MINT_B]),
        );
    });
});
