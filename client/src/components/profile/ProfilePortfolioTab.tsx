import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { Table } from "@/components/tables/Table";
import { FilterType, SortType } from "@/components/tables/Table";
import { useProfileOverviewData } from "@/hooks/profile/useProfileOverviewData";
import type { ProfileOverviewData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { Button, Checkbox } from "@carbon/react";
import { AddLarge, Repeat } from "@carbon/icons-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { unlinkWalletAddress } from "@/services/profile/profileApi";
import styles from "./profile.module.scss";
import { WalletOverviewPeriodKey } from "@/services/wallet/walletApi";

interface ProfilePortfolioTabProps {
    walletAddresses: string[];
    period: TimePeriod;
    onPeriodChange: (period: TimePeriod) => void;
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

export function ProfilePortfolioTab({
    walletAddresses,
    period,
    onPeriodChange,
}: ProfilePortfolioTabProps) {
    const navigate = useNavigate();
    const [selectedComparisonWalletAddresses, setSelectedComparisonWalletAddresses] = useState<string[]>([]);
    const { walletOverviews, setWalletOverviews } = useProfileOverviewData({ walletAddresses });

    const overviewData = useMemo<ProfileOverviewData>(() => {
        const totalNetWorthUsd = walletOverviews.reduce(
            (sum, overview) => sum + overview.totalAssetValueUsd,
            0,
        );
        const periodKey = period as WalletOverviewPeriodKey;
        const tradeOrTxCount = walletOverviews.reduce(
            (sum, overview) => sum + (overview.periods[periodKey]?.transactionCount ?? 0),
            0,
        );
        const pnlUsd = walletOverviews.reduce(
            (sum, overview) => sum + (overview.periods[periodKey]?.pnl?.totalUsd ?? 0),
            0,
        );

        return {
            avatarUrl: `https://avatars.dicebear.com/api/identicon/${walletAddresses.join(",")}.svg`,
            displayName: walletAddresses.length === 1 ? formatAddress(walletAddresses[0]) : "Linked wallets",
            accountTier: "pro",
            period,
            totalNetWorthUsd,
            tradeOrTxCount,
            pnlUsd,
            pnlPct: totalNetWorthUsd > 0 ? (pnlUsd / totalNetWorthUsd) * 100 : 0,
            linkedWalletCount: walletOverviews.length,
        };
    }, [period, walletAddresses, walletOverviews]);

    const tableRows = useMemo(
        () =>
            walletOverviews.map((overview) => {
                const walletLabel = formatAddress(overview.address);

                return [
                    overview.address,
                    walletLabel,
                    overview.address,
                    overview.totalAssetValueUsd,
                    overview.address,
                ];
            }),
        [walletOverviews],
    );

    const handleComparisonToggle = (walletId: string, checked: boolean) => {
        setSelectedComparisonWalletAddresses((current) => {
            if (checked) {
                return current.includes(walletId) ? current : [...current, walletId];
            }

            return current.filter((address) => address !== walletId);
        });
    };

    const handleUnlinkWallet = async (walletAddress: string) => {
        try {
            await unlinkWalletAddress(walletAddress);
            setWalletOverviews(walletOverviews.filter((overview) => overview.address !== walletAddress));
            setSelectedComparisonWalletAddresses((current) =>
                current.filter((address) => address !== walletAddress),
            );
        } catch (error) {
            console.error("[ProfilePortfolioTab] Failed to unlink wallet:", error);
        }
    };

    const handleCompareClick = () => {
        if (selectedComparisonWalletAddresses.length < 2) {
            return;
        }

        navigate(
            `/comparision/wallets?wallets=${encodeURIComponent(selectedComparisonWalletAddresses.join(","))}`,
        );
    };

    return (
        <section className={styles.contentStack}>
            <ProfileOverview
                data={overviewData}
                onPeriodChange={onPeriodChange}
            />

            <Table
                title="Linked wallets list"
                headers={[
                    "Compare",
                    "Wallet",
                    "Address",
                    "Net worth",
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
                dataEntries={tableRows}
                cellRenderers={[
                    (_value, row) => {
                        const walletId = String(row[0]);
                        return (
                            <div onClick={(event) => event.stopPropagation()}>
                                <Checkbox
                                    id={`wallet-compare-${walletId}`}
                                    labelText=""
                                    hideLabel
                                    checked={selectedComparisonWalletAddresses.includes(walletId)}
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
                    (_value, row) => (
                        <div onClick={(event) => event.stopPropagation()}>
                            <Button
                                size="sm"
                                kind="ghost"
                                onClick={() => handleUnlinkWallet(String(row[4]))}
                            >
                                Unlink
                            </Button>
                        </div>
                    ),
                ]}
                isSortable={[true, true, true, true, false]}
                sortConfigs={{
                    3: { type: SortType.Number },
                }}
                actions={
                    <div className={styles.inlineActions}>
                        <button className={styles.triggerButton}>
                            <AddLarge size={20} />
                            Add or link wallet
                        </button>
                        <button
                            onClick={handleCompareClick}
                            disabled={selectedComparisonWalletAddresses.length < 2}
                            className={styles.triggerButton}
                        >
                            <Repeat size={20} />
                            Compare selected wallets
                        </button>
                    </div>
                }
            />
        </section>
    );
}

export default ProfilePortfolioTab;
