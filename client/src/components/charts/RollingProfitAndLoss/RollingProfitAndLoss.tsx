import React, { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';

import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption, getChartGridConfig } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchRollingAnnualReturn, type InferFetcherData } from '@/services/chart/chartApi';
import type { RollingAnnualReturnRequestParams } from '@/types/chart-api.types';
import type { RollingProfitAndLossResponse } from '@/types/chart-api.types';
import type { TimePeriod } from '@/types/chart-filters.types';

type ValueType = 'total' | 'realized' | 'unrealized';

import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGrid, ChartGridItem } from '@/components/charts/shared';
import sharedStyles from '../shared/ChartStyle.module.scss';
import type { ChartProps } from '../shared/ChartProp';

type Data = InferFetcherData<typeof fetchRollingAnnualReturn>;

export const RollingProfitAndLoss: React.FC<ChartProps> = ({
    title,
    minHeight = 360,
    initialFilters = {
        timePeriod: '30D',
        wallets: [],
    },
    autoRefresh = false,
    refreshInterval = 30000,
    className,
}) => {
    const { tr } = useLocalization();
    const chartTitle = title || tr('charts.rollingAnnualReturn.title') || 'Rolling P&L';
    const TIME_PERIOD_LABELS = [
        tr('charts.last7Days'),
        tr('charts.last30Days'),
        tr('charts.last90Days'),
        tr('charts.allTime'),
    ]


    const chartTheme = useChartTheme();
    const { selectedTimezone: timezone } = useChartContext();

    const initialWallets = Array.isArray(initialFilters?.wallets) ? initialFilters.wallets : undefined;

    const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
        initialFilters: {
            timePeriod: initialFilters?.timePeriod || '30D',
            wallets: initialWallets,
        },
        debounceDelay: 300,
    });

    const query = useMemo<RollingAnnualReturnRequestParams>(() => ({
        period: filters.timePeriod,
        wallets: walletsString,
        timezone,
    }), [filters.timePeriod, walletsString, timezone]);

    const { data, loadingState, refetch } = useStandardChartController<Data, RollingAnnualReturnRequestParams>({
        fetcher: fetchRollingAnnualReturn,
        query,
        autoRefresh,
        refreshInterval,
    });

    // Determine available value types from metadata
    const availableValueTypes: ValueType[] = ((data && (data as RollingProfitAndLossResponse).metadata?.availableValueTypes) as ValueType[] | undefined) || ['total', 'realized', 'unrealized'];
    const defaultValueType: ValueType = availableValueTypes.includes('total') ? 'total' : (availableValueTypes[0] ?? 'total');
    const [valueType, setValueType] = useState<ValueType>(defaultValueType);

    // Ensure local valueType remains valid when availableValueTypes changes
    useEffect(() => {
        const defaultVT: ValueType = availableValueTypes.includes('total') ? 'total' : (availableValueTypes[0] ?? 'total');
        setValueType(prev => (availableValueTypes.includes(prev) ? prev : defaultVT));
    }, [availableValueTypes]);

    const createPerWalletOption = (payload: RollingProfitAndLossResponse): EChartsOption => {
        const base = getThemedChartBaseOption(chartTheme);
        const wallets = payload.wallets ?? [];
        const labels = wallets.map(w => w.walletName ?? (w.walletAddress ? `${w.walletAddress.slice(0, 6)}...${w.walletAddress.slice(-4)}` : 'Unknown'));
        const values = wallets.map(w => (w.metrics as any)[valueType] ?? 0);

        return {
            ...base,
            grid: getChartGridConfig(),
            xAxis: { ...base.xAxis, type: 'category', data: labels, axisLabel: { rotate: 30 } },
            yAxis: { ...base.yAxis, type: 'value', name: 'USD' },
            tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
            series: [
                {
                    name: valueType,
                    type: 'bar',
                    data: values,
                    itemStyle: { color: chartTheme.colorPalette[0] },
                },
            ],
        };
    };

    const createAggregatedOption = (payload: RollingProfitAndLossResponse): EChartsOption => {
        const base = getThemedChartBaseOption(chartTheme);
        const m = payload.metrics ?? { total: 0, realized: 0, unrealized: 0 };
        const labels = ['Total', 'Realized', 'Unrealized'];
        const values = [m.total ?? 0, m.realized ?? 0, m.unrealized ?? 0];

        return {
            ...base,
            grid: getChartGridConfig(),
            xAxis: { ...base.xAxis, type: 'category', data: labels },
            yAxis: { ...base.yAxis, type: 'value', name: 'USD' },
            tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
            series: [
                {
                    name: 'Metric',
                    type: 'bar',
                    data: values,
                    itemStyle: { color: chartTheme.colorPalette[0] },
                },
            ],
        };
    };

    const chartRender = useMemo(() => {
        if (!data) return null;

        // If data is already timeseries (back-compat), don't try to render here
        if (!('wallets' in (data as any)) && !('metrics' in (data as any))) {
            return null; // upstream component should handle timeseries case
        }

        const payload = data as RollingProfitAndLossResponse;


        // Per-wallet view
        if (payload.wallets && payload.wallets.length > 0) {
            const option = createPerWalletOption(payload);
            return (
                <ChartGrid itemCount={1} multiItemColumns={1}>
                    <ChartGridItem itemKey="pnl" minHeight={minHeight}>
                        <ReactECharts option={option} style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }} notMerge lazyUpdate />
                    </ChartGridItem>
                </ChartGrid>
            );
        }

        // Aggregated view
        if (payload.metrics) {
            const option = createAggregatedOption(payload);
            return (
                <ChartGrid itemCount={1} multiItemColumns={1}>
                    <ChartGridItem itemKey="pnl-agg" minHeight={minHeight}>
                        <ReactECharts option={option} style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }} notMerge lazyUpdate />
                    </ChartGridItem>
                </ChartGrid>
            );
        }

        return null;
    }, [data, valueType, chartTheme, minHeight]);

    const isEmpty = !data || (data && (!('wallets' in (data as any)) && !('metrics' in (data as any))));

    return (
        <BaseChart title={chartTitle} loadingState={loadingState} isEmpty={isEmpty} onRetry={() => refetch(false)}>
            <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']} ${sharedStyles['chartControls--withBackground']}`}>
                <select
                    value={filters.timePeriod}
                    onChange={e => setTimePeriod(e.target.value as TimePeriod)}
                    className={sharedStyles.chartSelect}
                    aria-label="Time period"
                >
                    {(['7D', '30D', '90D', 'All'] as TimePeriod[]).map((p, key) => (
                        <option key={key} value={p}>{TIME_PERIOD_LABELS[key]}</option>
                    ))}
                </select>

                <select value={valueType} onChange={e => setValueType(e.target.value as ValueType)} className={sharedStyles.chartSelect} aria-label="Value type">
                    {availableValueTypes.map(v => (
                        <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                </select>
            </div>

            {chartRender}
        </BaseChart>
    );
};

export default RollingProfitAndLoss;
