import client from "@/api/main";
import { FilterSwitch } from "@/components/FilterSwitch";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type { InferResponseType } from "hono/client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TokenOverviewChart.module.scss";

type ChartMode = "price" | "marketcap";
type TimeRange = { label: string; days: number };

type ChartPoint = InferResponseType<
  (typeof client.api.tokens.markets.chart)[":address"]["$get"],
  200
>[number];

interface TokenOverviewChartProps {
  address: string;
  symbol: string;
  onPriceChangeUpdate?: (data: {
    percentage: number | null;
    label: string;
  }) => void;
}

export function TokenOverviewChart({
  address,
  symbol,
  onPriceChangeUpdate,
}: TokenOverviewChartProps) {
  const { tr, fmt, lang } = useLocalization();
  const dateLocale = lang === "vi" ? "vi-VN" : "en-US";
  const TIME_RANGES: TimeRange[] = useMemo(
    () => [
      { label: tr("wallet.filter24h"), days: 1 },
      { label: tr("wallet.filter7d"), days: 7 },
      { label: tr("wallet.filter30d"), days: 30 },
      { label: tr("wallet.filter90d"), days: 90 },
      { label: tr("wallet.filter365d"), days: 365 },
    ],
    [tr],
  );

  const [mode, setMode] = useState<ChartMode>("price");
  const [range, setRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [prices, setPrices] = useState<[number, number][]>([]);
  const [marketCaps, setMarketCaps] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!address) return;
      // Clear old data immediately so old range % doesn't persist while loading new range
      setPrices([]);
      setMarketCaps([]);
      setLoading(true);
      try {
        const response =
          range.days === 1
            ? await client.api.tokens.markets.chart[":address"].$get({
                param: { address },
              })
            : range.days <= 90
              ? await client.api.tokens.markets.chart[":address"].hourly.$get({
                  param: { address },
                  query: { days: String(range.days) },
                })
              : await client.api.tokens.markets.chart[":address"].daily.$get({
                  param: { address },
                  query: { days: String(range.days) },
                });

        if (response.status === 200) {
          const data: ChartPoint[] = await response.json();
          const pricesData: [number, number][] = [];
          const marketCapsData: [number, number][] = [];

          data.forEach((point) => {
            pricesData.push([point.unixTimestampMs, point.price]);
            marketCapsData.push([point.unixTimestampMs, point.marketCap]);
          });

          setPrices(pricesData);
          setMarketCaps(marketCapsData);
        } else {
          setPrices([]);
          setMarketCaps([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [address, range]);

  const seriesData = mode === "price" ? prices : marketCaps;

  const isPositive = useMemo(() => {
    if (seriesData.length < 2) return true;
    return seriesData[seriesData.length - 1][1] >= seriesData[0][1];
  }, [seriesData]);

  useEffect(() => {
    if (!onPriceChangeUpdate) return;
    if (prices.length < 2) {
      onPriceChangeUpdate({ percentage: null, label: range.label });
      return;
    }
    const startPrice = prices[0][1];
    const endPrice = prices[prices.length - 1][1];
    let percentage = null;
    if (startPrice > 0) {
      percentage = ((endPrice - startPrice) / startPrice) * 100;
    }
    onPriceChangeUpdate({ percentage, label: range.label });
  }, [prices, range.label, onPriceChangeUpdate]);

  const color = isPositive ? "#16a34a" : "#dc2626";
  const areaColor = isPositive
    ? ["rgba(22,163,74,0.25)", "rgba(22,163,74,0.02)"]
    : ["rgba(220,38,38,0.25)", "rgba(220,38,38,0.02)"];

  const option: EChartsOption = useMemo(() => {
    if (seriesData.length === 0) return {};

    const isShortRange = range.days === 1 || range.days === 7;

    return {
      animation: false,
      grid: { left: 20, right: 20, top: 20, bottom: 28, containLabel: true },
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
            ? d.toLocaleString(dateLocale, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : d.toLocaleDateString(dateLocale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
          return `<div style="padding:6px 10px">
                        <div style="color:#aaa;margin-bottom:3px;font-size:12px">${dateStr}</div>
                        <div style="font-size:16px;font-weight:700">${fmt.num.compact.currency(val)}</div>
                    </div>`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#888",
          fontSize: 12,
          formatter: (val: number) => {
            const d = new Date(val);
            if (range.days === 1)
              return d.toLocaleTimeString(dateLocale, {
                hour: "2-digit",
                minute: "2-digit",
              });
            return d.toLocaleDateString(dateLocale, {
              month: "short",
              day: "numeric",
            });
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
          fontSize: 12,
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
  }, [seriesData, color, areaColor, range, fmt, dateLocale]);

  return (
    <div className={styles.container}>
      {/* Toggle: Price / Market Cap */}
      <div className={styles.toolbar}>
        <FilterSwitch
          width="lg"
          options={[
            { value: "price", label: tr("token.overviewChart.price") },
            { value: "marketcap", label: tr("token.overviewChart.marketCap") },
          ]}
          value={mode}
          onChange={(v) => setMode(v as ChartMode)}
        />

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
