import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkFilled,
  Notification,
  NotificationFilled,
  Repeat,
  Share,
  AiGenerate,
  Edit,
  Tag as TagIcon,
} from "@carbon/icons-react";
import { Tag } from "@carbon/react";
import { Tooltip } from "@/components/common/Tooltip";
import { useToast } from "@/components/common/Toast";
import client from "@/api/main";
import { SegmentedControl } from "@/components/charts/shared/ChartControls";
import { AddressPill } from "@/components/common/AddressPill/AddressPill";
import { StatusBadge } from "@/components/common/StatusBadge/StatusBadge";
import { WalletLabelModal } from "@/components/wallet/WalletLabelModal/WalletLabelModal";
import { WalletTagsModal } from "@/components/wallet/WalletTagsModal/WalletTagsModal";
import {
  fetchWalletIntelligence,
  type WalletIntelligenceResponse,
  type WalletOverviewPeriodKey
} from "@/services/wallet/walletApi";
import {
  fetchWalletTags,
  saveWalletTags,
} from "@/services/wallet/walletTagsApi";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { PERIOD_OPTIONS } from "@/config/periodOptions";
import { useNavigate } from "react-router";
import { useWalletLabels } from "@/hooks/profile/useWalletLabels";
import styles from "./WalletTopbar.module.scss";

type FollowedWalletRow = {
  id: number;
  address: string;
  label: string | null;
  createdAt: string;
};

type HeliusSyncResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

type FollowWalletResponse = {
  wallet: FollowedWalletRow;
  heliusSync: HeliusSyncResult;
};

type DeleteFollowedWalletEndpoint = {
  ":id": {
    $delete: (args: { param: { id: string } }) => Promise<Response>;
  };
};

