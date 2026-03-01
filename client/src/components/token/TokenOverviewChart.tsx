import { useLocalization } from "@/contexts/LocalizationContext";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TokenOverviewChart.module.scss";

type ChartMode = "price" | "marketcap";
type TimeRange = { label: string; days: number | "max" };

const TIME_RANGES: TimeRange[] = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "Max", days: "max" },
];

interface TokenOverviewChartProps {
  address: string;
  symbol: string;
}

export function TokenOverviewChart({
  address,
  symbol,
}: TokenOverviewChartProps) {
  const { tr, fmt } = useLocalization();
  const [mode, setMode] = useState<ChartMode>("price");
  const [range, setRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [prices, setPrices] = useState<[number, number][]>([]);
  const [marketCaps, setMarketCaps] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/tokens/markets/chart/${address}/overview?days=${range.days}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.prices) setPrices(data.prices);
        if (data?.marketCaps) setMarketCaps(data.marketCaps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address, range]);

  const seriesData = mode === "price" ? prices : marketCaps;

  const isPositive = useMemo(() => {
    if (seriesData.length < 2) return true;
    return seriesData[seriesData.length - 1][1] >= seriesData[0][1];
  }, [seriesData]);

  const color = isPositive ? "#16a34a" : "#dc2626";
  const areaColor = isPositive
    ? ["rgba(22,163,74,0.25)", "rgba(22,163,74,0.02)"]
    : ["rgba(220,38,38,0.25)", "rgba(220,38,38,0.02)"];

  const option: EChartsOption = useMemo(() => {
    if (seriesData.length === 0) return {};

    const isShortRange = range.days === 1 || range.days === 7;

    return {
      animation: false,
      grid: { left: 8, right: 8, top: 20, bottom: 28, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderColor: "transparent",
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params[0]) return "";
          const [ts, val] = params[0].data as [number, number];
          const d = new Date(ts);
          const dateStr = isShortRange
            ? d.toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : d.toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
          return `<div style="padding:6px 10px">
                        <div style="color:#aaa;margin-bottom:3px;font-size:11px">${dateStr}</div>
                        <div style="font-size:14px;font-weight:700">${fmt.num.compact.currency(val)}</div>
                    </div>`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#888",
          fontSize: 11,
          formatter: (val: number) => {
            const d = new Date(val);
            if (range.days === 1)
              return d.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
            return d.toLocaleDateString([], { month: "short", day: "numeric" });
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
          color: "#888",
          fontSize: 11,
          formatter: (val: number) => fmt.num.compact.currency(val),
        },
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.06)", type: "dashed" },
        },
      },
      series: [
        {
          type: "line",
          data: seriesData,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 1.5, color },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: areaColor[0] },
                { offset: 1, color: areaColor[1] },
              ],
            },
          },
        },
      ],
    };
  }, [seriesData, color, areaColor, range, fmt]);

  return (
    <div className={styles.container}>
      {/* Toggle: Price / Market Cap */}
      <div className={styles.toolbar}>
        <div className={styles.modeToggle}>
          {(["price", "marketcap"] as ChartMode[]).map((m) => (
            <button
              key={m}
              className={`${styles.modeBtn} ${mode === m ? styles.active : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "price"
                ? tr("token.overviewChart.price")
                : tr("token.overviewChart.marketCap")}
            </button>
          ))}
        </div>

        {/* Time range buttons */}
        <div className={styles.rangeButtons}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              className={`${styles.rangeBtn} ${range.label === r.label ? styles.active : ""}`}
              onClick={() => setRange(r)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className={styles.chartWrapper}>
        {loading && seriesData.length === 0 ? (
          <div className={styles.loading}>{tr("common.loading")}</div>
        ) : seriesData.length === 0 ? (
          <div className={styles.empty}>
            {tr("token.overviewChart.noData")}
            {!address ? "" : ` - ${tr("token.overviewChart.noCoingeckoId")}`}
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={option}
            notMerge
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
            showLoading={loading}
            loadingOption={{ color, maskColor: "rgba(0,0,0,0.4)" }}
          />
        )}
      </div>
    </div>
  );
}
