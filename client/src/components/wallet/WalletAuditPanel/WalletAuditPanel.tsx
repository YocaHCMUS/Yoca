import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  fetchWalletAudit,
  type WalletAuditReport,
  type WalletAuditPersona,
} from "@/services/wallet/walletApi.ts";
import styles from "./WalletAuditPanel.module.scss";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSONA_EMOJI: Record<WalletAuditPersona, string> = {
  Sniper: "\u{1F3AF}",  // 🎯
  Whale: "\u{1F40B}",   // 🐋
  DCA: "\u{1F504}",     // 🔄
  LP: "\u{1F4A7}",      // 💧
  Retail: "\u{1F6D2}",  // 🛒
  Unknown: "\u{2753}",  // ❓
};

function personaLabel(persona: WalletAuditPersona, language: "vi" | "en") {
  const labels = language === "vi"
    ? { Sniper: "Bot Sniper", Whale: "Cá voi tổ chức", DCA: "Tích lũy DCA", LP: "Nhà cung cấp thanh khoản", Retail: "Nhà giao dịch cá nhân", Unknown: "Chưa phân loại" }
    : { Sniper: "Sniper Bot", Whale: "Institutional Whale", DCA: "DCA Accumulator", LP: "Liquidity Provider", Retail: "Retail Trader", Unknown: "Unclassified" };
  return labels[persona];
}

function scoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function scoreStrokeColor(score: number): string {
  if (score >= 80) return "#24a148";
  if (score >= 50) return "#f1c21b";
  return "#da1e28";
}

const SCORE_CLASS: Record<"green" | "yellow" | "red", string> = {
  green: styles.scoreGreen,
  yellow: styles.scoreYellow,
  red: styles.scoreRed,
};

