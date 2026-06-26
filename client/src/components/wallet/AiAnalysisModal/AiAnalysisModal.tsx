import { AlertTriangle, Bot, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import ReactDOM from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ID_MODAL_ROOT } from "@/config/constants";
import {
  analyzeWalletWithAI,
  type WalletAnalysisApiResponse,
} from "@/services/api/walletAnalysis.tsx";
import styles from "./AiAnalysisModal.module.scss";

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  language: "vi" | "en";
}

const shortAddress = (value: string) => value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : "—";
const asList = (value: unknown) => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];

function scoreTone(value: number | null) {
  if (value == null) return "neutral";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}

function WalletAnalysisContent({ data, language, onRefresh }: { data: WalletAnalysisApiResponse; language: "vi" | "en"; onRefresh: () => void }) {
  const profile = data.profile ?? {};
  const summary = data.aiSummary ?? {};
  const riskScore = Number(profile?.risk?.riskScore);
  const trustScore = Number(profile?.risk?.trustScore);
  const confidence = Number(profile?.persona?.primaryPersonaScore ?? profile?.persona?.confidence);
  const txCount = Number(profile?.analysisWindow?.actualTransactionCount ?? profile?.analysisWindow?.transactionLimit);
  const completeness = Number(profile?.dataQuality?.completenessScore);
  const findings = [...asList(summary?.suspiciousFindings), ...asList(summary?.behaviorInsights)].slice(0, 6);
  const factors = asList(profile?.risk?.riskFactors).slice(0, 6);
  const score = Number.isFinite(riskScore) ? riskScore : null;
  const createdAt = data.generatedAt ? new Date(data.generatedAt) : null;

  const labels = language === "vi" ? {
    refreshed: "Làm mới", overview: "Tổng quan", score: "Điểm rủi ro", trust: "Điểm tin cậy", persona: "Nhóm hành vi", confidence: "Độ tin cậy", analyzed: "Giao dịch phân tích", quality: "Độ đầy đủ dữ liệu", summary: "Nhận định AI", risk: "Đánh giá rủi ro", pnl: "Nhận định PnL", findings: "Tín hiệu cần lưu ý", factors: "Các yếu tố rủi ro", empty: "Chưa có tín hiệu nổi bật trong dữ liệu hiện tại.", generated: "Tạo lúc", points: "điểm",
  } : {
    refreshed: "Refresh", overview: "Overview", score: "Risk score", trust: "Trust score", persona: "Behavior profile", confidence: "Confidence", analyzed: "Transactions analyzed", quality: "Data completeness", summary: "AI assessment", risk: "Risk assessment", pnl: "PnL assessment", findings: "Signals to review", factors: "Risk factors", empty: "No notable signals in the current data.", generated: "Generated", points: "points",
  };

  const metrics = [
    { label: labels.score, value: score == null ? "—" : `${Math.round(score)}/100`, tone: scoreTone(score) },
    { label: labels.trust, value: Number.isFinite(trustScore) ? `${Math.round(trustScore)}/100` : "—", tone: "neutral" },
    { label: labels.persona, value: asText(profile?.persona?.primaryPersona ?? summary?.walletPersona), tone: "neutral" },
    { label: labels.confidence, value: Number.isFinite(confidence) ? `${Math.round(confidence * (confidence <= 1 ? 100 : 1))}%` : "—", tone: "neutral" },
    { label: labels.analyzed, value: Number.isFinite(txCount) ? txCount.toLocaleString() : "—", tone: "neutral" },
    { label: labels.quality, value: Number.isFinite(completeness) ? `${Math.round(completeness * (completeness <= 1 ? 100 : 1))}%` : "—", tone: "neutral" },
  ];

  return (
    <div className={styles.analysisBody}>
      <div className={styles.analysisIntro}>
        <div>
          <span className={styles.sectionEyebrow}>{labels.overview}</span>
          <h3>{asText(summary?.shortSummary)}</h3>
          <p>{language === "vi" ? `Phân tích cho ví ${shortAddress(data.walletAddress)} dựa trên dữ liệu giao dịch đang truy xuất.` : `Analysis for ${shortAddress(data.walletAddress)} based on the currently retrieved transaction data.`}</p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={onRefresh}>
          <RefreshCw size={14} strokeWidth={1.9} />{labels.refreshed}
        </button>
      </div>

      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <article key={metric.label} className={`${styles.metricCard} ${styles[`metric_${metric.tone}`]}`}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      <section className={styles.analysisSection}>
        <div className={styles.sectionTitle}><ShieldCheck size={16} strokeWidth={1.9} /><span>{labels.summary}</span></div>
        <div className={styles.summaryGrid}>
          <article><span>{labels.risk}</span><p>{asText(summary?.riskSummary)}</p></article>
          <article><span>{labels.pnl}</span><p>{asText(summary?.pnlSummary)}</p></article>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.analysisSection}>
          <div className={styles.sectionTitle}><AlertTriangle size={16} strokeWidth={1.9} /><span>{labels.findings}</span></div>
          {findings.length ? <div className={styles.signalList}>
            {findings.map((finding, index) => (
              <article key={`${String(finding.title ?? "finding")}-${index}`}>
                <div><strong>{asText(finding.title)}</strong><span>{asText(finding.severity)}</span></div>
                <p>{asText(finding.explanation)}</p>
              </article>
            ))}
          </div> : <p className={styles.emptyText}>{labels.empty}</p>}
        </section>

        <section className={styles.analysisSection}>
          <div className={styles.sectionTitle}><Bot size={16} strokeWidth={1.9} /><span>{labels.factors}</span></div>
          {factors.length ? <div className={styles.factorList}>
            {factors.map((factor, index) => (
              <article key={`${String(factor.code ?? "factor")}-${index}`}>
                <div><strong>{asText(factor.code)}</strong>{factor.scoreImpact != null ? <span>{String(factor.scoreImpact)} {labels.points}</span> : null}</div>
                <p>{asText(factor.description)}</p>
              </article>
            ))}
          </div> : <p className={styles.emptyText}>{labels.empty}</p>}
        </section>
      </div>

      {createdAt && !Number.isNaN(createdAt.getTime()) && <span className={styles.generatedAt}>{labels.generated}: {createdAt.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</span>}
    </div>
  );
}

