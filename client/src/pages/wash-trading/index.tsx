import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useUserTheme } from "@/contexts/ThemeContext";
import styles from "./wash-trading.module.scss";

const API_DOMAIN: string = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

type Timeframe = "24h" | "7d" | "30d";
type RiskLevel = "High" | "Medium" | "Low";
type Severity = "high" | "medium" | "info" | "success";

interface SuspiciousWallet {
  wallet: string;
  score: number;
  riskLevel: RiskLevel;
  pattern: string;
  features: {
    circularPattern: number;
    timeRegularity: number;
    amountSimilarity: number;
    selfLoopDegree: number;
    hubness: number;
  };
}

interface GraphNode {
  id: string;
  type: "wash" | "bridge" | "normal";
  label: string;
}

interface GraphEdge {
  from: string;
  to: string;
  amount: number;
  suspicious: boolean;
}

interface WashTradingResult {
  mint: string;
  symbol: string;
  analyzedAt: string;
  summary: {
    totalTransactions: number;
    uniqueWallets: number;
    totalVolume: number;
    washVolumeEstimate: number;
    washVolumePercent: number;
    circularTradeCount: number;
    suspiciousWalletCount: number;
    overallRiskScore: number;
    gnnConfidence: number;
  };
  circularPatterns: Array<{
    cycle: string[];
    hops: number;
    amounts: number[];
    timestamps: number[];
    intervalMs: number;
    confidence: number;
  }>;
  suspiciousWallets: SuspiciousWallet[];
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  aiAnalysis: {
    verdict: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" | "CLEAN";
    summary: string;
    detailedFindings: string[];
    suspiciousPatterns: Array<{
      patternName: string;
      description: string;
      affectedWallets: string[];
      severity: "HIGH" | "MEDIUM" | "LOW";
    }>;
    recommendation: string;
    confidenceNote: string;
  };
  detectionLog: Array<{
    time: string;
    message: string;
    severity: Severity;
  }>;
}

interface ApiResponse {
  success: boolean;
  data?: WashTradingResult;
  error?: string;
  message?: string;
}

const shortAddress = (address?: string) => {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value || 0);

const getSeverityColor = (severity: Severity) => {
  if (severity === "high") return "#e24b4a";
  if (severity === "medium") return "#ef9f27";
  if (severity === "success") return "#639922";
  return "var(--text-muted)";
};

const getRiskLabel = (score: number) => {
  if (score >= 75) return "High Risk";
  if (score >= 45) return "Medium Risk";
  if (score > 0) return "Low Risk";
  return "No Signal";
};

const normalizeRiskLevel = (riskLevel: string): RiskLevel => {
  if (riskLevel === "High" || riskLevel === "Medium" || riskLevel === "Low") {
    return riskLevel;
  }
  return "Low";
};

const RiskGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)));
  const dashOffset = 170 - (170 * safeScore) / 100;
  const color = safeScore >= 75 ? "#e24b4a" : safeScore >= 45 ? "#ef9f27" : "#639922";

  return (
    <div className={styles.gaugeWrap}>
      <svg width="140" height="82" viewBox="0 0 140 82">
        <path d="M16,70 A54,54 0 0,1 124,70" fill="none" stroke="var(--border-light)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M16,70 A54,54 0 0,1 124,70"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="170"
          strokeDashoffset={dashOffset}
        />
        <text x="70" y="62" textAnchor="middle" fontSize="24" fontWeight="600" fill={color}>{safeScore}</text>
        <text x="70" y="76" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">/100</text>
      </svg>
      <span className={`${styles.riskBadge} ${safeScore >= 75 ? styles.riskHigh : safeScore >= 45 ? styles.riskMedium : styles.riskLow}`}>
        {label}
      </span>
    </div>
  );
};

const FeatureBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const normalized = Math.max(0, Math.min(1, value || 0));
  const color = normalized >= 0.85 ? "#e24b4a" : normalized >= 0.7 ? "#ef9f27" : "#639922";
  return (
    <div className={styles.featureRow}>
      <span className={styles.featureLabel}>{label}</span>
      <div className={styles.featureBarBg}>
        <div className={styles.featureBarFill} style={{ width: `${normalized * 100}%`, background: color }} />
      </div>
      <span className={styles.featureScore} style={{ color }}>{normalized.toFixed(2)}</span>
    </div>
  );
};

