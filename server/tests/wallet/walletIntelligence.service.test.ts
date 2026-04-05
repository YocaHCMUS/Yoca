import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getWalletIdentity: vi.fn(),
    getWalletIdentityBatch: vi.fn(),
    getWalletOverview: vi.fn(),
    getWalletExchangeCounts: vi.fn(),
    getWalletTags: vi.fn(),
    getWalletFirstFund: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletIdentity.service.js", () => ({
    WalletIdentityServiceError: class MockWalletIdentityServiceError extends Error {
        code: string;
        providerStatusCode?: number;

        constructor(message: string, code = "provider_unknown", providerStatusCode?: number) {
            super(message);
            this.code = code;
            this.providerStatusCode = providerStatusCode;
        }
    },
    buildUnavailableIdentity: vi.fn(),
    getWalletIdentity: mocks.getWalletIdentity,
    getWalletIdentityBatch: mocks.getWalletIdentityBatch,
}));

vi.mock("@sv/services/wallet/walletOverview.service.js", () => ({
    getWalletOverview: mocks.getWalletOverview,
}));

vi.mock("@sv/services/wallet/walletExchangeAggregation.service.js", () => ({
    getWalletExchangeCounts: mocks.getWalletExchangeCounts,
}));

vi.mock("@sv/services/walletTags.js", () => ({
    getWalletTags: mocks.getWalletTags,
}));

vi.mock("@sv/services/wallet/walletFirstFund.service.js", () => ({
    getWalletFirstFund: mocks.getWalletFirstFund,
}));

import { composeWalletIntelligence } from "@sv/services/wallet/walletIntelligence.service.js";

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("composeWalletIntelligence", () => {
    it("adds first-fund insight while preserving analysis signals", async () => {
        const nowMs = Date.UTC(2026, 3, 3);
        vi.spyOn(Date, "now").mockReturnValue(nowMs);

        mocks.getWalletIdentity.mockResolvedValue({
            address: "TargetWallet1111111111111111111111111111111111",
            identity: {
                status: "known",
                type: "team",
                name: "Target Wallet",
                category: "wallet",
                tags: [],
                domainNames: [],
                provider: "helius",
                providerVersion: "wallet-api-beta",
                resolvedAt: new Date(nowMs).toISOString(),
            },
            metadata: {
                cache: { hit: true, stale: false, ttlSec: 60 },
                provider: {},
            },
        });
        mocks.getWalletOverview.mockResolvedValue({ transactionCount24h: 3 });
        mocks.getWalletExchangeCounts.mockResolvedValue({
            exchanges: [
                {
                    name: "Raydium",
                    deposits: 2,
                    withdrawals: 1,
                },
            ],
        });
        mocks.getWalletTags.mockResolvedValue(["trusted team"]);
        mocks.getWalletFirstFund.mockResolvedValue({
            reciepient: "TargetWallet1111111111111111111111111111111111",
            funder: "FunderWallet111111111111111111111111111111111",
            funderName: "Alpha Fund",
            funderType: "team",
            mint: "SOL",
            symbol: "SOL",
            amount: 1,
            amountRaw: "1000000000",
            decimals: 9,
            date: new Date(nowMs - 400 * 24 * 60 * 60 * 1000).toISOString(),
            signature: "sig-123",
            timestamp: Math.floor((nowMs - 400 * 24 * 60 * 60 * 1000) / 1000),
            slot: 1,
            explorerUrl: "https://example.com",
        });

        const intelligence = await composeWalletIntelligence(
            "TargetWallet1111111111111111111111111111111111",
            { userId: "user-1" },
        );

        expect(intelligence.analysis.riskLevel).toBe("low");
        expect(intelligence.analysis.firstFund).toEqual({
            targetAddress: "TargetWallet1111111111111111111111111111111111",
            funderAddress: "FunderWallet111111111111111111111111111111111",
            funderName: "Alpha Fund",
            funderType: "team",
            funderLabel: "Alpha Fund",
            firstFundDate: new Date(nowMs - 400 * 24 * 60 * 60 * 1000).toISOString(),
            firstFundTimestampSec: Math.floor((nowMs - 400 * 24 * 60 * 60 * 1000) / 1000),
            walletAgeDays: 400,
            walletAgeLabel: "1y 1m",
            signature: "sig-123",
        });
        expect(intelligence.analysis.signals).toEqual(
            expect.arrayContaining(["known_entity", "exchange_interactions_detected", "trusted_user_tag", "active_wallet_24h"]),
        );
    });

    it("keeps intelligence available when first-fund lookup fails", async () => {
        mocks.getWalletIdentity.mockResolvedValue({
            address: "TargetWallet1111111111111111111111111111111111",
            identity: {
                status: "unknown",
                type: null,
                name: null,
                category: null,
                tags: [],
                domainNames: [],
                provider: "helius",
                providerVersion: "wallet-api-beta",
                resolvedAt: new Date().toISOString(),
            },
            metadata: {
                cache: { hit: false, stale: false, ttlSec: 60 },
                provider: {},
            },
        });
        mocks.getWalletOverview.mockResolvedValue({ transactionCount24h: 0 });
        mocks.getWalletExchangeCounts.mockResolvedValue({ exchanges: [] });
        mocks.getWalletTags.mockResolvedValue([]);
        mocks.getWalletFirstFund.mockResolvedValue(null);

        const intelligence = await composeWalletIntelligence("TargetWallet1111111111111111111111111111111111");

        expect(intelligence.analysis.firstFund).toBeNull();
        expect(intelligence.analysis.riskLevel).toBe("medium");
    });
});