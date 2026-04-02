import {
    aggregateTradesForScatter,
    findNearestMarketPrice,
    mapTradesWithFallbackPrice,
    type TimeSeriesDataPoint,
    type TradePoint,
} from "./index";
import { describe, expect, it } from "vitest";

describe("aggregateTradesForScatter", () => {
    it("merges same side in same bucket", () => {
        const trades: TradePoint[] = [
            {
                unixTimeMs: 1_000,
                side: "buy",
                volumeUsd: 100,
                price: 10,
                priceSource: "trade",
            },
            {
                unixTimeMs: 2_000,
                side: "buy",
                volumeUsd: 300,
                price: 14,
                priceSource: "trade",
            },
        ];

        const result = aggregateTradesForScatter(trades, { timeBucketMs: 10_000 });

        expect(result).toHaveLength(1);
        expect(result[0].tradeCount).toBe(2);
        expect(result[0].volumeUsd).toBe(400);
        expect(result[0].price).toBeCloseTo(13, 6);
    });

    it("does not merge buy and sell in same bucket", () => {
        const trades: TradePoint[] = [
            {
                unixTimeMs: 1_000,
                side: "buy",
                volumeUsd: 100,
                price: 10,
                priceSource: "trade",
            },
            {
                unixTimeMs: 2_000,
                side: "sell",
                volumeUsd: 100,
                price: 10,
                priceSource: "trade",
            },
        ];

        const result = aggregateTradesForScatter(trades, { timeBucketMs: 10_000 });

        expect(result).toHaveLength(2);
        expect(result.map((item) => item.side).sort()).toEqual(["buy", "sell"]);
    });

    it("excludes invalid volume or missing price entries", () => {
        const trades: TradePoint[] = [
            {
                unixTimeMs: 1_000,
                side: "buy",
                volumeUsd: 0,
                price: 10,
                priceSource: "trade",
            },
            {
                unixTimeMs: 2_000,
                side: "buy",
                volumeUsd: 100,
                price: null,
                priceSource: "missing",
            },
            {
                unixTimeMs: 3_000,
                side: "buy",
                volumeUsd: 200,
                price: 12,
                priceSource: "trade",
            },
        ];

        const result = aggregateTradesForScatter(trades, { timeBucketMs: 10_000 });
        expect(result).toHaveLength(1);
        expect(result[0].volumeUsd).toBe(200);
        expect(result[0].price).toBe(12);
    });
});

describe("findNearestMarketPrice", () => {
    const marketData: TimeSeriesDataPoint[] = [
        { unixTimeMs: 1_000, value: 10 },
        { unixTimeMs: 2_000, value: 20 },
        { unixTimeMs: 4_000, value: 40 },
    ];

    it("picks nearest timestamp value", () => {
        expect(findNearestMarketPrice(marketData, 2_400)).toBe(20);
        expect(findNearestMarketPrice(marketData, 3_600)).toBe(40);
    });

    it("handles before first and after last", () => {
        expect(findNearestMarketPrice(marketData, 200)).toBe(10);
        expect(findNearestMarketPrice(marketData, 9_000)).toBe(40);
    });
});

describe("mapTradesWithFallbackPrice", () => {
    it("marks missing direct prices as mapped when market data exists", () => {
        const trades: TradePoint[] = [
            {
                unixTimeMs: 2_200,
                side: "buy",
                volumeUsd: 50,
                price: null,
                priceSource: "missing",
            },
        ];

        const mapped = mapTradesWithFallbackPrice(trades, [
            { unixTimeMs: 2_000, value: 20 },
            { unixTimeMs: 3_000, value: 30 },
        ]);

        expect(mapped[0].price).toBe(20);
        expect(mapped[0].priceSource).toBe("mapped");
    });

    it("keeps missing when market data is unavailable", () => {
        const trades: TradePoint[] = [
            {
                unixTimeMs: 2_200,
                side: "buy",
                volumeUsd: 50,
                price: null,
                priceSource: "missing",
            },
        ];

        const mapped = mapTradesWithFallbackPrice(trades, []);

        expect(mapped[0].price).toBeNull();
        expect(mapped[0].priceSource).toBe("missing");
    });
});