export function AiAnalysisModal({ isOpen, onClose, walletAddress, language }: AiAnalysisModalProps) {
  const [data, setData] = useState<WalletAnalysisApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!walletAddress) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!forceRefresh) setData(null);

    try {
      const result = await analyzeWalletWithAI({ walletAddress, language, transactionLimit: 200, userLevel: "BEGINNER", maxSummaryLength: "SHORT" });
      if (requestId === requestIdRef.current) { setData(result); setLoading(false); }
    } catch (err) {
      if (requestId === requestIdRef.current) { setError(err instanceof Error ? err.message : "AI analysis failed"); setLoading(false); }
    }
  }, [walletAddress, language]);

  useEffect(() => {
    if (isOpen) void loadData();
    else { setData(null); setError(null); setLoading(false); }
  }, [isOpen, loadData]);

  if (!isOpen) return null;
  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.card} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={language === "vi" ? "Phân tích ví bằng AI" : "AI wallet analysis"}>
        <div className={styles.header}>
          <div className={styles.titleGroup}><span className={styles.titleIcon}><Bot size={17} strokeWidth={1.8} /></span><div><span className={styles.eyebrow}>{language === "vi" ? "PHÂN TÍCH DỮ LIỆU VÍ" : "WALLET DATA ANALYSIS"}</span><span className={styles.title}>{language === "vi" ? "Phân tích ví bằng AI" : "AI Wallet Analysis"}</span></div></div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={language === "vi" ? "Đóng" : "Close"}><X size={19} strokeWidth={1.9} /></button>
        </div>

        {loading && <div className={styles.loadingState}><LoaderCircle className={styles.spinner} size={20} strokeWidth={1.8} /><span>{language === "vi" ? "Đang phân tích dữ liệu ví…" : "Analyzing wallet data…"}</span></div>}
        {!loading && error && <div className={styles.errorState}><p className={styles.errorMessage}>{error}</p><button type="button" className={styles.retryBtn} onClick={() => void loadData(true)}><RefreshCw size={14} strokeWidth={1.9} />{language === "vi" ? "Thử lại" : "Retry"}</button></div>}
        {!loading && !error && data && <WalletAnalysisContent data={data} language={language} onRefresh={() => void loadData(true)} />}
      </div>
    </div>,
    modalRoot,
  );
}
