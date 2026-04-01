import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { FilterSwitch } from "@/components/FilterSwitch";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type { InferResponseType } from "hono/client";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./TokenInsightTabs.module.scss";
import { TopHoldersTable } from "./TopHoldersTable";

// ─── Types ──────────────────────────────────────────────────────────────────

type TopHoldersData = InferResponseType<
  (typeof client.api.tokens.holders)[":address"]["$get"],
  200
>;

type HoldersInfo =
  | InferResponseType<
    (typeof client.api.tokens.holders.stats)[":addresses"]["$get"],
    200
  >[number]
  | null;

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
  "11_20"?: string;
  "21_40"?: string;
  "11_30"?: string;
  "31_50"?: string;
  rest: string;
}

interface TokenInsightTabsProps {
  address: string;
  meta: MetaData;
  market: MarketData | null;
  holders: TopHoldersData;
  holdersInfo?: HoldersInfo | null;
  holdersLoading?: boolean;
}

// ─── Format Helpers ────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

const DONUT_COLORS = ["#1665C0", "#3D8DF5", "#7BB8F5", "#C4DFF9"];

function buildDonutOption(
  distribution: DistributionData,
  labels: { top10: string; mid1: string; mid2: string; others: string },
  isDark: boolean,
): EChartsOption {
  const isSolana = "11_20" in distribution;
  const mid1Key = isSolana ? "11_20" : "11_30";
  const mid2Key = isSolana ? "21_40" : "31_50";

  const entries = [
    {
      name: labels.top10,
      value: parseFloat(distribution.top_10 ?? "0"),
    },
    {
      name: labels.mid1,
      value: parseFloat(
        ((distribution as unknown) as Record<string, string>)[mid1Key] ?? "0",
      ),
    },
    {
      name: labels.mid2,
      value: parseFloat(
        ((distribution as unknown) as Record<string, string>)[mid2Key] ?? "0",
      ),
    },
    {
      name: labels.others,
      value: parseFloat(distribution.rest ?? "0"),
    },
  ].filter((e) => e.value > 0);

  return {
    tooltip: {
      trigger: "item",
      backgroundColor: "#1e1e2e",
      borderColor: "#3a3a5c",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: "#e0e0e0", fontSize: 13 },
      formatter: (params: any) => {
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
        const entry = entries.find((e) => e.name === name);
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
          itemStyle: {
            shadowBlur: 12,
            shadowColor: "rgba(0,0,0,0.4)",
          },
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
  // Highlight $-prefixed USD values, +/-% changes, and Vietnamese đồng amounts
  const regex = /(\.?\$[\d,.]+[KMBT]?|[+-][\d.]+%|[\d,.]+(?:\s+(?:nghìn tỷ|tỷ|triệu|nghìn))?\s+đồng)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
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

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
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
  address,
  meta,
  market,
  holders,
  holdersInfo,
  holdersLoading = false,
}: TokenInsightTabsProps) {
  const { tr, fmt } = useLocalization();
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const fmtCurrency = (v: number | null | undefined) => fmt.num.readableCompact.currency(v ?? null);
  const fmtSupply = (v: number | null | undefined, symbol: string): string => {
    if (v == null || isNaN(v)) return "—";
    const count = v >= 1e9
      ? Math.round(v / 1e9)
      : v >= 1e6
        ? Math.round(v / 1e6)
        : v >= 1e3
          ? Math.round(v / 1e3)
          : null;
    if (v >= 1e9) return tr("token.insightTabs.supplyBillion", { count: count!, symbol });
    if (v >= 1e6) return tr("token.insightTabs.supplyMillion", { count: count!, symbol });
    if (v >= 1e3) return tr("token.insightTabs.supplyThousand", { count: count!, symbol });
    return `${v.toLocaleString()} ${symbol}`;
  };
  const [activeTab, setActiveTab] = useState(0);
  const [distribution, setDistribution] = useState<DistributionData | null>(
    null,
  );
  const [distLoading, setDistLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setDistLoading(true);
    client.api.tokens.holders.stats[":addresses"]
      .$get({ param: { addresses: address } })
      .then(async (res) => {
        if (res.ok) {
          const [stats] = await res.json();
          setDistribution({
            top_10: String(stats.top10Percent),
            rest: String(100 - stats.top10Percent),
          });
        }
      })
      .catch(() => { })
      .finally(() => setDistLoading(false));
  }, [address]);

  // ── About tab ──────────────────────────────
  const name = meta.name;
  const symbol = meta.symbol.toUpperCase();

  const insightCards = market
    ? [
      {
        question: tr("token.insightTabs.volumeQ", { name, symbol }),
        answer: tr("token.insightTabs.volumeA", {
          name,
          symbol,
          volume: fmtCurrency(market.volume24h),
          change: fmtPct(market.priceChangePercentage24h),
        }),
      },
      ...(market.ath != null
        ? [
          {
            question: tr("token.insightTabs.athAtlQ", { name, symbol }),
            answer: tr("token.insightTabs.athAtlA", {
              name,
              symbol,
              ath: fmtCurrency(market.ath),
              atl: fmtCurrency(market.atl),
              athPct: fmtPct(market.athChangePercentage),
              atlPct: fmtPct(market.atlChangePercentage),
            }),
          },
        ]
        : []),
      ...(market.marketCap != null
        ? [
          {
            question: tr("token.insightTabs.marketCapQ", { name, symbol }),
            answer: tr("token.insightTabs.marketCapA", {
              name,
              symbol,
              marketCap: fmtCurrency(market.marketCap),
              rank: String(market.marketCapRank ?? "—"),
              supply: fmtSupply(market.circulatingSupply, symbol),
            }),
          },
        ]
        : []),
      ...(market.fullyDilutedValuation != null
        ? [
          {
            question: tr("token.insightTabs.fdvQ", { name, symbol }),
            answer: tr("token.insightTabs.fdvA", {
              name,
              symbol,
              fdv: fmtCurrency(market.fullyDilutedValuation),
              maxSupply: fmtSupply(
                market.maxSupply ?? market.totalSupply,
                symbol,
              ),
            }),
          },
        ]
        : []),
    ]
    : [];

  // ── Donut labels ────────────────────────────
  const isSolana = !address.startsWith("0x");
  const donutLabels = {
    top10: tr("token.insightTabs.top10"),
    mid1: isSolana
      ? tr("token.insightTabs.rank1120")
      : tr("token.insightTabs.rank1130"),
    mid2: isSolana
      ? tr("token.insightTabs.rank2140")
      : tr("token.insightTabs.rank3150"),
    others: tr("token.insightTabs.others"),
  };

  return (
    <div className={styles.container}>
      <div>
        <FilterSwitch
          options={[
            { value: "0", label: tr("token.insightTabs.about") || "Stats" },
            { value: "1", label: tr("token.insightTabs.holders") || "Holders" }
          ]}
          value={activeTab.toString()}
          onChange={(v) => setActiveTab(parseInt(v, 10))}
          tooltipLabel="Insights"
        />
      </div>

      {activeTab === 0 && (
        <div className={styles.tabContent} key="about">
          {insightCards.length > 0 && (
            <div className={styles.insightGrid}>
              {insightCards.map((card, i) => (
                <InsightCard key={i} {...card} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 1 && (
        <div className={styles.tabContent} key="holders">
          <div className={styles.holdersLayout}>
            <div className={styles.holdersTable}>
              <TopHoldersTable holders={holders} loading={holdersLoading} />
            </div>
            <div className={styles.holdersChart}>
              <div className={styles.chartHeader}>
                <h4 className={styles.chartTitle}>
                  {tr("token.insightTabs.distributionTitle")}
                </h4>
                <p className={styles.chartDescription}>
                  {tr("token.insightTabs.distributionDescription", { symbol: meta?.symbol ?? "" })}
                </p>
              </div>
              {distLoading ? (
                <div className={styles.chartPlaceholder} />
              ) : distribution ? (
                <div className={styles.chartBody}>
                  <ReactECharts
                    option={buildDonutOption(distribution, donutLabels, isDark)}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                </div>
              ) : (
                <div className={styles.noData}>—</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
