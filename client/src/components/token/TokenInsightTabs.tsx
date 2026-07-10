import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type { InferResponseType } from "hono/client";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import styles from "./TokenInsightTabs.module.scss";
import { TopHoldersTable } from "./TopHoldersTable";
import { TokenAllocation, type AllocationItem } from "./TokenAllocation";
import { TokenUnlockSchedule, type UnlockEvent } from "./TokenUnlockSchedule";
import { TokenInvestors, type InvestorData } from "./TokenInvestors";

// ─── Types ───────────────────────────────────────────────────────────────────

type TopHoldersData = InferResponseType<
  (typeof client.api.tokens.holders)[":address"]["$get"],
  200
>;

interface MarketData {
  priceUsd: number;
  priceChangePercentage24h: number | null;
  volume24h: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  fullyDilutedValuation: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  totalSupply: number | null;
  ath: number | null;
  athChangePercentage: number | null;
  atl: number | null;
  atlChangePercentage: number | null;
}

interface MetaData {
  name: string;
  symbol: string;
  description?: string | null;
}

interface DistributionData {
  top_10: string;
  "11_25": string;
  "26_50": string;
  rest: string;
}

interface TokenInsightTabsProps {
  address: string;
  meta: MetaData;
  market: MarketData | null;
  holders: TopHoldersData;
  holdersLoading?: boolean;
}

// ─── Asset name resolver ──────────────────────────────────────────────────────

function resolveAssetName(symbol: string, name?: string): string {
  let cleanName =
    name && name !== "Unknown Token"
      ? name.split(" (")[0].trim().toLowerCase()
      : "";
  if (cleanName.startsWith("wrapped ")) cleanName = cleanName.replace("wrapped ", "");
  if (cleanName.startsWith("bridged "))  cleanName = cleanName.replace("bridged ", "");

  const nameMap: Record<string, string> = {
    sol: "solana", ether: "ethereum", eth: "ethereum",
    bitcoin: "bitcoin", btc: "bitcoin", matic: "polygon",
    bnb: "binancecoin", avax: "avalanche", arb: "arbitrum",
    link: "chainlink", ada: "cardano", dot: "polkadot",
    uni: "uniswap", atom: "cosmos", xlm: "stellar",
    apt: "aptos", sui: "sui", op: "optimism",
    near: "near", fil: "filecoin", algo: "algorand",
  };

  if (nameMap[cleanName]) return nameMap[cleanName];
  const symLower = symbol.toLowerCase();
  return nameMap[symLower] || cleanName || symLower;
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

const DONUT_COLORS = ["#1665C0", "#3D8DF5", "#7BB8F5", "#C4DFF9"];

type DonutTooltipParam = {
  percent: number;
  name: string;
  color: string;
  value: number;
};

function buildDonutOption(
  distribution: DistributionData,
  labels: { top10: string; mid1: string; mid2: string; others: string },
  isDark: boolean,
): EChartsOption {
  const mid1Key = "11_25";
  const mid2Key = "26_50";

  const entries = [
    { name: labels.top10, value: parseFloat(distribution.top_10 ?? "0") },
    { name: labels.mid1, value: parseFloat((distribution as unknown as Record<string, string | undefined>)[mid1Key] ?? "0") },
    { name: labels.mid2, value: parseFloat((distribution as unknown as Record<string, string | undefined>)[mid2Key] ?? "0") },
    { name: labels.others, value: parseFloat(distribution.rest ?? "0") },
  ].filter((e) => e.value > 0);

  return {
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e1e2e",
      borderColor: "#3a3a5c",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: "#e0e0e0", fontSize: 13 },
      formatter: (param: unknown) => {
        const params = param as DonutTooltipParam;
        const bar = Math.round(params.percent);
        const filled = Math.round(bar / 5);
        const track = 20;
        const barStr = "█".repeat(filled) + "░".repeat(track - filled);
        return [
          `<b style="color:#fff;font-size:14px">${params.name}</b>`,
          `<span style="color:${params.color}">●</span> ${params.value.toFixed(2)}% của tổng cung`,
          `<span style="font-family:monospace;color:#7bb8f5;font-size:11px">${barStr}</span>`,
        ].join("<br/>");
      },
    },
    legend: {
      orient: "horizontal",
      bottom: 2,
      left: "center",
      padding: 0,
      icon: "circle",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 24,
      textStyle: { fontSize: 13, color: isDark ? "#c6c6c6" : "#444" },
      formatter: (name: string) => {
        const entry = entries.find((e) => e.name == name);
        return entry ? `${name}  ${entry.value.toFixed(2)}%` : name;
      },
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "48%"],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: false },
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.4)" },
        },
        data: entries.map((e, i) => ({
          ...e,
          itemStyle: { color: DONUT_COLORS[i % DONUT_COLORS.length] },
        })),
      },
    ],
  };
}

// ─── Highlight Text ──────────────────────────────────────────────────────────

