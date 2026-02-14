import React from 'react';
import type WalletComparisionProp from "./WalletComparisionProp";
import { PnLChart } from '@/components/charts/PnLChart';
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
                <h3>Rolling Annual Returns Chart</h3>
                <p>Temporary placeholder for rolling annual returns visualization</p>
            </div>

            {/* Average rolling annual returns */}
            <div className={styles.stableCoinChart}>
                <h3>Average Rolling Annual Returns Chart</h3>
                <p>Temporary placeholder for average rolling returns analysis</p>
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