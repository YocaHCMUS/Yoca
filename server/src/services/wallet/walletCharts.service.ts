import type {
    BalanceDataPoint,
    WalletTimePeriod,
    PnLAggregation,
    WalletCumulativePnLResult,
    PnLDataPoint,
} from "./dtos/walletDataObjects.js";
import {
    getRangeStartMs,
    getDailySnapshotSecRange,
} from "@sv/services/wallet/walletData.core.js";
import { roundUsd } from "./walletNormalization.utils.js";
import { getWalletPortfolio } from "./walletPortfolio.service.js";
import { fetchBirdeyeNetworthHistory } from "./fetchers/walletDataFetcher.service.js";
import { getCachedWalletBalanceHistory } from "./db/walletDataRetriever.js";
import { saveBalanceHistoryCache } from "./db/walletDataCacher.js";
import { timePeriodToCountAndLoop } from "./walletTime.utils.js";
import { formatToBirdeyeDayStart, toUtcDayStartMs } from "@sv/util/util-birdeye.js";
import { mapWithConcurrency } from "@sv/util/concurrency.js";
import { getBirdeyePortfolioSnapshotCached } from "./walletTokenBalance.service.js";
import { PORTFOLIO_SNAPSHOT_CONCURRENCY, DAY_MS } from "./wallet.constants.js";

const TODAY_LIVE_POINT_IN_MEMORY_TTL_MS = 60 * 1000;

type TodayLivePointCacheEntry = {
    dayStartMs: number;
    cachedAtMs: number;
    point: BalanceDataPoint;
};

const todayLivePointInMemoryCache = new Map<string, TodayLivePointCacheEntry>();

function getTodayLivePointCacheKey(address: string): string {
    return `${address.toLowerCase()}`;
}

function getTodayLivePointFromMemory(
    address: string,
    todayDayStartMs: number,
    nowMs: number,
): BalanceDataPoint | null {
    const key = getTodayLivePointCacheKey(address);
    const entry = todayLivePointInMemoryCache.get(key);
    if (!entry) {
        return null;
    }

    const expired = nowMs - entry.cachedAtMs > TODAY_LIVE_POINT_IN_MEMORY_TTL_MS;
    const staleDay = entry.dayStartMs !== todayDayStartMs;
    if (expired || staleDay) {
        todayLivePointInMemoryCache.delete(key);
        return null;
    }

    return entry.point;
}

function setTodayLivePointInMemory(
    address: string,
    todayDayStartMs: number,
    point: BalanceDataPoint,
    nowMs: number,
): void {
    const key = getTodayLivePointCacheKey(address);
    todayLivePointInMemoryCache.set(key, {
        dayStartMs: todayDayStartMs,
        cachedAtMs: nowMs,
        point,
    });
}

/**
 * Normalize array of balance data points to one per UTC day (deduped by day key)
 */
