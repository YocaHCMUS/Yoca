import { DrawdownChart } from "@/components/charts/Drawdown";
import { TradingVolumeDistribution } from "@/components/charts/TradingVolumeDistribution/TradingVolumeDistribution";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart";
import styles from "@/components/profile/shared/profile.module.scss";
import { useProfileWalletTabData } from "@/hooks/profile/useProfileWalletTabData";
import type { TimePeriod } from "@/types/chart-filters.types";
import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import ProfileLoadingState from "@/components/profile/shared/ProfileLoadingState";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useEffect, useMemo, useState } from "react";
import { MultiWalletBalanceChart } from "@/components/charts/BalanceChartMultiV2";
import { PageHeader } from "@/components/common/PageHeader/PageHeader";
import { Card } from "@/components/common/Card/Card";
import { AddressPill } from "@/components/common/AddressPill/AddressPill";

interface ProfileWalletTabProps {
    walletAddresses: string[];
    period: TimePeriod;
}


export function ProfileWalletTab({ walletAddresses, period }: ProfileWalletTabProps) {
    const { tr } = useLocalization();
    const { data, error, loading } = useProfileWalletTabData({ walletAddresses, period });
    const [selectedWalletId, setSelectedWalletId] = useState<string>("");

    const walletOptions = useMemo(
        () => data.linkedWalletRows.map((row) => ({
            id: row.walletAddress,
            label: row.walletLabel,
        })),
        [data.linkedWalletRows],
    );

    useEffect(() => {
        if (walletOptions.length === 0) {
            setSelectedWalletId("");
            return;
        }

        if (selectedWalletId && walletOptions.some((option) => option.id === selectedWalletId)) {
            return;
        }

        setSelectedWalletId(walletOptions[0].id);
    }, [selectedWalletId, walletOptions]);

    if (error) {
        return (
            <ProfileUnavailableState
                title={tr("profileTabs.wallet.unavailableTitle")}
                description={tr("profileTabs.wallet.unavailableDescription")}
            />
        );
    }

    if (loading) {
        return <ProfileLoadingState />;
    }

    if (walletAddresses.length === 0 || data.linkedWalletRows.length === 0) {
        return (
            <ProfileUnavailableState
                title={tr("profileTabs.wallet.noLinkedWalletsTitle")}
                description={tr("profileTabs.wallet.noLinkedWalletsDescription")}
            />
        );
    }




    const chartWallets = selectedWalletId ? [selectedWalletId] : [];
    const chartKey = selectedWalletId || "all-wallets";

    return (
        <section className={styles.contentStack}>
            <PageHeader
                title="Wallets"
                actions={
                    <select
                        value={selectedWalletId}
                        onChange={(event) => setSelectedWalletId(event.target.value)}
                        style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--yoca-border)",
                            background: "var(--yoca-surface)",
                            color: "var(--yoca-text-main)",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                            maxWidth: 240,
                        }}
                    >
                        {walletOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label || option.id.slice(0, 8) + "..." + option.id.slice(-4)}
                            </option>
                        ))}
                    </select>
                }
            />

            <Card>
                <MultiWalletBalanceChart addresses={chartWallets} />
            </Card>

            <Card>
                <DrawdownChart
                    key={`drawdown-${chartKey}`}
                    minHeight={360}
                    initialFilters={{
                        timePeriod: "30D",
                        wallets: chartWallets,
                    }}
                />
            </Card>

            <Card>
                <TradingVolumeDistribution
                    key={`volume-distribution-${chartKey}`}
                    minHeight={360}
                    initialFilters={{
                        timePeriod: period,
                        wallets: chartWallets,
                    }}
                    autoRefresh={false}
                />
            </Card>

            <Card>
                <PnLChart
                    key={`pnl-${chartKey}`}
                    minHeight={360}
                    initialFilters={{ wallets: chartWallets }}
                />
            </Card>
        </section>
    );
}

export default ProfileWalletTab;
