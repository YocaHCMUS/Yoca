import React from 'react';
import type WalletComparisionProp from "./WalletComparisionProp";
import { PnLChart } from '@/components/charts/PnLChart';
import { RollingAnnualReturn } from '@/components/charts/RollingAnnualReturn';
import { AverageRollingAnnualReturn } from '@/components/charts/AverageRollingAnnualReturn';
import styles from './GeneralTab.module.scss'; // Reusing the same styles


export const RiskTab: React.FC<WalletComparisionProp> = ({
    walletAddresses
}) => {
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
            {/* Rolling annual returns */}
            <div className={styles.stableCoinChart}>
                <RollingAnnualReturn
                    minHeight={300}
                    initialFilters={{
                        timePeriod: '1Y',
                        wallets: walletAddresses,
                        timeUnit: 'month',
                    }}
                />
            </div>

            {/* Average rolling annual returns */}
            <div className={styles.stableCoinChart}>
                <AverageRollingAnnualReturn
                    minHeight={300}
                    initialFilters={{
                        timePeriod: '1Y',
                        wallets: walletAddresses,
                        timeUnit: 'month',
                    }}
                />
            </div>

            {/* Profit and loss */}
            <div className={styles.stableCoinChart}>
                <PnLChart
                    minHeight={300}
                    initialWallets={walletAddresses}
                />
            </div>

            {/* Winrate */}
            <div className={styles.stableCoinChart}>
                <h3>Winrate Chart</h3>
                <p>Temporary placeholder for winrate percentage visualization</p>
            </div>

            {/* Maximum drawdown */}
            <div className={styles.stableCoinChart}>
                <h3>Maximum Drawdown Chart</h3>
                <p>Temporary placeholder for maximum drawdown analysis</p>
            </div>
        </div>
    );
}