/**
 * CounterpartyActivity Component
 *
 * Displays grouped bar charts showing transaction counts and volumes per counterparty,
 * delivering actionable insights about trading relationships.
 *
 * @module CounterpartyActivity
 */

import { BaseChart } from "@/components/charts/Base/BaseChart";
import sharedStyles from "@/components/charts/shared/ChartStyle.module.scss";
import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  getChartGridConfig,
  getThemedChartBaseOption,
  useChartTheme,
} from "@/hooks/useChartTheme";
import {
  fetchCounterpartyActivity,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { CounterpartiesRequestParams } from "@/types/chart-api.types";
import { formatCurrency, isChartSuccess } from "@/util/chart-helpers";
import { getMultiSeriesLegend } from "@/util/chart-legend-config";
import { createTooltipHeader, createTooltipRow } from "@/util/tooltip-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef, useState } from "react";
import { ChartGridItem } from "../shared";
import type { ChartProps } from "../shared/ChartProp";

// Infer response type from fetcher
type CounterpartyActivityData = InferFetcherData<
  typeof fetchCounterpartyActivity
>;
/**
 * Props for CounterpartyActivity component
 */
// export interface CounterpartyActivityProps {
//   /** Chart title */
//   title?: string;

//   /** Chart minimum height in pixels */
//   minHeight?: number;

//   /** Initial time period (default: 30D) */
//   initialTimePeriod?: TimePeriod;

//   /** Transaction type filter (default: all) */
//   initialTransactionType?: TransactionType;

//   /** Limit to top N counterparties (default: 10) */
//   limit?: number;

//   /** Enable auto-refresh (default: true) */
//   autoRefresh?: boolean;

//   /** Auto-refresh interval in milliseconds (default: 30000) */
//   refreshInterval?: number;

//   /** Callback when data is loaded */
//   onDataLoaded?: (data: CounterpartyActivityResponse) => void;

//   /** Additional CSS class */
//   className?: string;
// }

/**
 * CounterpartyActivity Component
 *
 * User Story 4: Analyze Counterparty Transaction Activity (Priority: P2)
 *
 * Displays grouped bar chart with:
 * - Counterparty identifiers on X-axis
 * - Transaction count and total volume as grouped bars
 * - Time period filtering
 * - Transaction type filtering
 * - Limit selector for top N counterparties
 * - Auto-refresh every 30 seconds
 *
 * @example
 * ```tsx
 * <CounterpartyActivity
 *   title="Counterparty Analysis"
 *   minHeight={400}
 *   initialTimePeriod="30D"
 *   initialTransactionType="all"
 *   limit={10}
 *   autoRefresh={true}
 * />
 * ```
 */
export const CounterpartyActivity: React.FC<ChartProps> = ({
  // minHeight = 400,
  // initialFilters = {{
  //   timePeriod = '30D',
  //   transactionType = 'all',
  //   limit = 10,
  //   tokens = ['All']
  // }},
  // autoRefresh = true,
  // refreshInterval = 30000,
  // className,
  // onDataLoaded,
  // title,

  title,
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  // onDataLoaded,
}) => {
  // i18n
  const { tr } = useLocalization();
  const chartTitle = title || tr("charts.counterpartyActivityChart.title");

  // State management
  const [currentLimit, setCurrentLimit] = useState<number>(10);

  // Chart instance refs for export
  const transactionCountChartRef = useRef<ReactECharts>(null);
  const totalVolumeChartRef = useRef<ReactECharts>(null);

  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();

  // Get theme configuration
  const chartTheme = useChartTheme();

  // Use centralized filter sync hook
  const { filters } = useChartFiltersSync({
    initialFilters: initialFilters,
  });

  const walletsQuery = useMemo(() => {
    if (!Array.isArray(filters.wallets) || filters.wallets.length === 0) {
      return undefined;
    }

    return filters.wallets.join(",");
  }, [filters.wallets]);

  // Query for the controller
  const query = useMemo<CounterpartiesRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      transactionType: filters.transactionType,
      limit: currentLimit,
      timezone,
      ...(walletsQuery ? { wallets: walletsQuery } : {}),
    }),
    [
      filters.timePeriod,
      filters.transactionType,
      currentLimit,
      timezone,
      walletsQuery,
    ],
  );

  // Use standard chart controller
  const { data, loadingState, refetch } = useStandardChartController<
    CounterpartyActivityData,
    CounterpartiesRequestParams
  >({
    fetcher: fetchCounterpartyActivity,
    query,
    autoRefresh,
    refreshInterval,
    // onDataLoaded,
  });

  // Export functionality
  // const { exportChart } = useChartExportr({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'counterparty-activity',
  // });

  // Handle export
  // const handleExport = async (format: ExportFormat) => {
  //   const echartsInstance = chartRef.current?.getEchartsInstance();
  //   const chartInstance = echartsInstance ? (echartsInstance as any) : null;

  //   // Prepare CSV data
  //   const csvData = data ? [
  //     {
  //       id: 'transaction-count',
  //       name: 'Transaction Count',
  //       type: 'bar' as const,
  //       data: data.counterparties.map(cp => ({
  //         category: cp.name,
  //         value: cp.transactionCount,
  //       })),
  //       visible: true,
  //     },
  //     {
  //       id: 'total-volume',
  //       name: 'Total Volume',
  //       type: 'bar' as const,
  //       data: data.counterparties.map(cp => ({
  //         category: cp.name,
  //         value: cp.totalVolume,
  //       })),
  //       visible: true,
  //     }
  //   ] : [];

  //   exportChartr(format, chartInstance, csvData, filters);
  // };

  const counterpartyCountRanking = useMemo(() => {
    console.log("[CounterpartyActivity] Calculating counterpartyCountRanking. Data:", data);
    console.log("[CounterpartyActivity] isChartSuccess:", isChartSuccess(data, "counterparties"));
    
    if (!isChartSuccess(data, "counterparties")) {
      console.log("[CounterpartyActivity] No valid counterparty data");
      return [];
    }

    if (
      "counterpartiesByTransactionCount" in data &&
      data.counterpartiesByTransactionCount.length > 0
    ) {
      console.log("[CounterpartyActivity] Using counterpartiesByTransactionCount");
      return data.counterpartiesByTransactionCount;
    }

    console.log("[CounterpartyActivity] Using counterparties field");
    return data.counterparties;
  }, [data]);

  const counterpartyVolumeRanking = useMemo(() => {
    if (!isChartSuccess(data, "counterparties")) {
      return [];
    }

    if (
      "counterpartiesByVolume" in data &&
      data.counterpartiesByVolume.length > 0
    ) {
      return data.counterpartiesByVolume;
    }

    return data.counterparties;
  }, [data]);

  // Generate chart options for transaction counts
  const transactionCountOptions: EChartsOption = useMemo(() => {
    if (counterpartyCountRanking.length === 0) {
      return {};
    }

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Extract counterparty names and values
    const counterpartyNames = counterpartyCountRanking.map((cp) => cp.name);
    const transactionCounts = counterpartyCountRanking.map(
      (cp) => cp.transactionCount,
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
        formatter: (params: string | any[]) => {
          if (!Array.isArray(params) || params.length === 0) return "";

          const counterpartyName = params[0].axisValue;
          const count = params[0].value;

          return (
            createTooltipHeader(counterpartyName) +
            createTooltipRow(
              tr("charts.counterpartyActivityChart.transactionCount"),
              count.toLocaleString(),
              { color: params[0].color, showIndicator: true },
            )
          );
        },
      },
      legend: getMultiSeriesLegend(
        chartTheme,
        [tr("charts.counterpartyActivityChart.transactionCount")],
        false,
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: "category",
        data: counterpartyNames,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 45,
          interval: 0,
          formatter: (value: string) => {
            // Truncate long addresses/names
            return value.length > 20 ? `${value.substring(0, 17)}...` : value;
          },
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        name: tr("charts.counterpartyActivityChart.transactionCount"),
        position: "left",
        nameTextStyle: { color: chartTheme.textColor },
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toLocaleString(),
        },
      },
      series: [
        {
          name: tr("charts.counterpartyActivityChart.transactionCount"),
          type: "bar",
          data: transactionCounts,
          itemStyle: {
            color: chartTheme.colorPalette[0],
          },
          label: {
            show: true,
            position: "top",
            formatter: (params: { value: { toLocaleString: () => any; }; }) => params.value.toLocaleString(),
            fontSize: 10,
          },
        },
      ],
    };
  }, [counterpartyCountRanking, chartTheme, tr]);

  // Generate chart options for total volume
  const totalVolumeOptions: EChartsOption = useMemo(() => {
    if (counterpartyVolumeRanking.length === 0) {
      return {};
    }

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Extract counterparty names and values
    const counterpartyNames = counterpartyVolumeRanking.map((cp) => cp.name);
    const totalVolumes = counterpartyVolumeRanking.map((cp) => cp.totalVolume);

    return {
      ...baseOption,
      ...getChartGridConfig,
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: string | any[]) => {
          if (!Array.isArray(params) || params.length === 0) return "";

          const counterpartyName = params[0].axisValue;
          const volume = params[0].value;

          return (
            createTooltipHeader(counterpartyName) +
            createTooltipRow(
              tr("charts.counterpartyActivityChart.totalVolume"),
              formatCurrency(volume),
              { color: params[0].color, showIndicator: true },
            )
          );
        },
      },
      legend: getMultiSeriesLegend(
        chartTheme,
        [tr("charts.counterpartyActivityChart.totalVolume")],
        false,
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: "category",
        data: counterpartyNames,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 45,
          interval: 0,
          formatter: (value: string) => {
            // Truncate long addresses/names
            return value.length > 20 ? `${value.substring(0, 17)}...` : value;
          },
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        name: tr("charts.counterpartyActivityChart.totalVolume"),
        position: "left",
        nameTextStyle: { color: chartTheme.textColor },
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: [
        {
          name: tr("charts.counterpartyActivityChart.totalVolume"),
          type: "bar",
          data: totalVolumes,
          itemStyle: {
            color: "#24a148",
          },
          label: {
            show: true,
            position: "top",
            formatter: (params: { value: number; }) => formatCurrency(params.value),
            fontSize: 10,
          },
        },
      ],
    };
  }, [counterpartyVolumeRanking, chartTheme, tr]);

  // Handle limit change
  const handleLimitChange = (newLimit: number) => {
    setCurrentLimit(newLimit);
  };

  const selectStyle: React.CSSProperties = {
    padding: "0.5rem 1rem",
    fontSize: "0.75rem",
    border: "1px solid var(--cds-border-strong)",
    borderRadius: "0.25rem",
    background: "var(--cds-layer-02)",
    color: "var(--cds-text-primary)",
    cursor: "pointer",
    height: "2.5rem",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "var(--cds-text-secondary)",
  };

  const filterControls = (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <label htmlFor="counterparty-limit-select" style={labelStyle}>Top:</label>
      <select
        id="counterparty-limit-select"
        value={currentLimit}
        onChange={(e) => handleLimitChange(Number(e.target.value))}
        style={selectStyle}
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
      </select>
    </div>
  );

  // Render chart with wrapper
  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      onRetry={refetch}
      actions={filterControls}
      isEmpty={
        !isChartSuccess(data, "counterparties") ||
        counterpartyCountRanking.length === 0
      }
    >
      {/* Transaction counts chart */}
      {counterpartyCountRanking.length > 0 && (
        <div className={sharedStyles.chartSection}>
          <h3 className={sharedStyles.chartTitle}>
            {tr("charts.counterpartyActivityChart.transactionCount")}
          </h3>
          <ChartGridItem minHeight={minHeight}>
            <ReactECharts
              ref={transactionCountChartRef}
              option={transactionCountOptions}
              style={{
                height: "100%",
                width: "100%",
                minHeight: `${minHeight}px`,
              }}
              opts={{ renderer: "canvas" }}
              notMerge={true}
            />
          </ChartGridItem>
        </div>
      )}

      {/* Total volume chart */}
      {counterpartyVolumeRanking.length > 0 && (
        <div className={sharedStyles.chartSection} style={{ marginTop: '32px' }}>
          <h3 className={sharedStyles.chartTitle}>
            {tr("charts.counterpartyActivityChart.totalVolume")}
          </h3>
          <ChartGridItem minHeight={minHeight}>
            <ReactECharts
              ref={totalVolumeChartRef}
              option={totalVolumeOptions}
              style={{
                height: "100%",
                width: "100%",
                minHeight: `${minHeight}px`,
              }}
              opts={{ renderer: "canvas" }}
              notMerge={true}
            />
          </ChartGridItem>
        </div>
      )}
    </BaseChart>
  );
};
