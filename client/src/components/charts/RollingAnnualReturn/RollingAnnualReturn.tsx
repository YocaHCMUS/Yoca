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

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';

import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchRollingAnnualReturn } from '@/services/chart/chartApi';
import { formatTimestampWithTimezone } from '@/util/chart-helpers';
import { createTooltipHeader, createSeriesIndicator } from '@/util/tooltip-helpers';
import type { RollingAnnualReturnResponse, RollingAnnualReturnRequestParams } from '@/types/chart-api.types';

import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
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
  const query = useMemo<RollingAnnualReturnRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
      timeUnit: selectedTimeUnit,
      windowSize: selectedTimeUnit === 'custom' ? windowSize : undefined,
      timezone,
    }),
    [filters.timePeriod, walletsString, selectedTimeUnit, windowSize, timezone]
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
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: walletLabel ? '20%' : '15%',
        containLabel: true,
      },
      legend: {
        ...baseOption.legend,
        show: true,
        top: walletLabel ? '12%' : '5%',
        data: [
          t('charts.rollingAnnualReturn.rollingReturn', 'Rolling Return'),
          t('charts.rollingAnnualReturn.cumulativeReturn', 'Cumulative Return'),
        ],
      },
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: chartOptions.length > 1 ? 'repeat(2, 1fr)' : '1fr',
              gap: chartOptions.length > 1 ? '1rem' : '0',
              width: '100%',
            }}
          >
            {chartOptions.map((chartData, index) => (
              <div
                key={chartData.walletAddress}
                style={{
                  minHeight: `${minHeight}px`,
                  border: chartOptions.length > 1 ? '1px solid var(--cds-border-subtle)' : 'none',
                  borderRadius: '4px',
                  padding: chartOptions.length > 1 ? '0.5rem' : '0',
                }}
              >
                <ReactECharts
                  ref={index === 0 ? chartRef : undefined}
                  option={chartData.option}
                  style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                  notMerge
                  lazyUpdate
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseChart>
  );
};
