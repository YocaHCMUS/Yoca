import { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchTradingVolumePerTransaction } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import type { TradingVolumePerTransactionResponse, TradingVolumePerTransactionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import type { ChartProps } from '../shared/ChartProp';

export function TradingVolumePerTransaction({
  title,
  minHeight = 400,
  initialFilters = {
    initialTimePeriod: '30D',
    initialTokens: [],
    wallets: []
  },
  autoRefresh = true,
  refreshInterval = 30000,
  // onDataLoaded,
  className,
}: ChartProps) {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.tradingVolumePerTransactionChart.title', 'Trading Volume Per Transaction');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, setTimePeriod, setTokens, setWallets, isValid } = useChartFilters({
    initialFilters: initialFilters,
    debounceDelay: 300,
  });

  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);



  /**
   * Sync filters when initialFilters changes (e.g., wallet selection from parent)
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;
    
    // Check if wallets changed
    if (initialFilters?.wallets) {
      const prevWalletsStr = prevFilters?.wallets?.sort().join(',') ?? '';
      const newWalletsStr = initialFilters.wallets.sort().join(',');
      if (prevWalletsStr !== newWalletsStr) {
        setWallets(initialFilters.wallets);
      }
    }
    
    // Check if time period changed
    if (initialFilters?.timePeriod && prevFilters?.timePeriod !== initialFilters.timePeriod) {
      setTimePeriod(initialFilters.timePeriod);
    }
    
    // Update ref for next comparison
    prevInitialFiltersRef.current = initialFilters;
  }, [initialFilters, setWallets, setTimePeriod]);
  
    /**
     * Memoize wallets string to prevent unnecessary re-fetches
     * Only changes when wallet addresses actually change, not on array reference change
     */
  const walletsString = useMemo(() => {
    if (!filters.wallets || filters.wallets.length === 0) return undefined;
    return filters.wallets.sort().join(',');
  }, [filters.wallets]);

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
    useStandardChartController<TradingVolumePerTransactionResponse, TradingVolumePerTransactionRequestParams>({
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
    if (!data || !data.wallets || data.wallets.length === 0) return null;

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Prepare categories (wallet names)
    const categories = data.wallets.map(w => w.walletName);
    
    // Prepare box plot data
    // Each wallet will have two box plots: deposits and withdrawals
    const depositData = data.wallets.map(w => [
      w.deposit.min,
      w.deposit.q1,
      w.deposit.median,
      w.deposit.q3,
      w.deposit.max,
    ]);
    
    const withdrawData = data.wallets.map(w => [
      w.withdraw.min,
      w.withdraw.q1,
      w.withdraw.median,
      w.withdraw.q3,
      w.withdraw.max,
    ]);
    
    return {
      ...baseOption,
      color: ['#5470C6', '#91CC75'], // Blue for deposits, Green for withdrawals
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '15%',
        containLabel: true,
      },
    //   barGap: '0%', // Reduce gap between deposit and withdrawal boxes
    //   barCategoryGap: '60%', // Gap between wallet categories
      legend: {
        ...baseOption.legend,
        show: true,
        top: '5%',
        left: 'center',
        data: ['Deposits', 'Withdrawals'],
      },
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
        name: t('charts.tradingVolumePerTransactionChart.volume', 'Volume (USD)'),
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
          name: 'Deposits',
          type: 'boxplot',
          data: depositData,
          itemStyle: {
            color: '#5470C6',
            borderColor: '#5470C6',
          },
          tooltip: {
            formatter: (param: any) => {
              const [min, q1, median, q3, max] = param.data;
              return `
                <div style="font-weight: 600; margin-bottom: 8px; text-align: left;">${param.name} - Deposits</div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Max:</span><strong>${formatCurrency(max)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Q3:</span><strong>${formatCurrency(q3)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Median:</span><strong>${formatCurrency(median)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Q1:</span><strong>${formatCurrency(q1)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Min:</span><strong>${formatCurrency(min)}</strong>
                </div>
              `;
            },
          },
        },
        {
          name: 'Withdrawals',
          type: 'boxplot',
          data: withdrawData,
          itemStyle: {
            color: '#91CC75',
            borderColor: '#91CC75',
          },
          tooltip: {
            formatter: (param: any) => {
              const [min, q1, median, q3, max] = param.data;
              return `
                <div style="font-weight: 600; margin-bottom: 8px; text-align: left;">${param.name} - Withdrawals</div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Max:</span><strong>${formatCurrency(max)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Q3:</span><strong>${formatCurrency(q3)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Median:</span><strong>${formatCurrency(median)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Q1:</span><strong>${formatCurrency(q1)}</strong>
                </div>
                <div style="margin-top: 4px; display: flex; justify-content: space-between; gap: 16px;">
                  <span>Min:</span><strong>${formatCurrency(min)}</strong>
                </div>
              `;
            },
          },
        },
      ],
      tooltip: {
        trigger: 'item',
        axisPointer: {
          type: 'shadow',
        },
      },
    };
  }, [data, chartTheme, t]);

  return (
    <BaseChart
      title={chartTitle}
      // height="100%"
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      {chartOption && (
        <ReactECharts
          ref={chartRef}
          option={chartOption}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          notMerge
          lazyUpdate
        />
      )}
    </BaseChart>
  );
}
