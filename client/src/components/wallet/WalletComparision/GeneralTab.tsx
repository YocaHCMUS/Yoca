import React from 'react';
import type WalletComparisionProp from "./WalletComparisionProp";
import { AssetDistribution } from '@/components/charts/AssetDistribution';
import { HoldingDurations } from '@/components/charts/HoldingDurations';
import styles from './GeneralTab.module.scss';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { VolumeBenchmark } from '@/components/charts/VolumeBenchmark';
import { DailyTradingVolume } from '@/components/charts/DailyTradingVolume';
import { TradingVolumeDistribution } from '@/components/charts/TradingVolumeDistribution/TradingVolumeDistribution';
import { TradingVolumePerTransaction } from '@/components/charts/TradingVolume/TradingVolumePerTransaction';
import { TotalTradingVolumeChart } from '@/components/charts/TotalTradingVolume';


export const GeneralTab: React.FC<WalletComparisionProp> = ({
    walletAddresses
}) => {
    // Empty state when no wallets are selected
    if (!walletAddresses || walletAddresses.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyStateContent}>
                    <h3>No Wallets Selected</h3>
                    <p>Please select at least one wallet to view comparison data.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.grid}>
            {/* Balance history comparision */}
            <div className={styles.stableCoinChart}>
                <BalanceChart
                    initialFilters={{
                        timePeriod: "30D",
                        wallets: walletAddresses
                    }}
                    minHeight={300}
                />
            </div>

            {/* Daily Trading Volume Historical Chart */}
            {/* <div className={styles.stableCoinChart}>
                <DailyTradingVolume
                    minHeight={400}
                    initialFilters={{
                        timePeriod: '30D',
                        wallets: walletAddresses,
                    }}
                />
            </div> */}

            {/* Total Trading Volume Column Chart */}
            {/* <div className={styles.stableCoinChart}>
                <TotalTradingVolumeChart
                    minHeight={300}
                    initialFilters={{
                        timePeriod: '30D',
                        wallets: walletAddresses,
                    }}
                />
            </div> */}

            {/* Trading Volume distribution Chart */}
            {/* <div className={styles.stableCoinChart}>
                <TradingVolumeDistribution
                    initialFilters={{ wallets: walletAddresses }}
                />
            </div> */}


            {/* Average Trading Volume per transaction Charts */}
            {/* <div className={styles.stableCoinChart}>
                <TradingVolumePerTransaction
                    initialFilters={{ wallets: walletAddresses }}
                />
            </div> */}


        </div>
    );
}