function dedupeBalancePointsByDay(points: BalanceDataPoint[]): BalanceDataPoint[] {
    const byDay = new Map<string, BalanceDataPoint>();
    for (const point of points) {
        const date = new Date(point.timestamp);
        date.setUTCHours(0, 0, 0, 0);
        const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
        if (!byDay.has(dayKey) || byDay.get(dayKey)!.timestamp < point.timestamp) {
            byDay.set(dayKey, point);
        }
    }
    return Array.from(byDay.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Fill gaps in daily balance series using carry-forward strategy
 * - Internal gaps filled with nearest prior known value
 * - Leading gaps filled with first known value
 * - If no known points, use fallback value
 */
function fillDailyGaps(
    points: BalanceDataPoint[],
    fromMs: number,
    toMs: number,
    fallbackValue: number,
): BalanceDataPoint[] {
    if (points.length === 0) {
        // No data at all - return fallback for the range
        const result: BalanceDataPoint[] = [];
        const startDay = new Date(fromMs);
        startDay.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(toMs);
        endDay.setUTCHours(0, 0, 0, 0);

        let current = startDay.getTime();
        while (current <= endDay.getTime()) {
            result.push({
                timestamp: current,
                value: fallbackValue,
                date: new Date(current).toISOString(),
                changeUsd: 0,
                changePercent: 0,
            });
            current += 24 * 60 * 60 * 1000;
        }
        return result;
    }

    const result: BalanceDataPoint[] = [];
    const startDay = new Date(fromMs);
    startDay.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(toMs);
    endDay.setUTCHours(0, 0, 0, 0);

    let current = startDay.getTime();
    let lastKnownValue = fallbackValue;
    let pointIndex = 0;

    while (current <= endDay.getTime()) {
        // Find if we have a point for this day
        const dayStart = new Date(current);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;

        let foundPoint: BalanceDataPoint | null = null;
        while (pointIndex < points.length && points[pointIndex].timestamp <= dayEnd) {
            if (points[pointIndex].timestamp >= dayStart.getTime()) {
                foundPoint = points[pointIndex];
                break;
            }
            pointIndex++;
        }

        if (foundPoint) {
            result.push(foundPoint);
            lastKnownValue = foundPoint.value;
        } else {
            // Gap - use carry-forward
            result.push({
                timestamp: current,
                value: lastKnownValue,
                date: new Date(current).toISOString(),
                changeUsd: 0,
                changePercent: 0,
            });
        }

        current += 24 * 60 * 60 * 1000;
    }

    return result;
}

/**
 * Check if cache covers the historical window (up to yesterday)
 */
function isCacheFreshAndCovering(
    cachedEntry: { coveredFromMs: number; coveredToMs: number } | null,
    requestedFromMs: number,
    requestedToMs: number,
    nowMs: number,
): boolean {
    if (!cachedEntry) return false;

    // Cache must cover from the requested start to at least yesterday
    const yesterdayEndMs = toUtcDayStartMs(nowMs) - 1;
    const effectiveToMs = Math.min(requestedToMs, yesterdayEndMs);

    return (
        cachedEntry.coveredFromMs <= requestedFromMs &&
        cachedEntry.coveredToMs >= effectiveToMs
    );
}

/**
 * Fetch balance history from Birdeye for a specific range using pagination
 */
async function fetchBirdeyeHistoryRange(
    address: string,
    fromMs: number,
    toMs: number,
    nowMs: number,
): Promise<BalanceDataPoint[]> {
    const allPoints: BalanceDataPoint[] = [];
    const { count, loop } = timePeriodToCountAndLoop("30D"); // Use 30D pagination limits

    // Start from the end of the requested range and work backwards
    let cursor = formatToBirdeyeDayStart(Math.min(toMs, nowMs));

    for (let i = 0; i < loop; i++) {
        const data = await fetchBirdeyeNetworthHistory(address, { count, time: cursor });

        if (!data?.history || data.history.length === 0) {
            break;
        }

        for (const point of data.history) {
            const pointMs = new Date(point.timestamp).getTime();
            if (pointMs < fromMs) {
                // We've gone past the requested range, stop
                return dedupeBalancePointsByDay(allPoints);
            }

            allPoints.push({
                timestamp: pointMs,
                value: point.netWorthUsd,
                date: new Date(point.timestamp).toISOString(),
                changeUsd: point.netWorthChangeUsd ?? 0,
                changePercent: point.netWorthChangePercent ?? 0,
            });
        }

        // Move cursor back by 1 day to fetch next batch
        if (allPoints.length > 0) {
            const lastPointMs = allPoints[allPoints.length - 1].timestamp;
            cursor = formatToBirdeyeDayStart(lastPointMs - 24 * 60 * 60 * 1000);
        }
    }

    return dedupeBalancePointsByDay(allPoints);
}

export async function getWalletBalanceHistory(
    address: string,
    timePeriod: WalletTimePeriod = "30D",
): Promise<BalanceDataPoint[]> {
    try {
        const nowMs = Date.now();
        const requestedFromMs = getRangeStartMs(nowMs, timePeriod);
        const todayDayStartMs = toUtcDayStartMs(nowMs);
        const yesterdayEndMs = todayDayStartMs - 1;

        // Split window: historical (cacheable) vs today (live only)
        const historicalToMs = Math.min(nowMs, yesterdayEndMs);

        // Try to get historical data from cache
        let historicalPoints: BalanceDataPoint[] = [];
        const cachedEntry = await getCachedWalletBalanceHistory(address, timePeriod);

        if (isCacheFreshAndCovering(cachedEntry, requestedFromMs, historicalToMs, nowMs)) {
            // Cache fully covers historical range, use it
            historicalPoints = cachedEntry!.points.filter(
                p => p.timestamp >= requestedFromMs && p.timestamp <= historicalToMs
            );
        } else {
            // Fetch missing historical segments or all if no cache
            const missingFromMs = cachedEntry?.coveredToMs ? cachedEntry.coveredToMs + 1 : requestedFromMs;
            if (missingFromMs <= historicalToMs) {
                const fetchedPoints = await fetchBirdeyeHistoryRange(
                    address,
                    missingFromMs,
                    historicalToMs,
                    nowMs,
                );

                // Combine cached + fetched, deduped
                if (cachedEntry?.points) {
                    historicalPoints = dedupeBalancePointsByDay([
                        ...cachedEntry.points,
                        ...fetchedPoints,
                    ]);
                } else {
                    historicalPoints = fetchedPoints;
                }
            } else if (cachedEntry?.points) {
                historicalPoints = cachedEntry.points;
            }
        }

        // Today's point is cacheable only in-memory (never persisted to DB).
        let todayPoint: BalanceDataPoint | null = getTodayLivePointFromMemory(
            address,
            todayDayStartMs,
            nowMs,
        );

        if (!todayPoint && nowMs >= todayDayStartMs) {
            const todayData = await fetchBirdeyeNetworthHistory(address, {
                count: 1,
                time: formatToBirdeyeDayStart(nowMs),
            });

            if (todayData?.history && todayData.history.length > 0) {
                const point = todayData.history[0];
                todayPoint = {
                    timestamp: nowMs, // Use current time, not day start
                    value: point.netWorthUsd,
                    date: new Date(nowMs).toISOString(),
                    changeUsd: point.netWorthChangeUsd ?? 0,
                    changePercent: point.netWorthChangePercent ?? 0,
                };

                setTodayLivePointInMemory(address, todayDayStartMs, todayPoint, nowMs);
            }
        }

        // Cache only historical data (up to yesterday)
        if (historicalPoints.length > 0) {
            const persistToMs = historicalPoints[historicalPoints.length - 1].timestamp;
            const cacheToMs = Math.min(persistToMs, yesterdayEndMs);

            await saveBalanceHistoryCache(
                address,
                timePeriod,
                historicalPoints.filter(p => p.timestamp <= cacheToMs),
                historicalPoints[0].timestamp,
                cacheToMs,
            );
        }

        // Merge all data and fill gaps
        const allPoints: BalanceDataPoint[] = [...historicalPoints];
        if (todayPoint) {
            allPoints.push(todayPoint);
        }

        // Get fallback value if we have no data
        let fallbackValue = 0;
        if (allPoints.length === 0) {
            fallbackValue = await getFallbackPortfolioValueUsd(address);
        }

        // Fill daily gaps for historical range, then append today if present
        const filledPoints = fillDailyGaps(
            historicalPoints,
            requestedFromMs,
            historicalToMs,
            fallbackValue,
        );

        // Append today's live point if available (don't include it in gap-filling)
        if (todayPoint) {
            filledPoints.push(todayPoint);
        }

        return filledPoints;
    } catch (error) {
        console.error("[WalletBalanceHistory] Error fetching balance history for address:", address, "timePeriod:", timePeriod, "error:", error);
        return [];
    }
}

/**
 * Fetch historical portfolio value series using Birdeye daily portfolio snapshots.
 * This is the snapshot-based approach that replaces transaction reconstruction.
 *
 * @param address - Wallet address
 * @param startMs - Start timestamp in milliseconds
 * @param endMs - End timestamp in milliseconds
 * @returns Array of portfolio value data points
 */
async function getHistoricalPortfolioValueSeriesFromSnapshots(
    address: string,
    startMs: number,
    endMs: number,
): Promise<PnLDataPoint[]> {
    const requestedFromSec = Math.floor(startMs / 1000);
    const requestedToSec = Math.floor(endMs / 1000);
    const daySecList = getDailySnapshotSecRange(requestedFromSec, requestedToSec);

    if (daySecList.length === 0) {
        return [];
    }

    // Fetch all daily snapshots with concurrency control
    const dailySnapshots = await mapWithConcurrency(
        daySecList,
        PORTFOLIO_SNAPSHOT_CONCURRENCY,
        async (daySec) => {
            try {
                const snapshot = await getBirdeyePortfolioSnapshotCached(
                    address,
                    daySec,
                    requestedToSec,
                );
                return { daySec, snapshot, error: null };
            } catch (error) {
                return { daySec, snapshot: null, error };
            }
        },
    );

    // Calculate portfolio value for each snapshot
    const portfolioValues = dailySnapshots
        .map((entry) => {
            const timestamp = entry.daySec * 1000;

            if (!entry.snapshot) {
                return {
                    timestamp,
                    value: 0,
                    error: entry.error,
                };
            }

            // Sum all asset values from snapshot
            const totalUsd = (entry.snapshot.assets ?? []).reduce(
                (sum, asset) => sum + Number(asset.valueUsd ?? 0),
                0,
            );

            return {
                timestamp,
                value: Math.max(0, totalUsd),
                error: null,
            };
        })
        .filter((point) => point.error === null)
        .map(({ timestamp, value }) => ({ timestamp, value }));

    // Handle gaps using carry-forward strategy
    if (portfolioValues.length === 0) {
        return [];
    }

    return fillPortfolioValueGaps(portfolioValues, startMs, endMs);
}

/**
 * Fill gaps in portfolio value series using carry-forward strategy.
 * For days where snapshots failed or are missing, use the last known value.
 *
 * @param points - Portfolio value points with timestamps
 * @param fromMs - Start of range in milliseconds
 * @param toMs - End of range in milliseconds
 * @returns Complete daily series with gaps filled
 */
function fillPortfolioValueGaps(
    points: PnLDataPoint[],
    fromMs: number,
    toMs: number,
): PnLDataPoint[] {
    if (points.length === 0) {
        return [];
    }

    const result: PnLDataPoint[] = [];
    const startDay = new Date(fromMs);
    startDay.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(toMs);
    endDay.setUTCHours(0, 0, 0, 0);

    const pointsByDay = new Map<string, PnLDataPoint>();
    for (const point of points) {
        const date = new Date(point.timestamp);
        date.setUTCHours(0, 0, 0, 0);
        const dayKey = date.toISOString().split("T")[0];
        pointsByDay.set(dayKey, point);
    }

    let current = startDay.getTime();
    let lastKnownValue = 0;

    while (current <= endDay.getTime()) {
        const date = new Date(current);
        const dayKey = date.toISOString().split("T")[0];
        const point = pointsByDay.get(dayKey);

        if (point) {
            result.push(point);
            lastKnownValue = point.value;
        } else {
            // Gap: use carry-forward
            result.push({ timestamp: current, value: lastKnownValue });
        }

        current += DAY_MS;
    }

    return result;
}

export async function getCumulativePnL(
    address: string,
): Promise<WalletCumulativePnLResult> {
    const timePeriod: WalletTimePeriod = "30D";
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;

    try {
        const snapshots = await getHistoricalPortfolioValueSeriesFromSnapshots(
            address,
            fromMs,
            toMs,
        );

        if (snapshots.length === 0) {
            return emptyPnL();
        }

        const startingValue = snapshots[0]?.value ?? 0;
        let previousValue = startingValue;

        // Calculate daily PnL as delta between consecutive snapshots
        const dailyPnL: PnLDataPoint[] = snapshots.map((point, index) => {
            const delta = index === 0 ? 0 : point.value - previousValue;
            previousValue = point.value;
            return {
                timestamp: point.timestamp,
                value: roundUsd(delta),
            };
        });

        // Calculate cumulative PnL
        const cumulativePnL: PnLDataPoint[] = snapshots.map((point) => ({
            timestamp: point.timestamp,
            value: roundUsd(point.value - startingValue),
        }));

        return {
            dailyPnL,
            cumulativePnL,
            startBalance: roundUsd(startingValue),
            endBalance: roundUsd(snapshots[snapshots.length - 1]?.value ?? 0),
        };
    } catch (error) {
        console.error("[WalletCumulativePnL] failed to compute series using snapshot approach", {
            address,
            timePeriod,
            error,
        });
        return emptyPnL();
    }
}

export function resolveWalletTimeRangeSec(
    timePeriod: WalletTimePeriod,
    nowSec = Math.floor(Date.now() / 1000),
): { fromSec: number; toSec: number } {
    const nowMs = nowSec * 1000;
    const fromMs = getRangeStartMs(nowMs, timePeriod);
    return {
        fromSec: Math.max(0, Math.floor(fromMs / 1000)),
        toSec: nowSec,
    };
}

function emptyPnL(): WalletCumulativePnLResult {
    return {
        dailyPnL: [],
        cumulativePnL: [],
        startBalance: 0,
        endBalance: 0,
    };
}

async function getFallbackPortfolioValueUsd(address: string): Promise<number> {
    try {
        const portfolio = await getWalletPortfolio(address);
        const total = portfolio.reduce((sum, item) => sum + Number(item.valueUsd ?? 0), 0);
        return Number.isFinite(total) ? Math.max(0, total) : 0;
    } catch {
        return 0;
    }
}
