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
import { ChartColumn, ChartCombo, ChartLineData } from "@carbon/react/icons";
import { BaseChart } from "../Base/BaseChart";
import sharedStyles from "@/components/charts/shared/ChartStyle.module.scss";

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
  const [displayMode, setDisplayMode] = useState<"daily" | "cumulative" | "both">(
    initialViewMode,
  );
  const [chartTimePeriod, setChartTimePeriod] = useState<"7D" | "30D">("30D");

  const { walletsString } = useChartFiltersSync({
    initialFilters: initialFilters || {
      wallets: initialWallets.length > 0 ? initialWallets : undefined,
    },
    debounceDelay: 300,
  });

  const query = useMemo<PnLRequestParams>(
    () => ({
      period: chartTimePeriod,
      wallets: walletsString,
    }),
    [chartTimePeriod, walletsString],
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

  const handleDisplayModeChange = useCallback(
    (mode: "daily" | "cumulative" | "both") => {
      setDisplayMode(mode);
    },
    [],
  );

  const handleChartPeriodChange = useCallback(
    (nextPeriod: "7D" | "30D") => {
      if (nextPeriod === chartTimePeriod) {
        refetch(true);
        return;
      }

      setChartTimePeriod(nextPeriod);
    },
    [chartTimePeriod, refetch],
  );

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
      const combinedValues = [...dailyValues, ...cumulativeValues];

      const calculateSharedAxisBounds = (values: number[]) => {
        const minValue = Math.min(...values, 0);
        const maxValue = Math.max(...values, 0);
        const spread =
          maxValue - minValue ||
          Math.max(Math.abs(minValue), Math.abs(maxValue)) ||
          1;
        const padding = spread * 0.12;

        return {
          min: minValue - padding,
          max: maxValue + padding,
        };
      };

      const sharedAxisBounds =
        displayMode === "both"
          ? calculateSharedAxisBounds(combinedValues)
          : undefined;

      const xAxisData = timestamps.map((ts) =>
        formatTimestampWithTimezone(ts, timezone, "MM/dd"),
      );
      const showDaily = displayMode === "daily" || displayMode === "both";
      const showCumulative = displayMode === "cumulative" || displayMode === "both";

      const series: any[] = [];

      if (showDaily) {
        series.push({
          name: tr("charts.pnlChart.dailyPnL"),
          type: "bar",
          yAxisIndex: displayMode === "both" ? 0 : undefined,
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
          yAxisIndex: displayMode === "both" ? 1 : undefined,
          data: cumulativeValues,
          smooth: false,
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
      if (displayMode === "both") {
        yAxis.push({
          ...baseOption.yAxis,
          type: "value",
          name: tr("charts.pnlChart.dailyPnL"),
          position: "left",
          min: sharedAxisBounds?.min,
          max: sharedAxisBounds?.max,
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
          min: sharedAxisBounds?.min,
          max: sharedAxisBounds?.max,
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
            displayMode === "daily"
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
        legend: undefined
      };
    },
    [chartTheme, timezone, tr, displayMode, fmt],
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
  //  <span>{tr("charts.pnlChart.displayedData")}</span>
  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      onRetry={() => refetch(false)}
    >
      <div className={`${sharedStyles.chartControls} ${sharedStyles.balanceChartControlArea}`}>
        <div className={sharedStyles.balanceChartControlTopRow} data-html2canvas-ignore="true">
          <div className={sharedStyles.balanceChartControlInputGroup}>
            <button
              type="button"
              className={`${sharedStyles.chartToggleButton} ${displayMode === "daily" ? sharedStyles.active : ""}`}
              onClick={() => handleDisplayModeChange("daily")}
              aria-label={tr("charts.pnlChart.dailyPnL")}
              title={tr("charts.pnlChart.dailyPnL")}
              aria-pressed={displayMode === "daily"}
            >
              <ChartColumn size={18} />
            </button>
            <button
              type="button"
              className={`${sharedStyles.chartToggleButton} ${displayMode === "cumulative" ? sharedStyles.active : ""}`}
              onClick={() => handleDisplayModeChange("cumulative")}
              aria-label={tr("charts.pnlChart.cumulativePnL")}
              title={tr("charts.pnlChart.cumulativePnL")}
              aria-pressed={displayMode === "cumulative"}
            >
              <ChartLineData size={18} />
            </button>
            <button
              type="button"
              className={`${sharedStyles.chartToggleButton} ${displayMode === "both" ? sharedStyles.active : ""}`}
              onClick={() => handleDisplayModeChange("both")}
              aria-label={tr("charts.pnlChart.both")}
              title={tr("charts.pnlChart.both")}
              aria-pressed={displayMode === "both"}
            >
              <ChartCombo size={18} />
            </button>
          </div>

          <div className={sharedStyles.balanceChartWindowToggleGroup}>
            <button
              type="button"
              className={`${sharedStyles.chartToggleButton} ${sharedStyles.balanceChartWindowButton} ${chartTimePeriod === "7D" ? sharedStyles.balanceChartWindowButtonActive : ""}`}
              onClick={() => handleChartPeriodChange("7D")}
              aria-pressed={chartTimePeriod === "7D"}
            >
              {tr("charts.balanceChart.window7d")}
            </button>
            <button
              type="button"
              className={`${sharedStyles.chartToggleButton} ${sharedStyles.balanceChartWindowButton} ${chartTimePeriod === "30D" ? sharedStyles.balanceChartWindowButtonActive : ""}`}
              onClick={() => handleChartPeriodChange("30D")}
              aria-pressed={chartTimePeriod === "30D"}
            >
              {tr("charts.balanceChart.window30d")}
            </button>
          </div>
        </div>
      </div>

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
