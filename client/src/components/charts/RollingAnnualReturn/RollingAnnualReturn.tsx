/**
 * RollingAnnualReturn Chart Component
 * 
 * Displays a dual-axis chart showing rolling annual return bars with cumulative return line overlay,
 * delivering comprehensive return analysis over customizable time windows.
 * 
 * Features:
 * - Dual-axis chart: bars (rolling annual return) + line (cumulative return)
 * - Conditional bar coloring (green for positive, red for negative)
 * - Tooltip showing both rolling and cumulative values with dates
 * - Time period filtering (7D, 30D, 60D, 90D, 1Y, All)
 * - Time unit selection (month, quarter, year, custom)
 * - Wallet filtering support
 * - Auto-refresh every 30 seconds
 * 
 * @module components/charts/RollingAnnualReturn
 */

import React, { useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';

import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchRollingAnnualReturn } from '@/services/chart/chartApi';
import { formatTimestampWithTimezone } from '@/util/chart-helpers';
import { createTooltipHeader, createSeriesIndicator } from '@/util/tooltip-helpers';
import { getDualAxisLegend } from '@/util/chart-legend-config';
import type { RollingAnnualReturnResponse, RollingAnnualReturnRequestParams } from '@/types/chart-api.types';

import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGrid, ChartGridItem } from '@/components/charts/shared';
import sharedStyles from '../shared/ChartStyle.module.scss';
import type { ChartProps } from '../shared/ChartProp';

export type TimeUnit = 'month' | 'quarter' | 'year' | 'custom';

/**
 * RollingAnnualReturn Component
 * 
 * Displays dual-axis chart showing rolling annual return bars with cumulative return line overlay.
 */
