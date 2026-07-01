import { useLocalization } from "@/contexts/LocalizationContext";
import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { cds } from "@/util/carbon-theme";
import { InlineLoading, Stack } from "@carbon/react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

export interface TimeSeriesDataPoint {
  unixTimeMs: number;
  value: number;
}

export interface MarkLineConfig {
  value: number;
  label: string;
  color?: string;
}

export interface TradePoint {
  unixTimeMs: number;
  side: "buy" | "sell";
  volumeUsd: number;
  price: number | null;
  priceSource: "trade" | "mapped" | "missing";
  transactionHash?: string;
}

export interface TradeAggregationConfig {
  timeBucketMs: number;
}

export interface TimeSeriesTradesScatterChartProps {
  data: TimeSeriesDataPoint[] | undefined;
  trades: TradePoint[];
  markLines?: MarkLineConfig[];
  loading?: boolean;
  isDataSorted?: boolean;
  title?: string;
  height?: number | string;
  className?: string;
  valueFormatter?: (val: number | null) => string;
  aggregation?: TradeAggregationConfig;
}

interface TradeBucket {
  buyCount: number;
  sellCount: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  midpointMs: number;
  matchedPrice: number;
}

interface MarkPointDataItem {
  name: string;
  coord: [number, number];
  value: string;
  itemStyle: { color: string };
  symbol: string;
  symbolSize: number;
  label: { show: false } | {
    show: true;
    formatter: string;
    position: "inside";
    fontSize: number;
    fontWeight: "bold";
    color: string;
  };
}

