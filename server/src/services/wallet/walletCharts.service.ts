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
import { getHistoricalPortfolioValueSeries } from "./walletPortfolio.service.js";
import { fetchBirdeyeNetworthHistory } from "./fetchers/walletDataFetcher.service.js";

export async function getWalletBalanceHistory(
    address: string,
): Promise<BalanceDataPoint[]> {
    const timePeriod: WalletTimePeriod = "30D";
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;

    try {
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

        return Array.from(pointsByTimestamp.entries())
            .map(([timestamp, value]) => ({
                timestamp,
                value,
                date: new Date(timestamp).toISOString(),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
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

function emptyPnL(): WalletCumulativePnLResult {
    return {
        dailyPnL: [],
        cumulativePnL: [],
        startBalance: 0,
        endBalance: 0,
    };
}

