/**
 * Stablecoin Ratio Chart Component
 *
 * Displays time series of stablecoin percentage in wallet portfolios
 *
 * Features:
 * - Line chart showing stablecoin ratio over time
 * - Multiple wallet support (separate lines per wallet)
 * - Statistics showing current and average ratios
 * - Auto-refresh on wallet changes
 * - Timezone-aware date formatting
 *
 * @module components/charts/StablecoinRatio
 */

import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import { getChartGridConfig, getThemedChartBaseOption, useChartTheme } from "@/hooks/useChartTheme";
import {
  fetchStablecoinRatio,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { StablecoinRatioRequestParams } from "@/types/chart-api.types";
import {
  formatTimestampWithTimezone,
  isChartSuccess,
} from "@/util/chart-helpers";
import { getConditionalLegend } from "@/util/chart-legend-config";
import { formatAxisTooltip } from "@/util/tooltip-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef } from "react";
import { BaseChart } from "../Base/BaseChart";
import {
  ChartContainer,
  ChartGridItem,
  ChartSection,
  ChartStatsHeader,
} from "../shared";
import type { ChartProps } from "../shared/ChartProp";
import type { StatCard } from "../shared/ChartStatsHeader";

type StablecoinRatioData = InferFetcherData<typeof fetchStablecoinRatio>;

export function StablecoinRatioChart({
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
  const chartTitle = title || tr("charts.stablecoinRatioChart.title");

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
  const query = useMemo<StablecoinRatioRequestParams>(
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
    StablecoinRatioData,
    StablecoinRatioRequestParams
  >({
    fetcher: fetchStablecoinRatio,
    query,
    autoRefresh,
    refreshInterval,
  });

  /**
   * Generate chart option
   */
  const chartOption = useMemo((): EChartsOption | null => {
    // if (!data || !data.wallets || data.wallets.length === 0) return null;

    const baseOption = getThemedChartBaseOption(chartTheme);

    // Prepare series data (one per wallet)
    if (!isChartSuccess(data, "wallets")) return null;

    const series = data.wallets.map((wallet, index) => {
      const color =
        chartTheme.colorPalette[index % chartTheme.colorPalette.length];

      return {
        name: wallet.walletName || wallet.walletAddress,
        type: "line" as const,
        data: wallet.data.map((d) => [d.timestamp, d.value]),
        smooth: true,
        lineStyle: {
          color: color,
          width: 2,
        },
        itemStyle: {
          color: color,
        },
        symbol: "circle" as const,
        symbolSize: 6,
        showSymbol: false,
        emphasis: {
          focus: "series" as const,
          showSymbol: true,
        },
      };
    });

    return {
      ...baseOption,
      ...getChartGridConfig,
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
        name: "Stablecoin Ratio (%)",
        min: 0,
        max: 100,
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
        data.wallets.map((w) => w.walletAddress),
        2,
        false,
      ),
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: {
          type: "cross",
        },
        formatter: (params: any) =>
          formatAxisTooltip(
            params,
            (p) =>
              formatTimestampWithTimezone(
                p.value[0],
                timezone,
                "yyyy-MM-dd HH:mm",
              ),
            (p) => `${p.value[1].toFixed(2)}%`,
          ),
      },
    };
  }, [data, chartTheme, timezone, tr]);

  /**
   * Generate statistics header
   */
  const statsCards = useMemo<StatCard[]>(() => {
    if (!isChartSuccess(data, "wallets") || data.wallets.length === 0)
      return [];

    return data.wallets.map((wallet, _index) => ({
      title: wallet.walletName || wallet.walletAddress,
      stats: [
        {
          label: "Current Ratio",
          value: wallet.currentRatio?.toFixed(2) || "-",
          suffix: "%",
        },
        {
          label: "Average Ratio",
          value: wallet.averageRatio?.toFixed(2) || "-",
          suffix: "%",
        },
      ],
    }));
  }, [data]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!isChartSuccess(data, "wallets") || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <ChartContainer>
        <ChartStatsHeader cards={statsCards} minColumnWidth="200px" />
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
