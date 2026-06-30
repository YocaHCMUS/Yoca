import client from "@/api/main";
import { GeckoTerminalChart } from "@/components/charts/GeckoTerminalChart";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTokenChartNewsEvents,
  TokenChartNewsEventsApiError,
} from "@/services/tokenChartNewsEvents";
import type {
  TokenChartNewsEvent,
  TokenChartNewsEventsData,
  TokenChartNewsTimeframe,
} from "@/types/chartNewsEvents";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type { InferResponseType } from "hono/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./TokenOverviewChart.module.scss";

type ChartMode = "price" | "marketcap" | "candle";
type LineMode = "price" | "marketcap";
type TimeRange = { label: string; days: number };

type ChartPoint = InferResponseType<
  (typeof client.api.tokens.markets.chart)[":address"]["$get"],
  200
>[number];

interface TokenOverviewChartProps {
  address: string;
  symbol: string;
  name: string;
  onPriceChangeUpdate?: (data: {
    percentage: number | null;
    label: string;
  }) => void;
}

function getNewsTimeframe(days: number): TokenChartNewsTimeframe {
  if (days === 1) return "24h";
  if (days === 7) return "7d";
  if (days === 30) return "1m";
  if (days === 90) return "3m";
  return "1y";
}

function getClosestChartPoint(
  points: [number, number][],
  targetTimestamp: number,
) {
  if (points.length === 0) return null;

  let closest = points[0];
  let closestDistance = Math.abs(points[0][0] - targetTimestamp);

  for (let i = 1; i < points.length; i += 1) {
    const distance = Math.abs(points[i][0] - targetTimestamp);
    if (distance < closestDistance) {
      closest = points[i];
      closestDistance = distance;
    }
  }

  return closest;
}

