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
  priceBucketPercent?: number;
}

export interface TradeBubbleSizeScale {
  minPx: number;
  maxPx: number;
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
  sizeScale?: TradeBubbleSizeScale;
}

type AggregatedTradePoint = {
  side: "buy" | "sell";
  unixTimeMs: number;
  price: number;
  volumeUsd: number;
  tradeCount: number;
  mappedCount: number;
  tradePriceCount: number;
};

const DEFAULT_AGGREGATION: TradeAggregationConfig = {
  timeBucketMs: 60 * 60 * 1000,
};

const DEFAULT_SIZE_SCALE: TradeBubbleSizeScale = {
  minPx: 8,
  maxPx: 28,
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

function getRepresentativePriceStep(
  prices: number[],
  priceBucketPercent?: number,
): number | null {
  if (!priceBucketPercent || priceBucketPercent <= 0 || prices.length === 0) {
    return null;
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
  const step = Math.abs(median) * (priceBucketPercent / 100);
  if (!Number.isFinite(step) || step <= 0) {
    return null;
  }
  return step;
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

export function aggregateTradesForScatter(
  trades: TradePoint[],
  aggregation: TradeAggregationConfig = DEFAULT_AGGREGATION,
): AggregatedTradePoint[] {
  const timeBucketMs = Math.max(1, Math.floor(aggregation.timeBucketMs));

  const validTrades = trades.filter((trade) => {
    const volumeUsd = toFiniteNumber(trade.volumeUsd);
    const price = toFiniteNumber(trade.price);

    return (
      (trade.side === "buy" || trade.side === "sell") &&
      Number.isFinite(trade.unixTimeMs) &&
      volumeUsd !== null &&
      volumeUsd > 0 &&
      price !== null
    );
  });

  const priceStep = getRepresentativePriceStep(
    validTrades.map((trade) => trade.price as number),
    aggregation.priceBucketPercent,
  );

  const grouped = new Map<
    string,
    {
      side: "buy" | "sell";
      volumeUsd: number;
      weightedPrice: number;
      weightedTime: number;
      tradeCount: number;
      mappedCount: number;
      tradePriceCount: number;
    }
  >();

  for (const trade of validTrades) {
    const volumeUsd = trade.volumeUsd as number;
    const price = trade.price as number;

    const timeKey = Math.floor(trade.unixTimeMs / timeBucketMs) * timeBucketMs;

    const priceKey =
      priceStep && priceStep > 0
        ? Math.floor(price / priceStep) * priceStep
        : null;

    const groupKey = `${trade.side}:${timeKey}:${priceKey ?? "none"}`;
    const existing = grouped.get(groupKey);

    if (!existing) {
      grouped.set(groupKey, {
        side: trade.side,
        volumeUsd,
        weightedPrice: price * volumeUsd,
        weightedTime: trade.unixTimeMs * volumeUsd,
        tradeCount: 1,
        mappedCount: trade.priceSource === "mapped" ? 1 : 0,
        tradePriceCount: trade.priceSource === "trade" ? 1 : 0,
      });
      continue;
    }

    existing.volumeUsd += volumeUsd;
    existing.weightedPrice += price * volumeUsd;
    existing.weightedTime += trade.unixTimeMs * volumeUsd;
    existing.tradeCount += 1;
    if (trade.priceSource === "mapped") {
      existing.mappedCount += 1;
    }
    if (trade.priceSource === "trade") {
      existing.tradePriceCount += 1;
    }
  }

  return [...grouped.values()]
    .map((group) => ({
      side: group.side,
      unixTimeMs: Math.round(group.weightedTime / group.volumeUsd),
      price: group.weightedPrice / group.volumeUsd,
      volumeUsd: group.volumeUsd,
      tradeCount: group.tradeCount,
      mappedCount: group.mappedCount,
      tradePriceCount: group.tradePriceCount,
    }))
    .sort((a, b) => a.unixTimeMs - b.unixTimeMs);
}

function createSizeScale(
  points: AggregatedTradePoint[],
  sizeScale: TradeBubbleSizeScale,
): (volumeUsd: number) => number {
  if (points.length === 0) {
    return () => sizeScale.minPx;
  }

  const sqrtVolumes = points
    .map((point) => Math.sqrt(Math.max(point.volumeUsd, 0)))
    .filter((value) => Number.isFinite(value));

  const minVolume = Math.min(...sqrtVolumes);
  const maxVolume = Math.max(...sqrtVolumes);

  if (!Number.isFinite(minVolume) || !Number.isFinite(maxVolume)) {
    return () => sizeScale.minPx;
  }

  if (minVolume === maxVolume) {
    return () => (sizeScale.minPx + sizeScale.maxPx) / 2;
  }

  return (volumeUsd) => {
    const sqrtVolume = Math.sqrt(Math.max(volumeUsd, 0));
    const normalized = (sqrtVolume - minVolume) / (maxVolume - minVolume);
    return sizeScale.minPx + normalized * (sizeScale.maxPx - sizeScale.minPx);
  };
}

export function getDefaultAggregationForDayRange(
  days: 7 | 30 | 90,
): TradeAggregationConfig {
  if (days === 7) {
    return { timeBucketMs: 60 * 60 * 1000 };
  }

  if (days === 30) {
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
  sizeScale = DEFAULT_SIZE_SCALE,
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

  const aggregatedTrades = useMemo(
    () => aggregateTradesForScatter(trades, aggregation),
    [trades, aggregation],
  );

  const buyTrades = useMemo(
    () => aggregatedTrades.filter((trade) => trade.side === "buy"),
    [aggregatedTrades],
  );

  const sellTrades = useMemo(
    () => aggregatedTrades.filter((trade) => trade.side === "sell"),
    [aggregatedTrades],
  );

  const sizeFn = useMemo(
    () => createSizeScale(aggregatedTrades, sizeScale),
    [aggregatedTrades, sizeScale],
  );

  const hasChartContent = chartData.length > 0 || aggregatedTrades.length > 0;

  const option = useMemo((): EChartsOption => {
    if (!hasChartContent) {
      return {};
    }

    const startTimeCandidates = [
      chartData[0]?.[0],
      aggregatedTrades[0]?.unixTimeMs,
    ].filter((value): value is number => Number.isFinite(value));

    const endTimeCandidates = [
      chartData[chartData.length - 1]?.[0],
      aggregatedTrades[aggregatedTrades.length - 1]?.unixTimeMs,
    ].filter((value): value is number => Number.isFinite(value));

    const startTime = startTimeCandidates.length
      ? Math.min(...startTimeCandidates)
      : Date.now();

    const endTime = endTimeCandidates.length
      ? Math.max(...endTimeCandidates)
      : startTime;
    const range = Math.max(1, endTime - startTime);

    const trendColor =
      chartData.length >= 2 &&
      chartData[chartData.length - 1][1] >= chartData[0][1]
        ? tokens.success
        : tokens.error;

    const toScatterRow = (point: AggregatedTradePoint) => ({
      value: [point.unixTimeMs, point.price, point.volumeUsd],
      side: point.side,
      tradeCount: point.tradeCount,
      mappedCount: point.mappedCount,
      tradePriceCount: point.tradePriceCount,
      volumeUsd: point.volumeUsd,
    });

    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: "center",
        textStyle: { fontSize: 14, fontWeight: 600, color: tokens.textPrimary },
      },
      grid: { left: 10, right: 10, top: 40, bottom: 30, containLabel: true },
      tooltip: {
        trigger: "item",
        backgroundColor: tokens.bgInverse,
        borderColor: "transparent",
        borderRadius: 4,
        padding: 0,
        textStyle: { color: tokens.textInverse, fontSize: 12 },
        formatter: (rawParams) => {
          const singleParams = Array.isArray(rawParams)
            ? rawParams[0]
            : rawParams;

          if (!singleParams) {
            return "";
          }

          const params = singleParams as unknown as {
            seriesType: string;
            marker: string;
            data: {
              value: [number, number, number];
              side?: "buy" | "sell";
              tradeCount?: number;
              mappedCount?: number;
              tradePriceCount?: number;
              volumeUsd?: number;
            };
            value: [number, number];
          };

          if (params.seriesType === "line") {
            const [ts, val] = params.value;
            const dateStr =
              range < 86_400_000 * 2
                ? fmt.datetime.datetime(ts)
                : fmt.datetime.date(ts);
            const valStr = valueFormatter
              ? valueFormatter(val)
              : fmt.num.compact.currency(val);

            return `
              <div style="padding:8px 12px; border-radius:4px; background:${tokens.bgInverse}">
                <div style="color:${tokens.textInverse}; opacity:0.7; margin-bottom:4px; font-size:11px">${dateStr}</div>
                <div style="font-size:14px; font-weight:700; color:${tokens.textInverse}">${valStr}</div>
              </div>`;
          }

          const [ts, price] = params.data.value;
          const dateStr = fmt.datetime.datetime(ts);
          const side =
            params.data.side === "buy"
              ? tr("walletPage.buy")
              : tr("walletPage.sell");
          const tradeCount = params.data.tradeCount ?? 1;
          const mappedCount = params.data.mappedCount ?? 0;
          const tradePriceCount = params.data.tradePriceCount ?? 0;
          const priceSourceSummary =
            mappedCount > 0 && tradePriceCount > 0
              ? `${tradePriceCount} trade, ${mappedCount} mapped`
              : mappedCount > 0
                ? "mapped"
                : "trade";

          return `
            <div style="padding:8px 12px; border-radius:4px; background:${tokens.bgInverse}">
              <div style="color:${tokens.textInverse}; opacity:0.7; margin-bottom:4px; font-size:11px">${dateStr}</div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; color:${tokens.textInverse}; font-size:13px; font-weight:600; text-transform:uppercase;">
                ${params.marker}${side}
              </div>
              <div style="color:${tokens.textInverse}; font-size:12px; margin-bottom:2px;">${tr("walletPage.price")}: ${valueFormatter ? valueFormatter(price) : fmt.num.compact.currency(price)}</div>
              <div style="color:${tokens.textInverse}; font-size:12px; margin-bottom:2px;">Volume: ${fmt.num.compact.currency(params.data.volumeUsd ?? 0)}</div>
              <div style="color:${tokens.textInverse}; font-size:12px; margin-bottom:2px;">Trades: ${tradeCount}</div>
              <div style="color:${tokens.textInverse}; opacity:0.8; font-size:11px;">Price source: ${priceSourceSummary}</div>
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
        {
          type: "scatter",
          name: "buy",
          data: buyTrades.map(toScatterRow),
          symbolSize: (value) => sizeFn(value[2]),
          itemStyle: {
            color: tokens.success,
            opacity: 0.75,
          },
          emphasis: {
            scale: true,
          },
          z: 3,
        },
        {
          type: "scatter",
          name: "sell",
          data: sellTrades.map(toScatterRow),
          symbolSize: (value) => sizeFn(value[2]),
          itemStyle: {
            color: tokens.error,
            opacity: 0.75,
          },
          emphasis: {
            scale: true,
          },
          z: 3,
        },
      ],
    };
  }, [
    aggregatedTrades,
    buyTrades,
    chartData,
    fmt,
    hasChartContent,
    markLines,
    sellTrades,
    sizeFn,
    title,
    tokens,
    tr,
    valueFormatter,
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
