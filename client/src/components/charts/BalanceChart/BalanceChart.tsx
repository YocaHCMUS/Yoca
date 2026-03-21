import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { BalanceRequestParams, ChartPageInfo } from '@/types/chart-api.types';

// Infer response type from fetcher
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import sharedStyles from '../shared/ChartStyle.module.scss';

type BalanceTrendData = InferFetcherData<typeof fetchBalanceTrend>;
const CHART_CHUNK_LIMIT = 180;

type BalanceSeriesPoint = { timestamp: number; value: number };

type BalanceSeries = {
    name: string;
    data: BalanceSeriesPoint[];
    seriesType?: 'line' | 'bar';
    unit?: 'TOKEN' | 'USD';
};

type BalanceChartDisplayData = {
    series: BalanceSeries[];
    wallets?: string[];
    metadata: Record<string, unknown> & {
        dataPoints?: number;
        tokens?: string[];
        mode?: 'total' | 'token';
    };
    pageInfo?: ChartPageInfo;
};

function isBalanceChartDisplayData(value: unknown): value is BalanceChartDisplayData {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const raw = value as { series?: unknown };
    return Array.isArray(raw.series);
}

function mergeSeriesByTimestamp(
    existing: Array<{ timestamp: number; value: number }>,
    incoming: Array<{ timestamp: number; value: number }>,
): Array<{ timestamp: number; value: number }> {
    const byTimestamp = new Map<number, { timestamp: number; value: number }>();

    for (const point of existing) {
        byTimestamp.set(point.timestamp, point);
    }

    for (const point of incoming) {
        byTimestamp.set(point.timestamp, point);
    }

    return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeSeriesData(
    points: Array<{ timestamp: number; value: number }>,
): Array<{ timestamp: number; value: number }> {
    const normalized = points
        .map((point) => ({
            timestamp: Number(point.timestamp),
            value: Number(point.value),
        }))
        .filter(
            (point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value),
        )
        .sort((a, b) => a.timestamp - b.timestamp);

    const deduped: Array<{ timestamp: number; value: number }> = [];
    for (const point of normalized) {
        if (deduped.length > 0 && deduped[deduped.length - 1].timestamp === point.timestamp) {
            deduped[deduped.length - 1] = point;
            continue;
        }

        deduped.push(point);
    }

    return deduped;
}

function mergeBalanceChartData(previous: BalanceChartDisplayData, incoming: BalanceChartDisplayData): BalanceChartDisplayData {
    const previousByName = new Map(previous.series.map((series) => [series.name, series]));
    const mergedSeries = incoming.series.map((series) => {
        const previousSeries = previousByName.get(series.name);
        return {
            ...series,
            data: normalizeSeriesData(mergeSeriesByTimestamp(previousSeries?.data ?? [], series.data)),
        };
    });

    for (const previousSeries of previous.series) {
        if (!mergedSeries.some((series) => series.name === previousSeries.name)) {
            mergedSeries.push(previousSeries);
        }
    }

    return {
        ...incoming,
        wallets: incoming.wallets ?? previous.wallets,
        metadata: {
            ...previous.metadata,
            ...incoming.metadata,
            dataPoints: mergedSeries[0]?.data.length ?? Number(incoming.metadata.dataPoints ?? 0),
        },
        series: mergedSeries,
    };
}

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
    className,
}: ChartProps) {
    const { tr } = useLocalization();
    const chartTitle = title || tr('charts.balanceChart.title');

    const chartRef = useRef<ReactECharts>(null);
    const chartTheme = useChartTheme();
    const { selectedTimezone: timezone } = useChartContext();

    const { filters, setTokens, walletsString, tokensString } = useChartFiltersSync({
        initialFilters,
        debounceDelay: 300,
    });

    const normalizedSelectedTokens = useMemo(
        () => new Set((filters.tokens ?? []).map((token) => token.trim().toUpperCase())),
        [filters.tokens]
    );

    const queryTokensString = balanceChartMode === 'total' ? undefined : tokensString;

    const query = useMemo<BalanceRequestParams>(
        () => ({
            timePeriod: filters.timePeriod,
            tokens: queryTokensString,
            wallets: walletsString,
            timezone,
            limit: CHART_CHUNK_LIMIT,
        }),
        [filters.timePeriod, queryTokensString, walletsString, timezone]
    );

    const { data, loadingState, refetch } =
        useStandardChartController<BalanceTrendData, BalanceRequestParams>({
            fetcher: fetchBalanceTrend,
            query,
            autoRefresh,
            refreshInterval,
        });

    const [mergedData, setMergedData] = useState<BalanceChartDisplayData | null>(null);
    const [pageInfo, setPageInfo] = useState<ChartPageInfo | null>(null);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    useEffect(() => {
        if (!data || 'error' in data || !isBalanceChartDisplayData(data)) {
            setMergedData(null);
            setPageInfo(null);
            return;
        }

        const normalizedData: BalanceChartDisplayData = {
            ...data,
            series: data.series.map((series) => ({
                ...series,
                data: normalizeSeriesData(series.data),
            })),
        };

        setMergedData(normalizedData);
        setPageInfo(normalizedData.pageInfo ?? null);
    }, [data]);

    const displayData = useMemo<BalanceChartDisplayData | null>(() => {
        if (mergedData) {
            return mergedData;
        }

        if (data && !('error' in data) && isBalanceChartDisplayData(data)) {
            return data;
        }

        return null;
    }, [mergedData, data]);

    const handleLoadOlder = useCallback(async () => {
        if (!pageInfo?.hasMore || !pageInfo.nextCursor || isFetchingMore) {
            return;
        }

        setIsFetchingMore(true);
        try {
            const olderChunk = await fetchBalanceTrend({
                ...query,
                cursor: pageInfo.nextCursor,
                limit: CHART_CHUNK_LIMIT,
            });

            if (!olderChunk || 'error' in olderChunk || !isBalanceChartDisplayData(olderChunk)) {
                return;
            }

            setMergedData((previous) => {
                if (!previous) {
                    return olderChunk;
                }

                return mergeBalanceChartData(previous, olderChunk);
            });
            setPageInfo(olderChunk.pageInfo ?? null);
        } catch (error) {
            console.error('[BalanceChart] Failed to load older chunk', error);
        } finally {
            setIsFetchingMore(false);
        }
    }, [isFetchingMore, pageInfo, query]);

    const tokenOptions = useMemo(() => {
        const optionsMap = new Map<string, string>();

        for (const option of tokenSelectorOptions ?? []) {
            const value = String(option ?? '').trim();
            if (!value) continue;
            optionsMap.set(value.toUpperCase(), value.toUpperCase());
        }

        if (displayData) {
            const metadata = displayData.metadata as { tokens?: string[] };
            const metadataTokens = Array.isArray(metadata.tokens) ? metadata.tokens : [];
            for (const token of metadataTokens) {
                const value = String(token ?? '').trim();
                if (!value) continue;
                optionsMap.set(value.toUpperCase(), value.toUpperCase());
            }
        }

        return Array.from(optionsMap.values());
    }, [tokenSelectorOptions, displayData]);

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

    const chartOption = useMemo((): EChartsOption | null => {
        if (!displayData) return null;

        const meta = displayData.metadata as Record<string, any>;
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

            const seriesConfig = displayData.series.map((series, index) => {
                const isUsd = series.unit === 'USD';
                const color = colors[index % colors.length];
                const normalizedData = normalizeSeriesData(series.data);
                const timestamps = normalizedData.map((point: any) => point.timestamp);
                const values = normalizedData.map((point: any) => point.value);
                const isSinglePoint = normalizedData.length <= 1;

                if (series.seriesType === 'bar' || isUsd) {
                    return {
                        name: series.name,
                        type: 'bar' as const,
                        yAxisIndex: 1,
                        data: timestamps.map((timestamp: number, idx: number) => [timestamp, values[idx]]),
                        barMinHeight: isSinglePoint ? 3 : 0,
                        itemStyle: { color },
                    };
                }

                return {
                    name: series.name,
                    type: 'line' as const,
                    smooth: true,
                    yAxisIndex: 0,
                    data: timestamps.map((timestamp: number, idx: number) => [timestamp, values[idx]]),
                    showSymbol: isSinglePoint,
                    symbolSize: isSinglePoint ? 8 : 4,
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
                legend: getConditionalLegend(chartTheme, displayData.series.map((series) => series.name), 2, false),
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
                        (point) => formatTimestampWithTimezone(point.value[0], timezone, 'PPpp'),
                        (point) => {
                            const seriesEntry = displayData.series.find((series) => series.name === point.seriesName);
                            if (seriesEntry?.unit === 'TOKEN') {
                                const symbol = hasSingleToken ? primarySymbol : getSeriesTokenSymbol(seriesEntry.name);
                                return symbol
                                    ? `${point.value[1].toLocaleString()} ${symbol}`
                                    : point.value[1].toLocaleString();
                            }
                            return formatCurrency(point.value[1]);
                        }
                    ),
                },
            };
        }

        const isMultiWallet = displayData.series.length > 1;

        const seriesConfig = displayData.series.map((series, index) => {
            const normalizedData = normalizeSeriesData(series.data);
            const enableSampling = normalizedData.length > 2000;
            const timestamps = normalizedData.map((point: any) => point.timestamp);
            const values = normalizedData.map((point: any) => point.value);
            const color = colors[index % colors.length];
            const isSinglePoint = normalizedData.length <= 1;

            return {
                name: series.name,
                type: 'line' as const,
                smooth: true,
                sampling: enableSampling ? ('lttb' as const) : undefined,
                data: timestamps.map((timestamp: number, idx: number) => [timestamp, values[idx]]),
                showSymbol: isSinglePoint,
                symbolSize: isSinglePoint ? 8 : 4,
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
            legend: getConditionalLegend(chartTheme, displayData.series.map((series) => series.name), 2, false),
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
                    (point) => formatTimestampWithTimezone(point.value[0], timezone, 'PPpp'),
                    (point) => formatCurrency(point.value[1])
                ),
            },
        };
    }, [displayData, timezone, chartTheme, tr, balanceChartMode]);

    return (
        <BaseChart
            title={chartTitle}
            loadingState={loadingState}
            isEmpty={
                !displayData ||
                displayData.series.length === 0 ||
                !displayData.series.some((series) => normalizeSeriesData(series.data).length > 0)
            }
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

            {pageInfo?.hasMore && (
                <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']} ${sharedStyles['chartControls--withBackground']}`}>
                    <div className={sharedStyles['chartToggle--padded']}>
                        <button
                            className={sharedStyles.chartToggleButton}
                            onClick={handleLoadOlder}
                            type="button"
                            disabled={isFetchingMore}
                        >
                            {isFetchingMore ? 'Loading older...' : 'Load older'}
                        </button>
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
