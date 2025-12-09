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

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { mockFetchAssetDistribution } from '../../../services/chart/mockChartData';
import { formatCurrency } from '../../../util/chart-helpers';
import { ChartWrapper } from '../shared/ChartWrapper';
import type { AssetDistributionResponse } from '../../../types/chart-api.types';
import type { ChartFilters } from '../../../types/chart-filters.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { ExportFormat } from '../../../types/chart-filters.types';
import type { ChartDataSeries } from '../../../types/chart-data.types';
import styles from './AssetDistribution.module.scss';

export interface AssetDistributionProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial filters */
  initialFilters?: Partial<ChartFilters>;
  
  /** Limit to top N tokens (default: all) */
  topN?: number;
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Custom CSS class */
  className?: string;
}

/**
 * AssetDistribution Component
 * 
 * User Story: US2 - Analyze Asset Distribution
 * Displays donut chart showing asset allocation with percentages and total value.
 */
export const AssetDistribution: React.FC<AssetDistributionProps> = ({
  title = 'Asset Distribution',
  height = 400,
  initialFilters,
  topN,
  autoRefresh = true,
  className,
}) => {
  // State management
  const [data, setData] = useState<AssetDistributionResponse | null>(null);
  const [loadingState, setLoadingState] = useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  
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
    setWallets,
    isValid,
  } = useChartFilters({
    initialFilters,
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  /**
   * Fetch distribution data from API
   */
  const fetchData = useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const result = await mockFetchAssetDistribution({
        period: filters.timePeriod,
        wallets: filters.wallets?.join(','),
      });
      
      if (!isMountedRef.current) return;
      
      setData(result);
      setLoadingState({ status: 'success', retryCount: 0 });
    } catch (error) {
      if (!isMountedRef.current) return;
      
      setLoadingState(prev => ({
        status: 'error',
        retryCount: prev.retryCount,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load distribution data',
          retryable: true,
        },
      }));
    }
  }, [filters, isValid]);
  
  // Auto-refresh with pause detection
  useAutoRefresh({
    onRefresh: () => fetchData(true),
    config: {
      enabled: true,
      interval: 30000,
      pauseOnInteraction: true,
    },
    enabled: autoRefresh && loadingState.status === 'success',
  });
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);
  
  // Update data when filters change
  useEffect(() => {
    if (loadingState.status !== 'idle') {
      fetchData();
    }
  }, [filters, topN, timezone]);
  
  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle: title,
    timezone,
    baseFilename: 'asset-distribution',
  });
  
  /**
   * Handle export based on format
   */
  const handleExport = useCallback(async (format: ExportFormat) => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) {
      console.error('Chart instance not available for export');
      return;
    }
    
    if (format === 'png') {
      exportPNG(chartInstance as any, filters);
    } else if (format === 'svg') {
      exportSVG(chartInstance as any, filters);
    } else if (format === 'csv' && data) {
      // Convert data to ChartDataSeries format for CSV export
      const csvData: ChartDataSeries[] = [{
        id: 'asset-distribution',
        name: 'Asset Distribution',
        type: 'pie',
        data: data.data.map(asset => ({
          name: asset.name,
          value: asset.value,
        })),
        visible: true,
      }];
      exportCSV(csvData, filters);
    }
  }, [exportPNG, exportSVG, exportCSV, filters, data]);
  
  /**
   * Generate eCharts option configuration
   */
  const chartOption: EChartsOption | null = useMemo(() => {
    if (!data || data.data.length === 0) {
      return null;
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Calculate total value for percentages
    const totalValue = data.totalValue;
    
    // Prepare series data with percentages
    const seriesData = data.data.map((asset, index) => ({
      name: asset.name,
      value: asset.value,
      percentage: asset.percentage,
      itemStyle: {
        color: (asset as any).color || chartTheme.colorPalette[index % chartTheme.colorPalette.length],
      },
    }));
    
    return {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, data } = params;
          const percentage = data.percentage || 0;
          return `
            <strong>${name}</strong><br/>
            Value: ${formatCurrency(value)}<br/>
            Percentage: ${percentage.toFixed(2)}%
          `;
        },
      },
      legend: {
        ...baseOption.legend,
        orient: 'vertical',
        right: 20,
        top: 'center',
        formatter: (name: string) => {
          const asset = data.data.find(a => a.name === name);
          if (!asset) return name;
          return `${name}: ${formatCurrency(asset.value)}`;
        },
      },
      series: [
        {
          name: 'Asset Distribution',
          type: 'pie',
          radius: ['50%', '70%'], // Donut shape
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'outside',
            formatter: (params: any) => {
              const percentage = params.data.percentage || 0;
              return `${params.name}\n${percentage.toFixed(1)}%`;
            },
            fontSize: 11,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          labelLine: {
            show: true,
            length: 15,
            length2: 10,
          },
          data: seriesData,
        },
      ],
      graphic: [
        {
          type: 'text',
          left: '14%',
          top: '14%',
          style: {
            text: 'Total Value',
            textAlign: 'center',
            fill: chartTheme.textColorSecondary,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: '14%',
          top: '20%',
          style: {
            text: formatCurrency(totalValue),
            textAlign: 'center',
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [data, chartTheme]);
  
  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    fetchData();
  };
  
  /**
   * Render chart content
   */
  const renderChart = () => {
    if (!chartOption) return null;
    
    return (
      <ReactECharts
        ref={chartRef}
        option={chartOption}
        style={{ height: `${height}px`, width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
        opts={{ renderer: 'canvas' }}
      />
    );
  };
  
  return (
    <div className={`${styles.assetDistribution} ${className || ''}`}>
      <ChartWrapper
        title={title}
        loadingState={loadingState}
        height={height}
        onRetry={handleRetry}
        onExport={handleExport}
        isEmpty={!data || data.data.length === 0}
        emptyState={{
          title: 'No Distribution Data',
          message: 'No asset distribution data available for the selected time period.',
          action: {
            label: 'Reset Filters',
            onClick: () => {
              setTimePeriod('30D');
              setWallets(undefined);
            },
          },
        }}
      >
        {renderChart()}
      </ChartWrapper>
    </div>
  );
};

export default AssetDistribution;
