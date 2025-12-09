/**
 * CounterpartyActivity Component
 * 
 * Displays grouped bar charts showing transaction counts and volumes per counterparty,
 * delivering actionable insights about trading relationships.
 * 
 * @module CounterpartyActivity
 */

import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { ChartWrapper } from '../shared/ChartWrapper';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { mockFetchCounterpartyActivity } from '../../../services/chart/mockChartData';
import { formatCurrency } from '../../../util/chart-helpers';
import type { CounterpartyActivityResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { TimePeriod, TransactionType } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './CounterpartyActivity.module.scss';

/**
 * Props for CounterpartyActivity component
 */
interface CounterpartyActivityProps {
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
  enableAutoRefresh?: boolean;
  
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
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function CounterpartyActivity({
  title = 'Counterparty Activity Analysis',
  height = 400,
  initialTimePeriod = '30D',
  initialTransactionType = 'all',
  limit = 10,
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: CounterpartyActivityProps) {
  // State management
  const [data, setData] = React.useState<CounterpartyActivityResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  const [currentLimit, setCurrentLimit] = React.useState<number>(limit);
  
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
  
  // Fetch data function
  const fetchData = React.useCallback(async () => {
    setLoadingState({ status: 'loading', retryCount: loadingState.retryCount });
    
    try {
      const response = await mockFetchCounterpartyActivity({
        timePeriod: filters.timePeriod,
        transactionType: filters.transactionType,
        limit: currentLimit,
        timezone,
      });
      
      setData(response);
      setLoadingState({ status: 'success', retryCount: 0 });
      onDataLoaded?.(response);
    } catch (error) {
      console.error('Failed to fetch counterparty activity data:', error);
      setLoadingState({ 
        status: 'error', 
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load data',
          retryable: true,
        },
        retryCount: loadingState.retryCount + 1,
      });
    }
  }, [filters.timePeriod, filters.transactionType, currentLimit, timezone, loadingState.retryCount, onDataLoaded]);
  
  // Initial data load and filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Auto-refresh setup
  useAutoRefresh({
    enabled: enableAutoRefresh,
    onRefresh: fetchData,
    config: {
      interval: refreshInterval,
    },
  });
  
  // Export functionality
  const { exportChart } = useChartExport({
    chartTitle: title,
    timezone,
    baseFilename: 'counterparty-activity',
  });
  
  // Handle export
  const handleExport = async (format: ExportFormat) => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    const chartInstance = echartsInstance ? (echartsInstance as any) : null;
    
    // Prepare CSV data
    const csvData = data ? [
      {
        id: 'transaction-count',
        name: 'Transaction Count',
        type: 'bar' as const,
        data: data.counterparties.map(cp => ({
          category: cp.name,
          value: cp.transactionCount,
        })),
        visible: true,
      },
      {
        id: 'total-volume',
        name: 'Total Volume',
        type: 'bar' as const,
        data: data.counterparties.map(cp => ({
          category: cp.name,
          value: cp.totalVolume,
        })),
        visible: true,
      }
    ] : [];
    
    exportChart(format, chartInstance, csvData, filters);
  };
  
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
        data: ['Transaction Count', 'Total Volume'],
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
          name: 'Transaction Count',
          position: 'left',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => value.toLocaleString(),
          },
        },
        {
          ...baseOption.yAxis,
          type: 'value',
          name: 'Total Volume (USD)',
          position: 'right',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => formatCurrency(value),
          },
        },
      ],
      series: [
        {
          name: 'Transaction Count',
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
          name: 'Total Volume',
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
  }, [data, chartTheme]);
  
  // Handle retry
  const handleRetry = () => {
    fetchData();
  };
  
  // Handle limit change
  const handleLimitChange = (newLimit: number) => {
    setCurrentLimit(newLimit);
  };
  
  // Render chart with wrapper
  return (
    <ChartWrapper
      title={title}
      loadingState={loadingState}
      height={height}
      onRetry={handleRetry}
      onExport={handleExport}
      isEmpty={!data || data.counterparties.length === 0}
      emptyState={{
        title: 'No Counterparty Data',
        message: 'No counterparty activity data available for the selected time period and filters.',
        action: {
          label: 'Reset Filters',
          onClick: () => {
            setTimePeriod('30D');
            setTransactionType('all');
            setCurrentLimit(10);
          },
        },
      }}
      actions={
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
      }
      className={className}
    >
      <ReactECharts
        ref={chartRef}
        option={chartOptions}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </ChartWrapper>
  );
}
