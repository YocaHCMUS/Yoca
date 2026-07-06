import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import ProfileLoadingState from "@/components/profile/shared/ProfileLoadingState";
import { FilterType, SortType, Table } from "@/components/tables/Table";
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

  const swapTableData = swapRows.map((row) => [
    row.walletLabel,
    row.timestamp,
    row.pairOrToken,
    row.exchange ?? tr("profileTabs.activity.unknownExchange"),
    row.amountUsd,
  ]);

  const transferTableData = transferRows.map((row) => [
    row.fromAddress ?? row.walletId,
    row.toAddress ?? row.walletId,
    row.tokenSymbol ?? row.pairOrToken,
    row.amount ?? 0,
    row.amountUsd,
    row.timestamp,
  ]);

  const swapTableHeaders = [
    tr("profileTabs.activity.tableHeaders.swaps.wallet"),
    tr("profileTabs.activity.tableHeaders.swaps.pair"),
    tr("profileTabs.activity.tableHeaders.swaps.exchange"),
    tr("profileTabs.activity.tableHeaders.swaps.time"),
    tr("profileTabs.activity.tableHeaders.swaps.totalValue"),
  ];

  const transferTableHeaders = [
    tr("walletPage.sender"),
    tr("walletPage.receiver"),
    tr("walletPage.token"),
    tr("walletPage.amount"),
    tr("walletPage.value"),
    tr("walletPage.time"),
  ];

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
        <Table
          title={tr("profileTabs.activity.swapsTableTitle") as string}
          headers={swapTableHeaders}
          initialFilters={{}}
          fetcher={Promise.resolve([])}
          filterSchema={{
            0: { type: FilterType.Select },
            1: { type: FilterType.Select },
            2: { type: FilterType.Select },
            3: { type: FilterType.Select },
            4: { type: FilterType.Range, min: 0, max: 1000000, step: 100 },
          }}
          dataEntries={swapTableData}
          cellRenderers={[
            null,
            (value) => new Date(String(value)).toLocaleString(),
            null,
            null,
            (value) => fmt.num.compact.currency(Number(value)),
          ]}
          isSortable={[true, true, true, true, true]}
          sortConfigs={{
            1: { type: SortType.Date },
            4: { type: SortType.Number },
          }}
          loading={loading}
          wrapperClassName={styles.activityTableSurface}
        />
      ) : (
        renderEmptyState(
          "Swap activity",
          "No swaps yet",
          "Your recent swap activity will appear here once linked wallets begin trading.",
        )
      )}

      {transferRows.length > 0 ? (
        <Table
          title={tr("profileTabs.activity.transfersTableTitle") as string}
          headers={transferTableHeaders}
          initialFilters={{}}
          fetcher={Promise.resolve([])}
          filterSchema={{
            0: { type: FilterType.Select },
            1: { type: FilterType.Select },
            2: { type: FilterType.Select },
            3: { type: FilterType.Range, min: 0, max: 1000000, step: 0.000001 },
            4: { type: FilterType.Range, min: 0, max: 1000000, step: 0.01 },
            5: { type: FilterType.Select },
          }}
          dataEntries={transferTableData}
          cellRenderers={[
            (value) => {
              const address = String(value);
              const isLinked = linkedWalletAddressSet.has(address.toLowerCase());

              return (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {fmt.text.address(address)}
                  {isLinked ? (
                    <Link
                      size={16}
                      title="Linked wallet"
                      aria-label="Linked wallet"
                    />
                  ) : null}
                </span>
              );
            },
            (value) => {
              const address = String(value);
              const isLinked = linkedWalletAddressSet.has(address.toLowerCase());

              return (
                <span
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {fmt.text.address(address)}
                  {isLinked ? (
                    <Link
                      size={16}
                      title="Linked wallet"
                      aria-label="Linked wallet"
                    />
                  ) : null}
                </span>
              );
            },
            null,
            (value) =>
              Number(value).toLocaleString(undefined, {
                maximumFractionDigits: 6,
              }),
            (value) => fmt.num.compact.currency(Number(value)),
            (value) => new Date(String(value)).toLocaleString(),
          ]}
          isSortable={[true, true, true, true, true, true]}
          sortConfigs={{
            3: { type: SortType.Number },
            4: { type: SortType.Number },
            5: { type: SortType.Date },
          }}
          loading={loading}
          wrapperClassName={styles.activityTableSurface}
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
