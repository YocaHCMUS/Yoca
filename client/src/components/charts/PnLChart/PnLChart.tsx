import { ChartGrid, ChartGridItem, ChartWrapper } from "@/components/charts/shared";
import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import {
  fetchPnLChart,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { PnLRequestParams } from "@/types/chart-api.types";
import {
  formatTimestampWithTimezone,
} from "@/util/chart-helpers";
import { createTooltipHeader, createTooltipRow } from "@/util/tooltip-helpers";
import { attachChartDayClick } from "@/util/chart-click";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentSwitcher, IconSwitch } from "@carbon/react";
import { ChartBar, ChartCombo, ChartLine } from "@carbon/icons-react";
import { Flex } from "@/components/Flex";
import { FilterSwitch } from "@/components/FilterSwitch";
import overwriteStyles from "@/styles/_overwrite.module.scss";

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
  fetchEnabled?: boolean;
  onDayClick?: (walletAddress: string, timestamp: number) => void;
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
  onDayClick,
}) => {
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.pnlChart.title");
  const chartMinHeight = Math.max(minHeight, 360);

  const chartRefMap = useRef(new Map<number, ReactECharts>());
  const baseOption = useCarbonChartBaseOption();
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
      const profitColor = CHART_COLOR_PALETTE[1];
      const lossColor = CHART_COLOR_PALETTE[2];
      const cumulativeColor = CHART_COLOR_PALETTE[0];

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
        legend: undefined,
        title: walletLabel
          ? {
            text: walletLabel,
            left: 8,
            top: 8,
            textStyle: {
              color: baseOption.textStyle.color,
              fontSize: 16,
              fontWeight: "bold",
            },
          }
          : undefined,
        grid: {
          ...baseOption.grid,
          top: walletLabel ? "3.5rem" : "2rem",
          left: "1.25rem",
          right: displayMode === "both" ? "2.75rem" : "1.5rem",
          bottom: "2rem",
          containLabel: true,
        },
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
    [baseOption, timezone, tr, displayMode, fmt],
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

  useEffect(() => {
    if (!onDayClick) return;

    const cleanups: (() => void)[] = [];

    chartOptions.forEach((entry, index) => {
      const reactECharts = chartRefMap.current.get(index);
      if (!reactECharts) return;

      const chartInstance = reactECharts.getEchartsInstance();

      const timestamps = displayData && "wallets" in displayData
        ? displayData.wallets[index]?.dailyPnL.map((p) => p.timestamp)
        : displayData && "dailyPnL" in displayData
          ? displayData.dailyPnL.map((p) => p.timestamp)
          : [];

      if (timestamps.length === 0) return;

      cleanups.push(
        attachChartDayClick(chartInstance, timestamps, (ts) => {
          onDayClick(entry.walletAddress, ts);
        }),
      );
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [onDayClick, chartOptions, displayData]);

  const isEmpty =
    !displayData ||
    "error" in displayData ||
    ((!("wallets" in displayData) ||
      !displayData.wallets ||
      displayData.wallets.length === 0) &&
      (!("dailyPnL" in displayData) ||
        !displayData.dailyPnL ||
        displayData.dailyPnL.length === 0));

  const displayModeIcons = [
    { value: "daily" as const, icon: ChartBar, label: tr("charts.pnlChart.dailyPnL") },
    { value: "cumulative" as const, icon: ChartLine, label: tr("charts.pnlChart.cumulativePnL") },
    { value: "both" as const, icon: ChartCombo, label: tr("charts.pnlChart.both") },
  ];

  const periodOptions = [
    { value: "7D" as const, label: tr("charts.balanceChart.window7d") },
    { value: "30D" as const, label: tr("charts.balanceChart.window30d") },
  ];

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      onRetry={() => refetch(false)}
      toolbarLayout="stacked"
      wrapperMinHeight={chartMinHeight}
      enableFullscreen={false}
      enableMiniPlayer={false}
      actions={
        <Flex gap={8} align="center">
          <ContentSwitcher
            className={overwriteStyles.fltrOpt}
            style={{ minWidth: 'auto' }}
            selectedIndex={displayModeIcons.findIndex(o => o.value === displayMode)}
            onChange={({ name }) => {
              if (name) handleDisplayModeChange(name as "daily" | "cumulative" | "both");
            }}
            size="md"
          >
            {displayModeIcons.map(opt => (
              <IconSwitch key={opt.value} name={opt.value} text={opt.label}>
                <opt.icon size={16} />
              </IconSwitch>
            ))}
          </ContentSwitcher>
          <FilterSwitch
            options={periodOptions}
            value={chartTimePeriod}
            onChange={(v) => handleChartPeriodChange(v as "7D" | "30D")}
            width={120}
          />
        </Flex>
      }
    >
      {chartOptions.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}
        >
          <ChartGrid itemCount={chartOptions.length} multiItemColumns={2}>
            {chartOptions.map((chartData, index) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={chartMinHeight}
              >
                <ReactECharts
                  ref={(el) => {
                    if (el) chartRefMap.current.set(index, el);
                    else chartRefMap.current.delete(index);
                  }}
                  option={chartData.option}
                  style={{
                    height: "100%",
                    width: "100%",
                    minHeight: `${chartMinHeight}px`,
                  }}
                  notMerge
                  lazyUpdate
                />
              </ChartGridItem>
            ))}
          </ChartGrid>
        </div>
      )}
    </ChartWrapper>
  );
};
