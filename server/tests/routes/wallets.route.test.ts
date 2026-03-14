import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWalletOverviewMock } = vi.hoisted(() => ({
    getWalletOverviewMock: vi.fn(),
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
    getWalletPortfolio: vi.fn(async () => []),
    getWalletTransactions: vi.fn(async () => ({ address: "", chain: "solana", transactions: [] })),
    getWalletExchangeCounts: vi.fn(async () => ({ exchanges: [], metadata: { period: "30D", metric: "count" } })),
    getWalletSwaps: vi.fn(async () => ({ address: "", chain: "solana", swaps: [] })),
    getWalletTransfers: vi.fn(async () => ({ address: "", chain: "solana", transfers: [] })),
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

const DEFAULT_OVERVIEW_PERIOD_SEC = 24 * 60 * 60;
const WEEK_OVERVIEW_PERIOD_SEC = 7 * 24 * 60 * 60;

beforeEach(() => {
    getWalletOverviewMock.mockReset();
    getWalletIdentityMock.mockReset();
    getWalletIdentityBatchMock.mockReset();
    composeWalletIntelligenceMock.mockReset();

    getWalletOverviewMock.mockResolvedValue({
        address: "wallet-1",
        chain: "solana",
        totalAssetValueUsd: 100,
        tradingVolumeUsd24h: 10,
        pnlUsdTotal: 5,
        transactionCount24h: 2,
        tokensTradedCount: 1,
        tokensHoldingCount: 3,
        metricsPeriod: "24h",
    });

    getWalletIdentityMock.mockResolvedValue({
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
        chain: "solana",
        results: [],
    });

    composeWalletIntelligenceMock.mockResolvedValue({
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
            "http://localhost/overview?address=wallet-1&chain=solana&period=24h",
        );

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toMatchObject({
            address: "wallet-1",
            chain: "solana",
            totalAssetValueUsd: 100,
            tokensHoldingCount: 3,
        });

        expect(getWalletOverviewMock).toHaveBeenCalledWith("wallet-1", "solana", {
            periodSec: DEFAULT_OVERVIEW_PERIOD_SEC,
        });
    });

    it("defaults chain to solana when omitted", async () => {
        const response = await router.request("http://localhost/overview?address=wallet-1");

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenCalledWith("wallet-1", "solana", {
            periodSec: DEFAULT_OVERVIEW_PERIOD_SEC,
        });
    });

    it("defaults period to 24h when omitted", async () => {
        const response = await router.request("http://localhost/overview?address=wallet-1&chain=eth");

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenCalledWith("wallet-1", "eth", {
            periodSec: DEFAULT_OVERVIEW_PERIOD_SEC,
        });
    });

    it.each([
        ["12h"],
        ["30d"],
        ["invalid"],
    ])("normalizes unsupported period %s to 24h", async (period) => {
        const response = await router.request(
            `http://localhost/overview?address=wallet-1&chain=solana&period=${period}`,
        );

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenLastCalledWith("wallet-1", "solana", {
            periodSec: DEFAULT_OVERVIEW_PERIOD_SEC,
        });
    });

    it.each([
        ["24h", DEFAULT_OVERVIEW_PERIOD_SEC],
        ["7d", WEEK_OVERVIEW_PERIOD_SEC],
    ])("passes supported period %s as %d seconds", async (period, expectedSec) => {
        const response = await router.request(
            `http://localhost/overview?address=wallet-1&chain=solana&period=${period}`,
        );

        expect(response.status).toBe(200);
        expect(getWalletOverviewMock).toHaveBeenLastCalledWith("wallet-1", "solana", {
            periodSec: expectedSec,
        });
    });
});

describe("wallets.route - /identity", () => {
    it("returns normalized known identity response", async () => {
        const response = await router.request(
            "http://localhost/identity?address=wallet-1&chain=solana",
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.identity.status).toBe("known");
        expect(getWalletIdentityMock).toHaveBeenCalledWith("wallet-1", "solana");
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
        expect(getWalletIdentityBatchMock).toHaveBeenCalledWith(["wallet-1"], "solana");
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
        expect(composeWalletIntelligenceMock).toHaveBeenCalledWith("wallet-1", {
            chain: "solana",
        });
    });

    it("returns 400 when address is missing", async () => {
        const response = await router.request("http://localhost/intelligence");
        expect(response.status).toBe(400);
        expect(composeWalletIntelligenceMock).not.toHaveBeenCalled();
    });
});
