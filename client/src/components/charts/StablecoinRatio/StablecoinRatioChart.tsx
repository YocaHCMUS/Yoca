/**
 * Stablecoin Ratio Chart Component
 * 
 * Displays time series of stablecoin percentage in wallet portfolios
 * 
 * Features:
 * - Line chart showing stablecoin ratio over time
 * - Multiple wallet support (separate lines per wallet)
 * - Statistics showing current and average ratios
 * - Auto-refresh on wallet changes
 * - Timezone-aware date formatting
 * 
 * @module components/charts/StablecoinRatio
 */

import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchStablecoinRatio } from '@/services/chart/chartApi';
import { formatTimestampWithTimezone } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import type { StablecoinRatioResponse, StablecoinRatioRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import type { ChartProps } from '../shared/ChartProp';
import styles from './StablecoinRatio.module.scss';

export function StablecoinRatioChart({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: '30D',
    wallets: []
  },
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}: ChartProps) {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.stablecoinRatioChart.title', 'Stablecoin Ratio');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, setTimePeriod, setWallets } = useChartFilters({
    initialFilters: initialFilters,
    debounceDelay: 300,
  });

  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);

  /**
   * Sync filters when initialFilters changes
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;
    
    if (initialFilters?.wallets && Array.isArray(initialFilters.wallets)) {
      const prevWallets = Array.isArray(prevFilters?.wallets) ? prevFilters.wallets : [];
      const prevWalletsStr = prevWallets.slice().sort().join(',');
      const newWalletsStr = initialFilters.wallets.slice().sort().join(',');
      if (prevWalletsStr !== newWalletsStr) {
        setWallets(initialFilters.wallets);
      }
    }
    
    if (initialFilters?.timePeriod && prevFilters?.timePeriod !== initialFilters.timePeriod) {
      setTimePeriod(initialFilters.timePeriod);
    }
    
    prevInitialFiltersRef.current = initialFilters;
  }, [initialFilters, setWallets, setTimePeriod]);

  /**
   * Memoize wallets string
   */
  const walletsString = useMemo(() => {
    if (!filters.wallets || !Array.isArray(filters.wallets) || filters.wallets.length === 0) return undefined;
    return filters.wallets.slice().sort().join(',');
  }, [filters.wallets]);

  /**
   * Memoize query
   */
  const query = useMemo<StablecoinRatioRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString]
  );

  /**
   * Lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<StablecoinRatioResponse, StablecoinRatioRequestParams>({
      fetcher: fetchStablecoinRatio,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate chart option
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (!data || !data.wallets || data.wallets.length === 0) return null;

    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Prepare series data (one per wallet)
    const series = data.wallets.map((wallet, index) => {
      const color = chartTheme.colorPalette[index % chartTheme.colorPalette.length];
      
      return {
        name: wallet.walletName || wallet.walletAddress,
        type: 'line' as const,
        data: wallet.data.map(d => [d.timestamp, d.value]),
        smooth: true,
        lineStyle: {
          color: color,
          width: 2,
        },
        itemStyle: {
          color: color,
        },
        symbol: 'circle' as const,
        symbolSize: 6,
        showSymbol: false,
        emphasis: {
          focus: 'series' as const,
          showSymbol: true,
        },
      };
    });
    
    return {
      ...baseOption,
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatTimestampWithTimezone(value, timezone, 'MM/dd'),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: 'Stablecoin Ratio (%)',
        min: 0,
        max: 100,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: '{value}%',
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: chartTheme.splitLineColor,
            type: 'dashed',
          },
        },
      },
      series: series,
      legend: {
        ...baseOption.legend,
        show: data.wallets.length > 1,
        top: '5%',
        data: data.wallets.map(w => w.walletName || w.walletAddress),
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => formatAxisTooltip(
          params,
          (p) => formatTimestampWithTimezone(p.value[0], timezone, 'yyyy-MM-dd HH:mm'),
          (p) => `${p.value[1].toFixed(2)}%`
        ),
      },
    };
  }, [data, chartTheme, timezone, t]);

  /**
   * Generate statistics header
   */
  const statsHeader = useMemo(() => {
    if (!data || !data.wallets || data.wallets.length === 0) return null;

    return (
      <div className={styles.statsHeader}>
        {data.wallets.map((wallet, index) => (
          <div key={wallet.walletAddress} className={styles.statCard}>
            <div className={styles.walletName}>
              {wallet.walletName || wallet.walletAddress}
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Current Ratio</div>
                <div 
                  className={styles.statValue}
                  style={{ color: chartTheme.colorPalette[index % chartTheme.colorPalette.length] }}
                >
                  {wallet.currentRatio.toFixed(2)}%
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Average Ratio</div>
                <div className={styles.statValue}>
                  {wallet.averageRatio.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [data, chartTheme]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <div className={styles.stablecoinRatioContainer}>
        {statsHeader}
        <div className={styles.chartSection}>
          {chartOption && (
            <ReactECharts
              ref={chartRef}
              option={chartOption}
              style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
              notMerge
              lazyUpdate
            />
          )}
        </div>
      </div>
    </BaseChart>
  );
}
