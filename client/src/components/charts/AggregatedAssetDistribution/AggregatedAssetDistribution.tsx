import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Checkbox } from '@carbon/react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import {
    CHART_COLOR_PALETTE,
    useCarbonChartBaseOption,
} from '@/util/carbon-chart-base';
import { useCarbonTokens } from '@/hooks/useCarbonToken';
import { cds } from '@/util/carbon-theme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAssetDistribution, type InferFetcherData } from '@/services/chart/chartApi';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import type { DistributionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper } from '@/components/charts/shared';
import { useChartExport } from '@/hooks/useChartExport';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';
import type { ChartProps } from '../shared/ChartProp';
import { runChartExport } from '@/services/chart/chartExportService';
import { Flex } from '@/components/Flex';
import { FilterSwitch } from '@/components/FilterSwitch';
import { FilterType, SortType, Table } from '@/components/tables/Table';
import type { TableColumnHeader } from '@/components/tables/Table';
import tableStyles from '@/components/tables/Table.module.scss';
import styles from './AggregatedAssetDistribution.module.scss';
import { renderBase } from '@/components/tables/TableCellRenderer';

type TopNOption = 5 | 10 | 0;
type MinPctOption = 0 | 1 | 5 | 10;
type Mode = 'single' | 'aggregate';

interface AssetItem {
    name: string;
    value: number;
    percentage: number;
    color?: string;
    logoUri?: string;
    tokenAddress?: string;
    symbol?: string;
}

interface WalletRow {
    walletName: string;
    walletAddress: string;
    netWorth: number;
    uniqueTokenCount: number;
    data: AssetItem[];
}

interface WalletIdentityCellValue {
    label: string;
    walletAddress: string;
    toString: () => string;
}

