import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import {
  fetchDrawdown,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { DrawdownRequestParams } from "@/types/chart-api.types";
import { formatTimestampWithTimezone } from "@/util/chart-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Drawdown.module.scss";

type DrawdownData = InferFetcherData<typeof fetchDrawdown>;

type DrawdownPointRow = {
  timestamp?: unknown;
  drawdown?: unknown;
  value?: unknown;
  peak?: unknown;
  trough?: unknown;
  date?: string;
};

type DrawdownWalletRow = {
  walletAddress?: unknown;
  walletName?: unknown;
  drawdownResult?: unknown;
};

type DrawdownTooltipPoint = {
  value?: [unknown, unknown];
  seriesName?: string;
};

type WalletSeriesMeta = {
  walletAddress: string;
  walletName: string;
  drawdownResult: Array<{
    timestamp: number;
    drawdown: number;
    value?: number;
    peak?: number;
    trough?: number;
    date?: string;
  }>;
  color: string;
};

import { useStandardChartController } from "@/hooks/useChartController";
import { ChartWrapper, ChartContainer, ChartGridItem, ChartSection, ChartStatsHeader } from "../shared";
import type { ChartProps } from "../shared/ChartProp";
import type { StatCard } from "../shared/ChartStatsHeader";

export function DrawdownChart({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: "30D",
    wallets: [],
  },
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  actions,
}: ChartProps) {
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.drawdownChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<DrawdownRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString],
  );

  const { data, loadingState, refetch } = useStandardChartController<
    DrawdownData,
    DrawdownRequestParams
  >({
    fetcher: fetchDrawdown,
    query,
    autoRefresh,
    refreshInterval,
    enabled: fetchEnabled,
  });

  const getSeriesColor = useCallback(
    (index: number) => CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
    [],
  );

  const walletSeriesMeta = useMemo<WalletSeriesMeta[]>(() => {
    if (
      !data ||
      "error" in data ||
      !data.wallets ||
      !Array.isArray(data.wallets) ||
      data.wallets.length === 0
    ) {
      return [];
    }

    return data.wallets.map((wallet: DrawdownWalletRow, index: number) => ({
      walletAddress: String(wallet.walletAddress || ""),
      walletName: String(wallet.walletName || wallet.walletAddress || ""),
      drawdownResult: Array.isArray(wallet.drawdownResult)
        ? wallet.drawdownResult
          .map((item: DrawdownPointRow) => ({
            timestamp: Number(item.timestamp),
            drawdown: Number(item.drawdown),
            value: item.value != null ? Number(item.value) : undefined,
            peak: item.peak != null ? Number(item.peak) : undefined,
            trough: item.trough != null ? Number(item.trough) : undefined,
            date: item.date,
          }))
          .filter((item) => Number.isFinite(item.timestamp) && Number.isFinite(item.drawdown))
        : [],
      color: getSeriesColor(index),
    }));
  }, [data, getSeriesColor]);

  const [visibleWalletAddresses, setVisibleWalletAddresses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (walletSeriesMeta.length === 0) {
      setVisibleWalletAddresses(new Set());
      return;
    }

    setVisibleWalletAddresses((prev) => {
      const validWallets = walletSeriesMeta.map((wallet) => wallet.walletAddress);
      const next = new Set(validWallets.filter((walletAddress) => prev.has(walletAddress)));

      if (next.size === 0) {
        validWallets.forEach((walletAddress) => next.add(walletAddress));
      }

      return next;
    });
  }, [walletSeriesMeta]);

  const toggleWalletVisibility = useCallback((walletAddress: string) => {
    setVisibleWalletAddresses((prev) => {
      const next = new Set(prev);

      if (next.has(walletAddress)) {
        if (next.size === 1) {
          return prev;
        }
        next.delete(walletAddress);
        return next;
      }

      next.add(walletAddress);
      return next;
    });
  }, []);

  const visibleWalletSeriesMeta = useMemo(
    () => walletSeriesMeta.filter((wallet) => visibleWalletAddresses.has(wallet.walletAddress)),
    [walletSeriesMeta, visibleWalletAddresses],
  );

  const compactWalletLabel = useCallback((label: string, walletAddress: string) => {
    const normalized = (label || walletAddress || "").trim();
    if (!normalized) return "";

    const looksLikeAddress =
      /^[1-9A-HJ-NP-Za-km-z]{24,}$/.test(normalized) || normalized === walletAddress;
    if (looksLikeAddress) {
      if (normalized.length <= 12) return normalized;
      return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
    }

    const maxLen = 18;
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 3)}...`;
  }, []);

  const chartOption = useMemo((): EChartsOption | null => {
    if (visibleWalletSeriesMeta.length === 0) {
      return null;
    }

    const series = visibleWalletSeriesMeta.map((wallet) => ({
      name: wallet.walletName,
      type: "line" as const,
      data: wallet.drawdownResult.map((d) => [d.timestamp, d.drawdown * 100]),
      smooth: false,
      lineStyle: {
        color: wallet.color,
        width: 2,
      },
      itemStyle: {
        color: wallet.color,
      },
      areaStyle: {
        color: {
          type: "linear" as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            {
              offset: 0,
              color: `${wallet.color}80`,
            },
            {
              offset: 1,
              color: `${wallet.color}20`,
            },
          ],
        },
      },
      symbol: "none" as const,
      emphasis: {
        focus: "series" as const,
      },
    }));

    return {
      ...baseOption,
      legend: { show: false },
      xAxis: {
        ...baseOption.xAxis,
        type: "time",
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) =>
            formatTimestampWithTimezone(value, timezone, "MM/dd"),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        name: "Drawdown (%)",
        max: 0,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: "{value}%",
        },
      },
      series,
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params)) return "";
          let tooltip = "";

          (params as DrawdownTooltipPoint[]).forEach((p) => {
            const timestamp = Number(p?.value?.[0]);
            const drawdownPct = Number(p?.value?.[1]);
            const wallet = visibleWalletSeriesMeta.find((w) => w.walletName === p.seriesName);
            const drawdownObj = wallet?.drawdownResult.find((d) => d.timestamp === timestamp);

            tooltip += `<div><strong>${p.seriesName}</strong></div>`;
            tooltip += `<div>${formatTimestampWithTimezone(timestamp, timezone, "yyyy-MM-dd HH:mm")}</div>`;
            if (Number.isFinite(drawdownPct)) {
              tooltip += `<div>Drawdown: ${drawdownPct.toFixed(2)}%</div>`;
            }
            if (drawdownObj?.value != null) {
              tooltip += `<div>Value: ${fmt.num.compact.currency(drawdownObj.value)}</div>`;
            }
            if (drawdownObj?.peak != null) {
              tooltip += `<div>Peak: ${fmt.num.compact.currency(drawdownObj.peak)}</div>`;
            }
            if (drawdownObj?.trough != null) {
              tooltip += `<div>Trough: ${fmt.num.compact.currency(drawdownObj.trough)}</div>`;
            }
            if (drawdownObj?.date) {
              tooltip += `<div>Date: ${drawdownObj.date}</div>`;
            }
            tooltip += '<hr style="margin:2px 0;opacity:0.2">';
          });

          return tooltip;
        },
      },
    };
  }, [visibleWalletSeriesMeta, baseOption, timezone, fmt]);

  const statsCards = useMemo<StatCard[]>(() => {
    if (walletSeriesMeta.length === 0) {
      return [];
    }

    return walletSeriesMeta.map((wallet) => {
      const { drawdownResult, walletAddress, walletName, color } = wallet;
      const isVisible = visibleWalletAddresses.has(walletAddress);

      const cardTitle = (
        <div className={styles.cardTitleRow}>
          <div className={styles.walletTitleWrap}>
            <span className={styles.walletColorDot} style={{ backgroundColor: color }} />
            <span className={styles.walletTitleText} title={walletName}>
              {compactWalletLabel(walletName, walletAddress)}
            </span>
          </div>
          <span className={`${styles.walletActiveIndicator} ${isVisible ? styles.walletActiveIndicatorOn : styles.walletActiveIndicatorOff}`}>
            {isVisible
              ? tr("charts.drawdownChart.visibility.active")
              : tr("charts.drawdownChart.visibility.hidden")}
          </span>
        </div>
      );

      if (!Array.isArray(drawdownResult) || drawdownResult.length === 0) {
        return {
          title: cardTitle,
          onClick: () => toggleWalletVisibility(walletAddress),
          isActive: isVisible,
          stats: [
            {
              label: "No data",
              value: "-",
              suffix: "",
              valueClassName: "text-muted",
            },
          ],
        };
      }

      const latest = drawdownResult[drawdownResult.length - 1];
      const maxDrawdown = Math.min(...drawdownResult.map((d) => d.drawdown));
      const maxDrawdownEntry = drawdownResult.find((d) => d.drawdown === maxDrawdown);
      const maxDrawdownTimestamp = maxDrawdownEntry ? maxDrawdownEntry.timestamp : null;
      const currentDrawdown = latest?.drawdown ?? 0;

      let daysSinceMaxDrawdown: number | null = null;
      if (maxDrawdownTimestamp) {
        const now = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;
        daysSinceMaxDrawdown = Math.floor((now - maxDrawdownTimestamp) / msPerDay);
      }

      return {
        title: cardTitle,
        onClick: () => toggleWalletVisibility(walletAddress),
        isActive: isVisible,
        stats: [
          {
            label: tr("charts.drawdownChart.stats.maxDrawdown"),
            value: (maxDrawdown * 100).toFixed(2),
            suffix: "%",
            valueClassName: "text-danger",
          },
          {
            label: tr("charts.drawdownChart.stats.daysSinceMaxDD"),
            value: daysSinceMaxDrawdown != null ? daysSinceMaxDrawdown : "-",
            suffix: tr("charts.drawdownChart.stats.days"),
          },
          {
            label: tr("charts.drawdownChart.stats.currentDrawdown"),
            value: (currentDrawdown * 100).toFixed(2),
            suffix: "%",
          },
          {
            label: tr("charts.drawdownChart.stats.maxDDDate"),
            value: maxDrawdownTimestamp
              ? formatTimestampWithTimezone(maxDrawdownTimestamp, timezone, "yyyy-MM-dd")
              : "-",
          },
        ],
      };
    });
  }, [walletSeriesMeta, visibleWalletAddresses, compactWalletLabel, toggleWalletVisibility, tr, timezone]);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={walletSeriesMeta.length === 0}
      onRetry={() => refetch(false)}
      actions={actions}
      enableFullscreen={false}
      enableExport={false}
    >
      <ChartContainer gap="0">
        <ChartStatsHeader cards={statsCards} minColumnWidth="300px" />
        <ChartSection minHeight={`${minHeight}px`}>
          {chartOption && (
            <ChartGridItem minHeight={minHeight}>
              <ReactECharts
                ref={chartRef}
                option={chartOption}
                style={{
                  height: "100%",
                  width: "100%",
                  minHeight: `${minHeight}px`,
                }}
                notMerge
                lazyUpdate
              />
            </ChartGridItem>
          )}
        </ChartSection>
      </ChartContainer>
    </ChartWrapper>
  );
}

