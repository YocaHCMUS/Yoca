import { ProfileOverview } from "@/components/profile/overview/ProfileOverview";
import Tble, { TbleFilterType, TbleSortType, type TblRw } from "@/components/Tble";
import { WalletActionButton } from "@/components/auth/WalletActionButton";
import ProfileUnavailableState from "@/components/profile/shared/ProfileUnavailableState";
import { useAuth, type EffectivePlanTier } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useProfileOverviewData } from "@/hooks/profile/useProfileOverviewData";
import type { ProfileOverviewData, ProfileAccountTier } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { AddLarge, Checkmark, CloseFilled, Login } from "@carbon/icons-react";
import { Button } from "@carbon/react";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
    linkWalletAddress,
    requestLinkWalletChallenge,
    unlinkWalletAddress,
} from "@/services/profile/profileApi";
import type { LinkedWalletRowPayload } from "@/services/profile/profileDataProvider";
import styles from "@/components/profile/shared/profile.module.scss";
import { WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import { useWalletLabels } from "@/hooks/profile/useWalletLabels";

interface ProfilePortfolioTabProps {
  linkedWallets: LinkedWalletRowPayload[];
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

function mapPlanTierToAccountTier(planTier: EffectivePlanTier): ProfileAccountTier {
  if (planTier == "Pro") return "pro";
  if (planTier == "Plus") return "premium";
  return "basic";
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
    const [editingAddress, setEditingAddress] = useState<string | null>(null);
    const [draftLabel, setDraftLabel] = useState("");
    const { walletOverviews, setWalletOverviews, loading } = useProfileOverviewData({ walletAddresses: linkedWalletAddresses });
    const { labels: labelMap, setLabel } = useWalletLabels();

  useEffect(() => {
    setLinkedWalletRows(linkedWallets);
  }, [linkedWallets]);

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
      (sum, overview) =>
        sum + (overview.periods[periodKey]?.transactionCount ?? 0),
      0,
    );
    const pnlUsd = walletOverviews.reduce(
      (sum, overview) =>
        sum + (overview.periods[periodKey]?.pnl?.totalUsd ?? 0),
      0,
    );

    return {
      avatarUrl: user?.avatarUrl || `https://api.dicebear.com/9.x/identicon/svg?seed=${user?.userId ?? user?.displayName ?? linkedWalletAddresses.join(",")}`,
      displayName: user?.displayName?.trim() || "Guest",
      userId: user?.userId,
      accountTier: mapPlanTierToAccountTier(user?.planTier ?? "Free"),
      period,
      totalNetWorthUsd,
      tradeOrTxCount,
      pnlUsd,
      pnlPct: totalNetWorthUsd > 0 ? (pnlUsd / totalNetWorthUsd) * 100 : 0,
      linkedWalletCount: linkedWalletAddresses.length,
      authWalletCount,
    };
  }, [
    user?.planTier,
    period,
    user?.avatarUrl,
    user?.displayName,
    user?.userId,
    linkedWalletAddresses,
    walletOverviews,
    linkedWalletRows,
  ]);

  const tableRows = useMemo(
    () =>
      walletOverviews.map((overview) => {
        const walletMeta = linkedWalletByAddress.get(overview.address);
        const walletLabel = labelMap[overview.address] ?? "";

        return {
          id: overview.address,
          address: {
            walletAddress: overview.address,
            label: walletLabel,
            isAuthWallet: walletMeta?.isAuthWallet,
          },
          totalValue: overview.totalAssetValueUsd,
        } satisfies TblRw;
      }),
    [linkedWalletByAddress, walletOverviews, labelMap],
  );

  const handleUnlinkWallet = async (walletAddress: string) => {
    try {
      await unlinkWalletAddress(walletAddress);
      setWalletOverviews(
        walletOverviews.filter(
          (overview) => overview.address !== walletAddress,
        ),
      );
      setLinkedWalletRows((current) =>
        current.filter((wallet) => wallet.walletAddress !== walletAddress),
      );
    } catch (error) {
      console.error("[ProfilePortfolioTab] Failed to unlink wallet:", error);
    }
  };

  const cellRenderers: Record<string, (value: unknown, row: TblRw) => ReactNode> = {
    address: (value: unknown) => {
      const entry = value as { walletAddress: string; label: string; isAuthWallet?: boolean } | undefined;
      const walletAddress = entry?.walletAddress ?? "";
      const initialLabel = entry?.label ?? "";
      const isAuthWallet = Boolean(entry?.isAuthWallet);

      const EditableLabelCell = () => {
        const [isEditing, setIsEditing] = useState(false);
        const [draft, setDraft] = useState(initialLabel);

        if (isEditing) {
          return (
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ width: "100px", padding: "2px", background: "var(--cds-layer-01)", color: "inherit", border: "1px solid var(--cds-border-strong)" }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setLabel(walletAddress, draft);
                    setIsEditing(false);
                  } else if (e.key === 'Escape') {
                    setDraft(initialLabel);
                    setIsEditing(false);
                  }
                }}
              />
              <Checkmark size={16} style={{ cursor: "pointer", color: "var(--cds-support-success)" }} onClick={() => {
                setLabel(walletAddress, draft);
                setIsEditing(false);
              }} />
              <CloseFilled size={16} style={{ cursor: "pointer", color: "var(--cds-support-error)" }} onClick={() => {
                setDraft(initialLabel);
                setIsEditing(false);
              }} />
            </div>
          );
        }

        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span title={walletAddress}>
              {initialLabel || fmt.text.address(walletAddress)}
            </span>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", padding: "2px" }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditing(true); }}>
              <span style={{ fontSize: "10px", opacity: 0.5 }}><Pencil size={12} /></span>
            </div>
            {isAuthWallet && (
              <Login size={14} title={tr("profileTabs.portfolio.authWalletLabel")} />
            )}
          </span>
        );
      };

      return <EditableLabelCell />;
    },
    totalValue: (value: unknown) => <span>{fmt.num.compact.currency(Number(value))}</span>,
    actions: (_value: unknown, row: TblRw) => {
      const entry = row.address as { walletAddress: string; isAuthWallet?: boolean } | undefined;
      if (!entry) return null;
      const isAuthWallet = Boolean(entry.isAuthWallet);
      const walletAddress = entry.walletAddress;

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
  };

  return (
    <section className={styles.contentStack}>
      <ProfileOverview
        data={overviewData}
        loading={loading}
      />
      {(user?.userId && (
        <Tble
          title={tr("profileTabs.portfolio.linkedWalletsList")}
          headers={[
            { key: "address", header: tr("profileTabs.portfolio.address") },
            { key: "totalValue", header: tr("profileTabs.portfolio.totalValue") },
            { key: "actions", header: tr("profileTabs.portfolio.actions") },
          ]}
          rows={tableRows}
          cellRenderers={cellRenderers}
          filterSchema={{
            address: { type: TbleFilterType.Select },
            totalValue: { type: TbleFilterType.Range, min: 0, max: 1000000, step: 1000 },
          }}
          sortConfigs={{
            totalValue: { type: TbleSortType.Number },
          }}
          toolBar={
            <div className={styles.inlineActions}>
              <WalletActionButton<string>
                label="Link wallet"
                className={styles.triggerButton}
                onError={(message) => {
                  console.error(
                    "[ProfilePortfolioTab] Failed to link wallet:",
                    message,
                  );
                }}
                onSuccess={(walletAddress) => {
                  setLinkedWalletRows((current) =>
                    current.some(
                      (wallet) => wallet.walletAddress === walletAddress,
                    )
                      ? current
                      : [...current, { walletAddress, isAuthWallet: false }],
                  );
                }}
                action={async ({
                  publicKey,
                  signMessage,
                  onSuccess: resolveSuccess,
                  onError: resolveError,
                }) => {
                  const challenge = await requestLinkWalletChallenge(publicKey);
                  const messageBytes = new TextEncoder().encode(
                    challenge.signMessage,
                  );
                  const signatureBytes = await signMessage(messageBytes);
                  const signatureBase64 =
                    Buffer.from(signatureBytes).toString("base64");

                  await linkWalletAddress(
                    publicKey,
                    challenge.nonce,
                    signatureBase64,
                  );
                  resolveSuccess(publicKey);
                }}
              />
            </div>
          }
          loading={loading}
          onRowClick={(row: TblRw) => {
            const entry = row.address as { walletAddress: string } | undefined;
            if (entry?.walletAddress) {
              navigateToWalletDetail(entry.walletAddress);
            }
          }}
        />
      )) || (
        <ProfileUnavailableState
          title="Guest mode"
          description="Please log in to view and manage your linked wallets."
        />
      )}
    </section>
  );
}

export default ProfilePortfolioTab;
