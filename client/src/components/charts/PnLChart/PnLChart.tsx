import React, { useMemo, useRef, useState, useCallback, useEffect, type RefObject } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption, getChartGridConfig } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchPnLChart, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '@/util/chart-helpers';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import type { PnLRequestParams } from '@/types/chart-api.types';
import type { TimePeriod } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGrid, ChartGridItem } from '@/components/charts/shared';
import sharedStyles from '../shared/ChartStyle.module.scss';

function getWindowDaysFromPeriod(timePeriod?: string): 7 | 30 {
    return timePeriod?.toUpperCase() === '7D' ? 7 : 30;
}

type PnLChartData = InferFetcherData<typeof fetchPnLChart>;

export interface PnLChartProps {
    title?: string;
    minHeight?: number;
    initialTimePeriod?: TimePeriod;
    initialWallets?: string[];
    aggregation?: 'daily' | 'weekly' | 'monthly';
    autoRefresh?: boolean;
    refreshInterval?: number;
    className?: string;
    initialViewMode?: 'daily' | 'cumulative' | 'both';
    initialFilters?: {
        timePeriod?: TimePeriod;
        wallets?: string[];
    };

    /** When true, load data only after user clicks 7D or 30D (no fetch on mount). */
    loadOnInteractionOnly?: boolean;
}

