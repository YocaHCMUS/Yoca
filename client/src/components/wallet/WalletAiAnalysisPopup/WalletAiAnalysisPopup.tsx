import React, { useCallback, useEffect, useRef, useState } from "react";
import { Close, Draggable } from "@carbon/icons-react";
import { SkeletonText, TextAreaSkeleton } from "@carbon/react";
import { useLocalization, type TranslateFunction } from "@/contexts/LocalizationContext";
import {
  fetchWalletAiAnalysis,
  fetchWalletIntelligence,
  fetchWalletPortfolio,
  fetchWalletSwaps,
  type WalletAiAnalysisResponse,
  type WalletIntelligenceResponse,
  type WalletPortfolioItem,
  type WalletSwap,
  type WalletAiAnalysisLanguage,
} from "@/services/wallet/walletApi";
import { renderWalletAiReferenceText } from "@/services/wallet/walletAiReferenceRenderer.service";
import styles from "./WalletAiAnalysisPopup.module.scss";

interface WalletAiAnalysisPopupProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  lang: string;
}

const DEFAULT_POSITION = { x: 100, y: 80 };

function renderReportContent(report: WalletAiAnalysisResponse, tr: TranslateFunction) {
  const ref = report.reference ?? [];
  return (
    <div className={styles.reportContent}>
      {/* Activity Profile */}
      <div className={styles.reportSection}>
        <h3>{String(tr("walletPage.aiActivityProfile"))}</h3>
        <div className={styles.kvGrid}>
          <div>
            <strong>Archetype: </strong>
            {renderWalletAiReferenceText(report.activity_profile.archetype, ref, "archetype")}
          </div>
          <div>
            <strong>Activity Level: </strong>
            {renderWalletAiReferenceText(report.activity_profile.activity_level, ref, "activity-level")}
          </div>
          <div>
            <strong>Last Active: </strong>
            {renderWalletAiReferenceText(report.activity_profile.last_active, ref, "last-active")}
          </div>
        </div>
      </div>

      {/* Interaction Fingerprint */}
      <div className={styles.reportSection}>
        <h3>{String(tr("walletPage.aiInteractionFingerprint"))}</h3>
        <div className={styles.kvGrid}>
          <div>
            <strong>Preferred Protocols: </strong>
            {report.interaction_fingerprint.preferred_protocols?.join(", ") ?? "—"}
          </div>
          <div>
            <strong>Transaction Timing: </strong>
            {renderWalletAiReferenceText(report.interaction_fingerprint.transaction_timing, ref, "transaction-timing")}
          </div>
          <div>
            <strong>Trading Volume Range: </strong>
            {renderWalletAiReferenceText(report.interaction_fingerprint.trading_volume_range, ref, "trading-volume-range")}
          </div>
        </div>
      </div>

      {/* Funder */}
      {report.funder && (
        <div className={styles.reportSection}>
          <h3>{String(tr("walletPage.aiFunder"))}</h3>
          <div className={styles.kvGrid}>
            <div>
              <strong>Type: </strong>
              {renderWalletAiReferenceText(report.funder.type, ref, "funder-type")}
            </div>
            <div>
              <strong>Notes: </strong>
              {renderWalletAiReferenceText(report.funder.notes, ref, "funder-notes")}
            </div>
          </div>
        </div>
      )}

      {/* Wallet Age */}
      {report.wallet_age && (
        <div className={styles.reportSection}>
          <h3>Wallet Age</h3>
          <div className={styles.kvGrid}>
            <div>
              <strong>Category: </strong>
              {renderWalletAiReferenceText(report.wallet_age.category, ref, "wallet-age-category")}
            </div>
            <div>
              <strong>First Seen: </strong>
              {renderWalletAiReferenceText(report.wallet_age.first_seen, ref, "wallet-age-first-seen")}
            </div>
            <div>
              <strong>Consistency: </strong>
              {renderWalletAiReferenceText(report.wallet_age.consistency, ref, "wallet-age-consistency")}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {report.summary && (
        <div className={styles.reportSection}>
          <h3>Summary</h3>
          <p>{renderWalletAiReferenceText(report.summary, ref, "summary")}</p>
        </div>
      )}

      {/* Signals */}
      {report.signals && report.signals.length > 0 && (
        <div className={styles.reportSection}>
          <h3>Signals</h3>
          <ul>
            {report.signals.map((signal, idx) => (
              <li key={idx}>{renderWalletAiReferenceText(signal, ref, `signal-${idx}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function WalletAiAnalysisPopup({
  isOpen,
  onClose,
  walletAddress,
  lang,
}: WalletAiAnalysisPopupProps) {
  const { tr } = useLocalization();
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WalletAiAnalysisResponse | null>(null);

  const apiLanguage: WalletAiAnalysisLanguage = lang === "vi" ? "vn" : "en";

  const fetchAnalysis = useCallback(async () => {
    if (!walletAddress || walletAddress === "null") return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      // Ensure dependencies are available
      let intelligence: WalletIntelligenceResponse | null = null;
      let portfolio: WalletPortfolioItem[] = [];
      let swaps: WalletSwap[] = [];

      try {
        const [intelResult, portfolioResult, swapsResult] = await Promise.allSettled([
          fetchWalletIntelligence(walletAddress, "solana"),
          fetchWalletPortfolio(walletAddress),
          fetchWalletSwaps(walletAddress),
        ]);

        if (intelResult.status === "fulfilled") intelligence = intelResult.value;
        if (portfolioResult.status === "fulfilled" && Array.isArray(portfolioResult.value)) {
          portfolio = portfolioResult.value;
        }
        if (swapsResult.status === "fulfilled") {
          const swapsData = swapsResult.value?.swaps;
          if (Array.isArray(swapsData)) swaps = swapsData;
        }
      } catch {
        // Continue anyway
      }

      const response = await fetchWalletAiAnalysis(walletAddress, apiLanguage);
      setReport(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : String(tr("walletPage.aiAnalysisFailed")),
      );
    } finally {
      setLoading(false);
    }
  }, [walletAddress, apiLanguage, tr]);

  useEffect(() => {
    if (isOpen && !report && !loading) {
      void fetchAnalysis();
    }
  }, [isOpen, report, loading, fetchAnalysis]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`${styles.card} ${dragging ? styles.dragging : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className={styles.header} onMouseDown={handleMouseDown}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <Draggable size={16} className={styles.dragIcon} />
            <h2 className={styles.title}>{tr("walletPage.aiAnalysis")}</h2>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label={tr("common.cancel")}>
          <Close size={20} />
        </button>
      </div>

      <div className={styles.body}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <SkeletonText width="40%" />
            <SkeletonText width="100%" />
            <SkeletonText width="100%" />
            <SkeletonText width="80%" />
            <TextAreaSkeleton />
          </div>
        )}

        {error && (
          <div className={styles.errorContainer}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={() => void fetchAnalysis()}>
              {tr("walletPage.aiAnalysisRetry")}
            </button>
          </div>
        )}

        {report && !loading && (
          renderReportContent(report, tr)
        )}

        {!loading && !error && !report && (
          <div className={styles.emptyContainer}>
            <p className={styles.emptyText}>
              Click generate to analyze this wallet.
            </p>
            <button className={styles.retryBtn} onClick={() => void fetchAnalysis()}>
              Generate Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WalletAiAnalysisPopup;
