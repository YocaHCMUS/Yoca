import { ChartGrid, ChartGridItem } from "@/components/charts/shared";
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
  fetchPnLChart,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { PnLRequestParams } from "@/types/chart-api.types";
import {
  formatTimestampWithTimezone,
} from "@/util/chart-helpers";
import { createTooltipHeader, createTooltipRow } from "@/util/tooltip-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { BaseChart } from "../Base/BaseChart";

type PnLChartData = InferFetcherData<typeof fetchPnLChart>;

export interface PnLChartProps {
  title?: string;
  minHeight?: number;
  initialWallets?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
  initialViewMode?: "daily" | "cumulative" | "both";
  initialFilters?: {
    wallets?: string[];
  };

  /** When false, no chart fetch (inactive comparison tab). */
  fetchEnabled?: boolean;
}

export const PnLChart: React.FC<PnLChartProps> = ({
  title,
  minHeight = 400,
  initialWallets = [],
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  initialViewMode = "both",
  initialFilters,
  fetchEnabled = true,
}) => {
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.pnlChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  const [viewMode, setViewMode] = useState<"daily" | "cumulative" | "both">(
    initialViewMode,
  );

  const { walletsString } = useChartFiltersSync({
    initialFilters: initialFilters || {
      wallets: initialWallets.length > 0 ? initialWallets : undefined,
    },
    debounceDelay: 300,
  });

  const query = useMemo<PnLRequestParams>(
    () => ({
      period: "7D",
      wallets: walletsString,
      aggregation: "daily",
    }),
    [walletsString],
  );

  const { data, loadingState, refetch } = useStandardChartController<
    PnLChartData,
    PnLRequestParams
  >({
    fetcher: fetchPnLChart,
    query,
    autoRefresh,
    refreshInterval,
    enabled: fetchEnabled,
  });

  const displayData = data;

  const createChartOption = useCallback(
    (
      dailyPnLData: Array<{ timestamp: number; value: number }>,
      cumulativePnLData: Array<{ timestamp: number; value: number }>,
      walletLabel?: string,
    ): EChartsOption => {
      const profitColor = chartTheme.colorPalette[1];
      const lossColor = chartTheme.colorPalette[2];
      const cumulativeColor = chartTheme.colorPalette[0];
      const baseOption = getThemedChartBaseOption(chartTheme);

      const timestamps = dailyPnLData.map((item) => item.timestamp);
      const dailyValues = dailyPnLData.map((item) => item.value);
      const cumulativeValues = cumulativePnLData.map((item) => item.value);

      const xAxisData = timestamps.map((ts) =>
        formatTimestampWithTimezone(ts, timezone, "MM/dd"),
      );
      const showDaily = viewMode === "daily" || viewMode === "both";
      const showCumulative = viewMode === "cumulative" || viewMode === "both";

      const series: any[] = [];

      if (showDaily) {
        series.push({
          name: tr("charts.pnlChart.dailyPnL"),
          type: "bar",
          yAxisIndex: viewMode === "both" ? 0 : undefined,
          data: dailyValues,
          itemStyle: {
            color: (params: any) =>
              params.value >= 0 ? profitColor : lossColor,
          },
        });
      }

      if (showCumulative) {
        series.push({
          name: tr("charts.pnlChart.cumulativePnL"),
          type: "line",
          yAxisIndex: viewMode === "both" ? 1 : undefined,
          data: cumulativeValues,
          smooth: true,
          lineStyle: {
            color: cumulativeColor,
            width: 2,
          },
          itemStyle: {
            color: cumulativeColor,
          },
        });
      }

      const formatAxisValue = (value: number) => {
        return fmt.num.compact.currency(value);
      };

      const yAxis: any[] = [];
      if (viewMode === "both") {
        yAxis.push({
          ...baseOption.yAxis,
          type: "value",
          name: tr("charts.pnlChart.dailyPnL"),
          position: "left",
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: formatAxisValue,
          },
        });
        yAxis.push({
          ...baseOption.yAxis,
          type: "value",
          name: tr("charts.pnlChart.cumulativePnL"),
          position: "right",
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: formatAxisValue,
          },
          splitLine: { show: false },
        });
      } else {
        yAxis.push({
          ...baseOption.yAxis,
          type: "value",
          name:
            viewMode === "daily"
              ? tr("charts.pnlChart.dailyPnL")
              : tr("charts.pnlChart.cumulativePnL"),
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: formatAxisValue,
          },
        });
      }

      return {
        ...baseOption,
        title: walletLabel
          ? {
            text: walletLabel,
            left: 8,
            top: 8,
            textStyle: {
              color: chartTheme.textColor,
              fontSize: 16,
              fontWeight: "bold",
            },
          }
          : undefined,
        ...getChartGridConfig,
        tooltip: {
          ...baseOption.tooltip,
          trigger: "axis",
          formatter: (params: any) => {
            if (!Array.isArray(params) || params.length === 0) return "";

            const timestamp = timestamps[params[0].dataIndex];
            const date = formatTimestampWithTimezone(
              timestamp,
              timezone,
              "PPP",
            );
            const dailyValue = dailyValues[params[0].dataIndex];
            const cumulativeValue = cumulativeValues[params[0].dataIndex];

            let tooltipContent = createTooltipHeader(date);

            if (showDaily) {
              tooltipContent += createTooltipRow(
                tr("charts.pnlChart.dailyPnL"),
                fmt.num.compact.currency(dailyValue),
                { valueColor: dailyValue >= 0 ? profitColor : lossColor },
              );
            }

            if (showCumulative) {
              tooltipContent += createTooltipRow(
                tr("charts.pnlChart.cumulativePnL"),
                fmt.num.compact.currency(cumulativeValue),
              );
            }

            return tooltipContent;
          },
        },
        xAxis: [
          {
            ...baseOption.xAxis,
            type: "category",
            data: xAxisData,
          },
        ],
        yAxis,
        series,
      };
    },
    [chartTheme, timezone, tr, viewMode, fmt],
  );

  const chartOptions = useMemo(() => {
    if (!displayData || "error" in displayData) return [];

    if (
      "wallets" in displayData &&
      displayData.wallets &&
      displayData.wallets.length > 0
    ) {
      return displayData.wallets.map((wallet) => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.dailyPnL,
          wallet.cumulativePnL,
          displayData.wallets.length > 1 ? `${wallet.walletAddress.slice(0, 8)}...` : undefined,
        ),
      }));
    }

    if (
      "dailyPnL" in displayData &&
      displayData.dailyPnL &&
      displayData.dailyPnL.length > 0
    ) {
      return [
        {
          walletAddress: "aggregated",
          option: createChartOption(
            displayData.dailyPnL,
            displayData.cumulativePnL!,
            undefined,
          ),
        },
      ];
    }

    return [];
  }, [displayData, createChartOption]);

  const isEmpty =
    !displayData ||
    "error" in displayData ||
    ((!("wallets" in displayData) ||
      !displayData.wallets ||
      displayData.wallets.length === 0) &&
      (!("dailyPnL" in displayData) ||
        !displayData.dailyPnL ||
        displayData.dailyPnL.length === 0));

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      onRetry={() => refetch(false)}
    >
      {/* <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--between']} ${sharedStyles['chartControls--withBackground']}`}>
                <div className={sharedStyles['chartToggle--padded']}>
                    <button
                        className={`${sharedStyles.chartToggleButton} ${viewMode === 'daily' ? sharedStyles.active : ''}`}
                        onClick={() => setViewMode('daily')}
                        aria-label={tr('charts.pnlChart.dailyPnL')}
                        title={tr('charts.pnlChart.dailyPnL')}
                    >
                        {tr('charts.pnlChart.dailyPnL')}
                    </button>
                    <button
                        className={`${sharedStyles.chartToggleButton} ${viewMode === 'cumulative' ? sharedStyles.active : ''}`}
                        onClick={() => setViewMode('cumulative')}
                        aria-label={tr('charts.pnlChart.cumulativePnL')}
                        title={tr('charts.pnlChart.cumulativePnL')}
                    >
                        {tr('charts.pnlChart.cumulativePnL')}
                    </button>
                    <button
                        className={`${sharedStyles.chartToggleButton} ${viewMode === 'both' ? sharedStyles.active : ''}`}
                        onClick={() => setViewMode('both')}
                        aria-label={tr('charts.pnlChart.both')}
                        title={tr('charts.pnlChart.both')}
                    >
                        {tr('charts.pnlChart.both')}
                    </button>
                </div>
            </div> */}

      {chartOptions.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <ChartGrid itemCount={chartOptions.length} multiItemColumns={2}>
            {chartOptions.map((chartData, index) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={minHeight}
              >
                <ReactECharts
                  ref={index === 0 ? chartRef : undefined}
                  option={chartData.option}
                  style={{
                    height: "100%",
                    width: "100%",
                    minHeight: `${minHeight}px`,
                  }}
                  notMerge
                  lazyUpdate
                />
              </ChartGridItem>
            ))}
          </ChartGrid>
        </div>
      )}
    </BaseChart>
  );
};
