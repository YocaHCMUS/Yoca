import { AssetDistribution } from "@/components/charts/AssetDistribution";
import { StablecoinRatioChart } from "@/components/charts/StablecoinRatio";
import React from "react";
import styles from "./GeneralTab.module.scss"; // Assuming we create this
import type WalletComparisionProp from "./WalletComparisionProp";

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";

export const HoldingTab: React.FC<WalletComparisionProp> = ({
  walletAddresses,
  fetchEnabled = true,
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
      {/* Asset Distribution Charts */}
      {/* {walletAddresses.map((address, index) => (
            ))} */}
      <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
        <AssetDistribution
          initialFilters={{ wallets: walletAddresses }}
          minHeight={300}
          fetchEnabled={fetchEnabled}
        />
      </div>

      {/* Stable Coin Ratio Chart */}
      <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
        <StablecoinRatioChart
          minHeight={300}
          initialFilters={{
            timePeriod: "30D",
            wallets: walletAddresses,
          }}
          fetchEnabled={fetchEnabled}
        />
      </div>

      {/* <div className={styles.stableCoinChart}>
                <HoldingDurations
                    initialFilters={{
                        wallets: [walletAddresses],
                        topN: 10,
                        timeUnit: 'days',
                    }}
                    minHeight={300}
                />
            </div> */}
    </div>
  );
};