export function TokenOverviewChart({
  address,
  symbol,
  name,
  onPriceChangeUpdate,
}: TokenOverviewChartProps) {
  const { tr, fmt, lang } = useLocalization();
  const { openAuthModal } = useAuth();
  const dateLocale = lang === "vi" ? "vi-VN" : "en-US";
  const TIME_RANGES: TimeRange[] = useMemo(
    () => [
      { label: tr("wallet.filter24h"), days: 1 },
      { label: tr("wallet.filter7d"), days: 7 },
      { label: tr("wallet.filter30d"), days: 30 },
      { label: tr("wallet.filter90d"), days: 90 },
      { label: tr("wallet.filter365d"), days: 365 },
    ],
    [tr],
  );

  const [mode, setMode] = useState<ChartMode>("price");
  const [lineMode, setLineMode] = useState<LineMode>("price");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [range, setRange] = useState<TimeRange>(TIME_RANGES[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isDropdownOpen]);

  // Sync lineMode -> mode when in line modes
  const handleLineModeSelect = (v: LineMode) => {
    setLineMode(v);
    setMode(v);
    setIsDropdownOpen(false);
  };

  // ── Candle chart: fetch top pool for this token ──
  const topPools = useGet(
    client.api.tokens[":address"].pools,
    200,
    { param: { address } },
    { enabled: mode === "candle" },
  );
  const topPoolAddress = useMemo(() => {
    if (!topPools.data || topPools.data.length === 0) return null;
    // Pick the pool with highest liquidity
    const sorted = [...topPools.data].sort(
      (a, b) => (b.data.liquidityUsd ?? 0) - (a.data.liquidityUsd ?? 0),
    );
    return sorted[0]?.data?.poolAddress ?? null;
  }, [topPools.data]);
  const [prices, setPrices] = useState<[number, number][]>([]);
  const [marketCaps, setMarketCaps] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [newsEvents, setNewsEvents] = useState<TokenChartNewsEvent[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [selectedNewsEvent, setSelectedNewsEvent] =
    useState<TokenChartNewsEvent | null>(null);
  const [newsSummaryLoading, setNewsSummaryLoading] = useState(false);
  const [newsSummaryError, setNewsSummaryError] = useState<string | null>(null);
  const [newsSummaryUsage, setNewsSummaryUsage] =
    useState<TokenChartNewsEventsData["usage"] | null>(null);
  const [newsSummaryUpgradePath, setNewsSummaryUpgradePath] =
    useState<string | null>(null);
  const chartRef = useRef<ReactECharts>(null);
  const newsTimeframe = useMemo(() => getNewsTimeframe(range.days), [range]);

  useEffect(() => {
    const fetchData = async () => {
      if (!address) return;
      // Clear old data immediately so old range % doesn't persist while loading new range
      setPrices([]);
      setMarketCaps([]);
      setLoading(true);
      try {
        const response =
          range.days === 1
            ? await client.api.tokens.markets.chart[":address"].$get({
                param: { address },
              })
            : range.days <= 90
              ? await client.api.tokens.markets.chart[":address"].hourly.$get({
                  param: { address },
                  query: { days: range.days.toString() },
                })
              : await client.api.tokens.markets.chart[":address"].daily.$get({
                  param: { address },
                  query: { days: range.days.toString() },
                });

        if (response.status === 200) {
          const data: ChartPoint[] = await response.json();
          const pricesData: [number, number][] = [];
          const marketCapsData: [number, number][] = [];

          data.forEach((point) => {
            pricesData.push([point.unixTimestampMs, point.price]);
            marketCapsData.push([point.unixTimestampMs, point.marketCap]);
          });

          setPrices(pricesData);
          setMarketCaps(marketCapsData);
        } else {
          setPrices([]);
          setMarketCaps([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [address, range]);

  useEffect(() => {
    const fetchNewsEvents = async () => {
      if (!address || !symbol || !name) {
        setNewsEvents([]);
        setSelectedNewsEvent(null);
        return;
      }

      setNewsLoading(true);
      setNewsError(null);
      setSelectedNewsEvent(null);

      try {
        const data = await getTokenChartNewsEvents({
          address,
          symbol,
          name,
          timeframe: newsTimeframe,
          includeSummary: false,
        });
        setNewsEvents(data.events);
      } catch (err) {
        console.error("[TokenOverviewChart] failed to load news markers", err);
        setNewsEvents([]);
        setNewsError("Unable to load news markers.");
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNewsEvents();
  }, [address, symbol, name, newsTimeframe]);

  const seriesData = mode === "price" ? prices : marketCaps;

  const newsMarkerData = useMemo(() => {
    if (seriesData.length === 0 || newsEvents.length === 0) return [];

    return newsEvents
      .map((event) => {
        const timestamp = Date.parse(event.timestamp);
        if (Number.isNaN(timestamp)) return null;

        const closestPoint = getClosestChartPoint(seriesData, timestamp);
        if (!closestPoint) return null;

        return {
          value: [closestPoint[0], closestPoint[1]],
          event,
        };
      })
      .filter(Boolean);
  }, [seriesData, newsEvents]);

  const formatEventDate = useCallback(
    (timestamp: string) => {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return timestamp;

      return date.toLocaleDateString(dateLocale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    },
    [dateLocale],
  );

  const formatArticleDate = useCallback(
    (timestamp: string | null) => {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return "";

      return date.toLocaleString(dateLocale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [dateLocale],
  );

  const handleChartClick = useCallback(
    async (params: any) => {
      if (params?.seriesName !== "News markers") return;

      const event = params?.data?.event as TokenChartNewsEvent | undefined;
      if (!event) return;

      setSelectedNewsEvent(event);
      if (event.summary || newsSummaryLoading) return;

      setNewsSummaryLoading(true);
      setNewsSummaryError(null);
      setNewsSummaryUpgradePath(null);
      try {
        const data = await getTokenChartNewsEvents({
          address,
          symbol,
          name,
          timeframe: newsTimeframe,
          includeSummary: true,
          date: event.date,
        });
        const summarizedEvent =
          data.events.find((item) => item.date === event.date) ?? event;
        setNewsEvents((currentEvents) =>
          currentEvents.map((item) =>
            item.date === summarizedEvent.date ? summarizedEvent : item,
          ),
        );
        setSelectedNewsEvent(summarizedEvent);
        setNewsSummaryUsage(data.usage ?? null);
      } catch (err) {
        if (err instanceof TokenChartNewsEventsApiError) {
          if (err.status === 401) openAuthModal("login");
          if (
            err.errorCode === "AI_DAILY_LIMIT_EXCEEDED" ||
            err.errorCode === "AI_FEATURE_LOCKED"
          ) {
            setNewsSummaryUpgradePath(err.upgradePath ?? "/pricing");
          }
          setNewsSummaryError(err.message);
        } else {
          setNewsSummaryError("Unable to generate news summary right now.");
        }
        console.error("[TokenOverviewChart] failed to load marker summary", err);
      } finally {
        setNewsSummaryLoading(false);
      }
    },
    [address, symbol, name, newsTimeframe, newsSummaryLoading, openAuthModal],
  );

  const chartEvents = useMemo(
    () => ({
      click: handleChartClick,
    }),
    [handleChartClick],
  );

  const isPositive = useMemo(() => {
    if (seriesData.length < 2) return true;
    return seriesData[seriesData.length - 1][1] >= seriesData[0][1];
  }, [seriesData]);

  useEffect(() => {
    if (!onPriceChangeUpdate) return;
    if (prices.length < 2) {
      onPriceChangeUpdate({ percentage: null, label: range.label });
      return;
    }
    const startPrice = prices[0][1];
    const endPrice = prices[prices.length - 1][1];
    let percentage = null;
    if (startPrice > 0) {
      percentage = ((endPrice - startPrice) / startPrice) * 100;
    }
    onPriceChangeUpdate({ percentage, label: range.label });
  }, [prices, range.label, onPriceChangeUpdate]);

  const color = isPositive ? "#16a34a" : "#dc2626";
  const areaColor = isPositive
    ? ["rgba(22,163,74,0.25)", "rgba(22,163,74,0.02)"]
    : ["rgba(220,38,38,0.25)", "rgba(220,38,38,0.02)"];

  const option: EChartsOption = useMemo(() => {
    if (seriesData.length === 0) return {};

    const isShortRange = range.days === 1 || range.days === 7;

    return {
      animation: false,
      grid: { left: 20, right: 20, top: 20, bottom: 28, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderColor: "transparent",
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || !params[0]) return "";
          const [ts, val] = params[0].data as [number, number];
          const d = new Date(ts);
          const dateStr = isShortRange
            ? d.toLocaleString(dateLocale, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : d.toLocaleDateString(dateLocale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
          return `<div style="padding:6px 10px">
                        <div style="color:#aaa;margin-bottom:3px;font-size:12px">${dateStr}</div>
                        <div style="font-size:16px;font-weight:700">${fmt.num.compact.currency(val)}</div>
                    </div>`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#888",
          fontSize: 12,
          formatter: (val: number) => {
            const d = new Date(val);
            if (range.days === 1)
              return d.toLocaleTimeString(dateLocale, {
                hour: "2-digit",
                minute: "2-digit",
              });
            return d.toLocaleDateString(dateLocale, {
              month: "short",
              day: "numeric",
            });
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#888",
          fontSize: 12,
          formatter: (val: number) => fmt.num.compact.currency(val),
        },
        splitLine: {
          lineStyle: { color: "rgba(255,255,255,0.06)", type: "dashed" },
        },
      },
      series: [
        {
          name: mode === "price" ? "Price" : "Market cap",
          type: "line",
          data: seriesData,
          smooth: false,
          symbol: "none",
          lineStyle: { width: 1.5, color },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: areaColor[0] },
                { offset: 1, color: areaColor[1] },
              ],
            },
          },
        },
        {
          name: "News markers",
          type: "scatter",
          data: newsMarkerData,
          symbol: "pin",
          symbolSize: 34,
          z: 12,
          itemStyle: {
            color: "#f1c21b",
            borderColor: "#111",
            borderWidth: 1,
          },
          label: {
            show: true,
            formatter: (params: any) =>
              String(params?.data?.event?.articleCount ?? ""),
            color: "#111",
            fontSize: 10,
            fontWeight: 700,
          },
          tooltip: {
            formatter: (params: any) => {
              const event = params?.data?.event as
                | TokenChartNewsEvent
                | undefined;
              if (!event) return "";
              return `<div style="padding:6px 10px">
                        <div style="color:#aaa;margin-bottom:3px;font-size:12px">${formatEventDate(event.timestamp)}</div>
                        <div style="font-size:13px;font-weight:700">${event.articleCount} related news article${event.articleCount === 1 ? "" : "s"}</div>
                        <div style="color:#aaa;margin-top:3px;font-size:11px">Click to view articles</div>
                    </div>`;
            },
          },
        },
      ],
    };
  }, [
    seriesData,
    newsMarkerData,
    color,
    areaColor,
    range,
    mode,
    fmt,
    dateLocale,
    formatEventDate,
  ]);

  return (
    <div className={styles.container}>
      {/* Toolbar: CoinGecko-style */}
      <div className={styles.toolbar}>
        {/* LEFT: Metric dropdown + time range */}
        <div className={styles.toolbarLeft}>
          {/* Price / MarketCap dropdown — only when in line mode */}
          <div className={styles.dropdownWrap} ref={dropdownRef}>
            <button
              className={`${styles.metricBtn} ${mode !== "candle" ? styles.metricBtnActive : ""}`}
              onClick={() => {
                if (mode === "candle") {
                  // Switch back to line mode with last selected lineMode
                  setMode(lineMode);
                } else {
                  setIsDropdownOpen((v) => !v);
                }
              }}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <span>
                {mode === "candle"
                  ? tr("token.overviewChart.price")
                  : mode === "price"
                    ? tr("token.overviewChart.price")
                    : tr("token.overviewChart.marketCap")}
              </span>
              <svg
                className={`${styles.chevron} ${isDropdownOpen && mode !== "candle" ? styles.chevronUp : ""}`}
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                aria-hidden="true"
              >
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {isDropdownOpen && mode !== "candle" && (
              <div className={styles.dropdown} role="listbox">
                <button
                  className={`${styles.dropdownItem} ${lineMode === "price" ? styles.dropdownItemActive : ""}`}
                  role="option"
                  aria-selected={lineMode === "price"}
                  onClick={() => handleLineModeSelect("price")}
                >
                  {tr("token.overviewChart.price")}
                  {lineMode === "price" && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2.5 7L5.5 10L11.5 4" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                <button
                  className={`${styles.dropdownItem} ${lineMode === "marketcap" ? styles.dropdownItemActive : ""}`}
                  role="option"
                  aria-selected={lineMode === "marketcap"}
                  onClick={() => handleLineModeSelect("marketcap")}
                >
                  {tr("token.overviewChart.marketCap")}
                  {lineMode === "marketcap" && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2.5 7L5.5 10L11.5 4" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Time range + Chart type icon buttons */}
        <div className={styles.toolbarRight}>
          {/* Time range buttons — hidden for candle mode */}
          {mode !== "candle" && (
            <div className={styles.rangeButtons}>
              {TIME_RANGES.map((r) => (
                <button
                  key={r.label}
                  className={`${styles.rangeBtn} ${range.label === r.label ? styles.active : ""}`}
                  onClick={() => setRange(r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* Chart type icon buttons */}
          <div className={styles.chartTypeButtons}>
          {/* Line chart icon */}
          <button
            className={`${styles.chartTypeBtn} ${mode !== "candle" ? styles.chartTypeBtnActive : ""}`}
            onClick={() => { setMode(lineMode); setIsDropdownOpen(false); }}
            title={tr("token.overviewChart.price")}
            aria-pressed={mode !== "candle"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <polyline points="2,14 6,8 10,11 16,4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>

          {/* Candlestick icon */}
          <button
            className={`${styles.chartTypeBtn} ${mode === "candle" ? styles.chartTypeBtnActive : ""}`}
            onClick={() => { setMode("candle"); setIsDropdownOpen(false); }}
            title={tr("token.overviewChart.candle")}
            aria-pressed={mode === "candle"}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {/* Candle 1 - bullish */}
              <line x1="5" y1="2" x2="5" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <rect x="3.5" y="5" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.9"/>
              <line x1="5" y1="10" x2="5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              {/* Candle 2 - bearish */}
              <line x1="10" y1="3" x2="10" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <rect x="8.5" y="6" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.5"/>
              <line x1="10" y1="12" x2="10" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              {/* Candle 3 - bullish */}
              <line x1="15" y1="4" x2="15" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <rect x="13.5" y="7" width="3" height="4" rx="0.5" fill="currentColor" opacity="0.9"/>
              <line x1="15" y1="11" x2="15" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      </div>
      {/* End Toolbar */}

      {/* Chart */}
      <div className={mode === "candle" ? styles.candleWrapper : styles.chartWrapper}>
        {mode === "candle" ? (
          topPools.isLoading ? (
            <div className={styles.loading}>{tr("common.loading")}</div>
          ) : !topPoolAddress ? (
            <div className={styles.empty}>
              {tr("token.overviewChart.noCandlePool")}
            </div>
          ) : (
            <GeckoTerminalChart poolAddress={topPoolAddress} height="560" />
          )
        ) : loading && seriesData.length === 0 ? (
          <div className={styles.loading}>{tr("common.loading")}</div>
        ) : seriesData.length === 0 ? (
          <div className={styles.empty}>
            {tr("token.overviewChart.noData")}
            {!address ? "" : ` - ${tr("token.overviewChart.noCoingeckoId")}`}
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={option}
            notMerge
            onEvents={chartEvents}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
            showLoading={loading}
            loadingOption={{ color, maskColor: "rgba(0,0,0,0.4)" }}
          />
        )}

        {selectedNewsEvent && (
          <div className={styles.newsPopup}>
            <div className={styles.newsPopupHeader}>
              <div>
                <div className={styles.newsPopupEyebrow}>News marker</div>
                <div className={styles.newsPopupTitle}>
                  {formatEventDate(selectedNewsEvent.timestamp)}
                </div>
              </div>
              <button
                type="button"
                className={styles.newsPopupClose}
                onClick={() => setSelectedNewsEvent(null)}
                aria-label="Close news marker"
              >
                x
              </button>
            </div>

            <div className={styles.newsPopupMeta}>
              {selectedNewsEvent.articleCount} article
              {selectedNewsEvent.articleCount === 1 ? "" : "s"} on this date
            </div>

            <div className={styles.newsSummary}>
              {newsSummaryLoading && !selectedNewsEvent.summary ? (
                <div className={styles.newsSummaryLoading}>
                  Loading summary...
                </div>
              ) : newsSummaryError ? (
                <div className={styles.newsSummaryLoading}>
                  {newsSummaryError}
                  {newsSummaryUpgradePath && (
                    <>
                      {" "}
                      <a href={newsSummaryUpgradePath}>Upgrade plan</a>
                    </>
                  )}
                </div>
              ) : selectedNewsEvent.summary ? (
                <>
                  <div className={styles.newsSummaryTitle}>
                    {selectedNewsEvent.summary.headline}
                  </div>
                  <ul className={styles.newsSummaryBullets}>
                    {selectedNewsEvent.summary.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  {selectedNewsEvent.summary.provider && (
                    <div className={styles.newsSummaryProvider}>
                      Summary: {selectedNewsEvent.summary.provider}
                    </div>
                  )}
                  {newsSummaryUsage && !newsSummaryUsage.disabled && (
                    <div className={styles.newsSummaryProvider}>
                      {newsSummaryUsage.remaining}/{newsSummaryUsage.limit} summaries left today
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.newsSummaryLoading}>
                  Summary unavailable.
                </div>
              )}
            </div>

            <div className={styles.newsArticleList}>
              {selectedNewsEvent.articles.map((article) => (
                <a
                  key={article.url}
                  className={styles.newsArticle}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className={styles.newsArticleThumbnail}>
                    {article.imageUrl || article.favicon ? (
                      <img
                        src={article.imageUrl || article.favicon || undefined}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span aria-hidden="true">
                        {article.source.trim().slice(0, 1).toUpperCase() ||
                          "N"}
                      </span>
                    )}
                  </div>
                  <div className={styles.newsArticleContent}>
                    <div className={styles.newsArticleTitle}>
                      {article.title}
                    </div>
                    <div className={styles.newsArticleMeta}>
                      {article.source}
                      {article.publishedAt
                        ? ` | ${formatArticleDate(article.publishedAt)}`
                        : ""}
                    </div>
                    {article.description && (
                      <div className={styles.newsArticleDescription}>
                        {article.description}
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

        {!loading && seriesData.length > 0 && (
        <div className={styles.newsMarkerStatus}>
          {newsLoading
            ? "Loading news markers..."
            : newsError
              ? newsError
              : newsEvents.length === 0
                ? "No news markers for this timeframe."
                : `${newsEvents.length} news marker${newsEvents.length === 1 ? "" : "s"} detected in this timeframe.`}
        </div>
      )}
    </div>
  );
}
