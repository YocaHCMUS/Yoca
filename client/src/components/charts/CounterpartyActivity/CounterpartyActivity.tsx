/**
 * CounterpartyActivity Component
 * 
 * Displays grouped bar charts showing transaction counts and volumes per counterparty,
 * delivering actionable insights about trading relationships.
 * 
 * @module CounterpartyActivity
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartExport } from '@/hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchCounterpartyActivity } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import type { CounterpartyActivityResponse, CounterpartiesRequestParams } from '@/types/chart-api.types';
import type { TimePeriod, TransactionType } from '@/types/chart-filters.types';
import type { ExportFormat } from '@/components/charts/shared/ExportMenu';
import { useStandardChartController } from '@/hooks/useChartController';
import styles from './CounterpartyActivity.module.scss';

/**
 * Props for CounterpartyActivity component
 */
export interface CounterpartyActivityProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Transaction type filter (default: all) */
  initialTransactionType?: TransactionType;
  
  /** Limit to top N counterparties (default: 10) */
  limit?: number;
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: CounterpartyActivityResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * CounterpartyActivity Component
 * 
 * User Story 4: Analyze Counterparty Transaction Activity (Priority: P2)
 * 
 * Displays grouped bar chart with:
 * - Counterparty identifiers on X-axis
 * - Transaction count and total volume as grouped bars
 * - Time period filtering
 * - Transaction type filtering
 * - Limit selector for top N counterparties
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <CounterpartyActivity
 *   title="Counterparty Analysis"
 *   height={400}
 *   initialTimePeriod="30D"
 *   initialTransactionType="all"
 *   limit={10}
 *   autoRefresh={true}
 * />
 * ```
 */
export function CounterpartyActivity({
  title,
  height = 400,
  initialTimePeriod = '30D',
  initialTransactionType = 'all',
  limit = 10,
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: CounterpartyActivityProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.counterpartyActivityChart.title');
  
  // State management
  const [currentLimit, setCurrentLimit] = useState<number>(limit);
  
  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);
  
  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();
  
  // Get theme configuration
  const chartTheme = useChartTheme();
  
  // Filter management with time period and transaction type
  const {
    filters,
    setTimePeriod,
    setTransactionType,
  } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
      tokens: ['All'],
      transactionType: initialTransactionType,
    },
  });
  
  // Query for the controller
  const query = useMemo<CounterpartiesRequestParams>(() => ({
    timePeriod: filters.timePeriod,
    transactionType: filters.transactionType,
    limit: currentLimit,
    timezone,
  }), [filters.timePeriod, filters.transactionType, currentLimit, timezone]);
  
  // Use standard chart controller
  const { data, loadingState, refetch } = useStandardChartController<CounterpartyActivityResponse, CounterpartiesRequestParams>({
    fetcher: fetchCounterpartyActivity,
    query,
    autoRefresh,
    refreshInterval,
    onDataLoaded,
  });
  
  // Export functionality
  // const { exportChart } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'counterparty-activity',
  // });
  
  // Handle export
  // const handleExport = async (format: ExportFormat) => {
  //   const echartsInstance = chartRef.current?.getEchartsInstance();
  //   const chartInstance = echartsInstance ? (echartsInstance as any) : null;
    
  //   // Prepare CSV data
  //   const csvData = data ? [
  //     {
  //       id: 'transaction-count',
  //       name: 'Transaction Count',
  //       type: 'bar' as const,
  //       data: data.counterparties.map(cp => ({
  //         category: cp.name,
  //         value: cp.transactionCount,
  //       })),
  //       visible: true,
  //     },
  //     {
  //       id: 'total-volume',
  //       name: 'Total Volume',
  //       type: 'bar' as const,
  //       data: data.counterparties.map(cp => ({
  //         category: cp.name,
  //         value: cp.totalVolume,
  //       })),
  //       visible: true,
  //     }
  //   ] : [];
    
  //   exportChart(format, chartInstance, csvData, filters);
  // };
  
  // Generate chart options
  const chartOptions: EChartsOption = useMemo(() => {
    if (!data || data.counterparties.length === 0) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract counterparty names and values
    const counterpartyNames = data.counterparties.map(cp => cp.name);
    const transactionCounts = data.counterparties.map(cp => cp.transactionCount);
    const totalVolumes = data.counterparties.map(cp => cp.totalVolume);
    
    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
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
          if (!Array.isArray(params)) return '';
          
          const counterpartyName = params[0].axisValue;
          let tooltipText = `<strong>${counterpartyName}</strong><br/>`;
          
          params.forEach((param: any) => {
            const value = param.value;
            const formattedValue = param.seriesName === 'Total Volume'
              ? formatCurrency(value)
              : value.toLocaleString();
            
            tooltipText += `${param.marker} ${param.seriesName}: ${formattedValue}<br/>`;
          });
          
          return tooltipText;
        },
      },
      legend: {
        ...baseOption.legend,
        data: [t('charts.counterpartyActivityChart.transactionCount'), t('charts.counterpartyActivityChart.totalVolume')],
        top: '5%',
        left: 'center',
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: counterpartyNames,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 45,
          interval: 0,
          formatter: (value: string) => {
            // Truncate long addresses/names
            return value.length > 20 ? `${value.substring(0, 17)}...` : value;
          },
        },
      },
      yAxis: [
        {
          ...baseOption.yAxis,
          type: 'value',
          name: t('charts.counterpartyActivityChart.transactionCount'),
          position: 'left',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => value.toLocaleString(),
          },
        },
        {
          ...baseOption.yAxis,
          type: 'value',
          name: t('charts.counterpartyActivityChart.totalVolume'),
          position: 'right',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => formatCurrency(value),
          },
        },
      ],
      series: [
        {
          name: t('charts.counterpartyActivityChart.transactionCount'),
          type: 'bar',
          data: transactionCounts,
          yAxisIndex: 0,
          itemStyle: {
            color: '#0f62fe',
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toLocaleString(),
            fontSize: 10,
          },
          barGap: '10%',
        },
        {
          name: t('charts.counterpartyActivityChart.totalVolume'),
          type: 'bar',
          data: totalVolumes,
          yAxisIndex: 1,
          itemStyle: {
            color: '#24a148',
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => formatCurrency(params.value),
            fontSize: 10,
          },
        },
      ],
    };
  }, [data, chartTheme, t]);
  
  // Handle limit change
  const handleLimitChange = (newLimit: number) => {
    setCurrentLimit(newLimit);
  };
  
  // Render chart with wrapper
  return (
    <BaseChart
      title={chartTitle}
      loadingState={loadingState}
      height={height}
      onRetry={refetch}
      isEmpty={!data || data.counterparties.length === 0}
    >
      <div className={styles.limitSelector}>
        <label htmlFor="limit-select">Top:</label>
        <select
          id="limit-select"
          value={currentLimit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className={styles.limitSelect}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
      <ReactECharts
        ref={chartRef}
        option={chartOptions}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </BaseChart>
  );
}
