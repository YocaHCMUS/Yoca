import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkFilled,
  Notification,
  Repeat,
  Share,
  AiGenerate,
  Report,
  Download,
  ChevronDown,
  Edit,
  Tag as TagIcon,
  Wallet,
  Copy,
} from "@carbon/icons-react";
import { CopyButton, Tag, Tooltip } from "@carbon/react";
import { PeriodSelector } from "@/components/common/PeriodSelector/PeriodSelector";
import { WalletLabelModal } from "@/components/wallet/WalletLabelModal/WalletLabelModal";
import { WalletTagsModal } from "@/components/wallet/WalletTagsModal/WalletTagsModal";
import {
  fetchWalletIntelligence,
  fetchWalletOverview,
  type WalletIntelligenceResponse,
  type WalletOverviewMultiPeriodResponse,
  type WalletOverviewPeriodKey,
} from "@/services/wallet/walletApi";
import { fetchWalletTags, saveWalletTags } from "@/services/wallet/walletTagsApi";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { PERIOD_OPTIONS } from "@/config/periodOptions";
import { useNavigate } from "react-router";
import type { TimePeriod } from "@/types/chart-filters.types";
import styles from "./WalletTopbar.module.scss";

function shortenWalletAddress(address: string): string {
  const normalized = address.trim();
  if (normalized.length <= 14) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
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

function resolveWalletAgeDays(firstFund: { walletAgeDays?: number | null; firstFundTimestampSec?: number | null } | null | undefined): number | null {
  if (!firstFund) return null;
  if (firstFund.walletAgeDays != null && Number.isFinite(firstFund.walletAgeDays)) {
    return Math.max(0, Math.floor(firstFund.walletAgeDays));
  }
  if (firstFund.firstFundTimestampSec != null && Number.isFinite(firstFund.firstFundTimestampSec)) {
    const elapsedMs = Math.max(0, Date.now() - firstFund.firstFundTimestampSec * 1000);
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
  onAuditOpen,
  onExportData,
  onExportCharts,
  onExportPdf,
  isExporting,
  currentPeriod = "24H",
  onPeriodChange,
}: WalletTopbarProps) {
  const { user } = useAuth();
  const { tr, fmt } = useLocalization();
  const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();
  const navigate = useNavigate();

  const [intelligence, setIntelligence] = useState<WalletIntelligenceResponse | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [label, setLabel] = useState<string>(() => {
    return localStorage.getItem(`wallet-label-${address}`) ?? "";
  });
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isBookmarked = walletWatchlist.some(
    (a) => a.toLowerCase() === address.toLowerCase(),
  );
  const isBookmarkPending = Boolean(walletPending[address]);

  const identityStatus = intelligence?.identity?.status ?? null;
  const identityName = intelligence?.identity?.name ?? null;
  const identityCategory = intelligence?.identity?.category ?? null;
  const firstFund = intelligence?.analysis?.firstFund ?? null;
  const firstFundLabel = firstFund?.funderLabel ?? firstFund?.funderAddress ?? null;
  const walletAgeDays = resolveWalletAgeDays(firstFund);
  const walletAgeLabel = walletAgeDays != null
    ? formatLocalizedWalletAge(walletAgeDays, {
      day: String(tr("walletPage.walletAgeUnitDay")),
      month: String(tr("walletPage.walletAgeUnitMonth")),
      year: String(tr("walletPage.walletAgeUnitYear")),
    })
    : null;

  const name = label || (identityStatus === "known" && identityName ? identityName : tr("walletPage.defaultWalletName"));
  const displayedAddress = identityStatus === "unknown" ? shortenWalletAddress(address) : address;

  useEffect(() => {
    if (!address || address === "null") return;
    fetchWalletIntelligence(address, "solana").then(setIntelligence).catch(() => { });
  }, [address]);

  useEffect(() => {
    if (!user || !address || address === "null") {
      setTags([]);
      return;
    }
    fetchWalletTags(address).then(setTags).catch(() => setTags([]));
  }, [address, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExportMenuOpen]);

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      console.error("Failed to copy wallet address");
    }
  }, [address]);

  const handleLabelSave = useCallback((newLabel: string) => {
    setLabel(newLabel);
    const key = `wallet-label-${address}`;
    if (newLabel) {
      localStorage.setItem(key, newLabel);
    } else {
      localStorage.removeItem(key);
    }
  }, [address]);

  const handleTagsSave = useCallback(async (newTags: string[]) => {
    try {
      await saveWalletTags(address, newTags);
      setTags(newTags);
    } catch {
      console.error("[WalletTopbar] Failed to save tags");
    }
  }, [address]);

  const handleBookmark = useCallback(() => {
    if (!user || !address || address === "null") return;
    void toggleWallet(address);
  }, [user, address, toggleWallet]);

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
          <div className={styles.topbarAvatar}>
            <Wallet size={16} />
          </div>
          <div className={styles.topbarIdentity}>
            <div className={styles.topbarAddress}>
              <span className={styles.topbarAddressText}>{displayedAddress}</span>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={handleCopyAddress}
                aria-label="Copy address"
              >
                <Copy size={13} />
              </button>
              <button
                className={styles.editLabelBtn}
                onClick={() => setIsLabelModalOpen(true)}
                aria-label="Edit wallet label"
                title="Assign custom label"
              >
                <Edit size={16} />
              </button>
            </div>
            <div className={styles.topbarSub}>
              {walletAgeLabel && (
                <span className={styles.chipGreen}>{walletAgeLabel}</span>
              )}
              {identityStatus === "unknown" && (
                <span className={styles.chipGray}>{tr("walletPage.unknownEntity")}</span>
              )}
              {identityStatus === "known" && identityCategory && (
                <Tag size="sm" type="teal">{identityCategory}</Tag>
              )}
              {firstFundLabel && (
                <button
                  type="button"
                  className={styles.inlineTagBtn}
                  onClick={() => firstFund?.funderAddress && handleOpenFirstFunder(firstFund.funderAddress)}
                >
                  <Tag size="sm" type="blue">
                    {String(tr("walletPage.firstFunderTag"))}: {firstFundLabel}
                  </Tag>
                </button>
              )}
              {tags.map((tag) => (
                <Tag key={tag} size="sm" type="cyan">{tag}</Tag>
              ))}
              <button
                type="button"
                className={styles.inlineTagBtn}
                onClick={() => user && setIsTagsModalOpen(true)}
                disabled={!user}
              >
                <TagIcon size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarRow}>
            <PeriodSelector
              value={currentPeriod}
              onChange={(key) => onPeriodChange(key as WalletOverviewPeriodKey)}
              options={PERIOD_OPTIONS}
              compact
            />
          </div>
          <div className={styles.topbarRow}>
            <Tooltip label={isBookmarked ? tr("wallet.bookmarked") : tr("wallet.bookmarkWallet")} align="bottom-left">
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleBookmark}
                disabled={!user || isBookmarkPending}
              >
                {isBookmarked ? <BookmarkFilled size={16} /> : <Bookmark size={16} />}
              </button>
            </Tooltip>
            <Tooltip label={tr("wallet.createAlert")} align="bottom-left">
              <button type="button" className={styles.iconBtn}>
                <Notification size={16} />
              </button>
            </Tooltip>
            <Tooltip label={tr("wallet.compareWallet")} align="bottom-left">
              <button type="button" className={styles.iconBtn} onClick={() => window.location.assign(`/comparison/wallets?wallets=${encodeURIComponent(address)}`)}>
                <Repeat size={16} />
              </button>
            </Tooltip>
            <Tooltip label={tr("wallet.shareWallet")} align="bottom-left">
              <button type="button" className={styles.iconBtn}>
                <Share size={16} />
              </button>
            </Tooltip>
            <Tooltip label="AI Analysis" align="bottom-left">
              <button type="button" className={styles.iconBtn} onClick={onAiAnalysisOpen}>
                <AiGenerate size={16} />
              </button>
            </Tooltip>
            {/* <Tooltip label="Forensic Audit" align="bottom-left">
              <button type="button" className={styles.iconBtn} onClick={onAuditOpen}>
                <Report size={16} />
              </button>
            </Tooltip>
            <div className={styles.exportMenuWrapper} ref={exportMenuRef}>
              <button
                type="button"
                className={styles.ibtn}
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                disabled={isExporting}
              >
                <Download size={13} />
                {tr("charts.export")}
                <ChevronDown size={13} />
              </button>
              {isExportMenuOpen && (
                <div className={styles.exportMenu}>
                  <button type="button" className={styles.exportMenuItem} onClick={onExportData} disabled={isExporting}>
                    <Download size={16} />
                    Export XLSX
                  </button>
                  <button type="button" className={styles.exportMenuItem} onClick={onExportCharts} disabled={isExporting}>
                    <Download size={16} />
                    Export Charts ZIP
                  </button>
                  <button type="button" className={styles.exportMenuItem} onClick={onExportPdf} disabled={isExporting}>
                    <Download size={16} />
                    Export PDF Report
                  </button>
                </div>
              )}
            </div> */}
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
