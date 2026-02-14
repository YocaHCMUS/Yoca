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
                        initialTimePeriod: "30D",
                        wallets: walletAddresses
                    }}
                    minHeight={300}
                    />    
            </div>

            <div className={styles.stableCoinChart}>
                <VolumeBenchmark
                    minHeight={300}
                    />
            </div>

            {/* Daily Trading Volume Historical Chart */}
            <div className={styles.stableCoinChart}>
                <DailyTradingVolume
                    minHeight={400}
                    walletAddresses={walletAddresses}
                    selectedBenchmarks={['SOL']}
                />
            </div>

            {/* Total Trading Volume Column Chart - Placeholder */}
            <div className={styles.stableCoinChart}>
                <h3>Total Trading Volume Column Chart</h3>
                <p>Temporary placeholder for total trading volume comparison visualization</p>
            </div>

            {/* Trading Volume distribution  Chart - Placeholder */}
            <div  className={styles.stableCoinChart}>
                <TradingVolumeDistribution
                    initialFilters={{ wallets: walletAddresses }}
                />
            </div>
            

            {/* Average Trading Volume per transaction Charts */}
            <div className={styles.stableCoinChart}>
                <TradingVolumePerTransaction
                    initialFilters={{ wallets: walletAddresses }}
                />

            </div>

            {/* Holding Durations Charts */}
            {walletAddresses.map((address, index) => (
                <div key={`holding-${index}`} className={styles.chartContainer}>
                    <HoldingDurations
                        walletIds={[address]}
                        minHeight={300}
                    />
                </div>
            ))}
        </div>
    );
}