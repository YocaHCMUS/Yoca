import { BalanceChart } from "@/components/charts/BalanceChart";
import { DrawdownChart } from "@/components/charts/Drawdown";
import { Table } from "@/components/tables/Table";
import { FilterType, SortType } from "@/components/tables/Table";
import type {
    LinkedWalletRow,
    ProfileWalletsData,
} from "@/types/profile";
import { Button, Checkbox } from "@carbon/react";
import { AddLarge, Repeat } from "@carbon/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import styles from "./profile.module.scss";

interface ProfileWalletTabProps {
    data: ProfileWalletsData;
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

export function ProfileWalletTab({
    data,
}: ProfileWalletTabProps) {
    const navigate = useNavigate();
    const [selectedComparisonWalletIds, setSelectedComparisonWalletIds] = useState<string[]>(
        data.selectedComparisonWalletIds,
    );

    const portfolioTableData = data.portfolioRows.map((row) => [
        row.walletLabel,
        row.netWorthUsd,
        row.pnlUsd,
        row.tradeCount,
    ]);

    const linkedWalletTableData = data.linkedWalletRows.map((row) => [
        row.walletId,
        row.walletLabel,
        row.walletAddress,
        row.netWorthUsd,
        row.status,
        row.walletId,
    ]);

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

    const chartWallets = data.linkedWalletRows.map((row) => row.walletAddress);

    return (
        <section className={styles.contentStack}>
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
                onRowClick={(_, rowIndex) => {
                    const row = data.linkedWalletRows[rowIndex];
                    if (row) {
                        navigateToWalletDetail(row);
                    }
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
                    (_value, row) => {
                        const walletAddress = String(row[2]);
                        return <span title={walletAddress}>{formatAddress(walletAddress)}</span>;
                    },
                    (value) => formatCurrency(Number(value)),
                    null,
                    (_value, row) => {
                        const walletId = String(row[5]);
                        const linkedRow = data.linkedWalletRows.find(
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
                // onRowClick={(_, rowIndex) => {
                //     const row = data.linkedWalletRows[rowIndex];
                //     if (row) {
                //         navigateToWalletDetail(row);
                //     }
                // }}
                actions={
                    <div className={styles.inlineActions}>
                        <button className={styles.triggerButton}>
                            <AddLarge size={20} />
                            Add or link wallet
                        </button>
                        <button
                            onClick={handleCompareClick}
                            disabled={selectedComparisonWalletIds.length < 2}
                            className={styles.triggerButton}
                        >
                            <Repeat size={20} />
                            Compare selected wallets
                        </button>
                    </div>
                }
            />

            <div className={styles.sectionCard}>
                <BalanceChart
                    minHeight={360}
                    initialFilters={{
                        timePeriod: "30D",
                        wallets: chartWallets,
                    }}
                />
            </div>

            <div className={styles.sectionCard}>
                <DrawdownChart
                    minHeight={360}
                    initialFilters={{
                        timePeriod: "30D",
                        wallets: chartWallets,
                    }}
                />
            </div>
        </section>
    );
}

export default ProfileWalletTab;
