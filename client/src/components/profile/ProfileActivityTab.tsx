import { FilterType, SortType, Table } from "@/components/tables/Table";
import type { ProfileActivityData } from "@/types/profile";
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
            <div className={styles.sectionCard}>
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
            </div>

            <div className={styles.sectionCard}>
                <h3>Wallet overview cards</h3>
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
            </div>

            <div className={styles.sectionCard}>
                <h3>Trade frequency heatmap</h3>
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
            </div>
        </section>
    );
}

export default ProfileActivityTab;
