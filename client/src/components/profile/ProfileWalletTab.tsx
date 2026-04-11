import { BalanceChart } from "@/components/charts/BalanceChart";
import { DrawdownChart } from "@/components/charts/Drawdown";
import { Table } from "@/components/tables/Table";
import { FilterType, SortType } from "@/components/tables/Table";
import type { LinkedWalletRow } from "@/types/profile";
import { useNavigate } from "react-router";
import styles from "./profile.module.scss";
import { useProfileWalletTabData } from "@/hooks/profile/useProfileWalletTabData";
import type { TimePeriod } from "@/types/chart-filters.types";

interface ProfileWalletTabProps {
    walletAddresses: string[];
    period: TimePeriod;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

export function ProfileWalletTab({ walletAddresses, period }: ProfileWalletTabProps) {
    const navigate = useNavigate();
    const { data } = useProfileWalletTabData({ walletAddresses, period });

    const portfolioTableData = data.portfolioRows.map((row) => [
        row.walletLabel,
        row.netWorthUsd,
        row.pnlUsd,
        row.tradeCount,
    ]);

    const navigateToWalletDetail = (row: LinkedWalletRow) => {
        const nextPath = data.walletDetailRouteTemplate.replace(
            ":walletId",
            encodeURIComponent(row.walletAddress),
        );
        navigate(nextPath);
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
