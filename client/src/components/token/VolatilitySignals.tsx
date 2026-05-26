import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Launch,
  Renew,
} from "@carbon/icons-react";
import { Button, Select, SelectItem, SkeletonText } from "@carbon/react";
import { getTokenVolatilityNews } from "@/services/tokenVolatility";
import type {
  RelatedNewsArticle,
  VolatilityEvent,
  VolatilityTimeframe,
} from "@/types/volatility";
import styles from "./VolatilitySignals.module.scss";

interface VolatilitySignalsProps {
  address: string;
  symbol: string;
  name: string;
}

interface VolatilitySignalsState {
  events: VolatilityEvent[];
  dataPointsAnalyzed: number;
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
  if (value === 0) return "$0";

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
  return type === "price_spike" ? "Price spike" : "Price drop";
}

function getInitialState(): VolatilitySignalsState {
  return {
    events: [],
    dataPointsAnalyzed: 0,
    isLoading: false,
    error: null,
    hasLoaded: false,
  };
}

function RelatedNewsList({ articles }: { articles: RelatedNewsArticle[] }) {
  if (articles.length === 0) {
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
              {article.publishedAt ? ` · ${formatDateTime(article.publishedAt)}` : ""}
              {" · "}
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

export function VolatilitySignals({
  address,
  symbol,
  name,
}: VolatilitySignalsProps) {
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

  const fetchSignals = useCallback(async () => {
    if (!address || !symbol || !name) return;

    setState((prev) => ({
      ...prev,
      events: [],
      isLoading: true,
      error: null,
      hasLoaded: prev.hasLoaded,
    }));
    setExpandedEvents(new Set());

    try {
      const data = await getTokenVolatilityNews({
        address,
        symbol,
        name,
        threshold,
        timeframe,
        window: "auto",
        maxEventsWithNews: MAX_EVENTS_WITH_NEWS,
      });
      const nextEvents = data.events.slice(0, MAX_EVENTS_RENDERED);

      setState({
        events: nextEvents,
        dataPointsAnalyzed: data.dataPointsAnalyzed,
        isLoading: false,
        error: null,
        hasLoaded: true,
      });
      setExpandedEvents(new Set(nextEvents[0] ? [nextEvents[0].id] : []));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to load volatility signals right now.",
        hasLoaded: true,
      }));
    }
  }, [address, symbol, name, threshold, timeframe]);

  useEffect(() => {
    void fetchSignals();
  }, [fetchSignals]);

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
        </div>

        <div className={styles.controls}>
          <Select
            hideLabel
            id="volatility-threshold-select"
            value={String(threshold)}
            onChange={(event) => setThreshold(Number(event.target.value))}
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
            onChange={(event) =>
              setTimeframe(event.target.value as VolatilityTimeframe)
            }
            disabled={state.isLoading}
          >
            <SelectItem value="24h" text="24h" />
            <SelectItem value="daily" text="Daily" />
          </Select>

          <Button
            kind="tertiary"
            size="sm"
            onClick={() => void fetchSignals()}
            disabled={state.isLoading}
            iconDescription="Refresh volatility signals"
            hasIconOnly
          >
            <Renew />
          </Button>
        </div>
      </div>

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
        visibleEvents.length === 0 && (
          <div className={styles.empty}>
            No significant volatility signals found for this token.
          </div>
        )}

      {!state.isLoading && !state.error && visibleEvents.length > 0 && (
        <div className={styles.eventsList}>
          {visibleEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);

            return (
              <article key={event.id} className={styles.eventCard}>
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
                        {formatDateTime(event.timestamp)} · window: {event.window}
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
