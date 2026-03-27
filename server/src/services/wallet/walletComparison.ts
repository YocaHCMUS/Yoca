
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
                walletAddress: wallet,
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
            if (!balanceHistory || balanceHistory.length === 0) {
                return { drawdownResult: [], walletAddress: wallet };
            }

            let peak = balanceHistory[0].value;
            let trough = balanceHistory[0].value;
            const drawdownResult = [];

            for (let i = 0; i < balanceHistory.length; i++) {
                const point = balanceHistory[i];
                // New peak resets trough
                if (point.value > peak) {
                    peak = point.value;
                    trough = point.value;
                }
                // New trough
                if (point.value < trough) {
                    trough = point.value;
                }
                // Drawdown is always relative to the most recent peak
                const drawdown = peak === 0 ? 0 : (point.value - peak) / peak;
                drawdownResult.push({
                    timestamp: point.timestamp,
                    date: point.date,
                    value: point.value,
                    peak,
                    trough,
                    drawdown,
                });
            }

            return {
                drawdownResult,
                walletAddress: wallet,
            };
        }
    );
}