function shortAddress(address: string): string {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function compactWalletLabel(label: string, walletAddress: string): string {
    const normalized = (label || walletAddress || '').trim();
    if (!normalized) return '';

    const looksLikeAddress = /^[1-9A-HJ-NP-Za-km-z]{24,}$/.test(normalized) || normalized === walletAddress;
    if (looksLikeAddress) {
        return shortAddress(normalized);
    }

    const maxLen = 18;
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 3)}...`;
}

function tokenKey(asset: AssetItem): string {
    return asset.tokenAddress || asset.symbol || asset.name;
}

function applyGrouping(
    raw: AssetItem[],
    topN: TopNOption,
    minPct: MinPctOption,
    othersLabel: string,
): (AssetItem & { hiddenNames?: string[] })[] {
    if (raw.length === 0) return [];

    const rawTotal = raw.reduce((s, a) => s + a.value, 0);
    const withPct = raw
        .map(a => ({ ...a, percentage: rawTotal > 0 ? (a.value / rawTotal) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

    const afterMinPct = minPct > 0
        ? withPct.filter(a => a.percentage >= minPct)
        : withPct;

    const kept = topN > 0 ? afterMinPct.slice(0, topN) : afterMinPct;

    const keptSet = new Set(kept.map(a => a.name));
    const hidden = withPct.filter(a => !keptSet.has(a.name));

    if (hidden.length === 0) return kept;

    const othersValue = hidden.reduce((s, a) => s + a.value, 0);
    const newTotal = kept.reduce((s, a) => s + a.value, 0) + othersValue;

    const recalcKept = kept.map(a => ({
        ...a,
        percentage: newTotal > 0 ? (a.value / newTotal) * 100 : 0,
    }));

    const othersItem = {
        name: othersLabel,
        value: othersValue,
        percentage: newTotal > 0 ? (othersValue / newTotal) * 100 : 0,
        hiddenNames: hidden.map(a => a.name),
    };

    return [...recalcKept, othersItem];
}

function aggregateWallets(wallets: WalletRow[]): AssetItem[] {
    if (wallets.length === 0) return [];

    const aggregate = new Map<string, AssetItem>();

    wallets.forEach((wallet) => {
        wallet.data.forEach((asset) => {
            const key = tokenKey(asset);
            const existing = aggregate.get(key);
            if (existing) {
                existing.value += asset.value;
            } else {
                aggregate.set(key, {
                    name: asset.name,
                    value: asset.value,
                    percentage: 0,
                    color: asset.color,
                    logoUri: asset.logoUri,
                    tokenAddress: asset.tokenAddress,
                    symbol: asset.symbol,
                });
            }
        });
    });

    return Array.from(aggregate.values());
}

type AssetDistributionData = InferFetcherData<typeof fetchAssetDistribution>;

export const AggregatedAssetDistribution: React.FC<ChartProps> = ({
    minHeight = 400,
    initialFilters,
    autoRefresh = true,
    refreshInterval = 30000,
    fetchEnabled = true,
    className,
}) => {
    const { tr, fmt } = useLocalization();
    const baseOption = useCarbonChartBaseOption();
    const { selectedTimezone: timezone } = useChartContext();

    const tokens = useCarbonTokens({ background: cds.background });
    const chartTitle = tr('charts.aggregatedAssetDistributionChart.title');
    const othersLabel = tr('charts.aggregatedAssetDistributionChart.others');

    const chartRef = useRef<ReactECharts>(null);

    const [mode, setMode] = useState<Mode>('single');
    const [topN, setTopN] = useState<TopNOption>(5);
    const [minPct, setMinPct] = useState<MinPctOption>(0);
    const [activeWalletAddress, setActiveWalletAddress] = useState<string>('');
    const [selectedWallets, setSelectedWallets] = useState<Set<string>>(new Set());

    const { filters, walletsString } = useChartFiltersSync({
        initialFilters,
        debounceDelay: 300,
    });

    const query = useMemo<DistributionRequestParams>(
        () => ({
            period: filters.timePeriod,
            wallets: walletsString,
        }),
        [filters.timePeriod, walletsString],
    );

    const { data, loadingState, refetch } =
        useStandardChartController<AssetDistributionData, DistributionRequestParams>({
            fetcher: fetchAssetDistribution,
            query,
            autoRefresh,
            refreshInterval,
            enabled: fetchEnabled,
        });

    const walletRows = useMemo<WalletRow[]>(() => {
        if (!data) return [];

        if ('wallets' in data && data.wallets && data.wallets.length > 0) {
            return data.wallets.map((wallet) => {
                const tokenData = wallet.data as AssetItem[];
                const netWorth = typeof wallet.totalValue === 'number'
                    ? wallet.totalValue
                    : tokenData.reduce((sum, item) => sum + item.value, 0);

                const uniqueTokenCount = new Set(tokenData.map(item => tokenKey(item))).size;

                return {
                    walletName: wallet.walletAddress,
                    walletAddress: wallet.walletAddress,
                    netWorth,
                    uniqueTokenCount,
                    data: tokenData,
                };
            });
        }

        if ('data' in data && Array.isArray(data.data) && data.data.length > 0) {
            const fallbackAddress = filters.wallets?.[0] ?? tr('charts.aggregatedAssetDistributionChart.walletTable.unknownWallet');
            const tokenData = data.data as AssetItem[];
            const netWorth = tokenData.reduce((sum, item) => sum + item.value, 0);

            return [
                {
                    walletName: fallbackAddress,
                    walletAddress: fallbackAddress,
                    netWorth,
                    uniqueTokenCount: new Set(tokenData.map(item => tokenKey(item))).size,
                    data: tokenData,
                },
            ];
        }

        return [];
    }, [data, filters.wallets, tr]);

    useEffect(() => {
        if (walletRows.length === 0) {
            setActiveWalletAddress('');
            setSelectedWallets(new Set());
            return;
        }

        const walletSet = new Set(walletRows.map(wallet => wallet.walletAddress));

        setActiveWalletAddress((prev) => {
            if (prev && walletSet.has(prev)) return prev;
            return walletRows[0].walletAddress;
        });

        setSelectedWallets((prev) => {
            const next = new Set(Array.from(prev).filter(address => walletSet.has(address)));
            if (next.size === 0) {
                walletRows.forEach((wallet) => next.add(wallet.walletAddress));
            }
            return next;
        });
    }, [walletRows]);

    useEffect(() => {
        if (mode !== 'aggregate' || walletRows.length === 0) return;
        setSelectedWallets((prev) => {
            if (prev.size > 0) return prev;
            return new Set(walletRows.map(wallet => wallet.walletAddress));
        });
    }, [mode, walletRows]);

    const modeWallets = useMemo(() => {
        if (walletRows.length === 0) return [] as WalletRow[];

        if (mode === 'single') {
            const active = walletRows.find(w => w.walletAddress === activeWalletAddress);
            return active ? [active] : [walletRows[0]];
        }

        return walletRows.filter(w => selectedWallets.has(w.walletAddress));
    }, [walletRows, mode, activeWalletAddress, selectedWallets]);

    const modeRawTokens = useMemo<AssetItem[]>(() => {
        if (modeWallets.length === 0) return [];
        if (mode === 'single') return modeWallets[0].data;
        return aggregateWallets(modeWallets);
    }, [modeWallets, mode]);

    const groupedTokens = useMemo(
        () => applyGrouping(modeRawTokens, topN, minPct, othersLabel),
        [modeRawTokens, topN, minPct, othersLabel],
    );

    const displayTotal = useMemo(
        () => groupedTokens.reduce((sum, token) => sum + token.value, 0),
        [groupedTokens],
    );

    const { exportPNG, exportSVG, exportPDF, exportCSV } = useChartExport({
        chartTitle,
        timezone,
        baseFilename: 'aggregated-asset-distribution',
    });

    const handleExport = useCallback(async (format: ExportFormat) => {
        if (!data) return;

        const instance = chartRef.current?.getEchartsInstance() ?? null;
        const csv: ChartDataSeries[] = [
            {
                id: 'aggregated-asset-distribution',
                name: tr('charts.aggregatedAssetDistributionChart.export.name'),
                type: 'pie',
                visible: true,
                data: groupedTokens.map(token => ({
                    name: token.name,
                    value: token.value,
                })),
            },
        ];

        const selectedCountLabel = tr('charts.aggregatedAssetDistributionChart.walletTable.selectedCount')
            .replace('{count}', String(selectedWallets.size));

        await runChartExport(
            {
                format,
                filters,
                chartInstance: instance as any,
                csvData: csv,
                csvFilters: { ...filters, wallets: [] },
                extraFilters: {
                    [tr('charts.aggregatedAssetDistributionChart.mode.label')]: mode === 'single'
                        ? tr('charts.aggregatedAssetDistributionChart.mode.single')
                        : tr('charts.aggregatedAssetDistributionChart.mode.aggregate'),
                    [tr('charts.aggregatedAssetDistributionChart.walletTable.selection')]: mode === 'single'
                        ? shortAddress(activeWalletAddress)
                        : selectedCountLabel,
                    [tr('charts.aggregatedAssetDistributionChart.filters.topN')]: topN === 0
                        ? tr('charts.aggregatedAssetDistributionChart.filters.all')
                        : `${tr('charts.aggregatedAssetDistributionChart.filters.top')} ${topN}`,
                    [tr('charts.aggregatedAssetDistributionChart.filters.minValue')]: minPct === 0
                        ? tr('charts.aggregatedAssetDistributionChart.filters.all')
                        : `>${minPct}%`,
                },
            },
            { exportPNG, exportSVG, exportPDF, exportCSV },
        );
    }, [
        data,
        groupedTokens,
        filters,
        tr,
        mode,
        selectedWallets.size,
        activeWalletAddress,
        topN,
        minPct,
        exportPNG,
        exportSVG,
        exportPDF,
        exportCSV,
    ]);

    const option = useMemo<EChartsOption>(() => {
        return {
            ...baseOption,
            xAxis: undefined,
            yAxis: undefined,
            tooltip: {
                ...baseOption.tooltip,
                trigger: 'item',
                formatter: (p: any) => {
                    const isOthers = p.name === othersLabel;
                    const logoUri: string | undefined = p.data.logoUri;
                    const logoHtml = logoUri
                        ? `<img src="${logoUri}" alt="${p.name}" width="16" height="16" style="border-radius:50%;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none'">`
                        : '';

                    let html = createTooltipHeader(`${logoHtml}${p.name}`);
                    if (isOthers && p.data.hiddenNames?.length > 0) {
                        html += `<div style="max-height:160px;overflow-y:auto;margin-bottom:4px;">`;
                        html += (p.data.hiddenNames as string[])
                            .map((n) => `<div style="padding:1px 0;font-size:11px;color:var(--cds-text-secondary)">• ${n}</div>`)
                            .join('');
                        html += `</div>`;
                    }
                    html += createTooltipRow(
                        tr('charts.aggregatedAssetDistributionChart.value'),
                        fmt.num.compact.currency(Number(p.value ?? 0)),
                    );
                    html += createTooltipRow(
                        tr('charts.aggregatedAssetDistributionChart.percentage'),
                        `${p.data.percentage.toFixed(2)}%`,
                    );
                    return html;
                },
            },
            // legend: {
            //     show: true,
            //     orient: 'horizontal',
            //     bottom: 0,
            //     left: 'center',
            //     data: groupedTokens.map(token => token.name),
            //     icon: 'circle',
            //     textStyle: { color: baseOption.textStyle.color, fontSize: 12 },
            //     tooltip: {
            //         show: true,
            //         formatter: (params: any) => {
            //             const name = params.name ?? params;
            //             const item = groupedTokens.find(g => g.name === name);
            //             const hidden: string[] = (item as any)?.hiddenNames ?? [];
            //             if (name !== othersLabel || hidden.length === 0) return name;
            //             return (
            //                 `<strong>${name}</strong><br/>` +
            //                 hidden.map(n => `• ${n}`).join('<br/>')
            //             );
            //         },
            //     } as any,
            // },
            legend: {
                show: false
            },
            series: [
                {
                    type: 'pie',
                    radius: ['28%', '58%'],
                    center: ['50%', '52%'],
                    data: groupedTokens.map((token, index) => ({
                        name: token.name,
                        value: token.value,
                        percentage: token.percentage,
                        hiddenNames: (token as any).hiddenNames,
                        logoUri: token.logoUri,
                        itemStyle: {
                            color: token.name === othersLabel
                                ? '#6f6f6f'
                                : token.color ?? CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
                            borderColor: '#ffffff',
                            borderWidth: 2,
                            borderRadius: 6,
                        },
                    })),
                    label: {
                        formatter: (p: any) => `${p.name}\n${p.data.percentage.toFixed(1)}%`,
                        color: baseOption.textStyle.color,
                        fontSize: 11,
                    },
                },
            ],
            graphic: [
                {
                    type: 'text',
                    left: 'center',
                    top: '46%',
                    style: {
                        text: tr('charts.aggregatedAssetDistributionChart.totalValue'),
                        fill: baseOption.textStyle.color,
                        fontSize: 14,
                        opacity: 0.7,
                    },
                },
                {
                    type: 'text',
                    left: 'center',
                    top: '50%',
                    style: {
                        text: fmt.num.compact.currency(displayTotal),
                        fill: baseOption.textStyle.color,
                        fontSize: 18,
                        fontWeight: 'bold',
                    },
                },
            ],
        };
    }, [baseOption, tokens, groupedTokens, othersLabel, tr, displayTotal, fmt]);

    const toggleWalletSelected = useCallback((walletAddress: string, checked: boolean) => {
        setSelectedWallets((prev) => {
            const next = new Set(prev);
            if (checked) {
                next.add(walletAddress);
            } else if (next.has(walletAddress) && next.size > 1) {
                next.delete(walletAddress);
            }
            return next;
        });
    }, []);

    const tableHeaders = useMemo<TableColumnHeader[]>(() => {
        if (mode === 'aggregate') {
            return [
                { header: tr('charts.aggregatedAssetDistributionChart.walletTable.isSelected'), minWidth: '7rem', align: 'center' },
                { header: tr('charts.aggregatedAssetDistributionChart.walletTable.wallet'), minWidth: '9rem' },
                { header: tr('charts.aggregatedAssetDistributionChart.walletTable.netWorth'), minWidth: '9rem', align: 'end' },
                { header: tr('charts.aggregatedAssetDistributionChart.walletTable.uniqueTokenCount'), minWidth: '8rem', align: 'end' },
            ];
        }

        return [
            { header: tr('charts.aggregatedAssetDistributionChart.walletTable.wallet'), minWidth: '9rem' },
            { header: tr('charts.aggregatedAssetDistributionChart.walletTable.netWorth'), minWidth: '9rem', align: 'end' },
            { header: tr('charts.aggregatedAssetDistributionChart.walletTable.uniqueTokenCount'), minWidth: '8rem', align: 'end' },
        ];
    }, [mode, tr]);

    const tableRows = useMemo<any[][]>(() => {
        return walletRows.map((wallet) => {
            const walletIdentity: WalletIdentityCellValue = {
                label: wallet.walletName || wallet.walletAddress,
                walletAddress: wallet.walletAddress,
                toString: () => wallet.walletName || wallet.walletAddress,
            };

            if (mode === 'aggregate') {
                return [
                    selectedWallets.has(wallet.walletAddress),
                    walletIdentity,
                    wallet.netWorth,
                    wallet.uniqueTokenCount,
                ];
            }

            return [
                walletIdentity,
                wallet.netWorth,
                wallet.uniqueTokenCount,
            ];
        });
    }, [walletRows, mode, selectedWallets]);

    const tableCellRenderers = useMemo(() => {
        const baseRenderers = [
            (value: unknown) => {
                const identity = value as WalletIdentityCellValue | undefined;
                const walletAddress = identity?.walletAddress ?? '';
                const label = identity?.label || walletAddress;
                const displayLabel = compactWalletLabel(label, walletAddress);

                return (
                    <a
                        href={`/wallets/${encodeURIComponent(walletAddress)}`}
                        className={`${styles.walletName} ${styles.walletAddress}`}
                        title={`${walletAddress}`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {displayLabel}
                    </a>
                );
            },
            (value: unknown) => renderBase(value, (text) => fmt.num.compact.currency(Number(text ?? 0))),
            (value: unknown) => <span className={styles.countValue}>{Number(value ?? 0).toLocaleString()}</span>,
        ] as Array<((value: any, row: any[], rowIndex: number) => React.ReactNode) | null>;

        if (mode === 'aggregate') {
            const selectionRenderer = (_value: unknown, row: any[]) => {
                const walletAddress = String((row[1] as WalletIdentityCellValue | undefined)?.walletAddress ?? '');
                const isChecked = selectedWallets.has(walletAddress);
                const inputId = `agg-wallet-select-${walletAddress.replace(/[^a-zA-Z0-9_-]/g, '')}`;

                return (
                    <Checkbox
                        id={inputId}
                        labelText=""
                        hideLabel
                        checked={isChecked}
                        aria-label={tr('charts.aggregatedAssetDistributionChart.ariaLabels.walletSelector')
                            .replace('{wallet}', walletAddress)}
                        onChange={(event: unknown, state: { checked: boolean }) => {
                            if ((event as React.SyntheticEvent)?.stopPropagation) {
                                (event as React.SyntheticEvent).stopPropagation();
                            }
                            toggleWalletSelected(walletAddress, state.checked);
                        }}
                    />
                );
            };

            return [selectionRenderer, ...baseRenderers];
        }

        return baseRenderers;
    }, [mode, selectedWallets, toggleWalletSelected, tr]);

    const selectedCountText = tr('charts.aggregatedAssetDistributionChart.walletTable.selectedCount')
        .replace('{count}', String(selectedWallets.size));

    const walletTableTitle = mode === 'aggregate'
        ? `${tr('charts.aggregatedAssetDistributionChart.walletTable.title')} (${selectedCountText})`
        : tr('charts.aggregatedAssetDistributionChart.walletTable.title');

    const topNOptions: Array<{ value: TopNOption; label: string }> = [
        { value: 5, label: tr('charts.aggregatedAssetDistributionChart.filters.top5') },
        { value: 10, label: tr('charts.aggregatedAssetDistributionChart.filters.top10') },
        { value: 0, label: tr('charts.aggregatedAssetDistributionChart.filters.all') },
    ];

    const minPctOptions: Array<{ value: MinPctOption; label: string }> = [
        { value: 0, label: tr('charts.aggregatedAssetDistributionChart.filters.allPercent') },
        { value: 1, label: tr('charts.aggregatedAssetDistributionChart.filters.minPct1') },
        { value: 5, label: tr('charts.aggregatedAssetDistributionChart.filters.minPct5') },
        { value: 10, label: tr('charts.aggregatedAssetDistributionChart.filters.minPct10') },
    ];

    const isEmpty = !data || walletRows.length === 0 || groupedTokens.length === 0 || (filters.wallets && filters.wallets.length === 0);

    const modeOptions = [
        { value: 'single' as const, label: tr('charts.aggregatedAssetDistributionChart.mode.single') },
        { value: 'aggregate' as const, label: tr('charts.aggregatedAssetDistributionChart.mode.aggregate') },
    ];

    const headerControls = (
        <Flex gap={8} align="center" wrap="wrap">
            <div style={{ width: 160 }}>
                <FilterSwitch
                    options={modeOptions}
                    value={mode}
                    onChange={(v) => setMode(v as Mode)}
                />
            </div>
            <div style={{ width: 180 }}>
                <FilterSwitch
                    options={topNOptions}
                    value={topN}
                    onChange={(v) => setTopN(v as TopNOption)}
                />
            </div>
            <div style={{ width: 200 }}>
                <FilterSwitch
                    options={minPctOptions}
                    value={minPct}
                    onChange={(v) => setMinPct(v as MinPctOption)}
                />
            </div>
        </Flex>
    );

    return (
        <ChartWrapper
            title={chartTitle}
            toolbarLayout="stacked"
            loadingState={loadingState}
            isEmpty={false}
            onRetry={() => refetch(false)}
            onExport={handleExport}
            className={className}
            actions={headerControls}
        >
            <div className={styles.layout}>
                <div className={styles.panel}>
                    <Table
                        title={walletTableTitle}
                        headers={tableHeaders}
                        initialFilters={{}}
                        fetcher={Promise.resolve([])}
                        dataEntries={tableRows}
                        filterSchema={mode === 'aggregate'
                            ? {
                                2: {
                                    type: FilterType.Range,
                                    min: 0,
                                    max: Math.max(1000, ...walletRows.map((wallet) => wallet.netWorth || 0)),
                                    step: Math.max(1, Math.floor(Math.max(1000, ...walletRows.map((wallet) => wallet.netWorth || 0)) / 100)),
                                },
                                3: {
                                    type: FilterType.Range,
                                    min: 0,
                                    max: Math.max(100, ...walletRows.map((wallet) => wallet.uniqueTokenCount || 0)),
                                    step: 1,
                                },
                            }
                            : {
                                1: {
                                    type: FilterType.Range,
                                    min: 0,
                                    max: Math.max(1000, ...walletRows.map((wallet) => wallet.netWorth || 0)),
                                    step: Math.max(1, Math.floor(Math.max(1000, ...walletRows.map((wallet) => wallet.netWorth || 0)) / 100)),
                                },
                                2: {
                                    type: FilterType.Range,
                                    min: 0,
                                    max: Math.max(100, ...walletRows.map((wallet) => wallet.uniqueTokenCount || 0)),
                                    step: 1,
                                },
                            }}
                        isSortable={mode === 'aggregate'
                            ? [false, false, true, true]
                            : [false, true, true]}
                        sortConfigs={mode === 'aggregate'
                            ? {
                                2: { type: SortType.Number },
                                3: { type: SortType.Number },
                            }
                            : {
                                1: { type: SortType.Number },
                                2: { type: SortType.Number },
                            }}
                        cellRenderers={tableCellRenderers}
                        enableExport={false}
                        loading={loadingState.status === 'loading'}
                        onRowClick={mode === 'single'
                            ? (row) => setActiveWalletAddress(String((row[0] as WalletIdentityCellValue | undefined)?.walletAddress ?? ''))
                            : undefined}
                        // rowClassName={mode === 'single'
                        //     ? (row) => (String((row[0] as WalletIdentityCellValue | undefined)?.walletAddress ?? '') === activeWalletAddress ? tableStyles.activeRow : undefined)
                        //     : undefined}
                        maxHeight={Math.max(minHeight, 300)}
                    />
                </div>

                <div className={styles.panel}>
                    {
                        isEmpty && (
                            <div className={styles.emptyState}>
                                <p className={styles.emptyStateTitle}>
                                    {tr('charts.noDataTitle')}
                                </p>
                                <p className={styles.emptyStateMessage}>
                                    {tr('charts.noDataMessage')}
                                </p>
                            </div>
                        ) || (
                            <ReactECharts
                                ref={chartRef}
                                option={option}
                                className={styles.chartHost}
                                style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                                notMerge
                                lazyUpdate
                            />
                        )
                    }

                </div>
            </div>
        </ChartWrapper>
    );
};
