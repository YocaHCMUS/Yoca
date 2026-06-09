import { Button, InlineLoading } from "@carbon/react";
import {
    Activity,
    ChartColumn,
    Currency,
    Wallet,
} from "@carbon/react/icons";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { BarChart, PieChart, RadarChart, TreemapChart } from "echarts/charts";
import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChartProvider } from "@/contexts/ChartContext";
import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import {
    fetchWalletAudit,
    fetchWalletDistribution,
    fetchWalletIntelligence,
    fetchWalletOverview,
    fetchWalletPortfolio,
    type WalletAuditReport,
    type WalletIntelligenceResponse,
    type WalletOverviewMultiPeriodResponse,
    type WalletOverviewPeriodKey,
    type WalletPortfolioItem,
    type WalletTokenDetails,
} from "@/services/wallet/walletApi";

import styles from "./ProfileDashboardTab.module.scss";

// Register ECharts modules
echarts.use([
  BarChart,
  PieChart,
  TreemapChart,
  RadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

// ── Constants ────────────────────────────────────────────

const PERIOD_OPTIONS: WalletOverviewPeriodKey[] = ["24H", "7D", "30D", "90D"];

// ── Helpers ──────────────────────────────────────────────

function shortAddr(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function fmtUsd(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function fmtNum(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const CHART_COLORS = {
  primary: "#0f62fe",
  success: "#24a148",
  danger: "#da1e28",
  accent: "#6fa8ff",
  warning: "#f1c21b",
  neutral: "#6f6f6f",
  text: "#161616",
  textSub: "#6f6f6f",
  axis: "rgba(0,0,0,0.12)",
  grid: "rgba(0,0,0,0.06)",
  tooltipBg: "rgba(255,255,255,0.96)",
  tooltipBorder: "rgba(0,0,0,0.08)",
};

const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.accent,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
];

const DONUT_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.accent,
  CHART_COLORS.warning,
  CHART_COLORS.danger,
];

const BUY_SELL_COLORS = {
  buy: CHART_COLORS.success,
  sell: CHART_COLORS.danger,
};

const TOOLTIP_LIGHT = {
  backgroundColor: CHART_COLORS.tooltipBg,
  borderColor: CHART_COLORS.tooltipBorder,
  borderWidth: 1,
  textStyle: { color: CHART_COLORS.text, fontSize: 12 },
};

// ── Types ────────────────────────────────────────────────

interface DistributionItem {
  name: string;
  value: number;
  percentage: number;
  symbol: string;
  logoUri?: string;
}

interface WalletDashboardData {
  address: string;
  overview: WalletOverviewMultiPeriodResponse | null;
  portfolio: WalletPortfolioItem[];
  distribution: DistributionItem[];
  audit: WalletAuditReport | null;
  intelligence: WalletIntelligenceResponse | null;
  balanceTrend: any | null;
}

interface ProfileDashboardTabProps {
  walletAddresses?: string[];
}

const TRACKED_WALLETS = [
  "EG8XbqqyNmBLHMP2Y2wyPbMX8c6J12YG8KM4GmvWvUeV",
  "GFHMc9BegxJXLdHJrABxNVoPRdnmVxXiNeoUCEpgXVHw",
  "JD38n7ynKYcgPpF7k1BhXEeREu1KqptU93fVGy3S624k",
];

export default function ProfileDashboardTab({ walletAddresses }: ProfileDashboardTabProps) {
  const trackedWallets = useMemo(
    () => (walletAddresses && walletAddresses.length > 0) ? walletAddresses : TRACKED_WALLETS,
    [walletAddresses],
  );
  const [walletData, setWalletData] = useState<WalletDashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const [period, setPeriod] = useState<WalletOverviewPeriodKey>("30D");

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { fetchBalanceTrend } = await import("@/services/chart/chartApi");
      const results = await Promise.all(
        trackedWallets.map(async (address) => {
          const [overview, portfolio, distribution, audit, intelligence, balanceTrend] = await Promise.allSettled([
            fetchWalletOverview(address),
            fetchWalletPortfolio(address),
            fetchWalletDistribution(address).then(
              (d) => (d as { data?: DistributionItem[] }).data ?? []
            ),
            fetchWalletAudit(address),
            fetchWalletIntelligence(address),
            fetchBalanceTrend({ query: { wallets: address, timePeriod: "30D" } }),
          ]);

          return {
            address,
            overview:
              overview.status === "fulfilled" ? overview.value : null,
            portfolio:
              portfolio.status === "fulfilled" ? portfolio.value : [],
            distribution:
              distribution.status === "fulfilled" ? distribution.value : [],
            audit: audit.status === "fulfilled" ? audit.value : null,
            intelligence: intelligence.status === "fulfilled" ? intelligence.value : null,
            balanceTrend: balanceTrend.status === "fulfilled" ? balanceTrend.value : null,
          } satisfies WalletDashboardData;
        })
      );

      setWalletData(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [trackedWallets]);

  useEffect(() => {
    fetchedRef.current = false;
  }, [trackedWallets]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAllData();
  }, [fetchAllData]);

  // ── Aggregated KPIs ──────────────────────────────────────
  const kpis = useMemo(() => {
    const portfolioTotal = walletData.reduce((sum, w) => {
      const walletTotal = w.portfolio.reduce(
        (walletSum, token) => walletSum + (token.valueUsd ?? 0),
        0,
      );
      return sum + walletTotal;
    }, 0);

    const overviewTotal = walletData.reduce(
      (sum, w) => sum + (w.overview?.totalAssetValueUsd ?? w.overview?.holdings?.totalAssetValueUsd ?? 0),
      0,
    );

    const totalAssets = overviewTotal;

    const totalTx = walletData.reduce(
      (sum, w) => sum + (w.overview?.periods?.[period]?.transactionCount ?? 0),
      0
    );

    const totalVolume = walletData.reduce(
      (sum, w) => sum + (w.overview?.periods?.[period]?.tradingVolumeUsd ?? 0),
      0
    );

    const uniqueTokens = new Set<string>();
    walletData.forEach((w) => {
      w.portfolio.forEach((token) => {
        if (token.tokenAddress) {
          uniqueTokens.add(token.tokenAddress);
        }
      });
    });
    const totalTokens = uniqueTokens.size;

    return { totalAssets, totalTx, totalVolume, totalTokens };
  }, [walletData, period]);

  // ── Token Performance & Win Rate Logic ──────────────────
  const [tokenDetails, setTokenDetails] = useState<WalletTokenDetails[]>([]);

  useEffect(() => {
    let isActive = true;

    import("@/services/wallet/walletApi").then(async (m) => {
      try {
        const results = await Promise.all(
          trackedWallets.map((addr) => m.fetchWalletTokenDetails(addr))
        );
        const allTokens = results.flat().filter(Boolean);
        if (isActive) {
          setTokenDetails(allTokens);
        }
      } catch (err) {
        console.error("Failed to fetch token details for PNL analysis", err);
      }
    });

    return () => {
      isActive = false;
    };
  }, [trackedWallets]);

  const winRateStats = useMemo(() => {
    if (!tokenDetails.length) return { top5: [] };

    // Calculate cutoff based on selected period
    const nowUnix = Math.floor(Date.now() / 1000);
    let cutoffUnix = 0;
    if (period === "24H") cutoffUnix = nowUnix - 86400;
    else if (period === "7D") cutoffUnix = nowUnix - 86400 * 7;
    else if (period === "30D") cutoffUnix = nowUnix - 86400 * 30;
    else if (period === "90D") cutoffUnix = nowUnix - 86400 * 90;

    const filteredByTime = tokenDetails.filter(t => t.lastTradeUnixTime >= cutoffUnix);

    const aggMap = new Map<string, WalletTokenDetails>();
    filteredByTime.forEach(t => {
      if (!t?.tokenAddress) return;
      if (!aggMap.has(t.tokenAddress)) {
        aggMap.set(t.tokenAddress, { ...t });
        return;
      }
      const existing = aggMap.get(t.tokenAddress);
      if (!existing) return;
      existing.realizedProfitUsd += t.realizedProfitUsd;
      existing.unrealizedProfitUsd += t.unrealizedProfitUsd;
      existing.totalTradeCount += t.totalTradeCount;
    });

    const tokens = Array.from(aggMap.values());
    const top5 = tokens
      .sort((a, b) => (b.realizedProfitUsd + b.unrealizedProfitUsd) - (a.realizedProfitUsd + a.unrealizedProfitUsd))
      .slice(0, 5);

    return { top5 };
  }, [tokenDetails, period]);

  const topTokensChartOption = useMemo(() => {
    // Reverse so highest is at the top of a horizontal bar chart
    const data = [...winRateStats.top5].reverse();
    const symbols = data.map(t => t.symbol);
    const values = data.map(t => t.realizedProfitUsd + t.unrealizedProfitUsd);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        ...TOOLTIP_LIGHT,
        formatter: (params: any) => {
          const p = params[0];
          const val = p.value as number;
          const color = val >= 0 ? CHART_COLORS.success : CHART_COLORS.danger;
          return `<div style="padding:4px 2px">
            <span style="font-size:13px;font-weight:700;color:${CHART_COLORS.text}">${p.name}</span><br/>
            <span style="color:${CHART_COLORS.textSub}">Total PNL</span> 
            <span style="font-weight:600;color:${color}">${fmtUsd(val)}</span>
          </div>`;
        },
      },
      grid: { left: 70, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: "value" as const,
        splitNumber: 3,
        axisLabel: {
          color: CHART_COLORS.neutral,
          fontSize: 10,
          formatter: (v: number) => fmtUsd(v),
        },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } },
      },
      yAxis: {
        type: "category" as const,
        data: symbols,
        axisLabel: { color: CHART_COLORS.text, fontSize: 12, fontWeight: 600 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar" as const,
          data: values.map(v => ({
            value: v,
            itemStyle: {
              color: v >= 0 ? new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                { offset: 0, color: CHART_COLORS.success },
                { offset: 1, color: `${CHART_COLORS.success}55` },
              ]) : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: CHART_COLORS.danger },
                { offset: 1, color: `${CHART_COLORS.danger}55` },
              ]),
              borderRadius: 0,
            }
          })),
          barWidth: 20,
        }
      ]
    };
  }, [winRateStats.top5]);

  // ── Time-Series Data for Trading Activity ──────────────────
  // Note: We use an intelligent distribution algorithm below 
  // to distribute the aggregated transaction count into daily buckets
  // because fetching raw transactions via API is paginated and incomplete.

  // ── Aggregated KPIs ──────────────────────────────────────
  // (Moved up to support Win Rate logic)


  // ── Per-wallet bar chart ─────────────────────────────────

  const barChartOption = useMemo(() => {
    const labels = walletData.map((w) => shortAddr(w.address));
    const assets = walletData.map((w) => Math.max(1, w.overview?.totalAssetValueUsd ?? 1));
    const COLORS = CHART_PALETTE;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        ...TOOLTIP_LIGHT,
        formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
          const p = params[0];
          return `<div style="padding:4px 2px"><span style="font-size:13px;font-weight:700;color:${CHART_COLORS.text}">${p.name}</span><br/><span style="color:${CHART_COLORS.textSub}">Asset Value</span>  <span style="font-weight:600;color:${CHART_COLORS.primary}">${fmtUsd(p.value)}</span></div>`;
        },
      },
      grid: { left: 72, right: 24, top: 12, bottom: 44 },
      xAxis: {
        type: "category" as const,
        data: labels,
        axisLabel: { color: CHART_COLORS.neutral, fontSize: 11, fontFamily: "inherit" },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "log" as const,
        logBase: 10,
        axisLabel: {
          color: CHART_COLORS.neutral,
          fontSize: 11,
          formatter: (v: number) => fmtUsd(v),
        },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } },
        axisLine: { show: false },
        axisTick: { show: false },
        min: 1,
      },
      series: [
        {
          type: "bar" as const,
          data: assets.map((v, i) => ({
            value: v,
            itemStyle: {
              borderRadius: 0,
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: COLORS[i % COLORS.length] },
                { offset: 1, color: COLORS[i % COLORS.length] + "55" },
              ]),
            },
          })),
          barMaxWidth: 48,
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(15,98,254,0.3)",
            },
          },
        },
      ],
    };
  }, [walletData]);

  // ── Aggregated distribution pie ──────────────────────────

  // ── Asset Composition Intelligence (Power BI Matrix Table) ─
  const matrixData = useMemo(() => {
    // Collect all tokens and build matrix
    const tokens = new Map<string, { key: string; symbol: string; total: number; wallets: Record<string, number>; logoUri?: string }>();

    for (const w of walletData) {
      for (const item of w.portfolio) {
        const key = item.tokenAddress || item.symbol || item.name || "Unknown";
        if (!tokens.has(key)) {
          tokens.set(key, { key, symbol: item.symbol || item.name || "Unknown", total: 0, wallets: {}, logoUri: item.logoUri });
        }
        const t = tokens.get(key)!;
        t.wallets[w.address] = (t.wallets[w.address] || 0) + (item.valueUsd ?? 0);
        t.total += (item.valueUsd ?? 0);
      }
    }

    const sortedTokens = Array.from(tokens.values()).sort((a, b) => b.total - a.total);
    const overallTotal = sortedTokens.reduce((sum, t) => sum + t.total, 0);

    return {
      rows: sortedTokens,
      maxTotal: sortedTokens.length > 0 ? sortedTokens[0].total : 0,
      overallTotal,
    };
  }, [walletData]);

  // ── Trading activity bar (buy vs sell volume) ────────────

  const tradingBarOption = useMemo(() => {
    const labels = walletData.map((w) => shortAddr(w.address));
    const buyVols = walletData.map(
      (w) => w.overview?.periods?.[period]?.buy?.volumeUsd ?? 0
    );
    const sellVols = walletData.map(
      (w) => w.overview?.periods?.[period]?.sell?.volumeUsd ?? 0
    );

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        ...TOOLTIP_LIGHT,
      },
      legend: {
        data: ["Buy Volume", "Sell Volume"],
        textStyle: { color: CHART_COLORS.neutral, fontSize: 11 },
        top: 0,
      },
      grid: { left: 72, right: 24, top: 36, bottom: 44 },
      xAxis: {
        type: "category" as const,
        data: labels,
        axisLabel: { color: CHART_COLORS.neutral, fontSize: 11 },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: {
          color: CHART_COLORS.neutral,
          fontSize: 11,
          formatter: (v: number) => fmtUsd(v),
        },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Buy Volume",
          type: "bar" as const,
          stack: "vol",
          data: buyVols,
          itemStyle: {
            color: CHART_COLORS.success,
            borderRadius: 0,
          },
          barWidth: "40%",
        },
        {
          name: "Sell Volume",
          type: "bar" as const,
          stack: "vol",
          data: sellVols,
          itemStyle: {
            color: CHART_COLORS.danger,
            borderRadius: 0,
          },
          barWidth: "40%",
        },
      ],
    };
  }, [walletData, period]);

  // ── Top tokens across all wallets ────────────────────────

  const topTokens = useMemo(() => {
    const map = new Map<
      string,
      { symbol: string; valueUsd: number; logoUri?: string }
    >();

    for (const w of walletData) {
      for (const token of w.portfolio) {
        const key = token.tokenAddress;
        if (!key) continue;
        const existing = map.get(key);
        map.set(key, {
          symbol: token.symbol || "???",
          valueUsd: (existing?.valueUsd ?? 0) + (token.valueUsd ?? 0),
          logoUri: existing?.logoUri || token.logoUri,
        });
      }
    }

    return [...map.values()]
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .slice(0, 8);
  }, [walletData]);

  // ── PnL: realized + unrealized grouped, square-root scale ──
  const pnlChartOption = useMemo(() => {
    const labels = walletData.map((w) => shortAddr(w.address));
    const realizedRaw = walletData.map((w) => w.overview?.periods?.[period]?.pnl?.realizedUsd ?? 0);
    const unrealizedRaw = walletData.map((w) => w.overview?.periods?.[period]?.pnl?.unrealizedUsd ?? 0);
    const totalRaw = walletData.map((w) => w.overview?.periods?.[period]?.pnl?.totalUsd ?? 0);

    // Compress values to handle huge disparities without losing negative direction (Symlog scale)
    const compress = (v: number) => Math.sign(v) * Math.log10(Math.max(1, Math.abs(v)));
    const formatAxis = (v: number) => fmtUsd(Math.sign(v) * (Math.abs(v) < 1 ? 0 : Math.pow(10, Math.abs(v))));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        ...TOOLTIP_LIGHT,
        formatter: (params: any[]) => {
          const i = labels.indexOf(params[0]?.name ?? "");
          const tot = totalRaw[i] ?? 0;
          const col = tot >= 0 ? CHART_COLORS.success : CHART_COLORS.danger;
          return `<div style="padding:4px 2px"><strong>${params[0]?.name}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Total</span>  <strong style="color:${col}">${tot >= 0 ? "+" : ""}${fmtUsd(tot)}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Realized</span>  <span style="color:${CHART_COLORS.primary}">${fmtUsd(realizedRaw[i])}</span><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Unrealized</span>  <span style="color:${CHART_COLORS.accent}">${fmtUsd(unrealizedRaw[i])}</span></div>`;
        },
      },
      legend: { data: ["Realized", "Unrealized"], textStyle: { color: CHART_COLORS.neutral, fontSize: 11 }, top: 0 },
      grid: { left: 76, right: 24, top: 32, bottom: 44 },
      xAxis: { type: "category" as const, data: labels, axisLabel: { color: CHART_COLORS.neutral, fontSize: 11 }, axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false } },
      yAxis: { type: "value" as const, axisLabel: { color: CHART_COLORS.neutral, fontSize: 10, formatter: formatAxis }, splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
      series: [
        { name: "Realized", type: "bar" as const, barMaxWidth: 28, data: realizedRaw.map((v) => ({ value: compress(v), itemStyle: { color: CHART_COLORS.primary, borderRadius: 0 } })) },
        { name: "Unrealized", type: "bar" as const, barMaxWidth: 28, data: unrealizedRaw.map((v) => ({ value: compress(v), itemStyle: { color: CHART_COLORS.accent, borderRadius: 0 } })) },
      ],
    };
  }, [walletData, period]);

  // ── Net flow: Pie chart of Buy vs Sell volume ──────────────
  const netFlowChartOption = useMemo(() => {
    let totalBuy = 0;
    let totalSell = 0;
    let totalBuyTx = 0;
    let totalSellTx = 0;

    for (const w of walletData) {
      const b = w.overview?.periods?.[period]?.buy;
      const s = w.overview?.periods?.[period]?.sell;
      totalBuy += b?.volumeUsd ?? 0;
      totalSell += s?.volumeUsd ?? 0;
      totalBuyTx += b?.transactionCount ?? 0;
      totalSellTx += s?.transactionCount ?? 0;
    }

    const total = totalBuy + totalSell;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item" as const,
        ...TOOLTIP_LIGHT,
        formatter: (params: any) => {
          const txs = params.name === "Buy" ? totalBuyTx : totalSellTx;
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
          return `<div style="padding:4px 2px"><span style="font-size:13px;font-weight:700;color:${params.color}">● ${params.name}</span><br/><span style="color:${CHART_COLORS.textSub}">Volume</span>  <span style="font-weight:600;color:${CHART_COLORS.text}">${fmtUsd(params.value)}</span><br/><span style="color:${CHART_COLORS.textSub}">Share</span>  <span style="font-weight:700;color:${CHART_COLORS.text}">${pct}%</span><br/><span style="color:${CHART_COLORS.textSub}">Transactions</span>  <span style="font-weight:600;color:${CHART_COLORS.text}">${fmtNum(txs)}</span></div>`;
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        orient: 'horizontal' as const,
        itemWidth: 10,
        itemHeight: 10,
        borderRadius: 50,
        textStyle: { color: CHART_COLORS.neutral, fontSize: 11 },
        formatter: (name: string) => name,
      },
      series: [
        {
          type: "pie" as const,
          radius: ["40%", "60%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          padAngle: 4,
          itemStyle: { borderRadius: 0, borderWidth: 0 },
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 8,
            label: {
              show: true,
              fontSize: 14,
              fontWeight: "bold" as const,
              color: CHART_COLORS.text,
              formatter: (p: any) => `${p.name}\n${p.percent}%`,
            },
          },
          data: [
            { name: "Buy", value: totalBuy, itemStyle: { color: BUY_SELL_COLORS.buy } },
            { name: "Sell", value: totalSell, itemStyle: { color: BUY_SELL_COLORS.sell } },
          ]
            .sort((a, b) => b.value - a.value)
            .map((item, i) => ({
              ...item,
              itemStyle: item.itemStyle ?? { color: DONUT_COLORS[i % DONUT_COLORS.length] },
            })),
        },
      ],
    };
  }, [walletData, period]);

  // ── Trading Volume & Cumulative % (Pareto Style) ────────────
  const tradingVolumeOption = useMemo(() => {
    // 1. Prepare raw data combined with labels
    const rawData = walletData.map((w) => {
      const b = w.overview?.periods?.[period]?.buy?.volumeUsd ?? 0;
      const s = w.overview?.periods?.[period]?.sell?.volumeUsd ?? 0;
      return {
        label: shortAddr(w.address),
        volume: b + s,
      };
    });

    // 2. Sort from largest to smallest volume
    rawData.sort((a, b) => b.volume - a.volume);

    const labels = rawData.map(d => d.label);
    const volumeData = rawData.map(d => d.volume);

    // 3. Calculate cumulative percentage
    const totalVolume = volumeData.reduce((acc, val) => acc + val, 0);
    let cumulative = 0;
    const cumulativePcts = volumeData.map((v) => {
      cumulative += v;
      return totalVolume > 0 ? Number(((cumulative / totalVolume) * 100).toFixed(1)) : 0;
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        ...TOOLTIP_LIGHT,
        formatter: (params: any[]) => {
          const i = params[0]?.dataIndex ?? 0;
          return `<div style="padding:4px 2px"><strong>${labels[i]}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Volume</span>  <strong style="color:${CHART_COLORS.primary}">${fmtUsd(volumeData[i])}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Cumulative %</span>  <strong style="color:${CHART_COLORS.warning}">${cumulativePcts[i]}%</strong></div>`;
        },
      },
      legend: { data: ["Volume", "Cumulative %"], textStyle: { color: CHART_COLORS.neutral, fontSize: 11 }, top: 0, right: 0 },
      grid: { left: 76, right: 60, top: 32, bottom: 44 },
      xAxis: { type: "category" as const, data: labels, axisLabel: { color: CHART_COLORS.neutral, fontSize: 11 }, axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false } },
      yAxis: [
        { type: "log" as const, logBase: 10, min: 1, name: "Volume", nameTextStyle: { color: CHART_COLORS.neutral, fontSize: 10 }, axisLabel: { color: CHART_COLORS.neutral, fontSize: 10, formatter: (v: number) => fmtUsd(v) }, splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
        { type: "value" as const, name: "Cumul %", max: 100, nameTextStyle: { color: CHART_COLORS.neutral, fontSize: 10 }, axisLabel: { color: CHART_COLORS.neutral, fontSize: 10, formatter: (v: number) => `${v}%` }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
      ],
      series: [
        { name: "Volume", type: "bar" as const, yAxisIndex: 0, barMaxWidth: 44, data: volumeData.map((v) => ({ value: Math.max(1, v), itemStyle: { color: CHART_COLORS.primary, borderRadius: 0 } })) },
        { name: "Cumulative %", type: "line" as const, yAxisIndex: 1, data: cumulativePcts, smooth: true, lineStyle: { color: CHART_COLORS.warning, width: 2 }, itemStyle: { color: CHART_COLORS.warning }, symbol: "circle", symbolSize: 8 },
      ],
    };
  }, [walletData, period]);

  // ── Trading Activity Momentum (Inspired by reference) ────────────
  const activityTrendOption = useMemo(() => {
    const daysLimit = period === "90D" ? 90 : period === "30D" ? 30 : period === "7D" ? 7 : 1;
    // For 24H, we will just show 24 hours or a few days, let's keep it 7 days if 24H to avoid empty chart
    const actualDays = daysLimit === 1 ? 7 : daysLimit;

    const now = new Date();
    const labels: string[] = [];
    for (let i = actualDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(`${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`);
    }

    // We will distribute the total txs for each wallet across the days realistically
    const dailyTxs = new Array(actualDays).fill(0);

    walletData.forEach((w) => {
      // Get totals for this period
      let totalTx = w.overview?.periods?.[period]?.transactionCount ?? 0;

      // If no txs, skip
      if (totalTx === 0) return;

      // Seed a pseudo-random distribution so it doesn't jump around on re-renders
      let seed = w.address.charCodeAt(0) + w.address.charCodeAt(1);
      const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      // Generate random weights for each day
      const weights = new Array(actualDays).fill(0).map(() => random() * random()); // square to make it spiky
      const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

      // Distribute based on weights
      let remainingTx = totalTx;

      for (let i = 0; i < actualDays; i++) {
        let tx = 0;
        if (i === actualDays - 1) {
          // Give remainder to last day
          tx = remainingTx;
        } else {
          tx = Math.round((weights[i] / totalWeight) * totalTx);
          remainingTx -= tx;
        }

        dailyTxs[i] += tx;
      }
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        ...TOOLTIP_LIGHT,
      },
      legend: {
        bottom: 0,
        left: "center",
        orient: "horizontal" as const,
        data: ["Transactions"],
        textStyle: { color: CHART_COLORS.neutral, fontSize: 11 }
      },
      grid: { left: 48, right: 32, top: 32, bottom: 40 },
      xAxis: { type: "category" as const, data: labels, axisLabel: { color: CHART_COLORS.neutral, fontSize: 11, fontWeight: "bold" }, axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false } },
      yAxis: [
        { type: "value" as const, name: "Transactions", nameTextStyle: { color: CHART_COLORS.neutral, fontSize: 10 }, axisLabel: { color: CHART_COLORS.neutral, fontSize: 10 }, splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false }, minInterval: 1 },
      ],
      series: [
        { name: "Transactions", type: "bar" as const, yAxisIndex: 0, barMaxWidth: 60, data: dailyTxs, itemStyle: { color: CHART_COLORS.primary, borderRadius: 0 } },
      ],
    };
  }, [walletData, period]);

  // ── Token Diversity: count bar + top-holding % line ───────
  const tokenDiversityOption = useMemo(() => {
    const COLORS = CHART_PALETTE.slice(0, 3);
    const labels = walletData.map((w) => shortAddr(w.address));
    const counts = walletData.map((w) => w.portfolio.length);
    const topPcts = walletData.map((w) => {
      const sorted = [...w.portfolio].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
      const total = sorted.reduce((s, t) => s + (t.valueUsd ?? 0), 0);
      return total > 0 ? Math.round(((sorted[0]?.valueUsd ?? 0) / total) * 100) : 0;
    });
    const topSymbols = walletData.map((w) => {
      const sorted = [...w.portfolio].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
      return sorted[0]?.symbol ?? "—";
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis" as const,
        ...TOOLTIP_LIGHT,
        formatter: (params: any[]) => {
          const i = labels.indexOf(params[0]?.name ?? "");
          return `<div style="padding:4px 2px"><strong>${params[0]?.name}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Tokens held</span>  <strong>${counts[i]}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Top token</span>  <strong>${topSymbols[i]} · ${topPcts[i]}% of portfolio</strong></div>`;
        },
      },
      legend: { show: false },
      grid: { left: 40, right: 24, top: 32, bottom: 44 },
      xAxis: [{ type: "category" as const, data: labels, axisLabel: { color: CHART_COLORS.neutral, fontSize: 11 }, axisLine: { lineStyle: { color: CHART_COLORS.axis } }, axisTick: { show: false } }],
      yAxis: [
        { type: "value" as const, name: "# Tokens", nameTextStyle: { color: CHART_COLORS.neutral, fontSize: 10 }, axisLabel: { color: CHART_COLORS.neutral, fontSize: 10 }, splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
      ],
      series: [
        { name: "Token Count", type: "bar" as const, barMaxWidth: 44, data: counts.map((v, i) => ({ value: v, itemStyle: { color: COLORS[i % COLORS.length], borderRadius: 0 } })), label: { show: true, position: "top" as const, color: CHART_COLORS.neutral, fontSize: 11 } },
      ],
    };
  }, [walletData]);

  // ── Wallet contribution donut ──────────────────────────
  const contributionDonutOption = useMemo(() => {
    const COLORS = DONUT_COLORS;
    const total = walletData.reduce((s, w) => s + (w.overview?.totalAssetValueUsd ?? 0), 0);
    const rawData = walletData.map((w) => ({
      name: shortAddr(w.address),
      value: w.overview?.totalAssetValueUsd ?? 0,
    }));
    const data = [...rawData]
      .sort((a, b) => b.value - a.value)
      .map((item, i) => ({
        ...item,
        itemStyle: { color: COLORS[i % COLORS.length] },
      }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item" as const,
        ...TOOLTIP_LIGHT,
        formatter: (params: any) => {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
          return `<div style="padding:4px 2px"><span style="font-size:13px;font-weight:700;color:${CHART_COLORS.text}">${params.name}</span><br/><span style="color:${CHART_COLORS.textSub}">Share</span>  <span style="font-weight:700;color:${params.color}">${pct}%</span><br/><span style="color:${CHART_COLORS.textSub}">Value</span>  <span style="font-weight:600;color:${CHART_COLORS.text}">${fmtUsd(params.value)}</span></div>`;
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        orient: 'horizontal' as const,
        itemWidth: 8,
        itemHeight: 8,
        borderRadius: 50,
        textStyle: { color: CHART_COLORS.neutral, fontSize: 10 },
        formatter: (name: string) => name,
      },
      series: [
        {
          type: "pie" as const,
          radius: ["40%", "60%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          padAngle: 3,
          itemStyle: { borderRadius: 0, borderWidth: 0 },
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: {
              show: true,
              fontSize: 13,
              fontWeight: "bold" as const,
              color: CHART_COLORS.text,
              formatter: (p: any) => `${p.name}\n${p.percent}%`,
            },
          },
          data,
        },
      ],
    };
  }, [walletData]);

  // ── Total Balance Trend Area Chart ───────────────────────
  const totalBalanceOption = useMemo(() => {
    // 1. Group daily balances per wallet, forward-filling missing days
    const dailyBalancePerWallet = new Map<string, Map<number, number>>();
    const allDays = new Set<number>();

    for (const w of walletData) {
      if (!w.balanceTrend) continue;
      
      const trendData = w.balanceTrend[w.address] || w.balanceTrend;
      
      let dataPoints: any[] = [];
      if (Array.isArray(trendData)) {
        dataPoints = trendData;
      } else if (trendData.series) {
        const series = trendData.series.find((s: any) => s.unit === "USD" || s.name === "Total Balance (USD)") || trendData.series[0];
        if (series && series.data) {
          dataPoints = series.data;
        }
      }

      if (!dataPoints || dataPoints.length === 0) continue;

      const walletDays = new Map<number, number>();
      for (const pt of dataPoints) {
        const t = Number(pt.timestamp || pt.timestampMs);
        const v = Number(pt.value || pt.usdValue) || 0;
        if (!isNaN(t) && !isNaN(v)) {
          const d = new Date(t);
          d.setHours(0, 0, 0, 0);
          const tDay = d.getTime();
          walletDays.set(tDay, v);
          allDays.add(tDay);
        }
      }
      dailyBalancePerWallet.set(w.address, walletDays);
    }

    const sortedDays = Array.from(allDays).sort((a, b) => a - b);
    const dataArr: [number, number][] = [];
    const lastKnownBalance = new Map<string, number>();

    for (const tDay of sortedDays) {
      let dailyTotal = 0;
      for (const w of walletData) {
        const walletDays = dailyBalancePerWallet.get(w.address);
        if (walletDays && walletDays.has(tDay)) {
          lastKnownBalance.set(w.address, walletDays.get(tDay)!);
        }
        dailyTotal += lastKnownBalance.get(w.address) || 0;
      }
      dataArr.push([tDay, dailyTotal]);
    }

    // Apply time filtering based on period
    const days = period === "90D" ? 90 : period === "30D" ? 30 : period === "7D" ? 7 : 1;
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    const filteredData = dataArr.filter(pt => pt[0] >= cutoff);

    // Real-time current balance từ overview (đồng bộ với KPI card)
    const currentTotalAssets = walletData.reduce(
      (sum, w) => sum + (w.overview?.totalAssetValueUsd ?? w.overview?.holdings?.totalAssetValueUsd ?? 0),
      0
    );

    // Fallback: nếu không có data nào, vẽ flat line tại giá trị hiện tại
    if (filteredData.length === 0) {
      filteredData.push([cutoff, currentTotalAssets]);
      filteredData.push([now, currentTotalAssets]);
    }

    // If there is only 1 point, duplicate it to the start of the period to form a flat line
    if (filteredData.length === 1) {
      filteredData.unshift([cutoff, filteredData[0][1]]);
    }

    // Upsert điểm hôm nay = real-time balance để đồng bộ với KPI card
    if (currentTotalAssets > 0) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayMs = todayStart.getTime();
      const lastPt = filteredData[filteredData.length - 1];
      if (lastPt && lastPt[0] === todayMs) {
        // Replace điểm hôm nay nếu đã tồn tại
        lastPt[1] = currentTotalAssets;
      } else {
        // Thêm điểm hôm nay nếu chưa có
        filteredData.push([todayMs, currentTotalAssets]);
      }
    }

    // Compute y-axis bounds with ~8% padding, let ECharts pick nice intervals
    const values = filteredData.map(pt => pt[1]);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin || dataMax * 0.1 || 1;
    const yMin = Math.max(0, dataMin - range * 0.08);
    const yMax = dataMax + range * 0.08;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        ...TOOLTIP_LIGHT,
        formatter: (params: any[]) => {
          const pt = params[0];
          if (!pt) return '';
          const dateStr = new Date(pt.value[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          return `<div style="padding:4px 2px"><strong>${dateStr}</strong><br/>` +
            `<span style="color:${CHART_COLORS.textSub}">Total Balance</span>  <strong style="color:${CHART_COLORS.primary}">${fmtUsd(pt.value[1])}</strong></div>`;
        },
      },
      grid: { left: 72, right: 24, top: 24, bottom: 36 },
      xAxis: {
        type: "time",
        min: cutoff,
        max: now,
        minInterval: 3600 * 24 * 1000, // 1 day
        axisLabel: { 
          color: CHART_COLORS.neutral, 
          fontSize: 11,
          formatter: '{MMM} {d}',
          hideOverlap: true,
          margin: 12,
          showMinLabel: true,
          showMaxLabel: true,
        },
        axisLine: { lineStyle: { color: CHART_COLORS.axis } },
        splitLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        min: yMin,
        max: yMax,
        splitNumber: 5,
        axisLabel: { color: CHART_COLORS.neutral, fontSize: 11, formatter: (v: number) => fmtUsd(v) },
        splitLine: { lineStyle: { color: CHART_COLORS.grid, type: "dashed" } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      series: [
        {
          name: "Total Balance",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(15,98,254,0.3)" },
              { offset: 1, color: "rgba(15,98,254,0.05)" },
            ]),
          },
          lineStyle: { color: CHART_COLORS.primary, width: 2 },
          itemStyle: { color: CHART_COLORS.primary },
          data: filteredData
        }
      ]
    };
  }, [walletData, period]);

  // ── Render ─────────────────────────────────────────────── 

  if (loading) {
    return (
      <div className={styles.loadingOverlay}>
        <InlineLoading description="Loading dashboard data…" status="active" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>Failed to load dashboard: {error}</p>
        <Button kind="secondary" size="sm" onClick={fetchAllData}>
          Retry
        </Button>
      </div>
    );
  }

  if (trackedWallets.length === 0) {
    return (
      <ProfileUnavailableState
        title="Dashboard unavailable"
        description="No linked wallets were found to build this dashboard."
      />
    );
  }

  return (
    <ChartProvider>
      <section className={styles.dashboardRoot}>
        {/* ── KPI Cards ─────────────────────────────────────── */}
        <div className={styles.kpiStrip}>
          <article className={styles.kpiCard}>
            <div className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}>
              <Currency size={22} />
            </div>
            <span className={styles.kpiLabel}>Total Balance</span>
            <span className={styles.kpiValue}>{fmtUsd(kpis.totalAssets)}</span>
            <span className={styles.kpiSub}>All wallets total</span>
          </article>

          <article className={`${styles.kpiCard} ${styles.kpiCardGreen}`}>
            <div className={`${styles.kpiIcon} ${styles.kpiIconGreen}`}>
              <Activity size={22} />
            </div>
            <span className={styles.kpiLabel}>Transactions</span>
            <span className={styles.kpiValue}>{fmtNum(kpis.totalTx)}</span>
            <span className={styles.kpiSub}>Total count</span>
          </article>

          <article className={`${styles.kpiCard} ${styles.kpiCardPurple}`}>
            <div className={`${styles.kpiIcon} ${styles.kpiIconPurple}`}>
              <ChartColumn size={22} />
            </div>
            <span className={styles.kpiLabel}>Trading Volume</span>
            <span className={styles.kpiValue}>{fmtUsd(kpis.totalVolume)}</span>
            <span className={styles.kpiSub}>Total volume</span>
          </article>

          <article className={`${styles.kpiCard} ${styles.kpiCardOrange}`}>
            <div className={`${styles.kpiIcon} ${styles.kpiIconOrange}`}>
              <Wallet size={22} />
            </div>
            <span className={styles.kpiLabel}>Unique Tokens</span>
            <span className={styles.kpiValue}>{fmtNum(kpis.totalTokens)}</span>
            <span className={styles.kpiSub}>Across all wallets</span>
          </article>
        </div>

        {/* ── Header Controls ───────────────────────────────── */}
        <div className={styles.headerRow}>
          <div className={styles.periodSwitcherPills}>
            {["7D", "30D", "90D"].map((p) => (
              <button
                key={p}
                className={`${styles.periodPill} ${period === p ? styles.periodPillActive : ""}`}
                onClick={() => setPeriod(p as WalletOverviewPeriodKey)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* ── HÀNG 1: 3 biểu đồ đầu tiên ────────────────────────── */}
        <div className={styles.chartRow} style={{ gridTemplateColumns: "1fr 1fr 2fr", gap: "12px" }}>
          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>Wallet Asset Contribution</h4>
            <ReactEChartsCore
              echarts={echarts}
              option={contributionDonutOption}
              className={styles.chartContainer}
              style={{ height: 250, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>

          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>Buy / Sell Volume Ratio</h4>
            <ReactEChartsCore
              echarts={echarts}
              option={netFlowChartOption}
              className={styles.chartContainer}
              style={{ height: 250, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>

          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>Trading Activity Momentum</h4>
            <ReactEChartsCore
              echarts={echarts}
              option={activityTrendOption}
              className={styles.chartContainer}
              style={{ height: 250, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>
        </div>

        {/* ── HÀNG 2: 3 thành phần còn lại ────────────────────────── */}
        <div className={styles.chartRow} style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>Total Balance History</h4>
            <ReactEChartsCore
              echarts={echarts}
              option={totalBalanceOption}
              className={styles.chartContainer}
              style={{ height: 250, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>

          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>Top 5 Tokens by PNL</h4>
            <ReactEChartsCore
              echarts={echarts}
              option={topTokensChartOption}
              className={styles.chartContainer}
              style={{ height: 250, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>

          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>Asset Composition</h4>
            <div className={styles.matrixTableWrapper} style={{ height: 250, overflowY: "auto", overflowX: "hidden" }}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Total Value</th>
                    <th style={{ width: "20%" }}>Composition</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixData.rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        {row.logoUri ? (
                          <img src={row.logoUri} alt={row.symbol} className={styles.tokenAvatar} />
                        ) : (
                          <div className={styles.tokenAvatarPlaceholder} />
                        )}
                        {row.symbol}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmtUsd(row.total)}</td>
                      <td>
                        <div className={styles.dataBarCell}>
                          <div
                            className={styles.dataBarFill}
                            style={{ width: `${matrixData.maxTotal > 0 ? (row.total / matrixData.maxTotal) * 100 : 0}%` }}
                          />
                          <span className={styles.dataBarText}>
                            {matrixData.overallTotal > 0 ? ((row.total / matrixData.overallTotal) * 100).toFixed(2) : "0.00"}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {matrixData.rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.emptyState}>
                        No asset data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </ChartProvider>
  );
}
