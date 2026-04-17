/**
 * ExchangeComparison Component
 *
 * Displays grouped bar chart comparing deposits vs withdrawals across exchanges,
 * delivering immediate insight into exchange-specific activity patterns.
 *
 * @module ExchangeComparison
 */

import { ChartWrapper } from "@/components/charts/shared/ChartWrapper";
import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartExport } from "@/hooks/useChartExport";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  getChartGridConfig,
  getThemedChartBaseOption,
  useChartTheme,
} from "@/hooks/useChartTheme";
import {
  fetchExchangeComparison,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import { runChartExport } from "@/services/chart/chartExportService";
import type { ExchangesRequestParams } from "@/types/chart-api.types";
import type { ChartDataSeries } from "@/types/chart-data.types";
import type { ExportFormat } from "@/types/chart-filters.types";
import { isChartSuccess } from "@/util/chart-helpers";
import { getMultiSeriesLegend } from "@/util/chart-legend-config";
import {
  createSeriesIndicator,
  createTooltipHeader,
} from "@/util/tooltip-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ChartGridItem } from "../shared";

// Infer response type from fetcher
type ExchangeComparisonData = InferFetcherData<typeof fetchExchangeComparison>;

/**
 * Props for ExchangeComparison component
 */
export interface ExchangeComparisonProps {
  /** Chart title */
  title?: string;

  /** Chart minimum height in pixels */
  minHeight?: number;

  walletAddress: string;

  limit?: number;

  /** Metric to display: count (transaction count) or volume (USD value) */
  metric?: "count" | "volume";

  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;

  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;

  /** Callback when data is loaded */
  onDataLoaded?: (data: ExchangeComparisonData) => void;

  /** Additional CSS class */
  className?: string;
}

/**
 * ExchangeComparison Component
 *
 * User Story 3: Compare Exchange Trading Activity (Priority: P2)
 *
 * Displays grouped bar chart with:
 * - Exchange names on X-axis
 * - Deposits vs withdrawals as grouped bars
 * - Data labels on top of each bar
 * - Time period filtering
 * - Metric selector (count vs volume)
 * - Auto-refresh every 30 seconds
 *
 * @example
 * ```tsx
 * <ExchangeComparison
 *   title="Exchange Activity Comparison"
 *   minHeight={400}
 *   initialTimePeriod="30D"
 *   metric="count"
 *   autoRefresh={true}
 * />
 * ```
 */
export function ExchangeComparison({
  title,
  minHeight = 400,
  walletAddress,
  limit = 2000,
  metric = "count",
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: ExchangeComparisonProps) {
  // i18n
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.exchangeComparisonChart.title");

  // State management
  const [currentMetric, setCurrentMetric] = useState<"count" | "volume">(
    metric,
  );

  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);

  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();

  // Get theme configuration
  const chartTheme = useChartTheme();

  // Use centralized filter sync hook
  const { filters } = useChartFiltersSync({
    initialFilters: {
      limit,
    },
    debounceDelay: 300,
  });

  // Query for the controller
  const query = useMemo<ExchangesRequestParams>(
    () => ({
      limit: filters.limit,
      wallet: walletAddress,
      metric: currentMetric,
      timezone,
    }),
    [filters.limit, currentMetric, timezone, walletAddress],
  );

  // Use standard chart controller
  const { data, loadingState, refetch } = useStandardChartController<
    ExchangeComparisonData,
    ExchangesRequestParams
  >({
    fetcher: fetchExchangeComparison,
    query,
    autoRefresh,
    refreshInterval,
    onDataLoaded,
  });

  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportPDF, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: "exchange-comparison",
  });

  /**
   * Handle export based on format
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!isChartSuccess(data, "exchanges")) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;
      const csvData: ChartDataSeries[] = [
        {
          id: "deposits",
          name: tr("charts.exchangeComparisonChart.deposits"),
          type: "bar",
          visible: true,
          data: data.exchanges.map((ex) => ({
            name: ex.name,
            value: currentMetric === "count" ? ex.deposits : ex.depositsVolume,
          })),
        },
        {
          id: "withdrawals",
          name: tr("charts.exchangeComparisonChart.withdrawals"),
          type: "bar",
          visible: true,
          data: data.exchanges.map((ex) => ({
            name: ex.name,
            value:
              currentMetric === "count" ? ex.withdrawals : ex.withdrawalsVolume,
          })),
        },
      ];

      await runChartExport(
        {
          format,
          filters,
          chartInstance: instance as any,
          csvData,
        },
        { exportPNG, exportSVG, exportPDF, exportCSV },
      );
    },
    [
      data,
      filters,
      currentMetric,
      exportPNG,
      exportSVG,
      exportPDF,
      exportCSV,
      tr,
    ],
  );

  /**
   * Generate eCharts option configuration for grouped bar chart
   */
  const chartOptions = useMemo((): EChartsOption | null => {
    console.log("[ExchangeComparison] Generating chart options. Data:", data);
    console.log("[ExchangeComparison] isChartSuccess:", isChartSuccess(data, "exchanges"));

    if (!isChartSuccess(data, "exchanges") || data.exchanges.length === 0) {
      console.log("[ExchangeComparison] No valid exchange data for chart");
      return null;
    }

    console.log("[ExchangeComparison] FINAL CHART DATA:", JSON.stringify(data, null, 2));

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Extract exchange names and values
    const exchangeNames = data.exchanges.map((ex) => ex.name);
    const deposits = data.exchanges.map((ex) =>
      currentMetric === "count" ? ex.deposits : ex.depositsVolume,
    );
    const withdrawals = data.exchanges.map((ex) =>
      currentMetric === "count" ? ex.withdrawals : ex.withdrawalsVolume,
    );

    return {
      ...baseOption,
      ...getChartGridConfig,
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";

          const exchangeName = params[0].axisValue;
          let tooltipContent = createTooltipHeader(exchangeName);

          params.forEach((param: any) => {
            const value =
              currentMetric === "count"
                ? `${param.value.toLocaleString()} txns`
                : fmt.num.compact.currency(param.value);
            tooltipContent +=
              `<div style="margin-top: 4px; width: 100%; display:flex; justify-content: space-between; gap: 8px">` +
              `<span>${createSeriesIndicator(param.color)}${param.seriesName}:</span>` +
              `<strong>${value}</strong></div>`;
          });

          return tooltipContent;
        },
      },
      legend: getMultiSeriesLegend(
        chartTheme,
        [
          tr("charts.exchangeComparisonChart.deposits"),
          tr("charts.exchangeComparisonChart.withdrawals"),
        ],
        false,
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: "category",
        data: exchangeNames,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 45,
          interval: 0,
          formatter: (value: string) =>
            value.length > 20 ? `${value.substring(0, 17)}...` : value,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        name:
          currentMetric === "count"
            ? tr("charts.exchangeComparisonChart.count")
            : tr("charts.exchangeComparisonChart.volume"),
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => {
            if (currentMetric === "count") {
              return value.toLocaleString();
            }
            return fmt.num.compact.currency(value);
          },
        },
      },
      series: [
        {
          name: tr("charts.exchangeComparisonChart.deposits"),
          type: "bar",
          data: deposits,
          itemStyle: {
            color: "#10b981", // Green for deposits
          },
          label: {
            show: true,
            position: "top",
            formatter: (params: any) => {
              if (currentMetric === "count") {
                return params.value >= 1000
                  ? `${(params.value / 1000).toFixed(1)}k`
                  : params.value.toString();
              }
              return fmt.num.compact.currency(params.value);
            },
            fontSize: 11,
          },
          barMaxWidth: 50,
        },
        {
          name: tr("charts.exchangeComparisonChart.withdrawals"),
          type: "bar",
          data: withdrawals,
          itemStyle: {
            color: "#ef4444", // Red for withdrawals
          },
          label: {
            show: true,
            position: "top",
            formatter: (params: any) => {
              if (currentMetric === "count") {
                return params.value >= 1000
                  ? `${(params.value / 1000).toFixed(1)}k`
                  : params.value.toString();
              }
              return fmt.num.compact.currency(params.value);
            },
            fontSize: 11,
          },
          barMaxWidth: 50,
        },
      ],
    };
  }, [data, currentMetric, chartTheme, tr, fmt]);

  /**
   * Setup chart export
   */
  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'exchange-comparison',
  // });

  /**
   * Handle export based on format
   */
  // const handleExport = async (format: ExportFormat) => {
  //   const chartInstance = chartRef.current?.getEchartsInstance();
  //   if (!chartInstance) {
  //     console.error('Chart instance not available for export');
  //     return;
  //   }

  //   if (format === 'png') {
  //     exportPNG(chartInstance as any, filters);
  //   } else if (format === 'svg') {
  //     exportSVG(chartInstance as any, filters);
  //   } else if (format === 'csv' && data) {
  //     // Convert data to ChartDataSeries format for CSV export
  //     const csvData = [
  //       {
  //         id: 'deposits',
  //         name: t('charts.exchangeComparisonChart.deposits'),
  //         type: 'bar' as const,
  //         data: data.exchanges.map(ex => ({
  //           name: ex.name,
  //           value: currentMetric === 'count' ? ex.deposits : ex.depositsVolume,
  //         })),
  //         visible: true,
  //       },
  //       {
  //         id: 'withdrawals',
  //         name: t('charts.exchangeComparisonChart.withdrawals'),
  //         type: 'bar' as const,
  //         data: data.exchanges.map(ex => ({
  //           name: ex.name,
  //           value: currentMetric === 'count' ? ex.withdrawals : ex.withdrawalsVolume,
  //         })),
  //         visible: true,
  //       },
  //     ];
  //     exportCSV(csvData, filters);
  //   }
  // };

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={
        !isChartSuccess(data, "exchanges") || data.exchanges.length === 0
      }
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
    >
      {chartOptions && (
        <ChartGridItem minHeight={minHeight}>
          <ReactECharts
            ref={chartRef}
            option={chartOptions}
            style={{
              height: "100%",
              width: "100%",
              minHeight: `${minHeight}px`,
            }}
            opts={{ renderer: "canvas" }}
            notMerge={true}
            lazyUpdate={true}
          />
        </ChartGridItem>
      )}
    </ChartWrapper>
  );
}
