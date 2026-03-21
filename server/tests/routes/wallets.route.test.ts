import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWalletOverviewMock, getWalletPortfolioMock, getWalletSwapsMock, getWalletTransfersMock, getWalletExchangeCountsMock } = vi.hoisted(() => ({
    getWalletOverviewMock: vi.fn(),
    getWalletPortfolioMock: vi.fn(),
    getWalletSwapsMock: vi.fn(),
    getWalletTransfersMock: vi.fn(),
    getWalletExchangeCountsMock: vi.fn(),
}));

const { getWalletCounterpartiesMock } = vi.hoisted(() => ({
    getWalletCounterpartiesMock: vi.fn(),
}));

const {
    getWalletIdentityMock,
    getWalletIdentityBatchMock,
    composeWalletIntelligenceMock,
} = vi.hoisted(() => ({
    getWalletIdentityMock: vi.fn(),
    getWalletIdentityBatchMock: vi.fn(),
    composeWalletIntelligenceMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletData.service.js", () => ({
    fetchTestTransaction: vi.fn(async () => ({})),
    getWalletOverview: getWalletOverviewMock,
    getWalletPortfolio: getWalletPortfolioMock,
    getWalletTransactions: vi.fn(async () => ({ address: "", chain: "solana", transactions: [] })),
    getWalletExchangeCounts: getWalletExchangeCountsMock,
    getWalletSwaps: getWalletSwapsMock,
    getWalletTransfers: getWalletTransfersMock,
}));

vi.mock("@sv/services/wallet/counterparties.service.js", () => ({
    getWalletCounterparties: getWalletCounterpartiesMock,
}));

vi.mock("@sv/services/wallet/walletIdentity.service.js", () => {
    class WalletIdentityServiceError extends Error {
        readonly code: string;
        readonly statusCode: number;
        readonly providerStatusCode?: number;

        constructor(
            message: string,
            code: string,
            statusCode: number,
            providerStatusCode?: number,
        ) {
            super(message);
            this.name = "WalletIdentityServiceError";
            this.code = code;
            this.statusCode = statusCode;
            this.providerStatusCode = providerStatusCode;
        }
    }

    return {
        WALLET_IDENTITY_MAX_BATCH_SIZE: 100,
        WalletIdentityServiceError,
        getWalletIdentity: getWalletIdentityMock,
        getWalletIdentityBatch: getWalletIdentityBatchMock,
    };
});

vi.mock("@sv/services/wallet/walletIntelligence.service.js", () => ({
    composeWalletIntelligence: composeWalletIntelligenceMock,
}));

import router from "../../src/routes/wallets.route.ts";

const DEFAULT_OVERVIEW_TIME_PERIOD = "24H";
const WEEK_OVERVIEW_TIME_PERIOD = "7D";

