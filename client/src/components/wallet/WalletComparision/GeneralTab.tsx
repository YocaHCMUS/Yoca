import React from 'react';
import type WalletComparisionProp from "./WalletComparisionProp";
import styles from './GeneralTab.module.scss';
import { BalanceChart } from '@/components/charts/BalanceChart';
import { TradingVolumeDistribution } from '@/components/charts/TradingVolumeDistribution/TradingVolumeDistribution';
import { TradingVolumePerTransaction } from '@/components/charts/TradingVolume/TradingVolumePerTransaction';
import { TotalTradingVolumeChart } from '@/components/charts/TotalTradingVolume';

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";


export const GeneralTab: React.FC<WalletComparisionProp> = ({
    walletAddresses,
    fetchEnabled = true,
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
            <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
                <BalanceChart
                    initialFilters={{
                        timePeriod: "30D",
                        wallets: walletAddresses
                    }}
                    minHeight={300}
                    fetchEnabled={fetchEnabled}
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
            <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
                <TotalTradingVolumeChart
                    minHeight={300}
                    initialFilters={{
                        timePeriod: '30D',
                        wallets: walletAddresses,
                    }}
                    fetchEnabled={fetchEnabled}
                />
            </div>

            {/* Trading Volume distribution Chart */}
            <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
                <TradingVolumeDistribution
                    initialFilters={{ wallets: walletAddresses }}
                    fetchEnabled={fetchEnabled}
                />
            </div>


            {/* Average Trading Volume per transaction Charts */}
            <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
                <TradingVolumePerTransaction
                    initialFilters={{ wallets: walletAddresses }}
                    fetchEnabled={fetchEnabled}
                />
            </div>


        </div>
    );
}