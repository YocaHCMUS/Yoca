import { ProfileOverview } from "@/components/profile/overview/ProfileOverview";
import { Table } from "@/components/tables/Table";
import { FilterType, SortType } from "@/components/tables/Table";
import { renderLongCode } from "@/components/tables/TableCellRenderer";
import { WalletActionButton } from "@/components/auth/WalletActionButton";
import { useProfileOverviewData } from "@/hooks/profile/useProfileOverviewData";
import type { ProfileOverviewData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { AddLarge, Checkmark, Close, Edit } from "@carbon/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
    linkWalletAddress,
    requestLinkWalletChallenge,
    unlinkWalletAddress,
} from "@/services/profile/profileApi";
import type { LinkedWalletRowPayload } from "@/services/profile/profileDataProvider";
import styles from "@/components/profile/shared/profile.module.scss";
import { WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import { useAuth } from "@/contexts/AuthContext";
import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import { useLocalization } from "@/contexts/LocalizationContext";
import { Button, IconButton, TextInput } from "@carbon/react";
import {
    getWalletLabel,
    loadWalletLabels,
    setWalletLabel,
    type WalletLabelMap,
} from "@/components/profile/shared/walletLabels";

interface ProfilePortfolioTabProps {
    linkedWallets: LinkedWalletRowPayload[];
    period: TimePeriod;
    onPeriodChange: (period: TimePeriod) => void;
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
    const { tr, fmt } = useLocalization();
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
    const [labelMap, setLabelMap] = useState<WalletLabelMap>(() => loadWalletLabels());
    const [editingAddress, setEditingAddress] = useState<string | null>(null);
    const [draftLabel, setDraftLabel] = useState("");
    const { walletOverviews, setWalletOverviews, loading } = useProfileOverviewData({ walletAddresses: linkedWalletAddresses });


    useEffect(() => {
        setLinkedWalletRows(linkedWallets);
    }, [linkedWallets]);

    useEffect(() => {
        const handleLabelsUpdate = () => setLabelMap(loadWalletLabels());
        window.addEventListener("wallet-labels-updated", handleLabelsUpdate);
        return () => window.removeEventListener("wallet-labels-updated", handleLabelsUpdate);
    }, []);

    const navigateToWalletDetail = (walletAddress: string) => {
        const nextPath = `/wallets/${encodeURIComponent(walletAddress)}`;
        navigate(nextPath);
    };

    const overviewData = useMemo<ProfileOverviewData>(() => {
        const authWalletCount = linkedWalletRows.filter((wallet) => wallet.isAuthWallet).length;
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
            authWalletCount,
        };
    }, [linkedWalletRows, period, user?.displayName, user?.userId, linkedWalletAddresses, walletOverviews]);

    const tableRows = useMemo(
        () =>
            walletOverviews.map((overview) => {
                const walletMeta = linkedWalletByAddress.get(overview.address);
                const authStatus = walletMeta?.isAuthWallet
                    ? tr("profileTabs.portfolio.authWalletLabel")
                    : tr("profileTabs.portfolio.linkedWalletLabel");

                return [
                    overview.address,
                    getWalletLabel(labelMap, overview.address) ?? formatAddress(overview.address),
                    overview.address,
                    overview.totalAssetValueUsd,
                    authStatus,
                    walletMeta?.isAuthWallet,
                ];
            }),
        [linkedWalletByAddress, walletOverviews, tr, labelMap],
    );

    const handleUnlinkWallet = async (walletAddress: string) => {
        try {
            await unlinkWalletAddress(walletAddress);
            setWalletOverviews(walletOverviews.filter((overview) => overview.address !== walletAddress));
            setLinkedWalletRows((current) =>
                current.filter((wallet) => wallet.walletAddress !== walletAddress),
            );
        } catch (error) {
            console.error("[ProfilePortfolioTab] Failed to unlink wallet:", error);
        }
    };

    const handleStartEdit = (address: string) => {
        setEditingAddress(address);
        setDraftLabel(getWalletLabel(labelMap, address) ?? "");
    };

    const handleCancelEdit = () => {
        setEditingAddress(null);
        setDraftLabel("");
    };

    const handleSaveLabel = (address: string) => {
        setLabelMap((prev) => setWalletLabel(prev, address, draftLabel));
        setEditingAddress(null);
        setDraftLabel("");
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
                        "Label",
                        tr("profileTabs.portfolio.address"),
                        tr("profileTabs.portfolio.netWorth"),
                        tr("profileTabs.portfolio.auth"),
                        tr("profileTabs.portfolio.actions"),
                    ]}
                    initialFilters={{}}
                    fetcher={Promise.resolve([])}
                    filterSchema={{
                        0: { type: FilterType.Select },
                        1: { type: FilterType.Select },
                        2: { type: FilterType.Range, min: 0, max: 1000000, step: 1000 },
                        3: { type: FilterType.Select },
                    }}
                    dataEntries={tableRows}
                    cellRenderers={[
                        (_value, row) => {
                            const walletAddress = String(row[0] ?? "");
                            const label = String(row[1] ?? "");
                            const isEditing = editingAddress === walletAddress;

                            if (isEditing) {
                                return (
                                    <div
                                        className={styles.labelEditRow}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <TextInput
                                            id={`wallet-label-${walletAddress}`}
                                            value={draftLabel}
                                            onChange={(event) => setDraftLabel(event.target.value)}
                                            size="sm"
                                            placeholder="Add label"
                                            hideLabel
                                            labelText="Wallet label"
                                            className={styles.labelInput}
                                        />
                                        <div className={styles.labelEditActions}>
                                            <IconButton
                                                kind="ghost"
                                                size="sm"
                                                label="Save"
                                                onClick={() => handleSaveLabel(walletAddress)}
                                            >
                                                <Checkmark />
                                            </IconButton>
                                            <IconButton
                                                kind="ghost"
                                                size="sm"
                                                label="Cancel"
                                                onClick={handleCancelEdit}
                                            >
                                                <Close />
                                            </IconButton>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div className={styles.labelCell}>
                                    <span className={styles.labelText}>{label}</span>
                                    <IconButton
                                        kind="ghost"
                                        size="sm"
                                        label="Edit label"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleStartEdit(walletAddress);
                                        }}
                                    >
                                        <Edit />
                                    </IconButton>
                                </div>
                            );
                        },
                        (_value, row) => renderLongCode(String(row[2] ?? ""), 8),
                        (_value, row) => fmt.num.compact.currency(Number(row[3] ?? 0)),
                        (_value, row) => String(row[4] ?? ""),
                        (_value, row) => {
                            const isAuthWallet = row[5];
                            if (typeof isAuthWallet !== "boolean") {
                                return null;
                            }

                            const walletAddress = String(row[0] ?? "");

                            return (
                                <div onClick={(event) => event.stopPropagation()}>
                                    <Button
                                        size="sm"
                                        kind="ghost"
                                        disabled={isAuthWallet}
                                        title={
                                            isAuthWallet
                                                ? tr("profileTabs.portfolio.authWalletCannotBeUnlinked")
                                                : tr("profileTabs.portfolio.unlinkWallet")
                                        }
                                        onClick={() => handleUnlinkWallet(walletAddress)}
                                    >
                                        {tr("profileTabs.portfolio.unlinkWallet")}
                                    </Button>
                                </div>
                            );
                        },
                    ]}
                    isSortable={[true, true, true, true, false]}
                    sortConfigs={{
                        2: { type: SortType.Number },
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
