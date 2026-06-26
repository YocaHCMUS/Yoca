import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Bot,
  Copy,
  Info,
  Pencil,
  Repeat2,
  Share2,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import client from "@/api/main";
import { PeriodSelector } from "@/components/common/PeriodSelector/PeriodSelector";
import { WalletLabelModal } from "@/components/wallet/WalletLabelModal/WalletLabelModal";
import { WalletTagsModal } from "@/components/wallet/WalletTagsModal/WalletTagsModal";
import {
  fetchWalletIntelligence,
  type WalletIntelligenceResponse,
  type WalletOverviewPeriodKey,
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

type FollowNotice = {
  kind: "success" | "error" | "warning";
  title: string;
  subtitle?: string;
  showManageAlerts?: boolean;
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
  const days = ageDays % 30;
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

type WalletWinRateStats = {
  winRate?: number;
  winCount?: number;
  lossCount?: number;
  totalTraded?: number;
  avgWinUsd?: number;
  avgLossUsd?: number;
};

export interface WalletTopbarProps {
  address: string;
  onAiAnalysisOpen: () => void;
  onAuditOpen: () => void;
  onExportData: () => void;
  onExportCharts: () => void;
  onExportPdf: () => void;
  isExporting: boolean;
  currentPeriod: WalletOverviewPeriodKey;
  winRatePeriod: "24H" | "7D" | "30D" | "90D";
  onPeriodChange: (period: WalletOverviewPeriodKey) => void;
  winRateStats?: WalletWinRateStats | null;
  winRateLoading?: boolean;
  isAiChatDocked?: boolean;
}

export function WalletTopbar({
  address,
  onAiAnalysisOpen,
  currentPeriod = "24H",
  winRatePeriod,
  onPeriodChange,
  winRateStats,
  winRateLoading = false,
  isAiChatDocked = false,
}: WalletTopbarProps) {
  const { user } = useAuth();
  const { tr, fmt, lang } = useLocalization();
  const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();
  const navigate = useNavigate();

  const [intelligence, setIntelligence] =
    useState<WalletIntelligenceResponse | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const { labels, setLabel: setApiLabel } = useWalletLabels();
  const label = labels[address] ?? "";
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [followedWallets, setFollowedWallets] = useState<FollowedWalletRow[]>(
    [],
  );
  const [followLoading, setFollowLoading] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [followNotice, setFollowNotice] = useState<FollowNotice | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isBookmarked = walletWatchlist.some(
    (item) => item.toLowerCase() === address.toLowerCase(),
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

  const safeWinRate = Math.max(
    0,
    Math.min(100, Number(winRateStats?.winRate ?? 0)),
  );
  const winCount = Number(winRateStats?.winCount ?? 0);
  const lossCount = Number(winRateStats?.lossCount ?? 0);
  const totalTraded = Number(winRateStats?.totalTraded ?? 0);
  const avgWinUsd = Number(winRateStats?.avgWinUsd ?? 0);
  const avgLossUsd = Number(winRateStats?.avgLossUsd ?? 0);
  const hasWinRateStats = Boolean(winRateStats) && Number.isFinite(safeWinRate);
  const isHighWinRate = safeWinRate >= 50;
  const localeCode = lang === "vi" ? "vi-VN" : "en-US";
  const formatWinRatePercent = (value: number) =>
    `${value.toLocaleString(localeCode, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const formatCount = (value: number) => fmt.num.compact.decimal(value);
  const winRateSummary = winRateLoading
    ? "--"
    : String(
        tr("walletPage.tokenWinRate.summaryShort", {
          win: formatCount(winCount),
          tradedCount: formatCount(totalTraded),
        }),
      );
  const formatCurrencyAbs = (value: number) =>
    fmt.num.compact.currency(Math.abs(value));
  const formatSignedCurrency = (value: number, sign: "+" | "-") =>
    winRateLoading ? "--" : `${sign}${formatCurrencyAbs(value)}`;

  useEffect(() => {
    if (!address || address === "null") return;
    fetchWalletIntelligence(address, "solana")
      .then(setIntelligence)
      .catch(() => setIntelligence(null));
  }, [address]);

  const loadFollowedWallets = useCallback(async () => {
    if (!user) {
      setFollowedWallets([]);
      setFollowLoading(false);
      return;
    }

    setFollowLoading(true);
    try {
      const res = await client.api.alerts.index.$get();
      if (!res.ok) throw new Error(`Failed to load followed wallets: ${res.status}`);
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

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      console.error("Failed to copy wallet address");
    }
  }, [address]);

  const handleLabelSave = useCallback(
    (newLabel: string) => setApiLabel(address, newLabel),
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

    setFollowNotice(null);
    setFollowPending(true);
    try {
      if (followedWallet) {
        const res = await (client.api.alerts as any)[":id"].$delete({
          param: { id: String(followedWallet.id) },
        });
        if (res.status === 404) {
          await loadFollowedWallets();
          setFollowNotice({ kind: "warning", title: tr("wallet.followWalletNotFound") });
          return;
        }
        if (!res.ok) throw new Error(`Failed to unfollow wallet: ${res.status}`);
        await res.json().catch(() => null);
        setFollowedWallets((current) =>
          current.filter((row) => row.id !== followedWallet.id),
        );
        setFollowNotice({ kind: "success", title: tr("wallet.walletUnfollowed") });
        return;
      }

      const res = await client.api.alerts.index.$post({ json: { address: address.trim() } });
      const body = (await res.json().catch(() => null)) as
        | FollowWalletResponse
        | { error?: string }
        | null;

      if (res.status === 409) {
        await loadFollowedWallets();
        setFollowNotice({
          kind: "warning",
          title: tr("wallet.walletAlreadyFollowed"),
          subtitle: tr("wallet.followWalletSuccessHint"),
          showManageAlerts: true,
        });
        return;
      }
      if (!res.ok || !body || !("wallet" in body)) {
        const error = body && "error" in body && typeof body.error === "string"
          ? body.error
          : `Failed to follow wallet: ${res.status}`;
        throw new Error(error);
      }

      setFollowedWallets((current) => mergeFollowedWalletRows(current, body.wallet));
      setFollowNotice({
        kind: body.heliusSync.ok ? "success" : "warning",
        title: tr("wallet.walletFollowed"),
        subtitle: body.heliusSync.ok
          ? tr("wallet.followWalletSuccessHint")
          : body.heliusSync.error || tr("wallet.followWalletSuccessHint"),
        showManageAlerts: true,
      });
    } catch (error) {
      console.error("[WalletTopbar] Failed to toggle followed wallet", error);
      setFollowNotice({
        kind: "error",
        title: isFollowed ? tr("wallet.unfollowWalletFailed") : tr("wallet.followWalletFailed"),
      });
      void loadFollowedWallets();
    } finally {
      setFollowPending(false);
    }
  }, [address, followPending, followedWallet, isFollowed, loadFollowedWallets, tr, user]);

  const handleOpenFirstFunder = useCallback(
    (funderAddress: string) => navigate(`/wallets/${encodeURIComponent(funderAddress)}`),
    [navigate],
  );

  const handleShare = useCallback(async () => {
    const shareData = { title: displayName, text: address, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(window.location.href);
    } catch {
      // User cancelled native sharing or clipboard is unavailable.
    }
  }, [address, displayName]);

  return (
    <>
      <div
        ref={cardRef}
        className={styles.topbar}
        data-chat-docked={isAiChatDocked ? "true" : "false"}
      >
        <section className={styles.identityCard} aria-label={String(tr("walletPage.currentWallet"))}>
          <div className={styles.walletGlyph}><Wallet size={18} strokeWidth={1.75} /></div>
          <div className={styles.identityContent}>
            <div className={styles.identityHeading}>
              <span className={styles.eyebrow}>{tr("walletPage.currentWallet")}</span>
              <span className={styles.addressLine}>
                <strong>{displayName}</strong>
                <code>{shortenWalletAddress(address)}</code>
                <button type="button" className={styles.inlineIconButton} onClick={handleCopyAddress} title={String(tr("walletPage.ui.copyAddress"))} aria-label={String(tr("walletPage.ui.copyAddress"))}>
                  <Copy size={14} strokeWidth={1.85} />
                </button>
                <button type="button" className={styles.inlineIconButton} onClick={() => setIsLabelModalOpen(true)} title={String(tr("walletPage.ui.editLabel"))} aria-label={String(tr("walletPage.ui.editLabel"))}>
                  <Pencil size={14} strokeWidth={1.85} />
                </button>
              </span>
            </div>
            <div className={styles.identityMeta}>
              {walletAgeLabel && <span className={styles.metaPill}>{walletAgeLabel}</span>}
              {identityStatus === "unknown" && <span className={styles.metaPill}>{tr("walletPage.unknownEntity")}</span>}
              {identityStatus === "known" && identityCategory && <span className={`${styles.metaPill} ${styles.metaPillAccent}`}>{identityCategory}</span>}
              {firstFundLabel && (
                <button type="button" className={`${styles.metaPill} ${styles.metaPillAction}`} onClick={() => firstFund?.funderAddress && handleOpenFirstFunder(firstFund.funderAddress)}>
                  {tr("walletPage.firstFunderTag")}: {shortenWalletAddress(firstFundLabel)}
                </button>
              )}
              {tags.slice(0, 2).map((tag) => <span key={tag} className={styles.metaPill}>{tag}</span>)}
              <button type="button" className={styles.manageTagsButton} onClick={() => user && setIsTagsModalOpen(true)} disabled={!user} title={user ? String(tr("walletPage.manageTagsLabel")) : String(tr("walletPage.signInManageTagsLabel"))}>
                <Tag size={13} strokeWidth={1.85} />
              </button>
            </div>
          </div>
        </section>

        <section className={styles.winRateCard} aria-label={String(tr("walletPage.tokenWinRate.title"))}>
          <div className={styles.winRateHeader}>
            <div>
              <span className={styles.eyebrow}>{tr("walletPage.tokenWinRate.title")}</span>
              <span className={styles.periodCaption}>{winRatePeriod}</span>
            </div>
            <div className={styles.winRateTooltipWrap}>
              <button type="button" className={styles.infoButton} aria-label={String(tr("walletPage.tokenWinRate.explanationAria"))}>
                <Info size={14} strokeWidth={1.9} />
              </button>
              <div className={styles.winRateTooltipPanel} role="tooltip">
                <p><strong>{tr("walletPage.tokenWinRate.tooltipWinRateLabel")}</strong> {tr("walletPage.tokenWinRate.tooltipWinRateDescription", { period: winRatePeriod })}</p>
                <dl>
                  <div><dt>{tr("walletPage.tokenWinRate.tooltipTotalTradedTokens")}</dt><dd>{formatCount(totalTraded)}</dd></div>
                  <div><dt>{tr("walletPage.tokenWinRate.tooltipRealizedProfitTokens")}</dt><dd>{formatCount(winCount)}</dd></div>
                  <div><dt>{tr("walletPage.tokenWinRate.tooltipRealizedLossTokens")}</dt><dd>{formatCount(lossCount)}</dd></div>
                  <div><dt>{tr("walletPage.tokenWinRate.tooltipClosedAvgLoss")}</dt><dd>{formatSignedCurrency(avgLossUsd, "-")}</dd></div>
                </dl>
              </div>
            </div>
          </div>
          <div className={styles.winRateBody}>
            <div className={styles.winRatePrimary}>
              <strong data-positive={isHighWinRate}>{winRateLoading || !hasWinRateStats ? "--" : formatWinRatePercent(safeWinRate)}</strong>
              <div className={styles.winRateTrack} aria-hidden="true">
                <span className={styles.winRateWin} style={{ width: `${winRateLoading || !hasWinRateStats ? 0 : safeWinRate}%` }} />
                <span className={styles.winRateLoss} style={{ width: `${winRateLoading || !hasWinRateStats ? 0 : 100 - safeWinRate}%` }} />
              </div>
              <small>{winRateSummary}</small>
            </div>
            <div className={styles.winRateMetric}>
              <span>{tr("walletPage.tokenWinRate.avgWin")}</span>
              <strong className={styles.positiveMetric}>{formatSignedCurrency(avgWinUsd, "+")}</strong>
            </div>
            <div className={styles.winRateMetric}>
              <span>{tr("walletPage.tokenWinRate.avgLoss")}</span>
              <strong className={styles.negativeMetric}>{formatSignedCurrency(avgLossUsd, "-")}</strong>
            </div>
          </div>
        </section>

        <section className={styles.actionsCard} aria-label={String(tr("walletPage.ui.actions"))}>
          <div className={styles.periodControl}>
            <span className={styles.eyebrow}>{tr("walletPage.ui.period")}</span>
            <PeriodSelector value={currentPeriod} onChange={(key) => onPeriodChange(key as WalletOverviewPeriodKey)} options={PERIOD_OPTIONS} compact />
          </div>
          <div className={styles.actionButtons}>
            <button type="button" className={styles.actionButton} onClick={handleBookmark} disabled={!user || isBookmarkPending} title={isBookmarked ? String(tr("wallet.bookmarked")) : String(tr("wallet.bookmarkWallet"))}>
              {isBookmarked ? <BookmarkCheck size={16} strokeWidth={1.85} /> : <Bookmark size={16} strokeWidth={1.85} />}
            </button>
            <button type="button" className={`${styles.actionButton} ${isFollowed ? styles.actionButtonActive : ""}`} onClick={handleFollowWallet} disabled={followButtonDisabled} aria-pressed={isFollowed} title={followButtonLabel}>
              {isFollowed ? <BellRing size={16} strokeWidth={1.85} /> : <Bell size={16} strokeWidth={1.85} />}
            </button>
            <button type="button" className={styles.actionButton} onClick={() => window.location.assign(`/comparison/wallets?wallets=${encodeURIComponent(address)}`)} title={String(tr("wallet.compareWallet"))}>
              <Repeat2 size={16} strokeWidth={1.85} />
            </button>
            <button type="button" className={styles.actionButton} onClick={() => void handleShare()} title={String(tr("wallet.shareWallet"))}>
              <Share2 size={16} strokeWidth={1.85} />
            </button>
            <button type="button" className={`${styles.actionButton} ${styles.aiActionButton}`} onClick={onAiAnalysisOpen} title={String(tr("walletPage.aiAnalysis"))}>
              <Bot size={16} strokeWidth={1.85} />
              <span>{tr("walletPage.aiAnalysis")}</span>
            </button>
          </div>
        </section>
      </div>

      {followNotice && (
        <div className={styles.followNotice} data-kind={followNotice.kind} role="status">
          <div>
            <strong>{followNotice.title}</strong>
            {followNotice.subtitle && <span>{followNotice.subtitle}</span>}
            {followNotice.showManageAlerts && <a href="/alerts">{tr("wallet.manageAlerts")}</a>}
          </div>
          <button type="button" onClick={() => setFollowNotice(null)} aria-label={String(tr("walletPage.ui.dismiss"))}><X size={15} strokeWidth={1.85} /></button>
        </div>
      )}

      <WalletLabelModal isOpen={isLabelModalOpen} onClose={() => setIsLabelModalOpen(false)} onSave={handleLabelSave} walletAddress={address} initialLabel={label} />
      <WalletTagsModal isOpen={isTagsModalOpen} onClose={() => setIsTagsModalOpen(false)} onSave={handleTagsSave} walletAddress={address} walletLabel={label || undefined} initialTags={tags} />
    </>
  );
}

export default WalletTopbar;
