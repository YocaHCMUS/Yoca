import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Close, ChevronDown, ChevronRight } from "@carbon/react/icons";
import { Loading } from "@carbon/react";
import { ID_MODAL_ROOT } from "@/config/constants";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import TrendNumWithSign from "@/components/TrendNumWithSign.tsx";
import {
  fetchWalletAiSwapSummary,
  type WalletAiSwapSummaryResponse,
  type WalletAiAnalysisLanguage,
} from "@/services/wallet/walletApi";
import { useLocalization } from "@/contexts/LocalizationContext";
// import { MiniHistogram } from "./MiniHistogram";
import styles from "./ai-swap-summary.module.scss";

const PAGE_SIZE = 10;

interface AiSwapSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

function formatPriceCompact(n: number): string {
  if (n < 0.001) return n.toExponential(4);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function SummaryContent({ report }: { report: WalletAiSwapSummaryResponse }) {
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
              <TrendNumWithSign
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
                  <span className={styles.rankedPnl}>
                    <TrendNumWithSign
                      value={t.pnlUsd}
                      prefixes="plus-minus"
                      formatter={fmt.num.currency}
                    />
                  </span>
                  <span className={styles.rankedBuySell}>{t.buyCount}b / {t.sellCount}s</span>
                  <span className={styles.rankedChevron}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </div>
                {isExpanded && (
                  <div className={styles.expandedDetail}>
                    {/* <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.entry")}</span>
                      <span className={styles.detailValue}>
                        <MiniHistogram prices={t.entryPrices ?? []} />
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.exit")}</span>
                      <span className={styles.detailValue}>
                        <MiniHistogram prices={t.exitPrices ?? []} />
                      </span>
                    </div> */}
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.hold")}</span>
                      <span className={styles.detailValue}>{fmt.datetime.duration(t.longestHoldingTimeMs)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.winRate")}</span>
                      <span className={styles.detailValue}>{t.sellCount > 0 ? (t.wins / t.sellCount * 100).toFixed(1) + "%" : "—"}</span>
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
                    {/* <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.buyVolume")}</span>
                      <span className={styles.detailValue}>{fmt.num.compact.currency(t.totalBoughtVolumeUsd)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{tr("walletPage.aiSwapSummary.sellVolume")}</span>
                      <span className={styles.detailValue}>{fmt.num.compact.currency(t.totalSoldVolumeUsd)}</span>
                    </div> */}
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
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <Loading withOverlay={false} />
    </div>
  );
}

export function AiSwapSummaryModal({
  isOpen,
  onClose,
  walletAddress,
}: AiSwapSummaryModalProps) {
  const { tr, lang } = useLocalization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WalletAiSwapSummaryResponse | null>(null);

  const apiLanguage: WalletAiAnalysisLanguage = lang === "vi" ? "vn" : "en";

  const fetch = useCallback(async () => {
    if (!isOpen || !walletAddress) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await fetchWalletAiSwapSummary(walletAddress, apiLanguage);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI swap summary");
    } finally {
      setLoading(false);
    }
  }, [isOpen, walletAddress, apiLanguage]);

  useEffect(() => {
    if (isOpen) void fetch();
  }, [isOpen, fetch]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

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
          <span className={styles.title}>{tr("walletPage.aiSwapSummary.title")}</span>
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
        ) : report ? (
          <SummaryContent report={report} />
        ) : null}
      </div>
    </div>,
    modalRoot,
  );
}
