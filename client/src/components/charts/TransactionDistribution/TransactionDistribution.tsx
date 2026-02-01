/**
 * TransactionDistribution Component
 * 
 * Displays dual chart view showing transaction counts by date and unique tokens traded,
 * segmented by wallet, delivering activity pattern insights.
 * 
 * @module TransactionDistribution
 */

import { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { fetchTransactionDistribution } from '../../../services/chart/chartApi';
import { formatDate } from '../../../util/chart-helpers';
import type { TransactionDistributionResponse, TransactionDistributionRequestParams } from '../../../types/chart-api.types';
import type { TimePeriod, TransactionType } from '../../../types/chart-filters.types';
import { useStandardChartController } from '../../../hooks/useChartController';
import sharedStyles from '../shared/ChartStyle.module.scss';

/**
 * Props for TransactionDistribution component
 */
export interface TransactionDistributionProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels for each sub-chart */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Initial transaction type filter */
  initialTransactionType?: TransactionType;
  
  /** Display mode for transaction counts chart */
  chartMode?: 'stacked' | 'grouped';
  
  /** Wallet IDs to display (empty array = all wallets) */
  walletIds?: string[];
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: TransactionDistributionResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * TransactionDistribution Component
 * 
 * User Story 7: Analyze Transaction Distribution by Type (Priority: P3)
 * 
 * Displays dual chart view with:
 * - Transaction counts by date segmented by wallet (stacked/grouped bars)
 * - Unique tokens traded per day (line chart)
 * - Color distinction for different wallets
 * - Time period and transaction type filtering
 * - Wallet selection filtering
 * - Data labels on bars/points
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <TransactionDistribution
 *   title="Transaction Activity Analysis"
 *   height={300}
 *   initialTimePeriod="30D"
 *   chartMode="stacked"
 *   autoRefresh={true}
 * />
 * ```
 */
export function TransactionDistribution({
  title,
  height = 300,
  initialTimePeriod = '30D',
  initialTransactionType = 'all',
  chartMode = 'stacked',
  walletIds = [],
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: TransactionDistributionProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.transactionDistributionChart.title');
  
  // State for chart mode
  const [selectedChartMode, setSelectedChartMode] = useState<'stacked' | 'grouped'>(chartMode);
  
  // Chart instance refs for export
  const transactionChartRef = useRef<ReactECharts>(null);
  const tokenChartRef = useRef<ReactECharts>(null);
  
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
      transactionType: initialTransactionType,
      wallets: walletIds.length > 0 ? walletIds : undefined,
    },
    debounceDelay: 300,
  });
  
  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<TransactionDistributionRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      transactionType: filters.transactionType,
      walletIds: filters.wallets?.join(','),
      timezone,
    }),
    [filters.timePeriod, filters.transactionType, filters.wallets, timezone]
  );
  
  /**
   * Centralized lifecycle handling
   */
  const { data, loadingState, refetch } =
    useStandardChartController<TransactionDistributionResponse, TransactionDistributionRequestParams>({
      fetcher: fetchTransactionDistribution,
      query,
      autoRefresh,
      refreshInterval,
      onDataLoaded,
    });
  
  /**
   * Generate eCharts options for transaction counts chart
   */
  const transactionCountsOptions = useMemo(() => {
    if (!data) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Use theme color palette
    const colorPalette = chartTheme.colorPalette;
    
    // Create series for each wallet
    const series = data.transactionCounts.map((wallet, index) => ({
      name: wallet.walletName,
      type: 'bar' as const,
      stack: selectedChartMode === 'stacked' ? 'total' : undefined,
      data: wallet.data.map(point => [point.timestamp, point.value]),
      label: {
        show: wallet.data.length <= 30,
        position: selectedChartMode === 'stacked' ? 'inside' : 'top',
        formatter: (params: any) => {
          const value = params.value[1];
          return value > 0 ? value.toString() : '';
        },
        fontSize: 10,
      },
      color: colorPalette[index % colorPalette.length],
      emphasis: {
        focus: 'series',
      },
    }));
    
    return {
      ...baseOption,
      grid: {
        top: 50,
        right: 40,
        bottom: 60,
        left: 60,
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
          
          const timestamp = params[0].value[0];
          const dateStr = formatDate(new Date(timestamp), timezone);
          
          let tooltipContent = `<strong>${dateStr}</strong><br/>`;
          let total = 0;
          
          params.forEach((param: any) => {
            const count = param.value[1];
            total += count;
            const color = param.color;
            tooltipContent += `
              <div style="display: flex; align-items: center; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; margin-right: 8px; border-radius: 50%;"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <strong style="margin-left: 8px;">${count}</strong>
              </div>
            `;
          });
          
          if (selectedChartMode === 'stacked') {
            tooltipContent += `<div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #ccc;"><strong>Total: ${total}</strong></div>`;
          }
          
          return tooltipContent;
        },
      },
      legend: {
        ...baseOption.legend,
        data: data.transactionCounts.map(w => w.walletName),
        top: 10,
        type: 'scroll',
      },
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
        name: t('charts.transactionDistributionChart.count'),
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
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
          show: data.transactionCounts[0]?.data.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, selectedChartMode, timezone, chartTheme, t]);
  
  /**
   * Generate eCharts options for unique token counts chart
   */
  const uniqueTokenCountsOptions = useMemo(() => {
    if (!data) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    return {
      ...baseOption,
      grid: {
        top: 50,
        right: 40,
        bottom: 60,
        left: 60,
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
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const timestamp = params[0].value[0];
          const dateStr = formatDate(new Date(timestamp), timezone);
          const count = params[0].value[1];
          
          return `
            <strong>${dateStr}</strong><br/>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${params[0].color}; margin-right: 8px; border-radius: 50%;"></span>
              <span style="flex: 1;">${t('charts.transactionDistributionChart.tokens')}:</span>
              <strong style="margin-left: 8px;">${count}</strong>
            </div>
          `;
        },
      },
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
        name: t('charts.transactionDistributionChart.tokens'),
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
        },
      },
      series: [
        {
          name: t('charts.transactionDistributionChart.tokens'),
          type: 'line',
          data: data.uniqueTokenCounts.map(point => [point.timestamp, point.value]),
          smooth: 0.3,
          showSymbol: data.uniqueTokenCounts.length <= 50,
          symbolSize: 6,
          itemStyle: {
            color: chartTheme.colorPalette[1], // Use theme green
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${chartTheme.colorPalette[1]}4D` }, // 30% opacity
                { offset: 1, color: `${chartTheme.colorPalette[1]}0D` }, // 5% opacity
              ],
            },
          },
          label: {
            show: data.uniqueTokenCounts.length <= 30,
            position: 'top',
            formatter: (params: any) => params.value[1].toString(),
            fontSize: 10,
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          show: data.uniqueTokenCounts.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, timezone, chartTheme, t]);
  
  // Export functionality
  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'transaction-distribution',
  // });
  
  // /**
  //  * Handle export based on format
  //  */
  // const handleExport = async (format: ExportFormat) => {
  //   const transactionChartInstance = transactionChartRef.current?.getEchartsInstance();
  //   if (!transactionChartInstance) {
  //     console.error('Transaction chart instance not available for export');
  //     return;
  //   }
    
  //   if (format === 'png') {
  //     exportPNG(transactionChartInstance as any, filters);
  //   } else if (format === 'svg') {
  //     exportSVG(transactionChartInstance as any, filters);
  //   } else if (format === 'csv' && data) {
  //     // Convert data to ChartDataSeries format for CSV export
  //     const csvData: Array<{
  //       id: string;
  //       name: string;
  //       type: 'bar' | 'line';
  //       data: Array<{ name: string; value: number }>;
  //       visible: boolean;
  //     }> = data.transactionCounts.map(wallet => ({
  //       id: wallet.walletId,
  //       name: wallet.walletName,
  //       type: 'bar' as const,
  //       data: wallet.data.map(point => ({
  //         name: new Date(point.timestamp).toISOString(),
  //         value: point.value,
  //       })),
  //       visible: true,
  //     }));
      
  //     // Add unique token counts as a separate series
  //     csvData.push({
  //       id: 'unique-tokens',
  //       name: t('charts.transactionDistributionChart.tokens'),
  //       type: 'line' as const,
  //       data: data.uniqueTokenCounts.map(point => ({
  //         name: new Date(point.timestamp).toISOString(),
  //         value: point.value,
  //       })),
  //       visible: true,
  //     });
      
  //     exportCSV(csvData, filters);
  //   }
  // };
  
  /**
   * Handle chart mode toggle
   */
  const handleChartModeChange = (mode: 'stacked' | 'grouped') => {
    setSelectedChartMode(mode);
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
      loadingState={loadingState}
      height={height * 2 + 40}
      onRetry={handleRetry}
      isEmpty={!data || (data.transactionCounts.length === 0 && data.uniqueTokenCounts.length === 0)}
    >
      {/* <div className={styles.transactionDistribution}>
      </div> */}
      {/* Chart mode selector */}
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--withBorder']} ${sharedStyles['chartControls--end']}`}>
        <div className={sharedStyles['chartToggle--padded']}>
          <button
            className={`${sharedStyles.chartToggleButton} ${selectedChartMode === 'stacked' ? sharedStyles.active : ''}`}
            onClick={() => handleChartModeChange('stacked')}
            aria-label={t('charts.transactionDistributionChart.stacked')}
            title={t('charts.transactionDistributionChart.stacked')}
          >
            {t('charts.transactionDistributionChart.stacked')}
          </button>
          <button
            className={`${sharedStyles.chartToggleButton} ${selectedChartMode === 'grouped' ? sharedStyles.active : ''}`}
            onClick={() => handleChartModeChange('grouped')}
            aria-label={t('charts.transactionDistributionChart.grouped')}
            title={t('charts.transactionDistributionChart.grouped')}
          >
            {t('charts.transactionDistributionChart.grouped')}
          </button>
        </div>
      </div>
      
      {/* Transaction counts chart */}
      {data && (
        <div className={sharedStyles.chartSection}>
          <h3 className={sharedStyles.chartTitle}>{t('charts.transactionDistributionChart.transactionCounts')}</h3>
          <ReactECharts
            ref={transactionChartRef}
            option={transactionCountsOptions}
            style={{ height: `${height}px`, width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      )}
      
      {/* Unique token counts chart */}
      {data && (
        <div className={sharedStyles.chartSection}>
          <h3 className={sharedStyles.chartTitle}>{t('charts.transactionDistributionChart.uniqueTokens')}</h3>
          <ReactECharts
            ref={tokenChartRef}
            option={uniqueTokenCountsOptions}
            style={{ height: `${height}px`, width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      )}
    </BaseChart>
  );
}
