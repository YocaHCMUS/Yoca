import React from 'react';
import type WalletComparisionProp from "./WalletComparisionProp";
import { AssetDistribution } from '@/components/charts/AssetDistribution';
import { HoldingDurations } from '@/components/charts/HoldingDurations';
import styles from './GeneralTab.module.scss'; // Assuming we create this
import { BalanceChart } from '@/components/charts/BalanceChart';
import { VolumeBenchmark } from '@/components/charts/VolumeBenchmark';


export const GeneralTab: React.FC<WalletComparisionProp> = ({
    walletAddresses
}) => {
    return (
        <div className={styles.grid}>
            {/* Balance history comparision */}
            <div className={styles.stableCoinChart}>
                <BalanceChart // TODO: update this chart to support multiple wallets
                    minHeight={300}
                    />    
            </div>

            <div className={styles.stableCoinChart}>
                <VolumeBenchmark
                    minHeight={300}
                    />
            </div>

            {/* Daily Trading Volume Historical Chart - Placeholder */}
            <div className={styles.stableCoinChart}>
                <h3>Daily Trading Volume Historical Chart</h3>
                <p>Temporary placeholder for daily trading volume over time visualization</p>
            </div>

            {/* Total Trading Volume Column Chart - Placeholder */}
            <div className={styles.stableCoinChart}>
                <h3>Total Trading Volume Column Chart</h3>
                <p>Temporary placeholder for total trading volume comparison visualization</p>
            </div>

            {/* Trading Volume distribution  Chart - Placeholder */}
            

            {walletAddresses.map((address, index) => (
                <div key={`asset-${index}`} className={styles.chartContainer}>
                    <div className={styles.stableCoinChart}>
                        <h3>Trading Volume Distribution Chart</h3>
                        <p>Temporary placeholder for trading volume distribution analysis</p>
                    </div>
                </div>
            ))}

            {/* Average Trading Volume per transaction Charts */}
            <div className={styles.stableCoinChart}>
                <h3>Average Trading Volume per Transaction Chart</h3>
                <p>Temporary placeholder for average volume per transaction visualization</p>
            </div>

        </div>
    );
}