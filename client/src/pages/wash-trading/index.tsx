import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useUserTheme } from "@/contexts/ThemeContext";
import { useLocalization } from "@/contexts/LocalizationContext";
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
    volumeSignal?: number;
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

const getSeverityColor = (severity: Severity) => {
  if (severity === "high") return "#e24b4a";
  if (severity === "medium") return "#ef9f27";
  if (severity === "success") return "#639922";
  return "var(--text-muted)";
};


const normalizeRiskLevel = (riskLevel: string): RiskLevel => {
  if (riskLevel === "High" || riskLevel === "Medium" || riskLevel === "Low") {
    return riskLevel;
  }
  return "Low";
};

const getRiskLevelLabel = (risk: RiskLevel, tr: ReturnType<typeof useLocalization>["tr"]) => {
  if (risk === "High") return tr("washTrading.risk.high");
  if (risk === "Medium") return tr("washTrading.risk.medium");
  return tr("washTrading.risk.low");
};

const getPatternLabel = (pattern: string, tr: ReturnType<typeof useLocalization>["tr"]) => {
  if (pattern === "Circular Trade") return tr("washTrading.patterns.circularTrade");
  if (pattern === "Hub Wallet") return tr("washTrading.patterns.hubWallet");
  if (pattern === "Bot-like Timing") return tr("washTrading.patterns.botLikeTiming");
  if (pattern === "Amount Mirror") return tr("washTrading.patterns.amountMirror");
  if (pattern === "Anomalous Activity") return tr("washTrading.patterns.anomalousActivity");
  return pattern;
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

const NetworkGraph: React.FC<{ nodes: GraphNode[]; edges: GraphEdge[]; tokenSymbol?: string; isFullscreen?: boolean }> = ({
  nodes,
  edges,
  tokenSymbol,
  isFullscreen = false,
}) => {
  const { tr, fmt } = useLocalization();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const visibleNodes = useMemo(() => {
    const sourceNodes = nodes.length > 0
      ? nodes
      : [
          { id: "empty-1", type: "normal" as const, label: String(tr("common.noData")) },
          { id: "empty-2", type: "normal" as const, label: String(tr("washTrading.inputs.runAnalyze")) },
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
  const graphAmountUnit = useMemo(
    () => tokenSymbol?.trim().toUpperCase() || String(tr("washTrading.graph.tokenUnit")),
    [tokenSymbol, tr],
  );

  const formatGraphAmount = useCallback(
    (value: number) => `${fmt.num.compact.decimal(value || 0)} ${graphAmountUnit}`,
    [fmt, graphAmountUnit],
  );

  const option = useMemo<echarts.EChartsOption>(() => {
    const categories = [
      { name: String(tr("washTrading.graph.highRiskWallet")), itemStyle: { color: "#e24b4a" } },
      { name: String(tr("washTrading.graph.bridgeWallet")), itemStyle: { color: "#ef9f27" } },
      { name: String(tr("washTrading.graph.normalWallet")), itemStyle: { color: "#64748b" } },
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
      const typeLabel = isWash ? tr("washTrading.graph.highRiskWallet") : isBridge ? tr("washTrading.graph.bridgeWallet") : tr("washTrading.graph.normalWallet");
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
            `${tr("washTrading.graph.type")}: ${typeLabel}`,
            score ? `${tr("washTrading.graph.gnnScore")}: ${score}/100` : `${tr("washTrading.graph.gnnScore")}: —`,
            `${tr("washTrading.graph.address")}: ${node.id}`,
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
            formatter: `${formatGraphAmount(edge.amount)}${edge.transferCount > 1 ? ` · ${edge.transferCount} tx` : ""}`,
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
          formatter: isLargeFlow ? formatGraphAmount(edge.amount) : "",
        },
        tooltip: {
          formatter: [
            `<strong>${edge.suspicious ? tr("washTrading.graph.suspiciousFlow") : tr("washTrading.graph.transferFlow")}</strong>`,
            `${tr("washTrading.graph.from")}: ${shortAddress(edge.from)}`,
            `${tr("washTrading.graph.to")}: ${shortAddress(edge.to)}`,
            `${tr("washTrading.graph.totalAmount")}: ${formatGraphAmount(edge.amount)}`,
            `${tr("washTrading.graph.groupedTransfers")}: ${edge.transferCount}`,
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
          name: String(tr("washTrading.graph.walletGraphName")),
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
  }, [visibleNodes, readableEdges, isFullscreen, tr, formatGraphAmount]);

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
        <span>{tr("washTrading.graph.nodes", { count: nodes.length })}</span>
        <span>{tr("washTrading.graph.rawEdges", { count: edges.length })}</span>
        <span>{tr("washTrading.graph.visibleFlows", { count: readableEdges.length })}</span>
        <span>{tr("washTrading.graph.suspiciousGroups", { count: suspiciousEdges })}</span>
        {groupedCount > 0 && <span>{tr("washTrading.graph.edgesGrouped", { count: groupedCount })}</span>}
        <span>{tr("washTrading.graph.hoverEdgeAmount")}</span>
      </div>

      <div ref={chartRef} className={`${styles.graphEcharts} ${isFullscreen ? styles.graphEchartsFullscreen : ""}`} />

      {!isFullscreen && (
        <div className={styles.graphFooter}>
          {nodes.length > 0
            ? tr("washTrading.graph.footerReady")
            : tr("washTrading.graph.footerWaiting")}
        </div>
      )}
    </div>
  );
};


const getAlgorithmTooltip = (algorithm: GnnAlgorithm, tr: ReturnType<typeof useLocalization>["tr"]) => {
  if (algorithm === "GCN") {
    return {
      title: String(tr("washTrading.graph.algorithms.gcn.title")),
      description: String(tr("washTrading.graph.algorithms.gcn.description")),
      bestFor: String(tr("washTrading.graph.algorithms.gcn.bestFor")),
    };
  }

  if (algorithm === "GAT") {
    return {
      title: String(tr("washTrading.graph.algorithms.gat.title")),
      description: String(tr("washTrading.graph.algorithms.gat.description")),
      bestFor: String(tr("washTrading.graph.algorithms.gat.bestFor")),
    };
  }

  return {
    title: String(tr("washTrading.graph.algorithms.graphsage.title")),
    description: String(tr("washTrading.graph.algorithms.graphsage.description")),
    bestFor: String(tr("washTrading.graph.algorithms.graphsage.bestFor")),
  };
};

const AlgorithmTab: React.FC<{
  algorithm: GnnAlgorithm;
  active: boolean;
  onSelect: (algorithm: GnnAlgorithm) => void;
}> = ({ algorithm, active, onSelect }) => {
  const { tr } = useLocalization();
  const tooltip = getAlgorithmTooltip(algorithm, tr);
  const tooltipId = `wash-trading-algorithm-${algorithm.toLowerCase()}-tooltip`;

  return (
    <div className={styles.algoTabWrap}>
      <button
        type="button"
        className={`${styles.algoTab} ${active ? styles.algoTabActive : ""}`}
        onClick={() => onSelect(algorithm)}
        aria-describedby={tooltipId}
        aria-label={String(tr("washTrading.graph.algorithmButtonAria", { algorithm }))}
      >
        {algorithm}
      </button>

      <div id={tooltipId} role="tooltip" className={styles.algoTooltip}>
        <div className={styles.algoTooltipTitle}>{tooltip.title}</div>
        <p>{tooltip.description}</p>
        <div className={styles.algoTooltipBestFor}>
          <span>{tr("washTrading.graph.algorithms.bestForLabel")}</span>
          <strong>{tooltip.bestFor}</strong>
        </div>
      </div>
    </div>
  );
};

const WalletRow: React.FC<{ wallet: SuspiciousWallet; index: number; selected?: boolean; onClick?: () => void }> = ({ wallet, index, selected = false, onClick }) => {
  const { tr } = useLocalization();
  const risk = normalizeRiskLevel(wallet.riskLevel);
  return (
    <button type="button" className={`${styles.walletRow} ${selected ? styles.walletRowSelected : ""}`} onClick={onClick}>
      <div className={styles.walletInfo}>
        <span className={styles.walletAddr}>{shortAddress(wallet.wallet)}</span>
        <span className={styles.walletDesc}>{getPatternLabel(wallet.pattern, tr)} · {tr("washTrading.wallets.graphRank", { rank: String(index + 1) })}</span>
      </div>
      <span className={styles.walletGnn}>{tr("washTrading.wallets.gnn", { score: wallet.score.toFixed(2) })}</span>
      <span className={`${styles.riskBadge} ${styles[`risk${risk}`]}`}>{getRiskLevelLabel(risk, tr)}</span>
    </button>
  );
};

const WalletInsightPanel: React.FC<{ wallet?: SuspiciousWallet; symbol: string }> = ({ wallet, symbol }) => {
  const { tr } = useLocalization();
  if (!wallet) {
    return (
      <div className={styles.walletInsightEmpty}>
        {tr("washTrading.wallets.insightEmpty")}
      </div>
    );
  }

  const topFeature = (Object.entries(wallet.features) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className={styles.walletInsight}>
      <div className={styles.walletInsightHeader}>
        <div>
          <span>{tr("washTrading.wallets.selectedWallet")}</span>
          <strong>{shortAddress(wallet.wallet)}</strong>
        </div>
        <span className={`${styles.riskBadge} ${styles[`risk${normalizeRiskLevel(wallet.riskLevel)}`]}`}>{getRiskLevelLabel(normalizeRiskLevel(wallet.riskLevel), tr)}</span>
      </div>
      <p>
        {tr("washTrading.wallets.explanation", {
          pattern: getPatternLabel(wallet.pattern, tr),
          symbol,
          score: (wallet.score * 100).toFixed(0),
        })}
      </p>
      <div className={styles.walletInsightGrid}>
        <div><span>{tr("washTrading.wallets.topFeature")}</span><strong>{topFeature?.[0] ?? "—"}</strong></div>
        <div><span>{tr("washTrading.wallets.featureScore")}</span><strong>{topFeature ? topFeature[1].toFixed(2) : "—"}</strong></div>
      </div>
      <p className={styles.walletInsightNote}>
        {tr("washTrading.wallets.note")}
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
  const { tr, lang, fmt } = useLocalization();
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
      setError(String(tr("washTrading.errors.missingMint")));
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
          language: lang,
          limit: timeframe === "24h" ? 80 : timeframe === "7d" ? 120 : 160,
        }),
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || payload.error || String(tr("washTrading.errors.analysisFailed")));
      }

      setResult(payload.data);
      setSelectedWalletAddress(payload.data.suspiciousWallets[0]?.wallet ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(tr("washTrading.errors.apiFailed")));
    } finally {
      setIsAnalyzing(false);
    }
  }, [symbol, targetMint, timeframe, algoTab, lang, tr]);

  useEffect(() => {
    if (mint) {
      void handleAnalyze();
    }
  }, [mint, handleAnalyze]);

  const handleManualOpen = () => {
    const selectedMint = manualMint.trim();
    if (!selectedMint) {
      setError(String(tr("washTrading.errors.manualMissingMint")));
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
  const walletGnnScore = topWallet ? Math.round(Math.max(0, Math.min(1, topWallet.score || 0)) * 100) : 0;
  const walletRiskLabel = topWallet
    ? getRiskLevelLabel(normalizeRiskLevel(topWallet.riskLevel), tr)
    : tr("washTrading.risk.noSignal");
  const verdictLabel = result?.aiAnalysis.verdict === "HIGH_RISK"
    ? tr("washTrading.verdict.highRisk")
    : result?.aiAnalysis.verdict === "MEDIUM_RISK"
    ? tr("washTrading.verdict.mediumRisk")
    : result?.aiAnalysis.verdict === "LOW_RISK"
    ? tr("washTrading.verdict.lowRisk")
    : result?.aiAnalysis.verdict === "CLEAN"
    ? tr("washTrading.verdict.clean")
    : tr("washTrading.verdict.waiting");

  const formatCompactNumber = useCallback(
    (value: number) => fmt.num.compact.decimal(value || 0),
    [fmt],
  );
  const formatCurrency = useCallback(
    (value: number) => fmt.num.compact.currency(value || 0),
    [fmt],
  );
  const formatPercent = useCallback(
    (value: number) => fmt.num.compact.percent(value || 0),
    [fmt],
  );

  return (
    <PageWrapper>
      <div className={`${styles.page} ${isLight ? styles.light : ""}`}>
        <div className={styles.fixedControls}>
          <div className={styles.fixedControlsInner}>
            <div className={styles.breadcrumb}>
              <Link to="/tokens" className={styles.breadcrumbLink}>{tr("washTrading.breadcrumb.tokens")}</Link>
              <span>/</span>
              {mint ? <Link to={`/tokens/${mint}`} className={styles.breadcrumbLink}>{symbol || shortAddress(mint)}</Link> : <span>{tr("washTrading.breadcrumb.manualToken")}</span>}
              <span>/</span>
              <span>{tr("washTrading.breadcrumb.page")}</span>
            </div>

            <div className={styles.topbar}>
              <div className={styles.topbarLeft}>
                <span className={styles.pageIcon}>◎</span>
                <div>
                  <h1 className={styles.pageTitle}>{tr("washTrading.title")}</h1>
                  <p className={styles.pageSubtitle}>
                    {tr("washTrading.subtitle", { symbol: symbol || "TOKEN", mint: shortAddress(targetMint) })}
                  </p>
                </div>
                <span className={styles.suspiciousBadge}>{tr("washTrading.suspiciousBadge", { count: suspiciousCount })}</span>
              </div>

              <div className={styles.topbarRight}>
                {!mint && (
                  <input
                    className={styles.mintInput}
                    value={manualMint}
                    onChange={(event) => setManualMint(event.target.value)}
                    placeholder={String(tr("washTrading.inputs.mintPlaceholder"))}
                  />
                )}
                <input
                  className={styles.symbolInput}
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  placeholder={String(tr("washTrading.inputs.symbolPlaceholder"))}
                />
                <select className={styles.tokenSelect} value={timeframe} onChange={(event) => handleTimeframeChange(event.target.value as Timeframe)}>
                  <option value="24h">{tr("washTrading.inputs.last24h")}</option>
                  <option value="7d">{tr("washTrading.inputs.last7d")}</option>
                  <option value="30d">{tr("washTrading.inputs.last30d")}</option>
                </select>
                {!mint && (
                  <button className={styles.btnSecondary} onClick={handleManualOpen}>
                    {tr("washTrading.inputs.openToken")}
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.verdictToggle} ${isAiVerdictOpen ? styles.verdictToggleActive : ""}`}
                  onClick={() => setIsAiVerdictOpen((previous) => !previous)}
                  aria-expanded={isAiVerdictOpen}
                  aria-controls="ai-verdict-panel"
                  title={String(isAiVerdictOpen ? tr("washTrading.verdict.hide") : tr("washTrading.verdict.show"))}
                >
                  <span className={styles.verdictToggleDot} />
                  <span>{tr("washTrading.verdict.toggle")}</span>
                  <span className={styles.verdictToggleIcon}>{isAiVerdictOpen ? "▴" : "▾"}</span>
                </button>
                <button className={`${styles.btnPrimary} ${isAnalyzing ? styles.loading : ""}`} onClick={handleAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? tr("washTrading.inputs.analyzing") : tr("washTrading.inputs.runAnalyze")}
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
              <span className={styles.aiPill}>{tr("washTrading.verdict.toggle")}</span>
              <strong>{verdictLabel}</strong>
            </div>
            <p>{result?.aiAnalysis.summary ?? tr("washTrading.verdict.defaultSummary")}</p>
            {result?.dataSource && (
              <div className={`${styles.sourceNotice} ${result.dataSource === "demo-fallback" ? styles.sourceWarning : styles.sourceLive}`}>
                {tr("washTrading.verdict.dataSource")} <strong>{result.dataSource}</strong>
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
            {
              label: String(tr("washTrading.metrics.totalTransactions")),
              value: formatCompactNumber(summary?.totalTransactions ?? 0),
              sub: String(tr("washTrading.metrics.uniqueWallets", { wallets: formatCompactNumber(summary?.uniqueWallets ?? 0) })),
              subColor: "var(--text-secondary)",
            },
            {
              label: String(tr("washTrading.metrics.washVolumeEstimate")),
              value: formatCurrency(summary?.washVolumeEstimate ?? 0),
              sub: String(tr("washTrading.metrics.totalVolumePercent", {
                percent: formatPercent(summary?.washVolumePercent ?? 0),
                volume: formatCurrency(summary?.totalVolume ?? 0),
              })),
              subColor: "#e24b4a",
            },
            {
              label: String(tr("washTrading.metrics.suspiciousWallets")),
              value: formatCompactNumber(suspiciousCount),
              sub: String(tr("washTrading.metrics.circularClusters", { count: summary?.circularTradeCount ?? 0 })),
              subColor: "#ef9f27",
            },
            {
              label: String(tr("washTrading.metrics.gnnConfidence")),
              value: formatPercent((summary?.gnnConfidence ?? 0) * 100),
              sub: String(tr("washTrading.metrics.riskScore", { score: formatCompactNumber(riskScore) })),
              subColor: "#639922",
            },
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
                <h2 className={styles.cardTitle}>{tr("washTrading.graph.title")}</h2>
                <div className={styles.graphActions}>
                  <div className={styles.algoTabs}>
                    {(["GCN", "GAT", "GraphSAGE"] as const).map((tab) => (
                      <AlgorithmTab
                        key={tab}
                        algorithm={tab}
                        active={algoTab === tab}
                        onSelect={handleAlgorithmChange}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.graphFullscreenButton}
                    onClick={() => setIsGraphModalOpen(true)}
                    disabled={!result?.graphData.nodes?.length}
                    title={String(result?.graphData.nodes?.length ? tr("washTrading.graph.fullscreenTitle") : tr("washTrading.graph.fullscreenWaitingTitle"))}
                  >
                    ⛶ {tr("washTrading.graph.fullscreen")}
                  </button>
                </div>
              </div>
              <NetworkGraph nodes={result?.graphData.nodes ?? []} edges={result?.graphData.edges ?? []} tokenSymbol={symbol || result?.symbol} />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>🔍</span>
                <h2 className={styles.cardTitle}>{tr("washTrading.wallets.title")}</h2>
                <div className={styles.walletTabs}>
                  {(["All", "High risk", "New"] as const).map((filter) => (
                    <button
                      key={filter}
                      className={`${styles.walletTab} ${walletFilter === filter ? styles.walletTabActive : ""}`}
                      onClick={() => setWalletFilter(filter)}
                    >
                      {filter === "All" ? tr("washTrading.wallets.all") : filter === "High risk" ? tr("washTrading.wallets.highRisk") : tr("washTrading.wallets.new")}
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
                  <div className={styles.emptyState}>{tr("washTrading.wallets.empty")}</div>
                )}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>🧩</span>
                <h2 className={styles.cardTitle}>{tr("washTrading.wallets.insightTitle")}</h2>
              </div>
              <WalletInsightPanel wallet={selectedWallet} symbol={symbol || "TOKEN"} />
            </div>

            {result?.aiAnalysis.detailedFindings?.length ? (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardIcon}>🧠</span>
                  <h2 className={styles.cardTitle}>{tr("washTrading.findings.title")}</h2>
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
                <h2 className={styles.cardTitle}>{tr("washTrading.risk.walletTitle", { target: topWallet ? shortAddress(topWallet.wallet) : "—" })}</h2>
              </div>
              <RiskGauge score={walletGnnScore} label={String(walletRiskLabel)} />
              <div className={styles.riskScoreMeta}>
                <span>{tr("washTrading.risk.tokenRiskScore")}</span>
                <strong>{tr("washTrading.risk.scoreOutOf100", { score: formatCompactNumber(riskScore) })}</strong>
              </div>
              <div className={styles.featuresSection}>
                <div className={styles.featuresTitle}>{tr("washTrading.risk.walletFeatureTitle")}</div>
                <FeatureBar label={String(tr("washTrading.risk.circularPattern"))} value={featureSource?.circularPattern ?? 0} />
                <FeatureBar label={String(tr("washTrading.risk.timeRegularity"))} value={featureSource?.timeRegularity ?? 0} />
                <FeatureBar label={String(tr("washTrading.risk.amountSimilarity"))} value={featureSource?.amountSimilarity ?? 0} />
                <FeatureBar label={String(tr("washTrading.risk.selfLoopDegree"))} value={featureSource?.selfLoopDegree ?? 0} />
                <FeatureBar label={String(tr("washTrading.risk.hubness"))} value={featureSource?.hubness ?? 0} />
                <FeatureBar label={String(tr("washTrading.risk.volumeSignal"))} value={featureSource?.volumeSignal ?? 0} />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>⏱</span>
                <h2 className={styles.cardTitle}>{tr("washTrading.detectionLog.title")}</h2>
              </div>
              <div className={styles.logList}>
                {(result?.detectionLog ?? [
                  { time: "--:--", message: String(tr("washTrading.detectionLog.waiting")), severity: "info" as Severity },
                ]).map((item, index) => (
                  <LogItem key={`${item.time}-${index}`} time={item.time} text={item.message} color={getSeverityColor(item.severity)} />
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>📌</span>
                <h2 className={styles.cardTitle}>{tr("washTrading.context.title")}</h2>
              </div>
              <div className={styles.contextList}>
                <div><span>{tr("washTrading.context.symbol")}</span><strong>{symbol || "TOKEN"}</strong></div>
                <div><span>{tr("washTrading.context.mint")}</span><strong>{shortAddress(targetMint)}</strong></div>
                <div><span>{tr("washTrading.context.timeframe")}</span><strong>{timeframe}</strong></div>
                <div><span>{tr("washTrading.context.algorithm")}</span><strong>{result?.algorithm ?? algoTab}</strong></div>
                <div><span>{tr("washTrading.context.dataSource")}</span><strong>{result?.dataSource ?? "—"}</strong></div>
                <div><span>{tr("washTrading.context.sourceReason")}</span><strong>{result?.dataSourceReason ?? "—"}</strong></div>
                <div><span>{tr("washTrading.context.analyzedAt")}</span><strong>{result ? fmt.datetime.datetime(result.analyzedAt) : "—"}</strong></div>
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
            aria-label={String(tr("washTrading.graph.modalAria"))}
            onClick={() => setIsGraphModalOpen(false)}
          >
            <div className={styles.graphModal} onClick={(event) => event.stopPropagation()}>
              <div className={styles.graphModalHeader}>
                <div>
                  <h2 className={styles.graphModalTitle}>{tr("washTrading.graph.title")}</h2>
                  <p className={styles.graphModalSubtitle}>
                    {tr("washTrading.graph.modalSubtitle", {
                      symbol: symbol || "TOKEN",
                      mint: shortAddress(targetMint),
                      nodes: formatCompactNumber(result?.graphData.nodes.length ?? 0),
                      edges: formatCompactNumber(result?.graphData.edges.length ?? 0),
                    })}
                  </p>
                </div>

                <div className={styles.graphModalControls}>
                  <div className={styles.algoTabs}>
                    {(["GCN", "GAT", "GraphSAGE"] as const).map((tab) => (
                      <AlgorithmTab
                        key={tab}
                        algorithm={tab}
                        active={algoTab === tab}
                        onSelect={handleAlgorithmChange}
                      />
                    ))}
                  </div>
                  <button type="button" className={styles.graphCloseButton} onClick={() => setIsGraphModalOpen(false)}>
                    ✕ {tr("washTrading.graph.close")}
                  </button>
                </div>
              </div>

              <NetworkGraph nodes={result?.graphData.nodes ?? []} edges={result?.graphData.edges ?? []} tokenSymbol={symbol || result?.symbol} isFullscreen />

              <div className={styles.graphModalGuide} aria-label={String(tr("washTrading.graph.guideAria"))}>
                <span>{tr("washTrading.graph.guideDrag")}</span>
                <span>{tr("washTrading.graph.guideZoom")}</span>
                <span>{tr("washTrading.graph.guideClose")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};

export default WashTradingPage;