export const RollingAnnualReturn: React.FC<ChartProps> = ({
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
  const chartTitle = title || t('charts.rollingAnnualReturn.title', 'Rolling Annual Return');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  
  // Extract initial values - using type assertion for custom properties
  const customFilters = initialFilters as any;
  const initialTimeUnit = 
    customFilters?.timeUnit === 'month' ||
    customFilters?.timeUnit === 'quarter' ||
    customFilters?.timeUnit === 'year' ||
    customFilters?.timeUnit === 'custom'
      ? customFilters.timeUnit
      : 'month';
  const initialWindowSize = typeof customFilters?.windowSize === 'number' ? customFilters.windowSize : 30;
  const initialWallets = Array.isArray(initialFilters?.wallets) ? initialFilters.wallets : undefined;
  
  // State for time unit and window size
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<TimeUnit>(initialTimeUnit);
  const [windowSize, setWindowSize] = useState<number>(initialWindowSize);

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters: {
      timePeriod: initialFilters?.timePeriod || '1Y',
      wallets: initialWallets,
    },
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const walletsStringFormatted = walletsString;

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<RollingAnnualReturnRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsStringFormatted,
      timeUnit: selectedTimeUnit,
      windowSize: selectedTimeUnit === 'custom' ? windowSize : undefined,
      timezone,
    }),
    [filters.timePeriod, walletsStringFormatted, selectedTimeUnit, windowSize, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<RollingAnnualReturnResponse, RollingAnnualReturnRequestParams>({
      fetcher: fetchRollingAnnualReturn,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Helper to create chart option for a single wallet's data
   */
  const createChartOption = useCallback((
    rollingReturnData: Array<{ timestamp: number; value: number }>,
    cumulativeReturnData: Array<{ timestamp: number; value: number }>,
    walletLabel?: string
  ): EChartsOption => {
    // Use theme colors
    const positiveColor = chartTheme.colorPalette[1]; // Green
    const negativeColor = chartTheme.colorPalette[2]; // Red
    const cumulativeColor = chartTheme.colorPalette[0]; // Blue
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract timestamps and values
    const timestamps = rollingReturnData.map(item => item.timestamp);
    const rollingValues = rollingReturnData.map(item => item.value);
    const cumulativeValues = cumulativeReturnData.map(item => item.value);
    
    // Format X-axis dates
    const xAxisData = timestamps.map(ts => formatTimestampWithTimezone(ts, timezone, 'MM/dd/yyyy'));
    
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
      legend: undefined,
      // legend: getDualAxisLegend(
      //   chartTheme,
      //   [
      //     t('charts.rollingAnnualReturn.rollingReturn', 'Rolling Return'),
      //     t('charts.rollingAnnualReturn.cumulativeReturn', 'Cumulative Return'),
      //   ],
      //   !!walletLabel
      // ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: xAxisData,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 45,
          interval: Math.ceil(timestamps.length / 10),
        },
      },
      yAxis: [
        {
          ...baseOption.yAxis,
          type: 'value',
          name: t('charts.rollingAnnualReturn.rollingReturn', 'Rolling Return') + ' (%)',
          position: 'left',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: '{value}%',
          },
        },
        {
          ...baseOption.yAxis,
          type: 'value',
          name: t('charts.rollingAnnualReturn.cumulativeReturn', 'Cumulative Return') + ' (%)',
          position: 'right',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: '{value}%',
          },
        },
      ],
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: chartTheme.textColor,
          },
        },
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params];
          if (items.length === 0) return '';
          
          const timestamp = timestamps[items[0].dataIndex];
          const date = formatTimestampWithTimezone(timestamp, timezone, 'MMM dd, yyyy');
          
          let tooltip = createTooltipHeader(date);
          
          items.forEach((item: any) => {
            tooltip += `<div style="margin-top: 4px; width: 100%; display:flex; justify-content: space-between; gap: 8px">`
              + `<span>${createSeriesIndicator(item.color)}${item.seriesName}:</span>`
              + `<strong>${item.value.toFixed(2)}%</strong></div>`;
          });
          
          return tooltip;
        },
      },
      series: [
        {
          name: t('charts.rollingAnnualReturn.rollingReturn', 'Rolling Return'),
          type: 'bar',
          yAxisIndex: 0,
          data: rollingValues,
          itemStyle: {
            color: (params: any) => {
              return params.value >= 0 ? positiveColor : negativeColor;
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
        {
          name: t('charts.rollingAnnualReturn.cumulativeReturn', 'Cumulative Return'),
          type: 'line',
          yAxisIndex: 1,
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
        },
      ],
    };
  }, [chartTheme, timezone, t]);

  /**
   * Generate chart options - multiple charts for per-wallet view
   */
  const chartOptions = useMemo(() => {
    if (!data) return [];

    // Multi-wallet view
    if (data.wallets && data.wallets.length > 0) {
      return data.wallets.map(wallet => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.rollingReturn,
          wallet.cumulativeReturn,
          `Wallet: ${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}`
        ),
      }));
    }

    // Single/aggregated view
    if (data.rollingReturn && data.cumulativeReturn && data.rollingReturn.length > 0) {
      return [{
        walletAddress: 'aggregated',
        option: createChartOption(data.rollingReturn, data.cumulativeReturn, undefined),
      }];
    }

    return [];
  }, [data, createChartOption]);

  const isEmpty = !data || (
    (!data.wallets || data.wallets.length === 0) &&
    (!data.rollingReturn || data.rollingReturn.length === 0)
  );

  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      onRetry={() => refetch(false)}
    >
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']} ${sharedStyles['chartControls--withBackground']}`}>
        <select 
          value={selectedTimeUnit} 
          onChange={e => setSelectedTimeUnit(e.target.value as TimeUnit)} 
          className={sharedStyles.chartSelect}
        >
          <option value="month">{t('charts.rollingAnnualReturn.month', 'Month')}</option>
          <option value="quarter">{t('charts.rollingAnnualReturn.quarter', 'Quarter')}</option>
          <option value="year">{t('charts.rollingAnnualReturn.year', 'Year')}</option>
          <option value="custom">{t('charts.rollingAnnualReturn.custom', 'Custom')}</option>
        </select>

        {selectedTimeUnit === 'custom' && (
          <input
            type="number"
            value={windowSize}
            onChange={e => setWindowSize(Number(e.target.value))}
            min={1}
            max={365}
            className={sharedStyles.chartInput}
            placeholder={t('charts.rollingAnnualReturn.days', 'Days')}
          />
        )}
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
