import { useChartContext } from "@/contexts/ChartContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import {
  fetchStablecoinRatio,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { StablecoinRatioRequestParams } from "@/types/chart-api.types";
import {
  formatTimestampWithTimezone,
  isChartSuccess,
} from "@/util/chart-helpers";
import { formatAxisTooltip } from "@/util/tooltip-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef } from "react";
import { ChartWrapper, ChartContainer, ChartGridItem, ChartSection, ChartStatsHeader } from "../shared";
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
  fetchEnabled = true,
  className,
}: ChartProps) {
  const { tr } = useLocalization();
  const chartTitle = title || tr("charts.stablecoinRatioChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<StablecoinRatioRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString],
  );

  const { data, loadingState, refetch } = useStandardChartController<
    StablecoinRatioData,
    StablecoinRatioRequestParams
  >({
    fetcher: fetchStablecoinRatio,
    query,
    autoRefresh,
    refreshInterval,
    enabled: fetchEnabled,
  });

  const chartOption = useMemo((): EChartsOption | null => {
    const base = baseOption;

    if (!isChartSuccess(data, "wallets")) return null;

    const series = data.wallets.map((wallet, index) => {
      const color =
        CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length];

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
      ...base,
      xAxis: {
        ...base.xAxis,
        type: "time",
        axisLabel: {
          ...base.xAxis.axisLabel,
          formatter: (value: number) =>
            formatTimestampWithTimezone(value, timezone, "MM/dd"),
        },
      },
      yAxis: {
        ...base.yAxis,
        type: "value",
        name: "Stablecoin Ratio (%)",
        min: 0,
        max: 100,
        axisLabel: {
          ...base.yAxis.axisLabel,
          formatter: "{value}%",
        },
      },
      series: series,
      legend: {
        show: true,
        data: data.wallets.map((w) => w.walletAddress),
        textStyle: { color: base.textStyle.color },
      },
      tooltip: {
        ...base.tooltip,
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
  }, [data, baseOption, timezone]);

  const statsCards = useMemo<StatCard[]>(() => {
    if (!isChartSuccess(data, "wallets") || data.wallets.length === 0)
      return [];

    return data.wallets.map((wallet) => ({
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
    <ChartWrapper
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
    </ChartWrapper>
  );
}
