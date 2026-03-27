
import { getWalletOverview } from "./walletOverview.service";
import { mapWithConcurrency } from "@sv/util/concurrency";
import { WalletOverviewPeriodKey, WalletTimePeriod } from "./dtos/walletDataObjects";
import { getWalletTokenBalanceHistory } from "./walletTokenBalance.service";
import { getWalletBalanceHistory } from "./walletCharts.service";
import { getWalletPortfolio } from "./walletPortfolio.service";
import { resolveWalletTimeRangeSec } from "./walletCharts.service";

export interface StablecoinRatioRequest {
    wallets: string[];
    timePeriod?: WalletTimePeriod;
}

export interface StablecoinRatioRow {
    timestamp: number;
    date: string;
    [walletKey: string]: number | string;
}

type WalletRatioPoint = {
    timestamp: number;
    date: string;
    ratio: number;
};

const STABLECOIN_SYMBOLS = new Set([
    "USDC",
    "USDT",
    "DAI",
    "USDH",
    "USDX",
    "USDE",
    "FDUSD",
    "TUSD",
    "PYUSD",
    "USDS",
]);


export async function getTradingVolumes(wallets: string[], period: WalletOverviewPeriodKey = '30D'): Promise<{ wallet: string; tradingVolumeUsd: number | null }[]> {
    // period is for future proofing

    return await mapWithConcurrency(
        wallets,
        5, // MAX_WALLET_CHART_CONCURRENCY
        async (wallet) => {
            const overview = await getWalletOverview(wallet);
            return {
                wallet,
                tradingVolumeUsd: overview.periods[period].tradingVolumeUsd,
            };
        }
    );
}

export async function getTradingVolumeDistribution(wallets: string[], period: WalletOverviewPeriodKey = '30D') {
    return await mapWithConcurrency(
        wallets,
        5, // MAX_WALLET_CHART_CONCURRENCY
        async (wallet) => {
            const overview = await getWalletOverview(wallet);
            return {
                wallet,
                buy: overview.periods[period].buy,
                sell: overview.periods[period].sell,
            };
        }
    );
}

export async function getTradingVolumePerTransaction(wallets: string[], period: WalletOverviewPeriodKey = '30D') {
    return await mapWithConcurrency(
        wallets,
        5, // MAX_WALLET_CHART_CONCURRENCY,
        async (wallet) => {
            const overview = await getWalletOverview(wallet);
            const volume = overview.periods[period].tradingVolumeUsd;
            const txnCount = overview.periods[period].transactionCount;
            return {
                wallet,
                tradingVolumePerTransaction: volume && txnCount ? volume / txnCount : null,
            };
        }
    );
}

