import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import ProfileLoadingState from "@/components/profile/shared/ProfileLoadingState";
import Tble, { TbleFilterType, TbleSortType, type TblRw } from "@/components/Tble";
import WalletOverviewPnLSection from "@/components/wallet/WalletOverview/WalletOverviewPnLSection";
import WalletOverviewTradingSection from "@/components/wallet/WalletOverview/WalletOverviewTradingSection";
import WalletOverviewValueSection from "@/components/wallet/WalletOverview/WalletOverviewValueSection";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useProfileActivityTabData } from "@/hooks/profile/useProfileActivityTabData";
import type { TimePeriod } from "@/types/chart-filters.types";
import { Copy, Link } from "@carbon/react/icons";
import { useMemo } from "react";
import styles from "@/components/profile/shared/profile.module.scss";

interface ProfileActivityTabProps {
  walletAddresses: string[];
  period: TimePeriod;
}

export function ProfileActivityTab({
  walletAddresses,
  period,
}: ProfileActivityTabProps) {
  const { tr, fmt } = useLocalization();
  const { data, loading, error } = useProfileActivityTabData({
    walletAddresses,
    period,
  });
  const linkedWalletAddressSet = useMemo(
    () => new Set(walletAddresses.map((address) => address.toLowerCase())),
    [walletAddresses],
  );

  const visibleRows = useMemo(
    () => data.swapTransferRows,
    [data.swapTransferRows],
  );

  const visibleCards = useMemo(() => data.walletCards, [data.walletCards]);

  const swapRows = useMemo(
    () => visibleRows.filter((row) => row.type === "swap"),
    [visibleRows],
  );

  const transferRows = useMemo(
    () => visibleRows.filter((row) => row.type === "transfer"),
    [visibleRows],
  );

  const swapTableRows = useMemo(() =>
    swapRows.map((row) => ({
      id: `${row.walletId}-${row.timestamp}-${row.pairOrToken}`,
      wallet: row.walletLabel,
      pair: row.timestamp,
      exchange: row.pairOrToken,
      time: row.exchange ?? tr("profileTabs.activity.unknownExchange"),
      totalValue: row.amountUsd,
    } as TblRw)),
  [swapRows, tr]);

  const transferTableRows = useMemo(() =>
    transferRows.map((row, i) => ({
      id: `${row.walletId}-${row.timestamp}-${i}`,
      sender: row.fromAddress ?? row.walletId,
      receiver: row.toAddress ?? row.walletId,
      token: row.tokenSymbol ?? row.pairOrToken,
      amount: row.amount ?? 0,
      value: row.amountUsd,
      time: row.timestamp,
    } as TblRw)),
  [transferRows]);

  if (loading) {
    return <ProfileLoadingState />;
  }

  if (error) {
    return (
      <ProfileUnavailableState
        title={tr("profileTabs.activity.unavailableTitle")}
        description={tr("profileTabs.activity.unavailableDescription")}
      />
    );
  }

  const renderEmptyState = (
    eyebrow: string,
    title: string,
    description: string,
  ) => (
    <div className={`${styles.sectionCard} ${styles.tableEmptyState}`}>
      <span className={styles.tableEmptyEyebrow}>{eyebrow}</span>
      <h3 className={styles.tableEmptyTitle}>{title}</h3>
      <p className={styles.tableEmptyDescription}>{description}</p>
    </div>
  );

  return (
    <section className={styles.contentStack}>
      {swapRows.length > 0 ? (
        <Tble
          title={tr("profileTabs.activity.swapsTableTitle") as string}
          headers={[
            { key: "wallet", header: tr("profileTabs.activity.tableHeaders.swaps.wallet") },
            { key: "pair", header: tr("profileTabs.activity.tableHeaders.swaps.pair") },
            { key: "exchange", header: tr("profileTabs.activity.tableHeaders.swaps.exchange") },
            { key: "time", header: tr("profileTabs.activity.tableHeaders.swaps.time") },
            { key: "totalValue", header: tr("profileTabs.activity.tableHeaders.swaps.totalValue") },
          ]}
          rows={swapTableRows}
          filterSchema={{
            wallet: { type: TbleFilterType.Select },
            pair: { type: TbleFilterType.Select },
            exchange: { type: TbleFilterType.Select },
            time: { type: TbleFilterType.Select },
            totalValue: { type: TbleFilterType.Range, min: 0, max: 1000000, step: 100 },
          }}
          cellRenderers={{
            pair: (value: unknown) => <span>{new Date(String(value)).toLocaleString()}</span>,
            totalValue: (value: unknown) => <span>{fmt.num.compact.currency(Number(value))}</span>,
          }}
          sortConfigs={{
            pair: { type: TbleSortType.Number },
            totalValue: { type: TbleSortType.Number },
          }}
          loading={loading}
          className={styles.activityTableSurface}
        />
      ) : (
        renderEmptyState(
          "Swap activity",
          "No swaps yet",
          "Your recent swap activity will appear here once linked wallets begin trading.",
        )
      )}

      {transferRows.length > 0 ? (
        <Tble
          title={tr("profileTabs.activity.transfersTableTitle") as string}
          headers={[
            { key: "sender", header: tr("walletPage.sender") },
            { key: "receiver", header: tr("walletPage.receiver") },
            { key: "token", header: tr("walletPage.token") },
            { key: "amount", header: tr("walletPage.amount") },
            { key: "value", header: tr("walletPage.value") },
            { key: "time", header: tr("walletPage.time") },
          ]}
          rows={transferTableRows}
          filterSchema={{
            sender: { type: TbleFilterType.Select },
            receiver: { type: TbleFilterType.Select },
            token: { type: TbleFilterType.Select },
            amount: { type: TbleFilterType.Range, min: 0, max: 1000000, step: 0.000001 },
            value: { type: TbleFilterType.Range, min: 0, max: 1000000, step: 0.01 },
            time: { type: TbleFilterType.Select },
          }}
          cellRenderers={{
            sender: (value: unknown) => {
              const address = String(value);
              const isLinked = linkedWalletAddressSet.has(address.toLowerCase());
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {fmt.text.address(address)}
                  {isLinked ? <Link size={16} title="Linked wallet" aria-label="Linked wallet" /> : null}
                </span>
              );
            },
            receiver: (value: unknown) => {
              const address = String(value);
              const isLinked = linkedWalletAddressSet.has(address.toLowerCase());
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {fmt.text.address(address)}
                  {isLinked ? <Link size={16} title="Linked wallet" aria-label="Linked wallet" /> : null}
                </span>
              );
            },
            amount: (value: unknown) => (
              <span>{Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
            ),
            value: (value: unknown) => <span>{fmt.num.compact.currency(Number(value))}</span>,
            time: (value: unknown) => <span>{new Date(String(value)).toLocaleString()}</span>,
          }}
          sortConfigs={{
            amount: { type: TbleSortType.Number },
            value: { type: TbleSortType.Number },
            time: { type: TbleSortType.Number },
          }}
          loading={loading}
          className={styles.activityTableSurface}
        />
      ) : (
        renderEmptyState(
          "Transfer activity",
          "No transfers yet",
          "Incoming and outgoing token transfers will appear here once tracked wallets have on-chain movement.",
        )
      )}

      {visibleCards.length > 0 ? (
        <div className={styles.sectionCard}>
          <div className={styles.cardsGrid}>
            {visibleCards.map((card) => (
              <article key={card.walletId} className={styles.activityCard}>
                <div className={styles.walletCardHeader}>
                  <h4>{card.walletLabel}</h4>
                  <div className={styles.walletMetaActions}>
                    <a
                      href={`/wallets/${card.walletId}`}
                      className={styles.walletAddressLink}
                      title={card.walletAddress}
                    >
                      {fmt.text.address(card.walletAddress)}
                    </a>
                    <button
                      type="button"
                      className={styles.copyAddressButton}
                      onClick={() =>
                        navigator.clipboard.writeText(card.walletAddress)
                      }
                      aria-label={`Copy wallet address for ${card.walletLabel}`}
                      title="Copy address"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                <WalletOverviewValueSection
                  value={card.totalAssetValueUsd}
                  unrealizedPnlInPeriod={card.unrealizedPnlInPeriodUsd}
                  loading={false}
                />
                <WalletOverviewTradingSection
                  tradingVolume={card.tradingVolumeUsd}
                  buyTradingVolume={card.buyTradingVolumeUsd}
                  sellTradingVolume={card.sellTradingVolumeUsd}
                  buyTransactionCount={card.buyTransactionCount}
                  sellTransactionCount={card.sellTransactionCount}
                  tokenAmountTraded={card.tokenAmountTraded}
                  tokenAmountHolding={card.tokenAmountHolding}
                  loading={false}
                />
                <WalletOverviewPnLSection
                  totalPnL={card.totalPnlUsd}
                  realizedPnL={card.realizedPnlUsd}
                  unrealizedPnL={card.unrealizedPnlUsd}
                  loading={false}
                />
              </article>
            ))}
          </div>
        </div>
      ) : (
        renderEmptyState(
          "Wallet snapshots",
          "No wallet summaries yet",
          "Per-wallet value, trading, and PnL snapshots will appear here when linked wallets have tracked activity.",
        )
      )}
      {/* 
            <div className={styles.sectionCard}>
                <ProfileTradeFrequencyHeatmap
                    cells={data.heatmap.cells}
                    maxCount={data.heatmap.maxCount}
                    minHeight={320}
                />
            </div> */}

    </section>
  );
}

export default ProfileActivityTab;
