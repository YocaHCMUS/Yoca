/**
 * Drawdown Chart Component
 * 
 * Displays drawdown analysis with:
 * - Line chart per wallet with fill effect
 * - Header showing maximum drawdown data and duration
 * 
 * Features:
 * - Multiple wallet support (separate lines per wallet)
 * - Fill effect below zero line
 * - Max drawdown statistics in header
 * - Auto-refresh on wallet changes
 * 
 * @module components/charts/Drawdown
 */

import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchDrawdown } from '@/services/chart/chartApi';
import { formatTimestampWithTimezone } from '@/util/chart-helpers';
import type { DrawdownResponse, DrawdownRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import type { ChartProps } from '../shared/ChartProp';
import styles from './Drawdown.module.scss';

export function DrawdownChart({
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
  const chartTitle = title || t('charts.drawdownChart.title', 'Drawdown Analysis');

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
  const query = useMemo<DrawdownRequestParams>(
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
    useStandardChartController<DrawdownResponse, DrawdownRequestParams>({
      fetcher: fetchDrawdown,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate drawdown chart option
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
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: `${color}80`, // Semi-transparent at top
              },
              {
                offset: 1,
                color: `${color}20`, // More transparent at bottom
              },
            ],
          },
        },
        symbol: 'none' as const,
        emphasis: {
          focus: 'series' as const,
        },
      };
    });
    
    // Get all timestamps (assuming all wallets have same timestamps)
    const timestamps = data.wallets[0]?.data.map(d => d.timestamp) || [];
    
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
        name: 'Drawdown (%)',
        max: 0,
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
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const timestamp = params[0].value[0];
          const dateStr = formatTimestampWithTimezone(timestamp, timezone, 'yyyy-MM-dd HH:mm');
          
          let content = `<div style="font-weight: 600; margin-bottom: 8px;">${dateStr}</div>`;
          params.forEach((param: any) => {
            const drawdown = param.value[1];
            content += `
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px;">
                <span style="color: ${param.color}">● ${param.seriesName}:</span>
                <strong>${drawdown.toFixed(2)}%</strong>
              </div>
            `;
          });
          
          return content;
        },
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
                <div className={styles.statLabel}>Max Drawdown</div>
                <div className={styles.statValue} style={{ color: chartTheme.colorPalette[2] }}>
                  {wallet.maxDrawdown.toFixed(2)}%
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Days Since Max DD</div>
                <div className={styles.statValue}>
                  {wallet.daysSinceMaxDrawdown} days
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Current Drawdown</div>
                <div className={styles.statValue}>
                  {wallet.currentDrawdown.toFixed(2)}%
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>Max DD Date</div>
                <div className={styles.statValue}>
                  {formatTimestampWithTimezone(wallet.maxDrawdownTimestamp, timezone, 'yyyy-MM-dd')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [data, chartTheme, timezone]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <div className={styles.drawdownContainer}>
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
