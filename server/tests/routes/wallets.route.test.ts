import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWalletOverviewMock } = vi.hoisted(() => ({
    getWalletOverviewMock: vi.fn(),
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

import router from "../../src/routes/wallets.route.ts";

const DEFAULT_OVERVIEW_PERIOD_SEC = 24 * 60 * 60;
const WEEK_OVERVIEW_PERIOD_SEC = 7 * 24 * 60 * 60;

describe("wallets.route - /overview", () => {
    beforeEach(() => {
        getWalletOverviewMock.mockReset();
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
    });

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
