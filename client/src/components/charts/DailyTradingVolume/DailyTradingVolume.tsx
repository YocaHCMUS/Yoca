/**
 * DailyTradingVolume Component
 * 
 * Displays daily trading volume comparison across multiple wallets with benchmark overlay.
 * Uses grouped bar chart for wallet volumes and line chart for SOL benchmark.
 * 
 * @module DailyTradingVolume
 */

import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { ChartWrapper } from '@/components/charts/shared/ChartWrapper';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { formatCurrency } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getBottomLegend } from '@/util/chart-legend-config';
import type { EChartsOption } from 'echarts';
import type { ExportFormat } from '@/types/chart-filters.types';
import sharedStyles from '../shared/ChartStyle.module.scss';
import { Button } from '@carbon/react';
import { Add, Close } from '@carbon/react/icons';

/**
 * Props for DailyTradingVolume component
 */
export interface DailyTradingVolumeProps {
  /** Chart title */
  title?: string;
  
  /** Chart minimum height in pixels */
  minHeight?: number;
  
  /** Wallet addresses to display */
  walletAddresses?: string[];
  
  /** Selected benchmark tokens */
  selectedBenchmarks?: string[];
  
  /** Enable export functionality */
  enableExport?: boolean;
  
  /** Enable fullscreen mode */
  enableFullscreen?: boolean;
  
