/**
 * Drawdown Chart Component
 *
 * Displays drawdown analysis with:
 * - Line chart per wallet with fill effect
 * - Header showing maximum drawdown data and duration
 *
 * Features:
 * - Multiple wallet support (separate lines per wallet)
 * - Fill effect below zero line
 * - Max drawdown statistics in header
 * - Auto-refresh on wallet changes
 *
 * @module components/charts/Drawdown
 */

import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  getChartGridConfig,
  getThemedChartBaseOption,
  useChartTheme,
} from "@/hooks/useChartTheme";
import {
  fetchDrawdown,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { DrawdownRequestParams } from "@/types/chart-api.types";
import { formatTimestampWithTimezone } from "@/util/chart-helpers";
import { getConditionalLegend } from "@/util/chart-legend-config";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef } from "react";

// Infer response type from fetcher
type DrawdownData = InferFetcherData<typeof fetchDrawdown>;

import { useStandardChartController } from "@/hooks/useChartController";
import { BaseChart } from "../Base/BaseChart";
import {
  ChartContainer,
  ChartGridItem,
  ChartSection,
  ChartStatsHeader,
} from "../shared";
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
  className,
}: ChartProps) {
  const { tr } = useLocalization();
  const chartTitle = title || tr("charts.drawdownChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query
   */
  const query = useMemo<DrawdownRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString],
  );

  /**
   * Lifecycle controller
   */
  const { data, loadingState, refetch } = useStandardChartController<
    DrawdownData,
    DrawdownRequestParams
  >({
    fetcher: fetchDrawdown,
    query,
    autoRefresh,
    refreshInterval,
  });

  /**
   * Generate drawdown chart option
   */
  const chartOption = useMemo((): EChartsOption | null => {
    const baseOption = getThemedChartBaseOption(chartTheme);
    if (
      !data ||
      "error" in data ||
      !data.wallets ||
      !Array.isArray(data.wallets) ||
      data.wallets.length === 0
    ) {
      return null;
    }

    // data format: { wallets: Array<{ walletAddress, walletName?, data: Array<{timestamp, value, ...}>, ... }>, metadata: { timestamp } }
    const series = data.wallets.map((wallet: any, index: number) => {
      const color =
        chartTheme.colorPalette[index % chartTheme.colorPalette.length];
      return {
        name: wallet.walletName || wallet.walletAddress,
        type: "line" as const,
        data: wallet.drawdownResult.map((d: any) => [
          d.timestamp,
          d.drawdown * 100,
        ]), // convert to percentage
        smooth: true,
        lineStyle: {
          color: color,
          width: 2,
        },
        itemStyle: {
          color: color,
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
                color: `${color}80`, // Semi-transparent at top
              },
              {
                offset: 1,
                color: `${color}20`, // More transparent at bottom
              },
            ],
          },
        },
        symbol: "none" as const,
        emphasis: {
          focus: "series" as const,
        },
      };
    });

    return {
      ...baseOption,
      grid: getChartGridConfig().grid,
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
        splitLine: {
          show: true,
          lineStyle: {
            color: chartTheme.splitLineColor,
            type: "dashed",
          },
        },
      },
      series: series,
      legend: getConditionalLegend(
        chartTheme,
        data.wallets.map((w: any) => w.walletName || w.walletAddress),
        2,
        false,
      ),
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        formatter: (params: any) => {
          // params is an array of points for the hovered x value
          if (!Array.isArray(params)) return "";
          let tooltip = "";
          params.forEach((p: any) => {
            const data = p.data || [];
            // data: [timestamp, drawdown%], but we want to show all drawdownResult fields
            // Try to find the full drawdownResult object from the series data
            const wallet = data.walletAddress || p.seriesName;
            // Find the wallet object in data.wallets
            const walletObj =
              data && typeof data === "object" && data.walletAddress
                ? data
                : data && typeof data === "object" && data.drawdownResult
                  ? data
                  : null;
            // Fallback: try to find walletObj from chart data
            let drawdownObj = null;
            if (walletObj && walletObj.drawdownResult) {
              drawdownObj = walletObj.drawdownResult.find(
                (d: any) => d.timestamp === p.value[0],
              );
            } else if (
              p.value &&
              p.seriesIndex != null &&
              data.wallets &&
              Array.isArray(data.wallets)
            ) {
              const w = data.wallets[p.seriesIndex];
              drawdownObj = w?.drawdownResult?.find(
                (d: any) => d.timestamp === p.value[0],
              );
            }
            // If not found, fallback to p.value
            if (!drawdownObj && p.value) {
              drawdownObj = {
                timestamp: p.value[0],
                drawdown: p.value[1] / 100,
              };
            }
            // Compose tooltip
            tooltip += `<div><strong>${p.seriesName}</strong></div>`;
            tooltip += `<div>${formatTimestampWithTimezone(p.value[0], timezone, "yyyy-MM-dd HH:mm")}</div>`;
            if (drawdownObj) {
              tooltip += `<div>Drawdown: ${(drawdownObj.drawdown * 100).toFixed(2)}%</div>`;
              if ("value" in drawdownObj)
                tooltip += `<div>Value: ${drawdownObj.value}</div>`;
              if ("peak" in drawdownObj)
                tooltip += `<div>Peak: ${drawdownObj.peak}</div>`;
              if ("trough" in drawdownObj)
                tooltip += `<div>Trough: ${drawdownObj.trough}</div>`;
              if ("date" in drawdownObj)
                tooltip += `<div>Date: ${drawdownObj.date}</div>`;
            }
            tooltip += '<hr style="margin:2px 0;opacity:0.2">';
          });
          return tooltip;
        },
      },
    };
  }, [data, chartTheme, timezone, tr]);

  /**
   * Generate statistics header
   */
  const statsCards = useMemo<StatCard[]>(() => {
    if (
      !data ||
      "error" in data ||
      !data.wallets ||
      !Array.isArray(data.wallets) ||
      data.wallets.length === 0
    ) {
      return [];
    }

    // Compute stats from drawdownResult for each wallet
    return data.wallets.map((wallet) => {
      const { drawdownResult, walletAddress } = wallet;
      if (!Array.isArray(drawdownResult) || drawdownResult.length === 0) {
        return {
          title: walletAddress,
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

      // Max drawdown is the 'trough' value of the latest entry
      const latest = drawdownResult[drawdownResult.length - 1];
      // const maxDrawdown = latest.trough;
      const maxDrawdown = Math.min(
        ...drawdownResult.map((d: any) => d.drawdown),
      );
      const maxDrawdownEntry = drawdownResult.find(
        (d: any) => d.drawdown === maxDrawdown,
      );
      const maxDrawdownTimestamp = maxDrawdownEntry
        ? maxDrawdownEntry.timestamp
        : null;
      const currentDrawdown = latest?.drawdown ?? 0;

      let daysSinceMaxDrawdown = null;
      if (maxDrawdownTimestamp) {
        const now = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;
        daysSinceMaxDrawdown = Math.floor(
          (now - maxDrawdownTimestamp) / msPerDay,
        );
      }

      return {
        title: walletAddress,
        stats: [
          {
            label: "Max Drawdown",
            value: (maxDrawdown * 100).toFixed(2),
            suffix: "%",
            valueClassName: "text-danger",
          },
          {
            label: "Days Since Max DD",
            value: daysSinceMaxDrawdown != null ? daysSinceMaxDrawdown : "-",
            suffix: "days",
          },
          {
            label: "Current Drawdown",
            value: (currentDrawdown * 100).toFixed(2),
            suffix: "%",
          },
          {
            label: "Max DD Date",
            value: maxDrawdownTimestamp
              ? formatTimestampWithTimezone(
                  maxDrawdownTimestamp,
                  timezone,
                  "yyyy-MM-dd",
                )
              : "-",
          },
        ],
      };
    });
  }, [data, timezone]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={
        !data ||
        "error" in data ||
        !data.wallets ||
        !Array.isArray(data.wallets) ||
        data.wallets.length === 0
      }
      onRetry={() => refetch(false)}
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
    </BaseChart>
  );
}
