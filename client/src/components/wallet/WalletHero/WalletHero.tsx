import React from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { WalletOverviewMultiPeriodResponse, WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import styles from "./WalletHero.module.scss";
import { TrendNum } from "@/components/TrendNum";
import TrendNumWithSign from "@/components/TrendNumWithSign";

interface WalletHeroProps {
  overview: WalletOverviewMultiPeriodResponse | null;
  selectedPeriod: WalletOverviewPeriodKey;
  loading: boolean;
  actions?: React.ReactNode;
}

export function WalletHero({ overview, selectedPeriod, actions }: WalletHeroProps) {
  const { tr, fmt } = useLocalization();

  const selectedStats = overview?.periods?.[selectedPeriod] ?? null;
  const holdings = overview?.holdings ?? null;

  const totalAssetValue = holdings?.totalAssetValueUsd ?? overview?.totalAssetValueUsd ?? null;
  const totalPnL = selectedStats?.pnl?.totalUsd ?? overview?.pnlUsdTotal ?? null;
  const pnlRealized = selectedStats?.pnl?.realizedUsd ?? null;
  const pnlUnrealized = selectedStats?.pnl?.unrealizedUsd ?? null;
  const tradingVolume = selectedStats?.tradingVolumeUsd ?? overview?.tradingVolumeUsd24h ?? null;
  const buyVolumeUsd = selectedStats?.buy?.volumeUsd ?? null;
  const sellVolumeUsd = selectedStats?.sell?.volumeUsd ?? null;
  const buyTxCount = selectedStats?.buy?.transactionCount ?? null;
  const sellTxCount = selectedStats?.sell?.transactionCount ?? null;
  const tokenTraded = selectedStats?.tokensTradedCount ?? overview?.tokensTradedCount ?? null;
  const numberOfTokenHolding = holdings?.tokensHoldingCount ?? overview?.tokensHoldingCount ?? null;

  const formatVal = (v: number | null): string => {
    if (v == null || !Number.isFinite(v)) return "\u2014";
    return fmt.num.currency(v);
  };

  const formatCount = (v: number | null): string => {
    if (v == null || !Number.isFinite(v)) return "\u2014";
    return fmt.num.compact.unit(v, "");
  };

  return (
    <div className={styles.hero}>
      {actions && <div className={styles.heroActions}>{actions}</div>}
      {/* Column 1: Portfolio Value */}
      <div className={styles.cell}>
        <div className={styles.label}>{tr("wallet.totalAssetValue")}</div>
        <div className={styles.mainValue}>{formatVal(totalAssetValue)}</div>
        <div className={styles.subRow}>
          {pnlUnrealized != null && Number.isFinite(pnlUnrealized) && totalAssetValue != null && totalAssetValue > 0 && (
            <TrendNum
              value={(pnlUnrealized / totalAssetValue) * 100}
              prefixes="arrow"
              formatter={fmt.num.percent}
            />
          )}
        </div>
        <div className={styles.spacer} />
        <div className={styles.footer}>
          <span>{formatCount(numberOfTokenHolding)} {tr("wallet.tokensHolding")}</span>
          <span className={styles.dot}>·</span>
          <span>{formatCount(tokenTraded)} {tr("wallet.tokensTraded")}</span>
        </div>
      </div>

      {/* Column 2: Profit & Loss */}
      <div className={styles.cell}>
        <div className={styles.label}>{tr("wallet.totalPnL")}</div>
        <div className={styles.mainValue}>
          <TrendNum
            value={totalPnL}
            prefixes="arrow"
            formatter={(v) => fmt.num.currency(v ?? 0)}
          />
        </div>
        <div className={styles.spacer} />
        <div className={styles.footer}>
          <span className={styles.footerLabel}>{tr("wallet.realizedPnL")}</span>
          <TrendNum
            value={pnlRealized}
            prefixes="arrow"
            formatter={formatVal}
          />
          <span className={styles.dot}>·</span>
          <span className={styles.footerLabel}>{tr("wallet.unrealizedPnL")}</span>
          <TrendNum
            value={pnlUnrealized}
            prefixes="arrow"
            formatter={formatVal}
          />
        </div>
      </div>

      {/* Column 3: Trading Activity */}
      <div className={styles.cell}>
        <div className={styles.label}>{tr("wallet.tradingVolume")}</div>
        <div className={styles.mainValue}>{formatVal(tradingVolume)}</div>
        <div className={styles.subRow}>
          <TrendNum value={buyVolumeUsd} prefixes="none" formatter={formatVal} /> {tr("walletPage.buy")}
          <span className={styles.dot}>·</span>
          <TrendNumWithSign forceSign="negative" value={sellVolumeUsd} prefixes="none" formatter={formatVal} /> {tr("walletPage.sell")}
        </div>
        <div className={styles.spacer} />
        <div className={styles.footer}>
          <span className={styles.subLabel}>{tr("walletPage.transaction")}: </span>
          <TrendNumWithSign forceSign="positive" value={buyTxCount} prefixes="none" formatter={formatCount} /> <span>{tr("walletPage.buy")}</span>
          <span className={styles.dot}>·</span>
          <TrendNumWithSign forceSign="negative" value={sellTxCount} prefixes="none" formatter={formatCount} /> <span>{tr("walletPage.sell")}</span>
        </div>
      </div>
    </div>
  );
}

export default WalletHero;
