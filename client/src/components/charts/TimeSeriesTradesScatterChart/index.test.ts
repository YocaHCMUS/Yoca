import {
  buildTradeBuckets,
  findNearestMarketPrice,
  mapTradesWithFallbackPrice,
  type TimeSeriesDataPoint,
  type TradePoint,
} from "./index";
import { describe, expect, it } from "vitest";

describe("buildTradeBuckets", () => {
  it("merges same side trades in same bucket", () => {
    const trades: TradePoint[] = [
      { unixTimeMs: 1_000, side: "buy", volumeUsd: 100, price: 10, priceSource: "trade" },
      { unixTimeMs: 2_000, side: "buy", volumeUsd: 300, price: 14, priceSource: "trade" },
    ];
    const marketData: TimeSeriesDataPoint[] = [
      { unixTimeMs: 1_000, value: 10 },
      { unixTimeMs: 2_000, value: 14 },
    ];

    const result = buildTradeBuckets(trades, marketData, 0, 10_000, 10_000);

    expect(result.size).toBe(1);
    const bucket = result.get(0)!;
    expect(bucket.buyCount).toBe(2);
    expect(bucket.buyVolumeUsd).toBe(400);
    expect(bucket.sellCount).toBe(0);
  });

  it("does not merge buy and sell in same bucket", () => {
    const trades: TradePoint[] = [
      { unixTimeMs: 1_000, side: "buy", volumeUsd: 100, price: 10, priceSource: "trade" },
      { unixTimeMs: 2_000, side: "sell", volumeUsd: 100, price: 10, priceSource: "trade" },
    ];
    const marketData: TimeSeriesDataPoint[] = [
      { unixTimeMs: 1_000, value: 10 },
    ];

    const result = buildTradeBuckets(trades, marketData, 0, 10_000, 10_000);

    expect(result.size).toBe(1);
    const bucket = result.get(0)!;
    expect(bucket.buyCount).toBe(1);
    expect(bucket.sellCount).toBe(1);
  });

  it("excludes zero-volume trades", () => {
    const trades: TradePoint[] = [
      { unixTimeMs: 1_000, side: "buy", volumeUsd: 0, price: 10, priceSource: "trade" },
      { unixTimeMs: 3_000, side: "buy", volumeUsd: 200, price: 12, priceSource: "trade" },
    ];
    const marketData: TimeSeriesDataPoint[] = [
      { unixTimeMs: 3_000, value: 12 },
    ];

    const result = buildTradeBuckets(trades, marketData, 0, 10_000, 10_000);

    expect(result.size).toBe(1);
    const bucket = result.get(0)!;
    expect(bucket.buyVolumeUsd).toBe(200);
  });

  it("filters trades outside time range", () => {
    const trades: TradePoint[] = [
      { unixTimeMs: 1_000, side: "buy", volumeUsd: 100, price: 10, priceSource: "trade" },
      { unixTimeMs: 20_000, side: "buy", volumeUsd: 200, price: 20, priceSource: "trade" },
    ];
    const marketData: TimeSeriesDataPoint[] = [];

    const result = buildTradeBuckets(trades, marketData, 0, 10_000, 10_000);

    expect(result.size).toBe(1);
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