function HighlightedText({ text }: { text: string }) {
  const regex =
    /(\\.?\\$[\\d,.]+[KMBT]?|[+-][\\d.]+%|[\\d,.]+(?:\\s+(?:nghìn tỷ|tỷ|triệu|nghìn))?\\s+đồng)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const val = match[0];
    if (val.startsWith("-") && val.endsWith("%")) {
      parts.push(<span key={match.index} className={styles.negative}>{val}</span>);
    } else if (val.startsWith("+") && val.endsWith("%")) {
      parts.push(<span key={match.index} className={styles.positive}>{val}</span>);
    } else {
      parts.push(<span key={match.index} className={styles.highlightValue}>{val}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className={styles.insightCard}>
      <h4 className={styles.insightQuestion}>{question}</h4>
      <p className={styles.insightAnswer}>
        <HighlightedText text={answer} />
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TokenInsightTabs({
  meta,
  market,
  holders,
  holdersLoading = false,
}: TokenInsightTabsProps) {
  const { tr, fmt } = useLocalization();
  const { theme } = useUserTheme();
  const isDark = theme == "dark";
  const [activeTab, setActiveTab] = useState(0);

  // ── Mobula data (single fetch for all Tokenomics + Investors) ──────────────
  const [mobulaLoading, setMobulaLoading] = useState(true);
  const [allocation, setAllocation]       = useState<AllocationItem[]>([]);
  const [releaseSchedule, setReleaseSchedule] = useState<UnlockEvent[]>([]);
  const [investors, setInvestors]         = useState<InvestorData[]>([]);

  useEffect(() => {
    let cancelled = false;
    setMobulaLoading(true);
    setAllocation([]);
    setReleaseSchedule([]);
    setInvestors([]);

    const fetchMobula = async () => {
      try {
        const asset = resolveAssetName(meta.symbol, meta.name);
        const res = await fetch(
          `https://api.mobula.io/api/1/metadata?asset=${encodeURIComponent(asset)}`,
          { headers: { Authorization: "26b01ba0-8418-475c-af44-91bcee6d32e6" } },
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const d = json.data;
        if (!d || cancelled) return;

        // Distribution / Allocation
        if (d.distribution?.length > 0) {
          const sorted = [...d.distribution].sort(
            (a: AllocationItem, b: AllocationItem) => b.percentage - a.percentage,
          );
          let finalData = sorted;
          if (sorted.length > 8) {
            const top8 = sorted.slice(0, 8);
            const othersSum = sorted
              .slice(8)
              .reduce((s: number, i: AllocationItem) => s + i.percentage, 0);
            if (othersSum > 0) top8.push({ name: "Others", percentage: othersSum });
            finalData = top8;
          }
          if (!cancelled) setAllocation(finalData);
        }

        // Release schedule
        if (d.release_schedule?.length > 0 && !cancelled) {
          setReleaseSchedule(d.release_schedule);
        }

        // Investors (lead first)
        if (d.investors?.length > 0 && !cancelled) {
          const sorted = [...d.investors].sort(
            (a: InvestorData, b: InvestorData) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0),
          );
          setInvestors(sorted);
        }
      } catch {
        // silently fail — tabs simply won't appear
      } finally {
        if (!cancelled) setMobulaLoading(false);
      }
    };

    fetchMobula();
    return () => { cancelled = true; };
  }, [meta.symbol, meta.name]);

  // ── Dynamic tab visibility ─────────────────────────────────────────────────
  const hasTokenomics = !mobulaLoading && (allocation.length > 0 || releaseSchedule.length > 0);
  const hasInvestors  = !mobulaLoading && investors.length > 0;

  // If current tab becomes hidden (e.g. no data), reset to Stats
  useEffect(() => {
    if (!mobulaLoading) {
      if (activeTab === 2 && !hasTokenomics) setActiveTab(0);
      if (activeTab === 3 && !hasInvestors)  setActiveTab(0);
    }
  }, [mobulaLoading, hasTokenomics, hasInvestors]);

  // ── Holders distribution (computed from holders prop) ─────────────────────
  const distribution = useMemo<DistributionData | null>(() => {
    if (!holders || holders.length === 0) return null;
    let top10 = 0, mid1 = 0, mid2 = 0;
    holders.forEach((h, index) => {
      const pct = Number(h.percentage) || 0;
      if (index < 10) top10 += pct;
      else if (index < 25) mid1 += pct;
      else if (index < 50) mid2 += pct;
    });
    const rest = Math.max(0, 100 - top10 - mid1 - mid2);
    return { top_10: String(top10), "11_25": String(mid1), "26_50": String(mid2), rest: String(rest) };
  }, [holders]);

  const distLoading = holdersLoading;

  // ── Stats tab content ──────────────────────────────────────────────────────
  const name   = meta.name;
  const symbol = meta.symbol.toUpperCase();

  const fmtCurrency = (v: number | null | undefined) =>
    fmt.num.readableCompact.currency(v ?? null);
  const fmtSupply = (v: number | null | undefined, sym: string): string => {
    if (v == null || isNaN(v)) return "—";
    const count =
      v >= 1e9 ? Math.round(v / 1e9)
      : v >= 1e6 ? Math.round(v / 1e6)
      : v >= 1e3 ? Math.round(v / 1e3)
      : null;
    if (v >= 1e9) return tr("token.insightTabs.supplyBillion", { count: count!, symbol: sym });
    if (v >= 1e6) return tr("token.insightTabs.supplyMillion", { count: count!, symbol: sym });
    if (v >= 1e3) return tr("token.insightTabs.supplyThousand", { count: count!, symbol: sym });
    return `${v.toLocaleString()} ${sym}`;
  };

  const insightCards = market
    ? [
        { question: tr("token.insightTabs.volumeQ", { name, symbol }), answer: tr("token.insightTabs.volumeA", { name, symbol, volume: fmtCurrency(market.volume24h), change: fmt.num.percent(market.priceChangePercentage24h) }) },
        ...(market.ath != null ? [{ question: tr("token.insightTabs.athAtlQ", { name, symbol }), answer: tr("token.insightTabs.athAtlA", { name, symbol, ath: fmtCurrency(market.ath), atl: fmtCurrency(market.atl), athPct: fmt.num.percent(market.athChangePercentage), atlPct: fmt.num.percent(market.atlChangePercentage) }) }] : []),
        ...(market.marketCap != null ? [{ question: tr("token.insightTabs.marketCapQ", { name, symbol }), answer: tr("token.insightTabs.marketCapA", { name, symbol, marketCap: fmtCurrency(market.marketCap), rank: String(market.marketCapRank ?? "—"), supply: fmtSupply(market.circulatingSupply, symbol) }) }] : []),
        ...(market.fullyDilutedValuation != null ? [{ question: tr("token.insightTabs.fdvQ", { name, symbol }), answer: tr("token.insightTabs.fdvA", { name, symbol, fdv: fmtCurrency(market.fullyDilutedValuation), maxSupply: fmtSupply(market.maxSupply ?? market.totalSupply, symbol) }) }] : []),
      ]
    : [];

  const donutLabels = { top10: tr("token.insightTabs.top10"), mid1: "11–25", mid2: "26–50", others: tr("token.insightTabs.others") };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      {/* Tab bar */}
      <div className={styles.tabs}>
        <button className={`${styles.tabBtn} ${activeTab === 0 ? styles.active : ""}`} onClick={() => setActiveTab(0)}>
          {tr("token.insightTabs.about") || "Stats"}
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 1 ? styles.active : ""}`} onClick={() => setActiveTab(1)}>
          {tr("token.insightTabs.holders") || "Holders"}
        </button>
        {hasTokenomics && (
          <button className={`${styles.tabBtn} ${activeTab === 2 ? styles.active : ""}`} onClick={() => setActiveTab(2)}>
            Tokenomics
          </button>
        )}
        {hasInvestors && (
          <button className={`${styles.tabBtn} ${activeTab === 3 ? styles.active : ""}`} onClick={() => setActiveTab(3)}>
            Investors
          </button>
        )}
      </div>

      {/* Stats tab */}
      {activeTab === 0 && (
        <div className={styles.tabContent} key="about">
          {insightCards.length > 0 && (
            <div className={styles.insightGrid}>
              {insightCards.map((card, i) => <InsightCard key={i} {...card} />)}
            </div>
          )}
        </div>
      )}

      {/* Holders tab */}
      {activeTab === 1 && (
        <div className={styles.tabContent} key="holders">
          <div className={styles.holdersLayout}>
            <div className={styles.holdersTable}>
              <TopHoldersTable holders={holders} loading={holdersLoading} />
            </div>
            <div className={styles.holdersChart}>
              <div className={styles.chartHeader}>
                <h4 className={styles.chartTitle}>{tr("token.insightTabs.distributionTitle")}</h4>
                <p className={styles.chartDescription}>
                  {tr("token.insightTabs.distributionDescription", { symbol: meta?.symbol ?? "" })}
                </p>
              </div>
              {distLoading ? (
                <div className={styles.chartPlaceholder} />
              ) : distribution ? (
                <div className={styles.chartBody}>
                  <ReactECharts option={buildDonutOption(distribution, donutLabels, isDark)} style={{ height: "100%", width: "100%" }} notMerge />
                </div>
              ) : (
                <div className={styles.noData}>—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tokenomics tab — only if hasTokenomics */}
      {activeTab === 2 && hasTokenomics && (
        <div className={styles.tabContent} key="tokenomics">
          {allocation.length > 0 && (
            <TokenAllocation symbol={meta.symbol} name={meta.name} distribution={allocation} />
          )}
          {releaseSchedule.length > 0 && (
            <TokenUnlockSchedule symbol={meta.symbol} schedule={releaseSchedule} />
          )}
        </div>
      )}

      {/* Investors tab — only if hasInvestors */}
      {activeTab === 3 && hasInvestors && (
        <div className={styles.tabContent} key="investors">
          <TokenInvestors symbol={meta.symbol} investors={investors} />
        </div>
      )}
    </div>
  );
}


