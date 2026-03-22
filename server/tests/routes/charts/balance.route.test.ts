import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    getWalletBalanceHistoryMock,
    getWalletTokenBalanceHistoryMock,
    generateBalanceTrendMock,
} = vi.hoisted(() => ({
    getWalletBalanceHistoryMock: vi.fn(),
    getWalletTokenBalanceHistoryMock: vi.fn(),
    generateBalanceTrendMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletCharts.service.js", () => ({
    getWalletBalanceHistory: getWalletBalanceHistoryMock,
}));

vi.mock("@sv/services/wallet/walletTokenBalance.service.js", () => ({
    getWalletTokenBalanceHistory: getWalletTokenBalanceHistoryMock,
}));

vi.mock("@sv/services/mockChartData.service.js", () => ({
    generateBalanceTrend: generateBalanceTrendMock,
}));

import app from "../../../src/routes/charts/balance.route.ts";

describe("charts/balance.route", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        getWalletBalanceHistoryMock.mockResolvedValue([
            { timestamp: 1, value: 100, date: "2026-03-20T00:00:00.000Z" },
        ]);

        getWalletTokenBalanceHistoryMock.mockResolvedValue({
            tokenSeries: [{ timestamp: 1, value: 1, date: "2026-03-20T00:00:00.000Z" }],
            usdSeries: [{ timestamp: 1, value: 100, date: "2026-03-20T00:00:00.000Z" }],
            tokenSymbol: "SOL",
            tokenAddress: "mint-1",
        });

        generateBalanceTrendMock.mockReturnValue({
            series: [],
            metadata: { timePeriod: "30D" },
        });
    });

    it("returns 400 when wallets exceed route cap", async () => {
        const response = await app.request("http://localhost/?wallets=w1,w2,w3,w4,w5,w6&timePeriod=30D");

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toMatch(/wallets exceeds max/i);
    });

    it("returns 400 when tokens exceed route cap", async () => {
        const response = await app.request("http://localhost/?wallets=w1&tokens=t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11");

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toMatch(/tokens exceeds max/i);
    });

    it("returns total balance payload without chunk metadata", async () => {
        const response = await app.request("http://localhost/?wallets=w1&timePeriod=30D");

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(getWalletBalanceHistoryMock).toHaveBeenCalledWith("w1", "30D");
        expect(body.pageInfo).toBeUndefined();
        expect(body.chunkInfo).toBeUndefined();
        expect(body.metadata.mode).toBe("total");
        expect(body.series.length).toBe(1);
    });

    it("returns token balance payload without chunk metadata", async () => {
        const response = await app.request("http://localhost/?wallets=w1&tokens=SOL&timePeriod=30D");

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(getWalletTokenBalanceHistoryMock).toHaveBeenCalled();
        expect(getWalletTokenBalanceHistoryMock.mock.calls[0]?.[0]).toBe("w1");
        expect(getWalletTokenBalanceHistoryMock.mock.calls[0]?.[1]).toBe("SOL");
        expect(body.pageInfo).toBeUndefined();
        expect(body.chunkInfo).toBeUndefined();
        expect(body.metadata.mode).toBe("token");
        expect(body.series.length).toBe(2);
    });
});
