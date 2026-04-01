import { beforeEach, describe, expect, it, vi } from "vitest";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const mocks = vi.hoisted(() => ({
    getWalletPortfolioMock: vi.fn(),
    fetchBirdeyePortfolioSnapshotMock: vi.fn(),
    getCachedWalletTokenBalanceHistoryMock: vi.fn(),
    saveWalletTokenBalanceHistoryCacheMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletPortfolio.service.js", () => ({
    getWalletPortfolio: mocks.getWalletPortfolioMock,
}));

vi.mock("@sv/services/wallet/fetchers/walletDataFetcher.service.js", () => ({
    fetchBirdeyePortfolioSnapshot: mocks.fetchBirdeyePortfolioSnapshotMock,
}));

vi.mock("@sv/services/wallet/db/walletTokenBalanceHistoryCache.js", () => ({
    getCachedWalletTokenBalanceHistory: mocks.getCachedWalletTokenBalanceHistoryMock,
    saveWalletTokenBalanceHistoryCache: mocks.saveWalletTokenBalanceHistoryCacheMock,
}));

import { getWalletTokenBalanceHistory } from "../../src/services/wallet/walletTokenBalance.service.ts";

function toUtcDayStartMs(timestampMs: number): number {
    const d = new Date(timestampMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

describe("walletTokenBalance.service", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-22T15:04:05.000Z"));

        mocks.getWalletPortfolioMock.mockReset();
        mocks.fetchBirdeyePortfolioSnapshotMock.mockReset();
        mocks.getCachedWalletTokenBalanceHistoryMock.mockReset();
        mocks.saveWalletTokenBalanceHistoryCacheMock.mockReset();

        mocks.getWalletPortfolioMock.mockResolvedValue([
            {
                tokenAddress: SOL_MINT,
                symbol: "SOL",
            },
        ]);
        mocks.getCachedWalletTokenBalanceHistoryMock.mockResolvedValue(null);
        mocks.saveWalletTokenBalanceHistoryCacheMock.mockResolvedValue(undefined);

        mocks.fetchBirdeyePortfolioSnapshotMock.mockResolvedValue({
            address: "wallet-1",
            currency: "usd",
            netWorthUsd: 0,
            requestedTimestamp: new Date(Date.now()).toISOString(),
            resolvedTimestamp: new Date(Date.now()).toISOString(),
            assets: [
                {
                    symbol: "SOL",
                    tokenAddress: SOL_MINT,
                    decimals: 9,
                    balanceRaw: "5000000000",
                    priceUsd: 20,
                    valueUsd: 100,
                },
            ],
        });
    });

    it("returns exactly 31 points with 30 UTC day-start historical points and one live point", async () => {
        const nowMs = Date.now();
        const todayStartMs = toUtcDayStartMs(nowMs);

        const result = await getWalletTokenBalanceHistory("wallet-31", "SOL");

        expect(result.tokenSeries).toHaveLength(31);
        expect(result.usdSeries).toHaveLength(31);

        for (let i = 0; i < 30; i++) {
            const expectedTs = todayStartMs - (30 - i) * 24 * 60 * 60 * 1000;
            expect(result.tokenSeries[i].timestamp).toBe(expectedTs);
            expect(result.usdSeries[i].timestamp).toBe(expectedTs);
        }

        expect(result.tokenSeries[30].timestamp).toBe(nowMs);
        expect(result.usdSeries[30].timestamp).toBe(nowMs);

        for (let i = 1; i < 31; i++) {
            expect(result.tokenSeries[i].timestamp).toBeGreaterThan(result.tokenSeries[i - 1].timestamp);
            expect(result.usdSeries[i].timestamp).toBeGreaterThan(result.usdSeries[i - 1].timestamp);
        }
    });

    it("uses DB cache for historical points and memory cache for live point within TTL", async () => {
        const nowMs = Date.now();
        const todayStartMs = toUtcDayStartMs(nowMs);
        const historicalTokenSeries = Array.from({ length: 30 }, (_, idx) => {
            const timestamp = todayStartMs - (30 - idx) * 24 * 60 * 60 * 1000;
            return {
                timestamp,
                value: 1,
                date: new Date(timestamp).toISOString(),
            };
        });
        const historicalUsdSeries = historicalTokenSeries.map((point) => ({
            ...point,
            value: 2,
        }));

        mocks.getCachedWalletTokenBalanceHistoryMock.mockResolvedValue({
            tokenSymbol: "SOL",
            tokenSeries: historicalTokenSeries,
            usdSeries: historicalUsdSeries,
            coveredFromMs: historicalTokenSeries[0].timestamp,
            coveredToMs: historicalTokenSeries[29].timestamp,
        });

        await getWalletTokenBalanceHistory("wallet-cache", "SOL");
        await getWalletTokenBalanceHistory("wallet-cache", "SOL");

        expect(mocks.fetchBirdeyePortfolioSnapshotMock).toHaveBeenCalledTimes(1);
        expect(mocks.saveWalletTokenBalanceHistoryCacheMock).toHaveBeenCalled();

        const savePayload = mocks.saveWalletTokenBalanceHistoryCacheMock.mock.calls[0][0];
        expect(savePayload.tokenSeries).toHaveLength(30);
        expect(savePayload.usdSeries).toHaveLength(30);
        expect(savePayload.coveredToMs).toBe(todayStartMs - 24 * 60 * 60 * 1000);
    });
});
