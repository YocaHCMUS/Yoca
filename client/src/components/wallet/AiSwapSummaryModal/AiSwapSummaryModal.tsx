import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Close, ChevronDown, ChevronRight } from "@carbon/react/icons";
import { SkeletonPlaceholder, SkeletonText } from "@carbon/react";
import { ID_MODAL_ROOT } from "@/config/constants";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import {
  fetchWalletAiSwapSummary,
  WalletAiApiError,
  type WalletAiSwapSummaryResponse,
  type WalletAiAnalysisLanguage,
} from "@/services/wallet/walletApi";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { TokenDeepAnalysisView } from "./TokenDeepAnalysisView";
// import { MiniHistogram } from "./MiniHistogram";
import styles from "./ai-swap-summary.module.scss";
import { TrendNum } from "@/components/TrendNum";

const PAGE_SIZE = 10;

interface AiSwapSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

interface TokenTab {
  tokenAddress: string;
  symbol: string;
  name: string | null;
  logoUri: string | null;
}

const SUMMARY_TAB_ID = "summary";

function SummaryContent({
  report,
  onOpenTokenTab,
}: {
  report: WalletAiSwapSummaryResponse;
  onOpenTokenTab: (t: TokenTab) => void;
}) {
  const { tr, fmt } = useLocalization();
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => [...report.allTokenBreakdowns].sort((a, b) => (sortAsc ? a.pnlUsd - b.pnlUsd : b.pnlUsd - a.pnlUsd)),
    [report.allTokenBreakdowns, sortAsc],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageTokens = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page]);

  useEffect(() => { setPage(0); }, [sortAsc]);

  const toggleExpand = (addr: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(addr)) next.delete(addr);
      else next.add(addr);
      return next;
    });
  };

  return (
    <div className={styles.twoColumnLayout}>
      <div className={styles.leftColumn}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.realizedPnl")}</span>
            <span className={styles.statValue}>
              <TrendNum
                value={report.realizedPnlUsd}
                prefixes="plus-minus"
                formatter={fmt.num.currency}
              />
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.winRate")}</span>
            <span className={styles.statValue}>{report.winningPercentage.toFixed(1)}%</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.trades")}</span>
            <span className={styles.statValue}>{report.tradeCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.volume")}</span>
            <span className={styles.statValue}>
              {fmt.num.compact.currency(report.totalBoughtUsd + report.totalSoldUsd)}
            </span>
          </div>
        </div>

        <div className={styles.summarySection}>
          <h3 className={styles.summaryTitle}>
            {tr("walletPage.aiSwapSummary.summary")}
          </h3>
          <p className={styles.summaryText}>{report.summary}</p>
        </div>

        {report.riskNotes.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              {tr("walletPage.aiSwapSummary.riskAnalysis")}
            </h4>
            <ul className={styles.riskList}>
              {report.riskNotes.map((note, i) => (
                <li key={i} className={styles.riskItem}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        {report.cached && (
          <p className={styles.cachedHint}>
            {tr("walletPage.aiSwapSummary.cachedResult")}
          </p>
        )}
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.rankedHeader}>
          <span className={styles.rankedTitle}>
            {tr("walletPage.aiSwapSummary.allTokens")}
          </span>
          <button
            type="button"
            className={styles.sortToggle}
            onClick={() => setSortAsc(!sortAsc)}
            title={sortAsc ? tr("walletPage.aiSwapSummary.sortedWorst") : tr("walletPage.aiSwapSummary.sortedBest")}
          >
            PnL {sortAsc ? "↑" : "↓"}
          </button>
        </div>
        <div className={styles.rankedList}>
          {pageTokens.map((t) => {
            const isExpanded = expandedSet.has(t.address);
            return (
              <div key={t.address} className={styles.rankedEntry}>
                <div
                  className={styles.rankedRow}
                  onClick={() => toggleExpand(t.address)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(t.address); } }}
                >
                  <TokenIdentityCell
                    symbol={t.symbol ?? t.address}
                    fullName={t.name ?? t.symbol ?? t.address}
                    imageUrl={t.logoUri}
                    imageSize={20}
                    tooltipAlign="right"
                  />
                  <span className={styles.rankedSpacer} />
                  <span className={styles.rankedPnl}>
                    <TrendNum
                      value={t.pnlUsd}
                      prefixes="plus-minus"
                      formatter={fmt.num.currency}
                    />
                  </span>
                  <span className={styles.rankedBuySell}>
                    <span className={styles.rankedBuyLabel}>{t.buyCount}</span>
                    {/* {tr("walletPage.buy")} */}
                    <span className={styles.rankedSlash}>/</span>
                    <span className={styles.rankedSellLabel}>{t.sellCount}</span>
                    {/* {tr("walletPage.sell")} */}
                  </span>
                  <span className={styles.rankedChevron}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </div>
                {isExpanded && (
                  <div className={styles.expandedDetail}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.hold")}</span>
                      <span className={styles.detailValue}>{fmt.datetime.duration(t.longestHoldingTimeMs)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.winRate")}</span>
                      <span className={styles.detailValue}>{t.sellCount > 0 ? (t.wins / t.exits * 100).toFixed(1) + "%" : "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.maxLoss")}</span>
                      <span className={`${styles.detailValue} ${styles.lossValue}`}>{fmt.num.percentagePoint(t.maxTolerableLossPercent)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.bought")}</span>
                      <span className={styles.detailValue}>
                        <span className={styles.detailAmount}>{fmt.num.compact.decimal(t.totalEnteredAmount)}</span>
                        <span className={styles.detailVolume}>{fmt.num.compact.currency(t.totalBoughtVolumeUsd)}</span>
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.sold")}</span>
                      <span className={styles.detailValue}>
                        <span className={styles.detailAmount}>{fmt.num.compact.decimal(t.totalExitedAmount)}</span>
                        <span className={styles.detailVolume}>{fmt.num.compact.currency(t.totalSoldVolumeUsd)}</span>
                      </span>
                    </div>
                    <div className={styles.analyzeRow}>
                      <button
                        type="button"
                        className={styles.analyzeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTokenTab({
                            tokenAddress: t.address,
                            symbol: t.symbol ?? t.address,
                            name: t.name ?? null,
                            logoUri: t.logoUri ?? null,
                          });
                        }}
                      >
                        {tr("walletPage.aiSwapSummary.analyze")} →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {pageCount > 1 && (
          <div className={styles.paginationRow}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              {tr("walletPage.aiSwapSummary.pagePrev")}
            </button>
            <span className={styles.pageInfo}>{page + 1} / {pageCount}</span>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              {tr("walletPage.aiSwapSummary.pageNext")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className={styles.twoColumnLayout}>
      <div className={styles.leftColumn}>
        <div className={styles.statsRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.statCard}>
              <SkeletonText width="80%" />
              <SkeletonPlaceholder style={{ height: 24, width: "60%", margin: "0 auto" }} />
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <SkeletonText heading width="40%" />
          <SkeletonText width="100%" />
          <SkeletonText width="100%" />
          <SkeletonText width="75%" />
        </div>
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <SkeletonText width="30%" />
          <SkeletonText width="90%" />
          <SkeletonText width="85%" />
        </div>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.rankedHeader}>
          <SkeletonText width="40%" />
          <SkeletonText width="20%" />
        </div>
        <div className={styles.rankedList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.rankedRow}>
              <SkeletonPlaceholder style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />
              <SkeletonText width="60%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AiSwapSummaryModal({
  isOpen,
  onClose,
  walletAddress,
}: AiSwapSummaryModalProps) {
  const { tr, lang } = useLocalization();
  const { user, isUserLoading, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WalletAiSwapSummaryResponse | null>(null);
  const [tabs, setTabs] = useState<TokenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>(SUMMARY_TAB_ID);

  const apiLanguage: WalletAiAnalysisLanguage = lang === "vi" ? "vn" : "en";

  const fetch = useCallback(async () => {
    if (!isOpen || !walletAddress) return;
    if (isUserLoading) return;
    if (!user) {
      openAuthModal("login");
      setError(String(tr("walletPage.aiSwapSummary.signInRequired")));
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await fetchWalletAiSwapSummary(walletAddress, apiLanguage);
      setReport(result);
    } catch (err) {
      if (err instanceof WalletAiApiError) {
        if (err.status === 401) openAuthModal("login");
      }
      setError(err instanceof Error ? err.message : "Failed to load AI swap summary");
    } finally {
      setLoading(false);
    }
  }, [
    isOpen,
    walletAddress,
    apiLanguage,
    user,
    isUserLoading,
    openAuthModal,
    tr,
  ]);

  useEffect(() => {
    if (isOpen) {
      setTabs([]);
      setActiveTab(SUMMARY_TAB_ID);
      void fetch();
    }
  }, [isOpen, fetch]);

  const openTokenTab = useCallback((tab: TokenTab) => {
    setTabs((prev) => {
      const exists = prev.some((t) => t.tokenAddress === tab.tokenAddress);
      if (exists) return prev;
      return [...prev, tab];
    });
    setActiveTab(tab.tokenAddress);
  }, []);

  const closeTokenTab = useCallback((tokenAddress: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.tokenAddress !== tokenAddress);
      return next;
    });
    setActiveTab((current) => {
      if (current === tokenAddress) return SUMMARY_TAB_ID;
      return current;
    });
  }, []);

  if (!isOpen) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  const hasTokenTabs = tabs.length > 0;

  return ReactDOM.createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tr("walletPage.aiSwapSummary.title")}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {hasTokenTabs && (
              <div className={styles.tabBar}>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === SUMMARY_TAB_ID ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab(SUMMARY_TAB_ID)}
                >
                  {tr("walletPage.aiSwapSummary.title")}
                </button>
                {tabs.map((tab) => (
                  <div key={tab.tokenAddress} className={`${styles.tab} ${activeTab === tab.tokenAddress ? styles.tabActive : ""}`}>
                    <button
                      type="button"
                      className={styles.tabLabelBtn}
                      onClick={() => setActiveTab(tab.tokenAddress)}
                    >
                      {tab.symbol}
                    </button>
                    <button
                      type="button"
                      className={styles.tabCloseBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTokenTab(tab.tokenAddress);
                      }}
                      aria-label={`Close ${tab.symbol} tab`}
                    >
                      <Close size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!hasTokenTabs && (
              <span className={styles.title}>{tr("walletPage.aiSwapSummary.title")}</span>
            )}
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <Close size={20} />
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className={styles.errorState}>
            <p className={styles.errorText}>{error}</p>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void fetch()}
            >
              {tr("walletPage.aiSwapSummary.retry")}
            </button>
          </div>
        ) : activeTab === SUMMARY_TAB_ID && report ? (
          <SummaryContent
            report={report}
            onOpenTokenTab={openTokenTab}
          />
        ) : activeTab !== SUMMARY_TAB_ID ? (
          <TokenDeepAnalysisView
            walletAddress={walletAddress}
            tokenAddress={activeTab}
            apiLanguage={apiLanguage}
          />
        ) : null}
      </div>
    </div>,
    modalRoot,
  );
}
