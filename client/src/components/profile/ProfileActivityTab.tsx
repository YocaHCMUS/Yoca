import { FilterType, SortType, Table } from "@/components/tables/Table";
import { SwapDetailModal } from "@/components/wallet/SwapDetailModal/SwapDetailModal";
import WalletOverviewPnLSection from "@/components/wallet/WalletOverview/WalletOverviewPnLSection";
import WalletOverviewTradingSection from "@/components/wallet/WalletOverview/WalletOverviewTradingSection";
import WalletOverviewValueSection from "@/components/wallet/WalletOverview/WalletOverviewValueSection";
import { Copy } from "@carbon/react/icons";
import { useMemo, useState } from "react";
import styles from "./profile.module.scss";
import { useProfileActivityTabData } from "@/hooks/profile/useProfileActivityTabData";
import type { TimePeriod } from "@/types/chart-filters.types";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import type { WalletSwap } from "@/services/wallet/walletApi";
import { useLocalization } from "@/contexts/LocalizationContext";

interface ProfileActivityTabProps {
    walletAddresses: string[];
    period: TimePeriod;
}

function formatAddress(address: string): string {
    if (address.length <= 10) {
        return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ProfileActivityTab({ walletAddresses, period }: ProfileActivityTabProps) {
    const { tr, fmt } = useLocalization();
    const { data, loading, error } = useProfileActivityTabData({ walletAddresses, period });
    const [swapModalOpen, setSwapModalOpen] = useState(false);
    const [selectedSwap, setSelectedSwap] = useState<WalletSwap | null>(null);

    const visibleRows = useMemo(
        () => data.swapTransferRows,
        [data.swapTransferRows],
    );

    const visibleCards = useMemo(
        () => data.walletCards,
        [data.walletCards],
    );

    const swapRows = useMemo(
        () => visibleRows.filter((row) => row.type === "swap"),
        [visibleRows],
    );

    const transferRows = useMemo(
        () => visibleRows.filter((row) => row.type === "transfer"),
        [visibleRows],
    );

    const swapsRaw = useMemo(() => data.swapsRaw ?? [], [data.swapsRaw]);

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
        row.tokenSymbol ?? row.pairOrToken,
        row.amount ?? 0,
        row.amountUsd,
        row.timestamp,
    ]);

    const swapTableHeaders = [
        tr("profileTabs.activity.tableHeaders.swaps.0"),
        tr("profileTabs.activity.tableHeaders.swaps.1"),
        tr("profileTabs.activity.tableHeaders.swaps.2"),
        tr("profileTabs.activity.tableHeaders.swaps.3"),
        tr("profileTabs.activity.tableHeaders.swaps.4"),
    ]

    const transferTableHeaders = [
        tr("profileTabs.activity.tableHeaders.transfers.0"),
        tr("profileTabs.activity.tableHeaders.transfers.1"),
        tr("profileTabs.activity.tableHeaders.transfers.2"),
        tr("profileTabs.activity.tableHeaders.transfers.3"),
    ]

    return (
        <section className={styles.contentStack}>
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
                    (value) => fmt.num.currency(Number(value)),
                ]}
                isSortable={[true, true, true, true, true]}
                sortConfigs={{
                    1: { type: SortType.Date },
                    4: { type: SortType.Number },
                }}
                onRowClick={(_, rowIndex) => {
                    const swap = swapsRaw[rowIndex >= 0 ? rowIndex : -1];
                    if (!swap) {
                        return;
                    }

                    setSelectedSwap(swap);
                    setSwapModalOpen(true);
                }}
                loading={loading}
            />

            <Table
                title={tr("profileTabs.activity.transfersTableTitle") as string}
                headers={transferTableHeaders}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{
                    0: { type: FilterType.Select },
                    1: { type: FilterType.Range, min: 0, max: 1000000, step: 0.000001 },
                    2: { type: FilterType.Range, min: 0, max: 1000000, step: 0.01 },
                    3: { type: FilterType.Select },
                }}
                dataEntries={transferTableData}
                cellRenderers={[
                    null,
                    (value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 }),
                    (value) => fmt.num.currency(Number(value)),
                    (value) => new Date(String(value)).toLocaleString(),
                ]}
                isSortable={[true, true, true, true]}
                sortConfigs={{
                    1: { type: SortType.Number },
                    2: { type: SortType.Number },
                    3: { type: SortType.Date },
                }}
                loading={loading}
            />

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
                                        {formatAddress(card.walletAddress)}
                                    </a>
                                    {/* <CopyButton 
                                        onClick={() => navigator.clipboard.writeText(card.walletAddress)}
                                        title="Copy address"
                                        
                                        /> */}
                                    <button
                                        type="button"
                                        className={styles.copyAddressButton}
                                        onClick={() => navigator.clipboard.writeText(card.walletAddress)}
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
            {/* 
            <div className={styles.sectionCard}>
                <ProfileTradeFrequencyHeatmap
                    cells={data.heatmap.cells}
                    maxCount={data.heatmap.maxCount}
                    minHeight={320}
                />
            </div> */}

            <SwapDetailModal
                isOpen={swapModalOpen}
                onClose={() => setSwapModalOpen(false)}
                swap={selectedSwap}
            />
        </section>
    );
}

export default ProfileActivityTab;
