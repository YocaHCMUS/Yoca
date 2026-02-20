import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchBalanceTrend } from '@/services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getConditionalLegend } from '@/util/chart-legend-config';
import type { BalanceTrendResponse, BalanceRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';


// export interface BalanceChartProps {
//   title?: string;
//   minHeight?: number;
//   initialTimePeriod?: TimePeriod;
  
//   /** Initial tokens filter (default: All tokens) */
//   initialTokens?: string[];
  
//   /** Enable auto-refresh (default: true) */
//   autoRefresh?: boolean;
  
//   /** Auto-refresh interval in milliseconds (default: 30000) */
//   refreshInterval?: number;
  
//   /** Callback when data is loaded */
//   onDataLoaded?: (data: BalanceTrendResponse) => void;
  
//   /** Additional CSS class */
//   className?: string;
// }

export function BalanceChart({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: '30D',
    tokens: [],
    wallets: []
  },
  autoRefresh = true,
  refreshInterval = 30000,
  // onDataLoaded,
  className,
}: ChartProps) {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.balanceChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Use centralized filter sync hook
  const { filters, walletsString, tokensString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<BalanceRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      tokens: tokensString,
      wallets: walletsString,
      timezone,
    }),
    [filters.timePeriod, tokensString, walletsString, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<BalanceTrendResponse, BalanceRequestParams>({
      fetcher: fetchBalanceTrend,
      query,
      autoRefresh,
      refreshInterval,
      // onDataLoaded,
    });

  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'balance-trend',
  // });
  // const handleExport = useCallback(
  //   (format: ExportFormat) => {
  //     if (!data) return;

  //     const instance = chartRef.current?.getEchartsInstance() ?? null;

  //     if (format === 'csv') {
  //       const csv: ChartDataSeries[] = data.series.map((series, index) => ({
  //         id: `series-${index}`,
  //         name: series.name,
  //         type: 'line',
  //         visible: true,
  //         data: series.data.map(point => ({
  //           timestamp: point.timestamp,
  //           value: point.value,
  //         })),
  //       }));
  //       exportCSV(csv, filters);
  //       return;
  //     }

  //     if (!instance) return;

  //     format === 'png'
  //       ? exportPNG(instance as any, filters)
  //       : exportSVG(instance as any, filters);
  //   },
  //   [data, filters]
  // );

  /**
   * Generate eCharts option configuration
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (!data) return null;

    const isMultiWallet = data.wallets && data.wallets.length > 1;
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Generate colors for multiple wallets
    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', 
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
    ];
    
    // Build series array - one series per wallet or token
    const seriesConfig = data.series.map((series, index) => {
      // Determine if LTTB sampling is needed (>2000 points)
      const enableSampling = series.data.length > 2000;
      
      // Extract timestamps and values
      const timestamps = series.data.map((point: any) => point.timestamp);
      const values = series.data.map((point: any) => point.value);
      
      const color = colors[index % colors.length];
      
      return {
        name: series.name,
        type: 'line' as const,
        smooth: true,
        sampling: enableSampling ? ('lttb' as const) : undefined,
        data: timestamps.map((timestamp: number, idx: number) => [timestamp, values[idx]]),
        areaStyle: isMultiWallet ? undefined : {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}4D` }, // 30% opacity
              { offset: 1, color: `${color}0D` }, // 5% opacity
            ],
          },
        },
        lineStyle: {
          color: color,
          width: 2,
        },
        itemStyle: {
          color: color,
        },
      };
    });
    
    return {
      ...baseOption,
      color: colors,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: isMultiWallet ? '15%' : '10%', // More space for legend when multiple series
        containLabel: true,
      },
      legend: getConditionalLegend(
        chartTheme,
        data.series.map(s => s.name),
        2,
        false
      ),
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        boundaryGap: false as any,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => {
            return formatTimestampWithTimezone(value, timezone, 'MMM dd');
          },
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: seriesConfig,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        formatter: (params: any) => formatAxisTooltip(
          params,
          (p) => formatTimestampWithTimezone(p.value[0], timezone, 'PPpp'),
          (p) => formatCurrency(p.value[1])
        ),
      },
    };
  }, [data, timezone, chartTheme, t]);

  return (
    <BaseChart
      title={chartTitle}
      // height="100%"
      loadingState={loadingState}
      isEmpty={!data || data.series.length === 0 || data.series[0].data.length === 0}
      onRetry={() => refetch(false)}
    >
      {chartOption && (
        <ChartGridItem minHeight={minHeight}>
          <ReactECharts
            ref={chartRef}
            option={chartOption}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            notMerge
            lazyUpdate
          />
        </ChartGridItem>
      )}
    </BaseChart>
  );
}