beforeEach(() => {
    getWalletOverviewMock.mockReset();
    getWalletPortfolioMock.mockReset();
    getWalletSwapsMock.mockReset();
    getWalletTransfersMock.mockReset();
    getWalletExchangeCountsMock.mockReset();
    getWalletCounterpartiesMock.mockReset();
    getWalletIdentityMock.mockReset();
    getWalletIdentityBatchMock.mockReset();
    composeWalletIntelligenceMock.mockReset();

    getWalletOverviewMock.mockResolvedValue({
        address: "wallet-1",
        totalAssetValueUsd: 100,
        tradingVolumeUsd24h: 10,
        pnlUsdTotal: 5,
        transactionCount24h: 2,
        tokensTradedCount: 1,
        tokensHoldingCount: 3,
        metricsPeriod: "24h",
    });

    getWalletPortfolioMock.mockResolvedValue([]);

    getWalletSwapsMock.mockResolvedValue({
        address: "wallet-1",
        swaps: [],
        pageInfo: {
            pageSize: 100,
            hasMore: false,
            nextCursor: null,
            source: "provider",
        },
    });

    getWalletTransfersMock.mockResolvedValue({
        address: "wallet-1",
        transfers: [],
        pageInfo: {
            pageSize: 100,
            hasMore: false,
            nextCursor: null,
            source: "provider",
        },
    });

    getWalletExchangeCountsMock.mockResolvedValue({
        exchanges: [],
        metadata: {
            period: "30D",
            metric: "count",
            source: "cache",
            limit: 10,
            truncated: false,
        },
    });

    getWalletIdentityMock.mockResolvedValue({
        address: "wallet-1",
        identity: {
            status: "known",
            type: "exchange",
            name: "Binance 1",
            category: "Centralized Exchange",
            tags: ["Centralized Exchange"],
            domainNames: [],
            provider: "helius",
            providerVersion: "wallet-api-beta",
            resolvedAt: "2026-03-14T00:00:00.000Z",
        },
        metadata: {
            cache: {
                hit: false,
                stale: false,
                ttlSec: 21600,
            },
            provider: {
                statusCode: 200,
            },
        },
    });

    getWalletIdentityBatchMock.mockResolvedValue({
        results: [],
    });

    getWalletCounterpartiesMock.mockResolvedValue({
        counterparties: [
            {
                address: "wallet-2",
                identity: {
                    status: "unknown",
                    name: null,
                    category: null,
                    type: null,
                },
                uniqueTokenCount: 2,
                tokens: ["SOL", "USDC"],
                transactionCount: 3,
                totalVolumeUsd: 120,
            },
        ],
        rankings: {
            byTransactionCount: [
                {
                    address: "wallet-2",
                    label: "wallet-2",
                    transactionCount: 3,
                    totalVolumeUsd: 120,
                },
            ],
            byVolume: [
                {
                    address: "wallet-2",
                    label: "wallet-2",
                    transactionCount: 3,
                    totalVolumeUsd: 120,
                },
            ],
        },
        metadata: {
            period: "7d",
            source: "mixed",
            totals: {
                counterparties: 1,
                transactions: 3,
                volume: 120,
            },
        },
    });

    composeWalletIntelligenceMock.mockResolvedValue({
        address: "wallet-1",
        identity: {
            status: "known",
            type: "exchange",
            name: "Binance 1",
            category: "Centralized Exchange",
            tags: ["Centralized Exchange"],
            domainNames: [],
            provider: "helius",
            providerVersion: "wallet-api-beta",
            resolvedAt: "2026-03-14T00:00:00.000Z",
        },
        analysis: {
            riskScore: 20,
            riskLevel: "low",
            signals: ["known_entity"],
            counterpartyProfile: {
                exchangeInteractions24h: 3,
                uniqueKnownEntities7d: 2,
            },
        },
        metadata: {
            cache: {
                identityHit: false,
                analysisHit: true,
                ttlSec: 21600,
                staleIdentity: false,
            },
            provider: {
                statusCode: 200,
            },
        },
    });
});

describe("wallets.route - /overview", () => {

    it("returns 200 and forwards validated query params", async () => {
        const response = await router.request(
            "http://localhost/overview?address=wallet-1&period=24h",
        );

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toMatchObject({
            address: "wallet-1",
            totalAssetValueUsd: 100,
            tokensHoldingCount: 3,
        });

        expect(getWalletOverviewMock).toHaveBeenCalledWith("wallet-1", {
            timePeriod: DEFAULT_OVERVIEW_TIME_PERIOD,
        });
    });

    it("defaults period to 24h when omitted", async () => {
        const response = await router.request("http://localhost/overview?address=wallet-1");

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenCalledWith("wallet-1", {
            timePeriod: DEFAULT_OVERVIEW_TIME_PERIOD,
        });
    });

    it.each([
        ["12h"],
        ["invalid"],
    ])("normalizes unsupported period %s to 24h", async (period) => {
        const response = await router.request(
            `http://localhost/overview?address=wallet-1&period=${period}`,
        );

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenLastCalledWith("wallet-1", {
            timePeriod: DEFAULT_OVERVIEW_TIME_PERIOD,
        });
    });

    it("normalizes lowercase enum period to enum option", async () => {
        const response = await router.request(
            "http://localhost/overview?address=wallet-1&period=30d",
        );

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenLastCalledWith("wallet-1", {
            timePeriod: "30D",
        });
    });

    it.each([
        ["24H", DEFAULT_OVERVIEW_TIME_PERIOD],
        ["7D", WEEK_OVERVIEW_TIME_PERIOD],
    ])("passes supported period %s as enum option %s", async (period, expectedPeriod) => {
        const response = await router.request(
            `http://localhost/overview?address=wallet-1&period=${period}`,
        );

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenLastCalledWith("wallet-1", {
            timePeriod: expectedPeriod,
        });
    });
});

describe("wallets.route - /portfolio", () => {
    it("returns additive logoUri while preserving legacy fields", async () => {
        getWalletPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
                amount: 100,
                priceUsd: 1,
                valueUsd: 100,
                change24hPercent: 0.2,
            },
        ]);

        const response = await router.request(
            "http://localhost/portfolio?address=wallet-1",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual([
            expect.objectContaining({
                tokenAddress: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
                amount: 100,
                valueUsd: 100,
            }),
        ]);
        expect(getWalletPortfolioMock).toHaveBeenCalledWith("wallet-1");
    });
});