function shortenWalletAddress(address: string): string {
  const normalized = address.trim();
  if (normalized.length <= 14) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function normalizeWalletAddress(address: string): string {
  return address.trim().toLowerCase();
}

function mergeFollowedWalletRows(
  rows: FollowedWalletRow[],
  wallet: FollowedWalletRow,
): FollowedWalletRow[] {
  const walletKey = normalizeWalletAddress(wallet.address);
  const exists = rows.some(
    (row) => normalizeWalletAddress(row.address) === walletKey,
  );
  return exists ? rows : [...rows, wallet];
}

function formatLocalizedWalletAge(
  ageDays: number,
  units: { day: string; month: string; year: string },
): string {
  const years = Math.floor(ageDays / 365);
  const remainingAfterYears = ageDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears % 30;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${units.year}`);
  if (months > 0) parts.push(`${months} ${units.month}`);
  if (days > 0 && years === 0) parts.push(`${days} ${units.day}`);
  return parts.length > 0 ? parts.slice(0, 2).join(" ") : `0 ${units.day}`;
}

function resolveWalletAgeDays(
  firstFund:
    | { walletAgeDays?: number | null; firstFundTimestampSec?: number | null }
    | null
    | undefined,
): number | null {
  if (!firstFund) return null;
  if (
    firstFund.walletAgeDays != null &&
    Number.isFinite(firstFund.walletAgeDays)
  ) {
    return Math.max(0, Math.floor(firstFund.walletAgeDays));
  }
  if (
    firstFund.firstFundTimestampSec != null &&
    Number.isFinite(firstFund.firstFundTimestampSec)
  ) {
    const elapsedMs = Math.max(
      0,
      Date.now() - firstFund.firstFundTimestampSec * 1000,
    );
    return Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  }
  return null;
}

export interface WalletTopbarProps {
  address: string;
  onAiAnalysisOpen: () => void;
  onAuditOpen: () => void;
  onExportData: () => void;
  onExportCharts: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
  currentPeriod: WalletOverviewPeriodKey;
  onPeriodChange: (period: WalletOverviewPeriodKey) => void;
}

export function WalletTopbar({
  address,
  onAiAnalysisOpen,
  currentPeriod = "24H",
  onPeriodChange,
}: WalletTopbarProps) {
  const { user } = useAuth();
  const { tr } = useLocalization();
  const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [intelligence, setIntelligence] =
    useState<WalletIntelligenceResponse | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const { labels, setLabel: setApiLabel } = useWalletLabels();
  const label = labels[address] ?? "";
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [followedWallets, setFollowedWallets] = useState<FollowedWalletRow[]>(
    [],
  );
  const [followLoading, setFollowLoading] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isBookmarked = walletWatchlist.some(
    (a) => a.toLowerCase() === address.toLowerCase(),
  );
  const isBookmarkPending = Boolean(walletPending[address]);
  const normalizedAddress = normalizeWalletAddress(address);
  const followedWallet = followedWallets.find(
    (row) => normalizeWalletAddress(row.address) === normalizedAddress,
  );
  const isFollowed = Boolean(followedWallet);
  const followButtonLabel = isFollowed
    ? tr("wallet.unfollowWallet")
    : tr("wallet.followWallet");
  const followButtonDisabled =
    !user ||
    !address ||
    address === "null" ||
    followLoading ||
    followPending;

  const identityStatus = intelligence?.identity?.status ?? null;
  const identityName = intelligence?.identity?.name ?? null;
  const identityCategory = intelligence?.identity?.category ?? null;
  const firstFund = intelligence?.analysis?.firstFund ?? null;
  const firstFundLabel =
    firstFund?.funderLabel ?? firstFund?.funderAddress ?? null;
  const walletAgeDays = resolveWalletAgeDays(firstFund);
  const walletAgeLabel =
    walletAgeDays != null
      ? formatLocalizedWalletAge(walletAgeDays, {
        day: String(tr("walletPage.walletAgeUnitDay")),
        month: String(tr("walletPage.walletAgeUnitMonth")),
        year: String(tr("walletPage.walletAgeUnitYear")),
      })
      : null;

  const displayName =
    label ||
    (identityStatus === "known" && identityName
      ? identityName
      : shortenWalletAddress(address));

  useEffect(() => {
    if (!address || address === "null") return;
    fetchWalletIntelligence(address, "solana")
      .then(setIntelligence)
      .catch(() => { });
  }, [address]);

  const loadFollowedWallets = useCallback(async () => {
    if (!user) {
      setFollowedWallets([]);
      setFollowLoading(false);
      return;
    }

    setFollowLoading(true);
    try {
      const res = await client.api.alerts.$get();
      if (!res.ok) {
        throw new Error(`Failed to load followed wallets: ${res.status}`);
      }
      const data = (await res.json()) as FollowedWalletRow[];
      setFollowedWallets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("[WalletTopbar] Failed to load followed wallets", error);
      setFollowedWallets([]);
    } finally {
      setFollowLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadFollowedWallets();
  }, [loadFollowedWallets]);

  useEffect(() => {
    if (!user || !address || address === "null") {
      setTags([]);
      return;
    }
    fetchWalletTags(address)
      .then(setTags)
      .catch(() => setTags([]));
  }, [address, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExportMenuOpen]);

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      console.error("Failed to copy wallet address");
    }
  }, [address]);

  const handleLabelSave = useCallback(
    (newLabel: string) => {
      setApiLabel(address, newLabel);
    },
    [address, setApiLabel],
  );

  const handleTagsSave = useCallback(
    async (newTags: string[]) => {
      try {
        await saveWalletTags(address, newTags);
        setTags(newTags);
      } catch {
        console.error("[WalletTopbar] Failed to save tags");
      }
    },
    [address],
  );

  const handleBookmark = useCallback(() => {
    if (!user || !address || address === "null") return;
    void toggleWallet(address);
  }, [user, address, toggleWallet]);

  const handleFollowWallet = useCallback(async () => {
    if (!user || !address || address === "null" || followPending) return;

    setFollowPending(true);

    try {
      if (followedWallet) {
        const alertsApi = client.api.alerts as typeof client.api.alerts &
          DeleteFollowedWalletEndpoint;
        const res = await alertsApi[":id"].$delete({
          param: { id: String(followedWallet.id) },
        });
        if (res.status === 404) {
          await loadFollowedWallets();
          toast("warning", tr("wallet.followWalletNotFound"));
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to unfollow wallet: ${res.status}`);
        }
        await res.json().catch(() => null);
        setFollowedWallets((prev) =>
          prev.filter((row) => row.id !== followedWallet.id),
        );
        toast("success", tr("wallet.walletUnfollowed"));
        return;
      }

      const res = await client.api.alerts.$post({
        json: { address: address.trim() },
      });
      const body = (await res.json().catch(() => null)) as
        | FollowWalletResponse
        | { error?: string }
        | null;

      if (res.status === 409) {
        await loadFollowedWallets();
        toast("warning", tr("wallet.walletAlreadyFollowed"), {
          subtitle: tr("wallet.followWalletSuccessHint"),
          action: {
            label: tr("wallet.manageAlerts"),
            onClick: () => window.location.assign("/alerts"),
          },
        });
        return;
      }
      if (!res.ok || !body || !("wallet" in body)) {
        const error =
          body && "error" in body && typeof body.error === "string"
            ? body.error
            : `Failed to follow wallet: ${res.status}`;
        throw new Error(error);
      }

      setFollowedWallets((prev) => mergeFollowedWalletRows(prev, body.wallet));
      toast(
        body.heliusSync.ok ? "success" : "warning",
        tr("wallet.walletFollowed"),
        {
          subtitle: body.heliusSync.ok
            ? tr("wallet.followWalletSuccessHint")
            : body.heliusSync.error || tr("wallet.followWalletSuccessHint"),
          action: {
            label: tr("wallet.manageAlerts"),
            onClick: () => window.location.assign("/alerts"),
          },
        },
      );
    } catch (error) {
      console.error("[WalletTopbar] Failed to toggle followed wallet", error);
      toast(
        "error",
        isFollowed
          ? tr("wallet.unfollowWalletFailed")
          : tr("wallet.followWalletFailed"),
      );
      void loadFollowedWallets();
    } finally {
      setFollowPending(false);
    }
  }, [
    address,
    followPending,
    followedWallet,
    isFollowed,
    loadFollowedWallets,
    toast,
    tr,
    user,
  ]);

  const handleOpenFirstFunder = useCallback(
    (funderAddress: string) => {
      navigate(`/wallets/${encodeURIComponent(funderAddress)}`);
    },
    [navigate],
  );

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <img
            className={styles.topbarAvatar}
            src={`https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(address)}`}
            alt=""
          />
          <div className={styles.topbarIdentity}>
            <div className={styles.topbarNameRow}>
              <span className={styles.topbarName}>{displayName}</span>
              {displayName !== shortenWalletAddress(address) &&
                displayName !== address && (
                  <AddressPill
                    address={address}
                    size="sm"
                  />
                )}
              <button
                type="button"
                className={styles.iconBtnSmall}
                onClick={handleCopyAddress}
                aria-label="Copy address"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="10" height="10" rx="1.5" />
                  <path d="M4 4V2.5A1.5 1.5 0 0 1 5.5 1h8A1.5 1.5 0 0 1 15 2.5v8a1.5 1.5 0 0 1-1.5 1.5H12" />
                </svg>
              </button>
              <button
                className={styles.iconBtnSmall}
                onClick={() => setIsLabelModalOpen(true)}
                aria-label="Edit wallet label"
                title="Assign custom label"
              >
                <Edit size={14} />
              </button>
            </div>
            <div className={styles.topbarTags}>
              {walletAgeLabel && (
                <StatusBadge label={walletAgeLabel} variant="success" size="sm" />
              )}
              {identityStatus === "unknown" && (
                <StatusBadge label={tr("walletPage.unknownEntity")} variant="neutral" size="sm" />
              )}
              {identityStatus === "known" && identityCategory && (
                <StatusBadge label={identityCategory} variant="info" size="sm" />
              )}
              {firstFundLabel && (
                <button
                  type="button"
                  className={styles.tagBtn}
                  onClick={() =>
                    firstFund?.funderAddress &&
                    handleOpenFirstFunder(firstFund.funderAddress)
                  }
                >
                  <Tag size="sm" type="blue">
                    {String(tr("walletPage.firstFunderTag"))}: {firstFundLabel}
                  </Tag>
                </button>
              )}
              {tags.map((tag) => (
                <Tag key={tag} size="sm" type="cyan">
                  {tag}
                </Tag>
              ))}
              <button
                type="button"
                className={styles.tagBtn}
                onClick={() => user && setIsTagsModalOpen(true)}
                disabled={!user}
              >
                <TagIcon size={16} />
              </button>
            </div>
          </div>
        </div>


        <div className={styles.topbarRight}>
          <div className={styles.periodTabs}>
          <SegmentedControl
            className={styles.periodTabs}
            options={PERIOD_OPTIONS.map((opt) => ({
              label: tr(opt.labelKey),
              value: opt.key,
            }))}
            value={currentPeriod}
            onChange={(key) => onPeriodChange(key as WalletOverviewPeriodKey)}
            ariaLabel={tr("charts.timePeriod")}
          />
          </div>

          <div className={styles.topbarActions}>
            <Tooltip
              label={isBookmarked ? tr("wallet.bookmarked") : tr("wallet.bookmarkWallet")}
              align="bottom-left"
            >
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleBookmark}
                disabled={!user || isBookmarkPending}
              >
                {isBookmarked ? <BookmarkFilled size={16} /> : <Bookmark size={16} />}
              </button>
            </Tooltip>
            <Tooltip label={followButtonLabel} align="bottom-left">
              <button
                type="button"
                className={`${styles.iconBtn} ${isFollowed ? styles.iconBtnActive : ""}`}
                onClick={handleFollowWallet}
                disabled={followButtonDisabled}
                aria-label={followButtonLabel}
                aria-pressed={isFollowed}
                title={followButtonLabel}
              >
                {isFollowed ? <NotificationFilled size={16} /> : <Notification size={16} />}
              </button>
            </Tooltip>
            <Tooltip label={tr("wallet.compareWallet")} align="bottom-left">
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() =>
                  window.location.assign(
                    `/comparison/wallets?wallets=${encodeURIComponent(address)}`,
                  )
                }
              >
                <Repeat size={16} />
              </button>
            </Tooltip>
            <Tooltip label={tr("wallet.shareWallet")} align="bottom-left">
              <button type="button" className={styles.iconBtn}>
                <Share size={16} />
              </button>
            </Tooltip>
            <Tooltip label="AI Analysis" align="bottom-left">
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onAiAnalysisOpen}
              >
                <AiGenerate size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <WalletLabelModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        onSave={handleLabelSave}
        walletAddress={address}
        initialLabel={label}
      />
      <WalletTagsModal
        isOpen={isTagsModalOpen}
        onClose={() => setIsTagsModalOpen(false)}
        onSave={handleTagsSave}
        walletAddress={address}
        walletLabel={label || undefined}
        initialTags={tags}
      />
    </>
  );
}

export default WalletTopbar;
