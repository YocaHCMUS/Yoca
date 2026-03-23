import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getBirdeyePortfolioSnapshotCachedMock: vi.fn(),
    getDailySnapshotSecRangeMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletTokenBalance.service.js", () => ({
    getBirdeyePortfolioSnapshotCached: mocks.getBirdeyePortfolioSnapshotCachedMock,
}));

vi.mock("@sv/services/wallet/walletData.core.js", () => ({
    getDailySnapshotSecRange: mocks.getDailySnapshotSecRangeMock,
    getAggregationIntervalMs: vi.fn(() => 86400000),
    getRangeStartMs: vi.fn((nowMs: number) => nowMs - 30 * 24 * 60 * 60 * 1000),
    resolvePnLAggregationByGap: vi.fn((agg: string) => agg),
    toIsoFromSec: vi.fn((sec: number) => new Date(sec * 1000).toISOString()),
    isSolSymbol: vi.fn((sym: string) => sym === "SOL"),
    normalizeMint: vi.fn((mint: string) => mint),
}));

// vi.mock("@sv/util/concurrency.js", () => ({
//     mapWithConcurrency: async (items: unknown[], _concurrency: number, fn: Function) => {
//         return Promise.all(items.map(fn));
//     },
// }));

// Import after mocking dependencies
// import { getCumulativePnL } from "@sv/services/wallet/walletCharts.service.js";

// describe("walletCharts.snapshot - Cumulative PnL", () => {
//     const testAddress = "test-wallet-address";

//     beforeEach(() => {
//         vi.clearAllMocks();

//         // Setup default mocks for testing
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([
//             Math.floor(Date.now() / 1000) - 86400,
//             Math.floor(Date.now() / 1000),
//         ]);
//     });

//     it("returns empty PnL when no snapshots available", async () => {
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([]);
//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockResolvedValue({
//             assets: [],
//         });

//         const result = await getCumulativePnL(testAddress, "30D");

//         expect(result.dailyPnL).toEqual([]);
//         expect(result.cumulativePnL).toEqual([]);
//         expect(result.startBalance).toBe(0);
//         expect(result.endBalance).toBe(0);
//     });

//     it("calculates basic portfolio value from single snapshot", async () => {
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([
//             Math.floor(Date.now() / 1000),
//         ]);

//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockResolvedValue({
//             assets: [
//                 { valueUsd: "1000" },
//             ],
//         });

//         const result = await getCumulativePnL(testAddress, "7D");

//         expect(result.startBalance).toBe(1000);
//         expect(result.endBalance).toBe(1000);
//         expect(result.cumulativePnL.length).toBeGreaterThan(0);
//         expect(result.dailyPnL.length).toBeGreaterThan(0);
//     });

//     it("sums multiple assets correctly", async () => {
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([
//             Math.floor(Date.now() / 1000),
//         ]);

//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockResolvedValue({
//             assets: [
//                 { valueUsd: "1000" },
//                 { valueUsd: "500" },
//                 { valueUsd: "250" },
//             ],
//         });

//         const result = await getCumulativePnL(testAddress, "7D");

//         expect(result.startBalance).toBe(1750);
//         expect(result.endBalance).toBe(1750);
//     });

//     it("returns empty PnL on error", async () => {
//         const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockRejectedValue(
//             new Error("API Error")
//         );

//         const result = await getCumulativePnL(testAddress, "30D");

//         expect(result.dailyPnL).toEqual([]);
//         expect(result.cumulativePnL).toEqual([]);
//         expect(result.startBalance).toBe(0);
//         expect(result.endBalance).toBe(0);
//         expect(consoleSpy).toHaveBeenCalled();

//         consoleSpy.mockRestore();
//     });

//     it("calculates daily PnL deltas correctly", async () => {
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([
//             Math.floor(Date.now() / 1000) - 86400,
//             Math.floor(Date.now() / 1000),
//         ]);

//         let callCount = 0;
//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockImplementation(async () => {
//             callCount++;
//             const usdValue = callCount === 1 ? "1000" : "1100";
//             return { assets: [{ valueUsd: usdValue }] };
//         });

//         const result = await getCumulativePnL(testAddress, "7D");

//         expect(result.startBalance).toBe(1000);
//         expect(result.endBalance).toBe(1100);

//         // First day delta should be 0
//         if (result.dailyPnL.length > 0) {
//             expect(result.dailyPnL[0]?.value).toBe(0);
//         }
//         // Second day delta should be +100
//         if (result.dailyPnL.length > 1) {
//             expect(result.dailyPnL[1]?.value).toBe(100);
//         }
//     });

//     it("handles empty portfolio snapshots", async () => {
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([
//             Math.floor(Date.now() / 1000),
//         ]);

//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockResolvedValue({
//             assets: [],
//         });

//         const result = await getCumulativePnL(testAddress, "7D");

//         expect(result.startBalance).toBe(0);
//         expect(result.endBalance).toBe(0);
//         expect(result.cumulativePnL.length).toBeGreaterThan(0);
//     });

//     it("accumulates cumulative PnL correctly", async () => {
//         mocks.getDailySnapshotSecRangeMock.mockReturnValue([
//             Math.floor(Date.now() / 1000) - 172800,
//             Math.floor(Date.now() / 1000) - 86400,
//             Math.floor(Date.now() / 1000),
//         ]);

//         let callCount = 0;
//         mocks.getBirdeyePortfolioSnapshotCachedMock.mockImplementation(async () => {
//             callCount++;
//             const values = ["1000", "1100", "1150"];
//             return { assets: [{ valueUsd: values[callCount - 1] || "0" }] };
//         });

//         const result = await getCumulativePnL(testAddress, "7D");

//         expect(result.startBalance).toBe(1000);
//         expect(result.endBalance).toBe(1150);

//         // Cumulative should be 0, 100, 150
//         if (result.cumulativePnL.length >= 3) {
//             expect(result.cumulativePnL[0]?.value).toBe(0);
//             expect(result.cumulativePnL[1]?.value).toBe(100);
//             expect(result.cumulativePnL[2]?.value).toBe(150);
//         }
//     });
// });