const DEFAULT_AGGREGATION: TradeAggregationConfig = {
  timeBucketMs: 60 * 60 * 1000,
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeMarketData(
  marketData: TimeSeriesDataPoint[] | undefined,
  isDataSorted: boolean,
): TimeSeriesDataPoint[] {
  if (!marketData || marketData.length === 0) {
    return [];
  }

  if (isDataSorted) {
    return marketData;
  }

  return [...marketData].sort((a, b) => a.unixTimeMs - b.unixTimeMs);
}

export function findNearestMarketPrice(
  marketData: TimeSeriesDataPoint[],
  targetUnixTimeMs: number,
): number | null {
  if (!marketData.length) {
    return null;
  }

  if (targetUnixTimeMs <= marketData[0].unixTimeMs) {
    return marketData[0].value;
  }

  const last = marketData[marketData.length - 1];
  if (targetUnixTimeMs >= last.unixTimeMs) {
    return last.value;
  }

  let left = 0;
  let right = marketData.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTs = marketData[mid].unixTimeMs;

    if (midTs === targetUnixTimeMs) {
      return marketData[mid].value;
    }

    if (midTs < targetUnixTimeMs) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const leftPoint = marketData[left];
  const rightPoint = marketData[right];

  if (!leftPoint) {
    return rightPoint?.value ?? null;
  }

  if (!rightPoint) {
    return leftPoint.value;
  }

  const leftDistance = Math.abs(leftPoint.unixTimeMs - targetUnixTimeMs);
  const rightDistance = Math.abs(rightPoint.unixTimeMs - targetUnixTimeMs);

  return leftDistance < rightDistance ? leftPoint.value : rightPoint.value;
}

export function mapTradesWithFallbackPrice(
  trades: TradePoint[],
  marketData: TimeSeriesDataPoint[] | undefined,
  isMarketDataSorted = false,
): TradePoint[] {
  const sortedMarketData = normalizeMarketData(marketData, isMarketDataSorted);

  return trades.map((trade) => {
    const directPrice = toFiniteNumber(trade.price);
    if (directPrice !== null) {
      return {
        ...trade,
        price: directPrice,
        priceSource: "trade",
      };
    }

    const mappedPrice = findNearestMarketPrice(
      sortedMarketData,
      trade.unixTimeMs,
    );

    if (mappedPrice === null) {
      return {
        ...trade,
        price: null,
        priceSource: "missing",
      };
    }

    return {
      ...trade,
      price: mappedPrice,
      priceSource: "mapped",
    };
  });
}

export function buildTradeBuckets(
  trades: TradePoint[],
  marketData: TimeSeriesDataPoint[],
  startTime: number,
  endTime: number,
  bucketSizeMs: number,
): Map<number, TradeBucket> {
  const bucketMap = new Map<number, TradeBucket>();

  for (const t of trades) {
    if (t.unixTimeMs < startTime || t.unixTimeMs > endTime) {
      continue;
    }

    const volumeUsd = toFiniteNumber(t.volumeUsd);
    if (volumeUsd === null || volumeUsd <= 0) {
      continue;
    }

    const bucketIdx = Math.floor((t.unixTimeMs - startTime) / bucketSizeMs);
    const existing = bucketMap.get(bucketIdx);

    if (existing) {
      if (t.side === "buy") {
        existing.buyCount += 1;
        existing.buyVolumeUsd += volumeUsd;
      } else {
        existing.sellCount += 1;
        existing.sellVolumeUsd += volumeUsd;
      }
    } else {
      const bucketStart = startTime + bucketIdx * bucketSizeMs;
      bucketMap.set(bucketIdx, {
        buyCount: t.side === "buy" ? 1 : 0,
        sellCount: t.side === "sell" ? 1 : 0,
        buyVolumeUsd: t.side === "buy" ? volumeUsd : 0,
        sellVolumeUsd: t.side === "sell" ? volumeUsd : 0,
        midpointMs: bucketStart + bucketSizeMs / 2,
        matchedPrice:
          findNearestMarketPrice(marketData, t.unixTimeMs) ?? t.price ?? 0,
      });
    }
  }

  return bucketMap;
}

function buildMarkPointData(
  bucketMap: Map<number, TradeBucket>,
  minPrice: number,
  maxPrice: number,
  buyLabel: string,
  sellLabel: string,
): MarkPointDataItem[] {
  const priceRange = maxPrice - minPrice || 1;
  const offset = priceRange * 0.12;
  const highThreshold = maxPrice - priceRange * 0.2;
  const result: MarkPointDataItem[] = [];

  for (const bucket of bucketMap.values()) {
    const { buyCount, sellCount, midpointMs, matchedPrice } = bucket;
    const isTooHigh = matchedPrice > highThreshold;

    if (buyCount > 0 && sellCount === 0) {
      const y = isTooHigh
        ? matchedPrice - offset * 1.5
        : matchedPrice + offset * 1.5;
      result.push({
        name: buyLabel,
        coord: [midpointMs, y],
        value: String(buyCount),
        itemStyle: { color: "#24a148" },
        symbol: "circle",
        symbolSize: 10,
        label: { show: false },
      });
    } else if (sellCount > 0 && buyCount === 0) {
      const y = isTooHigh
        ? matchedPrice - offset * 1.5
        : matchedPrice + offset * 1.5;
      result.push({
        name: sellLabel,
        coord: [midpointMs, y],
        value: String(sellCount),
        itemStyle: { color: "#da1e28" },
        symbol: "circle",
        symbolSize: 10,
        label: { show: false },
      });
    } else if (buyCount > 0 && sellCount > 0) {
      const buyY = isTooHigh
        ? matchedPrice - offset
        : matchedPrice + offset * 2;
      const sellY = isTooHigh
        ? matchedPrice - offset * 2
        : matchedPrice + offset;
      result.push({
        name: buyLabel,
        coord: [midpointMs, buyY],
        value: String(buyCount),
        itemStyle: { color: "#24a148" },
        symbol: "circle",
        symbolSize: 10,
        label: { show: false },
      });
      result.push({
        name: sellLabel,
        coord: [midpointMs, sellY],
        value: String(sellCount),
        itemStyle: { color: "#da1e28" },
        symbol: "circle",
        symbolSize: 10,
        label: { show: false },
      });
    }
  }

  return result;
}

export function getDefaultAggregationForDayRange(
  days: "7" | "30" | "90",
): TradeAggregationConfig {
  if (days === "7") {
    return { timeBucketMs: 60 * 60 * 1000 };
  }

  if (days === "30") {
    return { timeBucketMs: 4 * 60 * 60 * 1000 };
  }

  return { timeBucketMs: 12 * 60 * 60 * 1000 };
}

export function TimeSeriesTradesScatterChart({
  data,
  trades,
  markLines = [],
  loading = false,
  isDataSorted = false,
  title,
  height = 300,
  className,
  valueFormatter,
  aggregation = DEFAULT_AGGREGATION,
}: TimeSeriesTradesScatterChartProps) {
  const { fmt, tr } = useLocalization();

  const tokens = useCarbonTokens({
    textPrimary: cds.textPrimary,
    textSecondary: cds.textSecondary,
    textHelper: cds.textHelper,
    bgInverse: cds.backgroundInverse,
    textInverse: cds.textInverse,
    success: cds.supportSuccess,
    error: cds.supportError,
    borderSubtle: cds.borderSubtle00,
    interactive: cds.interactive,
    warning: cds.supportWarning,
  });

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [] as [number, number][];
    }

    const sorted = isDataSorted
      ? data
      : [...data].sort((a, b) => a.unixTimeMs - b.unixTimeMs);

    return sorted.map(
      (point) => [point.unixTimeMs, point.value] as [number, number],
    );
  }, [data, isDataSorted]);

  const normalizedMarketData = useMemo(
    () => normalizeMarketData(data, isDataSorted),
    [data, isDataSorted],
  );

  const hasChartContent = chartData.length > 0;

  const option = useMemo((): EChartsOption => {
    if (!hasChartContent) {
      return {};
    }

    const startTime = chartData[0][0];
    const endTime = chartData[chartData.length - 1][0];
    const range = Math.max(1, endTime - startTime);

    const trendColor =
      chartData.length >= 2 &&
      chartData[chartData.length - 1][1] >= chartData[0][1]
        ? tokens.success
        : tokens.error;

    const bucketSizeMs = 24 * 60 * 60 * 1000;
    const bucketMap = buildTradeBuckets(
      trades,
      normalizedMarketData,
      startTime,
      endTime,
      bucketSizeMs,
    );

    const allPrices = chartData.map((d) => d[1]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);

    const markPointData = buildMarkPointData(
      bucketMap,
      minPrice,
      maxPrice,
      tr("walletPage.buy"),
      tr("walletPage.sell"),
    );

    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: "center",
        textStyle: {
          fontSize: 14,
          fontWeight: 600,
          color: tokens.textPrimary,
        },
      },
      grid: { left: 10, right: 10, top: 40, bottom: 30, containLabel: true },
      tooltip: {
        trigger: "item",
        backgroundColor: tokens.bgInverse,
        borderColor: "transparent",
        borderRadius: 4,
        padding: 0,
        textStyle: { color: tokens.textInverse, fontSize: 12 },
        formatter: (params) => {
          if (!params) {
            return "";
          }

          const singleParams = Array.isArray(params) ? params[0] : params;
          const raw = singleParams as unknown as Record<string, unknown>;
          const componentType = raw.componentType as string | undefined;

          if (componentType === "markPoint") {
            const data = raw.data as {
              coord?: [number, number];
              name?: string;
            } | undefined;
            if (!data?.coord) {
              return "";
            }

            const ts = data.coord[0];
            const dateStr =
              range < 86_400_000 * 2
                ? fmt.datetime.datetime(ts)
                : fmt.datetime.date(ts);

            const bucketIdx = Math.floor((ts - startTime) / bucketSizeMs);
            const bucket = bucketMap.get(bucketIdx);

            const isSell = data.name === tr("walletPage.sell");
            const sideLabel = isSell ? tr("walletPage.sell") : tr("walletPage.buy");
            const sideLabelLower = sideLabel.toLowerCase();
            const count = isSell ? bucket?.sellCount : bucket?.buyCount;
            const volume = isSell ? bucket?.sellVolumeUsd : bucket?.buyVolumeUsd;

            let tradeInfo = "";
            if (count && count > 0) {
              tradeInfo = `<div style="font-size:12px;margin-top:4px">${count} ${sideLabelLower}${count > 1 ? "s" : ""}</div><div style="font-size:11px;opacity:0.8;margin-top:2px">${fmt.num.compact.currency(volume ?? 0)}</div>`;
            }

            return `
              <div style="padding:8px 12px">
                <div style="opacity:0.7;font-size:11px;margin-bottom:4px">${dateStr}</div>
                <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;text-transform:uppercase;margin-bottom:4px">
                  ${raw.marker as string ?? ""}${sideLabel}
                </div>
                ${tradeInfo}
              </div>`;
          }

          const data = raw.data as [number, number] | undefined;
          if (!data) {
            return "";
          }

          const ts = data[0];
          const price = data[1];
          const dateStr =
            range < 86_400_000 * 2
              ? fmt.datetime.datetime(ts)
              : fmt.datetime.date(ts);
          const valStr = valueFormatter
            ? valueFormatter(price)
            : fmt.num.compact.currency(price);

          const bucketIdx = Math.floor((ts - startTime) / bucketSizeMs);
          const bucket = bucketMap.get(bucketIdx);

          let tradeInfo = "";
          if (bucket && (bucket.buyCount > 0 || bucket.sellCount > 0)) {
            const parts: string[] = [];
            if (bucket.buyCount > 0) {
              const label = tr("walletPage.buy").toLowerCase();
              parts.push(
                `${bucket.buyCount} ${label}${bucket.buyCount > 1 ? "s" : ""}`,
              );
            }
            if (bucket.sellCount > 0) {
              const label = tr("walletPage.sell").toLowerCase();
              parts.push(
                `${bucket.sellCount} ${label}${bucket.sellCount > 1 ? "s" : ""}`,
              );
            }
            const totalVolume = bucket.buyVolumeUsd + bucket.sellVolumeUsd;
            tradeInfo = `<div style="font-size:11px;margin-top:4px;opacity:0.8">${parts.join(", ")} · ${fmt.num.compact.currency(totalVolume)}</div>`;
          }

          return `
            <div style="padding:8px 12px">
              <div style="opacity:0.7;font-size:11px;margin-bottom:2px">${dateStr}</div>
              <div style="font-size:14px;font-weight:700">${valStr}</div>
              ${tradeInfo}
            </div>`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.textSecondary,
          fontSize: 11,
          hideOverlap: true,
          formatter: (val: number) => {
            if (range > 86_400_000 * 30) {
              return fmt.datetime.date(val);
            }
            if (range < 86_400_000) {
              return fmt.datetime.time(val);
            }
            return fmt.datetime.date(val);
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.textSecondary,
          fontSize: 11,
          formatter: (val: number) => fmt.num.compact.currency(val),
        },
        splitLine: {
          lineStyle: { color: tokens.borderSubtle, type: "dashed" },
        },
        min: (value) => {
          let min = value.min;
          markLines.forEach((markLine) => {
            if (markLine.value < min) {
              min = markLine.value;
            }
          });
          const spread =
            value.max - value.min || Math.max(Math.abs(min) * 0.1, 1);
          return min - spread * 0.15;
        },
        max: (value) => {
          let max = value.max;
          markLines.forEach((markLine) => {
            if (markLine.value > max) {
              max = markLine.value;
            }
          });
          const spread =
            value.max - value.min || Math.max(Math.abs(max) * 0.1, 1);
          return max + spread * 0.15;
        },
      },
      series: [
        {
          type: "line",
          data: chartData,
          showSymbol: false,
          smooth: 0.1,
          lineStyle: { width: 2, color: trendColor },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: trendColor },
                { offset: 1, color: "transparent" },
              ],
            },
            opacity: 0.12,
          },
          markPoint: {
            data: markPointData,
            symbolOffset: [0, 0],
            label: { show: true },
          },
          markLine: {
            precision: 8,
            lineStyle: {
              width: 1,
              opacity: 0.8,
            },
            data: markLines.map((markLine) => ({
              name: markLine.label,
              yAxis: markLine.value,
              lineStyle: { color: markLine.color || tokens.interactive },
              label: {
                formatter: () =>
                  `${markLine.label}: ${valueFormatter ? valueFormatter(markLine.value) : markLine.value}`,
                position:
                  markLines.length === 2
                    ? markLine.value >
                      (markLines[0] === markLine
                        ? markLines[1].value
                        : markLines[0].value)
                      ? "insideEndTop"
                      : "insideEndBottom"
                    : "insideEndBottom",
                backgroundColor: markLine.color,
                padding: [4, 4],
              },
            })),
          },
          z: 1,
        },
      ],
    };
  }, [
    chartData,
    trades,
    normalizedMarketData,
    aggregation,
    tokens,
    fmt,
    tr,
    valueFormatter,
    title,
    markLines,
    hasChartContent,
  ]);

  if (loading) {
    return (
      <Stack style={{ height, alignItems: "center", justifyContent: "center" }}>
        <InlineLoading description={tr("common.loading")} />
      </Stack>
    );
  }

  if (!hasChartContent) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokens.textHelper,
        }}
      >
        {tr("common.noData")}
      </div>
    );
  }

  return (
    <div className={className}>
      <ReactECharts
        option={option}
        style={{ height }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