const NetworkGraph: React.FC<{ nodes: GraphNode[]; edges: GraphEdge[] }> = ({ nodes, edges }) => {
  const visibleNodes = nodes.length > 0
    ? nodes.slice(0, 12)
    : [
        { id: "empty-1", type: "normal" as const, label: "No data" },
        { id: "empty-2", type: "normal" as const, label: "Run AI" },
      ];

  const layout = useMemo(() => {
    const centerX = 280;
    const centerY = 130;
    const radiusX = 190;
    const radiusY = 82;
    return visibleNodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / visibleNodes.length - Math.PI / 2;
      return {
        ...node,
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
      };
    });
  }, [visibleNodes]);

  const positionMap = new Map(layout.map((node) => [node.id, node]));
  const visibleEdges = edges
    .filter((edge) => positionMap.has(edge.from) && positionMap.has(edge.to))
    .slice(0, 28);

  return (
    <div className={styles.graphContainer}>
      <svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg" className={styles.graphSvg}>
        <defs>
          <marker id="arr-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#e24b4a" opacity=".85" />
          </marker>
          <marker id="arr-gray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--graph-node-stroke)" opacity=".7" />
          </marker>
        </defs>

        <ellipse cx="280" cy="130" rx="218" ry="102" fill="rgba(226,75,74,0.07)" stroke="#e24b4a" strokeWidth="1" strokeDasharray="5,3" opacity=".55" />
        <text x="280" y="238" textAnchor="middle" fontSize="10" fill="#a32d2d">GNN transaction cluster</text>

        {visibleEdges.map((edge, index) => {
          const from = positionMap.get(edge.from)!;
          const to = positionMap.get(edge.to)!;
          const stroke = edge.suspicious ? "#e24b4a" : "var(--graph-line)";
          return (
            <line
              key={`${edge.from}-${edge.to}-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={stroke}
              strokeWidth={edge.suspicious ? 2.2 : 1.2}
              opacity={edge.suspicious ? 0.85 : 0.45}
              markerEnd={edge.suspicious ? "url(#arr-red)" : "url(#arr-gray)"}
            />
          );
        })}

        {layout.map((node) => {
          const fill = node.type === "wash" ? "#e24b4a" : node.type === "bridge" ? "#ef9f27" : "var(--graph-node-normal)";
          const stroke = node.type === "normal" ? "var(--graph-node-stroke)" : fill;
          return (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r={node.type === "wash" ? 18 : 15} fill={fill} stroke={stroke} strokeWidth="2" opacity=".95" />
              <text x={node.x} y={node.y + 34} textAnchor="middle" fontSize="10" fill="var(--graph-text)">{node.label}</text>
            </g>
          );
        })}
      </svg>

      <div className={styles.graphLegend}>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "#e24b4a" }} />High risk wallet</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "#ef9f27" }} />Bridge wallet</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: "var(--graph-node-stroke)" }} />Normal wallet</span>
        <span className={styles.legendItem}><span className={styles.legendLine} />Suspicious flow</span>
      </div>
    </div>
  );
};

const WalletRow: React.FC<{ wallet: SuspiciousWallet; index: number }> = ({ wallet, index }) => {
  const risk = normalizeRiskLevel(wallet.riskLevel);
  return (
    <div className={styles.walletRow}>
      <div className={styles.walletInfo}>
        <span className={styles.walletAddr}>{shortAddress(wallet.wallet)}</span>
        <span className={styles.walletDesc}>{wallet.pattern} · Graph rank #{index + 1}</span>
      </div>
      <span className={styles.walletGnn}>GNN: {wallet.score.toFixed(2)}</span>
      <span className={`${styles.riskBadge} ${styles[`risk${risk}`]}`}>{risk}</span>
    </div>
  );
};

const LogItem: React.FC<{ time: string; text: string; color: string }> = ({ time, text, color }) => (
  <div className={styles.logItem}>
    <span className={styles.logTime}>{time}</span>
    <span className={styles.logDot} style={{ background: color }} />
    <span className={styles.logText}>{text}</span>
  </div>
);

const WashTradingPage: React.FC = () => {
  const { theme } = useUserTheme();
  const isLight = theme === "light";
  const navigate = useNavigate();
  const { mint } = useParams<{ mint: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const symbolFromUrl = searchParams.get("symbol") || "TOKEN";
  const timeframeFromUrl = (searchParams.get("timeframe") || "24h") as Timeframe;

  const [symbol, setSymbol] = useState(symbolFromUrl);
  const [timeframe, setTimeframe] = useState<Timeframe>(["24h", "7d", "30d"].includes(timeframeFromUrl) ? timeframeFromUrl : "24h");
  const [manualMint, setManualMint] = useState(mint || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WashTradingResult | null>(null);
  const [algoTab, setAlgoTab] = useState<"GCN" | "GAT" | "GraphSAGE">("GCN");
  const [walletFilter, setWalletFilter] = useState<"All" | "High risk" | "New">("All");

  useEffect(() => {
    setManualMint(mint || "");
  }, [mint]);

  useEffect(() => {
    setSymbol(symbolFromUrl);
  }, [symbolFromUrl]);

  const targetMint = mint || manualMint.trim();

  const handleAnalyze = useCallback(async () => {
    const selectedMint = targetMint.trim();
    if (!selectedMint) {
      setError("Thiếu token mint address. Hãy mở trang từ Token Detail hoặc nhập mint để phân tích.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`${API_DOMAIN}/api/v1/wash-trading/ai-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mint: selectedMint,
          symbol: symbol || "TOKEN",
          limit: timeframe === "24h" ? 200 : timeframe === "7d" ? 300 : 500,
        }),
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || payload.error || "AI analysis failed");
      }

      setResult(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gọi AI Wash Trading API.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [symbol, targetMint, timeframe]);

  useEffect(() => {
    if (mint) {
      void handleAnalyze();
    }
  }, [mint, handleAnalyze]);

  const handleManualOpen = () => {
    const selectedMint = manualMint.trim();
    if (!selectedMint) {
      setError("Vui lòng nhập token mint address.");
      return;
    }
    navigate(`/wash-trading/${selectedMint}?symbol=${encodeURIComponent(symbol || "TOKEN")}&timeframe=${timeframe}`);
  };

  const handleTimeframeChange = (next: Timeframe) => {
    setTimeframe(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("timeframe", next);
    if (symbol) nextParams.set("symbol", symbol);
    setSearchParams(nextParams);
  };

  const filteredWallets = (result?.suspiciousWallets ?? []).filter((wallet) => {
    if (walletFilter === "High risk") return wallet.riskLevel === "High";
    if (walletFilter === "New") return wallet.riskLevel !== "High";
    return true;
  });

  const topWallet = result?.suspiciousWallets[0];
  const featureSource = topWallet?.features;
  const summary = result?.summary;
  const riskScore = summary?.overallRiskScore ?? 0;
  const suspiciousCount = summary?.suspiciousWalletCount ?? 0;

  return (
    <PageWrapper>
      <div className={`${styles.page} ${isLight ? styles.light : ""}`}>
        <div className={styles.breadcrumb}>
          <Link to="/tokens" className={styles.breadcrumbLink}>Tokens</Link>
          <span>/</span>
          {mint ? <Link to={`/tokens/${mint}`} className={styles.breadcrumbLink}>{symbol || shortAddress(mint)}</Link> : <span>Manual token</span>}
          <span>/</span>
          <span>Wash Trading Detection</span>
        </div>

        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.pageIcon}>◎</span>
            <div>
              <h1 className={styles.pageTitle}>AI Wash Trading Detection</h1>
              <p className={styles.pageSubtitle}>
                GNN-inspired analysis for {symbol || "TOKEN"} · {shortAddress(targetMint)}
              </p>
            </div>
            <span className={styles.suspiciousBadge}>{suspiciousCount} Suspicious</span>
          </div>

          <div className={styles.topbarRight}>
            {!mint && (
              <input
                className={styles.mintInput}
                value={manualMint}
                onChange={(event) => setManualMint(event.target.value)}
                placeholder="Token mint address"
              />
            )}
            <input
              className={styles.symbolInput}
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              placeholder="Symbol"
            />
            <select className={styles.tokenSelect} value={timeframe} onChange={(event) => handleTimeframeChange(event.target.value as Timeframe)}>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
            </select>
            {!mint && (
              <button className={styles.btnSecondary} onClick={handleManualOpen}>
                Open token
              </button>
            )}
            <button className={`${styles.btnPrimary} ${isAnalyzing ? styles.loading : ""}`} onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? "Đang phân tích..." : "Run AI Analyze ↗"}
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.aiSummaryCard}>
          <div className={styles.aiSummaryHeader}>
            <span className={styles.aiPill}>AI Verdict</span>
            <strong>{result?.aiAnalysis.verdict?.replaceAll("_", " ") ?? "Waiting for analysis"}</strong>
          </div>
          <p>{result?.aiAnalysis.summary ?? "Nhấn Run AI Analyze để phân tích circular trading, amount similarity, timing regularity và graph features của token này."}</p>
          {result?.aiAnalysis.recommendation && (
            <div className={styles.recommendation}>{result.aiAnalysis.recommendation}</div>
          )}
        </div>

        <div className={styles.metricsGrid}>
          {[
            { label: "Total Transactions", value: formatNumber(summary?.totalTransactions ?? 0), sub: `${formatNumber(summary?.uniqueWallets ?? 0)} unique wallets`, subColor: "var(--text-secondary)" },
            { label: "Wash Volume Estimate", value: formatNumber(summary?.washVolumeEstimate ?? 0), sub: `${(summary?.washVolumePercent ?? 0).toFixed(1)}% tổng volume`, subColor: "#e24b4a" },
            { label: "Suspicious Wallets", value: String(suspiciousCount), sub: `${summary?.circularTradeCount ?? 0} circular clusters`, subColor: "#ef9f27" },
            { label: "GNN Confidence", value: `${((summary?.gnnConfidence ?? 0) * 100).toFixed(1)}%`, sub: `Risk score: ${riskScore}/100`, subColor: "#639922" },
          ].map(({ label, value, sub, subColor }) => (
            <div key={label} className={styles.metricCard}>
              <div className={styles.metricLabel}>{label}</div>
              <div className={styles.metricValue}>{value}</div>
              <div className={styles.metricSub} style={{ color: subColor }}>{sub}</div>
            </div>
          ))}
        </div>

        <div className={styles.mainGrid}>
          <div className={styles.leftCol}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>🔗</span>
                <h2 className={styles.cardTitle}>Transaction Graph — GNN Cluster View</h2>
                <div className={styles.algoTabs}>
                  {(["GCN", "GAT", "GraphSAGE"] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`${styles.algoTab} ${algoTab === tab ? styles.algoTabActive : ""}`}
                      onClick={() => setAlgoTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <NetworkGraph nodes={result?.graphData.nodes ?? []} edges={result?.graphData.edges ?? []} />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>🔍</span>
                <h2 className={styles.cardTitle}>Suspicious Wallets</h2>
                <div className={styles.walletTabs}>
                  {(["All", "High risk", "New"] as const).map((filter) => (
                    <button
                      key={filter}
                      className={`${styles.walletTab} ${walletFilter === filter ? styles.walletTabActive : ""}`}
                      onClick={() => setWalletFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.walletList}>
                {filteredWallets.length > 0 ? (
                  filteredWallets.map((wallet, index) => <WalletRow key={wallet.wallet} wallet={wallet} index={index} />)
                ) : (
                  <div className={styles.emptyState}>Chưa có ví đáng ngờ. Hãy chạy phân tích AI cho token này.</div>
                )}
              </div>
            </div>

            {result?.aiAnalysis.detailedFindings?.length ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>🧠</span>
                  <h2 className={styles.cardTitle}>AI Detailed Findings</h2>
                </div>
                <div className={styles.findingList}>
                  {result.aiAnalysis.detailedFindings.map((finding, index) => (
                    <div className={styles.findingItem} key={`${finding}-${index}`}>
                      <span>{index + 1}</span>
                      <p>{finding}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.rightCol}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>🛡</span>
                <h2 className={styles.cardTitle}>Risk Score — {topWallet ? shortAddress(topWallet.wallet) : symbol}</h2>
              </div>
              <RiskGauge score={riskScore} label={getRiskLabel(riskScore)} />
              <div className={styles.featuresSection}>
                <FeatureBar label="Circular pattern" value={featureSource?.circularPattern ?? 0} />
                <FeatureBar label="Time regularity" value={featureSource?.timeRegularity ?? 0} />
                <FeatureBar label="Amount similarity" value={featureSource?.amountSimilarity ?? 0} />
                <FeatureBar label="Self-loop degree" value={featureSource?.selfLoopDegree ?? 0} />
                <FeatureBar label="Hubness" value={featureSource?.hubness ?? 0} />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>⏱</span>
                <h2 className={styles.cardTitle}>Detection Log</h2>
              </div>
              <div className={styles.logList}>
                {(result?.detectionLog ?? [
                  { time: "--:--", message: "Waiting for AI analysis request...", severity: "info" as Severity },
                ]).map((item, index) => (
                  <LogItem key={`${item.time}-${index}`} time={item.time} text={item.message} color={getSeverityColor(item.severity)} />
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>📌</span>
                <h2 className={styles.cardTitle}>Token Context</h2>
              </div>
              <div className={styles.contextList}>
                <div><span>Symbol</span><strong>{symbol || "TOKEN"}</strong></div>
                <div><span>Mint</span><strong>{shortAddress(targetMint)}</strong></div>
                <div><span>Timeframe</span><strong>{timeframe}</strong></div>
                <div><span>Analyzed at</span><strong>{result ? new Date(result.analyzedAt).toLocaleString("vi-VN") : "—"}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default WashTradingPage;
