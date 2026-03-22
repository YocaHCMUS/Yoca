import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHistoricalPnLDataMock } = vi.hoisted(() => ({
    getHistoricalPnLDataMock: vi.fn(),
}));

vi.mock("@sv/services/charts/pnlChart.service.js", () => ({
    getHistoricalPnLData: getHistoricalPnLDataMock,
}));

import app from "../../../src/routes/charts/pnl.route.ts";

describe("charts/pnl.route", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        getHistoricalPnLDataMock.mockResolvedValue({
            dailyPnL: [{ timestamp: 10, value: 1 }],
            cumulativePnL: [{ timestamp: 10, value: 1 }],
            metadata: {
                currency: "USD",
                startBalance: 10,
                endBalance: 11,
            },
        });
    });

    it("returns 400 when wallets exceed route cap", async () => {
        const response = await app.request("http://localhost/?wallets=w1,w2,w3,w4,w5,w6&period=30D");

        expect(response.status).toBe(400);
    });

    it("returns non-chunk response payload", async () => {
        const response = await app.request("http://localhost/?wallets=w1&period=30D&aggregation=daily");

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(getHistoricalPnLDataMock).toHaveBeenCalledWith(["w1"], "30D", "daily");
        expect(body.pageInfo).toBeUndefined();
        expect(body.chunkInfo).toBeUndefined();
        expect(body.dailyPnL.length).toBe(1);
    });
});