export const PnLChart: React.FC<PnLChartProps> = ({
    title,
    minHeight = 400,
    initialTimePeriod = '30D',
    initialWallets = [],
    aggregation = 'daily',
    autoRefresh = true,
    refreshInterval = 30000,
    className,
    initialViewMode = 'both',
    initialFilters,
    loadOnInteractionOnly = false,
}) => {
    const { tr } = useLocalization();
    const chartTitle = title || tr('charts.pnlChart.title');

    const chartRef = useRef<ReactECharts>(null);
    const chartTheme = useChartTheme();
    const { selectedTimezone: timezone } = useChartContext();
    const [viewMode, setViewMode] = useState<'daily' | 'cumulative' | 'both'>(initialViewMode);

    const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
        initialFilters: initialFilters || {
            timePeriod: initialTimePeriod,
            wallets: initialWallets.length > 0 ? initialWallets : undefined,
        },
        debounceDelay: 300,
    });

    const [interactionLoadCount, setInteractionLoadCount] = useState(0);
    const [chartWindowDays, setChartWindowDays] = useState<7 | 30>(() =>
        getWindowDaysFromPeriod(initialFilters?.timePeriod ?? initialTimePeriod),
    );

    const effectiveAutoRefresh = loadOnInteractionOnly ? false : autoRefresh;

    useEffect(() => {
        if (!loadOnInteractionOnly) {
            return;
        }
        setInteractionLoadCount(0);
    }, [walletsString, loadOnInteractionOnly]);

    useEffect(() => {
        if (loadOnInteractionOnly) return;
        setChartWindowDays(getWindowDaysFromPeriod(filters.timePeriod));
    }, [filters.timePeriod, loadOnInteractionOnly]);

    const effectivePeriod = loadOnInteractionOnly
        ? (chartWindowDays === 7 ? '7D' : '30D')
        : filters.timePeriod;

    const query = useMemo<PnLRequestParams>(
        () => ({
            period: effectivePeriod,
            wallets: walletsString,
            aggregation,
            timezone,
        }),
        [effectivePeriod, walletsString, aggregation, timezone]
    );

    const { data, loadingState, refetch } =
        useStandardChartController<PnLChartData, PnLRequestParams>({
            fetcher: fetchPnLChart,
            query,
            fetchMode: loadOnInteractionOnly ? "manual" : "auto",
            autoRefresh: effectiveAutoRefresh,
            refreshInterval,
        });

    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    useEffect(() => {
        if (!loadOnInteractionOnly || interactionLoadCount === 0) {
            return;
        }
        void refetchRef.current(true);
    }, [interactionLoadCount, loadOnInteractionOnly]);

    const handleWindowRangeClick = (days: 7 | 30) => {
        const period = days === 7 ? "7D" : "30D";
        setChartWindowDays(days);
        setTimePeriod(period);
        setInteractionLoadCount((c) => c + 1);
    };

    const displayData = data;

    const createChartOption = useCallback((
        dailyPnLData: Array<{ timestamp: number; value: number }>,
        cumulativePnLData: Array<{ timestamp: number; value: number }>,
        walletLabel?: string
    ): EChartsOption => {
        const profitColor = chartTheme.colorPalette[1];
        const lossColor = chartTheme.colorPalette[2];
        const cumulativeColor = chartTheme.colorPalette[0];
        const baseOption = getThemedChartBaseOption(chartTheme);

        const timestamps = dailyPnLData.map((item) => item.timestamp);
        const dailyValues = dailyPnLData.map((item) => item.value);
        const cumulativeValues = cumulativePnLData.map((item) => item.value);

        const xAxisData = timestamps.map((ts) => formatTimestampWithTimezone(ts, timezone, 'MM/dd'));
        const showDaily = viewMode === 'daily' || viewMode === 'both';
        const showCumulative = viewMode === 'cumulative' || viewMode === 'both';

        const series: any[] = [];

        if (showDaily) {
            series.push({
                name: tr('charts.pnlChart.dailyPnL'),
                type: 'bar',
                yAxisIndex: viewMode === 'both' ? 0 : undefined,
                data: dailyValues,
                itemStyle: {
                    color: (params: any) => (params.value >= 0 ? profitColor : lossColor),
                },
            });
        }

        if (showCumulative) {
            series.push({
                name: tr('charts.pnlChart.cumulativePnL'),
                type: 'line',
                yAxisIndex: viewMode === 'both' ? 1 : undefined,
                data: cumulativeValues,
                smooth: true,
                lineStyle: {
                    color: cumulativeColor,
                    width: 2,
                },
                itemStyle: {
                    color: cumulativeColor,
                },
            });
        }

        const formatAxisValue = (value: number) => {
            if (Math.abs(value) >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
            }
            if (Math.abs(value) >= 1000) {
                return `$${(value / 1000).toFixed(1)}K`;
            }
            return formatCurrency(value);
        };

        const yAxis: any[] = [];
        if (viewMode === 'both') {
            yAxis.push({
                ...baseOption.yAxis,
                type: 'value',
                name: tr('charts.pnlChart.dailyPnL'),
                position: 'left',
                axisLabel: {
                    ...baseOption.yAxis.axisLabel,
                    formatter: formatAxisValue,
                },
            });
            yAxis.push({
                ...baseOption.yAxis,
                type: 'value',
                name: tr('charts.pnlChart.cumulativePnL'),
                position: 'right',
                axisLabel: {
                    ...baseOption.yAxis.axisLabel,
                    formatter: formatAxisValue,
                },
                splitLine: { show: false },
            });
        } else {
            yAxis.push({
                ...baseOption.yAxis,
                type: 'value',
                name: viewMode === 'daily' ? tr('charts.pnlChart.dailyPnL') : tr('charts.pnlChart.cumulativePnL'),
                axisLabel: {
                    ...baseOption.yAxis.axisLabel,
                    formatter: formatAxisValue,
                },
            });
        }

        return {
            ...baseOption,
            title: walletLabel
                ? {
                    text: walletLabel,
                    left: 8,
                    top: 8,
                    textStyle: {
                        color: chartTheme.textColor,
                        fontSize: 16,
                        fontWeight: 'bold',
                    },
                }
                : undefined,
            grid: getChartGridConfig(),
            tooltip: {
                ...baseOption.tooltip,
                trigger: 'axis',
                formatter: (params: any) => {
                    if (!Array.isArray(params) || params.length === 0) return '';

                    const timestamp = timestamps[params[0].dataIndex];
                    const date = formatTimestampWithTimezone(timestamp, timezone, 'PPP');
                    const dailyValue = dailyValues[params[0].dataIndex];
                    const cumulativeValue = cumulativeValues[params[0].dataIndex];

                    let tooltipContent = createTooltipHeader(date);

                    if (showDaily) {
                        tooltipContent += createTooltipRow(
                            tr('charts.pnlChart.dailyPnL'),
                            formatCurrency(dailyValue),
                            { valueColor: dailyValue >= 0 ? profitColor : lossColor }
                        );
                    }

                    if (showCumulative) {
                        tooltipContent += createTooltipRow(
                            tr('charts.pnlChart.cumulativePnL'),
                            formatCurrency(cumulativeValue)
                        );
                    }

                    return tooltipContent;
                },
            },
            xAxis: [{
                ...baseOption.xAxis,
                type: 'category',
                data: xAxisData,
            }],
            yAxis,
            series,
        };
    }, [chartTheme, timezone, tr, viewMode]);

    const chartOptions = useMemo(() => {
        if (!displayData || 'error' in displayData) return [];

        if ('wallets' in displayData && displayData.wallets && displayData.wallets.length > 0) {
            return displayData.wallets.map((wallet) => ({
                walletAddress: wallet.walletAddress,
                option: createChartOption(
                    wallet.dailyPnL,
                    wallet.cumulativePnL,
                    `${wallet.walletAddress.slice(0, 8)}...`
                ),
            }));
        }

        if ('dailyPnL' in displayData && displayData.dailyPnL && displayData.dailyPnL.length > 0) {
            return [{
                walletAddress: 'aggregated',
                option: createChartOption(displayData.dailyPnL, displayData.cumulativePnL!, undefined),
            }];
        }

        return [];
    }, [displayData, createChartOption]);

    const isEmpty =
        (loadOnInteractionOnly && interactionLoadCount === 0) ||
        !displayData ||
        'error' in displayData ||
        ((!('wallets' in displayData) || !displayData.wallets || displayData.wallets.length === 0) &&
            (!('dailyPnL' in displayData) || !displayData.dailyPnL || displayData.dailyPnL.length === 0));

    return (
        <BaseChart
            title={chartTitle}
            loadingState={loadingState}
            isEmpty={isEmpty}
            onRetry={() => {
                if (loadOnInteractionOnly && interactionLoadCount === 0) {
                    return;
                }
                refetch(false);
            }}
            preserveChildrenWhenEmpty={loadOnInteractionOnly && interactionLoadCount === 0}
            actions={
                loadOnInteractionOnly ? (
                    <button
                        type="button"
                        className="cds--btn cds--btn--primary cds--btn--sm"
                        onClick={() => handleWindowRangeClick(chartWindowDays)}
                    >
                        {tr('charts.loadData')}
                    </button>
                ) : undefined
            }
        >
            {loadOnInteractionOnly && (
                <div className={`${sharedStyles.chartControls} ${sharedStyles.balanceChartControlArea}`}>
                    <div className={sharedStyles.balanceChartControlTopRow}>
                        <div className={sharedStyles.balanceChartWindowToggleGroup}>
                            <button
                                type="button"
                                className={`${sharedStyles.chartToggleButton} ${sharedStyles.balanceChartWindowButton} ${interactionLoadCount > 0 && chartWindowDays === 7 ? sharedStyles.balanceChartWindowButtonActive : ''}`}
                                onClick={() => handleWindowRangeClick(7)}
                                aria-pressed={interactionLoadCount > 0 && chartWindowDays === 7}
                            >
                                {tr('charts.balanceChart.window7d')}
                            </button>
                            <button
                                type="button"
                                className={`${sharedStyles.chartToggleButton} ${sharedStyles.balanceChartWindowButton} ${interactionLoadCount > 0 && chartWindowDays === 30 ? sharedStyles.balanceChartWindowButtonActive : ''}`}
                                onClick={() => handleWindowRangeClick(30)}
                                aria-pressed={interactionLoadCount > 0 && chartWindowDays === 30}
                            >
                                {tr('charts.balanceChart.window30d')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--between']} ${sharedStyles['chartControls--withBackground']}`}>
                <div className={sharedStyles['chartToggle--padded']}>
                    <button
                        className={`${sharedStyles.chartToggleButton} ${viewMode === 'daily' ? sharedStyles.active : ''}`}
                        onClick={() => setViewMode('daily')}
                        aria-label={tr('charts.pnlChart.dailyPnL')}
                        title={tr('charts.pnlChart.dailyPnL')}
                    >
                        {tr('charts.pnlChart.dailyPnL')}
                    </button>
                    <button
                        className={`${sharedStyles.chartToggleButton} ${viewMode === 'cumulative' ? sharedStyles.active : ''}`}
                        onClick={() => setViewMode('cumulative')}
                        aria-label={tr('charts.pnlChart.cumulativePnL')}
                        title={tr('charts.pnlChart.cumulativePnL')}
                    >
                        {tr('charts.pnlChart.cumulativePnL')}
                    </button>
                    <button
                        className={`${sharedStyles.chartToggleButton} ${viewMode === 'both' ? sharedStyles.active : ''}`}
                        onClick={() => setViewMode('both')}
                        aria-label={tr('charts.pnlChart.both')}
                        title={tr('charts.pnlChart.both')}
                    >
                        {tr('charts.pnlChart.both')}
                    </button>
                </div>
            </div> */}

            {chartOptions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <ChartGrid itemCount={chartOptions.length} multiItemColumns={2}>
                        {chartOptions.map((chartData, index) => (
                            <ChartGridItem
                                key={chartData.walletAddress}
                                itemKey={chartData.walletAddress}
                                minHeight={minHeight}
                            >
                                <ReactECharts
                                    ref={index === 0 ? chartRef : undefined}
                                    option={chartData.option}
                                    style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                                    notMerge
                                    lazyUpdate
                                />
                            </ChartGridItem>
                        ))}
                    </ChartGrid>
                </div>
            )}
        </BaseChart>
    );
};
