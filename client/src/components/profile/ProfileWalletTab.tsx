import { PROFILE_WALLET_NAV_LABELS } from "@/components/profile/profile.constants";
import type {
    LinkedWalletRow,
    ProfileWalletNav,
    ProfileWalletsData,
} from "@/types/profile";
import { Button, Checkbox } from "@carbon/react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./profile.module.scss";

interface ProfileWalletTabProps {
    data: ProfileWalletsData;
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

export function ProfileWalletTab({
    data,
    selectedWalletIds,
    onSelectedWalletIdsChange,
}: ProfileWalletTabProps) {
    const navigate = useNavigate();
    const [selectedNav, setSelectedNav] = useState<ProfileWalletNav>(data.selectedNav);
    const [selectedComparisonWalletIds, setSelectedComparisonWalletIds] = useState<string[]>(
        data.selectedComparisonWalletIds,
    );

    const effectiveSelectedWalletIds =
        selectedWalletIds.length > 0 ? selectedWalletIds : data.selectedWalletIds;

    const visiblePortfolioRows = useMemo(
        () =>
            data.portfolioRows.filter((row) =>
                effectiveSelectedWalletIds.includes(row.walletId),
            ),
        [data.portfolioRows, effectiveSelectedWalletIds],
    );

    const visibleLinkedWalletRows = useMemo(
        () =>
            data.linkedWalletRows.filter((row) =>
                effectiveSelectedWalletIds.includes(row.walletId),
            ),
        [data.linkedWalletRows, effectiveSelectedWalletIds],
    );

    const handleWalletFilterToggle = (walletId: string, checked: boolean) => {
        if (checked) {
            onSelectedWalletIdsChange([...effectiveSelectedWalletIds, walletId]);
            return;
        }
        onSelectedWalletIdsChange(
            effectiveSelectedWalletIds.filter((id) => id !== walletId),
        );
    };

    const handleComparisonToggle = (walletId: string, checked: boolean) => {
        if (checked) {
            setSelectedComparisonWalletIds((current) => [...current, walletId]);
            return;
        }
        setSelectedComparisonWalletIds((current) => current.filter((id) => id !== walletId));
    };

    const navigateToWalletDetail = (row: LinkedWalletRow) => {
        const nextPath = data.walletDetailRouteTemplate.replace(
            ":walletId",
            encodeURIComponent(row.walletAddress),
        );
        navigate(nextPath);
    };

    const handleCompareClick = () => {
        const selectedAddresses = data.linkedWalletRows
            .filter((row) => selectedComparisonWalletIds.includes(row.walletId))
            .map((row) => row.walletAddress);

        if (selectedAddresses.length < 2) {
            return;
        }

        navigate(
            `${data.comparisonTargetRoute}?wallets=${encodeURIComponent(selectedAddresses.join(","))}`,
        );
    };

    return (
        <section className={styles.tabLayout2}>
            <aside className={`${styles.sectionCard} ${styles.sideNav}`}>
                <h3>Wallets</h3>
                {data.leftNavItems.map((nav) => (
                    <Button
                        key={nav}
                        size="sm"
                        kind={selectedNav === nav ? "primary" : "tertiary"}
                        className={styles.sideNavButton}
                        onClick={() => setSelectedNav(nav)}
                    >
                        {PROFILE_WALLET_NAV_LABELS[nav]}
                    </Button>
                ))}
            </aside>

            <div className={`${styles.sectionCard} ${styles.contentStack}`}>
                <div className={styles.filters}>
                    {data.availableWalletFilters.map((filter) => (
                        <Checkbox
                            key={filter.id}
                            id={`wallet-filter-${filter.id}`}
                            labelText={filter.label}
                            checked={effectiveSelectedWalletIds.includes(filter.id)}
                            onChange={(_, state) =>
                                handleWalletFilterToggle(filter.id, state.checked)
                            }
                        />
                    ))}
                </div>

                {selectedNav === "portfolio-table" ? (
                    <table className={styles.simpleTable}>
                        <thead>
                            <tr>
                                <th>Wallet</th>
                                <th>Net worth</th>
                                <th>PnL</th>
                                <th>Trades</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visiblePortfolioRows.map((row) => (
                                <tr key={row.walletId}>
                                    <td>{row.walletLabel}</td>
                                    <td>{formatCurrency(row.netWorthUsd)}</td>
                                    <td>
                                        {formatCurrency(row.pnlUsd)} ({row.pnlPct.toFixed(2)}%)
                                    </td>
                                    <td>{row.tradeCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}

                {selectedNav === "linked-wallets" ? (
                    <>
                        <div>
                            <Button size="sm">Add or link wallet</Button>
                        </div>
                        <table className={styles.simpleTable}>
                            <thead>
                                <tr>
                                    <th>Compare</th>
                                    <th>Wallet</th>
                                    <th>Address</th>
                                    <th>Net worth</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleLinkedWalletRows.map((row) => (
                                    <tr
                                        key={row.walletId}
                                        className={styles.walletRow}
                                        onClick={() => navigateToWalletDetail(row)}
                                    >
                                        <td onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                id={`wallet-compare-${row.walletId}`}
                                                labelText=""
                                                hideLabel
                                                checked={selectedComparisonWalletIds.includes(row.walletId)}
                                                onChange={(_, state) =>
                                                    handleComparisonToggle(row.walletId, state.checked)
                                                }
                                            />
                                        </td>
                                        <td>{row.walletLabel}</td>
                                        <td>{row.walletAddress}</td>
                                        <td>{formatCurrency(row.netWorthUsd)}</td>
                                        <td>{row.status}</td>
                                        <td onClick={(event) => event.stopPropagation()}>
                                            <Button size="sm" kind="ghost">
                                                Unlink
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div>
                            <Button
                                size="sm"
                                onClick={handleCompareClick}
                                disabled={selectedComparisonWalletIds.length < 2}
                            >
                                Compare selected wallets
                            </Button>
                        </div>
                    </>
                ) : null}

                {selectedNav === "balance-chart" || selectedNav === "drawdown-chart" ? (
                    <div className={styles.chartPlaceholder}>
                        <strong>
                            {selectedNav === "balance-chart" ? "Balance chart" : "Drawdown chart"}
                        </strong>
                        {data.balanceDrawdownSeries
                            .filter((series) => effectiveSelectedWalletIds.includes(series.walletId))
                            .map((series) => (
                                <div key={series.walletId}>
                                    <strong>{series.walletLabel}</strong>
                                    <p>
                                        {series.points
                                            .map((point) => `${point.date}: ${point.value.toLocaleString()}`)
                                            .join(" | ")}
                                    </p>
                                </div>
                            ))}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export default ProfileWalletTab;
