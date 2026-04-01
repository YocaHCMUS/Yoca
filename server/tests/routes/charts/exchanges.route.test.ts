import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateExchangeDataMock, getWalletExchangeCountsMock } = vi.hoisted(() => ({
    generateExchangeDataMock: vi.fn(),
    getWalletExchangeCountsMock: vi.fn(),
}));

vi.mock("@sv/services/mockChartData.service.js", () => ({
    generateExchangeData: generateExchangeDataMock,
}));

vi.mock("@sv/services/wallet/walletData.service.js", () => ({
    getWalletExchangeCounts: getWalletExchangeCountsMock,
}));

import app from "../../../src/routes/charts/exchanges.route.ts";

describe("charts/exchanges.route", () => {
    beforeEach(() => {
        generateExchangeDataMock.mockReset();
        getWalletExchangeCountsMock.mockReset();

        generateExchangeDataMock.mockReturnValue({
            exchanges: [
                {
                    name: "Mock Exchange",
                    deposits: 10,
                    withdrawals: 8,
                    depositsVolume: 1000,
                    withdrawalsVolume: 900,
                },
            ],
            metadata: {
                period: "30D",
                metric: "count",
            },
        });

        getWalletExchangeCountsMock.mockResolvedValue({
            exchanges: [
                {
                    name: "Jupiter",
                    deposits: 2,
                    withdrawals: 2,
                    depositsVolume: 240,
                    withdrawalsVolume: 220,
                },
            ],
            metadata: {
                period: "7D",
                metric: "count",
                source: "cache",
                limit: 2000,
            },
        });
    });

    it("uses mock generator when wallet context is absent", async () => {
        const response = await app.request("http://localhost/?timePeriod=30D&metric=count");

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(generateExchangeDataMock).toHaveBeenCalledWith("30D", "count");
        expect(getWalletExchangeCountsMock).not.toHaveBeenCalled();
        expect(body.exchanges[0].name).toBe("Mock Exchange");
    });

    it("uses wallet-aware aggregation when address is provided", async () => {
        const response = await app.request(
            "http://localhost/?address=wallet-1&period=7D&metric=count&chain=solana&limit=5",
        );

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(getWalletExchangeCountsMock).toHaveBeenCalledWith("wallet-1", {
            period: "7D",
            limit: 5,
            metric: "count",
            chain: "solana",
        });
        expect(generateExchangeDataMock).not.toHaveBeenCalled();
        expect(body.exchanges[0].name).toBe("Jupiter");
    });

    it("extracts first wallet from wallets query for wallet-aware mode", async () => {
        await app.request("http://localhost/?wallets=wallet-2,wallet-3&timePeriod=60D");

        expect(getWalletExchangeCountsMock).toHaveBeenCalledWith("wallet-2", {
            period: "60D",
            limit: 2000,
            metric: "count",
            chain: "solana",
        });
        expect(generateExchangeDataMock).not.toHaveBeenCalled();
    });

    it("returns wallet-aware empty payload without falling back to mock", async () => {
        getWalletExchangeCountsMock.mockResolvedValueOnce({
            exchanges: [],
            metadata: {
                period: "30D",
                metric: "count",
                source: "provider",
            },
        });

        const response = await app.request("http://localhost/?address=wallet-empty&period=30D");
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.exchanges).toEqual([]);
        expect(generateExchangeDataMock).not.toHaveBeenCalled();
    });
});