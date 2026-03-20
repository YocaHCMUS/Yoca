import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeChartCursor } from "../../../src/util/chartCursor.js";

const {
    getWalletBalanceHistoryMock,
    getWalletBalanceHistoryChunkMock,
    getWalletTokenBalanceHistoryMock,
    getWalletTokenBalanceHistoryChunkMock,
    resolveWalletTimeRangeSecMock,
    generateBalanceTrendMock,
} = vi.hoisted(() => ({
    getWalletBalanceHistoryMock: vi.fn(),
    getWalletBalanceHistoryChunkMock: vi.fn(),
    getWalletTokenBalanceHistoryMock: vi.fn(),
    getWalletTokenBalanceHistoryChunkMock: vi.fn(),
    resolveWalletTimeRangeSecMock: vi.fn(),
    generateBalanceTrendMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletData.service.js", () => ({
    getWalletBalanceHistory: getWalletBalanceHistoryMock,
    getWalletBalanceHistoryChunk: getWalletBalanceHistoryChunkMock,
    getWalletTokenBalanceHistory: getWalletTokenBalanceHistoryMock,
    getWalletTokenBalanceHistoryChunk: getWalletTokenBalanceHistoryChunkMock,
    resolveWalletTimeRangeSec: resolveWalletTimeRangeSecMock,
}));

vi.mock("@sv/services/mockChartData.service.js", () => ({
    generateBalanceTrend: generateBalanceTrendMock,
}));

import app from "../../../src/routes/charts/balance.route.ts";

describe("charts/balance.route", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        resolveWalletTimeRangeSecMock.mockReturnValue({
            fromSec: 1,
            toSec: 10,
        });

        getWalletBalanceHistoryMock.mockResolvedValue([
            { timestamp: 1, value: 100, date: "2026-03-20T00:00:00.000Z" },
        ]);

        getWalletBalanceHistoryChunkMock.mockResolvedValue({
            series: [
                { timestamp: 1, value: 100, date: "2026-03-20T00:00:00.000Z" },
            ],
            chunkInfo: {
                chunkFromSec: 1,
                chunkToSec: 10,
                requestedFromSec: 0,
                requestedToSec: 100,
                effectiveAggregation: "daily",
            },
            chunkState: {
                hasMore: true,
                nextChunkToSec: 0,
                heliusCursor: "sig-older",
                lastProcessedSignature: "sig-last",
            },
        });

        getWalletTokenBalanceHistoryMock.mockResolvedValue({
            tokenSeries: [{ timestamp: 1, value: 1, date: "2026-03-20T00:00:00.000Z" }],
            usdSeries: [{ timestamp: 1, value: 100, date: "2026-03-20T00:00:00.000Z" }],
            tokenSymbol: "SOL",
            tokenAddress: "mint-1",
        });

        getWalletTokenBalanceHistoryChunkMock.mockResolvedValue({
            tokenSeries: [{ timestamp: 1, value: 1, date: "2026-03-20T00:00:00.000Z" }],
            usdSeries: [{ timestamp: 1, value: 100, date: "2026-03-20T00:00:00.000Z" }],
            tokenSymbol: "SOL",
            tokenAddress: "mint-1",
            chunkInfo: {
                chunkFromSec: 1,
                chunkToSec: 10,
                requestedFromSec: 0,
                requestedToSec: 100,
                effectiveAggregation: "daily",
            },
            chunkState: {
                hasMore: false,
                nextChunkToSec: null,
                heliusCursor: null,
                lastProcessedSignature: null,
            },
        });

        generateBalanceTrendMock.mockReturnValue({
            series: [],
            metadata: { timePeriod: "30D" },
        });
    });

    it("returns 400 when wallets exceed route cap", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1,w2,w3,w4,w5,w6&timePeriod=30D",
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toMatch(/wallets exceeds max/i);
    });

    it("returns 400 for malformed cursor", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1&timePeriod=30D&cursor=not-valid",
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toMatch(/cursor/i);
    });

    it("rejects unsafe multi-wallet All requests without explicit chunk params", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1,w2&timePeriod=All",
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toMatch(/chunk params/i);
    });

    it("returns pageInfo and encoded nextCursor for chunked total-balance responses", async () => {
        const response = await app.request(
            "http://localhost/?wallets=w1&timePeriod=30D&limit=120",
        );

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(getWalletBalanceHistoryChunkMock).toHaveBeenCalled();
        expect(body.pageInfo).toBeDefined();
        expect(body.pageInfo.hasMore).toBe(true);
        expect(typeof body.pageInfo.nextCursor).toBe("string");

        const decoded = decodeChartCursor(body.pageInfo.nextCursor, "balance");
        expect(decoded.endpoint).toBe("balance");
        expect(decoded.requestedFromSec).toBe(0);
        expect(decoded.requestedToSec).toBe(100);
    });
});
