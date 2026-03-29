import { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Add, Close, Repeat } from '@carbon/react/icons';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption, getChartGridConfig } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchBalanceTrend, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import { getConditionalLegend } from '@/util/chart-legend-config';
import type { BalanceRequestParams } from '@/types/chart-api.types';
import type { ChartLoadingState } from '@/types/chart.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { ChartGridItem } from '@/components/charts/shared';
import type { ChartProps } from '@/components/charts/shared/ChartProp';
import sharedStyles from '@/components/charts/shared/ChartStyle.module.scss';

type BalanceTrendData = InferFetcherData<typeof fetchBalanceTrend>;

type BalanceSeriesPoint = { timestamp: number; value: number };

type BalanceSeries = {
    name: string;
    data: BalanceSeriesPoint[];
    seriesType?: 'line' | 'bar';
    unit?: 'TOKEN' | 'USD';
};

type TokenMeta = {
    symbol: string;
    logoUri?: string;
    tokenAddress?: string;
};

type WalletMeta = {
    label: string;
    identityName?: string;
};

type BalanceChartDisplayData = {
    series: BalanceSeries[];
    wallets?: string[];
    metadata: Record<string, unknown> & {
        dataPoints?: number;
        tokens?: string[];
        mode?: 'total' | 'token' | 'composite';
        tokenMeta?: Record<string, TokenMeta>;
        walletMeta?: Record<string, WalletMeta>;
    };
};

type DisplaySeries = {
    key: string;
    label: string;
    points: BalanceSeriesPoint[];
    logoUri?: string;
};

type ChangeMetric = {
    pct: number;
    deltaLabel: string;
    isApprox: boolean;
};

const ALL_TAG = 'ALL';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WALLET_TAG_PREFIX = 'WALLET::';
const MAX_TOKENS_PER_REQUEST = 10;

function getWindowDaysFromTimePeriod(timePeriod?: string): 7 | 30 {
    return timePeriod?.toUpperCase() === '7D' ? 7 : 30;
}

const balanceQueryResponseCache = new Map<string, BalanceTrendData>();
const balanceQueryInFlightCache = new Map<string, Promise<BalanceTrendData>>();

function isBalanceChartDisplayData(value: unknown): value is BalanceChartDisplayData {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const raw = value as { series?: unknown };
    return Array.isArray(raw.series);
}

function getBalanceQueryCacheKey(query: BalanceRequestParams): string {
    return JSON.stringify({
        timePeriod: query.timePeriod,
        tokens: query.tokens,
        wallets: query.wallets,
        timezone: query.timezone,
        aggregation: query.aggregation,
    });
}

async function fetchBalanceTrendWithCache(query: BalanceRequestParams): Promise<BalanceTrendData> {
    const cacheKey = getBalanceQueryCacheKey(query);

    const cachedResult = balanceQueryResponseCache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    const inFlightResult = balanceQueryInFlightCache.get(cacheKey);
    if (inFlightResult) {
        return inFlightResult;
    }

    const promise = fetchBalanceTrend(query as Parameters<typeof fetchBalanceTrend>[0])
        .then((result) => {
            balanceQueryResponseCache.set(cacheKey, result);
            balanceQueryInFlightCache.delete(cacheKey);
            return result;
        })
        .catch((error) => {
            balanceQueryInFlightCache.delete(cacheKey);
            throw error;
        });

    balanceQueryInFlightCache.set(cacheKey, promise);
    return promise;
}

