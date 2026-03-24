import { mapWithConcurrency } from "@sv/util/concurrency.js";
import type { TokenBalanceSeriesResult, BalanceDataPoint } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { toFiniteNumber } from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { SOL_MINT, TOKEN_BALANCE_SNAPSHOT_CONCURRENCY, DAY_MS, DAY_SEC, TOKEN_BALANCE_SNAPSHOT_CACHE_HISTORICAL_TTL_MS, TOKEN_BALANCE_SNAPSHOT_CACHE_RECENT_TTL_MS } from "@sv/services/wallet/wallet.constants.js";
import { normalizeMint, isSolSymbol, toIsoFromSec } from "@sv/services/wallet/walletData.core.js";
import { getCachedWalletTokenBalanceHistory, saveWalletTokenBalanceHistoryCache } from "@sv/services/wallet/db/walletTokenBalanceHistoryCache.js";
import { fetchBirdeyePortfolioSnapshot } from "./fetchers/walletDataFetcher.service.js";
import { getWalletPortfolio } from "./walletPortfolio.service.js";
import { resolveWalletTimeRangeSec } from "./walletCharts.service.js";

type CachedPortfolioSnapshot = {
    expiresAtMs: number;
    snapshot: Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>>;
};

const tokenBalanceSnapshotCache = new Map<string, CachedPortfolioSnapshot>();
const TOKEN_LIVE_POINT_IN_MEMORY_TTL_MS = 60 * 1000;

type CachedTokenLivePoint = {
    expiresAtMs: number;
    dayStartMs: number;
    tokenPoint: BalanceDataPoint;
    usdPoint: BalanceDataPoint;
};

const tokenBalanceLivePointCache = new Map<string, CachedTokenLivePoint>();

export async function getWalletTokenBalanceHistory(
    address: string,
    tokenSelector: string,
): Promise<TokenBalanceSeriesResult> {
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const rangeSec = resolveWalletTimeRangeSec("30D", nowSec);
    const todayDayStartMs = toUtcDayStartMs(nowMs);
    const historicalDayStartMs = buildHistoricalDayStartMsList(rangeSec.fromSec, todayDayStartMs);
    const historicalFromMs = historicalDayStartMs[0];
    const historicalToMs = historicalDayStartMs[historicalDayStartMs.length - 1];
    const selectorLower = tokenSelector.trim().toLowerCase();

    try {
        const portfolio = await getWalletPortfolio(address);
        const resolvedItem = portfolio.find(
            (item) =>
                item.tokenAddress.toLowerCase() === selectorLower ||
                item.symbol.toLowerCase() === selectorLower ||
                (selectorLower === "sol" && item.tokenAddress === SOL_MINT),
        );

        const resolvedMint = resolvedItem
            ? (isSolSymbol(resolvedItem.symbol) || selectorLower === "sol"
                ? SOL_MINT
                : normalizeMint(resolvedItem.tokenAddress))
            : selectorLower === "sol"
                ? SOL_MINT
                : normalizeMint(tokenSelector);

        if (!resolvedMint) {
            throw new Error(`Unable to resolve token selector: ${tokenSelector}`);
        }

        const resolvedSymbol = resolvedItem?.symbol || tokenSelector;
        const cachedHistory = await getCachedWalletTokenBalanceHistory(address, resolvedMint);
        const historicalCacheCovered =
            cachedHistory != null &&
            cachedHistory.coveredFromMs <= historicalFromMs &&
            cachedHistory.coveredToMs >= historicalToMs;

        const historicalTokenByTs = new Map<number, BalanceDataPoint>();
        const historicalUsdByTs = new Map<number, BalanceDataPoint>();

        if (historicalCacheCovered) {
            for (const point of cachedHistory.tokenSeries) {
                historicalTokenByTs.set(point.timestamp, point);
            }
            for (const point of cachedHistory.usdSeries) {
                historicalUsdByTs.set(point.timestamp, point);
            }
        }

        const missingDaySec = historicalDayStartMs
            .filter((dayStartMs) => {
                return !historicalTokenByTs.has(dayStartMs) || !historicalUsdByTs.has(dayStartMs);
            })
            .map((dayStartMs) => Math.floor(dayStartMs / 1000));

        if (missingDaySec.length > 0) {
            const dailySnapshots = await mapWithConcurrency(
                missingDaySec,
                TOKEN_BALANCE_SNAPSHOT_CONCURRENCY,
                async (daySec) => {
                    try {
                        const snapshot = await getBirdeyePortfolioSnapshotCached(address, daySec, nowSec);
                        return { daySec, snapshot };
                    } catch {
                        return { daySec, snapshot: null };
                    }
                },
            );

            for (const entry of dailySnapshots) {
                const timestamp = entry.daySec * 1000;
                const [tokenPoint, usdPoint] = toSeriesPoints(entry.snapshot, resolvedMint, timestamp);
                historicalTokenByTs.set(timestamp, tokenPoint);
                historicalUsdByTs.set(timestamp, usdPoint);
            }
        }

        const historicalTokenSeries = historicalDayStartMs.map((timestamp) => {
            return historicalTokenByTs.get(timestamp) ?? toZeroPoint(timestamp);
        });
        const historicalUsdSeries = historicalDayStartMs.map((timestamp) => {
            return historicalUsdByTs.get(timestamp) ?? toZeroPoint(timestamp);
        });

        await saveWalletTokenBalanceHistoryCache({
            address,
            tokenAddress: resolvedMint,
            tokenSymbol: resolvedSymbol,
            tokenSeries: historicalTokenSeries,
            usdSeries: historicalUsdSeries,
            coveredFromMs: historicalFromMs,
            coveredToMs: historicalToMs,
        });

        const [liveTokenPoint, liveUsdPoint] = await getOrFetchLivePoint(
            address,
            resolvedMint,
            nowMs,
            todayDayStartMs,
        );

        return {
            tokenSeries: [...historicalTokenSeries, liveTokenPoint],
            usdSeries: [...historicalUsdSeries, liveUsdPoint],
            tokenSymbol: resolvedSymbol,
            tokenAddress: resolvedMint,
        };
    } catch (snapshotErr) {
        console.warn("[getWalletTokenBalanceHistory] Snapshot path failed", {
            address,
            tokenSelector,
            error: snapshotErr,
        });
    }

    throw new Error(`Unable to retrieve balance history for token "${tokenSelector}"`);
}


