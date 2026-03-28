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
import sharedStyles from '@/components/charts/shared/ChartStyle.module.scss';
import { PeriodSelector } from '@/components/common/PeriodSelector/PeriodSelector';
import { fetchTotalTradingVolume, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import { formatItemTooltip } from '@/util/tooltip-helpers';
import type { TotalTradingVolumeRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';

type TotalTradingVolumeData = InferFetcherData<typeof fetchTotalTradingVolume>;

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
  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
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
    useStandardChartController<TotalTradingVolumeData, TotalTradingVolumeRequestParams>({
      fetcher: fetchTotalTradingVolume,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate chart option
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (
      !data ||
      !data.wallets ||
      !Array.isArray(data.wallets) ||
      data.wallets.length === 0 ||
      (data.wallets as any).error
    ) {
      return null;
    }

    const baseOption = getThemedChartBaseOption(chartTheme);

    // data.wallets: { wallet: string; tradingVolumeUsd: number | null }[]
    // Sort by tradingVolumeUsd descending
    const wallets = [...data.wallets].sort((a, b) => (b.tradingVolumeUsd ?? 0) - (a.tradingVolumeUsd ?? 0));
    const categories = wallets.map((w, i) => `#${i + 1} ${w.wallet}`);
    const totalVolumes = wallets.map(w => w.tradingVolumeUsd ?? 0);

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
        ['Total Volume'],
        false
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'value',
        name: `Volume (${data.metadata?.currency || 'USD'})`,
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
          const wallet = wallets[params[0].dataIndex];
          return formatItemTooltip(
            wallet.wallet,
            [
              { label: 'Total Volume', value: formatCurrency(wallet.tradingVolumeUsd ?? 0) },
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
        <PeriodSelector value={filters.timePeriod} onChange={(k) => setTimePeriod(k)} />
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
