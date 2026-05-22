import { WalletSingleBalanceChart } from "@/components/charts/WalletSingleBalanceChart";
import { DrawdownChart } from "@/components/charts/Drawdown";
import { TradingVolumeDistribution } from "@/components/charts/TradingVolumeDistribution/TradingVolumeDistribution";
import { PnLChart } from "@/components/charts/PnLChart/PnLChart";
import styles from "@/components/profile/shared/profile.module.scss";
import { useProfileWalletTabData } from "@/hooks/profile/useProfileWalletTabData";
import type { TimePeriod } from "@/types/chart-filters.types";
import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Select, SelectItem } from "@carbon/react";
import { useEffect, useMemo, useState } from "react";

interface ProfileWalletTabProps {
    walletAddresses: string[];
    period: TimePeriod;
}


export function ProfileWalletTab({ walletAddresses, period }: ProfileWalletTabProps) {
    const { tr } = useLocalization();
    const { data, error } = useProfileWalletTabData({ walletAddresses, period });
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
            <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                    <h3>Wallets</h3>
                    <Select
                        id="profile-wallet-selector"
                        hideLabel={true}
                        labelText="Wallets"
                        value={selectedWalletId}
                        onChange={(event) => setSelectedWalletId(event.target.value)}
                    >
                        {walletOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id} text={option.label} />
                        ))}
                    </Select>
                </div>
            </div>

            <div className={styles.sectionCard}>
                <WalletSingleBalanceChart
                    key={`balance-${chartKey}`}
                    title={tr("walletPage.balanceHistory")}
                    minHeight={360}
                    initialFilters={{
                        timePeriod: "7D",
                        wallets: chartWallets,
                    }}
                />
            </div>

            <div className={styles.sectionCard}>
                <DrawdownChart
                    key={`drawdown-${chartKey}`}
                    minHeight={360}
                    initialFilters={{
                        timePeriod: "30D",
                        wallets: chartWallets,
                    }}
                />
            </div>

            <div className={styles.sectionCard}>
                <TradingVolumeDistribution
                    key={`volume-distribution-${chartKey}`}
                    minHeight={360}
                    initialFilters={{
                        timePeriod: period,
                        wallets: chartWallets,
                    }}
                    autoRefresh={false}
                />
            </div>

            <div className={styles.sectionCard}>
                <PnLChart
                    key={`pnl-${chartKey}`}
                    minHeight={360}
                    initialFilters={{ wallets: chartWallets }}
                    autoRefresh={false}
                />
            </div>
        </section>
    );
}

export default ProfileWalletTab;
