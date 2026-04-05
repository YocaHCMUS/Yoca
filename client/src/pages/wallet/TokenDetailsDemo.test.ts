import {
    filterTradesWithinSelectedRange,
} from "./TokenDetailsDemo";
import type { TradePoint } from "@/components/charts/TimeSeriesTradesScatterChart";
import { describe, expect, it } from "vitest";

describe("filterTradesWithinSelectedRange", () => {
    it("keeps only trades inside the selected range", () => {
        const nowMs = 1_700_000_000_000;
        const dayMs = 24 * 60 * 60 * 1000;
        const trades: TradePoint[] = [
            {
                unixTimeMs: nowMs - 6 * dayMs,
                side: "buy",
                volumeUsd: 100,
                price: 10,
                priceSource: "trade",
            },
            {
                unixTimeMs: nowMs - 8 * dayMs,
                side: "buy",
                volumeUsd: 100,
                price: 11,
                priceSource: "trade",
            },
            {
                unixTimeMs: nowMs + dayMs,
                side: "sell",
                volumeUsd: 100,
                price: 12,
                priceSource: "trade",
            },
        ];

        expect(filterTradesWithinSelectedRange(trades, 7, nowMs)).toHaveLength(1);
        expect(filterTradesWithinSelectedRange(trades, 30, nowMs)).toHaveLength(2);
    });
});