export async function getBirdeyePortfolioSnapshotCached(
    address: string,
    daySec: number,
    nowSec: number,
): Promise<Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>>> {
    const cacheKey = buildTokenSnapshotCacheKey(address, daySec);
    const nowMs = Date.now();
    const cached = tokenBalanceSnapshotCache.get(cacheKey);

    if (cached && cached.expiresAtMs > nowMs) {
        return cached.snapshot;
    }

    const snapshot = await fetchBirdeyePortfolioSnapshot(address, {
        time: toIsoFromSec(daySec),
    });

    const ttlMs = getTokenSnapshotCacheTtlMs(daySec, nowSec);
    tokenBalanceSnapshotCache.set(cacheKey, {
        expiresAtMs: nowMs + ttlMs,
        snapshot,
    });

    return snapshot;
}

function buildTokenSnapshotCacheKey(address: string, daySec: number): string {
    return `${address.toLowerCase()}:${daySec}`;
}

function buildTokenLivePointCacheKey(address: string, tokenAddress: string): string {
    return `${address.toLowerCase()}:${tokenAddress}`;
}

function getTokenSnapshotCacheTtlMs(daySec: number, nowSec: number): number {
    const ageSec = Math.max(0, nowSec - daySec);
    return ageSec <= DAY_SEC
        ? TOKEN_BALANCE_SNAPSHOT_CACHE_RECENT_TTL_MS
        : TOKEN_BALANCE_SNAPSHOT_CACHE_HISTORICAL_TTL_MS;
}

function toUtcDayStartMs(timestampMs: number): number {
    const date = new Date(timestampMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function buildHistoricalDayStartMsList(fromSec: number, todayDayStartMs: number): number[] {
    const fromDayStartMs = toUtcDayStartMs(fromSec * 1000);
    const values: number[] = [];
    for (let day = fromDayStartMs; day < todayDayStartMs; day += DAY_MS) {
        values.push(day);
    }
    return values;
}

function toZeroPoint(timestamp: number): BalanceDataPoint {
    return {
        timestamp,
        value: 0,
        date: new Date(timestamp).toISOString(),
    };
}

function toSeriesPoints(
    snapshot: Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>> | null,
    resolvedMint: string,
    timestamp: number,
): [BalanceDataPoint, BalanceDataPoint] {
    if (!snapshot) {
        const zero = toZeroPoint(timestamp);
        return [zero, zero];
    }

    const matchedAsset = snapshot.assets.find((asset) => {
        const assetMint = normalizeMint(asset.tokenAddress);
        if (assetMint && assetMint === resolvedMint) {
            return true;
        }

        return resolvedMint === SOL_MINT && isSolSymbol(asset.symbol);
    });

    if (!matchedAsset) {
        const zero = toZeroPoint(timestamp);
        return [zero, zero];
    }

    const balanceRaw = Number(matchedAsset.balanceRaw ?? Number.NaN);
    const decimals = Number(matchedAsset.decimals ?? 0);
    const tokenAmount =
        Number.isFinite(balanceRaw) && Number.isFinite(decimals)
            ? balanceRaw / 10 ** Math.max(0, decimals)
            : 0;
    const usdValue = toFiniteNumber(
        matchedAsset.valueUsd,
        tokenAmount * toFiniteNumber(matchedAsset.priceUsd, 0),
    );

    return [
        {
            timestamp,
            value: Math.max(0, tokenAmount),
            date: new Date(timestamp).toISOString(),
        },
        {
            timestamp,
            value: Math.max(0, usdValue),
            date: new Date(timestamp).toISOString(),
        },
    ];
}

async function getOrFetchLivePoint(
    address: string,
    tokenAddress: string,
    nowMs: number,
    todayDayStartMs: number,
): Promise<[BalanceDataPoint, BalanceDataPoint]> {
    const cacheKey = buildTokenLivePointCacheKey(address, tokenAddress);
    const cached = tokenBalanceLivePointCache.get(cacheKey);
    if (cached && cached.expiresAtMs > nowMs && cached.dayStartMs === todayDayStartMs) {
        return [cached.tokenPoint, cached.usdPoint];
    }

    let snapshot: Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>> | null = null;
    try {
        snapshot = await fetchBirdeyePortfolioSnapshot(address, {
            time: new Date(nowMs).toISOString(),
        });
    } catch {
        snapshot = null;
    }

    const [tokenPoint, usdPoint] = toSeriesPoints(snapshot, tokenAddress, nowMs);
    tokenBalanceLivePointCache.set(cacheKey, {
        expiresAtMs: nowMs + TOKEN_LIVE_POINT_IN_MEMORY_TTL_MS,
        dayStartMs: todayDayStartMs,
        tokenPoint,
        usdPoint,
    });

    return [tokenPoint, usdPoint];
}
