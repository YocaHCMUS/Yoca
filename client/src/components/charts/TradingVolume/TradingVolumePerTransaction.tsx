import { PeriodSelector } from "@/components/common/PeriodSelector/PeriodSelector";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useStandardChartController } from "@/hooks/useChartController";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import {
  fetchTradingVolumePerTransaction,
  type InferFetcherData,
} from "@/services/chart/chartApi";
import type { TradingVolumePerTransactionRequestParams } from "@/types/chart-api.types";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef } from "react";
import { ChartWrapper, ChartGridItem } from "../shared";
import type { ChartProps } from "../shared/ChartProp";

type TradingVolumePerTransactionData = InferFetcherData<
  typeof fetchTradingVolumePerTransaction
>;

export function TradingVolumePerTransaction({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: "30D",
    tokens: [],
    wallets: [],
  },
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  className,
}: ChartProps) {
  const { tr, fmt } = useLocalization();
  const chartTitle =
    title || tr("charts.tradingVolumePerTransactionChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();

  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<TradingVolumePerTransactionRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
      type: "all",
    }),
    [filters.timePeriod, walletsString],
  );

  const { data, loadingState, refetch } = useStandardChartController<
    TradingVolumePerTransactionData,
    TradingVolumePerTransactionRequestParams
  >({
    fetcher: fetchTradingVolumePerTransaction,
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
      data.wallets.length === 0
    ) {
      return null;
    }

    const categories = data.wallets.map((w) => w.wallet);
    const values = data.wallets.map(
      (w) => w.tradingVolumePerTransaction,
    );

    return {
      ...baseOption,
      xAxis: {
        ...baseOption.xAxis,
        type: "category",
        data: categories,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          interval: 0,
          rotate: categories.length > 5 ? 45 : 0,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        name: tr("charts.tradingVolumePerTransactionChart.volume"),
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => fmt.num.compact.currency(value),
        },
      },
      series: [
        {
          name: "Trading Volume per Transaction",
          type: "bar",
          data: values,
          itemStyle: {
            color: CHART_COLOR_PALETTE[0],
          },
          label: {
            show: true,
            position: "top",
            formatter: (params: any) => fmt.num.compact.currency(params.value),
            color: baseOption.textStyle.color,
          },
        },
      ],
      tooltip: {
        ...baseOption.tooltip,
        trigger: "item",
        axisPointer: {
          type: "shadow",
        },
      },
    };
  }, [data, baseOption, tr, fmt]);

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
          compact
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
