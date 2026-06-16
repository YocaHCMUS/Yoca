import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useUserTheme } from "@/contexts/ThemeContext";
import styles from "./wash-trading.module.scss";

const API_DOMAIN: string = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

type Timeframe = "24h" | "7d" | "30d";
type GnnAlgorithm = "GCN" | "GAT" | "GraphSAGE";
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
  score?: number;
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
  dataSource?: "helius-rpc-token-accounts" | "helius-enhanced-api" | "demo-fallback";
  dataSourceReason?: string;
  algorithm?: GnnAlgorithm;
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

interface ReadableGraphEdge extends GraphEdge {
  id: string;
  transferCount: number;
  weight: number;
  curveness: number;
}

const NetworkGraph: React.FC<{ nodes: GraphNode[]; edges: GraphEdge[]; isFullscreen?: boolean }> = ({ nodes, edges, isFullscreen = false }) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const visibleNodes = useMemo(() => {
    const sourceNodes = nodes.length > 0
      ? nodes
      : [
          { id: "empty-1", type: "normal" as const, label: "No data" },
          { id: "empty-2", type: "normal" as const, label: "Run AI" },
        ];

    return sourceNodes.slice(0, isFullscreen ? 120 : 80);
  }, [nodes, isFullscreen]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const readableEdges = useMemo<ReadableGraphEdge[]>(() => {
    const grouped = new Map<string, ReadableGraphEdge>();

    edges
      .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
      .forEach((edge) => {
        const key = `${edge.from}->${edge.to}`;
        const current = grouped.get(key);

        if (!current) {
          grouped.set(key, {
            ...edge,
            id: key,
            amount: edge.amount || 0,
            transferCount: 1,
            weight: 0,
            curveness: 0,
          });
          return;
        }

        current.amount += edge.amount || 0;
        current.transferCount += 1;
        current.suspicious = current.suspicious || edge.suspicious;
      });

    const groupedList = Array.from(grouped.values());
    const maxAmount = Math.max(...groupedList.map((edge) => edge.amount || 0), 1);
    const pairGroups = new Map<string, ReadableGraphEdge[]>();

    groupedList.forEach((edge) => {
      const pairKey = [edge.from, edge.to].sort().join("<->");
      const pairEdges = pairGroups.get(pairKey) ?? [];
      pairEdges.push(edge);
      pairGroups.set(pairKey, pairEdges);
    });

    pairGroups.forEach((pairEdges) => {
      pairEdges
        .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
        .forEach((edge, index) => {
          const directionSign = edge.from < edge.to ? 1 : -1;
          const magnitude = pairEdges.length > 1 ? 0.22 + index * 0.1 : 0.12;
          edge.curveness = directionSign * magnitude;
        });
    });

    return groupedList
      .map((edge) => ({
        ...edge,
        weight: Math.log10((edge.amount || 0) + 1) / Math.log10(maxAmount + 1),
      }))
      .sort((a, b) => Number(b.suspicious) - Number(a.suspicious) || b.amount - a.amount)
      .slice(0, isFullscreen ? 140 : 90);
  }, [edges, visibleNodeIds, isFullscreen]);

  const suspiciousEdges = readableEdges.filter((edge) => edge.suspicious).length;
  const groupedCount = Math.max(0, edges.length - readableEdges.length);

  const option = useMemo<echarts.EChartsOption>(() => {
    const categories = [
      { name: "High risk wallet", itemStyle: { color: "#e24b4a" } },
      { name: "Bridge wallet", itemStyle: { color: "#ef9f27" } },
      { name: "Normal wallet", itemStyle: { color: "#64748b" } },
    ];

    const categoryIndex = (type: GraphNode["type"]) => {
      if (type === "wash") return 0;
      if (type === "bridge") return 1;
      return 2;
    };

    const initialRadius = isFullscreen ? 650 : 430;
    const graphNodes = visibleNodes.map((node, index) => {
      const score = typeof node.score === "number" ? Math.round(Math.max(0, Math.min(1, node.score)) * 100) : 0;
      const isWash = node.type === "wash";
      const isBridge = node.type === "bridge";
      const angle = (Math.PI * 2 * index) / Math.max(visibleNodes.length, 1);
      const riskRadiusFactor = isWash ? 0.62 : isBridge ? 0.78 : 1;
      const ringOffset = (index % 3) * (isFullscreen ? 42 : 26);
      const radius = initialRadius * riskRadiusFactor + ringOffset;

      return {
        id: node.id,
        name: node.label || shortAddress(node.id),
        value: score,
        category: categoryIndex(node.type),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        symbolSize: isWash ? Math.max(34, 24 + score * 0.28) : isBridge ? 32 : 24,
        draggable: true,
        label: {
          show: isWash || isBridge || isFullscreen,
          formatter: "{b}",
          position: "right",
          distance: 8,
          fontSize: isFullscreen ? 12 : 10,
        },
        itemStyle: {
          borderWidth: isWash ? 3 : 1.5,
          borderColor: isWash ? "#fecaca" : isBridge ? "#fde68a" : "#94a3b8",
          shadowBlur: isWash ? 13 : 5,
          shadowColor: isWash ? "rgba(226, 75, 74, 0.55)" : "rgba(15, 23, 42, 0.25)",
        },
        tooltip: {
          formatter: [
            `<strong>${node.label || shortAddress(node.id)}</strong>`,
            `Type: ${node.type}`,
            score ? `GNN score: ${score}/100` : "GNN score: —",
            `Address: ${node.id}`,
          ].join("<br/>"),
        },
      };
    });

    const graphLinks = readableEdges.map((edge) => {
      const isLargeFlow = edge.weight >= 0.72;
      const lineWidth = edge.suspicious
        ? 1.8 + edge.weight * (isFullscreen ? 3.8 : 2.8)
        : 0.8 + edge.weight * 1.4;

      return {
        source: edge.from,
        target: edge.to,
        value: edge.amount,
        suspicious: edge.suspicious,
        lineStyle: {
          width: lineWidth,
          opacity: edge.suspicious ? 0.78 : 0.24,
          color: edge.suspicious ? "#e24b4a" : "#64748b",
          curveness: edge.curveness,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: {
            width: Math.max(lineWidth + 2, edge.suspicious ? 5 : 3),
            opacity: 1,
          },
          label: {
            show: true,
            formatter: `${formatNumber(edge.amount)}${edge.transferCount > 1 ? ` · ${edge.transferCount} tx` : ""}`,
            color: edge.suspicious ? "#dc2626" : "#334155",
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: "rgba(255,255,255,0.92)",
            borderColor: "rgba(148,163,184,0.45)",
            borderWidth: 1,
            borderRadius: 6,
            padding: [3, 6],
          },
        },
        label: {
          // Do not render all edge amounts by default. It prevents overlap.
          // Amount is shown on hover/emphasis and in tooltip.
          show: false,
          formatter: isLargeFlow ? formatNumber(edge.amount) : "",
        },
        tooltip: {
          formatter: [
            `<strong>${edge.suspicious ? "Suspicious flow" : "Transfer flow"}</strong>`,
            `From: ${shortAddress(edge.from)}`,
            `To: ${shortAddress(edge.to)}`,
            `Total amount: ${formatNumber(edge.amount)}`,
            `Grouped transfers: ${edge.transferCount}`,
          ].join("<br/>"),
        },
      };
    });

    return {
      backgroundColor: "transparent",
      legend: {
        top: 8,
        right: 16,
        orient: "horizontal",
        itemWidth: 18,
        itemHeight: 10,
        textStyle: {
          color: "inherit",
          fontSize: 11,
        },
        data: categories.map((category) => category.name),
      },
      tooltip: {
        trigger: "item",
        confine: true,
        enterable: false,
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        borderColor: "rgba(148, 163, 184, 0.25)",
        extraCssText: "box-shadow: 0 16px 36px rgba(0,0,0,.28); border-radius: 10px;",
        textStyle: {
          color: "#f8fafc",
          fontSize: 12,
        },
      },
      series: [
        {
          name: "Wallet transaction graph",
          type: "graph",
          layout: "force",
          animation: true,
          animationDuration: 500,
          layoutAnimation: true,
          roam: true,
          roamTrigger: "global",
          draggable: true,
          focusNodeAdjacency: true,
          scaleLimit: {
            min: 0.2,
            max: 10,
          },
          categories,
          data: graphNodes,
          links: graphLinks,
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [0, isFullscreen ? 10 : 8],
          label: {
            position: "right",
            formatter: "{b}",
            color: "var(--graph-text)",
            fontSize: isFullscreen ? 12 : 11,
            distance: 8,
            hideOverlap: true,
          },
          edgeLabel: {
            show: false,
          },
          force: {
            edgeLength: isFullscreen ? [270, 560] : [190, 420],
            repulsion: isFullscreen ? 1800 : 1250,
            gravity: isFullscreen ? 0.025 : 0.035,
            friction: 0.24,
          },
          lineStyle: {
            color: "source",
            curveness: 0.18,
          },
          emphasis: {
            focus: "adjacency",
            label: {
              show: true,
            },
            lineStyle: {
              opacity: 1,
            },
          },
        } as any,
      ],
    } as echarts.EChartsOption;
  }, [visibleNodes, readableEdges, isFullscreen]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      });
    }

    const chart = chartInstanceRef.current;
    chart.setOption(option, true);

    const timer = window.setTimeout(() => {
      chart.resize();
      chart.dispatchAction({ type: "restore" });
    }, 80);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      window.clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [option]);

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  return (
    <div className={`${styles.graphContainer} ${isFullscreen ? styles.graphContainerFullscreen : ""}`}>
      <div className={styles.graphStats}>
        <span>{nodes.length} nodes</span>
        <span>{edges.length} raw edges</span>
        <span>{readableEdges.length} visible flows</span>
        <span>{suspiciousEdges} suspicious groups</span>
        {groupedCount > 0 && <span>{groupedCount} edges grouped</span>}
        <span>Hover edge để xem amount</span>
      </div>

      <div ref={chartRef} className={`${styles.graphEcharts} ${isFullscreen ? styles.graphEchartsFullscreen : ""}`} />

      {!isFullscreen && (
        <div className={styles.graphFooter}>
          {nodes.length > 0
            ? "Live force-directed graph from backend graphData. Drag nodes, zoom, pan, and hover edges/wallets to inspect flow details."
            : "Waiting for backend graphData. Click AI Analyze to build the wallet transaction graph."}
        </div>
      )}
    </div>
  );
};

