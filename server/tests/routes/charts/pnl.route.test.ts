import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeChartCursor } from "../../../src/util/chartCursor.js";

const { getHistoricalPnLDataMock, resolveWalletTimeRangeSecMock } = vi.hoisted(() => ({
    getHistoricalPnLDataMock: vi.fn(),
    resolveWalletTimeRangeSecMock: vi.fn(),
}));

vi.mock("@sv/services/charts/pnlChart.service.js", () => ({
    getHistoricalPnLData: getHistoricalPnLDataMock,
}));

vi.mock("@sv/services/wallet/walletData.service.js", () => ({
    resolveWalletTimeRangeSec: resolveWalletTimeRangeSecMock,
}));

import app from "../../../src/routes/charts/pnl.route.ts";

describe("charts/pnl.route", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        resolveWalletTimeRangeSecMock.mockReturnValue({
            fromSec: 1,
            toSec: 20,
        });

        getHistoricalPnLDataMock.mockResolvedValue({
            dailyPnL: [{ timestamp: 10, value: 1 }],
            cumulativePnL: [{ timestamp: 10, value: 1 }],
            metadata: {
                currency: "USD",
                startBalance: 10,
                endBalance: 11,
            },
            chunkInfo: {
                chunkFromSec: 1,
                chunkToSec: 20,
                requestedFromSec: 0,
                requestedToSec: 100,
                effectiveAggregation: "daily",
            },
            cursorState: {
                hasMore: true,
                nextChunkToSec: 0,
                heliusCursor: "sig-older",
                lastProcessedSignature: "sig-last",
            },
            pageInfo: {
                pageSize: 180,
                hasMore: true,
                nextCursor: null,
                source: "mixed",
            },
        });
    });

    it("returns 400 when wallets exceed route cap", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1,w2,w3,w4,w5,w6&period=30D",
        );

        expect(response.status).toBe(400);
    });

    it("returns 400 for malformed cursor", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1&period=30D&cursor=invalid",
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toMatch(/cursor/i);
    });

    it("returns encoded nextCursor for chunked responses", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1&period=30D&limit=100",
        );

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.pageInfo).toBeDefined();
        expect(body.pageInfo.hasMore).toBe(true);
        expect(typeof body.pageInfo.nextCursor).toBe("string");

        const decoded = decodeChartCursor(body.pageInfo.nextCursor, "pnl");
        expect(decoded.endpoint).toBe("pnl");
        expect(decoded.requestedFromSec).toBe(0);
        expect(decoded.requestedToSec).toBe(100);
    });
});
