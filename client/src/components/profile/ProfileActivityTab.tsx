import { ProfileTradeFrequencyHeatmap } from "@/components/charts/ProfileTradeFrequencyHeatmap";
import { FilterType, SortType, Table } from "@/components/tables/Table";
import WalletOverviewPnLSection from "@/components/wallet/WalletOverview/WalletOverviewPnLSection";
import WalletOverviewTradingSection from "@/components/wallet/WalletOverview/WalletOverviewTradingSection";
import WalletOverviewValueSection from "@/components/wallet/WalletOverview/WalletOverviewValueSection";
import type { ProfileActivityData } from "@/types/profile";
import { Copy } from "@carbon/react/icons";
import { useMemo } from "react";
import styles from "./profile.module.scss";

interface ProfileActivityTabProps {
    data: ProfileActivityData;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatAddress(address: string): string {
    if (address.length <= 10) {
        return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ProfileActivityTab({
    data,
}: ProfileActivityTabProps) {
    const visibleRows = useMemo(
        () => data.swapTransferRows,
        [data.swapTransferRows],
    );

    const visibleCards = useMemo(
        () => data.walletCards,
        [data.walletCards],
    );

    const activityTableData = visibleRows.map((row) => [
        row.walletLabel,
        row.type,
        row.pairOrToken,
        row.amountUsd,
        row.timestamp,
    ]);

    return (
        <section className={styles.contentStack}>
            <Table
                title="Swaps and transfers"
                headers={["Wallet", "Type", "Pair / token", "Amount", "Time"]}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{
                    0: { type: FilterType.Select },
                    1: { type: FilterType.Select },
                    2: { type: FilterType.Select },
                    3: { type: FilterType.Range, min: 0, max: 1000000, step: 100 },
                }}
                dataEntries={activityTableData}
                cellRenderers={[
                    null,
                    null,
                    null,
                    (value) => formatCurrency(Number(value)),
                    (value) => new Date(String(value)).toLocaleString(),
                ]}
                isSortable={[true, true, true, true, true]}
                sortConfigs={{
                    3: { type: SortType.Number },
                    4: { type: SortType.Date },
                }}
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
        </section>
    );
}

export default ProfileActivityTab;