  /** Enable mini-player mode */
  enableMiniPlayer?: boolean;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * Wallet color palette for visualization
 */
const WALLET_COLORS = [
  '#9980FF', // Purple
  '#FF9B9B', // Pink
  '#5BCDE5', // Cyan
  '#F2994A', // Orange
  '#6FCF97', // Green
  '#BB6BD9', // Violet
  '#F2C94C', // Yellow
  '#56CCF2', // Light Blue
];

/**
 * Generate mock trading volume data for a wallet
 */
function generateWalletVolume(walletAddress: string, seed: number): number[] {
  const seededRandom = (index: number) => {
    const x = Math.sin(seed + index) * 10000;
    return x - Math.floor(x);
  };

  // Base volume varies by wallet (30K - 100K range)
  const baseVolume = 30000 + seededRandom(0) * 70000;
  
  // Generate 6 days of data with realistic patterns
  return Array.from({ length: 6 }, (_, i) => {
    // Growth trend
    const growthFactor = 1 + (i * 0.08); // 8% growth per day
    
    // Weekly pattern (some days are higher)
    const dayOfWeek = (i + new Date().getDay()) % 7;
    const weekdayFactor = [0.9, 1.0, 1.1, 1.15, 1.2, 0.85, 0.8][dayOfWeek];
    
    // Random variation (±20%)
    const randomFactor = 0.8 + seededRandom(i + 10) * 0.4;
    
    return Math.round(baseVolume * growthFactor * weekdayFactor * randomFactor);
  });
}

/**
 * Generate mock benchmark data (SOL price)
 */
function generateBenchmarkData(): number[] {
  const basePrice = 120;
  return Array.from({ length: 6 }, (_, i) => {
    const trend = 1 + (i * 0.08); // Upward trend
    const noise = (Math.random() - 0.5) * 0.1; // ±5% noise
    return Math.round(basePrice * trend * (1 + noise));
  });
}

/**
 * Mock data generator based on selected wallet addresses
 */
function generateMockData(walletAddresses: string[]) {
  const dates = ['10/05/2025', '10/06/2025', '10/07/2025', '10/08/2025', '10/09/2025', '10/10/2025'];
  
  // Generate data for each selected wallet
  const wallets = walletAddresses.map((address, index) => {
    // Create a seed from wallet address for consistent but different data
    const seed = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    return {
      name: `${address.slice(0, 4)}...${address.slice(-4)}`, // Shorten address for display
      color: WALLET_COLORS[index % WALLET_COLORS.length],
      data: generateWalletVolume(address, seed),
    };
  });
  
  return {
    dates,
    wallets,
    benchmark: {
      name: 'SOL',
      color: '#F2994A',
      data: generateBenchmarkData(),
    }
  };
}

/**
 * DailyTradingVolume Component
 * 
 * Displays grouped bar chart for wallet volumes with line overlay for benchmark.
 * 
 * @example
 * ```tsx
 * <DailyTradingVolume
 *   title="Daily Trading Volume"
 *   walletAddresses={['wallet1', 'wallet2', 'wallet3']}
 *   selectedBenchmarks={['SOL']}
 *   enableExport={true}
 * />
 * ```
 */
export function DailyTradingVolume({
  title,
  minHeight = 400,
  walletAddresses = [],
  selectedBenchmarks = ['SOL'],
  enableExport = true,
  enableFullscreen = true,
  enableMiniPlayer = true,
  className,
}: DailyTradingVolumeProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || 'Daily Trading Volume Historical Chart';
  
  // Chart instance ref
  const chartRef = useRef<ReactECharts>(null);
  
  // Get theme configuration
  const chartTheme = useChartTheme();
  
  // Generate data based on selected wallets
  const data = useMemo(() => {
    if (walletAddresses.length === 0) {
      // Return empty data structure if no wallets selected
      return {
        dates: [],
        wallets: [],
        benchmark: {
          name: 'SOL',
          color: '#F2994A',
          data: [],
        }
      };
    }
    return generateMockData(walletAddresses);
  }, [walletAddresses]);
  
  /**
   * Generate eCharts options for dual-axis chart
   */
  const chartOptions: EChartsOption = useMemo(() => {
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Create bar series for each wallet
    const barSeries = data.wallets.map((wallet) => ({
      name: wallet.name,
      type: 'bar' as const,
      data: wallet.data,
      itemStyle: {
        color: wallet.color,
      },
      barMaxWidth: 40,
      label: {
        show: true,
        position: 'top' as const,
        formatter: (params: any) => {
          const value = params.value;
          if (value >= 1000) {
            return `${(value / 1000).toFixed(0)}K`;
          }
          return value.toString();
        },
        fontSize: 11,
        color: chartTheme.textColor,
      },
      emphasis: {
        focus: 'series' as const,
      },
    }));
    
    // Create line series for benchmark
    const lineSeries = {
      name: data.benchmark.name,
      type: 'line' as const,
      yAxisIndex: 1, // Use right Y-axis
      data: data.benchmark.data,
      itemStyle: {
        color: data.benchmark.color,
        borderColor: '#000000',
        borderWidth: 2,
      },
      lineStyle: {
        color: data.benchmark.color,
        width: 2,
      },
      symbol: 'circle',
      symbolSize: 8,
      label: {
        show: true,
        position: 'top' as const,
        formatter: (params: any) => params.value.toString(),
        fontSize: 11,
        color: chartTheme.textColor,
      },
      emphasis: {
        focus: 'series' as const,
      },
    };
    
    return {
      ...baseOption,
      grid: {
        left: '80px',
        right: '80px',
        bottom: '80px',
        top: '60px',
        containLabel: false,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => formatAxisTooltip(
          params,
          (p) => p.axisValue,
          (p) => p.seriesType === 'line' ? `$${p.value}` : formatCurrency(p.value)
        ),
      },
      legend: getBottomLegend(
        chartTheme,
        [...data.wallets.map(w => w.name), data.benchmark.name],
        'rect'
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: data.dates,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 0,
          fontSize: 11,
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dotted',
            color: chartTheme.borderColor,
            opacity: 0.5,
          },
        },
      },
      yAxis: [
        {
          // Left Y-axis for wallet volumes
          ...baseOption.yAxis,
          type: 'value',
          name: 'Unit: $',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: {
            color: chartTheme.textColor,
            fontSize: 12,
            fontWeight: 'bold',
          },
          min: 0,
          max: 200000,
          interval: 25000,
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(0)}K`;
              }
              return value.toString();
            },
            fontSize: 11,
          },
          splitLine: {
            show: true,
            lineStyle: {
              type: 'dotted',
              color: chartTheme.borderColor,
              opacity: 0.5,
            },
          },
        },
        {
          // Right Y-axis for benchmark
          ...baseOption.yAxis,
          type: 'value',
          name: 'Benchmark value unit: $',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: {
            color: chartTheme.textColor,
            fontSize: 12,
            fontWeight: 'bold',
          },
          min: 0,
          max: 300,
          interval: 50,
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => value.toString(),
            fontSize: 11,
          },
          splitLine: {
            show: false, // Don't show right axis grid lines
          },
        },
      ],
      series: [...barSeries, lineSeries],
    };
  }, [data, chartTheme]);
  
  /**
   * Handle export
   */
  const handleExport = async (format: ExportFormat) => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    
    if (!echartsInstance) {
      console.error('Chart instance not available for export');
      return;
    }
    
    if (format === 'png') {
      const url = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: chartTheme.backgroundColor,
      });
      
      const link = document.createElement('a');
      link.download = `daily-trading-volume-${Date.now()}.png`;
      link.href = url;
      link.click();
    } else if (format === 'svg') {
      const url = echartsInstance.getDataURL({
        type: 'svg',
        backgroundColor: chartTheme.backgroundColor,
      });
      
      const link = document.createElement('a');
      link.download = `daily-trading-volume-${Date.now()}.svg`;
      link.href = url;
      link.click();
    } else if (format === 'csv') {
      // Export CSV data
      let csvContent = 'Date,';
      csvContent += data.wallets.map(w => w.name).join(',');
      csvContent += `,${data.benchmark.name}\n`;
      
      data.dates.forEach((date, index) => {
        csvContent += `${date},`;
        csvContent += data.wallets.map(w => w.data[index]).join(',');
        csvContent += `,${data.benchmark.data[index]}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.download = `daily-trading-volume-${Date.now()}.csv`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  };
  
  // Show empty state if no wallets selected
  if (walletAddresses.length === 0) {
    return (
      <ChartWrapper
        title={chartTitle}
        loadingState={{ status: 'success', retryCount: 0 }}
        isEmpty={true}
        enableExport={false}
        enableFullscreen={false}
        enableMiniPlayer={false}
        className={className}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: `${minHeight}px`,
          color: chartTheme.textColor 
        }}>
          <p>No wallets selected. Please add wallet addresses to view trading volume comparison.</p>
        </div>
      </ChartWrapper>
    );
  }
  
  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={{ status: 'success', retryCount: 0 }}
      isEmpty={false}
      enableExport={enableExport}
      enableFullscreen={enableFullscreen}
      enableMiniPlayer={enableMiniPlayer}
      onExport={handleExport}
      className={className}
    >
      {/* Benchmark selector */}
      <div className={sharedStyles.chartControls}>
        <span className={sharedStyles.filterLabel}>Benchmark:</span>
        <div className={sharedStyles.filterGroup}>
          {selectedBenchmarks.map((benchmark) => (
            <Button
              key={benchmark}
              renderIcon={Close}
              size='sm'>
                {benchmark}
            </Button>
            // <button
            //   key={benchmark}
            //   className={`${sharedStyles.filterPill} ${sharedStyles.active}`}
            // >
            //   {benchmark}
            //   <span className={sharedStyles.removeIcon}>×</span>
            // </button>
          ))}

          <Button
            renderIcon={Add}
            size='sm'
            >
            Add benchmark
          </Button>
          {/* <button className={sharedStyles.addFilterButton}>
            + Add benchmark
          </button> */}
        </div>
      </div>
      
      {/* Chart */}
      <ReactECharts
        ref={chartRef}
        option={chartOptions}
        style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </ChartWrapper>
  );
}