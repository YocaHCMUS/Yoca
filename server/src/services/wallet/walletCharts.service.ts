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
import { fetchBirdeyeNetworthHistory } from "./fetchers/walletDataFetcher.service.js";
import { time } from "console";

function timePeriodToCountAndLoop(timePeriod: WalletTimePeriod): { count: number; loop: number } {
    switch (timePeriod) {
        case "7D":
            return { count: 7, loop: 1 };
        case "30D":
            return { count: 30, loop: 1 };
        case "90D":
            return { count: 30, loop: 3 };
        case "1Y":
            return { count: 30, loop: 12 };
        case "All":
            return { count: 30, loop: 12 };
        case "24H":
            return { count: 1, loop: 1 };
        default:
            return { count: 30, loop: 1 };
    }
}

function toBirdeyeTimeString(timestamp: number): string {
    const date = new Date(timestamp);
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const min = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}


export async function getWalletBalanceHistory(
    address: string,
    timePeriod: WalletTimePeriod = "30D",
): Promise<BalanceDataPoint[]> {
    const balanceHistory: BalanceDataPoint[] = [];

    try {
        const { count, loop } = timePeriodToCountAndLoop(timePeriod);
        // format: "YYYY-MM-DD HH:mm:ss"
        let timestampCursor = toBirdeyeTimeString(Date.now());

        for (let i = 0; i < loop; i++) {
            const data = await fetchBirdeyeNetworthHistory(address, { count, time: timestampCursor });
            if (data?.history.length) {
                for (const point of data.history) {
                    balanceHistory.push({
                        timestamp: new Date(point.timestamp).getTime(),
                        value: point.netWorthUsd,
                        date: new Date(point.timestamp).toISOString(),
                        changeUsd: point.netWorthChangeUsd ?? 0,
                        changePercent: point.netWorthChangePercent ?? 0,
                    });
                }

            } else {
                console.warn(`[WalletBalanceHistory] Data limit reached`);
                break;
            }

            timestampCursor = toBirdeyeTimeString(balanceHistory[balanceHistory.length - 1].timestamp - 1000 * 24 * 60 * 60); // move cursor back by 1 day to avoid fetching the same last point again
        }

        // cache the most recent balance with a 5 minute ttl for quick retrieval in other endpoints

        return balanceHistory;
    }
    catch (error) {
        console.error("[WalletBalanceHistory] Error fetching balance history for address:", address, "timePeriod:", timePeriod, "error:", error);
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
