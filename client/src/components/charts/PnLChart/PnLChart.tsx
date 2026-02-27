/**
 * PnLChart Component
 * 
 * Displays a dual-axis chart showing daily P&L bars with cumulative P&L line overlay,
 * delivering comprehensive profitability analysis.
 * 
 * Features:
 * - Dual-axis chart: bars (daily P&L) + line (cumulative P&L)
 * - Conditional bar coloring (green for profit, red for loss)
 * - Tooltip showing both daily and cumulative values with dates
 * - Time period filtering (7D, 30D, 60D, 90D, 1Y, All)
 * - Wallet filtering support
 * - Auto-refresh every 30 seconds
 * - Export to PNG/SVG/CSV
 * - Fullscreen and mini-player viewing modes
 * 
 * @module components/charts/PnLChart
 */

import React, { useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';

import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchPnLChart, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '@/util/chart-helpers';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import type { PnLRequestParams } from '@/types/chart-api.types';

// Infer response type from fetcher
type PnLChartData = InferFetcherData<typeof fetchPnLChart>;
import type { TimePeriod } from '@/types/chart-filters.types';

import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGrid, ChartGridItem } from '@/components/charts/shared';
import sharedStyles from '../shared/ChartStyle.module.scss';

export interface PnLChartProps {
  /** Chart title */
  title?: string;
  
  /** Chart minimum height in pixels */
  minHeight?: number;
  
  /** Initial time period */
  initialTimePeriod?: TimePeriod;
  
  /** Initial wallets */
  initialWallets?: string[];
  
  /** Data aggregation level */
  aggregation?: 'daily' | 'weekly' | 'monthly';
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Custom CSS class */
  className?: string;
  
  /** Initial view mode (default: 'both') */
  initialViewMode?: 'daily' | 'cumulative' | 'both';
  
  /** Initial filters */
  initialFilters?: {
    timePeriod?: TimePeriod;
    wallets?: string[];
  };
}

/**
 * PnLChart Component
 * 
 * User Story: US5 - Monitor Profit and Loss Trends
 * Displays dual-axis chart showing daily P&L bars with cumulative P&L line overlay.
 */
