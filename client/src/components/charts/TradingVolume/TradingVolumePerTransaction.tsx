import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import sharedStyles from '@/components/charts/shared/ChartStyle.module.scss';
import { PERIOD_OPTIONS } from '@/config/periodOptions';
import { PeriodSelector } from '@/components/common/PeriodSelector/PeriodSelector';
import { fetchTradingVolumePerTransaction, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency, isChartSuccess } from '@/util/chart-helpers';
import { formatItemTooltip } from '@/util/tooltip-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import type { TradingVolumePerTransactionRequestParams } from '@/types/chart-api.types';

type TradingVolumePerTransactionData = InferFetcherData<typeof fetchTradingVolumePerTransaction>;
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import type { TimePeriod } from '@/types/chart-filters.types';

export function TradingVolumePerTransaction({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: '30D',
    tokens: [],
    wallets: []
  },
  autoRefresh = true,
  refreshInterval = 30000,
  // onDataLoaded,
  className,
}: ChartProps) {
  const { tr } = useLocalization();
  const chartTitle = title || tr('charts.tradingVolumePerTransactionChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Use centralized filter sync hook
  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<TradingVolumePerTransactionRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
      type: 'all',
    }),
    [filters.timePeriod, walletsString]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<TradingVolumePerTransactionData, TradingVolumePerTransactionRequestParams>({
      fetcher: fetchTradingVolumePerTransaction,
      query,
      autoRefresh,
      refreshInterval,
      // onDataLoaded,
    });

  /**
   * Generate eCharts option configuration for box plot
   */
  const chartOption = useMemo((): EChartsOption | null => {
    //if (!isChartSuccess(data, 'wallets') || data.wallets.length === 0) return null;
    if (!data || !data.wallets || !Array.isArray(data.wallets) || data.wallets.length === 0) {
      return null;
    }

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Prepare categories (wallet names)
    const categories = data.wallets.map(w => w.wallet);
    const tradingVolumePerTransactionData = data.wallets.map(w => w.tradingVolumePerTransaction);

    // Prepare box plot data
    // Each wallet will have two box plots: deposits and withdrawals
    // const depositData = data.wallets.map(w => [
    //   w.tradingVolumePerTransaction
    // ]);

    // const withdrawData = data.wallets.map(w => [
    //   w.withdraw.min,
    //   w.withdraw.q1,
    //   w.withdraw.median,
    //   w.withdraw.q3,
    //   w.withdraw.max,
    // ]);

    return {
      ...baseOption,
      color: ['#5470C6', '#91CC75'], // Blue for deposits, Green for withdrawals
      grid: {
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '20%',
        containLabel: true,
      },
      //   barGap: '0%', // Reduce gap between deposit and withdrawal boxes
      //   barCategoryGap: '60%', // Gap between wallet categories
      legend: getMultiSeriesLegend(
        chartTheme,
        ['Deposits', 'Withdrawals'],
        false
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
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
        type: 'value',
        name: tr('charts.tradingVolumePerTransactionChart.volume'),
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: chartTheme.splitLineColor,
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Trading Volume per Transaction',
          type: 'bar',
          data: tradingVolumePerTransactionData,
          itemStyle: {
            color: chartTheme.colorPalette[0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => formatCurrency(params.value),
            color: chartTheme.textColor,
          },
        }
        // {
        //   name: 'Deposits',
        //   type: 'boxplot',
        //   data: depositData,
        //   itemStyle: {
        //     color: '#5470C6',
        //     borderColor: '#5470C6',
        //   },
        //   tooltip: {
        //     ...baseOption.tooltip,
        //     formatter: (param: any) => {
        //       const [min, q1, median, q3, max] = param.data;
        //       return formatItemTooltip(`${param.name} - Deposits`, [
        //         { label: 'Max', value: formatCurrency(max) },
        //         { label: 'Q3', value: formatCurrency(q3) },
        //         { label: 'Median', value: formatCurrency(median) },
        //         { label: 'Q1', value: formatCurrency(q1) },
        //         { label: 'Min', value: formatCurrency(min) },
        //       ]);
        //     },
        //   },
        // },
        // {
        //   name: 'Withdrawals',
        //   type: 'boxplot',
        //   data: withdrawData,
        //   itemStyle: {
        //     color: '#91CC75',
        //     borderColor: '#91CC75',
        //   },
        //   tooltip: {
        //     ...baseOption.tooltip,
        //     formatter: (param: any) => {
        //       const [min, q1, median, q3, max] = param.data;
        //       return formatItemTooltip(`${param.name} - Withdrawals`, [
        //         { label: 'Max', value: formatCurrency(max) },
        //         { label: 'Q3', value: formatCurrency(q3) },
        //         { label: 'Median', value: formatCurrency(median) },
        //         { label: 'Q1', value: formatCurrency(q1) },
        //         { label: 'Min', value: formatCurrency(min) },
        //       ]);
        //     },
        //   },
        // },
      ],
      tooltip: {
        trigger: 'item',
        axisPointer: {
          type: 'shadow',
        },
      },
    };
  }, [data, chartTheme, tr]);

  return (
    <BaseChart
      title={chartTitle}
      // height="100%"
      loadingState={loadingState}
      isEmpty={
        !data ||
        !data.wallets ||
        !Array.isArray(data.wallets) ||
        data.wallets.length === 0 ||
        (data.wallets as any).error
      }
      onRetry={() => refetch(false)}
    >
      <div className={sharedStyles.chartControls}>
        <PeriodSelector value={filters.timePeriod} onChange={(k) => setTimePeriod(k)} compact />
      </div>
      {chartOption && (
        <ChartGridItem minHeight={minHeight}>
          <ReactECharts
            ref={chartRef}
            option={chartOption}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            notMerge
            lazyUpdate
          />
        </ChartGridItem>
      )}
    </BaseChart>
  );
}
