import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { Table } from "@/components/tables/Table";
import { FilterType, SortType } from "@/components/tables/Table";
import { createProfilePortfolioCellRenderers } from "@/components/tables/TableCellRenderer";
import { WalletActionButton } from "@/components/auth/WalletActionButton";
import { useProfileOverviewData } from "@/hooks/profile/useProfileOverviewData";
import type { ProfileOverviewData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { AddLarge, Repeat } from "@carbon/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
    linkWalletAddress,
    requestLinkWalletChallenge,
    unlinkWalletAddress,
} from "@/services/profile/profileApi";
import type { LinkedWalletRowPayload } from "@/services/profile/profileDataProvider";
import styles from "./profile.module.scss";
import { WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import { useAuth } from "@/contexts/AuthContext";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import { useLocalization } from "@/contexts/LocalizationContext";

interface ProfilePortfolioTabProps {
    linkedWallets: LinkedWalletRowPayload[];
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
    linkedWallets,
    period,
    onPeriodChange,
}: ProfilePortfolioTabProps) {
    const { tr } = useLocalization();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [linkedWalletRows, setLinkedWalletRows] = useState(linkedWallets);
    const linkedWalletByAddress = useMemo(
        () => new Map(linkedWalletRows.map((wallet) => [wallet.walletAddress, wallet])),
        [linkedWalletRows],
    );
    const linkedWalletAddresses = useMemo(
        () => linkedWalletRows.map((wallet) => wallet.walletAddress),
        [linkedWalletRows],
    );
    const [selectedComparisonWalletAddresses, setSelectedComparisonWalletAddresses] = useState<string[]>([]);
    const { walletOverviews, setWalletOverviews, loading } = useProfileOverviewData({ walletAddresses: linkedWalletAddresses });


    useEffect(() => {
        setLinkedWalletRows(linkedWallets);
    }, [linkedWallets]);

    const navigateToWalletDetail = (walletAddress: string) => {
        const nextPath = `/wallets/${encodeURIComponent(walletAddress)}`;
        navigate(nextPath);
    };

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
            avatarUrl: `https://api.dicebear.com/9.x/identicon/svg?seed=${user?.userId ?? user?.displayName ?? linkedWalletAddresses.join(",")}`,
            displayName: user?.displayName?.trim() || "Guest",
            userId: user?.userId,
            accountTier: "pro",
            period,
            totalNetWorthUsd,
            tradeOrTxCount,
            pnlUsd,
            pnlPct: totalNetWorthUsd > 0 ? (pnlUsd / totalNetWorthUsd) * 100 : 0,
            linkedWalletCount: linkedWalletAddresses.length,
        };
    }, [period, user?.displayName, user?.userId, linkedWalletAddresses, walletOverviews]);

    const tableRows = useMemo(
        () =>
            walletOverviews.map((overview) => {
                const walletMeta = linkedWalletByAddress.get(overview.address);
                const walletLabel = formatAddress(overview.address);
                const authStatus = walletMeta?.isAuthWallet
                    ? tr("profileTabs.portfolio.authWalletLabel")
                    : tr("profileTabs.portfolio.linkedWalletLabel");

                return [
                    overview.address,
                    walletLabel,
                    overview.address,
                    overview.totalAssetValueUsd,
                    authStatus,
                    walletMeta?.isAuthWallet,
                ];
            }),
        [linkedWalletByAddress, walletOverviews, tr],
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
            setLinkedWalletRows((current) =>
                current.filter((wallet) => wallet.walletAddress !== walletAddress),
            );
            setSelectedComparisonWalletAddresses((current) =>
                current.filter((address) => address !== walletAddress),
            );
        } catch (error) {
            console.error("[ProfilePortfolioTab] Failed to unlink wallet:", error);
        }
    };

    const portfolioCellRenderers = createProfilePortfolioCellRenderers({
        selectedComparisonWalletAddresses,
        onComparisonToggle: handleComparisonToggle,
        onUnlinkWallet: handleUnlinkWallet,
        formatAddress,
        formatCurrency,
        t: tr,
    });

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
                loading={loading}
            />
            {user?.userId && (
                <Table
                    title={tr("profileTabs.portfolio.linkedWalletsList")}
                    headers={[
                        tr("profileTabs.portfolio.compare"),
                        tr("profileTabs.portfolio.wallet"),
                        tr("profileTabs.portfolio.address"),
                        tr("profileTabs.portfolio.netWorth"),
                        tr("profileTabs.portfolio.auth"),
                        tr("profileTabs.portfolio.actions"),
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
                    cellRenderers={portfolioCellRenderers}
                    isSortable={[true, true, true, true, true, false]}
                    sortConfigs={{
                        3: { type: SortType.Number },
                    }}
                    actions={
                        <div className={styles.inlineActions}>
                            <WalletActionButton<string>
                                label="Add or link wallet"
                                kind="ghost"
                                renderIcon={AddLarge}
                                className={styles.triggerButton}
                                onError={(message) => {
                                    console.error("[ProfilePortfolioTab] Failed to link wallet:", message);
                                }}
                                onSuccess={(walletAddress) => {
                                    setLinkedWalletRows((current) =>
                                        current.some((wallet) => wallet.walletAddress === walletAddress)
                                            ? current
                                            : [...current, { walletAddress, isAuthWallet: false }],
                                    );
                                }}
                                action={async ({ publicKey, signMessage, onSuccess: resolveSuccess, onError: resolveError }) => {
                                    const challenge = await requestLinkWalletChallenge(publicKey);
                                    const messageBytes = new TextEncoder().encode(challenge.signMessage);
                                    const signatureBytes = await signMessage(messageBytes);
                                    const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

                                    await linkWalletAddress(publicKey, challenge.nonce, signatureBase64);
                                    resolveSuccess(publicKey);
                                }}
                            />
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
                    loading={loading}

                    onRowClick={(_, rowIndex) => {
                        const row = tableRows[rowIndex];
                        if (row) {
                            const walletAddress = row[0] as string;
                            navigateToWalletDetail(walletAddress);
                        }
                    }}
                />
            )
                || (
                    <ProfileUnavailableState
                        title="Guest mode"
                        description="Please log in to view and manage your linked wallets." />
                )
            }

        </section>
    );
}

export default ProfilePortfolioTab;