function normalizeSeriesData(
    points: Array<{ timestamp: number; value: number }>,
): Array<{ timestamp: number; value: number }> {
    const normalized = points
        .map((point) => ({
            timestamp: Number(point.timestamp),
            value: Number(point.value),
        }))
        .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
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

function emptyTokenResponse(query: BalanceRequestParams): BalanceChartDisplayData {
    return {
        series: [],
        metadata: {
            currency: 'USD',
            timezone: query.timezone ?? 'UTC',
            aggregation: 'daily',
            mode: 'token',
            tokens: [],
            tokenMeta: {},
            walletMeta: {},
        },
    };
}

function toAddressLabel(address: string): string {
    if (address.length <= 10) {
        return address;
    }
    return `${address.slice(0, 8)}...`;
}

function parseTokenSymbolFromSeriesName(seriesName: string): string | null {
    const tokenMatch = seriesName.match(/\s([A-Za-z0-9._-]+)\s+\((?:USD|units)\)$/i);
    if (tokenMatch?.[1]) {
        return tokenMatch[1].toUpperCase();
    }

    const singleMatch = seriesName.match(/^([A-Za-z0-9._-]+)\s+\((?:USD|units)\)$/i);
    if (singleMatch?.[1]) {
        return singleMatch[1].toUpperCase();
    }

    return null;
}

function formatDurationLabel(deltaMs: number): string {
    const days = Math.max(1, Math.round(deltaMs / ONE_DAY_MS));
    return `${days}d`;
}

function compute24hChange(points: BalanceSeriesPoint[]): ChangeMetric | null {
    if (points.length < 2) {
        return null;
    }

    const latest = points[points.length - 1];
    const targetTimestamp = latest.timestamp - ONE_DAY_MS;

    const baselineCandidates = points.filter((point) => point.timestamp <= targetTimestamp);
    let baseline: BalanceSeriesPoint | undefined;

    if (baselineCandidates.length > 0) {
        baseline = baselineCandidates[baselineCandidates.length - 1];
    } else {
        baseline = points[points.length - 2];
    }

    if (!baseline || baseline.value === 0) {
        return null;
    }

    const pct = ((latest.value - baseline.value) / baseline.value) * 100;
    const deltaMs = Math.max(1, latest.timestamp - baseline.timestamp);
    const isApprox = Math.abs(deltaMs - ONE_DAY_MS) > 60 * 60 * 1000;

    return {
        pct,
        deltaLabel: formatDurationLabel(deltaMs),
        isApprox,
    };
}

function isWalletTag(tag: string): boolean {
    return tag.startsWith(WALLET_TAG_PREFIX);
}

function toWalletTag(walletAddress: string): string {
    return `${WALLET_TAG_PREFIX}${walletAddress}`;
}

function fromWalletTag(walletTag: string): string {
    return walletTag.slice(WALLET_TAG_PREFIX.length);
}

function normalizeTokenInput(rawValue: string): string {
    const trimmed = rawValue.trim();
    if (!trimmed) {
        return '';
    }

    if (trimmed.startsWith(WALLET_TAG_PREFIX)) {
        return trimmed;
    }

    const normalized = trimmed.toUpperCase();
    if (normalized === ALL_TAG || normalized === 'ALL') {
        return ALL_TAG;
    }
    return normalized;
}

function chunkArray<T>(items: T[], size: number): T[][] {
    if (size <= 0 || items.length === 0) {
        return [];
    }

    const output: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        output.push(items.slice(index, index + size));
    }

    return output;
}

function mergeLoadingState(
    generalState: ChartLoadingState,
    tokenState: ChartLoadingState,
    hasTokenSelection: boolean,
): ChartLoadingState {
    if (generalState.status === 'error') {
        return generalState;
    }

    if (hasTokenSelection && tokenState.status === 'error') {
        return tokenState;
    }

    if (generalState.status === 'loading' || (hasTokenSelection && tokenState.status === 'loading')) {
        return {
            status: 'loading',
            retryCount: Math.max(generalState.retryCount, tokenState.retryCount),
        };
    }

    if (generalState.status === 'refreshing' || (hasTokenSelection && tokenState.status === 'refreshing')) {
        return {
            status: 'refreshing',
            retryCount: Math.max(generalState.retryCount, tokenState.retryCount),
        };
    }

    return {
        status: 'success',
        retryCount: Math.max(generalState.retryCount, tokenState.retryCount),
    };
}