function isRedFlag(obs: string): boolean {
  const lower = obs.toLowerCase();
  return (
    lower.includes("red flag") ||
    lower.includes("wash trad") ||
    lower.includes("scam") ||
    lower.includes("mixer") ||
    lower.includes("suspicious") ||
    lower.includes("warning") ||
    lower.includes("risk")
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function TrustGauge({ score }: { score: number }) {
  const { lang } = useLocalization();
  const r = 60;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const offset = circumference * (1 - progress);
  const color = scoreColor(score);

  return (
    <div className={styles.gaugeWrapper}>
      <svg viewBox="0 0 140 140" className={styles.gaugeSvg} aria-hidden="true">
        <circle cx="70" cy="70" r={r} className={styles.gaugeTrack} />
        <circle
          cx="70"
          cy="70"
          r={r}
          className={styles.gaugeArc}
          stroke={scoreStrokeColor(score)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={styles.gaugeCenter}>
        <span className={`${styles.gaugeScore} ${SCORE_CLASS[color]}`}>
          {score}
        </span>
        <span className={styles.gaugeLabel}>{lang === "vi" ? "Điểm tin cậy" : "Trust score"}</span>
      </div>
    </div>
  );
}

function PersonaBadge({
  persona,
  transactionCount,
}: {
  persona: WalletAuditPersona;
  transactionCount: number;
}) {
  const { lang } = useLocalization();
  return (
    <div className={styles.personaSection}>
      <div className={styles.personaBadge}>
        <span>{PERSONA_EMOJI[persona]}</span>
        <span>{personaLabel(persona, lang === "vi" ? "vi" : "en")}</span>
      </div>
      <span className={styles.personaMeta}>
        {lang === "vi" ? `Dựa trên ${transactionCount.toLocaleString()} giao dịch gần đây` : `Based on ${transactionCount.toLocaleString()} recent transactions`}
      </span>
    </div>
  );
}

function ScanningLoader() {
  const { lang } = useLocalization();
  return (
    <div className={styles.skeletonPanel}>
      <div className={styles.scanningOverlay}>
        <div className={styles.scanDots}>
          <span className={styles.scanDot} />
          <span className={styles.scanDot} />
          <span className={styles.scanDot} />
        </div>
        <p className={styles.scanningTitle}>{lang === "vi" ? "Đang quét dữ liệu blockchain…" : "Scanning blockchain data…"}</p>
        <p className={styles.scanningSubtitle}>{lang === "vi" ? "Đang phân tích các mẫu giao dịch. Quá trình này có thể mất vài giây." : "Analyzing transaction patterns. This may take a few seconds."}</p>
      </div>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonGauge} />
        <div className={styles.skeletonBadge} />
      </div>
      <div className={styles.skeletonCard} />
      <div className={styles.skeletonCardSmall} />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { lang } = useLocalization();
  return (
    <div className={styles.auditPanel}>
      <div className={styles.errorCard}>
        <h4 className={styles.cardTitle}>{lang === "vi" ? "Không thể phân tích" : "Analysis failed"}</h4>
        <p className={styles.errorText}>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: "6px 16px",
            borderRadius: 6,
            border: "none",
            background: "#da1e28",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {lang === "vi" ? "Thử lại" : "Retry"}
        </button>
      </div>
    </div>
  );
}

function AuditReport({ report }: { report: WalletAuditReport }) {
  const { lang } = useLocalization();
  const fetchedDate = useMemo(() => {
    try {
      return new Date(report.fetchedAt).toLocaleString(lang === "vi" ? "vi-VN" : "en-US");
    } catch {
      return report.fetchedAt;
    }
  }, [report.fetchedAt, lang]);

  return (
    <div className={styles.auditPanel}>
      {/* Header: Gauge + Persona */}
      <div className={styles.header}>
        <TrustGauge score={report.trustScore} />
        <PersonaBadge
          persona={report.persona}
          transactionCount={report.transactionCount}
        />
      </div>

      {/* Summary */}
      <div className={styles.summaryCard}>
        <h4 className={styles.cardTitle}>{lang === "vi" ? "Tóm tắt phân tích" : "Forensic summary"}</h4>
        <p className={styles.summaryText}>{report.summary}</p>
      </div>

      {/* Observations */}
      {report.observations.length > 0 && (
        <div className={styles.observationsCard}>
          <h4 className={styles.cardTitle}>{lang === "vi" ? "Các quan sát" : "Observations"}</h4>
          <ul className={styles.observationsList}>
            {report.observations.map((obs, idx) => (
              <li key={idx} className={styles.observationItem}>
                <span
                  className={
                    isRedFlag(obs) ? styles.obsBulletRed : styles.obsBullet
                  }
                />
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer meta */}
      <div className={styles.footerMeta}>
        <span>{lang === "vi" ? "Mô hình" : "Model"}: {report.model}</span>
        <span>{lang === "vi" ? "Tạo lúc" : "Generated"}: {fetchedDate}</span>
        {report.cached && <span>{lang === "vi" ? "Dữ liệu từ bộ nhớ đệm" : "Served from cache"}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export interface WalletAuditPanelProps {
  walletAddress: string;
  enabled?: boolean;
}

export function WalletAuditPanel({
  walletAddress,
  enabled = true,
}: WalletAuditPanelProps) {
  const [report, setReport] = useState<WalletAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string | null>(null);

  const doFetch = useCallback(
    async (force = false) => {
      if (!walletAddress) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchWalletAudit(walletAddress, { force });
        setReport(result);
        setFetchedAddress(walletAddress);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [walletAddress],
  );

  useEffect(() => {
    if (!enabled) return;
    if (fetchedAddress === walletAddress && report) return;
    doFetch();
  }, [walletAddress, enabled, doFetch, fetchedAddress, report]);

  if (!enabled) return null;

  if (loading) return <ScanningLoader />;

  if (error) return <ErrorState message={error} onRetry={() => doFetch(true)} />;

  if (!report) return null;

  return <AuditReport report={report} />;
}

export default WalletAuditPanel;
