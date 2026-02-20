/**
 * PriceHistoryChart Component
 *
 * Displays price history line chart for selected tokens over time,
 * showing price trends and performance comparisons.
 *
 * @module PriceHistoryChart
 */

import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchPriceHistory } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import type { PriceHistoryResponse, PriceHistoryRequestParams } from '@/types/chart-api.types';
import type { TimePeriod } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartGridItem } from '../shared';

/**
 * Props for PriceHistoryChart component
 */
export interface PriceHistoryChartProps {
  /** Chart title */
  title?: string;

  /** Chart minimum height in pixels */
  minHeight?: number;

  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;

  /** Initial token selection */
  initialTokens?: string[];

  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;

  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;

  /** Callback when data is loaded */
  onDataLoaded?: (data: PriceHistoryResponse) => void;

  /** Additional CSS class */
  className?: string;
}

/**
 * PriceHistoryChart Component
 *
 * User Story: Track price movements and trends over time
 *
 * Displays line chart with:
 * - Price history for multiple tokens
 * - Time period filtering
 * - Token selection
 * - Auto-refresh every 30 seconds
 *
 * @example
 * ```tsx
 * <PriceHistoryChart
 *   title="Token Price History"
 *   minHeight={400}
 *   initialTimePeriod="30D"
 *   initialTokens={['SOL', 'JTO']}
 *   autoRefresh={true}
 * />
 * ```
 */
export function PriceHistoryChart({
  title,
  minHeight = 400,
  initialTimePeriod = '30D',
  initialTokens = ['SOL', 'JTO', 'BONK'],
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: PriceHistoryChartProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.priceHistoryChart.title', 'Price History');

  // State management
  // Removed data and loadingState, using controller

  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);

  // Get timezone from context (fallback to UTC if not available)
  let timezone = 'UTC';
  try {
    const chartContext = useChartContext();
    timezone = chartContext.selectedTimezone;
  } catch (error) {
    // ChartProvider not available, use UTC
    console.warn('ChartProvider not available, using UTC timezone');
  }

  // Get theme configuration
  const chartTheme = useChartTheme();

  // Use centralized filter sync hook
  const { filters, tokensString } = useChartFiltersSync({
    initialFilters: {
      timePeriod: initialTimePeriod,
      tokens: initialTokens,
      transactionType: 'all',
    },
  });

  // Query for the controller
  const query = useMemo<PriceHistoryRequestParams>(() => ({
    tokens: tokensString || 'SOL,JTO,BONK',
    period: filters.timePeriod,
    aggregation: 'daily' as const,
  }), [tokensString, filters.timePeriod]);

  // Use standard chart controller
  const { data, loadingState, refetch } = useStandardChartController<PriceHistoryResponse, PriceHistoryRequestParams>({
    fetcher: fetchPriceHistory,
    query,
    autoRefresh,
    refreshInterval,
    onDataLoaded,
  });

  // // Export functionality
  // const { exportChart } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'price-history',
  // });

  // // Handle export
  // const handleExport = async (format: ExportFormat) => {
  //   const echartsInstance = chartRef.current?.getEchartsInstance();
  //   const chartInstance = echartsInstance ? (echartsInstance as any) : null;

  //   // Prepare CSV data
  //   const csvData = data ? data.series.map(series => ({
  //     id: series.symbol,
  //     name: series.name,
  //     type: 'line' as const,
  //     data: series.data.map(point => ({
  //       category: new Date(point.timestamp).toISOString(),
  //       value: point.value,
  //     })),
  //     visible: true,
  //   })) : [];

  //   exportChart(format, chartInstance, csvData, filters);
  // };

  // Generate chart options
  const chartOptions: EChartsOption = useMemo(() => {
    if (!data || data.series.length === 0) {
      return {};
    }

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Check if we need logarithmic scale (when price ranges differ significantly)
    const allPrices = data.series.flatMap(series => series.data.map(point => point.value));
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRangeRatio = maxPrice / minPrice;
    const useLogScale = priceRangeRatio > 1000; // Use log scale if range is > 1000x

    return {
      ...baseOption,
      grid: {
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '20%',
        containLabel: true,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        formatter: (params: any) => formatAxisTooltip(
          params,
          (p) => new Date(p.axisValue).toLocaleDateString(),
          (p) => {
            // Use param.data[1] for original value, not param.value (which is transformed for log scale)
            const originalValue = p.data ? p.data[1] : p.value;
            return formatCurrency(originalValue);
          }
        ),
      },
      legend: getMultiSeriesLegend(
        chartTheme,
        data.series.map(series => series.name),
        false
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => {
            const date = new Date(value);
            return date.toLocaleDateString();
          },
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        // scale: false,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: data.series.map((series, index) => ({
        name: series.name,
        type: 'line',
        data: series.data.map(point => [point.timestamp, point.value]),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: chartTheme.colorPalette[index % chartTheme.colorPalette.length],
        },
      })),
    };
  }, [data, chartTheme, t]);

  // Render chart with wrapper
  return (
    <BaseChart
      title={chartTitle}
      // height={height}
      loadingState={loadingState}
      isEmpty={!data || data.series.length === 0}
      onRetry={refetch}
    >
      <ChartGridItem minHeight={minHeight}>
        <ReactECharts
          ref={chartRef}
          option={chartOptions}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />
      </ChartGridItem>
    </BaseChart>
  );
}