/**
 * AverageRollingAnnualReturn Chart Component
 * 
 * Displays a box plot chart showing average rolling annual return statistics by wallet,
 * providing comprehensive return distribution analysis.
 * 
 * Features:
 * - Box plot visualization showing min, Q1, median, Q3, max returns
 * - Per-wallet return distribution comparison
 * - Time unit selection (month, quarter, year, custom)
 * - Time period filtering
 * - Wallet filtering support
 * - Auto-refresh every 30 seconds
 * - Interactive tooltips with detailed statistics
 * 
 * @module components/charts/AverageRollingAnnualReturn
 */

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { formatItemTooltip } from '@/util/tooltip-helpers';

import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAverageRollingAnnualReturn } from '@/services/chart/chartApi';
import type { AverageRollingAnnualReturnResponse, AverageRollingAnnualReturnRequestParams } from '@/types/chart-api.types';

import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import sharedStyles from '../shared/ChartStyle.module.scss';
import type { ChartProps } from '../shared/ChartProp';

export type TimeUnit = 'month' | 'quarter' | 'year' | 'custom';

/**
 * AverageRollingAnnualReturn Component
 * 
 * Displays box plot chart showing average rolling annual return distribution by wallet.
 */
export const AverageRollingAnnualReturn: React.FC<ChartProps> = ({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: '1Y',
    wallets: [],
    timeUnit: 'month',
    windowSize: 30,
  },
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}) => {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.averageRollingAnnualReturn.title', 'Average Rolling Annual Return');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  
  // Extract initial values
  const initialTimeUnit = 
    initialFilters?.timeUnit === 'month' ||
    initialFilters?.timeUnit === 'quarter' ||
    initialFilters?.timeUnit === 'year' ||
    initialFilters?.timeUnit === 'custom'
      ? initialFilters.timeUnit
      : 'month';
  const initialWindowSize = typeof initialFilters?.windowSize === 'number' ? initialFilters.windowSize : 30;
  const initialWallets = Array.isArray(initialFilters?.wallets) ? initialFilters.wallets : undefined;
  
  // State for time unit and window size
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<TimeUnit>(initialTimeUnit);
  const [windowSize, setWindowSize] = useState<number>(initialWindowSize);

  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);

  const { filters, setTimePeriod, setWallets } = useChartFilters({
    initialFilters: {
      timePeriod: initialFilters?.timePeriod || '1Y',
      wallets: initialWallets,
    },
    debounceDelay: 300,
  });

  /**
   * Sync filters when initialFilters changes
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;
    
    // Check if wallets changed
    if (initialFilters?.wallets && Array.isArray(initialFilters.wallets)) {
      const prevWallets = Array.isArray(prevFilters?.wallets) ? prevFilters.wallets : [];
      const prevWalletsStr = prevWallets.slice().sort().join(',');
      const newWalletsStr = initialFilters.wallets.slice().sort().join(',');
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
   */
  const walletsString = useMemo(() => {
    if (!filters.wallets || !Array.isArray(filters.wallets) || filters.wallets.length === 0) return undefined;
    return filters.wallets.slice().sort().join(',');
  }, [filters.wallets]);

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<AverageRollingAnnualReturnRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
      timeUnit: selectedTimeUnit,
      windowSize: selectedTimeUnit === 'custom' ? windowSize : undefined,
    }),
    [filters.timePeriod, walletsString, selectedTimeUnit, windowSize]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<AverageRollingAnnualReturnResponse, AverageRollingAnnualReturnRequestParams>({
      fetcher: fetchAverageRollingAnnualReturn,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate eCharts option configuration for box plot
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (!data || !data.wallets || data.wallets.length === 0) return null;

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Filter valid wallets
    const validWallets = data.wallets.filter(
      wallet => wallet && wallet.walletName && wallet.returns
    );
    
    if (validWallets.length === 0) return null;
    
    // Prepare categories (wallet names)
    const categories = validWallets.map(w => w.walletAddress);
    
    // Prepare box plot data
    const boxData = validWallets.map(w => [
      w.returns.min,
      w.returns.q1,
      w.returns.median,
      w.returns.q3,
      w.returns.max,
    ]);
    
    return {
      ...baseOption,
      color: ['#5470C6'], // Blue for returns
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '15%',
        containLabel: true,
      },
      legend: {
        ...baseOption.legend,
        show: false,
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
        name: t('charts.averageRollingAnnualReturn.returnPercent', 'Return') + ' (%)',
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => `${value.toFixed(1)}%`,
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
          name: t('charts.averageRollingAnnualReturn.returns', 'Returns'),
          type: 'boxplot',
          data: boxData,
          itemStyle: {
            color: '#5470C6',
            borderColor: '#5470C6',
          },
          tooltip: {
            ...baseOption.tooltip,
            formatter: (param: any) => {
              const [min, q1, median, q3, max] = param.data;
              const wallet = validWallets[param.dataIndex];
              const avg = wallet.averageReturn;
              
              return formatItemTooltip(param.name, [
                { label: 'Average', value: `${avg.toFixed(2)}%` },
                { label: 'Max', value: `${max.toFixed(2)}%` },
                { label: 'Q3', value: `${q3.toFixed(2)}%` },
                { label: 'Median', value: `${median.toFixed(2)}%` },
                { label: 'Q1', value: `${q1.toFixed(2)}%` },
                { label: 'Min', value: `${min.toFixed(2)}%` },
              ]);
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
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']} ${sharedStyles['chartControls--withBackground']}`}>
        <select 
          value={selectedTimeUnit} 
          onChange={e => setSelectedTimeUnit(e.target.value as TimeUnit)} 
          className={sharedStyles.chartSelect}
        >
          <option value="month">{t('charts.averageRollingAnnualReturn.month', 'Month')}</option>
          <option value="quarter">{t('charts.averageRollingAnnualReturn.quarter', 'Quarter')}</option>
          <option value="year">{t('charts.averageRollingAnnualReturn.year', 'Year')}</option>
          <option value="custom">{t('charts.averageRollingAnnualReturn.custom', 'Custom')}</option>
        </select>

        {selectedTimeUnit === 'custom' && (
          <input
            type="number"
            value={windowSize}
            onChange={e => setWindowSize(Number(e.target.value))}
            min={1}
            max={365}
            className={sharedStyles.chartInput}
            placeholder={t('charts.averageRollingAnnualReturn.days', 'Days')}
          />
        )}
      </div>

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
};
