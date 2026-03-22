import type {
    BalanceDataPoint,
    WalletTimePeriod,
    PnLAggregation,
    WalletCumulativePnLResult,
    PnLDataPoint,
} from "./dtos/walletDataObjects.js";
import {
    getAggregationIntervalMs,
    getRangeStartMs,
    resolvePnLAggregationByGap,
} from "@sv/services/wallet/walletData.core.js";
import { roundUsd } from "./walletNormalization.utils.js";
import { getHistoricalPortfolioValueSeries, getWalletPortfolio } from "./walletPortfolio.service.js";

export async function getWalletBalanceHistory(
    address: string,
    timePeriod: WalletTimePeriod = "30D",
): Promise<BalanceDataPoint[]> {
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;
    const intervalMs = resolveBalanceIntervalMs(timePeriod);

    try {
        const points = await getHistoricalPortfolioValueSeries(address, fromMs, toMs, intervalMs);
        if (points.length > 0) {
            return points.map((point) => ({
                timestamp: point.timestamp,
                value: point.value,
                date: new Date(point.timestamp).toISOString(),
            }));
        }
    } catch (error) {
        console.error("[WalletBalanceHistory] failed to build historical series", {
            address,
            timePeriod,
            error,
        });
    }

    const fallbackValue = await getFallbackPortfolioValueUsd(address);
    return [
        {
            timestamp: fromMs,
            value: fallbackValue,
            date: new Date(fromMs).toISOString(),
        },
        {
            timestamp: toMs,
            value: fallbackValue,
            date: new Date(toMs).toISOString(),
        },
    ];
}

export async function getCumulativePnL(
    address: string,
    timePeriod: WalletTimePeriod = "30D",
    aggregation: PnLAggregation = "daily",
): Promise<WalletCumulativePnLResult> {
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;
    const requestedGapSec = Math.max(0, rangeSec.toSec - rangeSec.fromSec);
    const effectiveAggregation = resolvePnLAggregationByGap(aggregation, requestedGapSec);
    const intervalMs = getAggregationIntervalMs(effectiveAggregation);

    try {
        const snapshots = await getHistoricalPortfolioValueSeries(address, fromMs, toMs, intervalMs);

        if (snapshots.length === 0) {
            return emptyPnL();
        }

        const startingValue = snapshots[0]?.value ?? 0;
        let previousValue = startingValue;

        const dailyPnL: PnLDataPoint[] = snapshots.map((point, index) => {
            const delta = index === 0 ? 0 : point.value - previousValue;
            previousValue = point.value;
            return {
                timestamp: point.timestamp,
                value: roundUsd(delta),
            };
        });

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
        console.error("[WalletCumulativePnL] failed to compute series", {
            address,
            timePeriod,
            aggregation,
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

function resolveBalanceIntervalMs(timePeriod: WalletTimePeriod): number {
    if (timePeriod === "7D") {
        return 6 * 60 * 60 * 1000;
    }

    return 24 * 60 * 60 * 1000;
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
