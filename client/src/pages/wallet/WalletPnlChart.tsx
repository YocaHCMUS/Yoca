import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { fetchPnLChart } from "@/services/chart/chartApi";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { BarChart3, Layers, LineChart, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./WalletPnlChart.module.scss";

type PnlPoint = { timestamp: number; value: number };
type PnlPayload = {
  dailyPnL?: PnlPoint[];
  cumulativePnL?: PnlPoint[];
  wallets?: Array<{ walletAddress: string; dailyPnL: PnlPoint[]; cumulativePnL: PnlPoint[] }>;
  error?: unknown;
};
type Mode = "daily" | "cumulative" | "both";

export function WalletPnlChart({
  address,
  onDayClick,
  minHeight = 324,
}: {
  address: string;
  onDayClick?: (walletAddress: string, timestamp: number) => void;
  minHeight?: number;
}) {
  const { tr, fmt } = useLocalization();
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const [period, setPeriod] = useState<"7D" | "30D">("30D");
  const [mode, setMode] = useState<Mode>("both");
  const [data, setData] = useState<PnlPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadId, setReloadId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchPnLChart({ period, wallets: address } as never)
      .then((response) => {
        if (!cancelled) setData(response as unknown as PnlPayload);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, period, reloadId]);

  const seriesData = useMemo(() => {
    const firstWallet = data?.wallets?.[0];
    return {
      daily: firstWallet?.dailyPnL ?? data?.dailyPnL ?? [],
      cumulative: firstWallet?.cumulativePnL ?? data?.cumulativePnL ?? [],
    };
  }, [data]);

  const option = useMemo<EChartsOption>(() => {
    const text = isDark ? "#e7ecf5" : "#172033";
    const muted = isDark ? "#9aa8bd" : "#67748a";
    const grid = isDark ? "rgba(128, 151, 184, 0.16)" : "#e8edf4";
    const tooltipBg = isDark ? "#151e2c" : "#ffffff";
    const gain = isDark ? "#4ed3a8" : "#118563";
    const loss = isDark ? "#ff848d" : "#c9434d";
    const cumulative = isDark ? "#aab5ff" : "#4458d9";
    const daily = seriesData.daily;
    const total = seriesData.cumulative;
    const timestamps = (daily.length ? daily : total).map((point) => point.timestamp);
    const showDaily = mode === "daily" || mode === "both";
    const showCumulative = mode === "cumulative" || mode === "both";

    return {
      animationDuration: 380,
      backgroundColor: "transparent",
      grid: { top: 22, right: mode === "both" ? 28 : 15, bottom: 28, left: 15, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: isDark ? "#34445d" : "#dbe3ee",
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: text, fontSize: 12 },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || !params.length) return "";
          const idx = Number((params[0] as { dataIndex?: number }).dataIndex ?? 0);
          const date = timestamps[idx] ? fmt.datetime.date(timestamps[idx]) : "";
          const dailyValue = daily[idx]?.value;
          const cumulativeValue = total[idx]?.value;
          const rows = [
            `<div style="color:${muted};font-size:11px;margin-bottom:6px">${date}</div>`,
            showDaily && dailyValue != null ? `<div>${tr("charts.pnlChart.dailyPnL")}: <b style="color:${dailyValue >= 0 ? gain : loss}">${fmt.num.compact.currency(dailyValue)}</b></div>` : "",
            showCumulative && cumulativeValue != null ? `<div style="margin-top:4px">${tr("charts.pnlChart.cumulativePnL")}: <b style="color:${cumulative}">${fmt.num.compact.currency(cumulativeValue)}</b></div>` : "",
          ].join("");
          return `<div style="min-width:170px">${rows}</div>`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: mode === "both"
        ? [
            { type: "value", position: "left", axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: muted, fontSize: 10, formatter: (value: number) => fmt.num.compact.currency(value) }, splitLine: { lineStyle: { color: grid, type: "dashed" } } },
            { type: "value", position: "right", axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: muted, fontSize: 10, formatter: (value: number) => fmt.num.compact.currency(value) }, splitLine: { show: false } },
          ]
        : { type: "value", position: "right", axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: muted, fontSize: 10, formatter: (value: number) => fmt.num.compact.currency(value) }, splitLine: { lineStyle: { color: grid, type: "dashed" } } },
      series: [
        ...(showDaily ? [{
          name: tr("charts.pnlChart.dailyPnL"),
          type: "bar" as const,
          yAxisIndex: mode === "both" ? 0 : undefined,
          data: daily.map((point) => [point.timestamp, point.value]),
          barMaxWidth: 18,
          itemStyle: { color: (params: { value?: unknown }) => Number(Array.isArray(params.value) ? params.value[1] : params.value) >= 0 ? gain : loss },
        }] : []),
        ...(showCumulative ? [{
          name: tr("charts.pnlChart.cumulativePnL"),
          type: "line" as const,
          yAxisIndex: mode === "both" ? 1 : undefined,
          data: total.map((point) => [point.timestamp, point.value]),
          showSymbol: false,
          smooth: 0.12,
          lineStyle: { width: 2.2, color: cumulative },
          itemStyle: { color: cumulative },
        }] : []),
      ],
    };
  }, [fmt, isDark, mode, seriesData, tr]);

  const isEmpty = seriesData.daily.length === 0 && seriesData.cumulative.length === 0;
  const modeOptions: Array<{ value: Mode; label: string; icon: typeof BarChart3 }> = [
    { value: "daily", label: tr("charts.pnlChart.dailyPnL"), icon: BarChart3 },
    { value: "cumulative", label: tr("charts.pnlChart.cumulativePnL"), icon: LineChart },
    { value: "both", label: tr("charts.pnlChart.both"), icon: Layers },
  ];

  return (
    <section className={styles.card} style={{ minHeight }} aria-label={tr("walletPage.profitLoss")}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><TrendingUp size={17} strokeWidth={1.75} /></span>
          <div><h2>{tr("walletPage.profitLoss")}</h2><p>{tr("wallet.totalPnL")}</p></div>
        </div>
        <div className={styles.controls}>
          <div className={styles.modeGroup} aria-label={tr("walletPage.profitLoss")}>
            {modeOptions.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" data-active={mode === value} onClick={() => setMode(value)} title={label}><Icon size={14} strokeWidth={1.85} /></button>
            ))}
          </div>
          <div className={styles.segmented}>
            {(["7D", "30D"] as const).map((item) => <button key={item} type="button" data-active={period === item} onClick={() => setPeriod(item)}>{item}</button>)}
          </div>
          <button type="button" className={styles.refreshButton} onClick={() => setReloadId((value) => value + 1)} title={tr("walletPage.ui.refresh")}><RefreshCw size={15} strokeWidth={1.8} /></button>
        </div>
      </header>
      <div className={styles.legend}>
        {(mode === "daily" || mode === "both") && <span><i className={styles.dailyDot} />{tr("charts.pnlChart.dailyPnL")}</span>}
        {(mode === "cumulative" || mode === "both") && <span><i className={styles.cumulativeDot} />{tr("charts.pnlChart.cumulativePnL")}</span>}
      </div>
      <div className={styles.chartArea}>
        {loading ? <div className={styles.loading}>{tr("common.loading")}</div> : error || isEmpty ? <div className={styles.empty}>{error ? tr("common.error") : tr("common.noData")}</div> : <ReactECharts option={option} notMerge lazyUpdate style={{ height: Math.max(minHeight - 112, 220), width: "100%" }} onEvents={{ click: (params: { data?: unknown }) => { const timestamp = Array.isArray(params.data) ? Number(params.data[0]) : NaN; if (Number.isFinite(timestamp)) onDayClick?.(address, timestamp); } }} />}
      </div>
    </section>
  );
}
