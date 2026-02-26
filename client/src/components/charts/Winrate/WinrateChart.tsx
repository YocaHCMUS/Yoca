/**
 * Winrate Chart Component
 * 
 * Displays winrate analysis with two-row layout:
 * - Row 1: Column chart showing overall winrate of multiple wallets
 * - Row 2: Histograms showing winning/losing magnitude distribution for each wallet
 * 
 * Features:
 * - Two-part layout (overall winrate + distribution)
 * - Multiple wallet support
 * - Auto-refresh on wallet changes
 * - Inverse data display for losing trades
 * 
 * @module components/charts/Winrate
 */

import React, { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { formatItemTooltip } from '@/util/tooltip-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { fetchWinrate } from '@/services/chart/chartApi';
import type { WinrateResponse, WinrateRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartContainer, ChartSection, ChartGrid, ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import sharedStyles from '../shared/ChartStyle.module.scss';
import { nonnegative } from 'zod';

export function WinrateChart({
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
  const chartTitle = title || tr('charts.winrateChart.title');

  const overallChartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query
   */
  const query = useMemo<WinrateRequestParams>(
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
    useStandardChartController<WinrateResponse, WinrateRequestParams>({
      fetcher: fetchWinrate,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Generate overall winrate column chart
   */
  const overallWinrateOption = useMemo((): EChartsOption | null => {
    if (!data || !data.wallets || data.wallets.length === 0) return null;

    const baseOption = getThemedChartBaseOption(chartTheme);
    
    const categories = data.wallets.map(w => w.walletName || w.walletAddress);
    const winrateValues = data.wallets.map(w => w.winrate);
    
    return {
      ...baseOption,
      grid: {
        left: '4%',
        right: '4%',
        bottom: '12%',
        top: '20%',
        containLabel: true,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: categories,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          interval: 0,
          rotate: categories.length > 5 ? 30 : 0,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: 'Winrate (%)',
        min: 0,
        max: 100,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: 'Winrate',
          type: 'bar',
          data: winrateValues,
          itemStyle: {
            color: chartTheme.colorPalette[0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            color: chartTheme.textColor,
          },
        },
      ],
      legend: undefined,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          const wallet = data.wallets[param.dataIndex];
          return formatItemTooltip(
            param.name,
            [
              { label: 'Winrate', value: `${param.value}%` },
              { label: 'Winning Trades', value: wallet.winningTrades.toString() },
              { label: 'Losing Trades', value: wallet.losingTrades.toString() },
              { label: 'Total Trades', value: wallet.totalTrades.toString() },
            ]
          );
        },
      },
    };
  }, [data, chartTheme, tr]);

  /**
   * Generate distribution charts for each wallet
   */
  const distributionCharts = useMemo(() => {
    if (!data || !data.wallets || data.wallets.length === 0) return [];

    return data.wallets.map((wallet) => {
      const baseOption = getThemedChartBaseOption(chartTheme);
      
      // Prepare data
      const categories = wallet.winningDistribution.map(d => d.range);
      const winningCounts = wallet.winningDistribution.map(d => d.count);
      const losingCounts = wallet.losingDistribution.map(d => -d.count); // Negative for inverse display
      
      const option: EChartsOption = {
        ...baseOption,
        // title: {
        //   text: wallet.walletName || wallet.walletAddress,
        //   left: 'center',
        //   textStyle: {
        //     color: chartTheme.textColor,
        //     fontSize: 14,
        //     fontWeight: 'normal',
        //   },
        // },
        title: wallet.walletAddress ? {
          text: wallet.walletAddress,
          left: 8,
          top: 8,
          textStyle: {
            color: chartTheme.textColor,
            fontSize: 16,
            fontWeight: 'bold',
          },
        } : undefined,
        grid: {
          left: '8%',
          right: '8%',
          bottom: '12%',
          top: '24%',
          containLabel: true,
        },
        xAxis: {
          ...baseOption.xAxis,
          type: 'category',
          data: categories,
          axisLabel: {
            ...baseOption.xAxis.axisLabel,
            interval: 0,
            rotate: 30,
          },
        },
        yAxis: {
          ...baseOption.yAxis,
          type: 'value',
          name: 'Trade Count',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => Math.abs(value).toString(),
          },
        },
        series: [
          {
            name: 'Winning',
            type: 'bar',
            stack: 'total',
            data: winningCounts,
            itemStyle: {
              color: chartTheme.colorPalette[1], // Green
            },
          },
          {
            name: 'Losing',
            type: 'bar',
            stack: 'total',
            data: losingCounts,
            itemStyle: {
              color: chartTheme.colorPalette[2], // Red
            },
          },
        ],
        legend: getMultiSeriesLegend(
          chartTheme,
          ['Winning', 'Losing'],
          false
        ),
        tooltip: {
          ...baseOption.tooltip,
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          formatter: (params: any) => {
            const winning = params.find((p: any) => p.seriesName === 'Winning');
            const losing = params.find((p: any) => p.seriesName === 'Losing');
            return `
              <div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>
              ${winning ? `<div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${chartTheme.colorPalette[1]}">● Winning:</span><strong>${winning.value}</strong>
              </div>` : ''}
              ${losing ? `<div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${chartTheme.colorPalette[2]}">● Losing:</span><strong>${Math.abs(losing.value)}</strong>
              </div>` : ''}
            `;
          },
        },
      };
      
      return {
        walletAddress: wallet.walletAddress,
        option,
      };
    });
  }, [data, chartTheme]);

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || !data.wallets || data.wallets.length === 0}
      onRetry={() => refetch(false)}
    >
      <ChartContainer gap='0'>
        {/* Overall Winrate Section */}
        <ChartSection minHeight="300px">
          {overallWinrateOption && (
            <ChartGridItem minHeight={300}>
              <ReactECharts
                ref={overallChartRef}
                option={overallWinrateOption}
                style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                notMerge
                lazyUpdate
              />
            </ChartGridItem>
          )}
        </ChartSection>
        
        {/* Distribution Histograms Grid */}
        <ChartGrid itemCount={distributionCharts.length} autoFit minColumnWidth="400px">
          {distributionCharts.map((chart) => (
            <ChartGridItem
              key={chart.walletAddress}
              itemKey={chart.walletAddress}
              minHeight={300}
            >
              <ReactECharts
                option={chart.option}
                style={{ height: '100%', width: '100%' }}
                notMerge
                lazyUpdate
              />
            </ChartGridItem>
          ))}
        </ChartGrid>
      </ChartContainer>
    </BaseChart>
  );
}
