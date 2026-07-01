import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    Launch,
    Renew,
} from "@carbon/icons-react";
import { Button, Select, SelectItem, SkeletonText } from "@carbon/react";
import {
    getTokenVolatilityNews,
    TokenVolatilityError,
} from "@/services/tokenVolatility";
import { useAuth } from "@/contexts/AuthContext";
import type {
    RelatedNewsArticle,
    VolatilityAiUsage,
    VolatilityEvent,
    VolatilitySummary,
    VolatilityTimeframe,
} from "@/types/volatility";
import { Link } from "react-router";
import styles from "./VolatilitySignals.module.scss";

interface VolatilitySignalsProps {
  address: string;
  symbol: string;
  name: string;
}

interface VolatilitySignalsState {
  events: VolatilityEvent[];
  dataPointsAnalyzed: number;
  cache: {
    hit: boolean;
    expiresAt: string;
  } | null;
  summary: VolatilitySummary | null;
  isSummaryLoading: boolean;
  summaryError: string | null;
  summaryRequested: boolean;
  usage: VolatilityAiUsage | null;
  counted: boolean;
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
}

const THRESHOLD_OPTIONS = [5, 10, 20, 50, 100];
const MAX_EVENTS_RENDERED = 5;
const MAX_EVENTS_WITH_NEWS = 3;

function formatChangePercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Date unavailable";

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value == 0) return "$0";

  const absValue = Math.abs(value);
  if (absValue < 0.0001) return `$${value.toExponential(2)}`;
  if (absValue < 1) {
    return `$${value.toLocaleString(undefined, {
      maximumSignificantDigits: 4,
    })}`;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: absValue >= 100 ? 2 : 4,
  }).format(value);
}

function formatTimeDistance(hours: number | null) {
  if (hours == null) return "time unavailable";
  if (hours < 1) return `${Math.round(hours * 60)}m from signal`;
  if (hours < 48) return `${Number(hours.toFixed(hours < 10 ? 1 : 0))}h from signal`;

  return `${Number((hours / 24).toFixed(1))}d from signal`;
}

function getEventTypeLabel(type: VolatilityEvent["type"]) {
  return type == "price_spike" ? "Price spike" : "Price drop";
}

function getInitialState(): VolatilitySignalsState {
  return {
    events: [],
    dataPointsAnalyzed: 0,
    cache: null,
    summary: null,
    isSummaryLoading: false,
    summaryError: null,
    summaryRequested: false,
    usage: null,
    counted: false,
    isLoading: false,
    error: null,
    hasLoaded: false,
  };
}

function RelatedNewsList({ articles }: { articles: RelatedNewsArticle[] }) {
  if (articles.length == 0) {
    return (
      <p className={styles.noRelatedNews}>
        No related news found near this event.
      </p>
    );
  }

  return (
    <div className={styles.relatedNews}>
      <div className={styles.relatedNewsLabel}>Possible related news</div>
      {articles.map((article) => (
        <a
          key={article.url}
          className={styles.relatedNewsItem}
          href={article.url}
          target="_blank"
          rel="noreferrer"
        >
          <div className={styles.relatedNewsMain}>
            <span className={styles.relatedNewsTitle}>{article.title}</span>
            <span className={styles.relatedNewsMeta}>
              {article.source}
              {article.publishedAt ? ` | ${formatDateTime(article.publishedAt)}` : ""}
              {" | "}
              {formatTimeDistance(article.timeDistanceHours)}
            </span>
          </div>
          <span
            className={`${styles.confidenceBadge} ${styles[article.confidence]}`}
          >
            {article.confidence}
          </span>
          <Launch className={styles.linkIcon} size={14} />
        </a>
      ))}
    </div>
  );
}

