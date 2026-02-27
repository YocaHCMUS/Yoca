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

import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchDrawdown, type InferFetcherData } from '@/services/chart/chartApi';
import { formatTimestampWithTimezone } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getConditionalLegend } from '@/util/chart-legend-config';
import type { DrawdownRequestParams } from '@/types/chart-api.types';

// Infer response type from fetcher
type DrawdownData = InferFetcherData<typeof fetchDrawdown>;

import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartStatsHeader, ChartContainer, ChartSection, ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import type { StatCard } from '../shared/ChartStatsHeader';

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
  const { tr } = useLocalization();
  const chartTitle = title || tr('charts.drawdownChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

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
    useStandardChartController<DrawdownData, DrawdownRequestParams>({
      fetcher: fetchDrawdown,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate drawdown chart option
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (!data || 'error' in data || !data.wallets || data.wallets.length === 0) return null;

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
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '20%',
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
      legend: getConditionalLegend(
        chartTheme,
        data.wallets.map(w => w.walletName || w.walletAddress),
        2,
        false
      ),
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
  }, [data, chartTheme, timezone, tr]);

  /**
   * Generate statistics header
   */
  const statsCards = useMemo<StatCard[]>(() => {
    if (!data || 'error' in data || !data.wallets || data.wallets.length === 0) return [];

    return data.wallets.map((wallet, index) => ({
      title: wallet.walletName || wallet.walletAddress,
      stats: [
        {
          label: 'Max Drawdown',
          value: wallet.maxDrawdown.toFixed(2),
          suffix: '%',
          valueClassName: 'text-danger',
        },
        {
          label: 'Days Since Max DD',
          value: wallet.daysSinceMaxDrawdown,
          suffix: 'days',
        },
        {
          label: 'Current Drawdown',
          value: wallet.currentDrawdown.toFixed(2),
          suffix: '%',
        },
        {
          label: 'Max DD Date',
          value: formatTimestampWithTimezone(wallet.maxDrawdownTimestamp, timezone, 'yyyy-MM-dd'),
        },
      ],
    }));
  }, [data, timezone]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || 'error' in data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <ChartContainer gap='0'>
        <ChartStatsHeader cards={statsCards} minColumnWidth="300px" />
        <ChartSection minHeight={`${minHeight}px`}>
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
        </ChartSection>
      </ChartContainer>
    </BaseChart>
  );
}
