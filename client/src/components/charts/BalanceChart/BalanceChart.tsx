import { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchBalanceTrend } from '@/services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '@/util/chart-helpers';
import type { BalanceTrendResponse, BalanceRequestParams } from '@/types/chart-api.types';
import type { TimePeriod } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
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
    initialTimePeriod: '30D',
    initialTokens: [],
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

  const { filters, setTimePeriod, setTokens, setWallets, isValid } = useChartFilters({
    initialFilters: initialFilters,
    debounceDelay: 300,
  });

  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);



  /**
   * Sync filters when initialFilters changes (e.g., wallet selection from parent)
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;
    
    // Check if wallets changed
    if (initialFilters?.wallets) {
      const prevWalletsStr = prevFilters?.wallets?.sort().join(',') ?? '';
      const newWalletsStr = initialFilters.wallets.sort().join(',');
      if (prevWalletsStr !== newWalletsStr) {
        setWallets(initialFilters.wallets);
      }
    }
    
    // Check if time period changed
    if (initialFilters?.timePeriod && prevFilters?.timePeriod !== initialFilters.timePeriod) {
      setTimePeriod(initialFilters.timePeriod);
    }
    
    // Update ref for next comparison
    prevInitialFiltersRef.current = initialFilters;
  }, [initialFilters, setWallets, setTimePeriod]);
  
    /**
     * Memoize wallets string to prevent unnecessary re-fetches
     * Only changes when wallet addresses actually change, not on array reference change
     */
  const walletsString = useMemo(() => {
    if (!filters.wallets || filters.wallets.length === 0) return undefined;
    return filters.wallets.sort().join(',');
  }, [filters.wallets]);

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<BalanceRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      tokens: filters.tokens?.join(','),
      wallets: walletsString,
      timezone,
    }),
    [filters.timePeriod, filters.tokens, walletsString, timezone]
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
      legend: isMultiWallet ? {
        ...baseOption.legend,
        show: true,
        top: '5%',
        left: 'center',
        // textStyle: {
        //   color: chartTheme.mode === 'dark' ? '#fff' : '#000',
        // },
      } : undefined,
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
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const timestamp = params[0].value[0];
          let tooltipContent = `
            <div style="font-weight: 600; margin-bottom: 8px;">
              ${formatTimestampWithTimezone(timestamp, timezone, 'PPpp')}
            </div>
          `;
          
          // Add each series value
          params.forEach((param: any) => {
            const value = param.value[1];
            tooltipContent += `
              <div style="margin-top: 4px;">
                <span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${param.color};"></span>
                ${param.seriesName}: <strong>${formatCurrency(value)}</strong>
              </div>
            `;
          });
          
          return tooltipContent;
        },
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
        <ReactECharts
          ref={chartRef}
          option={chartOption}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          notMerge
          lazyUpdate
        />
      )}
    </BaseChart>
  );
}
