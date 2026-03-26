
import { getWalletOverview } from "./walletOverview.service";
import { mapWithConcurrency } from "@sv/util/concurrency";
import { WalletOverviewPeriodKey } from "./dtos/walletDataObjects";
import { getWalletTokenBalanceHistory } from "./walletTokenBalance.service";
import { getWalletBalanceHistory } from "./walletCharts.service";
import { timestamp } from "drizzle-orm/gel-core";
import { date } from "zod";


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

// export async function getStablecoinRatio(wallets: string[], period: WalletOverviewPeriodKey = '30D') {
//     return await mapWithConcurrency(
//         wallets,
//         5, // MAX_WALLET_CHART_CONCURRENCY,
//         // idea: get all token balance history, sieve out stablecoins, sum up stablecoin balance vs total balance to get ratio
//         // async (wallet) => {
//         //     const tokenBalanceHistory = await getTokenBalanceHistory(wallet, period);
//         //     const stablecoinBalance = tokenBalanceHistory.find((entry) => entry.isStablecoin)?.balanceUsd ?? 0;
//         //     const totalBalance = tokenBalanceHistory.reduce((sum, entry) => sum + entry.balanceUsd, 0);
//         // }
//     );

// }

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

