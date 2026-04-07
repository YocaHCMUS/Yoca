import { Table } from "@/components/tables/Table";
import { FilterType, SortType } from "@/components/tables/Table";
import type {
    LinkedWalletRow,
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

    const portfolioTableData = visiblePortfolioRows.map((row) => [
        row.walletLabel,
        row.netWorthUsd,
        row.pnlUsd,
        row.tradeCount,
    ]);

    const linkedWalletTableData = visibleLinkedWalletRows.map((row) => [
        row.walletId,
        row.walletLabel,
        row.walletAddress,
        row.netWorthUsd,
        row.status,
        row.walletId,
    ]);

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
        <section className={styles.contentStack}>
            <div className={styles.sectionCard}>
                <h3>Wallet filters</h3>
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
            </div>

            <Table
                title="Portfolio table"
                headers={["Wallet", "Net worth", "PnL", "Trades"]}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{
                    0: { type: FilterType.Select },
                    1: { type: FilterType.Range, min: 0, max: 1000000, step: 1000 },
                    2: { type: FilterType.Range, min: -500000, max: 500000, step: 1000 },
                    3: { type: FilterType.Range, min: 0, max: 5000, step: 1 },
                }}
                dataEntries={portfolioTableData}
                cellRenderers={[
                    null,
                    (value) => formatCurrency(Number(value)),
                    (value) => formatCurrency(Number(value)),
                    null,
                ]}
                isSortable={[true, true, true, true]}
                sortConfigs={{
                    1: { type: SortType.Number },
                    2: { type: SortType.Number },
                    3: { type: SortType.Number },
                }}
            />

            <Table
                title="Linked wallets list"
                headers={[
                    "Compare",
                    "Wallet",
                    "Address",
                    "Net worth",
                    "Status",
                    "Actions",
                ]}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{
                    1: { type: FilterType.Select },
                    2: { type: FilterType.Select },
                    3: { type: FilterType.Range, min: 0, max: 1000000, step: 1000 },
                    4: { type: FilterType.Select },
                }}
                dataEntries={linkedWalletTableData}
                cellRenderers={[
                    (_value, row) => {
                        const walletId = String(row[0]);
                        return (
                            <div onClick={(event) => event.stopPropagation()}>
                                <Checkbox
                                    id={`wallet-compare-${walletId}`}
                                    labelText=""
                                    hideLabel
                                    checked={selectedComparisonWalletIds.includes(walletId)}
                                    onChange={(_, state) =>
                                        handleComparisonToggle(walletId, state.checked)
                                    }
                                />
                            </div>
                        );
                    },
                    null,
                    null,
                    (value) => formatCurrency(Number(value)),
                    null,
                    (_value, row) => {
                        const walletId = String(row[5]);
                        const linkedRow = visibleLinkedWalletRows.find(
                            (item) => item.walletId === walletId,
                        );

                        if (!linkedRow) return null;

                        return (
                            <div onClick={(event) => event.stopPropagation()}>
                                <Button size="sm" kind="ghost">
                                    Unlink
                                </Button>
                            </div>
                        );
                    },
                ]}
                isSortable={[true, true, true, true, true, false]}
                sortConfigs={{
                    3: { type: SortType.Number },
                }}
                onRowClick={(_, rowIndex) => {
                    const row = visibleLinkedWalletRows[rowIndex];
                    if (row) {
                        navigateToWalletDetail(row);
                    }
                }}
                actions={
                    <div className={styles.inlineActions}>
                        <Button size="sm">
                            Add or link wallet
                        </Button>
                        <Button

                            size="sm"
                            onClick={handleCompareClick}
                            disabled={selectedComparisonWalletIds.length < 2}
                        >
                            Compare selected wallets
                        </Button>
                    </div>
                }
            />

            <div className={styles.sectionCard}>
                <h3>Balance chart</h3>
                <div className={styles.chartPlaceholder}>
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
            </div>

            <div className={styles.sectionCard}>
                <h3>Drawdown chart</h3>
                <div className={styles.chartPlaceholder}>
                    {data.balanceDrawdownSeries
                        .filter((series) => effectiveSelectedWalletIds.includes(series.walletId))
                        .map((series) => (
                            <div key={`${series.walletId}-drawdown`}>
                                <strong>{series.walletLabel}</strong>
                                <p>
                                    {series.points
                                        .map((point) => `${point.date}: ${point.value.toLocaleString()}`)
                                        .join(" | ")}
                                </p>
                            </div>
                        ))}
                </div>
            </div>
        </section>
    );
}

export default ProfileWalletTab;