export function BalanceChart({
    title,
    minHeight = 400,
    initialFilters = {
        timePeriod: '30D',
        tokens: [],
        wallets: [],
    },
    autoRefresh = true,
    refreshInterval = 30000,
    tokenSelectorOptions = [],
    maxTokenTags = 3,
    loadOnInteractionOnly = false,
}: ChartProps) {
    const { tr } = useLocalization();
    const chartTitle = title || tr('charts.balanceChart.title');

    const chartRef = useRef<ReactECharts>(null);
    const chartTheme = useChartTheme();
    const { selectedTimezone: timezone } = useChartContext();

    const [selectorValue, setSelectorValue] = useState(ALL_TAG);
    const [selectedTags, setSelectedTags] = useState<string[]>([ALL_TAG]);
    const [tokenSelectionOrder, setTokenSelectionOrder] = useState<string[]>([]);
    const [prefetchedTokenSeriesBySymbol, setPrefetchedTokenSeriesBySymbol] = useState<Record<string, BalanceSeries>>({});
    const [chartWindowDays, setChartWindowDays] = useState<7 | 30>(() => getWindowDaysFromTimePeriod(initialFilters.timePeriod));
    const [interactionLoadCount, setInteractionLoadCount] = useState(0);

    const effectiveAutoRefresh = loadOnInteractionOnly ? false : autoRefresh;

    const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
        initialFilters,
        debounceDelay: 300,
        syncTokensFromInitialFilters: false,
    });

    const isMultiWallet = (filters.wallets?.length ?? 0) > 1;

    useEffect(() => {
        if (!isMultiWallet) {
            return;
        }

        setSelectedTags((prev) => {
            if (prev.length <= 1) {
                return prev;
            }
            return [prev[0]];
        });
        setTokenSelectionOrder([]);
    }, [isMultiWallet]);

    useEffect(() => {
        if (loadOnInteractionOnly) return;
        setChartWindowDays(getWindowDaysFromTimePeriod(filters.timePeriod));
    }, [filters.timePeriod, loadOnInteractionOnly]);

    useEffect(() => {
        if (!loadOnInteractionOnly) {
            return;
        }
        setInteractionLoadCount(0);
    }, [walletsString, loadOnInteractionOnly]);

    const effectivePeriod = loadOnInteractionOnly
        ? (chartWindowDays === 7 ? '7D' : '30D')
        : filters.timePeriod;

    const generalQuery = useMemo<BalanceRequestParams>(
        () => ({
            timePeriod: effectivePeriod,
            wallets: walletsString,
            timezone,
        }),
        [effectivePeriod, walletsString, timezone],
    );

    const activeTokenTags = useMemo(() => {
        return selectedTags.filter((tag) => tag !== ALL_TAG && !isWalletTag(tag));
    }, [selectedTags]);

    const tokenQuery = useMemo<BalanceRequestParams>(
        () => ({
            timePeriod: effectivePeriod,
            wallets: walletsString,
            timezone,
            tokens: activeTokenTags.length > 0 ? activeTokenTags.join(',') : undefined,
        }),
        [effectivePeriod, walletsString, timezone, activeTokenTags],
    );

    const {
        data: generalRawData,
        loadingState: generalLoadingState,
        refetch: refetchGeneral,
    } = useStandardChartController<BalanceTrendData, BalanceRequestParams>({
        fetcher: fetchBalanceTrendWithCache,
        query: generalQuery,
        fetchMode: loadOnInteractionOnly ? "manual" : "auto",
        autoRefresh: effectiveAutoRefresh,
        refreshInterval,
    });

    const {
        data: tokenRawData,
        loadingState: tokenLoadingState,
        refetch: refetchToken,
    } = useStandardChartController<BalanceTrendData, BalanceRequestParams>({
        fetcher: async (query) => {
            if (!query.tokens) {
                return emptyTokenResponse(query) as BalanceTrendData;
            }
            return fetchBalanceTrendWithCache(query);
        },
        query: tokenQuery,
        fetchMode: loadOnInteractionOnly ? "manual" : "auto",
        autoRefresh: effectiveAutoRefresh,
        refreshInterval,
    });

    const refetchGeneralRef = useRef(refetchGeneral);
    refetchGeneralRef.current = refetchGeneral;
    const refetchTokenRef = useRef(refetchToken);
    refetchTokenRef.current = refetchToken;

    useEffect(() => {
        if (!loadOnInteractionOnly || interactionLoadCount === 0) {
            return;
        }
        void refetchGeneralRef.current(true);
        void refetchTokenRef.current(true);
    }, [interactionLoadCount, loadOnInteractionOnly]);

    const generalData = useMemo<BalanceChartDisplayData | null>(() => {
        if (generalRawData && !('error' in generalRawData) && isBalanceChartDisplayData(generalRawData)) {
            return {
                ...generalRawData,
                series: generalRawData.series.map((series) => ({
                    ...series,
                    data: normalizeSeriesData(series.data),
                })),
            };
        }

        return null;
    }, [generalRawData]);

    const tokenData = useMemo<BalanceChartDisplayData | null>(() => {
        if (tokenRawData && !('error' in tokenRawData) && isBalanceChartDisplayData(tokenRawData)) {
            return {
                ...tokenRawData,
                series: tokenRawData.series.map((series) => ({
                    ...series,
                    data: normalizeSeriesData(series.data),
                })),
            };
        }

        return null;
    }, [tokenRawData]);

    const tokenMeta = useMemo(() => {
        const result: Record<string, TokenMeta> = {
            [ALL_TAG]: { symbol: tr('charts.balanceChart.all') },
        };

        const mergeMeta = (source?: Record<string, TokenMeta>) => {
            if (!source) {
                return;
            }

            for (const [key, value] of Object.entries(source)) {
                const normalizedKey = key.trim().toUpperCase();
                if (!normalizedKey) {
                    continue;
                }
                result[normalizedKey] = {
                    symbol: value.symbol || normalizedKey,
                    logoUri: value.logoUri,
                    tokenAddress: value.tokenAddress,
                };
            }
        };

        mergeMeta(generalData?.metadata?.tokenMeta);
        mergeMeta(tokenData?.metadata?.tokenMeta);

        return result;
    }, [generalData, tokenData, tr]);

    const walletMeta = useMemo(() => {
        const merged: Record<string, WalletMeta> = {};
        const generalWalletMeta = generalData?.metadata?.walletMeta ?? {};
        const tokenWalletMeta = tokenData?.metadata?.walletMeta ?? {};

        for (const [wallet, value] of Object.entries(generalWalletMeta)) {
            merged[wallet] = value;
        }

        for (const [wallet, value] of Object.entries(tokenWalletMeta)) {
            merged[wallet] = value;
        }

        return merged;
    }, [generalData, tokenData]);

    const candidateTokenSymbols = useMemo(() => {
        const values = new Set<string>();

        for (const option of tokenSelectorOptions ?? []) {
            const normalized = normalizeTokenInput(option);
            if (!normalized || normalized === ALL_TAG || isWalletTag(normalized)) {
                continue;
            }
            values.add(normalized);
        }

        for (const token of generalData?.metadata?.tokens ?? []) {
            const normalized = normalizeTokenInput(token);
            if (!normalized || normalized === ALL_TAG || isWalletTag(normalized)) {
                continue;
            }
            values.add(normalized);
        }

        for (const token of tokenData?.metadata?.tokens ?? []) {
            const normalized = normalizeTokenInput(token);
            if (!normalized || normalized === ALL_TAG || isWalletTag(normalized)) {
                continue;
            }
            values.add(normalized);
        }

        return Array.from(values.values());
    }, [tokenSelectorOptions, generalData, tokenData]);

    useEffect(() => {
        let isCancelled = false;

        const clearPrefetched = () => {
            setPrefetchedTokenSeriesBySymbol((prev) =>
                Object.keys(prev).length === 0 ? prev : {},
            );
        };

        const prefetchTokenSeries = async () => {
            if (loadOnInteractionOnly && interactionLoadCount === 0) {
                clearPrefetched();
                return;
            }

            if (!walletsString || candidateTokenSymbols.length === 0) {
                clearPrefetched();
                return;
            }

            const chunks = chunkArray(candidateTokenSymbols, MAX_TOKENS_PER_REQUEST);
            const nextMap: Record<string, BalanceSeries> = {};

            for (const tokenChunk of chunks) {
                const response = await fetchBalanceTrendWithCache({
                    timePeriod: effectivePeriod,
                    wallets: walletsString,
                    timezone,
                    tokens: tokenChunk.join(','),
                });

                if (!isBalanceChartDisplayData(response)) {
                    continue;
                }

                const usdSeries = response.series.filter((series) => series.unit === 'USD');
                for (const series of usdSeries) {
                    const symbol = parseTokenSymbolFromSeriesName(series.name);
                    if (!symbol || nextMap[symbol]) {
                        continue;
                    }
                    nextMap[symbol] = {
                        ...series,
                        data: normalizeSeriesData(series.data),
                    };
                }
            }

            if (!isCancelled) {
                setPrefetchedTokenSeriesBySymbol(nextMap);
            }
        };

        void prefetchTokenSeries();

        return () => {
            isCancelled = true;
        };
    }, [candidateTokenSymbols, effectivePeriod, walletsString, timezone, loadOnInteractionOnly, interactionLoadCount]);

    const tokenOptions = useMemo(() => {
        const optionsMap = new Map<string, string>();
        optionsMap.set(ALL_TAG, tr('charts.balanceChart.all'));

        if (isMultiWallet && Array.isArray(generalData?.wallets)) {
            generalData.wallets.forEach((walletAddress, index) => {
                const fallbackLabel = generalData.series[index]?.name || toAddressLabel(walletAddress);
                const walletLabel =
                    walletMeta[walletAddress]?.identityName ||
                    walletMeta[walletAddress]?.label ||
                    fallbackLabel;
                optionsMap.set(toWalletTag(walletAddress), walletLabel);
            });
        }

        const metadataTokens = [
            ...candidateTokenSymbols,
            ...Object.keys(tokenMeta).filter((token) => token !== ALL_TAG),
            ...Object.keys(prefetchedTokenSeriesBySymbol),
        ];

        for (const token of metadataTokens) {
            const normalized = normalizeTokenInput(token);
            if (!normalized || normalized === ALL_TAG || isWalletTag(normalized)) {
                continue;
            }
            optionsMap.set(normalized, tokenMeta[normalized]?.symbol ?? normalized);
        }

        return Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label }));
    }, [
        candidateTokenSymbols,
        generalData,
        isMultiWallet,
        prefetchedTokenSeriesBySymbol,
        tokenMeta,
        walletMeta,
        tr,
    ]);

    const optionLabelByValue = useMemo(() => {
        const map = new Map<string, string>();
        for (const option of tokenOptions) {
            map.set(option.value, option.label);
        }
        return map;
    }, [tokenOptions]);

    useEffect(() => {
        if (tokenOptions.length === 0) {
            return;
        }

        setSelectorValue((prev) => {
            const normalized = normalizeTokenInput(prev);
            if (tokenOptions.some((option) => option.value === normalized)) {
                return normalized;
            }
            return ALL_TAG;
        });
    }, [tokenOptions]);

    const addTag = (rawTagValue: string) => {
        const normalized = normalizeTokenInput(rawTagValue);
        if (!normalized || !optionLabelByValue.has(normalized)) {
            return;
        }

        setSelectedTags((prev) => {
            if (isMultiWallet) {
                return [normalized];
            }

            if (prev.includes(normalized)) {
                return prev;
            }

            if (prev.length < maxTokenTags) {
                return [...prev, normalized];
            }

            const oldestToken = tokenSelectionOrder[0];
            if (oldestToken && prev.includes(oldestToken)) {
                return [...prev.filter((tag) => tag !== oldestToken), normalized];
            }

            return [...prev.slice(1), normalized];
        });

        if (normalized !== ALL_TAG && !isWalletTag(normalized)) {
            setTokenSelectionOrder((prev) => {
                const deduped = prev.filter((entry) => entry !== normalized);
                const next = [...deduped, normalized];
                return next.length > Math.max(1, maxTokenTags - 1)
                    ? next.slice(next.length - (maxTokenTags - 1))
                    : next;
            });
        }
    };

    const removeTag = (tag: string) => {
        setSelectedTags((prev) => {
            if (prev.length <= 1) {
                return prev;
            }

            const next = prev.filter((entry) => entry !== tag);
            return next.length === 0 ? [ALL_TAG] : next;
        });

        if (tag !== ALL_TAG && !isWalletTag(tag)) {
            setTokenSelectionOrder((prev) => prev.filter((entry) => entry !== tag));
        }
    };

    const displaySeries = useMemo<DisplaySeries[]>(() => {
        if (!generalData) {
            return [];
        }

        const generalUsdSeries = generalData.series.filter((series) => series.unit !== 'TOKEN');
        const tokenUsdSeries = (tokenData?.series ?? []).filter((series) => series.unit === 'USD');

        if (isMultiWallet) {
            const activeTag = selectedTags[0] ?? ALL_TAG;

            if (isWalletTag(activeTag)) {
                const walletAddress = fromWalletTag(activeTag);
                const walletIndex = generalData.wallets?.findIndex((wallet) => wallet === walletAddress) ?? -1;
                if (walletIndex < 0) {
                    return [];
                }

                const selectedSeries = generalUsdSeries[walletIndex];
                if (!selectedSeries) {
                    return [];
                }

                const label =
                    walletMeta[walletAddress]?.identityName ||
                    walletMeta[walletAddress]?.label ||
                    selectedSeries.name;

                return [{
                    key: walletAddress,
                    label,
                    points: normalizeSeriesData(selectedSeries.data),
                }];
            }

            if (activeTag === ALL_TAG) {
                return generalUsdSeries.map((series, index) => {
                    const walletAddress = generalData.wallets?.[index];
                    const label = walletAddress
                        ? walletMeta[walletAddress]?.identityName || walletMeta[walletAddress]?.label || toAddressLabel(walletAddress)
                        : series.name;

                    return {
                        key: walletAddress || series.name,
                        label,
                        points: normalizeSeriesData(series.data),
                    };
                });
            }

            const filteredTokenSeries = tokenUsdSeries.filter((series) => {
                const tokenSymbol = parseTokenSymbolFromSeriesName(series.name);
                return tokenSymbol === activeTag;
            });

            return filteredTokenSeries.map((series, index) => {
                const walletAddress = tokenData?.wallets?.[index] ?? generalData.wallets?.[index];
                const label = walletAddress
                    ? walletMeta[walletAddress]?.identityName || walletMeta[walletAddress]?.label || toAddressLabel(walletAddress)
                    : series.name;

                return {
                    key: walletAddress || `${activeTag}:${index}`,
                    label,
                    points: normalizeSeriesData(series.data),
                    logoUri: tokenMeta[activeTag]?.logoUri,
                };
            });
        }

        const allSeries = generalUsdSeries[0];
        const tokenSeriesBySymbol = new Map<string, BalanceSeries>();

        for (const series of tokenUsdSeries) {
            const symbol = parseTokenSymbolFromSeriesName(series.name);
            if (!symbol) {
                continue;
            }
            tokenSeriesBySymbol.set(symbol, series);
        }

        for (const [symbol, series] of Object.entries(prefetchedTokenSeriesBySymbol)) {
            if (!tokenSeriesBySymbol.has(symbol)) {
                tokenSeriesBySymbol.set(symbol, series);
            }
        }

        const output: DisplaySeries[] = [];

        for (const tag of selectedTags) {
            if (tag === ALL_TAG) {
                if (!allSeries) {
                    continue;
                }
                output.push({
                    key: ALL_TAG,
                    label: tokenMeta[ALL_TAG]?.symbol || 'All',
                    points: normalizeSeriesData(allSeries.data),
                });
                continue;
            }

            if (isWalletTag(tag)) {
                continue;
            }

            const tokenSeries = tokenSeriesBySymbol.get(tag);
            if (!tokenSeries) {
                continue;
            }

            output.push({
                key: tag,
                label: tokenMeta[tag]?.symbol || tag,
                points: normalizeSeriesData(tokenSeries.data),
                logoUri: tokenMeta[tag]?.logoUri,
            });
        }

        return output;
    }, [
        generalData,
        isMultiWallet,
        prefetchedTokenSeriesBySymbol,
        selectedTags,
        tokenData,
        tokenMeta,
        walletMeta,
    ]);

    const windowedDisplaySeries = useMemo<DisplaySeries[]>(() => {
        if (displaySeries.length === 0) {
            return [];
        }

        const latestTimestamp = displaySeries.reduce((maxTimestamp, series) => {
            const lastPoint = series.points[series.points.length - 1];
            return lastPoint ? Math.max(maxTimestamp, lastPoint.timestamp) : maxTimestamp;
        }, Number.NEGATIVE_INFINITY);

        if (!Number.isFinite(latestTimestamp)) {
            return displaySeries;
        }

        const cutoffTimestamp = latestTimestamp - chartWindowDays * ONE_DAY_MS;

        return displaySeries.map((series) => {
            const filteredPoints = series.points.filter((point) => point.timestamp >= cutoffTimestamp);
            if (filteredPoints.length > 0) {
                return {
                    ...series,
                    points: filteredPoints,
                };
            }

            return {
                ...series,
                points: series.points.length > 0 ? [series.points[series.points.length - 1]] : [],
            };
        });
    }, [displaySeries, chartWindowDays]);

    const chartOption = useMemo((): EChartsOption | null => {
        if (windowedDisplaySeries.length === 0) {
            return null;
        }

        const baseOption = getThemedChartBaseOption(chartTheme);
        const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96'];

        const seriesConfig = windowedDisplaySeries.map((series, index) => {
            const color = colors[index % colors.length];
            const isSinglePoint = series.points.length <= 1;

            return {
                name: series.label,
                type: 'line' as const,
                smooth: true,
                data: series.points.map((point) => [point.timestamp, point.value]),
                showSymbol: isSinglePoint,
                symbolSize: isSinglePoint ? 8 : 4,
                areaStyle: {
                    color: {
                        type: 'linear' as const,
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
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
            grid: getChartGridConfig(),
            legend: getConditionalLegend(chartTheme, windowedDisplaySeries.map((series) => series.label), 2, false),
            xAxis: {
                ...baseOption.xAxis,
                type: 'time',
                boundaryGap: false as never,
                axisLabel: {
                    ...baseOption.xAxis?.axisLabel,
                    formatter: (value: number) => formatTimestampWithTimezone(value, timezone, 'MMM dd'),
                },
            },
            yAxis: {
                ...baseOption.yAxis,
                type: 'value',
                axisLabel: {
                    ...baseOption.yAxis?.axisLabel,
                    formatter: (value: number) => formatCurrency(value),
                },
            },
            series: seriesConfig,
            tooltip: {
                ...baseOption.tooltip,
                trigger: 'axis',
                formatter: (params: any) =>
                    formatAxisTooltip(
                        params,
                        (point) => formatTimestampWithTimezone(point.value[0], timezone, 'PPpp'),
                        (point) => formatCurrency(point.value[1]),
                    ),
            },
        };
    }, [windowedDisplaySeries, timezone, chartTheme]);

    const summaryRows = useMemo(() => {
        if (isMultiWallet) {
            return displaySeries.map((series) => ({
                key: series.key,
                label: series.label,
                logoUri: series.logoUri,
                change: compute24hChange(series.points),
            }));
        }

        return selectedTags.map((tag) => {
            const matchedSeries = displaySeries.find((series) => series.key === tag);
            return {
                key: tag,
                label: tag === ALL_TAG ? tokenMeta[ALL_TAG]?.symbol || 'All' : tokenMeta[tag]?.symbol || tag,
                logoUri: tag === ALL_TAG ? undefined : tokenMeta[tag]?.logoUri,
                change: matchedSeries ? compute24hChange(matchedSeries.points) : null,
            };
        });
    }, [isMultiWallet, selectedTags, displaySeries, tokenMeta]);

    const loadingState = mergeLoadingState(generalLoadingState, tokenLoadingState, activeTokenTags.length > 0);

    const handleRetry = () => {
        if (loadOnInteractionOnly && interactionLoadCount === 0) {
            return;
        }
        refetchGeneral(false);
        refetchToken(false);
    };

    const handleWindowRangeClick = (days: 7 | 30) => {
        const period = days === 7 ? "7D" : "30D";
        setChartWindowDays(days);
        setTimePeriod(period);
        setInteractionLoadCount((c) => c + 1);
    };

    const dataListId = 'balance-chart-token-list';

    return (
        <BaseChart
            title={chartTitle}
            loadingState={loadingState}
            isEmpty={
                (loadOnInteractionOnly && interactionLoadCount === 0) ||
                windowedDisplaySeries.length === 0 ||
                !windowedDisplaySeries.some((series) => series.points.length > 0)
            }
            onRetry={handleRetry}
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
            <div className={`${sharedStyles.chartControls} ${sharedStyles.balanceChartControlArea}`}>
                <div className={sharedStyles.balanceChartControlTopRow}>
                    <div className={sharedStyles.balanceChartControlInputGroup}>
                        <label htmlFor={dataListId}>{isMultiWallet ? tr('charts.balanceChart.selectModeTokenLabel') : tr('charts.balanceChart.selectTokenLabel')}</label>
                        <select
                            id={dataListId}
                            value={selectorValue}
                            onChange={(event) => setSelectorValue(event.target.value)}
                            className={sharedStyles.balanceChartCombobox}
                        >
                            {tokenOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            className={sharedStyles.chartToggleButton}
                            onClick={() => addTag(selectorValue)}
                        >
                            {isMultiWallet ? tr('charts.balanceChart.switch') : tr('charts.balanceChart.add')}
                        </button>
                    </div>

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

                <div className={sharedStyles.balanceChartTagRow}>
                    {summaryRows.map((row) => {
                        const isRemovableTag = !isMultiWallet && selectedTags.includes(row.key);
                        const canDismiss = isRemovableTag && selectedTags.length > 1;
                        const changeText = row.change ? `${row.change.pct >= 0 ? '+' : ''}${row.change.pct.toFixed(2)}%` : tr('charts.balanceChart.notAvailable');
                        const deltaText = row.change ? row.change.deltaLabel : tr('charts.balanceChart.noDataDelta');
                        const changeClassName = row.change
                            ? row.change.pct >= 0
                                ? sharedStyles.balanceChartTagChangePositive
                                : sharedStyles.balanceChartTagChangeNegative
                            : sharedStyles.balanceChartTagChangeNeutral;

                        return (
                            <div key={row.key} className={sharedStyles.balanceChartTag}>
                                <div className={sharedStyles.balanceChartTagMain}>
                                    {row.logoUri ? (
                                        <img src={row.logoUri} alt={row.label} className={sharedStyles.balanceChartTagIcon} />
                                    ) : (
                                        <span className={sharedStyles.balanceChartTagIconFallback}>
                                            {row.label.charAt(0)}
                                        </span>
                                    )}
                                    <span className={sharedStyles.balanceChartTagLabel}>{row.label}</span>
                                </div>

                                <div className={sharedStyles.balanceChartTagMetrics}>
                                    <span className={changeClassName}>{changeText}</span>
                                    <span className={sharedStyles.balanceChartTagDelta}>{deltaText}</span>
                                </div>

                                {isRemovableTag && (
                                    <button
                                        type="button"
                                        disabled={!canDismiss}
                                        onClick={() => removeTag(row.key)}
                                        className={sharedStyles.balanceChartTagDismiss}
                                        title={canDismiss ? tr('charts.balanceChart.removeTag') : tr('charts.balanceChart.atLeastOneTagRequired')}
                                    >
                                        <Close size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

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
