import { PeriodSelector } from "@/components/common/PeriodSelector/PeriodSelector";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import {
  fetchTotalTradingVolume,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { TotalTradingVolumeRequestParams } from "@/types/chart-api.types";
import { formatItemTooltip } from "@/util/tooltip-helpers";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef } from "react";
import { ChartWrapper, ChartGridItem } from "../shared";
import type { ChartProps } from "../shared/ChartProp";

type TotalTradingVolumeResponse = InferFetcherData<
  typeof fetchTotalTradingVolume
>;

export function TotalTradingVolumeChart({
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
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.totalTradingVolumeChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();

  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<TotalTradingVolumeRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString],
  );

  const { data, loadingState, refetch } = useStandardChartController<
    TotalTradingVolumeResponse,
    TotalTradingVolumeRequestParams
  >({
    fetcher: fetchTotalTradingVolume,
    query,
    autoRefresh,
    refreshInterval,
    enabled: fetchEnabled,
  });

  const chartOption = useMemo((): EChartsOption | null => {
    if (
      !data ||
      !data.wallets ||
      !Array.isArray(data.wallets) ||
      data.wallets.length === 0 ||
      "error" in data.wallets
    ) {
      return null;
    }

    const wallets = [...data.wallets].sort(
      (a, b) => (b.tradingVolumeUsd ?? 0) - (a.tradingVolumeUsd ?? 0),
    );
    const categories = wallets.map(
      (w, i) => `#${i + 1} ${w.wallet.slice(0, 6)}...${w.wallet.slice(-4)}`,
    );
    const totalVolumes = wallets.map((w) => w.tradingVolumeUsd ?? 0);

    return {
      ...baseOption,
      legend: { show: false },
      xAxis: {
        ...baseOption.xAxis,
        type: "value",
        name: `Volume (${data.metadata?.currency || "USD"})`,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => fmt.num.compact.currency(value),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "category",
        data: categories,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          interval: 0,
        },
        inverse: true,
      },
      series: [
        {
          name: "Total Volume",
          type: "bar",
          data: totalVolumes,
          itemStyle: {
            color: CHART_COLOR_PALETTE[0],
          },
          label: {
            show: true,
            position: "right",
            formatter: (params: any) => fmt.num.compact.currency(params.value),
            color: baseOption.textStyle.color,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const wallet = wallets[params[0].dataIndex];
          return formatItemTooltip(wallet.wallet, [
            {
              label: "Total Volume",
              value: fmt.num.compact.currency(wallet.tradingVolumeUsd ?? 0),
            },
          ]);
        },
      },
    };
  }, [data, baseOption, fmt]);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={
        !data ||
        !data.wallets ||
        !Array.isArray(data.wallets) ||
        data.wallets.length === 0 ||
        (data.wallets as any).error
      }
      onRetry={() => refetch(false)}
      toolbarLayout="stacked"
      actions={
        <PeriodSelector
          value={filters.timePeriod}
          onChange={(k) => setTimePeriod(k)}
        />
      }
    >
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
    </ChartWrapper>
  );
}