describe("wallets.route - /distribution", () => {
    it("includes additive token metadata fields and keeps required distribution shape", async () => {
        getWalletPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
                amount: 10,
                valueUsd: 10,
            },
            {
                tokenAddress: "mint-2",
                symbol: "SOL",
                name: "Solana",
                logoUri: "https://cdn.example/sol.png",
                amount: 2,
                valueUsd: 30,
            },
        ]);

        const response = await router.request(
            "http://localhost/distribution?address=wallet-1",
        );

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.totalValue).toBe(40);
        expect(body).toEqual(
            expect.objectContaining({
                data: expect.any(Array),
                totalValue: 40,
                metadata: expect.objectContaining({
                    currency: "USD",
                    timestamp: expect.any(Number),
                }),
            }),
        );

        expect(body.data[0]).toEqual(
            expect.objectContaining({
                name: "USDC",
                value: 10,
                percentage: 25,
                tokenAddress: "mint-1",
                symbol: "USDC",
                logoUri: "https://cdn.example/usdc.png",
            }),
        );
        expect(getWalletPortfolioMock).toHaveBeenCalledWith("wallet-1");
    });
});

describe("wallets.route - /exchanges", () => {
    it("forwards period, chain, and limit to exchange aggregation service", async () => {
        getWalletExchangeCountsMock.mockResolvedValueOnce({
            exchanges: [
                {
                    name: "Jupiter",
                    deposits: 2,
                    withdrawals: 1,
                    depositsVolume: 200,
                    withdrawalsVolume: 120,
                },
            ],
            metadata: {
                period: "7D",
                metric: "count",
                source: "provider",
                limit: 5,
                truncated: false,
            },
        });

        const response = await router.request(
            "http://localhost/exchanges?address=wallet-1&period=7D&chain=solana&limit=5",
        );

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.exchanges).toHaveLength(1);
        expect(getWalletExchangeCountsMock).toHaveBeenCalledWith("wallet-1", {
            period: "7D",
            chain: "solana",
            limit: 5,
        });
    });

    it("omits invalid limit while keeping address-only fallback behavior", async () => {
        const response = await router.request(
            "http://localhost/exchanges?address=wallet-1&limit=oops",
        );

        expect(response.status).toBe(200);
        expect(getWalletExchangeCountsMock).toHaveBeenCalledWith("wallet-1", {
            period: undefined,
            chain: undefined,
            limit: undefined,
        });
    });

    it("clamps oversized limit to route max", async () => {
        const response = await router.request(
            "http://localhost/exchanges?address=wallet-1&limit=999999",
        );

        expect(response.status).toBe(200);
        expect(getWalletExchangeCountsMock).toHaveBeenCalledWith("wallet-1", {
            period: undefined,
            chain: undefined,
            limit: 5000,
        });
    });
});

describe("wallets.route - paginated table endpoints", () => {
    it("returns swap pageInfo and forwards cursor alias params", async () => {
        getWalletSwapsMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            swaps: [
                {
                    walletAddress: "wallet-1",
                    signature: "swap-signature",
                    timestamp: "2026-03-14T00:00:00.000Z",
                    slot: 123,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [],
                    feeChanges: [],
                },
            ],
            pageInfo: {
                pageSize: 100,
                hasMore: true,
                nextCursor: "next-before",
                source: "provider",
            },
        });

        const response = await router.request(
            "http://localhost/swap?address=wallet-1&cursor=cursor-1&before=before-1&limit=999",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.pageInfo).toEqual(
            expect.objectContaining({
                pageSize: 100,
                hasMore: true,
                nextCursor: "next-before",
            }),
        );

        expect(getWalletSwapsMock).toHaveBeenCalledWith("wallet-1", {
            limit: 999,
            cursor: "cursor-1",
            before: "before-1",
        });
    });

    it("returns transfer pageInfo and handles non-numeric limit", async () => {
        getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                {
                    from: "wallet-1",
                    to: "wallet-2",
                    amount: 1,
                    timestamp: "2026-03-14T00:00:00.000Z",
                    tokenAddress: "mint-1",
                    tokenSymbol: "SOL",
                    transactionSignature: "transfer-signature",
                    instructionIndex: 0,
                },
            ],
            pageInfo: {
                pageSize: 100,
                hasMore: false,
                nextCursor: null,
                source: "cache",
            },
        });

        const response = await router.request(
            "http://localhost/transfers?address=wallet-1&before=transfer-before&limit=bad",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.pageInfo).toEqual(
            expect.objectContaining({
                pageSize: 100,
                hasMore: false,
                nextCursor: null,
                source: "cache",
            }),
        );

        expect(getWalletTransfersMock).toHaveBeenCalledWith("wallet-1", {
            limit: undefined,
            cursor: undefined,
            before: "transfer-before",
        });
    });
});