export const PnLChart: React.FC<PnLChartProps> = ({
  title,
  minHeight = 400,
  initialTimePeriod = '30D',
  initialWallets = [],
  aggregation = 'daily',
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  initialViewMode = 'both',
  initialFilters,
}) => {
  const { tr } = useLocalization();
  const chartTitle = title || tr('charts.pnlChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  
  // State for view mode
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative' | 'both'>(initialViewMode);

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters: initialFilters || {
      timePeriod: initialTimePeriod,
      wallets: initialWallets.length > 0 ? initialWallets : undefined,
    },
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<PnLRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      wallets: walletsString,
      aggregation,
      timezone,
    }),
    [filters.timePeriod, walletsString, aggregation, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<PnLChartData, PnLRequestParams>({
      fetcher: fetchPnLChart,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Helper to create chart option for a single wallet's data
   */
  const createChartOption = useCallback((
    dailyPnLData: Array<{ timestamp: number; value: number }>,
    cumulativePnLData: Array<{ timestamp: number; value: number }>,
    walletLabel?: string
  ): EChartsOption => {
    // Use theme colors
    const profitColor = chartTheme.colorPalette[1]; // Green
    const lossColor = chartTheme.colorPalette[2]; // Red
    const cumulativeColor = chartTheme.colorPalette[0]; // Blue
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract timestamps and values
    const timestamps = dailyPnLData.map((item: { timestamp: number; value: number }) => item.timestamp);
    const dailyValues = dailyPnLData.map((item: { timestamp: number; value: number }) => item.value);
    const cumulativeValues = cumulativePnLData.map((item: { timestamp: number; value: number }) => item.value);
    
    // Format X-axis dates
    const xAxisData = timestamps.map((ts: number) => formatTimestampWithTimezone(ts, timezone, 'MM/dd'));
    
    // Determine which series to show
    const showDaily = viewMode === 'daily' || viewMode === 'both';
    const showCumulative = viewMode === 'cumulative' || viewMode === 'both';
    
    // Build series array
    const series: any[] = [];
    
    if (showDaily) {
      series.push({
        name: tr('charts.pnlChart.dailyPnL'),
        type: 'bar',
        yAxisIndex: viewMode === 'both' ? 0 : undefined,
        data: dailyValues,
        itemStyle: {
          color: (params: any) => {
            return params.value >= 0 ? profitColor : lossColor;
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      });
    }
    
    if (showCumulative) {
      series.push({
        name: tr('charts.pnlChart.cumulativePnL'),
        type: 'line',
        yAxisIndex: viewMode === 'both' ? 1 : undefined,
        data: cumulativeValues,
        smooth: true,
        lineStyle: {
          color: cumulativeColor,
          width: 2,
        },
        itemStyle: {
          color: cumulativeColor,
        },
        symbol: 'circle',
        symbolSize: 6,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      });
    }
    
    // Build yAxis configuration
    const yAxis: any[] = [];
    
    if (viewMode === 'both') {
      // Dual-axis mode
      yAxis.push({
        ...baseOption.yAxis,
        type: 'value',
        name: tr('charts.pnlChart.dailyPnL'),
        position: 'left',
        axisLine: {
          ...baseOption.yAxis.axisLine,
          show: true,
        },
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => {
            if (Math.abs(value) >= 1000000) {
              return `$${(value / 1000000).toFixed(1)}M`;
            } else if (Math.abs(value) >= 1000) {
              return `$${(value / 1000).toFixed(1)}K`;
            }
            return formatCurrency(value);
          },
        },
        splitLine: {
          ...baseOption.yAxis.splitLine,
          lineStyle: {
            ...baseOption.yAxis.splitLine?.lineStyle,
            opacity: 0.2,
          },
        },
      });
      
      yAxis.push({
        ...baseOption.yAxis,
        type: 'value',
        name: tr('charts.pnlChart.cumulativePnL'),
        position: 'right',
        axisLine: {
          ...baseOption.yAxis.axisLine,
          show: true,
        },
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => {
            if (Math.abs(value) >= 1000000) {
              return `$${(value / 1000000).toFixed(1)}M`;
            } else if (Math.abs(value) >= 1000) {
              return `$${(value / 1000).toFixed(1)}K`;
            }
            return formatCurrency(value);
          },
        },
        splitLine: {
          show: false,
        },
      });
    } else {
      // Single-axis mode
      yAxis.push({
        ...baseOption.yAxis,
        type: 'value',
        name: viewMode === 'daily' ? tr('charts.pnlChart.dailyPnL') : tr('charts.pnlChart.cumulativePnL'),
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => {
            if (Math.abs(value) >= 1000000) {
              return `$${(value / 1000000).toFixed(1)}M`;
            } else if (Math.abs(value) >= 1000) {
              return `$${(value / 1000).toFixed(1)}K`;
            }
            return formatCurrency(value);
          },
        },
      });
    }
    
    // Build legend data
    const legendData: string[] = [];
    if (showDaily) legendData.push(tr('charts.pnlChart.dailyPnL'));
    if (showCumulative) legendData.push(tr('charts.pnlChart.cumulativePnL'));
    
    return {
      ...baseOption,
      title: walletLabel ? {
        text: walletLabel,
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
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: chartTheme.textColorSecondary,
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const timestamp = timestamps[params[0].dataIndex];
          const date = formatTimestampWithTimezone(timestamp, timezone, 'PPP');
          const dailyValue = dailyValues[params[0].dataIndex];
          const cumulativeValue = cumulativeValues[params[0].dataIndex];
          
          let tooltipContent = createTooltipHeader(date);
          
          if (showDaily) {
            tooltipContent += createTooltipRow(
              tr('charts.pnlChart.dailyPnL'),
              formatCurrency(dailyValue),
              { valueColor: dailyValue >= 0 ? profitColor : lossColor }
            );
          }
          
          if (showCumulative) {
            tooltipContent += createTooltipRow(
              tr('charts.pnlChart.cumulativePnL'),
              formatCurrency(cumulativeValue)
            );
          }
          
          return tooltipContent;
        },
      },
      legend: undefined,
      // legend: getMultiSeriesLegend(
      //   chartTheme,
      //   legendData,
      //   !!walletLabel
      // ),
      xAxis: [
        {
          ...baseOption.xAxis,
          type: 'category',
          data: xAxisData,
          axisPointer: {
            type: 'shadow',
          },
        },
      ],
      yAxis,
      series,
    };
  }, [chartTheme, timezone, tr, viewMode]);

  /**
   * Generate chart options - multiple charts for per-wallet view
   */
  const chartOptions = useMemo(() => {
    if (!data || 'error' in data) return [];

    // Multi-wallet view
    if ('wallets' in data && data.wallets && data.wallets.length > 0) {
      return data.wallets.map(wallet => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.dailyPnL,
          wallet.cumulativePnL,
          `${wallet.walletAddress.slice(0, 8)}...`
        ),
      }));
    }

    // Single/aggregated view
    if ('dailyPnL' in data && data.dailyPnL && data.dailyPnL.length > 0) {
      return [{
        walletAddress: 'aggregated',
        option: createChartOption(data.dailyPnL, data.cumulativePnL!, undefined),
      }];
    }

    return [];
  }, [data, createChartOption]);

  const isEmpty = !data || 'error' in data || (
    (!('wallets' in data) || !data.wallets || data.wallets.length === 0) &&
    (!('dailyPnL' in data) || !data.dailyPnL || data.dailyPnL.length === 0)
  );

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      onRetry={() => refetch(false)}
    >
      {/* View mode selector */}
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']} ${sharedStyles['chartControls--withBackground']}`}>
        <div className={sharedStyles['chartToggle--padded']}>
          <button
            className={`${sharedStyles.chartToggleButton} ${viewMode === 'daily' ? sharedStyles.active : ''}`}
            onClick={() => setViewMode('daily')}
            aria-label={tr('charts.pnlChart.dailyPnL')}
            title={tr('charts.pnlChart.dailyPnL')}
          >
            {tr('charts.pnlChart.dailyPnL')}
          </button>
          <button
            className={`${sharedStyles.chartToggleButton} ${viewMode === 'cumulative' ? sharedStyles.active : ''}`}
            onClick={() => setViewMode('cumulative')}
            aria-label={tr('charts.pnlChart.cumulativePnL')}
            title={tr('charts.pnlChart.cumulativePnL')}
          >
            {tr('charts.pnlChart.cumulativePnL')}
          </button>
          <button
            className={`${sharedStyles.chartToggleButton} ${viewMode === 'both' ? sharedStyles.active : ''}`}
            onClick={() => setViewMode('both')}
            aria-label={tr('charts.pnlChart.both')}
            title={tr('charts.pnlChart.both')}
          >
            {tr('charts.pnlChart.both')}
          </button>
        </div>
      </div>

      {chartOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Chart Grid */}
          <ChartGrid itemCount={chartOptions.length} multiItemColumns={2}>
            {chartOptions.map((chartData, index) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={minHeight}
              >
                <ReactECharts
                  ref={index === 0 ? chartRef : undefined}
                  option={chartData.option}
                  style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                  notMerge
                  lazyUpdate
                />
              </ChartGridItem>
            ))}
          </ChartGrid>
        </div>
      )}
    </BaseChart>
  );
};
