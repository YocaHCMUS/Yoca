import { useLocalization } from "@/contexts/LocalizationContext";
import { fetchTokenPriceChartForDay, type TokenPriceChartPoint } from "@/services/wallet/walletApi";
import { useCarbonChartBaseOption, CHART_COLOR_PALETTE } from "@/util/carbon-chart-base";
import { Close } from "@carbon/icons-react";
import { InlineLoading } from "@carbon/react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./TokenPriceChart.module.scss";

export interface TradeIndicator {
  timestampMs: number;
  type: "buy" | "sell";
  price: number;
  amount: number;
  symbol: string;
}

interface AggregatedTradeBucket {
  buyCount: number;
  sellCount: number;
  buyTotalAmount: number;
  sellTotalAmount: number;
  midpointMs: number;
  matchedPrice: number;
}

interface TokenPriceChartProps {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogoUri: string | null;
  dayMs: number;
  trades: TradeIndicator[];
  onRemove: () => void;
}

function formatUtcTime(val: number): string {
  const d = new Date(val);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function TokenPriceChart({
  tokenAddress,
  tokenSymbol,
  tokenLogoUri,
  dayMs,
  trades,
  onRemove,
}: TokenPriceChartProps) {
  const { fmt, tr } = useLocalization();
  const baseOption = useCarbonChartBaseOption();

  const [priceData, setPriceData] = useState<TokenPriceChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTokenPriceChartForDay(tokenAddress, dayMs)
      .then((res) => {
        if (!cancelled) {
          setPriceData(res.items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load price data");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, dayMs]);

  const chartOption = useMemo((): EChartsOption => {
    if (priceData.length === 0) return {};

    const sorted = [...priceData].sort((a, b) => a.timestampMs - b.timestampMs);
    const chartData = sorted.map((p) => [p.timestampMs, p.price]);

    const startTime = chartData[0][0] as number;
    const endTime = chartData[chartData.length - 1][0] as number;

    const allPrices = chartData.map((d) => d[1] as number);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    const color = CHART_COLOR_PALETTE[0];

    function findClosestPrice(timestampMs: number): number {
      let closest = sorted[0];
      let minDiff = Math.abs(sorted[0].timestampMs - timestampMs);
      for (let i = 1; i < sorted.length; i++) {
        const diff = Math.abs(sorted[i].timestampMs - timestampMs);
        if (diff < minDiff) {
          minDiff = diff;
          closest = sorted[i];
        }
      }
      return closest.price;
    }

    const bucketSizeMs = 15 * 60 * 1000;
    const bucketMap = new Map<number, AggregatedTradeBucket>();

    for (const t of trades) {
      if (t.timestampMs < startTime || t.timestampMs > endTime) continue;
      const bucketIdx = Math.floor((t.timestampMs - startTime) / bucketSizeMs);
      const existing = bucketMap.get(bucketIdx);
      if (existing) {
        if (t.type === "buy") {
          existing.buyCount += 1;
          existing.buyTotalAmount += t.amount;
        } else {
          existing.sellCount += 1;
          existing.sellTotalAmount += t.amount;
        }
      } else {
        const bucketStart = startTime + bucketIdx * bucketSizeMs;
        bucketMap.set(bucketIdx, {
          buyCount: t.type === "buy" ? 1 : 0,
          sellCount: t.type === "sell" ? 1 : 0,
          buyTotalAmount: t.type === "buy" ? t.amount : 0,
          sellTotalAmount: t.type === "sell" ? t.amount : 0,
          midpointMs: bucketStart + bucketSizeMs / 2,
          matchedPrice: findClosestPrice(t.timestampMs),
        });
      }
    }

    const offset = priceRange * 0.06;
    const highThreshold = maxPrice - priceRange * 0.2;

    const markPointData: Array<{
      name: string;
      coord: [number, number];
      value: string;
      itemStyle: { color: string };
      symbol: string;
      symbolSize: number;
      label: { show: boolean; formatter: string; position: "inside"; fontSize: number; fontWeight: "bold"; color: string };
    }> = [];

    for (const bucket of bucketMap.values()) {
      const { buyCount, sellCount, midpointMs, matchedPrice } = bucket;
      const isTooHigh = matchedPrice > highThreshold;

      if (buyCount > 0 && sellCount === 0) {
        const y = isTooHigh ? matchedPrice - offset * 1.5 : matchedPrice + offset * 1.5;
        markPointData.push({
          name: tr("walletPage.buy"),
          coord: [midpointMs, y],
          value: "",
          itemStyle: { color: "#24a148" },
          symbol: "circle",
          symbolSize: 10,
          label: { show: true, formatter: "{c}", position: "inside", fontSize: 9, fontWeight: "bold", color: "#fff" },
        });
      } else if (sellCount > 0 && buyCount === 0) {
        const y = isTooHigh ? matchedPrice - offset * 1.5 : matchedPrice + offset * 1.5;
        markPointData.push({
          name: tr("walletPage.sell"),
          coord: [midpointMs, y],
          value: "",
          itemStyle: { color: "#da1e28" },
          symbol: "circle",
          symbolSize: 10,
          label: { show: true, formatter: "{c}", position: "inside", fontSize: 9, fontWeight: "bold", color: "#fff" },
        });
      } else if (buyCount > 0 && sellCount > 0) {
        const buyY = isTooHigh ? matchedPrice - offset : matchedPrice + offset * 2;
        const sellY = isTooHigh ? matchedPrice - offset * 2 : matchedPrice + offset;
        markPointData.push({
          name: tr("walletPage.buy"),
          coord: [midpointMs, buyY],
          value: String(buyCount),
          itemStyle: { color: "#24a148" },
          symbol: "circle",
          symbolSize: 10,
          label: { show: true, formatter: "{c}", position: "inside", fontSize: 9, fontWeight: "bold", color: "#fff" },
        });
        markPointData.push({
          name: tr("walletPage.sell"),
          coord: [midpointMs, sellY],
          value: String(sellCount),
          itemStyle: { color: "#da1e28" },
          symbol: "circle",
          symbolSize: 10,
          label: { show: true, formatter: "{c}", position: "inside", fontSize: 9, fontWeight: "bold", color: "#fff" },
        });
      }
    }

    return {
      ...baseOption,
      legend: { show: false },
      grid: { left: 8, right: 8, top: 8, bottom: 24 },
      xAxis: {
        ...baseOption.xAxis,
        type: "time",
        boundaryGap: false as never,
        splitNumber: 4,
        axisLabel: {
          ...baseOption.xAxis?.axisLabel,
          formatter: (val: number) => formatUtcTime(val),
          fontSize: 10,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        position: "right" as const,
        axisLabel: {
          ...baseOption.yAxis?.axisLabel,
          formatter: (val: number) => fmt.num.compact.currency(val),
          fontSize: 10,
        },
        min: (v: { min: number; max: number }) => v.min - (v.max - v.min) * 0.15,
        max: (v: { min: number; max: number }) => v.max + (v.max - v.min) * 0.15,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        formatter: (params) => {
          if (!Array.isArray(params) || params.length === 0) return "";

          const ts = (params[0].data as [number, number])[0];
          const price = (params[0].data as [number, number])[1];
          const dateStr = formatUtcTime(ts);

          const bucketIdx = Math.floor((ts - startTime) / bucketSizeMs);
          const bucket = bucketMap.get(bucketIdx);

          let tradeInfo = "";
          if (bucket && (bucket.buyCount > 0 || bucket.sellCount > 0)) {
            const parts: string[] = [];
            if (bucket.buyCount > 0) {
              parts.push(`${bucket.buyCount} ${bucket.buyCount === 1 ? tr("walletPage.buy").toLowerCase() : tr("walletPage.buy").toLowerCase() + "s"}`);
            }
            if (bucket.sellCount > 0) {
              parts.push(`${bucket.sellCount} ${bucket.sellCount === 1 ? tr("walletPage.sell").toLowerCase() : tr("walletPage.sell").toLowerCase() + "s"}`);
            }
            const totalAmount = bucket.buyTotalAmount + bucket.sellTotalAmount;
            tradeInfo = `<div style="font-size:11px;margin-top:4px;">${parts.join(", ")} · ${fmt.num.decimal(totalAmount)} ${trades[0]?.symbol ?? ""}</div>`;
          }

          return `
            <div style="padding:4px 0">
              <div style="opacity:0.7;font-size:11px">${dateStr}</div>
              <div style="font-size:13px"><strong>${fmt.num.currency(price)}</strong></div>
              ${tradeInfo}
            </div>`;
        },
      },
      series: [
        {
          name: tokenSymbol,
          type: "line",
          data: chartData,
          showSymbol: false,
          smooth: false,
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}4D` },
                { offset: 1, color: `${color}0D` },
              ],
            },
          },
          markPoint: {
            data: markPointData,
            symbolOffset: [0, 0],
            label: {
              show: true,
            },
          },
        },
      ],
    };
  }, [priceData, trades, tokenSymbol, fmt, tr, baseOption]);

  if (loading) {
    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.tokenInfo}>
            {tokenLogoUri && (
              <img src={tokenLogoUri} alt={tokenSymbol} className={styles.tokenImg} />
            )}
            <span className={styles.tokenSymbol}>{tokenSymbol}</span>
          </div>
        </div>
        <div className={styles.chartContent}>
          <InlineLoading description={tr("common.loading")} />
        </div>
      </div>
    );
  }

  if (error || priceData.length === 0) {
    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.tokenInfo}>
            {tokenLogoUri && (
              <img src={tokenLogoUri} alt={tokenSymbol} className={styles.tokenImg} />
            )}
            <span className={styles.tokenSymbol}>{tokenSymbol}</span>
          </div>
          <button className={styles.removeBtn} onClick={onRemove} aria-label={tr("common.cancel")}>
            <Close size={16} />
          </button>
        </div>
        <div className={styles.chartContent}>
          <span className={styles.emptyText}>{error ?? tr("common.noData")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.tokenInfo}>
          {tokenLogoUri && (
            <img src={tokenLogoUri} alt={tokenSymbol} className={styles.tokenImg} />
          )}
          <span className={styles.tokenSymbol}>{tokenSymbol}</span>
        </div>
        <button className={styles.removeBtn} onClick={onRemove} aria-label={tr("common.cancel")}>
          <Close size={16} />
        </button>
      </div>
      <div className={styles.chartContent}>
        <ReactECharts
          option={chartOption}
          style={{ height: 180, width: "100%" }}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  );
}
