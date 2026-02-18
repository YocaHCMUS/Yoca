/**
 * ExchangeComparison Component
 * 
 * Displays grouped bar chart comparing deposits vs withdrawals across exchanges,
 * delivering immediate insight into exchange-specific activity patterns.
 * 
 * @module ExchangeComparison
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { ChartWrapper } from '@/components/charts/shared/ChartWrapper';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchExchangeComparison } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import { createTooltipHeader, createSeriesIndicator } from '@/util/tooltip-helpers';
import type { ExchangeComparisonResponse, ExchangesRequestParams } from '@/types/chart-api.types';
import type { TimePeriod, ExportFormat } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { useChartExport } from '@/hooks/useChartExport';
import type { ChartDataSeries } from '@/types/chart-data.types';

/**
 * Props for ExchangeComparison component
 */
export interface ExchangeComparisonProps {
  /** Chart title */
  title?: string;
  
  /** Chart minimum height in pixels */
  minHeight?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Metric to display: count (transaction count) or volume (USD value) */
  metric?: 'count' | 'volume';
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: ExchangeComparisonResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * ExchangeComparison Component
 * 
 * User Story 3: Compare Exchange Trading Activity (Priority: P2)
 * 
 * Displays grouped bar chart with:
 * - Exchange names on X-axis
 * - Deposits vs withdrawals as grouped bars
 * - Data labels on top of each bar
 * - Time period filtering
 * - Metric selector (count vs volume)
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <ExchangeComparison
 *   title="Exchange Activity Comparison"
 *   minHeight={400}
 *   initialTimePeriod="30D"
 *   metric="count"
 *   autoRefresh={true}
 * />
 * ```
 */
export function ExchangeComparison({
  title,
  minHeight = 400,
  initialTimePeriod = '30D',
  metric = 'count',
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: ExchangeComparisonProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.exchangeComparisonChart.title');
  
  // State management
  const [currentMetric, setCurrentMetric] = useState<'count' | 'volume'>(metric);
  
  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);
  
  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();
  
  // Get theme configuration
  const chartTheme = useChartTheme();
  
  // Chart filters with debouncing
  const {
    filters,
    setTimePeriod,
    isValid,
  } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
    },
    debounceDelay: 300,
  });
  
  // Query for the controller
  const query = useMemo<ExchangesRequestParams>(() => ({
    timePeriod: filters.timePeriod,
    metric: currentMetric,
    timezone,
  }), [filters.timePeriod, currentMetric, timezone]);
  
  // Use standard chart controller
  const { data, loadingState, refetch } = useStandardChartController<ExchangeComparisonResponse, ExchangesRequestParams>({
    fetcher: fetchExchangeComparison,
    query,
    autoRefresh,
    refreshInterval,
    onDataLoaded,
  });
  
  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'exchange-comparison',
  });
  
  /**
   * Handle export based on format
   */
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!data) return;

    const instance = chartRef.current?.getEchartsInstance() ?? null;

    if (format === 'csv') {
      // Convert data to ChartDataSeries format for CSV export
      const csvData: ChartDataSeries[] = [
        {
          id: 'deposits',
          name: t('charts.exchangeComparisonChart.deposits'),
          type: 'bar',
          visible: true,
          data: data.exchanges.map(ex => ({
            name: ex.name,
            value: currentMetric === 'count' ? ex.deposits : ex.depositsVolume,
          })),
        },
        {
          id: 'withdrawals',
          name: t('charts.exchangeComparisonChart.withdrawals'),
          type: 'bar',
          visible: true,
          data: data.exchanges.map(ex => ({
            name: ex.name,
            value: currentMetric === 'count' ? ex.withdrawals : ex.withdrawalsVolume,
          })),
        },
      ];
      exportCSV(csvData, filters);
      return;
    }

    if (!instance) {
      console.error('Chart instance not available for export');
      return;
    }

    // Export as PNG or SVG
    format === 'png'
      ? exportPNG(instance as any, filters)
      : exportSVG(instance as any, filters);
  }, [data, filters, currentMetric, exportPNG, exportSVG, exportCSV, t]);
  
  /**
   * Generate eCharts option configuration for grouped bar chart
   */
  const chartOptions = useMemo((): EChartsOption | null => {
    if (!data || data.exchanges.length === 0) return null;
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract exchange names and values
    const exchangeNames = data.exchanges.map(ex => ex.name);
    const deposits = data.exchanges.map(ex => 
      currentMetric === 'count' ? ex.deposits : ex.depositsVolume
    );
    const withdrawals = data.exchanges.map(ex => 
      currentMetric === 'count' ? ex.withdrawals : ex.withdrawalsVolume
    );
    
    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const exchangeName = params[0].axisValue;
          let tooltipContent = createTooltipHeader(exchangeName);
          
          params.forEach((param: any) => {
            const value = currentMetric === 'count' 
              ? `${param.value.toLocaleString()} txns`
              : formatCurrency(param.value);
            tooltipContent += `<div style="margin-top: 4px; width: 100%; display:flex; justify-content: space-between; gap: 8px">`
              + `<span>${createSeriesIndicator(param.color)}${param.seriesName}:</span>`
              + `<strong>${value}</strong></div>`;
          });
          
          return tooltipContent;
        },
      },
      legend: {
        ...baseOption.legend,
        data: [t('charts.exchangeComparisonChart.deposits'), t('charts.exchangeComparisonChart.withdrawals')],
        top: '5%',
        left: 'center',
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: exchangeNames,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 30,
          interval: 0,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: currentMetric === 'count' ? t('charts.exchangeComparisonChart.count') : t('charts.exchangeComparisonChart.volume'),
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => {
            if (currentMetric === 'count') {
              return value.toLocaleString();
            }
            return formatCurrency(value);
          },
        },
      },
      series: [
        {
          name: t('charts.exchangeComparisonChart.deposits'),
          type: 'bar',
          data: deposits,
          itemStyle: {
            color: '#10b981', // Green for deposits
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              if (currentMetric === 'count') {
                return params.value >= 1000 
                  ? `${(params.value / 1000).toFixed(1)}k`
                  : params.value.toString();
              }
              return formatCurrency(params.value);
            },
            fontSize: 11,
          },
          barMaxWidth: 50,
        },
        {
          name: t('charts.exchangeComparisonChart.withdrawals'),
          type: 'bar',
          data: withdrawals,
          itemStyle: {
            color: '#ef4444', // Red for withdrawals
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              if (currentMetric === 'count') {
                return params.value >= 1000 
                  ? `${(params.value / 1000).toFixed(1)}k`
                  : params.value.toString();
              }
              return formatCurrency(params.value);
            },
            fontSize: 11,
          },
          barMaxWidth: 50,
        },
      ],
    };
  }, [data, currentMetric, chartTheme, t]);
  
  /**
   * Setup chart export
   */
  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'exchange-comparison',
  // });
  
  /**
   * Handle export based on format
   */
  // const handleExport = async (format: ExportFormat) => {
  //   const chartInstance = chartRef.current?.getEchartsInstance();
  //   if (!chartInstance) {
  //     console.error('Chart instance not available for export');
  //     return;
  //   }
    
  //   if (format === 'png') {
  //     exportPNG(chartInstance as any, filters);
  //   } else if (format === 'svg') {
  //     exportSVG(chartInstance as any, filters);
  //   } else if (format === 'csv' && data) {
  //     // Convert data to ChartDataSeries format for CSV export
  //     const csvData = [
  //       {
  //         id: 'deposits',
  //         name: t('charts.exchangeComparisonChart.deposits'),
  //         type: 'bar' as const,
  //         data: data.exchanges.map(ex => ({
  //           name: ex.name,
  //           value: currentMetric === 'count' ? ex.deposits : ex.depositsVolume,
  //         })),
  //         visible: true,
  //       },
  //       {
  //         id: 'withdrawals',
  //         name: t('charts.exchangeComparisonChart.withdrawals'),
  //         type: 'bar' as const,
  //         data: data.exchanges.map(ex => ({
  //           name: ex.name,
  //           value: currentMetric === 'count' ? ex.withdrawals : ex.withdrawalsVolume,
  //         })),
  //         visible: true,
  //       },
  //     ];
  //     exportCSV(csvData, filters);
  //   }
  // };
  
  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || data.exchanges.length === 0}
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
    >
      {chartOptions && (
        <ReactECharts
          ref={chartRef}
          option={chartOptions}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
        />
      )}
    </ChartWrapper>
  );
}
