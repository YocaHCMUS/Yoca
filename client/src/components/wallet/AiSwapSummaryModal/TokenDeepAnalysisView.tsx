import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonPlaceholder, SkeletonText } from "@carbon/react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useCarbonChartBaseOption } from "@/util/carbon-chart-base";
import { createTooltipHeader, createTooltipRow } from "@/util/tooltip-helpers";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  fetchTokenDeepAnalysis,
  WalletAiApiError,
  type TokenDeepAnalysisResponse,
  type WalletAiAnalysisLanguage,
  type WalletAiUsage,
} from "@/services/wallet/walletApi";
import { useAuth } from "@/contexts/AuthContext";
import { TokenPriceChart, type TradeIndicator } from "@/components/charts/TokenPriceChart/TokenPriceChart";
import TrendNumWithSign from "@/components/TrendNumWithSign";
import styles from "./TokenDeepAnalysisView.module.scss";

interface TokenDeepAnalysisViewProps {
  walletAddress: string;
  tokenAddress: string;
  apiLanguage: WalletAiAnalysisLanguage;
  quotaExhausted: boolean;
  onUsageChange: (usage: WalletAiUsage) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function groupTradesByDay(timeline: TokenDeepAnalysisResponse["tradeTimeline"]): Map<number, TradeIndicator[]> {
  const dayMap = new Map<number, TradeIndicator[]>();
  for (const event of timeline) {
    const dayStart = Math.floor(event.timestampMs / DAY_MS) * DAY_MS;
    if (!dayMap.has(dayStart)) {
      dayMap.set(dayStart, []);
    }
    dayMap.get(dayStart)!.push({
      timestampMs: event.timestampMs,
      type: event.type,
      price: event.price,
      amount: event.amount,
      symbol: "",
    });
  }
  return new Map([...dayMap.entries()].sort(([a], [b]) => a - b));
}


const PIE_COLORS = ["#13692a", "#2e7d32", "#66bb6a", "#eb5b5b", "#c21e1e"];

export function TokenDeepAnalysisView({
  walletAddress,
  tokenAddress,
  apiLanguage,
  quotaExhausted,
  onUsageChange,
}: TokenDeepAnalysisViewProps) {
  const { tr, fmt } = useLocalization();
  const { user, isUserLoading, openAuthModal } = useAuth();
  const baseOption = useCarbonChartBaseOption();
  const [data, setData] = useState<TokenDeepAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState(false);

  const fetch = useCallback(async () => {
    if (isUserLoading) return;
    if (!user) {
      openAuthModal("login");
      setError(String(tr("walletPage.aiSwapSummary.signInRequired")));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTokenDeepAnalysis(walletAddress, tokenAddress, apiLanguage);
      setData(result);
      onUsageChange(result.usage);
    } catch (err) {
      if (err instanceof WalletAiApiError) {
        if (err.usage) onUsageChange(err.usage);
        if (err.status === 401) openAuthModal("login");
      }
      setError(err instanceof Error ? err.message : "Failed to load token analysis");
    } finally {
      setLoading(false);
    }
  }, [
    walletAddress,
    tokenAddress,
    apiLanguage,
    user,
    isUserLoading,
    openAuthModal,
    onUsageChange,
    tr,
  ]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const tradeDays = useMemo(() => {
    if (!data) return new Map<number, TradeIndicator[]>();
    return groupTradesByDay(data.tradeTimeline);
  }, [data]);

  const pieOption = useMemo((): EChartsOption | null => {
    if (!data) return null;
    const d = data.pnlDistribution;
    const buckets = [
      { name: tr("walletPage.aiSwapSummary.extremeProfit"), value: d.extremeProfit },
      { name: tr("walletPage.aiSwapSummary.highProfit"), value: d.highProfit },
      { name: tr("walletPage.aiSwapSummary.profit"), value: d.profit },
      { name: tr("walletPage.aiSwapSummary.lowLoss"), value: d.lowLoss },
      { name: tr("walletPage.aiSwapSummary.highLoss"), value: d.highLoss },
    ];

    const totalTradeExits = buckets.reduce((s, b) => s + b.value, 0);

    return {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        trigger: "item" as const,
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number };
          let html = createTooltipHeader(p.name);
          html += createTooltipRow(tr("walletPage.aiSwapSummary.trades"), String(p.value));
          html += createTooltipRow(
            tr("walletPage.aiSwapSummary.pnlDistribution"),
            `${p.percent.toFixed(1)}%`,
          );
          return html;
        },
      },
      legend: {
        show: true,
        orient: "vertical",
        right: 0,
        top: "center",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: baseOption.textStyle.color, fontSize: 11 },
      },
      series: [
        {
          type: "pie",
          radius: ["30%", "65%"],
          center: ["38%", "50%"],
          data: buckets.map((b, i) => ({
            name: b.name,
            value: b.value,
            itemStyle: {
              color: PIE_COLORS[i % PIE_COLORS.length],
              borderColor: "transparent",
              borderWidth: 2,
              borderRadius: 4,
            },
          })),
          label: {
            formatter: (p: unknown) => {
              const pp = p as { name: string; data: { value: number } };
              if (totalTradeExits === 0) return pp.name;
              const pct = (pp.data.value / totalTradeExits * 100).toFixed(1);
              return `${pp.name}\n${pct}%`;
            },
            color: baseOption.textStyle.color,
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };
  }, [data, tr, baseOption]);

  if (loading) {
    return (
      <div className={styles.twoColumnLayout}>
        <div className={styles.leftColumn}>
          <div className={styles.statsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.statCard}>
                <SkeletonText width="80%" />
                <SkeletonPlaceholder style={{ height: 20, width: "50%", margin: "0 auto" }} />
              </div>
            ))}
          </div>
          <div className={styles.analysisSection}>
            <SkeletonText width="30%" />
            <SkeletonText width="100%" />
            <SkeletonText width="100%" />
            <SkeletonText width="75%" />
          </div>
          <div style={{ marginTop: 4 }}>
            <SkeletonText width="25%" />
            <SkeletonText width="90%" />
            <SkeletonText width="85%" />
          </div>
        </div>
        <div className={styles.rightColumn}>
          <SkeletonText width="40%" />
          <SkeletonPlaceholder style={{ height: 200, width: "100%", borderRadius: 8, marginBottom: 12 }} />
          <SkeletonText width="40%" />
          <SkeletonPlaceholder style={{ height: 200, width: "100%", borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{error}</p>
        {quotaExhausted ? (
          <a className={styles.upgradeLink} href="/pricing">
            {tr("walletPage.aiSwapSummary.upgrade")}
          </a>
        ) : (
          <button type="button" className={styles.retryBtn} onClick={() => void fetch()}>
            {tr("walletPage.aiSwapSummary.retry")}
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.twoColumnLayout}>
      {/* ── Left Column: Analysis + Stats ── */}
      <div className={styles.leftColumn}>
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.trades")}</span>
            <span className={styles.statValue}>{data.tradeCount}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.realizedPnl")}</span>
            <span className={styles.statValue}>
              <TrendNumWithSign
                value={data.realizedPnlUsd}
                prefixes="plus-minus"
                formatter={fmt.num.currency}
              />
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.winRate")}</span>
            <span className={styles.statValue}>{data.winningPercentage.toFixed(1)}%</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>{tr("walletPage.aiSwapSummary.volume")}</span>
            <span className={styles.statValue}>
              {fmt.num.compact.currency(data.totalBoughtUsd + data.totalSoldUsd)}
            </span>
          </div>
        </div>

        <div className={styles.analysisSection}>
          <h3 className={styles.sectionTitle}>{tr("walletPage.aiSwapSummary.tokenAnalysis")}</h3>
          <p className={styles.analysisText}>{data.analysis}</p>
        </div>

        {data.riskNotes.length > 0 && (
          <div className={styles.riskSection}>
            <button
              type="button"
              className={styles.riskToggle}
              onClick={() => setExpandedNotes((v) => !v)}
            >
              {tr("walletPage.aiSwapSummary.riskNotes")} ({data.riskNotes.length})
              <span className={styles.riskChevron}>{expandedNotes ? "▼" : "▶"}</span>
            </button>
            {expandedNotes && (
              <ul className={styles.riskList}>
                {data.riskNotes.map((note, i) => (
                  <li key={i} className={styles.riskItem}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {data.cached && (
          <p className={styles.cachedHint}>
            {tr("walletPage.aiSwapSummary.cachedResult")}
          </p>
        )}
        {!data.counted && (
          <p className={styles.cachedHint}>
            {tr("walletPage.aiSwapSummary.notCounted")}
          </p>
        )}
      </div>

      {/* ── Right Column: Charts ── */}
      <div className={styles.rightColumn}>
        <div className={styles.chartsGrid}>
          <div className={styles.echartCard}>
            <h4 className={styles.sectionTitle}>{tr("walletPage.aiSwapSummary.pnlDistribution")}</h4>
            <ReactECharts
              option={pieOption ?? {}}
              style={{ height: 200, width: "100%" }}
              notMerge
              lazyUpdate
              opts={{ renderer: "canvas" }}
            />
          </div>
        </div>

        {tradeDays.size > 0 && (
          <div className={styles.chartSection}>
            <h4 className={styles.sectionTitle}>{tr("walletPage.aiSwapSummary.tradeTimeline")}</h4>
            <div className={styles.timeline}>
              {[...tradeDays.entries()].map(([dayStart, dayTrades]) => (
                <div key={dayStart} className={styles.timelineNode}>
                  <span className={styles.dateLabel}>{fmt.datetime.date(dayStart)}</span>
                  <div className={styles.dotColumn}>
                    <div className={styles.dot} />
                  </div>
                  <div className={styles.nodeContent}>
                    <TokenPriceChart
                      tokenAddress={tokenAddress}
                      tokenSymbol={data.symbol ?? tokenAddress}
                      tokenLogoUri={data.logoUri}
                      dayMs={dayStart}
                      trades={dayTrades}
                      onRemove={() => { }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
