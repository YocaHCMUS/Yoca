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
  type WalletAiSwapSummaryTokenPnl,
} from "@/services/wallet/walletApi";
import styles from "./ai-swap-summary.module.scss";

interface AiSwapSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  language: "en" | "vn";
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPriceRange(range: [number, number] | null): string {
  if (!range) return "—";
  const fmt = (n: number) =>
    n < 0.001
      ? n.toExponential(4)
      : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  return `${fmt(range[0])} – ${fmt(range[1])}`;
}

const USD_FORMATTER = (v: number | null) =>
  v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const COMPACT_USD_FORMATTER = (v: number | null) =>
  v == null ? "—" : `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function SummaryContent({ report }: { report: WalletAiSwapSummaryResponse }) {
  const vn = report.language === "vn";
  const l = (en: string, vnStr: string) => vn ? vnStr : en;
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => [...report.allTokenBreakdowns].sort((a, b) => (sortAsc ? a.pnlUsd - b.pnlUsd : b.pnlUsd - a.pnlUsd)),
    [report.allTokenBreakdowns, sortAsc],
  );

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
            <span className={styles.statLabel}>{l("Realized PnL", "PnL thực tế")}</span>
            <span className={styles.statValue}>
              <TrendNumWithSign
                value={report.realizedPnlUsd}
                prefixes="plus-minus"
                formatter={USD_FORMATTER}
              />
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{l("Win Rate", "Tỷ lệ thắng")}</span>
            <span className={styles.statValue}>{report.winningPercentage.toFixed(1)}%</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{l("Trades", "Giao dịch")}</span>
            <span className={styles.statValue}>{report.tradeCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{l("Volume", "Khối lượng")}</span>
            <span className={styles.statValue}>
              ${(report.totalBoughtUsd + report.totalSoldUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div className={styles.summarySection}>
          <h3 className={styles.summaryTitle}>
            {l("Summary", "Tóm tắt")}
          </h3>
          <p className={styles.summaryText}>{report.summary}</p>
        </div>

        {report.riskNotes.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              {l("Risk Analysis", "Phân tích rủi ro")}
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
            {l("Cached result", "Kết quả từ bộ nhớ đệm")}
          </p>
        )}
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.rankedHeader}>
          <span className={styles.rankedTitle}>
            {l("All Tokens", "Tất cả token")}
          </span>
          <button
            type="button"
            className={styles.sortToggle}
            onClick={() => setSortAsc(!sortAsc)}
            title={sortAsc ? l("Sorted: worst PnL first", "Sắp xếp: PnL thấp nhất") : l("Sorted: best PnL first", "Sắp xếp: PnL cao nhất")}
          >
            PnL {sortAsc ? "↑" : "↓"}
          </button>
        </div>
        <div className={styles.rankedList}>
          {sorted.map((t) => {
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
                      formatter={USD_FORMATTER}
                    />
                  </span>
                  <span className={styles.rankedBuySell}>{t.buyCount}b / {t.sellCount}s</span>
                  <span className={styles.rankedChevron}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </div>
                {isExpanded && (
                  <div className={styles.expandedDetail}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Entry", "Vào")}</span>
                      <span className={styles.detailValue}>{formatPriceRange(t.entryPriceRange)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Exit", "Ra")}</span>
                      <span className={styles.detailValue}>{formatPriceRange(t.exitPriceRange)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Hold", "Giữ")}</span>
                      <span className={styles.detailValue}>{formatDuration(t.longestHoldingTimeMs)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Max Loss", "Lỗ nhất")}</span>
                      <span className={`${styles.detailValue} ${styles.lossValue}`}>{formatPercent(t.maxTolerableLossPercent)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Min Win", "Lời nhất")}</span>
                      <span className={`${styles.detailValue} ${styles.winValue}`}>{formatPercent(t.minRealizedWinPercent)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Bought", "Mua")}</span>
                      <span className={styles.detailValue}>{COMPACT_USD_FORMATTER(t.totalEntered)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>{l("Sold", "Bán")}</span>
                      <span className={styles.detailValue}>{COMPACT_USD_FORMATTER(t.totalExited)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  language,
}: AiSwapSummaryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WalletAiSwapSummaryResponse | null>(null);

  const fetch = useCallback(async () => {
    if (!isOpen || !walletAddress) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await fetchWalletAiSwapSummary(walletAddress, language);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI swap summary");
    } finally {
      setLoading(false);
    }
  }, [isOpen, walletAddress, language]);

  useEffect(() => {
    if (isOpen) void fetch();
  }, [isOpen, fetch]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  const vn = language === "vn";
  const label = vn ? "AI Tổng kết Giao dịch" : "AI Swap Summary";

  return ReactDOM.createPortal(
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{label}</span>
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
              {vn ? "Thử lại" : "Retry"}
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
