/**
 * CounterpartyActivity Component
 * 
 * Displays grouped bar charts showing transaction counts and volumes per counterparty,
 * delivering actionable insights about trading relationships.
 * 
 * @module CounterpartyActivity
 */

import { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchCounterpartyActivity } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import type { CounterpartyActivityResponse, CounterpartiesRequestParams } from '@/types/chart-api.types';
import type { TimePeriod, TransactionType } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import sharedStyles from '../shared/ChartStyle.module.scss';
import type { ChartProps } from '../shared/ChartProp';
/**
 * Props for CounterpartyActivity component
 */
// export interface CounterpartyActivityProps {
//   /** Chart title */
//   title?: string;
  
//   /** Chart minimum height in pixels */
//   minHeight?: number;
  
//   /** Initial time period (default: 30D) */
//   initialTimePeriod?: TimePeriod;
  
//   /** Transaction type filter (default: all) */
//   initialTransactionType?: TransactionType;
  
//   /** Limit to top N counterparties (default: 10) */
//   limit?: number;
  
//   /** Enable auto-refresh (default: true) */
//   autoRefresh?: boolean;
  
//   /** Auto-refresh interval in milliseconds (default: 30000) */
//   refreshInterval?: number;
  
//   /** Callback when data is loaded */
//   onDataLoaded?: (data: CounterpartyActivityResponse) => void;
  
//   /** Additional CSS class */
//   className?: string;
// }

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
 *   minHeight={400}
 *   initialTimePeriod="30D"
 *   initialTransactionType="all"
 *   limit={10}
 *   autoRefresh={true}
 * />
 * ```
 */
export const CounterpartyActivity: React.FC<ChartProps> = ({
  // minHeight = 400,
  // initialFilters = {{
  //   timePeriod = '30D',
  //   transactionType = 'all',
  //   limit = 10,
  //   tokens = ['All']
  // }},
  // autoRefresh = true,
  // refreshInterval = 30000,
  // className,
  // onDataLoaded,
    // title,

  title,
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  // onDataLoaded,
}) => {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.counterpartyActivityChart.title');
  
  // State management
  const [currentLimit, setCurrentLimit] = useState<number>(initialFilters?.limit);
  
  // Chart instance refs for export
  const transactionCountChartRef = useRef<ReactECharts>(null);
  const totalVolumeChartRef = useRef<ReactECharts>(null);
  
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
    initialFilters: initialFilters
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
    // onDataLoaded,
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
  
  // Generate chart options for transaction counts
  const transactionCountOptions: EChartsOption = useMemo(() => {
    if (!data || data.counterparties.length === 0) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract counterparty names and values
    const counterpartyNames = data.counterparties.map(cp => cp.name);
    const transactionCounts = data.counterparties.map(cp => cp.transactionCount);
    
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
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const counterpartyName = params[0].axisValue;
          const count = params[0].value;
          
          return `
            <strong>${counterpartyName}</strong><br/>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${params[0].color}; margin-right: 8px; border-radius: 50%;"></span>
              <span style="flex: 1;">${t('charts.counterpartyActivityChart.transactionCount')}:</span>
              <strong style="margin-left: 8px;">${count.toLocaleString()}</strong>
            </div>
          `;
        },
      },
      legend: {
        ...baseOption.legend,
        data: [t('charts.counterpartyActivityChart.transactionCount')],
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
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: t('charts.counterpartyActivityChart.transactionCount'),
        position: 'left',
        nameTextStyle: { color: chartTheme.textColor },
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toLocaleString(),
        },
      },
      series: [
        {
          name: t('charts.counterpartyActivityChart.transactionCount'),
          type: 'bar',
          data: transactionCounts,
          itemStyle: {
            color: chartTheme.colorPalette[0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toLocaleString(),
            fontSize: 10,
          },
        },
      ],
    };
  }, [data, chartTheme, t]);
  
  // Generate chart options for total volume
  const totalVolumeOptions: EChartsOption = useMemo(() => {
    if (!data || data.counterparties.length === 0) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract counterparty names and values
    const counterpartyNames = data.counterparties.map(cp => cp.name);
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
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const counterpartyName = params[0].axisValue;
          const volume = params[0].value;
          
          return `
            <strong>${counterpartyName}</strong><br/>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${params[0].color}; margin-right: 8px; border-radius: 50%;"></span>
              <span style="flex: 1;">${t('charts.counterpartyActivityChart.totalVolume')}:</span>
              <strong style="margin-left: 8px;">${formatCurrency(volume)}</strong>
            </div>
          `;
        },
      },
      legend: {
        ...baseOption.legend,
        data: [t('charts.counterpartyActivityChart.totalVolume')],
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
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: t('charts.counterpartyActivityChart.totalVolume'),
        position: 'left',
        nameTextStyle: { color: chartTheme.textColor },
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: [
        {
          name: t('charts.counterpartyActivityChart.totalVolume'),
          type: 'bar',
          data: totalVolumes,
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
      onRetry={refetch}
      isEmpty={!data || data.counterparties.length === 0}
    >
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']}`}>
        <div className={sharedStyles.limitSelector} >
          <label htmlFor="limit-select">Top:</label>
          <select
            id="limit-select"
            value={currentLimit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className={sharedStyles.chartSelect}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      
      {/* Transaction counts chart */}
      {data && (
        <div className={sharedStyles.chartSection}>
          <h3 className={sharedStyles.chartTitle}>{t('charts.counterpartyActivityChart.transactionCount')}</h3>
          <ReactECharts
            ref={transactionCountChartRef}
            option={transactionCountOptions}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
          />
        </div>
      )}
      
      {/* Total volume chart */}
      {data && (
        <div className={sharedStyles.chartSection}>
          <h3 className={sharedStyles.chartTitle}>{t('charts.counterpartyActivityChart.totalVolume')}</h3>
          <ReactECharts
            ref={totalVolumeChartRef}
            option={totalVolumeOptions}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
          />
        </div>
      )}
    </BaseChart>
  );
}
