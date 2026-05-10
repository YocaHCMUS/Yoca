import type {
    BalanceDataPoint,
    WalletTimePeriod,
    PnLAggregation,
    WalletCumulativePnLResult,
    PnLDataPoint,
    WalletTransfer,
} from "./dtos/walletDataObjects.js";
import {
    getAggregationIntervalMs,
    getRangeStartMs,
    resolvePnLAggregationByGap,
} from "@sv/services/wallet/walletData.core.js";
import { roundUsd } from "./walletNormalization.utils.js";
import { getHistoricalPortfolioValueSeries } from "./walletPortfolio.service.js";
import { fetchBirdeyeNetworthHistory } from "./fetchers/walletDataFetcher.service.js";
import { getCachedWalletBalanceHistory } from "./db/walletDataRetriever.js";
import { saveBalanceHistoryCache } from "./db/walletDataCacher.js";
import { getWalletTransfers } from "./walletTransfersSwaps.service.js";

function startOfUtcTodayMs(): number {
    const d = new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Get UTC start-of-day timestamp (ms) for a given timestamp.
 */
function getUtcStartOfDayMs(tsMs: number): number {
    const d = new Date(tsMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Build daily balance anchors for PnL computation.
 * Returns array of {dayStartMs, balanceAtStart, balanceAtEnd} for each day.
 * Uses linear interpolation if no data point exists at exact day boundary.
 * For the current/last day, uses the final balance point as end-of-day.
 */
function buildDailyBalanceAnchors(
    balanceHistory: BalanceDataPoint[],
    fromMs: number,
    toMs: number,
): Array<{
    dayStartMs: number;
    balanceAtStart: number;
    balanceAtEnd: number;
}> {
    if (balanceHistory.length === 0) {
        return [];
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const anchors: Array<{
        dayStartMs: number;
        balanceAtStart: number;
        balanceAtEnd: number;
    }> = [];

    let currentDayStart = getUtcStartOfDayMs(fromMs);
    const endOfRange = Math.min(toMs, Date.now());

    const reversedHistory = [...balanceHistory].reverse()

    while (currentDayStart <= endOfRange) {
        const nextDayStart = currentDayStart + DAY_MS;

        // Find balances at start and end of current day
        let balanceAtStart = 0;
        let balanceAtEnd = 0;

        const pointAtStart = reversedHistory
            .find((p) => p.timestamp <= currentDayStart);

        balanceAtStart = pointAtStart?.value ?? balanceHistory[0].value;

        const pointBeforeNextDay = reversedHistory
            .find((p) => p.timestamp < nextDayStart);

        balanceAtEnd = pointBeforeNextDay?.value ?? balanceAtStart;

        anchors.push({
            dayStartMs: currentDayStart,
            balanceAtStart,
            balanceAtEnd,
        });

        currentDayStart = nextDayStart;
    }

    return anchors;
}

/**
 * Compute daily net inflow (inflow - outflow) per UTC day.
 * Returns map of dayStartMs -> netInflowUsd.
 *
 * Direction is inferred from transfer.from vs address:
 * - transfer.from == address: outflow (negative)
 * - transfer.to == address: inflow (positive)
 */
async function computeDailyNetInflow(
    address: string,
    fromMs: number,
    toMs: number,
): Promise<Map<number, number>> {
    const dailyNetInflow = new Map<number, number>();

    try {
        const transfersResponse = await getWalletTransfers(address, fromMs, toMs);
        const transfers = transfersResponse?.transfers ?? [];

        // console.log("[computeDailyNetInflow] transfers: ")
        // console.info(transfers)

        for (const transfer of transfers) {
            if (!transfer.amountUsd) {
                continue; // Skip transfers without USD value
            }

            const tsMs = Date.parse(transfer.timestamp);
            if (!Number.isFinite(tsMs)) {
                continue;
            }

            // Only include transfers within the requested range
            if (tsMs < fromMs || tsMs > toMs) {
                continue;
            }

            const dayStartMs = getUtcStartOfDayMs(tsMs);

            // Determine direction: inflow (+) or outflow (-)
            const isInflow = transfer.to === address;
            const isOutflow = transfer.from === address;

            let flowAmount = 0;
            if (isInflow) {
                flowAmount = transfer.amountUsd; // positive
            } else if (isOutflow) {
                flowAmount = -transfer.amountUsd; // negative
            }

            // Accumulate into daily total
            const current = dailyNetInflow.get(dayStartMs) ?? 0;
            dailyNetInflow.set(dayStartMs, current + flowAmount);
        }
    } catch (error) {
        console.error("[computeDailyNetInflow] failed to fetch/compute transfers", {
            address,
            error,
        });
    }

    return dailyNetInflow;
}

export async function getWalletBalanceHistory(
    address: string,
    timePeriod: WalletTimePeriod = "30D",
): Promise<BalanceDataPoint[]> {
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;

    try {
        const cached = await getCachedWalletBalanceHistory(address, timePeriod);
        if (cached && cached.points.length > 0) {
            const filtered = cached.points.filter(
                (p) => p.timestamp >= fromMs && p.timestamp <= toMs,
            );
            if (filtered.length > 0) {
                return [...filtered].sort((a, b) => a.timestamp - b.timestamp);
            }
        }

        const response = await fetchBirdeyeNetworthHistory(address, {
            type: "1d",
            count: 30,
            direction: "back",
            sortType: "asc",
        });

        const pointsByTimestamp = new Map<number, number>();
        for (const point of response.history) {
            const timestamp = Date.parse(point.timestamp);
            if (!Number.isFinite(timestamp)) {
                continue;
            }

            if (timestamp < fromMs || timestamp > toMs) {
                continue;
            }

            pointsByTimestamp.set(timestamp, roundUsd(point.netWorthUsd));
        }

        const series = Array.from(pointsByTimestamp.entries())
            .map(([timestamp, value]) => ({
                timestamp,
                value,
                date: new Date(timestamp).toISOString(),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        const todayStart = startOfUtcTodayMs();
        const forCache = series.filter((p) => p.timestamp < todayStart);
        if (forCache.length > 0) {
            await saveBalanceHistoryCache(
                address,
                timePeriod,
                forCache,
                forCache[0]!.timestamp,
                forCache[forCache.length - 1]!.timestamp,
            );
        }

        return series;
    } catch (error) {
        console.error("[WalletBalanceHistory] failed to build historical series", {
            address,
            timePeriod,
            error,
        });
        return [];
    }
}

export async function getCumulativePnL(
    address: string,
    timePeriod: WalletTimePeriod = "30D"
): Promise<WalletCumulativePnLResult> {
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;

    try {
        // Get balance history and build daily anchors
        const balanceHistory = await getWalletBalanceHistory(address, timePeriod);
        if (balanceHistory.length === 0) {
            return emptyPnL();
        }

        const dailyAnchors = buildDailyBalanceAnchors(balanceHistory, fromMs, toMs);
        if (dailyAnchors.length === 0) {
            return emptyPnL();
        }

        // Compute daily net inflow
        const dailyNetInflowMap = await computeDailyNetInflow(address, fromMs, toMs);
        // console.log("[getCumulativePnL] dailyNetInflowMap")
        // console.info(dailyNetInflowMap)

        // Apply formula: dailyPnL[i] = (balanceEnd - balanceStart) - netInflow[i]
        const dailyPnLArray: PnLDataPoint[] = [];
        let cumulativePnL = 0;
        const cumulativePnLArray: PnLDataPoint[] = [];

        for (const anchor of dailyAnchors) {
            const dayStartMs = anchor.dayStartMs;
            const balanceDelta = anchor.balanceAtEnd - anchor.balanceAtStart;
            const netInflow = dailyNetInflowMap.get(dayStartMs) ?? 0;

            // Formula: dailyPnL = dayDelta - netInflow
            const dayPnL = roundUsd(balanceDelta - netInflow);
            // const dayPnL = roundUsd(balanceDelta);
            // const dayPnL = roundUsd(netInflow);

            dailyPnLArray.push({
                timestamp: dayStartMs,
                value: dayPnL,
            });

            // Cumulative as prefix sum
            cumulativePnL += dayPnL;
            cumulativePnLArray.push({
                timestamp: dayStartMs,
                value: roundUsd(cumulativePnL),
            });
        }

        // startBalance and endBalance from day-anchor balances
        const startBalance = dailyAnchors.length > 0 ? roundUsd(dailyAnchors[0]!.balanceAtStart) : 0;
        const endBalance = dailyAnchors.length > 0 ? roundUsd(dailyAnchors[dailyAnchors.length - 1]!.balanceAtEnd) : 0;

        return {
            dailyPnL: dailyPnLArray,
            cumulativePnL: cumulativePnLArray,
            startBalance,
            endBalance,
        };
    } catch (error) {
        console.error("[WalletCumulativePnL] failed to compute series", {
            address,
            timePeriod,
            // aggregation,
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

