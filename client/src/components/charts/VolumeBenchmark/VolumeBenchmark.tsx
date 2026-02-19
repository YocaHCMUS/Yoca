/**
 * VolumeBenchmark Component
 * 
 * Displays multi-series line or bar chart with benchmark comparisons and value annotations,
 * allowing users to quickly spot performance differences across wallets.
 * 
 * @module VolumeBenchmark
 */

import { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchVolumeBenchmark } from '@/services/chart/chartApi';
import { formatCurrency, formatDate } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getMultiSeriesLegend } from '@/util/chart-legend-config';
import type { VolumeBenchmarkResponse, VolumeBenchmarkRequestParams } from '@/types/chart-api.types';
import type { TimePeriod } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import sharedStyles from '../shared/ChartStyle.module.scss';

/**
 * Props for VolumeBenchmark component
 */
export interface VolumeBenchmarkProps {
  /** Chart title */
  title?: string;
  
  /** Chart minimum height in pixels */
  minHeight?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Display as line or bar chart */
  chartType?: 'line' | 'bar';
  
  /** Show data labels on points/bars */
  showDataLabels?: boolean;
  
  /** Wallet IDs to compare (empty array = all wallets) */
  walletIds?: string[];
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: VolumeBenchmarkResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * VolumeBenchmark Component
 * 
 * User Story 6: Compare Trading Volume Across Benchmarks (Priority: P3)
 * 
 * Displays multi-series chart with:
 * - Multiple colored lines/bars for different wallets
 * - Value annotations on hover
 * - Dates clearly marked on X-axis
 * - Legend identifies each wallet
 * - Time period filtering
 * - Wallet selection filtering
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <VolumeBenchmark
 *   title="Trading Volume Comparison"
 *   height={400}
 *   initialTimePeriod="30D"
 *   chartType="line"
 *   showDataLabels={false}
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function VolumeBenchmark({
  title,
  minHeight = 400,
  initialTimePeriod = '30D',
  chartType = 'line',
  showDataLabels = false,
  walletIds = [],
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: VolumeBenchmarkProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.volumeBenchmarkChart.title');
  
  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);
  
  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();
  
  // Get theme configuration
  const chartTheme = useChartTheme();
  
  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters: {
      timePeriod: initialTimePeriod,
      wallets: walletIds.length > 0 ? walletIds : undefined,
    },
    debounceDelay: 300,
  });
  
  // State for chart type
  const [selectedChartType, setSelectedChartType] = useState<'line' | 'bar'>(chartType);
  
  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<VolumeBenchmarkRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      walletIds: walletsString,
      timezone,
    }),
    [filters.timePeriod, walletsString, timezone]
  );
  
  /**
   * Centralized lifecycle handling
   */
  const { data, loadingState, refetch } =
    useStandardChartController<VolumeBenchmarkResponse, VolumeBenchmarkRequestParams>({
      fetcher: fetchVolumeBenchmark,
      query,
      autoRefresh,
      refreshInterval,
      onDataLoaded,
    });
  
  /**
   * Generate eCharts options for volume benchmark visualization
   */
  const chartOptions = useMemo(() => {
    if (!data) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Use theme color palette
    const colorPalette = chartTheme.colorPalette;
    
    // Create series for each wallet
    const series = data.wallets.map((wallet, index) => ({
      name: wallet.name,
      type: selectedChartType as 'line' | 'bar',
      data: wallet.dataPoints.map(point => [point.timestamp, point.volume]),
      smooth: selectedChartType === 'line' ? 0.3 : undefined,
      showSymbol: selectedChartType === 'line' ? data.wallets[0]?.dataPoints.length <= 50 : undefined,
      symbolSize: 6,
      label: showDataLabels ? {
        show: true,
        position: selectedChartType === 'line' ? 'top' : 'insideTop',
        formatter: (params: any) => formatCurrency(params.value[1]),
        fontSize: 10,
      } : undefined,
      color: colorPalette[index % colorPalette.length],
      emphasis: {
        focus: 'series',
      },
    }));
    
    return {
      ...baseOption,
      grid: {
        top: 60,
        right: 40,
        bottom: 60,
        left: 80,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999',
          },
        },
        formatter: (params: any) => formatAxisTooltip(
          params,
          (p) => formatDate(new Date(p.value[0]), timezone),
          (p) => formatCurrency(p.value[1])
        ),
      },
      legend: getMultiSeriesLegend(
        chartTheme,
        data.wallets.map(w => w.name),
        false
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatDate(new Date(value), timezone, 'MMM dd'),
          rotate: 45,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: t('charts.volumeBenchmarkChart.volume'),
        nameLocation: 'middle',
        nameGap: 60,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          show: data.wallets[0]?.dataPoints.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, selectedChartType, showDataLabels, timezone, chartTheme]);
  
  // Export functionality
  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'volume-benchmark',
  // });
  
  // /**
  //  * Handle export based on format
  //  */
  // const handleExport = useCallback(async (format: ExportFormat) => {
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
  //     const csvData = data.wallets.map(wallet => ({
  //       id: wallet.id,
  //       name: wallet.name,
  //       type: 'line' as const,
  //       data: wallet.dataPoints.map(point => ({
  //         name: new Date(point.timestamp).toISOString(),
  //         value: point.volume,
  //       })),
  //       visible: true,
  //     }));
  //     exportCSV(csvData, filters);
  //   }
  // }, [exportPNG, exportSVG, exportCSV, data, filters]);
  
  /**
   * Handle chart type toggle
   */
  const handleChartTypeChange = (type: 'line' | 'bar') => {
    setSelectedChartType(type);
  };
  
  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    refetch(false);
  };
  
  return (
    <BaseChart
      title={chartTitle}
      // height={height}
      loadingState={loadingState}
      onRetry={handleRetry}
      isEmpty={!data || data.wallets.length === 0}
    >
      {/* <div className={styles.volumeBenchmark}>
      </div> */}
      {/* Chart type selector */}
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']}`}>
        <div className={sharedStyles['chartToggle--bordered']}>
          <button
            className={`${sharedStyles.chartToggleButton} ${selectedChartType === 'line' ? sharedStyles.active : ''}`}
            onClick={() => handleChartTypeChange('line')}
            aria-label={t('charts.volumeBenchmarkChart.line')}
            title={t('charts.volumeBenchmarkChart.line')}
          >
            {t('charts.volumeBenchmarkChart.line')}
          </button>
          <button
            className={`${sharedStyles.chartToggleButton} ${selectedChartType === 'bar' ? sharedStyles.active : ''}`}
            onClick={() => handleChartTypeChange('bar')}
            aria-label={t('charts.volumeBenchmarkChart.bar')}
            title={t('charts.volumeBenchmarkChart.bar')}
          >
            {t('charts.volumeBenchmarkChart.bar')}
          </button>
        </div>
      </div>
      
      {/* Chart */}
      {data && (
        <ReactECharts
          ref={chartRef}
          option={chartOptions}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
        />
      )}
    </BaseChart>
  );
}
