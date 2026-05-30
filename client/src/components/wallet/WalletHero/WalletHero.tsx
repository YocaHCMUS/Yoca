import React from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { WalletOverviewMultiPeriodResponse, WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import { PeriodSelector } from "@/components/common/PeriodSelector/PeriodSelector";
import { PERIOD_OPTIONS } from "@/config/periodOptions";
import styles from "./WalletHero.module.scss";
import { TrendNum } from "@/components/TrendNum";
import TrendNumWithSign from "@/components/TrendNumWithSign";

interface WalletHeroProps {
  overview: WalletOverviewMultiPeriodResponse | null;
  selectedPeriod: WalletOverviewPeriodKey;
  loading: boolean;
  onPeriodChange: (period: WalletOverviewPeriodKey) => void;
}

export function WalletHero({ overview, selectedPeriod, loading, onPeriodChange }: WalletHeroProps) {
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

  // 24h change approximation
  const period24h = overview?.periods?.["24H"];
  const period24hPnl = period24h?.pnl?.totalUsd ?? null;

  const formatVal = (v: number | null): string => {
    if (v == null || !Number.isFinite(v)) return "—";
    return fmt.num.currency(v);
  };

  return (
    <>
      <div className={styles.heroHeader}>
        <h2 className={styles.heroTitle}>{tr('walletPage.overview')}</h2>
        <PeriodSelector
          value={selectedPeriod}
          onChange={(key) => onPeriodChange(key as WalletOverviewPeriodKey)}
          options={PERIOD_OPTIONS}
          compact
        />
      </div>
      <div className={styles.hero}>
        {/* Total Value */}
        <div className={styles.heroCell}>
          <div className={styles.heroLabel}>{tr('wallet.totalAssetValue')}</div>
          <div className={styles.heroVal}>{formatVal(totalAssetValue)}</div>
          {pnlUnrealized != null && Number.isFinite(pnlUnrealized) && totalAssetValue != null && totalAssetValue > 0 && (
            <div className={styles.heroSub}>
              <TrendNum
                value={((pnlUnrealized / totalAssetValue) * 100)}
                prefixes="arrow"
                formatter={fmt.num.percent}
              />
            </div>
          )}
        </div>

        {/* Total PnL */}
        <div className={styles.heroCell}>
          <div className={styles.heroLabel}>
            {tr('wallet.totalPnL')}
            {/* <Tooltip label={tr('wallet.totalPnLTooltip')} align="bottom">
            <Information size={12} className={styles.infoIcon} />
          </Tooltip> */}
          </div>
          <TrendNum
            value={totalPnL}
            prefixes="plus-minus"
            formatter={(v) => fmt.num.currency(v ?? 0)}
          />
          <div className={styles.subSectionRow}>
            <div className={styles.subSectionHalf}>
              <div className={styles.subSectionHalfLabel}>
                {tr('wallet.realizedPnL')}
                {/* <Tooltip label={tr('wallet.realizedPnLTooltip')} align="bottom">
                <Information size={10} className={styles.infoIconSm} />
              </Tooltip> */}
              </div>
              <TrendNum
                value={pnlRealized}
                prefixes="none"
                formatter={formatVal}
              />
            </div>
            <div className={styles.subSectionHalf}>
              <div className={styles.subSectionHalfLabel}>
                {tr('wallet.unrealizedPnL')}
                {/* <Tooltip label={tr('wallet.unrealizedPnLTooltip')} align="bottom">
                <Information size={10} className={styles.infoIconSm} />
              </Tooltip> */}
              </div>
              <TrendNum
                value={pnlUnrealized}
                prefixes="none"
                formatter={formatVal}
              />
            </div>
          </div>
        </div>

        {/* Trading Volume */}
        <div className={styles.heroCell}>
          <div className={styles.heroLabel}>{tr('wallet.tradingVolume')}</div>
          <div className={styles.heroVal}>{formatVal(tradingVolume)}</div>
          <div className={styles.heroSub}>
            <TrendNum value={buyVolumeUsd} prefixes="none" formatter={formatVal} /> {tr('walletPage.buy')}
            <span className={styles.heroDot}>·</span>
            <TrendNumWithSign forceSign="negative" value={sellVolumeUsd} prefixes="none" formatter={formatVal} /> {tr('walletPage.sell')}
          </div>
        </div>

        {/* Activity */}
        <div className={styles.heroCell}>
          <div className={styles.heroLabel}>{tr('walletPage.activity')}</div>
          <div className={styles.heroVal}>
            <TrendNumWithSign forceSign="positive" value={buyTxCount} prefixes="none" formatter={(v) => v != null && Number.isFinite(v) ? fmt.num.compact.unit(v, "") : "—"} /> /{" "}
            <TrendNumWithSign forceSign="negative" value={sellTxCount} prefixes="none" formatter={(v) => v != null && Number.isFinite(v) ? fmt.num.compact.unit(v, "") : "—"} />
            {/* {buyTxCount != null && Number.isFinite(buyTxCount) ? buyTxCount : "—"} /{" "}
          {sellTxCount != null && Number.isFinite(sellTxCount) ? sellTxCount : "—"} */}
          </div>
          <div className={styles.heroSubSub}>
            <span className={styles.heroSubText}>
              {tr('walletPage.buy')} / {tr('walletPage.sell')}
            </span>
          </div>
          <div className={styles.subSectionRow}>
            <div className={styles.subSectionHalf}>
              <div className={styles.subSectionHalfLabel}>{tr('wallet.tokensTraded')}</div>
              {tokenTraded != null && Number.isFinite(tokenTraded) ? tokenTraded : "—"}
            </div>
            <div className={styles.subSectionHalf}>
              <div className={styles.subSectionHalfLabel}>{tr('wallet.tokensHolding')}</div>
              {numberOfTokenHolding != null && Number.isFinite(numberOfTokenHolding) ? numberOfTokenHolding : "—"}
            </div>
          </div>
        </div>
        {/* <div className={styles.heroMeta}>
          <span className={styles.heroSubText}>
            {tokenTraded != null && Number.isFinite(tokenTraded) ? tokenTraded : "—"} {tr('wallet.tokensTraded')}
          </span>
          <span className={styles.heroDot}>·</span>
          <span className={styles.heroSubText}>
            {numberOfTokenHolding != null && Number.isFinite(numberOfTokenHolding) ? numberOfTokenHolding : "—"} {tr('wallet.tokensHolding')}
          </span>
        </div>
      </div> */}
      </div>
    </>
  );
}

export default WalletHero;
