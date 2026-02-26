/**
 * Total Trading Volume Chart Component
 * 
 * Displays ranking of wallets by total trading volume with horizontal bar chart
 * 
 * Features:
 * - Ranked horizontal bar chart
 * - Shows total, deposit, and withdrawal volumes
 * - Multiple wallet support
 * - Auto-refresh on wallet changes
 * - Interactive tooltips with detailed breakdown
 * 
 * @module components/charts/TotalTradingVolume
 */

import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { fetchTotalTradingVolume } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import { formatItemTooltip } from '@/util/tooltip-helpers';
import type { TotalTradingVolumeResponse, TotalTradingVolumeRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';

export function TotalTradingVolumeChart({
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
  const chartTitle = title || tr('charts.totalTradingVolumeChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query
   */
  const query = useMemo<TotalTradingVolumeRequestParams>(
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
    useStandardChartController<TotalTradingVolumeResponse, TotalTradingVolumeRequestParams>({
      fetcher: (q) => fetchTotalTradingVolume({ query: q as Record<string, string> }),
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
    
    // Data is already sorted by rank, prepare for horizontal bar chart
    const categories = data.wallets.map(w => `#${w.rank} ${w.walletAddress}`);
    const totalVolumes = data.wallets.map(w => w.totalVolume);
    const depositVolumes = data.wallets.map(w => w.depositVolume);
    const withdrawalVolumes = data.wallets.map(w => w.withdrawalVolume);
    
    return {
      ...baseOption,
      grid: {
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '20%',
        containLabel: true,
      },
      legend: getMultiSeriesLegend(
        chartTheme,
        ['Total Volume', 'Deposits', 'Withdrawals'],
        false
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'value',
        name: 'Volume (USD)',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'category',
        data: categories,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          interval: 0,
        },
        inverse: true, // Rank 1 at top
      },
      series: [
        {
          name: 'Total Volume',
          type: 'bar',
          data: totalVolumes,
          itemStyle: {
            color: chartTheme.colorPalette[0],
          },
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => formatCurrency(params.value),
            color: chartTheme.textColor,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const wallet = data.wallets[params[0].dataIndex];
          return formatItemTooltip(
            wallet.walletAddress,
            [
              // { label: 'Address', value: wallet.walletAddress },
              { label: 'Rank', value: `#${wallet.rank}` },
              { label: 'Total Volume', value: formatCurrency(wallet.totalVolume) },
              { label: 'Deposits', value: formatCurrency(wallet.depositVolume), labelColor: chartTheme.colorPalette[1] },
              { label: 'Withdrawals', value: formatCurrency(wallet.withdrawalVolume), labelColor: chartTheme.colorPalette[2] },
              { label: 'Trade Count', value: wallet.tradeCount.toString() },
            ]
          );
        },
      },
    };
  }, [data, chartTheme, tr]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
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