describe("wallets.route - /identity", () => {
    it("returns normalized known identity response", async () => {
        const response = await router.request(
            "http://localhost/identity?address=wallet-1",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.identity.status).toBe("known");
        expect(getWalletIdentityMock).toHaveBeenCalledWith("wallet-1");
    });

    it("returns normalized unknown identity with 200", async () => {
        getWalletIdentityMock.mockResolvedValueOnce({
            address: "wallet-2",
            chain: "solana",
            identity: {
                status: "unknown",
                type: null,
                name: null,
                category: null,
                tags: [],
                domainNames: [],
                provider: "helius",
                providerVersion: "wallet-api-beta",
                resolvedAt: "2026-03-14T00:00:00.000Z",
            },
            metadata: {
                cache: {
                    hit: false,
                    stale: false,
                    ttlSec: 7200,
                },
                provider: {
                    statusCode: 404,
                },
            },
        });

        const response = await router.request(
            "http://localhost/identity?address=wallet-2&chain=solana",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.identity.status).toBe("unknown");
    });

    it("returns 400 for missing address", async () => {
        const response = await router.request("http://localhost/identity");

        expect(response.status).toBe(400);
        expect(getWalletIdentityMock).not.toHaveBeenCalled();
    });
});

describe("wallets.route - /counterparties", () => {
    it("returns 200 and counterparties payload", async () => {
        const response = await router.request(
            "http://localhost/counterparties?address=wallet-1&chain=solana&period=7d&limit=10&includeTokens=true",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.counterparties).toHaveLength(1);

        expect(getWalletCounterpartiesMock).toHaveBeenCalledWith("wallet-1", {
            period: "7d",
            limit: 10,
            includeTokens: true,
        });
    });

    it("returns 400 when address is missing", async () => {
        const response = await router.request("http://localhost/counterparties?chain=solana");

        expect(response.status).toBe(400);
        expect(getWalletCounterpartiesMock).not.toHaveBeenCalled();
    });

    it("normalizes invalid period to 7d", async () => {
        const response = await router.request(
            "http://localhost/counterparties?address=wallet-1&period=30d",
        );

        expect(response.status).toBe(200);
        expect(getWalletCounterpartiesMock).toHaveBeenLastCalledWith("wallet-1", {
            period: "7d",
            limit: 20,
            includeTokens: true,
        });
    });

    it("clamps limit to max value", async () => {
        const response = await router.request(
            "http://localhost/counterparties?address=wallet-1&limit=9999",
        );

        expect(response.status).toBe(200);
        expect(getWalletCounterpartiesMock).toHaveBeenLastCalledWith("wallet-1", {
            period: "7d",
            limit: 100,
            includeTokens: true,
        });
    });
});

describe("wallets.route - /identity/batch", () => {
    it("returns 400 when batch has more than 100 addresses", async () => {
        const addresses = Array.from({ length: 101 }, (_, i) => `wallet-${i}`);

        const response = await router.request("http://localhost/identity/batch", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses, chain: "solana" }),
        });

        expect(response.status).toBe(400);
        expect(getWalletIdentityBatchMock).not.toHaveBeenCalled();
    });

    it("returns batch identity payload for valid request", async () => {
        getWalletIdentityBatchMock.mockResolvedValueOnce({
            chain: "solana",
            results: [
                {
                    address: "wallet-1",
                    chain: "solana",
                    identity: {
                        status: "known",
                        type: "exchange",
                        name: "Binance 1",
                        category: "Centralized Exchange",
                        tags: ["Centralized Exchange"],
                        domainNames: [],
                        provider: "helius",
                        providerVersion: "wallet-api-beta",
                        resolvedAt: "2026-03-14T00:00:00.000Z",
                    },
                    metadata: {
                        cache: { hit: false, stale: false, ttlSec: 21600 },
                        provider: { statusCode: 200 },
                    },
                },
            ],
        });

        const response = await router.request("http://localhost/identity/batch", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses: ["wallet-1"], chain: "solana" }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.results).toHaveLength(1);
        expect(getWalletIdentityBatchMock).toHaveBeenCalledWith(["wallet-1"]);
    });
});

describe("wallets.route - /intelligence", () => {
    it("returns composed wallet intelligence response", async () => {
        const response = await router.request(
            "http://localhost/intelligence?address=wallet-1&chain=solana",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.analysis.riskLevel).toBe("low");
        expect(composeWalletIntelligenceMock).toHaveBeenCalledWith("wallet-1");
    });

    it("returns 400 when address is missing", async () => {
        const response = await router.request("http://localhost/intelligence");
        expect(response.status).toBe(400);
        expect(composeWalletIntelligenceMock).not.toHaveBeenCalled();
    });
});
