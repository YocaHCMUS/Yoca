import { DrawdownChart } from "@/components/charts/Drawdown";
import { PnLChart } from "@/components/charts/PnLChart";
import { WinrateChart } from "@/components/charts/Winrate";
import RollingProfitAndLoss from "@/components/charts/RollingProfitAndLoss/RollingProfitAndLoss";
import React from "react";
import styles from "./GeneralTab.module.scss";
import type WalletComparisonProp from "./WalletComparisonProp";
import { AiGenerate } from '@carbon/icons-react';
import { IconButton } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";

export const RiskTab: React.FC<WalletComparisonProp> = ({
  walletAddresses,
  fetchEnabled = true,
  onDayClick,
  onAiAction,
}) => {
  const { tr } = useLocalization();
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
      <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
        <RollingProfitAndLoss
          minHeight={300}
          initialFilters={{
            timePeriod: "30D",
            wallets: walletAddresses,
          }}
          fetchEnabled={fetchEnabled}
          actions={onAiAction ? (
            <IconButton kind="ghost" size="sm" label="AI" align="bottom"
              onClick={(e) => onAiAction(e, tr("charts.rollingAnnualReturn.title"), ["comparePnl"])}>
              <AiGenerate size={16} />
            </IconButton>
          ) : undefined}
        />
      </div>

      {/* Average rolling annual returns */}
      {/* <div className={styles.stableCoinChart}>
                <AverageRollingAnnualReturn
                    minHeight={300}
                    initialFilters={{
                        timePeriod: '1Y',
                        wallets: walletAddresses,
                        timeUnit: 'month',
                    }}
                />
            </div> */}

      {/* Profit and loss */}
      <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
        <PnLChart minHeight={300} initialWallets={walletAddresses} fetchEnabled={fetchEnabled} onDayClick={onDayClick}
          actions={onAiAction ? (
            <IconButton kind="ghost" size="sm" label="AI" align="bottom"
              onClick={(e) => onAiAction(e, tr("charts.pnlChart.title"), ["comparePnl"])}>
              <AiGenerate size={16} />
            </IconButton>
          ) : undefined}
        />
      </div>

      {/* Winrate */}
      <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
        <WinrateChart
          minHeight={300}
          initialFilters={{
            timePeriod: '30D',
            wallets: walletAddresses,
          }}
          actions={onAiAction ? (
            <IconButton kind="ghost" size="sm" label="AI" align="bottom"
              onClick={(e) => onAiAction(e, tr("charts.winrateChart.title"), ["comparePnl", "topPerformer"])}>
              <AiGenerate size={16} />
            </IconButton>
          ) : undefined}
        />
      </div>

      {/* Maximum drawdown */}
      <div className={`${styles.stableCoinChart} ${PDF_EXPORT_SECTION_CLASS}`}>
        <DrawdownChart
          minHeight={300}
          initialFilters={{
            timePeriod: "30D",
            wallets: walletAddresses,
          }}
          fetchEnabled={fetchEnabled}
          actions={onAiAction ? (
            <IconButton kind="ghost" size="sm" label="AI" align="bottom"
              onClick={(e) => onAiAction(e, tr("charts.drawdownChart.title"), ["riskComparison"])}>
              <AiGenerate size={16} />
            </IconButton>
          ) : undefined}
        />
      </div>
    </div>
  );
};
