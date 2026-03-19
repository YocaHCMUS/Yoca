import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchBalanceTrend, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getConditionalLegend } from '@/util/chart-legend-config';
import type { BalanceRequestParams } from '@/types/chart-api.types';

// Infer response type from fetcher
type BalanceTrendData = InferFetcherData<typeof fetchBalanceTrend>;
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import sharedStyles from '../shared/ChartStyle.module.scss';


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
  enableTokenSelector = false,
  tokenSelectorOptions = [],
  allowMultiTokenSelection = true,
  balanceChartMode = 'auto',
  // onDataLoaded,
  className,
}: ChartProps) {
  const { tr } = useLocalization();
  const chartTitle = title || tr('charts.balanceChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Use centralized filter sync hook
  const { filters, setTokens, walletsString, tokensString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const normalizedSelectedTokens = useMemo(
    () => new Set((filters.tokens ?? []).map(token => token.trim().toUpperCase())),
    [filters.tokens]
  );

  const queryTokensString = balanceChartMode === 'total' ? undefined : tokensString;

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<BalanceRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      tokens: queryTokensString,
      wallets: walletsString,
      timezone,
    }),
    [filters.timePeriod, queryTokensString, walletsString, timezone]
  );

  console.log('[BalanceChart] Query params:', { query, walletsString });

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<BalanceTrendData, BalanceRequestParams>({
      fetcher: fetchBalanceTrend,
      query,
      autoRefresh,
      refreshInterval,
      // onDataLoaded,
    });

  const tokenOptions = useMemo(() => {
    const optionsMap = new Map<string, string>();

    for (const option of tokenSelectorOptions ?? []) {
      const value = String(option ?? '').trim();
      if (!value) continue;
      optionsMap.set(value.toUpperCase(), value.toUpperCase());
    }

    if (data && !('error' in data)) {
      const metadata = data.metadata as { tokens?: string[] };
      const metadataTokens = Array.isArray(metadata.tokens) ? metadata.tokens : [];
      for (const token of metadataTokens) {
        const value = String(token ?? '').trim();
        if (!value) continue;
        optionsMap.set(value.toUpperCase(), value.toUpperCase());
      }
    }

    return Array.from(optionsMap.values());
  }, [tokenSelectorOptions, data]);

  const showTokenSelector = enableTokenSelector && tokenOptions.length > 0;

  const handleSelectAllTokens = () => {
    setTokens([]);
  };

  const handleToggleToken = (token: string) => {
    const normalized = token.trim().toUpperCase();
    if (!normalized) return;

    if (!allowMultiTokenSelection) {
      setTokens([normalized]);
      return;
    }

    const next = new Set(normalizedSelectedTokens);
    if (next.has(normalized)) {
      next.delete(normalized);
    } else {
      next.add(normalized);
    }

    setTokens(Array.from(next.values()));
  };

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
    if (!data || 'error' in data) return null;

    const meta = data.metadata as Record<string, any>;
    const isTokenMode =
      balanceChartMode === 'token'
        ? true
        : balanceChartMode === 'total'
          ? false
          : meta?.mode === 'token';

    const baseOption = getThemedChartBaseOption(chartTheme);

    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d',
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
    ];

    if (isTokenMode) {
      const tokenSymbols: string[] = meta?.tokens ?? [];
      const hasSingleToken = tokenSymbols.length === 1;
      const primarySymbol = tokenSymbols[0] ?? 'Token';

      const getSeriesTokenSymbol = (seriesName: string) => {
        const matched = seriesName.match(/([A-Za-z0-9._-]+)\s+\((?:units|USD)\)$/i);
        return matched ? matched[1] : undefined;
      };

      const seriesConfig = data.series.map((series, index) => {
        const isUsd = series.unit === 'USD';
        const color = colors[index % colors.length];
        const timestamps = series.data.map((point: any) => point.timestamp);
        const values = series.data.map((point: any) => point.value);

        if (series.seriesType === 'bar' || isUsd) {
          return {
            name: series.name,
            type: 'bar' as const,
            yAxisIndex: 1,
            data: timestamps.map((timestamp: number, idx: number) => [timestamp, values[idx]]),
            itemStyle: { color },
          };
        }

        return {
          name: series.name,
          type: 'line' as const,
          smooth: true,
          yAxisIndex: 0,
          data: timestamps.map((timestamp: number, idx: number) => [timestamp, values[idx]]),
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${color}4D` },
                { offset: 1, color: `${color}0D` },
              ],
            },
          },
          lineStyle: { color, width: 2 },
          itemStyle: { color },
        };
      });

      return {
        ...baseOption,
        color: colors,
        grid: { left: '8%', right: '8%', bottom: '12%', top: '20%', containLabel: true },
        legend: getConditionalLegend(chartTheme, data.series.map(s => s.name), 2, false),
        xAxis: {
          ...baseOption.xAxis,
          type: 'time',
          boundaryGap: false as any,
          axisLabel: {
            ...baseOption.xAxis.axisLabel,
            formatter: (value: number) => formatTimestampWithTimezone(value, timezone, 'MMM dd'),
          },
        },
        yAxis: [
          {
            ...baseOption.yAxis,
            type: 'value',
            name: hasSingleToken ? primarySymbol : tr('charts.tokens'),
            axisLabel: {
              ...baseOption.yAxis.axisLabel,
              formatter: (value: number) => {
                if (!hasSingleToken) return value.toLocaleString();
                return `${value.toLocaleString()} ${primarySymbol}`;
              },
            },
          },
          {
            ...baseOption.yAxis,
            type: 'value',
            name: 'USD',
            position: 'right',
            axisLabel: {
              ...baseOption.yAxis.axisLabel,
              formatter: (value: number) => formatCurrency(value),
            },
          },
        ],
        series: seriesConfig,
        tooltip: {
          ...baseOption.tooltip,
          trigger: 'axis',
          formatter: (params: any) => formatAxisTooltip(
            params,
            (p) => formatTimestampWithTimezone(p.value[0], timezone, 'PPpp'),
            (p) => {
              const seriesEntry = data.series.find(s => s.name === p.seriesName);
              if (seriesEntry?.unit === 'TOKEN') {
                const symbol = hasSingleToken ? primarySymbol : getSeriesTokenSymbol(seriesEntry.name);
                return symbol
                  ? `${p.value[1].toLocaleString()} ${symbol}`
                  : p.value[1].toLocaleString();
              }
              return formatCurrency(p.value[1]);
            }
          ),
        },
      };
    }

    const isMultiWallet = data.series.length > 1;

    const seriesConfig = data.series.map((series, index) => {
      const enableSampling = series.data.length > 2000;
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
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}4D` },
              { offset: 1, color: `${color}0D` },
            ],
          },
        },
        lineStyle: { color, width: 2 },
        itemStyle: { color },
      };
    });

    return {
      ...baseOption,
      color: colors,
      grid: { left: '8%', right: '8%', bottom: '12%', top: '20%', containLabel: true },
      legend: getConditionalLegend(chartTheme, data.series.map(s => s.name), 2, false),
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        boundaryGap: false as any,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatTimestampWithTimezone(value, timezone, 'MMM dd'),
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
  }, [data, timezone, chartTheme, tr, balanceChartMode]);

  return (
    <BaseChart
      title={chartTitle}
      // height="100%"
      loadingState={loadingState}
      isEmpty={!data || 'error' in data || data.series.length === 0 || data.series[0].data.length === 0}
      onRetry={() => refetch(false)}
    >
      {showTokenSelector && (
        <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--between']} ${sharedStyles['chartControls--withBackground']}`}>
          <div className={sharedStyles.limitSelector}>
            <label>{tr('charts.tokens')}</label>
          </div>
          <div className={sharedStyles['chartToggle--padded']} style={{ display: 'flex', flexWrap: 'wrap' }}>
            <button
              className={`${sharedStyles.chartToggleButton} ${normalizedSelectedTokens.size === 0 ? sharedStyles.active : ''}`}
              onClick={handleSelectAllTokens}
              type="button"
            >
              {tr('charts.allTokens')}
            </button>
            {tokenOptions.map((token) => {
              const isActive = normalizedSelectedTokens.has(token.toUpperCase());
              return (
                <button
                  key={token}
                  className={`${sharedStyles.chartToggleButton} ${isActive ? sharedStyles.active : ''}`}
                  onClick={() => handleToggleToken(token)}
                  type="button"
                >
                  {token}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