function SignalSummary({ summary }: { summary: VolatilitySummary }) {
  return (
    <div className={styles.summaryBox}>
      <div className={styles.summaryLabel}>Signal summary</div>
      <p className={styles.summaryHeadline}>{summary.headline}</p>
      <ul className={styles.summaryBullets}>
        {summary.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <p className={styles.summaryRiskNote}>{summary.riskNote}</p>
      {summary.provider && (
        <div className={styles.summaryProvider}>{summary.provider}</div>
      )}
    </div>
  );
}

export function VolatilitySignals({
  address,
  symbol,
  name,
}: VolatilitySignalsProps) {
  const { user, openAuthModal } = useAuth();
  const [threshold, setThreshold] = useState(20);
  const [timeframe, setTimeframe] = useState<VolatilityTimeframe>("daily");
  const [state, setState] = useState<VolatilitySignalsState>(getInitialState);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleEvents = useMemo(
    () => state.events.slice(0, MAX_EVENTS_RENDERED),
    [state.events],
  );

  const fetchSignals = useCallback(async (
    forceRefresh = false,
    includeSummary = false,
  ) => {
    if (!address || !symbol || !name) return;
    if (includeSummary && !user) {
      openAuthModal("login");
      return;
    }

    setState((prev) => ({
      ...prev,
      events: [],
      summary: includeSummary ? prev.summary : null,
      isSummaryLoading: false,
      summaryError: null,
      summaryRequested: includeSummary,
      counted: false,
      isLoading: true,
      error: null,
      hasLoaded: prev.hasLoaded,
    }));
    setExpandedEvents(new Set());

    try {
      const resp = await getTokenVolatilityNews({
        address,
        symbol,
        name,
        threshold,
        timeframe,
        window: "auto",
        maxEventsWithNews: MAX_EVENTS_WITH_NEWS,
        forceRefresh,
        includeSummary,
      });
      const data = resp.data; 
      const nextEvents = data.events.slice(0, MAX_EVENTS_RENDERED);

      setState((prev) => ({
        events: nextEvents,
        dataPointsAnalyzed: data.dataPointsAnalyzed,
        cache: data.cache ?? null,
        summary: data.summary ?? null,
        isSummaryLoading: false,
        summaryError: null,
        summaryRequested: includeSummary,
        usage: resp.usage ?? prev.usage,
        counted: resp.counted ?? false,
        isLoading: false,
        error: null,
        hasLoaded: true,
      }));
      setExpandedEvents(new Set(nextEvents[0] ? [nextEvents[0].id] : []));
    } catch (err) {
      if (err instanceof TokenVolatilityError) {
        if (err.usage) {
          setState((prev) => ({ ...prev, usage: err.usage ?? prev.usage }));
        }
        if (err.status === 401) openAuthModal("login");
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isSummaryLoading: false,
        error: includeSummary
          ? null
          : err instanceof Error
            ? err.message
            : "Unable to load volatility signals right now.",
        summaryError: includeSummary
          ? err instanceof Error
            ? err.message
            : "Unable to generate signal summary right now."
          : prev.summaryError,
        hasLoaded: true,
      }));
    }
  }, [
    address,
    symbol,
    name,
    threshold,
    timeframe,
    user,
    openAuthModal,
  ]);

  useEffect(() => {
    void fetchSignals(false, false);
  }, [fetchSignals]);

  const handleThresholdChange = (value: number) => {
    setState((prev) => ({
      ...prev,
      summary: null,
      summaryError: null,
      summaryRequested: false,
    }));
    setThreshold(value);
  };

  const handleTimeframeChange = (value: VolatilityTimeframe) => {
    setState((prev) => ({
      ...prev,
      summary: null,
      summaryError: null,
      summaryRequested: false,
    }));
    setTimeframe(value);
  };

  const handleGenerateSummary = async () => {
    if (!address || !symbol || !name) return;
    if (!user) {
      openAuthModal("login");
      return;
    }

    setState((prev) => ({
      ...prev,
      isSummaryLoading: true,
      summaryError: null,
      summaryRequested: true,
    }));

    try {
      const resp = await getTokenVolatilityNews({
        address,
        symbol,
        name,
        threshold,
        timeframe,
        window: "auto",
        maxEventsWithNews: MAX_EVENTS_WITH_NEWS,
        includeSummary: true,
      });
      const data = resp.data;
      const nextEvents = data.events.slice(0, MAX_EVENTS_RENDERED);

      setState((prev) => ({
        ...prev,
        events: nextEvents,
        dataPointsAnalyzed: data.dataPointsAnalyzed,
        cache: data.cache ?? null,
        summary: data.summary ?? null,
        usage: resp.usage ?? prev.usage,
        counted: resp.counted ?? false,
        isSummaryLoading: false,
        summaryError: null,
        hasLoaded: true,
      }));
      setExpandedEvents((prev) => {
        if (prev.size > 0) return prev;
        return new Set(nextEvents[0] ? [nextEvents[0].id] : []);
      });
    } catch (err) {
      if (err instanceof TokenVolatilityError) {
        if (err.usage) {
          setState((prev) => ({ ...prev, usage: err.usage ?? prev.usage }));
        }
        if (err.status === 401) openAuthModal("login");
      }
      setState((prev) => ({
        ...prev,
        isSummaryLoading: false,
        summaryError:
          err instanceof Error
            ? err.message
            : "Unable to generate signal summary right now.",
      }));
    }
  };
  const summaryQuotaExhausted = state.usage?.disabled
    ? false
    : state.usage?.remaining === 0;

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }

      return next;
    });
  };

  return (
    <section className={styles.panel} aria-label="Volatility signals">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2>Volatility Signals</h2>
          <p>Price moves with possible related news near each event.</p>
          {state.cache && (
            <span className={styles.cacheMeta}>
              {state.cache.hit ? "Cached" : "Updated just now"}
            </span>
          )}
        </div>

        <div className={styles.controls}>
          <Select
            hideLabel
            id="volatility-threshold-select"
            value={String(threshold)}
            onChange={(event) => handleThresholdChange(Number(event.target.value))}
            disabled={state.isLoading}
          >
            {THRESHOLD_OPTIONS.map((value) => (
              <SelectItem key={value} value={String(value)} text={`${value}%`} />
            ))}
          </Select>

          <Select
            hideLabel
            id="volatility-timeframe-select"
            value={timeframe}
            onChange={(event) => {
              const value = event.target.value;
              if (value == "24h" || value == "daily") {
                handleTimeframeChange(value);
              }
            }}
            disabled={state.isLoading}
          >
            <SelectItem value="24h" text="24h" />
            <SelectItem value="daily" text="Daily" />
          </Select>

          <Button
            kind="tertiary"
            size="sm"
            onClick={() => void fetchSignals(true, state.summaryRequested)}
            disabled={state.isLoading}
            iconDescription="Refresh volatility signals"
            hasIconOnly
          >
            <Renew />
          </Button>
        </div>
      </div>

      {!state.isLoading && !state.error && state.hasLoaded && (
        <div className={styles.summaryActions}>
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => void handleGenerateSummary()}
            disabled={state.isSummaryLoading || summaryQuotaExhausted}
          >
            {state.isSummaryLoading
              ? "Generating summary..."
              : user
                ? "Generate signal summary"
                : "Sign in to generate summary"}
          </Button>
          {state.usage && !state.usage.disabled && (
            <span className={styles.summaryUsage}>
              {state.usage.remaining}/{state.usage.limit} summaries remaining
              today
              {!state.counted && state.summary ? " | no usage charged" : ""}
            </span>
          )}
          {state.summaryError && (
            <span className={styles.summaryError}>
              Unable to generate signal summary right now.
            </span>
          )}
        </div>
      )}

      {summaryQuotaExhausted && (
        <div className={styles.quotaNotice}>
          <span>Your summary limit resets at midnight UTC.</span>
          <Link to="/pricing">Upgrade plan</Link>
        </div>
      )}

      {!state.isLoading && !state.error && state.summary && (
        <SignalSummary summary={state.summary} />
      )}

      {state.isLoading && (
        <div className={styles.loading} aria-busy="true" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={styles.loadingEvent}>
              <SkeletonText width="8rem" />
              <SkeletonText heading width="55%" />
              <SkeletonText width="80%" />
            </div>
          ))}
        </div>
      )}

      {!state.isLoading && state.error && (
        <div className={styles.error}>
          Unable to load volatility signals right now.
        </div>
      )}

      {!state.isLoading &&
        !state.error &&
        state.hasLoaded &&
        visibleEvents.length == 0 && (
          <div className={styles.empty}>
            No significant volatility signals found for this token.
          </div>
        )}

      {!state.isLoading && !state.error && visibleEvents.length > 0 && (
        <div className={styles.eventsList}>
          {visibleEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);

            return (
              <article
                key={event.id}
                className={`${styles.eventCard} ${
                  event.type == "price_spike"
                    ? styles.priceSpike
                    : styles.priceDrop
                }`}
              >
                <div className={styles.eventHeader}>
                  <div className={styles.eventSummary}>
                    <span
                      className={`${styles.severityDot} ${styles[event.severity]}`}
                    />
                    <div>
                      <div className={styles.eventTitle}>
                        <span>{getEventTypeLabel(event.type)}</span>
                        <strong>{formatChangePercent(event.changePercent)}</strong>
                      </div>
                      <div className={styles.eventMeta}>
                        {formatDateTime(event.timestamp)} | window: {event.window}
                      </div>
                    </div>
                  </div>

                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={() => toggleEvent(event.id)}
                    iconDescription={
                      isExpanded
                        ? "Collapse volatility signal"
                        : "Expand volatility signal"
                    }
                    hasIconOnly
                  >
                    {isExpanded ? <ChevronDown /> : <ChevronRight />}
                  </Button>
                </div>

                <div className={styles.priceMove}>
                  <span>{formatPrice(event.before)}</span>
                  <span className={styles.arrow}>&rarr;</span>
                  <span>{formatPrice(event.after)}</span>
                </div>

                {isExpanded && (
                  <RelatedNewsList articles={event.relatedNews ?? []} />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
