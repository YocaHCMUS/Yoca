import { DrawdownChart } from "@/components/charts/Drawdown";
import styles from "./profile.module.scss";
import { useProfileWalletTabData } from "@/hooks/profile/useProfileWalletTabData";
import type { TimePeriod } from "@/types/chart-filters.types";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import { useLocalization } from "@/contexts/LocalizationContext";
import { AggregatedAssetDistribution } from "@/components/charts/AggregatedAssetDistribution";
import { MultiWalletBalanceChart } from "../charts/BalanceChartMultiV2";

interface ProfileWalletTabProps {
    walletAddresses: string[];
    period: TimePeriod;
}


export function ProfileWalletTab({ walletAddresses, period }: ProfileWalletTabProps) {
    const { tr } = useLocalization();
    const { data, error } = useProfileWalletTabData({ walletAddresses, period });

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




    const chartWallets = data.linkedWalletRows.map((row) => row.walletAddress);

    return (
        <section className={styles.contentStack}>

            <div className={styles.sectionCard}>
                <AggregatedAssetDistribution
                    initialFilters={{ wallets: chartWallets }}
                    minHeight={300}
                    fetchEnabled={true}
                />
            </div>

            <div className={styles.sectionCard}>
                <MultiWalletBalanceChart addresses={chartWallets} />  
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
