/**
 * AssetDistribution Component
 * 
 * Displays a donut chart showing cryptocurrency asset allocation with percentages,
 * values, and total portfolio value at the center.
 * 
 * Features:
 * - Donut chart with colored segments for each asset
 * - Center display showing total portfolio value
 * - Percentages and values on segments
 * - Interactive legend with toggle capability
 * - Token filtering support (All or specific tokens)
 * - Auto-refresh every 30 seconds
 * - Export to PNG/SVG/CSV
 * - Fullscreen and mini-player viewing modes
 * 
 * @module components/charts/AssetDistribution
 */

import React, { useMemo, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAssetDistribution } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import type { AssetDistributionResponse } from '@/types/chart-api.types';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';
import styles from './AssetDistribution.module.scss';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartExport } from '@/hooks/useChartExport';


export interface AssetDistributionProps {
  height?: number;
  initialFilters?: Partial<any>;
  autoRefresh?: boolean;
  className?: string;
}

export const AssetDistribution: React.FC<AssetDistributionProps> = ({
  height = 400,
  initialFilters,
  autoRefresh = false,
  className,
}) => {
  const { t } = useTranslation();
  const chartTitle = t('charts.assetDistributionChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, setTimePeriod, setWallets, isValid } = useChartFilters({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo(
    () => ({
      period: filters.timePeriod,
      wallets: filters.wallets?.join(','),
    }),
    [filters.timePeriod, filters.wallets]
  );

  /**
   * Centralized lifecycle handling
   */
  const { data, loadingState, refetch } =
    useStandardChartController<AssetDistributionResponse, any>({
      fetcher: fetchAssetDistribution,
      query,
      autoRefresh,
    });


  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'asset-distribution',
  });
  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!data) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;

      if (format === 'csv') {
        const csv: ChartDataSeries[] = [
          {
            id: 'asset-distribution',
            name: 'Asset Distribution',
            type: 'pie',
            visible: true,
            data: data.data.map(a => ({
              name: a.name,
              value: a.value,
            })),
          },
        ];
        exportCSV(csv, filters);
        return;
      }

      if (!instance) return;

      format === 'png'
        ? exportPNG(instance as any, filters)
        : exportSVG(instance as any, filters);
    },
    [data, filters]
  );

  /**
   * ECharts option = pure function of data + theme
   */
  const option: EChartsOption | null = useMemo(() => {
    if (!data || data.data.length === 0) return null;

    const base = getThemedChartBaseOption(chartTheme);
    const total = data.totalValue;

    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: any) => `
          <strong>${p.name}</strong><br/>
          ${t('charts.assetDistributionChart.value')}: ${formatCurrency(p.value)}<br/>
          ${t('charts.assetDistributionChart.percentage')}: ${p.data.percentage.toFixed(2)}%
        `,
      },
      legend: {
        ...base.legend,
        orient: 'vertical',
        right: 20,
        top: 'center',
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '70%'],
          center: ['40%', '50%'],
          data: data.data.map((a, i) => ({
            name: a.name,
            value: a.value,
            percentage: a.percentage,
            itemStyle: {
              color:
                (a as any).color ??
                chartTheme.colorPalette[i % chartTheme.colorPalette.length],
            },
          })),
          label: {
            formatter: (p: any) => `${p.name}\n${p.data.percentage.toFixed(1)}%`,
            fontSize: 11,
          },
        },
      ],
      graphic: [
        {
          type: 'text',
          left: '14%',
          top: '14%',
          style: {
            text: t('charts.assetDistributionChart.totalValue'),
            fill: chartTheme.textColorSecondary,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: '14%',
          top: '20%',
          style: {
            text: formatCurrency(total),
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [data, chartTheme, t]);

  return (
    <div className={`${styles.assetDistribution} ${className ?? ''}`}>
      <BaseChart
        title={chartTitle}
        height={height}
        loadingState={loadingState}
        isEmpty={!data || data.data.length === 0}
        onRetry={() => refetch(false)}
        onExport={handleExport}
      >
        {option && (
          <ReactECharts
            ref={chartRef}
            option={option}
            style={{ height, width: '100%' }}
            notMerge
            lazyUpdate
          />
        )}
      </BaseChart>
    </div>
  );
};

// export interface AssetDistributionProps {
//   /** Chart title */
//   title?: string;
  
//   /** Chart height in pixels */
//   height?: number;
  
//   /** Initial filters */
//   initialFilters?: Partial<ChartFilters>;
  
//   /** Limit to top N tokens (default: all) */
//   topN?: number;
  
//   /** Enable auto-refresh (default: true) */
//   autoRefresh?: boolean;
  
//   /** Custom CSS class */
//   className?: string;
// }

// /**
//  * AssetDistribution Component
//  * 
//  * User Story: US2 - Analyze Asset Distribution
//  * Displays donut chart showing asset allocation with percentages and total value.
//  */
// export const AssetDistribution: React.FC<AssetDistributionProps> = ({
//   title,
//   height = 400,
//   initialFilters,
//   topN,
//   autoRefresh = true,
//   className,
// }) => {
//   // i18n
//   const { t } = useTranslation();
//   const chartTitle = title || t('charts.assetDistributionChart.title');
  
//   // State management
//   const [data, setData] = useState<AssetDistributionResponse | null>(null);
//   const [loadingState, setLoadingState] = useState<ChartLoadingState>({
//     status: 'idle',
//     retryCount: 0,
//   });
  
//   // Chart instance ref for export
//   const chartRef = useRef<ReactECharts>(null);
  
//   // Get timezone from context
//   const { selectedTimezone: timezone } = useChartContext();
  
//   // Get theme configuration
//   const chartTheme = useChartTheme();
  
//   // Chart filters with debouncing
//   const {
//     filters,
//     setTimePeriod,
//     setWallets,
//     isValid,
//   } = useChartFilters({
//     initialFilters,
//     debounceDelay: 300,
//   });
  
//   // Reference to track if component is mounted
//   const isMountedRef = useRef(true);
  
//   /**
//    * Fetch distribution data from API
//    */
//   const fetchData = useCallback(async (isRefreshing = false) => {
//     if (!isValid) return;
    
//     setLoadingState(prev => ({
//       status: isRefreshing ? 'refreshing' : 'loading',
//       retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
//     }));
    
//     try {
//       const result = await fetchAssetDistribution({
//         period: filters.timePeriod,
//         wallets: filters.wallets?.join(','),
//       });
      
//       if (!isMountedRef.current) return;
      
//       setData(result);
//       setLoadingState({ status: 'success', retryCount: 0 });
//     } catch (error) {
//       if (!isMountedRef.current) return;
      
//       setLoadingState(prev => ({
//         status: 'error',
//         retryCount: prev.retryCount,
//         error: {
//           code: 'FETCH_ERROR',
//           message: error instanceof Error ? error.message : 'Failed to load distribution data',
//           retryable: true,
//         },
//       }));
//     }
//   }, [filters, isValid]);
  
//   // Auto-refresh with pause detection
//   useAutoRefresh({
//     onRefresh: () => fetchData(true),
//     config: {
//       enabled: true,
//       interval: 30000,
//       pauseOnInteraction: true,
//     },
//     enabled: autoRefresh && loadingState.status === 'success',
//   });
  
//   // Initial data fetch
//   useEffect(() => {
//     fetchData();
    
//     return () => {
//       isMountedRef.current = false;
//     };
//   }, [fetchData]);
  
//   // Update data when filters change
//   useEffect(() => {
//     if (loadingState.status !== 'idle') {
//       fetchData();
//     }
//   }, [filters, topN, timezone]);
  
//   /**
//    * Setup chart export
//    */
//   const { exportPNG, exportSVG, exportCSV } = useChartExport({
//     chartTitle,
//     timezone,
//     baseFilename: 'asset-distribution',
//   });
  
//   /**
//    * Handle export based on format
//    */
//   const handleExport = useCallback(async (format: ExportFormat) => {
//     const chartInstance = chartRef.current?.getEchartsInstance();
//     if (!chartInstance) {
//       console.error('Chart instance not available for export');
//       return;
//     }
    
//     if (format === 'png') {
//       exportPNG(chartInstance as any, filters);
//     } else if (format === 'svg') {
//       exportSVG(chartInstance as any, filters);
//     } else if (format === 'csv' && data) {
//       // Convert data to ChartDataSeries format for CSV export
//       const csvData: ChartDataSeries[] = [{
//         id: 'asset-distribution',
//         name: 'Asset Distribution',
//         type: 'pie',
//         data: data.data.map(asset => ({
//           name: asset.name,
//           value: asset.value,
//         })),
//         visible: true,
//       }];
//       exportCSV(csvData, filters);
//     }
//   }, [exportPNG, exportSVG, exportCSV, filters, data]);
  
//   /**
//    * Generate eCharts option configuration
//    */
//   const chartOption: EChartsOption | null = useMemo(() => {
//     if (!data || data.data.length === 0) {
//       return null;
//     }
    
//     // Get base theme configuration
//     const baseOption = getThemedChartBaseOption(chartTheme);
    
//     // Calculate total value for percentages
//     const totalValue = data.totalValue;
    
//     // Prepare series data with percentages
//     const seriesData = data.data.map((asset, index) => ({
//       name: asset.name,
//       value: asset.value,
//       percentage: asset.percentage,
//       itemStyle: {
//         color: (asset as any).color || chartTheme.colorPalette[index % chartTheme.colorPalette.length],
//       },
//     }));
    
//     return {
//       ...baseOption,
//       tooltip: {
//         ...baseOption.tooltip,
//         trigger: 'item',
//         formatter: (params: any) => {
//           const { name, value, data } = params;
//           const percentage = data.percentage || 0;
//           return `
//             <strong>${name}</strong><br/>
//             ${t('charts.assetDistributionChart.value')}: ${formatCurrency(value)}<br/>
//             ${t('charts.assetDistributionChart.percentage')}: ${percentage.toFixed(2)}%
//           `;
//         },
//       },
//       legend: {
//         ...baseOption.legend,
//         orient: 'vertical',
//         right: 20,
//         top: 'center',
//         formatter: (name: string) => {
//           const asset = data.data.find(a => a.name === name);
//           if (!asset) return name;
//           return `${name}: ${formatCurrency(asset.value)}`;
//         },
//       },
//       series: [
//         {
//           name: t('charts.assetDistributionChart.title'),
//           type: 'pie',
//           radius: ['50%', '70%'], // Donut shape
//           center: ['40%', '50%'],
//           avoidLabelOverlap: false,
//           itemStyle: {
//             borderRadius: 8,
//             borderColor: '#fff',
//             borderWidth: 2,
//           },
//           label: {
//             show: true,
//             position: 'outside',
//             formatter: (params: any) => {
//               const percentage = params.data.percentage || 0;
//               return `${params.name}\n${percentage.toFixed(1)}%`;
//             },
//             fontSize: 11,
//           },
//           emphasis: {
//             label: {
//               show: true,
//               fontSize: 14,
//               fontWeight: 'bold',
//             },
//             itemStyle: {
//               shadowBlur: 10,
//               shadowOffsetX: 0,
//               shadowColor: 'rgba(0, 0, 0, 0.5)',
//             },
//           },
//           labelLine: {
//             show: true,
//             length: 15,
//             length2: 10,
//           },
//           data: seriesData,
//         },
//       ],
//       graphic: [
//         {
//           type: 'text',
//           left: '14%',
//           top: '14%',
//           style: {
//             text: t('charts.assetDistributionChart.totalValue'),
//             textAlign: 'center',
//             fill: chartTheme.textColorSecondary,
//             fontSize: 14,
//           },
//         },
//         {
//           type: 'text',
//           left: '14%',
//           top: '20%',
//           style: {
//             text: formatCurrency(totalValue),
//             textAlign: 'center',
//             fill: chartTheme.textColor,
//             fontSize: 18,
//             fontWeight: 'bold',
//           },
//         },
//       ],
//     };
//   }, [data, chartTheme, t]);
  
//   /**
//    * Handle retry on error
//    */
//   const handleRetry = () => {
//     fetchData();
//   };
  
//   /**
//    * Render chart content
//    */
//   const renderChart = () => {
//     if (!chartOption) return null;
    
//     return (
//       <ReactECharts
//         ref={chartRef}
//         option={chartOption}
//         style={{ height: `${height}px`, width: '100%' }}
//         notMerge={true}
//         lazyUpdate={true}
//         opts={{ renderer: 'canvas' }}
//       />
//     );
//   };
  
//   return (
//     <div className={`${styles.assetDistribution} ${className || ''}`}>
//       <ChartWrapper
//         title={chartTitle}
//         loadingState={loadingState}
//         height={height}
//         onRetry={handleRetry}
//         onExport={handleExport}
//         isEmpty={!data || data.data.length === 0}
//         emptyState={{
//           title: t('charts.noDataTitle'),
//           message: t('charts.noDataMessage'),
//           action: {
//             label: t('charts.resetFilters'),
//             onClick: () => {
//               setTimePeriod('30D');
//               setWallets(undefined);
//             },
//           },
//         }}
//       >
//         {renderChart()}
//       </ChartWrapper>
//     </div>
//   );
// };

// export default AssetDistribution;
