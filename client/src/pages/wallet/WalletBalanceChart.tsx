import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { useGet } from "@/hooks/useGet";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { LineChart, RefreshCw, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./WalletBalanceChart.module.scss";

type Point = { timestampMs: number; usdValue: number };
type PortfolioToken = {
  tokenAddress: string;
  symbol: string;
  name?: string;
  logoUri?: string;
  amount: number;
  valueUsd: number;
};

export function WalletBalanceChart({
  address,
  onClickDay,
  minHeight = 324,
}: {
  address: string;
  onClickDay?: (timestamp: number) => void;
  minHeight?: number;
}) {
  const { tr, fmt } = useLocalization();
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const [period, setPeriod] = useState<"7D" | "30D">("7D");
  const [selectedTokenAddress, setSelectedTokenAddress] = useState("");

  const portfolioResponse = useGet(
    client.api.wallets.portfolio,
    200,
    { query: { address } },
    {
      select: (data) =>
        ([...(data as unknown as PortfolioToken[])].sort(
          (left, right) => right.valueUsd - left.valueUsd,
        )),
    },
  );

  const balanceResponse = useGet(
    client.api.charts.balance,
    200,
    { query: { timePeriod: period, wallets: address } },
  );

  const tokenBalanceResponse = useGet(
    client.api.charts.balance.tokens,
    200,
    {
      query: {
        timePeriod: period,
        wallet: address,
        tokens: selectedTokenAddress,
      },
    },
    { enabled: Boolean(selectedTokenAddress) },
  );

  const points = useMemo(() => {
    if (!selectedTokenAddress) {
      const all = balanceResponse.data as unknown as Record<string, Point[]> | undefined;
      return (all?.[address] ?? []).map((item) => ({
        timestamp: item.timestampMs,
        value: item.usdValue,
      }));
    }

    const byToken = tokenBalanceResponse.data as unknown as Record<string, Point[]> | undefined;
    return (byToken?.[selectedTokenAddress] ?? []).map((item) => ({
      timestamp: item.timestampMs,
      value: item.usdValue,
    }));
  }, [address, balanceResponse.data, selectedTokenAddress, tokenBalanceResponse.data]);

  const selectedToken = portfolioResponse.data?.find(
    (token) => token.tokenAddress === selectedTokenAddress,
  );
  const title = selectedToken
    ? `${selectedToken.symbol.toUpperCase()} · ${tr("walletPage.balanceHistory")}`
    : tr("walletPage.balanceHistory");

  const change = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0]?.value ?? 0;
    const last = points[points.length - 1]?.value ?? 0;
    const amount = last - first;
    const percent = first !== 0 ? (amount / first) * 100 : null;
    return { amount, percent };
  }, [points]);

  const option = useMemo<EChartsOption>(() => {
    const text = isDark ? "#e7ecf5" : "#172033";
    const muted = isDark ? "#9aa8bd" : "#67748a";
    const grid = isDark ? "rgba(128, 151, 184, 0.16)" : "#e8edf4";
    const line = isDark ? "#9aa4ff" : "#4458d9";
    const tooltipBg = isDark ? "#151e2c" : "#ffffff";

    return {
      animationDuration: 380,
      backgroundColor: "transparent",
      grid: { top: 24, right: 16, bottom: 28, left: 14, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: tooltipBg,
        borderColor: isDark ? "#34445d" : "#dbe3ee",
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: text, fontSize: 12 },
        valueFormatter: (value) => fmt.num.compact.currency(Number(value)),
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 10, formatter: (value: number) => fmt.num.compact.currency(value) },
        splitLine: { lineStyle: { color: grid, type: "dashed" } },
      },
      series: [
        {
          type: "line",
          name: title,
          data: points.map((point) => [point.timestamp, point.value]),
          smooth: 0.18,
          showSymbol: false,
          lineStyle: { width: 2.2, color: line },
          itemStyle: { color: line },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${line}35` },
                { offset: 1, color: `${line}02` },
              ],
            },
          },
        },
      ],
    };
  }, [fmt.num.compact, isDark, points, title]);

  const loading = !selectedTokenAddress
    ? balanceResponse.isLoading
    : tokenBalanceResponse.isLoading;

  return (
    <section className={styles.card} style={{ minHeight }} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><WalletCards size={17} strokeWidth={1.75} /></span>
          <div>
            <h2>{title}</h2>
            <p>{tr("wallet.totalAssetValue")}</p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.tokenSelect}>
            <span className="sr-only">{tr("walletPage.token")}</span>
            <select value={selectedTokenAddress} onChange={(event) => setSelectedTokenAddress(event.target.value)}>
              <option value="">{tr("walletPage.total")}</option>
              {(portfolioResponse.data ?? []).slice(0, 40).map((token) => (
                <option key={token.tokenAddress} value={token.tokenAddress}>
                  {token.symbol.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.segmented} aria-label={tr("walletPage.balanceHistory")}>
            {(["7D", "30D"] as const).map((item) => (
              <button key={item} type="button" data-active={period === item} onClick={() => setPeriod(item)}>{item}</button>
            ))}
          </div>
          <button type="button" className={styles.refreshButton} onClick={() => { void balanceResponse.mutate(); if (selectedTokenAddress) void tokenBalanceResponse.mutate(); }} title={tr("walletPage.ui.refresh")}>
            <RefreshCw size={15} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className={styles.statRow}>
        <div>
          <span>{tr("walletPage.ui.periodChange")}</span>
          <strong data-positive={(change?.amount ?? 0) >= 0}>{change ? fmt.num.compact.currency(change.amount) : "—"}</strong>
        </div>
        <div>
          <span>{tr("walletPage.change24h")}</span>
          <strong data-positive={(change?.percent ?? 0) >= 0}>{change?.percent != null ? fmt.num.percent(change.percent) : "—"}</strong>
        </div>
      </div>

      <div className={styles.chartArea}>
        {loading ? (
          <div className={styles.loading}><LineChart size={20} strokeWidth={1.55} /><span>{tr("common.loading")}</span></div>
        ) : points.length === 0 ? (
          <div className={styles.empty}>{tr("common.noData")}</div>
        ) : (
          <ReactECharts
            option={option}
            notMerge
            lazyUpdate
            style={{ height: Math.max(minHeight - 134, 220), width: "100%" }}
            onEvents={{
              click: (params: { data?: unknown }) => {
                const timestamp = Array.isArray(params.data) ? Number(params.data[0]) : NaN;
                if (Number.isFinite(timestamp)) onClickDay?.(timestamp);
              },
            }}
          />
        )}
      </div>
    </section>
  );
}
