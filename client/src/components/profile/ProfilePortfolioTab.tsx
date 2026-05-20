import { WalletActionButton } from "@/components/auth/WalletActionButton";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import ProfileUnavailableState from "@/components/profile/ProfileUnavailableState";
import { FilterType, SortType, Table } from "@/components/tables/Table";
import { createProfilePortfolioCellRenderers } from "@/components/tables/TableCellRenderer";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useProfileOverviewData } from "@/hooks/profile/useProfileOverviewData";
import {
    linkWalletAddress,
    requestLinkWalletChallenge,
    unlinkWalletAddress,
} from "@/services/profile/profileApi";
import { getUserSubscription, type PlanTier } from "@/services/profile/subscriptionApi";
import type { LinkedWalletRowPayload } from "@/services/profile/profileDataProvider";
import { WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import type { ProfileAccountTier, ProfileOverviewData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { AddLarge } from "@carbon/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import styles from "./profile.module.scss";

interface ProfilePortfolioTabProps {
  linkedWallets: LinkedWalletRowPayload[];
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

function mapPlanTierToAccountTier(planTier: PlanTier | null): ProfileAccountTier {
  if (planTier === "Pro") return "pro";
  if (planTier === "Plus") return "premium";
  if (planTier === "Lite") return "basic";
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
    () =>
      new Map(linkedWalletRows.map((wallet) => [wallet.walletAddress, wallet])),
    [linkedWalletRows],
  );
  const linkedWalletAddresses = useMemo(
    () => linkedWalletRows.map((wallet) => wallet.walletAddress),
    [linkedWalletRows],
  );
  const [currentPlanTier, setCurrentPlanTier] = useState<PlanTier | null>(null);
  const { walletOverviews, setWalletOverviews, loading } =
    useProfileOverviewData({ walletAddresses: linkedWalletAddresses });

  useEffect(() => {
    setLinkedWalletRows(linkedWallets);
  }, [linkedWallets]);

  useEffect(() => {
    let active = true;

    async function loadCurrentPlanTier() {
      if (!user?.userId) {
        setCurrentPlanTier(null);
        return;
      }

      try {
        const subscription = await getUserSubscription();
        if (!active) return;
        setCurrentPlanTier(subscription?.planTier ?? null);
      } catch (error) {
        console.error(
          "[ProfilePortfolioTab] Failed to load current subscription:",
          error,
        );
        if (active) {
          setCurrentPlanTier(null);
        }
      }
    }

    loadCurrentPlanTier();

    return () => {
      active = false;
    };
  }, [user?.userId]);

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
      avatarUrl: `https://api.dicebear.com/9.x/identicon/svg?seed=${user?.userId ?? user?.displayName ?? linkedWalletAddresses.join(",")}`,
      displayName: user?.displayName?.trim() || "Guest",
      userId: user?.userId,
      accountTier: mapPlanTierToAccountTier(currentPlanTier),
      period,
      totalNetWorthUsd,
      tradeOrTxCount,
      pnlUsd,
      pnlPct: totalNetWorthUsd > 0 ? (pnlUsd / totalNetWorthUsd) * 100 : 0,
      linkedWalletCount: linkedWalletAddresses.length,
    };
  }, [
    currentPlanTier,
    period,
    user?.displayName,
    user?.userId,
    linkedWalletAddresses,
    walletOverviews,
  ]);

  const tableRows = useMemo(
    () =>
      walletOverviews.map((overview) => {
        const walletMeta = linkedWalletByAddress.get(overview.address);
        const walletLabel = fmt.text.address(overview.address);

        return [
          overview.address,
          walletLabel,
          overview.address,
          overview.totalAssetValueUsd,
          walletMeta?.isAuthWallet,
        ];
      }),
    [linkedWalletByAddress, walletOverviews, fmt],
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

  const portfolioCellRenderers = createProfilePortfolioCellRenderers({
    onUnlinkWallet: handleUnlinkWallet,
    formatAddress: (address: string) => fmt.text.address(address),
    formatCurrency: (value: number) => fmt.num.compact.currency(value),
    t: tr,
  });

  return (
    <section className={styles.contentStack}>
      <ProfileOverview
        data={overviewData}
        onPeriodChange={onPeriodChange}
        loading={loading}
      />
      {(user?.userId && (
        <Table
          title={tr("profileTabs.portfolio.linkedWalletsList")}
          headers={[
            tr("profileTabs.portfolio.label"),
            tr("profileTabs.portfolio.address"),
            tr("profileTabs.portfolio.totalValue"),
            tr("profileTabs.portfolio.actions"),
          ]}
          initialFilters={{}}
          fetcher={Promise.resolve([])}
          filterSchema={{
            0: { type: FilterType.Select },
            1: { type: FilterType.Select },
            2: { type: FilterType.Range, min: 0, max: 1000000, step: 1000 },
          }}
          dataEntries={tableRows}
          cellRenderers={portfolioCellRenderers}
          isSortable={[true, true, true, false]}
          sortConfigs={{
            2: { type: SortType.Number },
          }}
          enableExport={false}
          actions={
            <div className={styles.inlineActions}>
              <WalletActionButton<string>
                label="Link wallet"
                kind="ghost"
                renderIcon={AddLarge}
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
          onRowClick={(_, rowIndex) => {
            const row = tableRows[rowIndex];
            if (row) {
              const walletAddress = row[0] as string;
              navigateToWalletDetail(walletAddress);
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
