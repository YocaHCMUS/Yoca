import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    getWalletOverviewMock: vi.fn(async () => ({ source: "overview" })),
    getWalletPortfolioMock: vi.fn(async () => [{ tokenAddress: "mint-1" }]),
    getWalletTransfersMock: vi.fn(async () => ({ address: "wallet-1", transfers: [], pageInfo: { pageSize: 100, hasMore: false, nextCursor: null, source: "provider" as const } })),
    getWalletSwapsMock: vi.fn(async () => ({ address: "wallet-1", swaps: [], pageInfo: { pageSize: 100, hasMore: false, nextCursor: null, source: "provider" as const } })),
    getWalletBalanceHistoryMock: vi.fn(async () => []),
    getWalletBalanceHistoryChunkMock: vi.fn(async () => ({
        series: [],
        chunkInfo: {
            chunkFromSec: 1,
            chunkToSec: 2,
            requestedFromSec: 1,
            requestedToSec: 2,
            effectiveAggregation: "daily" as const,
        },
        chunkState: {
            hasMore: false,
            nextChunkToSec: null,
            heliusCursor: null,
            lastProcessedSignature: null,
        },
    })),
    getCumulativePnLMock: vi.fn(async () => ({ dailyPnL: [], cumulativePnL: [], startBalance: 0, endBalance: 0 })),
    getCumulativePnLChunkMock: vi.fn(async () => ({
        dailyPnL: [],
        cumulativePnL: [],
        startBalance: 0,
        endBalance: 0,
        chunkInfo: {
            chunkFromSec: 1,
            chunkToSec: 2,
            requestedFromSec: 1,
            requestedToSec: 2,
            effectiveAggregation: "daily" as const,
        },
        chunkState: {
            hasMore: false,
            nextChunkToSec: null,
            heliusCursor: null,
            lastProcessedSignature: null,
        },
    })),
    resolveWalletTimeRangeSecMock: vi.fn(() => ({ fromSec: 1, toSec: 2 })),
    clampChartPointsPerChunkMock: vi.fn(() => 180),
    getWalletTokenBalanceHistoryMock: vi.fn(async () => ({ tokenSeries: [], usdSeries: [], tokenSymbol: "SOL", tokenAddress: "mint-1" })),
    getWalletTokenBalanceHistoryChunkMock: vi.fn(async () => ({
        tokenSeries: [],
        usdSeries: [],
        tokenSymbol: "SOL",
        tokenAddress: "mint-1",
        chunkInfo: {
            chunkFromSec: 1,
            chunkToSec: 2,
            requestedFromSec: 1,
            requestedToSec: 2,
            effectiveAggregation: "daily" as const,
        },
        chunkState: {
            hasMore: false,
            nextChunkToSec: null,
            heliusCursor: null,
            lastProcessedSignature: null,
        },
    })),
    enrichWithSolanaTokenPricesMock: vi.fn(async () => undefined),
}));

vi.mock("@sv/services/wallet/walletData.core.js", () => ({
    getWalletOverview: hoisted.getWalletOverviewMock,
    getWalletPortfolio: hoisted.getWalletPortfolioMock,
    getWalletTransfers: hoisted.getWalletTransfersMock,
    getWalletSwaps: hoisted.getWalletSwapsMock,
    getWalletBalanceHistory: hoisted.getWalletBalanceHistoryMock,
    getWalletBalanceHistoryChunk: hoisted.getWalletBalanceHistoryChunkMock,
    getCumulativePnL: hoisted.getCumulativePnLMock,
    getCumulativePnLChunk: hoisted.getCumulativePnLChunkMock,
    resolveWalletTimeRangeSec: hoisted.resolveWalletTimeRangeSecMock,
    clampChartPointsPerChunk: hoisted.clampChartPointsPerChunkMock,
    getWalletTokenBalanceHistory: hoisted.getWalletTokenBalanceHistoryMock,
    getWalletTokenBalanceHistoryChunk: hoisted.getWalletTokenBalanceHistoryChunkMock,
    enrichWithSolanaTokenPrices: hoisted.enrichWithSolanaTokenPricesMock,
}));

import { getWalletOverview } from "../../src/services/wallet/walletOverview.service.js";
import { getWalletPortfolio } from "../../src/services/wallet/walletPortfolio.service.js";
import { getWalletTransfers, getWalletSwaps } from "../../src/services/wallet/walletTransfersSwaps.service.js";
import {
    getWalletTokenBalanceHistory,
} from "../../src/services/wallet/walletTokenBalance.service.js";
import { enrichWithSolanaTokenPrices } from "../../src/services/wallet/walletEnrichment.service.js";

describe("wallet service module boundaries", () => {
    it("forwards overview and portfolio calls to core", async () => {
        await getWalletOverview("wallet-1", { timePeriod: "24H" });
        await getWalletPortfolio("wallet-1");

        expect(hoisted.getWalletOverviewMock).toHaveBeenCalledWith("wallet-1", { timePeriod: "24H" });
        expect(hoisted.getWalletPortfolioMock).toHaveBeenCalledWith("wallet-1");
    });

    it("forwards transfer and swap calls to core", async () => {
        await getWalletTransfers("wallet-1", { limit: 20, cursor: "c1" });
        await getWalletSwaps("wallet-1", { limit: 20, before: "c2" });

        expect(hoisted.getWalletTransfersMock).toHaveBeenCalledWith("wallet-1", { limit: 20, cursor: "c1" });
        expect(hoisted.getWalletSwapsMock).toHaveBeenCalledWith("wallet-1", { limit: 20, before: "c2" });
    });

    // it("forwards charts and range helpers to core", async () => {
    //     await getWalletBalanceHistory("wallet-1", "30D");
    //     await getWalletBalanceHistoryChunk("wallet-1", { timePeriod: "30D", limit: 90 });
    //     await getCumulativePnL("wallet-1", "30D", "daily");
    //     await getCumulativePnLChunk("wallet-1", { timePeriod: "30D", limit: 90, aggregation: "daily" });
    //     resolveWalletTimeRangeSec("30D", 100);
    //     clampChartPointsPerChunk(200);

    //     expect(hoisted.getWalletBalanceHistoryMock).toHaveBeenCalled();
    //     expect(hoisted.getWalletBalanceHistoryChunkMock).toHaveBeenCalled();
    //     expect(hoisted.getCumulativePnLMock).toHaveBeenCalled();
    //     expect(hoisted.getCumulativePnLChunkMock).toHaveBeenCalled();
    //     expect(hoisted.resolveWalletTimeRangeSecMock).toHaveBeenCalledWith("30D", 100);
    //     expect(hoisted.clampChartPointsPerChunkMock).toHaveBeenCalledWith(200);
    // });

    it("forwards token balance and enrichment calls to core", async () => {
        await getWalletTokenBalanceHistory("wallet-1", "SOL");
        // await getWalletTokenBalanceHistoryChunk("wallet-1", "SOL", { timePeriod: "30D", limit: 30 });
        await enrichWithSolanaTokenPrices([]);

        expect(hoisted.getWalletTokenBalanceHistoryMock).toHaveBeenCalled();
        expect(hoisted.enrichWithSolanaTokenPricesMock).toHaveBeenCalledWith([]);
    });
});