const WalletRow: React.FC<{ wallet: SuspiciousWallet; index: number; selected?: boolean; onClick?: () => void }> = ({ wallet, index, selected = false, onClick }) => {
  const risk = normalizeRiskLevel(wallet.riskLevel);
  return (
    <button type="button" className={`${styles.walletRow} ${selected ? styles.walletRowSelected : ""}`} onClick={onClick}>
      <div className={styles.walletInfo}>
        <span className={styles.walletAddr}>{shortAddress(wallet.wallet)}</span>
        <span className={styles.walletDesc}>{wallet.pattern} · Graph rank #{index + 1}</span>
      </div>
      <span className={styles.walletGnn}>GNN: {wallet.score.toFixed(2)}</span>
      <span className={`${styles.riskBadge} ${styles[`risk${risk}`]}`}>{risk}</span>
    </button>
  );
};

const WalletInsightPanel: React.FC<{ wallet?: SuspiciousWallet; symbol: string }> = ({ wallet, symbol }) => {
  if (!wallet) {
    return (
      <div className={styles.walletInsightEmpty}>
        Chọn một ví trong danh sách Suspicious Wallets để xem giải thích AI chi tiết.
      </div>
    );
  }

  const topFeature = (Object.entries(wallet.features) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className={styles.walletInsight}>
      <div className={styles.walletInsightHeader}>
        <div>
          <span>Selected wallet</span>
          <strong>{shortAddress(wallet.wallet)}</strong>
        </div>
        <span className={`${styles.riskBadge} ${styles[`risk${normalizeRiskLevel(wallet.riskLevel)}`]}`}>{wallet.riskLevel}</span>
      </div>
      <p>
        AI đánh dấu ví này vì pattern <strong>{wallet.pattern}</strong> trên token <strong>{symbol}</strong>.
        Điểm GNN hiện tại là <strong>{(wallet.score * 100).toFixed(0)}/100</strong>.
      </p>
      <div className={styles.walletInsightGrid}>
        <div><span>Top feature</span><strong>{topFeature?.[0] ?? "—"}</strong></div>
        <div><span>Feature score</span><strong>{topFeature ? topFeature[1].toFixed(2) : "—"}</strong></div>
      </div>
      <p className={styles.walletInsightNote}>
        Cách đọc: ví có circularPattern cao thường tham gia vòng giao dịch khép kín; timeRegularity cao cho thấy bot-like timing; amountSimilarity cao cho thấy lượng token được lặp lại bất thường.
      </p>
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
  const algorithmFromUrl = (searchParams.get("algorithm") || "GCN") as GnnAlgorithm;

  const [symbol, setSymbol] = useState(symbolFromUrl);
  const [timeframe, setTimeframe] = useState<Timeframe>(["24h", "7d", "30d"].includes(timeframeFromUrl) ? timeframeFromUrl : "24h");
  const [manualMint, setManualMint] = useState(mint || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WashTradingResult | null>(null);
  const [algoTab, setAlgoTab] = useState<GnnAlgorithm>(["GCN", "GAT", "GraphSAGE"].includes(algorithmFromUrl) ? algorithmFromUrl : "GCN");
  const [walletFilter, setWalletFilter] = useState<"All" | "High risk" | "New">("All");
  const [selectedWalletAddress, setSelectedWalletAddress] = useState<string | null>(null);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isAiVerdictOpen, setIsAiVerdictOpen] = useState(true);

  useEffect(() => {
    setManualMint(mint || "");
    setIsAiVerdictOpen(true);
  }, [mint]);

  useEffect(() => {
    if (!isGraphModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGraphModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGraphModalOpen]);

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
          timeframe,
          algorithm: algoTab,
          limit: timeframe === "24h" ? 80 : timeframe === "7d" ? 120 : 160,
        }),
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || payload.error || "AI analysis failed");
      }

      setResult(payload.data);
      setSelectedWalletAddress(payload.data.suspiciousWallets[0]?.wallet ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gọi AI Wash Trading API.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [symbol, targetMint, timeframe, algoTab]);

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
    navigate(`/wash-trading/${selectedMint}?symbol=${encodeURIComponent(symbol || "TOKEN")}&timeframe=${timeframe}&algorithm=${algoTab}`);
  };

  const updateUrlParam = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(key, value);
    if (symbol) nextParams.set("symbol", symbol);
    setSearchParams(nextParams);
  };

  const handleTimeframeChange = (next: Timeframe) => {
    setTimeframe(next);
    updateUrlParam("timeframe", next);
  };

  const handleAlgorithmChange = (next: GnnAlgorithm) => {
    setAlgoTab(next);
    updateUrlParam("algorithm", next);
  };

  const filteredWallets = (result?.suspiciousWallets ?? []).filter((wallet) => {
    if (walletFilter === "High risk") return wallet.riskLevel === "High";
    if (walletFilter === "New") return wallet.riskLevel !== "High";
    return true;
  });

  const selectedWallet = result?.suspiciousWallets.find((wallet) => wallet.wallet === selectedWalletAddress) ?? result?.suspiciousWallets[0];
  const topWallet = selectedWallet;
  const featureSource = topWallet?.features;
  const summary = result?.summary;
  const riskScore = summary?.overallRiskScore ?? 0;
  const suspiciousCount = summary?.suspiciousWalletCount ?? 0;

  return (
    <PageWrapper>
      <div className={`${styles.page} ${isLight ? styles.light : ""}`}>
        <div className={styles.fixedControls}>
          <div className={styles.fixedControlsInner}>
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
                <button
                  type="button"
                  className={`${styles.verdictToggle} ${isAiVerdictOpen ? styles.verdictToggleActive : ""}`}
                  onClick={() => setIsAiVerdictOpen((previous) => !previous)}
                  aria-expanded={isAiVerdictOpen}
                  aria-controls="ai-verdict-panel"
                  title={isAiVerdictOpen ? "Ẩn AI Verdict" : "Hiện AI Verdict"}
                >
                  <span className={styles.verdictToggleDot} />
                  <span>AI Verdict</span>
                  <span className={styles.verdictToggleIcon}>{isAiVerdictOpen ? "▴" : "▾"}</span>
                </button>
                <button className={`${styles.btnPrimary} ${isAnalyzing ? styles.loading : ""}`} onClick={handleAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? "Đang phân tích..." : "Run AI Analyze ↗"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.scrollBody}>
          {error && <div className={styles.errorBox}>{error}</div>}

        {isAiVerdictOpen && (
          <div id="ai-verdict-panel" className={styles.aiSummaryCard}>
            <div className={styles.aiSummaryHeader}>
              <span className={styles.aiPill}>AI Verdict</span>
              <strong>{result?.aiAnalysis.verdict?.replaceAll("_", " ") ?? "Waiting for analysis"}</strong>
            </div>
            <p>{result?.aiAnalysis.summary ?? "Nhấn Run AI Analyze để phân tích circular trading, amount similarity, timing regularity và graph features của token này."}</p>
            {result?.dataSource && (
              <div className={`${styles.sourceNotice} ${result.dataSource === "demo-fallback" ? styles.sourceWarning : styles.sourceLive}`}>
                Data source: <strong>{result.dataSource}</strong>
                {result.dataSourceReason ? <span> · {result.dataSourceReason}</span> : null}
              </div>
            )}
            {result?.aiAnalysis.recommendation && (
              <div className={styles.recommendation}>{result.aiAnalysis.recommendation}</div>
            )}
          </div>
        )}

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
                <div className={styles.graphActions}>
                  <div className={styles.algoTabs}>
                    {(["GCN", "GAT", "GraphSAGE"] as const).map((tab) => (
                      <button
                        key={tab}
                        className={`${styles.algoTab} ${algoTab === tab ? styles.algoTabActive : ""}`}
                        onClick={() => handleAlgorithmChange(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.graphFullscreenButton}
                    onClick={() => setIsGraphModalOpen(true)}
                    disabled={!result?.graphData.nodes?.length}
                    title={result?.graphData.nodes?.length ? "Mở graph toàn màn hình" : "Chạy AI Analyze để có graph"}
                  >
                    ⛶ Fullscreen
                  </button>
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
                  filteredWallets.map((wallet, index) => (
                    <WalletRow
                      key={wallet.wallet}
                      wallet={wallet}
                      index={index}
                      selected={selectedWalletAddress === wallet.wallet}
                      onClick={() => setSelectedWalletAddress(wallet.wallet)}
                    />
                  ))
                ) : (
                  <div className={styles.emptyState}>Chưa có ví đáng ngờ. Hãy chạy phân tích AI cho token này.</div>
                )}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>🧩</span>
                <h2 className={styles.cardTitle}>Wallet AI Explanation</h2>
              </div>
              <WalletInsightPanel wallet={selectedWallet} symbol={symbol || "TOKEN"} />
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
                <div><span>Algorithm</span><strong>{result?.algorithm ?? algoTab}</strong></div>
                <div><span>Data source</span><strong>{result?.dataSource ?? "—"}</strong></div>
                <div><span>Source reason</span><strong>{result?.dataSourceReason ?? "—"}</strong></div>
                <div><span>Analyzed at</span><strong>{result ? new Date(result.analyzedAt).toLocaleString("vi-VN") : "—"}</strong></div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {isGraphModalOpen && (
          <div
            className={styles.graphModalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-label="Transaction graph fullscreen view"
            onClick={() => setIsGraphModalOpen(false)}
          >
            <div className={styles.graphModal} onClick={(event) => event.stopPropagation()}>
              <div className={styles.graphModalHeader}>
                <div>
                  <h2 className={styles.graphModalTitle}>Transaction Graph — GNN Cluster View</h2>
                  <p className={styles.graphModalSubtitle}>
                    {symbol || "TOKEN"} · {shortAddress(targetMint)} · {result?.graphData.nodes.length ?? 0} nodes · {result?.graphData.edges.length ?? 0} edges
                  </p>
                </div>

                <div className={styles.graphModalControls}>
                  <div className={styles.algoTabs}>
                    {(["GCN", "GAT", "GraphSAGE"] as const).map((tab) => (
                      <button
                        key={tab}
                        className={`${styles.algoTab} ${algoTab === tab ? styles.algoTabActive : ""}`}
                        onClick={() => handleAlgorithmChange(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.graphCloseButton} onClick={() => setIsGraphModalOpen(false)}>
                    ✕ Close
                  </button>
                </div>
              </div>

              <NetworkGraph nodes={result?.graphData.nodes ?? []} edges={result?.graphData.edges ?? []} isFullscreen />

              <div className={styles.graphModalGuide} aria-label="Graph fullscreen controls">
                <span>🖱 Kéo node để tách cụm ví</span>
                <span>🔍 Cuộn chuột để zoom</span>
                <span>⌨ Esc hoặc Close để đóng</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default WashTradingPage;
