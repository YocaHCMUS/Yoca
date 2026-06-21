import { Flex } from "@/components/Flex";
import { TrendNum } from "@/components/TrendNum";
import TrendNumWithSign from "@/components/TrendNumWithSign";
import { Txt } from "@/components/Txt";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { WalletWinrateStats } from "@/hooks/useWalletWinrate";
import type {
  WalletOverviewMultiPeriodResponse,
  WalletOverviewPeriodKey,
} from "@/services/wallet/walletApi";
import { cds } from "@/util/carbon-theme";
import { Column, Grid } from "@carbon/react";
import styles from "./WalletHero.module.scss";

interface WalletHeroProps {
  overview: WalletOverviewMultiPeriodResponse | null;
  selectedPeriod: WalletOverviewPeriodKey;
  loading: boolean;
  winRateStats: WalletWinrateStats | null;
  winRateLoading: boolean;
}

export function WalletHero({
  overview,
  selectedPeriod,
  winRateStats,
  winRateLoading,
}: WalletHeroProps) {
  const { tr, fmt } = useLocalization();

  const selectedStats = overview?.periods?.[selectedPeriod] ?? null;
  const holdings = overview?.holdings ?? null;

  const totalAssetValue =
    holdings?.totalAssetValueUsd ?? overview?.totalAssetValueUsd ?? null;
  const totalPnL =
    selectedStats?.pnl?.totalUsd ?? overview?.pnlUsdTotal ?? null;
  const pnlRealized = selectedStats?.pnl?.realizedUsd ?? null;
  const pnlUnrealized = selectedStats?.pnl?.unrealizedUsd ?? null;
  const tradingVolume =
    selectedStats?.tradingVolumeUsd ?? overview?.tradingVolumeUsd24h ?? null;
  const buyVolumeUsd = selectedStats?.buy?.volumeUsd ?? null;
  const sellVolumeUsd = selectedStats?.sell?.volumeUsd ?? null;
  const buyTxCount = selectedStats?.buy?.transactionCount ?? null;
  const sellTxCount = selectedStats?.sell?.transactionCount ?? null;
  const tokenTraded =
    selectedStats?.tokensTradedCount ?? overview?.tokensTradedCount ?? null;
  const numberOfTokenHolding =
    holdings?.tokensHoldingCount ?? overview?.tokensHoldingCount ?? null;
  const safeWinRate = Math.max(0, Math.min(100, winRateStats?.winRate ?? 0));
  const hasWinRateStats =
    winRateStats !== null && Number.isFinite(winRateStats.winRate);
  const isHighWinRate = safeWinRate >= 50;

  const formatVal = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) return "\u2014";
    return fmt.num.currency(value);
  };

  const formatCompactCurrency = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) return "\u2014";
    return fmt.num.compact.currency(value);
  };

  const formatCount = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) return "\u2014";
    return fmt.num.compact.unit(value, "");
  };

  return (
    <Grid fullWidth condensed className={styles.hero}>
      <Column sm={4} md={4} lg={4} max={4} className={styles.cell}>
        <Flex
          dir="column"
          gap={2}
          pBlock={8}
          pInline={10}
          className={styles.cellContent}
        >
          <Txt
            size="sm"
            secondary
            uppercase
            weight="medium"
            className={styles.label}
          >
            {tr("walletPage.tokenWinRate.title")}
          </Txt>
          <Txt
            block
            weight="semibold"
            className={styles.mainValue}
            style={{
              color: isHighWinRate ? cds.supportSuccess : cds.supportError,
              fontSize: "1.25rem",
            }}
          >
            {winRateLoading || !hasWinRateStats
              ? "\u2014"
              : fmt.num.percent(safeWinRate)}
          </Txt>
          <Flex
            className={styles.winRateProgress}
            aria-hidden="true"
            inlineSize="100%"
          >
            <div
              className={styles.winRateProgressWin}
              style={{
                width: `${winRateLoading || !hasWinRateStats ? 0 : safeWinRate}%`,
              }}
            />
            <div
              className={styles.winRateProgressLoss}
              style={{
                width: `${winRateLoading || !hasWinRateStats ? 0 : 100 - safeWinRate}%`,
              }}
            />
          </Flex>
          <Txt size="sm" secondary ellipsis>
            {winRateLoading || !winRateStats
              ? "\u2014"
              : tr("walletPage.tokenWinRate.summaryShort", {
                  win: formatCount(winRateStats.winCount),
                  tradedCount: formatCount(winRateStats.totalTraded),
                })}
          </Txt>
          <div className={styles.spacer} />
          <Flex align="center" wrap="wrap" gap={2.5} className={styles.footer}>
            <Txt size="sm" secondary>
              {tr("walletPage.tokenWinRate.avgWin")}
            </Txt>
            <TrendNum
              value={winRateLoading ? null : (winRateStats?.avgWinUsd ?? null)}
              direction="in"
              prefixes="plus-minus"
              size="sm"
              formatter={formatCompactCurrency}
            />
            <span className={styles.dot}>·</span>
            <Txt size="sm" secondary>
              {tr("walletPage.tokenWinRate.avgLoss")}
            </Txt>
            <TrendNum
              value={winRateLoading ? null : (winRateStats?.avgLossUsd ?? null)}
              direction="out"
              prefixes="plus-minus"
              size="sm"
              formatter={formatCompactCurrency}
            />
          </Flex>
        </Flex>
      </Column>

      <Column sm={4} md={4} lg={4} max={4} className={styles.cell}>
        <Flex
          dir="column"
          gap={2}
          pBlock={8}
          pInline={10}
          className={styles.cellContent}
        >
          <Txt
            size="sm"
            secondary
            uppercase
            weight="medium"
            className={styles.label}
          >
            {tr("wallet.totalAssetValue")}
          </Txt>
          <Txt
            block
            weight="semibold"
            className={styles.mainValue}
            style={{ fontSize: "1.25rem" }}
          >
            {formatVal(totalAssetValue)}
          </Txt>
          <Flex align="center" wrap="wrap" gap={3} className={styles.subRow}>
            {pnlUnrealized != null &&
              Number.isFinite(pnlUnrealized) &&
              totalAssetValue != null &&
              totalAssetValue > 0 && (
                <TrendNum
                  value={(pnlUnrealized / totalAssetValue) * 100}
                  prefixes="arrow"
                  formatter={fmt.num.percent}
                />
              )}
          </Flex>
          <div className={styles.spacer} />
          <Flex align="center" wrap="wrap" gap={2.5} className={styles.footer}>
            <Txt size="sm" secondary>
              {formatCount(numberOfTokenHolding)} {tr("wallet.tokensHolding")}
            </Txt>
            <span className={styles.dot}>·</span>
            <Txt size="sm" secondary>
              {formatCount(tokenTraded)} {tr("wallet.tokensTraded")}
            </Txt>
          </Flex>
        </Flex>
      </Column>

      <Column sm={4} md={4} lg={4} max={4} className={styles.cell}>
        <Flex
          dir="column"
          gap={2}
          pBlock={8}
          pInline={10}
          className={styles.cellContent}
        >
          <Txt
            size="sm"
            secondary
            uppercase
            weight="medium"
            className={styles.label}
          >
            {tr("wallet.totalPnL")}
          </Txt>
          <div className={styles.mainValue}>
            <TrendNum
              value={totalPnL}
              prefixes="arrow"
              formatter={(value) => fmt.num.currency(value ?? 0)}
            />
          </div>
          <div className={styles.spacer} />
          <Flex align="center" wrap="wrap" gap={2.5} className={styles.footer}>
            <Txt size="sm" secondary>
              {tr("wallet.realizedPnL")}
            </Txt>
            <TrendNum
              value={pnlRealized}
              prefixes="arrow"
              formatter={formatVal}
            />
            <span className={styles.dot}>·</span>
            <Txt size="sm" secondary>
              {tr("wallet.unrealizedPnL")}
            </Txt>
            <TrendNum
              value={pnlUnrealized}
              prefixes="arrow"
              formatter={formatVal}
            />
          </Flex>
        </Flex>
      </Column>

      <Column sm={4} md={4} lg={4} max={4} className={styles.cell}>
        <Flex
          dir="column"
          gap={2}
          pBlock={8}
          pInline={10}
          className={styles.cellContent}
        >
          <Txt
            size="sm"
            secondary
            uppercase
            weight="medium"
            className={styles.label}
          >
            {tr("wallet.tradingVolume")}
          </Txt>
          <Txt
            block
            weight="semibold"
            className={styles.mainValue}
            style={{ fontSize: "1.25rem" }}
          >
            {formatVal(tradingVolume)}
          </Txt>
          <Flex align="center" wrap="wrap" gap={3} className={styles.subRow}>
            <TrendNum
              value={buyVolumeUsd}
              prefixes="none"
              formatter={formatVal}
            />
            <Txt size="sm" secondary>
              {tr("walletPage.buy")}
            </Txt>
            <span className={styles.dot}>·</span>
            <TrendNumWithSign
              forceSign="negative"
              value={sellVolumeUsd}
              prefixes="none"
              formatter={formatVal}
            />
            <Txt size="sm" secondary>
              {tr("walletPage.sell")}
            </Txt>
          </Flex>
          <div className={styles.spacer} />
          <Flex align="center" wrap="wrap" gap={2.5} className={styles.footer}>
            <Txt size="sm" secondary>
              {tr("walletPage.transaction")}:
            </Txt>
            <TrendNumWithSign
              forceSign="positive"
              value={buyTxCount}
              prefixes="none"
              formatter={formatCount}
            />
            <Txt size="sm" secondary>
              {tr("walletPage.buy")}
            </Txt>
            <span className={styles.dot}>·</span>
            <TrendNumWithSign
              forceSign="negative"
              value={sellTxCount}
              prefixes="none"
              formatter={formatCount}
            />
            <Txt size="sm" secondary>
              {tr("walletPage.sell")}
            </Txt>
          </Flex>
        </Flex>
      </Column>
    </Grid>
  );
}

export default WalletHero;