export async function getStablecoinRatio(
    request: StablecoinRatioRequest,
): Promise<StablecoinRatioRow[]> {
    const wallets = request.wallets.filter((wallet) => wallet.trim().length > 0);
    const timePeriod = request.timePeriod ?? "30D";

    if (wallets.length === 0) {
        return [];
    }

    try {
        const rangeSec = resolveWalletTimeRangeSec(timePeriod);

        const walletSeries = await mapWithConcurrency(
            wallets,
            3,
            async (wallet, index) => {
                const walletKey = `wallet${index + 1}`;

                try {
                    const portfolio = await getWalletPortfolio(wallet);
                    if (portfolio.length === 0) {
                        return {
                            wallet,
                            walletKey,
                            points: [] as WalletRatioPoint[],
                        };
                    }

                    const tokenSeries = await mapWithConcurrency(
                        portfolio,
                        4,
                        async (token) => {
                            try {
                                const series = await getWalletTokenBalanceHistory(wallet, token.tokenAddress);
                                return {
                                    symbol: token.symbol,
                                    usdSeries: series.usdSeries,
                                };
                            } catch {
                                return {
                                    symbol: token.symbol,
                                    usdSeries: [],
                                };
                            }
                        },
                    );

                    const totalByTimestamp = new Map<number, number>();
                    const stableByTimestamp = new Map<number, number>();

                    for (const token of tokenSeries) {
                        const isStable = isStablecoinSymbol(token.symbol);
                        for (const point of token.usdSeries) {
                            const timestampSec = Math.floor(point.timestamp / 1000);
                            if (timestampSec < rangeSec.fromSec || timestampSec > rangeSec.toSec) {
                                continue;
                            }

                            const value = Number.isFinite(point.value) ? point.value : 0;
                            if (value <= 0) {
                                continue;
                            }

                            totalByTimestamp.set(
                                point.timestamp,
                                (totalByTimestamp.get(point.timestamp) ?? 0) + value,
                            );

                            if (isStable) {
                                stableByTimestamp.set(
                                    point.timestamp,
                                    (stableByTimestamp.get(point.timestamp) ?? 0) + value,
                                );
                            }
                        }
                    }

                    const points: WalletRatioPoint[] = Array.from(totalByTimestamp.keys())
                        .sort((a, b) => a - b)
                        .map((timestamp) => {
                            const total = totalByTimestamp.get(timestamp) ?? 0;
                            const stable = stableByTimestamp.get(timestamp) ?? 0;
                            const ratio = total > 0 ? clampToPercent((stable / total) * 100) : 0;
                            return {
                                timestamp,
                                date: formatDateForChart(timestamp),
                                ratio,
                            };
                        });

                    return {
                        wallet,
                        walletKey,
                        points,
                    };
                } catch (walletError) {
                    console.error("[getStablecoinRatio] Failed to compute wallet series", {
                        wallet,
                        walletKey,
                        timePeriod,
                        error: walletError,
                    });

                    return {
                        wallet,
                        walletKey,
                        points: [] as WalletRatioPoint[],
                    };
                }
            },
        );

        const mergedByTimestamp = new Map<number, StablecoinRatioRow>();
        for (const walletData of walletSeries) {
            for (const point of walletData.points) {
                const existing = mergedByTimestamp.get(point.timestamp) ?? {
                    timestamp: point.timestamp,
                    date: point.date,
                };

                existing[walletData.walletKey] = point.ratio;
                mergedByTimestamp.set(point.timestamp, existing);
            }
        }

        const walletKeys = walletSeries.map((item) => item.walletKey);
        const rows = Array.from(mergedByTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
        for (const row of rows) {
            for (const walletKey of walletKeys) {
                if (typeof row[walletKey] !== "number") {
                    row[walletKey] = 0;
                }
            }
        }

        return rows;
    } catch (error) {
        console.error("[getStablecoinRatio] Failed to build stablecoin ratio dataset", {
            wallets,
            timePeriod,
            error,
        });
        return [];
    }
}

function isStablecoinSymbol(symbol: string | null | undefined): boolean {
    if (!symbol) {
        return false;
    }

    const normalized = symbol.trim().toUpperCase();
    return STABLECOIN_SYMBOLS.has(normalized);
}

function clampToPercent(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    const rounded = Math.round(value * 100) / 100;
    if (rounded < 0) {
        return 0;
    }
    if (rounded > 100) {
        return 100;
    }
    return rounded;
}

function formatDateForChart(timestampMs: number): string {
    const date = new Date(timestampMs);
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${date.getUTCDate()}`.padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${month}/${day}/${year}`;
}

export async function getRollingAnnualReturns(wallets: string[], period: WalletOverviewPeriodKey = '30D') {
    return await mapWithConcurrency(
        wallets,
        5, // MAX_WALLET_CHART_CONCURRENCY,
        async (wallet) => {
            const overview = await getWalletOverview(wallet);
            const returns = overview.periods[period].pnl;
            return {
                wallet,
                rollingAnnualReturns: returns ? returns : null, // annualize the returns
            };
        }
    );
}

// winrate
// export async function get


export async function getDrawdown(wallets: string[], period: WalletOverviewPeriodKey = '30D') {
    return await mapWithConcurrency(
        wallets,
        5, // MAX_WALLET_CHART_CONCURRENCY,
        async (wallet) => {
            const balanceHistory = await getWalletBalanceHistory(wallet);
            const drawdownResult = [{
                timestamp: balanceHistory[0].timestamp, // for simplicity, using the first timestamp as the drawdown timestamp
                date: balanceHistory[0].date,
                value: balanceHistory[0].value,
                peak: balanceHistory[0].value,
                trough: balanceHistory[0].value,
                drawdown: 0,
            }]
            balanceHistory.forEach((point) => {
                const lastResult = drawdownResult[drawdownResult.length - 1];
                if (point.value > (lastResult.peak ?? 0)) { // new peak
                    drawdownResult.push({
                        timestamp: point.timestamp,
                        date: point.date,
                        value: point.value,
                        peak: point.value,
                        trough: lastResult.trough,
                        drawdown: 0, // reset drawdown on new peak
                    });
                } else if (point.value < (lastResult.trough ?? Infinity)) { // new trough
                    drawdownResult.push({
                        timestamp: point.timestamp,
                        date: point.date,
                        value: point.value,
                        peak: lastResult.peak,
                        trough: point.value,
                        drawdown: (point.value - lastResult.peak) / lastResult.peak, // calculate drawdown
                    });
                } else {
                    drawdownResult.push({ // same peak, no new trough
                        timestamp: point.timestamp,
                        date: point.date,
                        value: point.value,
                        peak: lastResult.peak,
                        trough: lastResult.trough,
                        drawdown: (point.value - lastResult.peak) / lastResult.peak, // calculate drawdown
                    });
                }
            });

            return drawdownResult;
        }
    );
}

