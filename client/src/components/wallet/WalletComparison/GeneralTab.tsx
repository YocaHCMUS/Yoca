import React from 'react';
import type WalletComparisonProp from "./WalletComparisonProp";
import styles from './GeneralTab.module.scss';
import { MultiWalletBalanceChart } from '@/components/charts/BalanceChartMultiV2';
import { VolumeComparisonChart } from '@/components/charts/VolumeComparisonChart/VolumeComparisonChart';
import { IconButton } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";


export const GeneralTab: React.FC<WalletComparisonProp> = ({
    walletAddresses,
    fetchEnabled = true,
}) => {
    const { tr } = useLocalization();
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
            {/* Balance history comparison */}
            <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
                <MultiWalletBalanceChart
                    addresses={walletAddresses}
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

            {/* Unified Volume Comparison Chart (Total Volume, Buy/Sell Distribution, Volume per Tx) */}
            <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
                <VolumeComparisonChart
                    minHeight={350}
                    initialFilters={{
                        timePeriod: '30D',
                        wallets: walletAddresses,
                    }}
                    fetchEnabled={fetchEnabled}
                />
            </div>


        </div>
    );
}