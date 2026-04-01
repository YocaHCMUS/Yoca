import { beforeEach, describe, expect, it, vi } from "vitest";

const { getWalletPortfolioMock, generateAssetDistributionMock } = vi.hoisted(() => ({
    getWalletPortfolioMock: vi.fn(),
    generateAssetDistributionMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletData.service.js", () => ({
    getWalletPortfolio: getWalletPortfolioMock,
}));

vi.mock("@sv/services/mockChartData.service.js", () => ({
    generateAssetDistribution: generateAssetDistributionMock,
}));

import app from "../../../src/routes/charts/distribution.route.ts";

describe("charts/distribution.route", () => {
    beforeEach(() => {
        getWalletPortfolioMock.mockReset();
        generateAssetDistributionMock.mockReset();

        generateAssetDistributionMock.mockReturnValue({
            data: [{ name: "Fallback", value: 1, percentage: 100 }],
            totalValue: 1,
            metadata: {
                currency: "USD",
                timestamp: 123,
            },
        });
    });

    it("returns wallet-driven distribution with additive token metadata fields", async () => {
        getWalletPortfolioMock.mockResolvedValueOnce([
            {
                tokenAddress: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
                amount: 50,
                valueUsd: 50,
            },
            {
                tokenAddress: "mint-2",
                symbol: "SOL",
                name: "Solana",
                logoUri: "https://cdn.example/sol.png",
                amount: 1,
                valueUsd: 150,
            },
        ]);

        const response = await app.request("http://localhost/?wallets=wallet-1&period=30D");

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.totalValue).toBe(200);
        expect(body.data).toHaveLength(2);
        expect(body.data[0]).toEqual(
            expect.objectContaining({
                name: "USDC",
                value: 50,
                percentage: 25,
                rawAmount: 50,
                tokenAddress: "mint-1",
                symbol: "USDC",
                logoUri: "https://cdn.example/usdc.png",
            }),
        );
        expect(body.metadata).toEqual(
            expect.objectContaining({
                currency: "USD",
                timestamp: expect.any(Number),
            }),
        );
        expect(getWalletPortfolioMock).toHaveBeenCalledWith("wallet-1", "solana");
    });

    it("falls back to mock distribution when wallet portfolio fetch fails", async () => {
        getWalletPortfolioMock.mockRejectedValueOnce(new Error("simulated failure"));

        const response = await app.request("http://localhost/?wallets=wallet-1&period=30D");

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body).toEqual({
            data: [{ name: "Fallback", value: 1, percentage: 100 }],
            totalValue: 1,
            metadata: {
                currency: "USD",
                timestamp: 123,
            },
        });
        expect(generateAssetDistributionMock).toHaveBeenCalledWith("30D", "wallet-1");
    });
});
