import { PROFILE_ACTIVITY_NAV_LABELS } from "@/components/profile/profile.constants";
import type {
    ProfileActivityData,
    ProfileActivityNav,
} from "@/types/profile";
import { Button, Checkbox } from "@carbon/react";
import { useMemo, useState } from "react";
import styles from "./profile.module.scss";

interface ProfileActivityTabProps {
    data: ProfileActivityData;
    selectedWalletIds: string[];
    onSelectedWalletIdsChange: (ids: string[]) => void;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

export function ProfileActivityTab({
    data,
    selectedWalletIds,
    onSelectedWalletIdsChange,
}: ProfileActivityTabProps) {
    const [selectedNav, setSelectedNav] = useState<ProfileActivityNav>(
        data.selectedNav,
    );

    const effectiveSelectedWalletIds =
        selectedWalletIds.length > 0 ? selectedWalletIds : data.selectedWalletIds;

    const visibleRows = useMemo(
        () =>
            data.swapTransferRows.filter((row) =>
                effectiveSelectedWalletIds.includes(row.walletId),
            ),
        [data.swapTransferRows, effectiveSelectedWalletIds],
    );

    const visibleCards = useMemo(
        () =>
            data.walletCards.filter((card) =>
                effectiveSelectedWalletIds.includes(card.walletId),
            ),
        [data.walletCards, effectiveSelectedWalletIds],
    );

    const toggleWalletFilter = (walletId: string, checked: boolean) => {
        if (checked) {
            onSelectedWalletIdsChange([...effectiveSelectedWalletIds, walletId]);
            return;
        }

        onSelectedWalletIdsChange(
            effectiveSelectedWalletIds.filter((id) => id !== walletId),
        );
    };

    return (
        <section className={styles.tabLayout2}>
            <aside className={`${styles.sectionCard} ${styles.sideNav}`}>
                <h3>Activity</h3>
                {data.leftNavItems.map((nav) => (
                    <Button
                        key={nav}
                        size="sm"
                        kind={selectedNav === nav ? "primary" : "tertiary"}
                        className={styles.sideNavButton}
                        onClick={() => setSelectedNav(nav)}
                    >
                        {PROFILE_ACTIVITY_NAV_LABELS[nav]}
                    </Button>
                ))}
            </aside>

            <div className={`${styles.sectionCard} ${styles.contentStack}`}>
                <div className={styles.filters}>
                    {data.availableWalletFilters.map((filter) => (
                        <Checkbox
                            key={filter.id}
                            id={`activity-wallet-filter-${filter.id}`}
                            labelText={filter.label}
                            checked={effectiveSelectedWalletIds.includes(filter.id)}
                            onChange={(_, state) =>
                                toggleWalletFilter(filter.id, state.checked)
                            }
                        />
                    ))}
                </div>

                {selectedNav === "swaps-table" || selectedNav === "transfers-table" ? (
                    <table className={styles.simpleTable}>
                        <thead>
                            <tr>
                                <th>Wallet</th>
                                <th>Type</th>
                                <th>Pair / token</th>
                                <th>Amount</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleRows
                                .filter((row) =>
                                    selectedNav === "swaps-table"
                                        ? row.type === "swap"
                                        : row.type === "transfer",
                                )
                                .map((row) => (
                                    <tr key={row.id}>
                                        <td>{row.walletLabel}</td>
                                        <td>{row.type}</td>
                                        <td>{row.pairOrToken}</td>
                                        <td>{formatCurrency(row.amountUsd)}</td>
                                        <td>{new Date(row.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                ) : null}

                {selectedNav === "wallet-overview-cards" ? (
                    <div className={styles.cardsGrid}>
                        {visibleCards.map((card) => (
                            <article key={card.walletId} className={styles.activityCard}>
                                <h4>{card.walletLabel}</h4>
                                <p>Trades: {card.tradeCount}</p>
                                <p>Buys: {card.buyCount}</p>
                                <p>Sells: {card.sellCount}</p>
                                <p>PnL: {formatCurrency(card.pnlUsd)}</p>
                            </article>
                        ))}
                    </div>
                ) : null}

                {selectedNav === "trade-frequency-heatmap" ? (
                    <div className={styles.heatmap}>
                        {data.heatmap.cells.map((cell) => {
                            const intensity =
                                data.heatmap.maxCount === 0 ? 0 : cell.count / data.heatmap.maxCount;

                            return (
                                <div
                                    key={cell.date}
                                    className={styles.heatCell}
                                    style={{
                                        backgroundColor: `rgba(15, 98, 254, ${Math.max(0.12, intensity)})`,
                                    }}
                                >
                                    <span>{cell.date.slice(5)}</span>
                                    <strong>{cell.count}</strong>
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export default ProfileActivityTab;
