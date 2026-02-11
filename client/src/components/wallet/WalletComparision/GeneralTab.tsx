import React from 'react';
import type WalletComparisionProp from "./WalletComparisionProp";
import { AssetDistribution } from '@/components/charts/AssetDistribution';
import { HoldingDurations } from '@/components/charts/HoldingDurations';
import styles from './GeneralTab.module.scss'; // Assuming we create this


export const GeneralTab: React.FC<WalletComparisionProp> = ({
    walletAddresses
}) => {
    return (
        <div className={styles.grid}>
            {/* Asset Distribution Charts */}
            {walletAddresses.map((address, index) => (
                <div key={`asset-${index}`} className={styles.chartContainer}>
                    <AssetDistribution
                        initialFilters={{ wallets: [address] }}
                        minHeight={300}
                    />
                </div>
            ))}

            {/* Stable Coin Ratio Chart - Placeholder */}
            <div className={styles.stableCoinChart}>
                <h3>Stable Coin Ratio Chart</h3>
                <p>Temporary placeholder for stable coin ratio visualization</p>
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