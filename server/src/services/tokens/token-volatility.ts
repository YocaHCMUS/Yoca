import {
  get24hTokenMarketChart,
  getDailyTokenMarketChart,
  getHourlyTokenMarketChart,
} from "./token-chart.js";

export type TokenVolatilityTimeframe = "24h" | "hourly" | "daily";
export type TokenVolatilityWindow =
  | "auto"
  | "adjacent"
  | "15m"
  | "1h"
  | "6h"
  | "24h";

type EvaluatedWindow =
  | Exclude<TokenVolatilityWindow, "auto">
  | "7d"
  | "30d";

export type TokenPriceVolatilitySeverity = "medium" | "high" | "extreme";

export interface TokenPriceVolatilityRequest {
  address: string;
  symbol: string;
  name: string;
  thresholdPercent: number;
  timeframe: TokenVolatilityTimeframe;
  window: TokenVolatilityWindow;
}

export interface TokenPriceVolatilityEvent {
  id: string;
  type: "price_spike" | "price_drop";
  metric: "price";
  timestamp: string;
  window: string;
  changePercent: number;
  before: number;
  after: number;
  severity: TokenPriceVolatilitySeverity;
}

interface PricePoint {
  timestampMs: number;
  price: number;
}

const MAX_VOLATILITY_EVENTS = 10;
const HOURLY_CHART_DAYS = 30;
const DAILY_CHART_DAYS = 365;
const DENSE_COOLDOWN_MS = 30 * 60 * 1000;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_LONG_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const WINDOW_MS: Partial<Record<EvaluatedWindow, number>> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const WINDOW_RANK: Record<EvaluatedWindow, number> = {
  adjacent: 0,
  "15m": 1,
  "1h": 2,
  "6h": 3,
  "24h": 4,
  "7d": 5,
  "30d": 6,
};

function toPricePoint(row: { unixTimestampMs: number; price: unknown }) {
  const timestampMs = Number(row.unixTimestampMs);
  const price = Number(row.price);

  if (!Number.isFinite(timestampMs) || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return { timestampMs, price };
}

async function getPricePoints(
  address: string,
  timeframe: TokenVolatilityTimeframe,
) {
  const rows =
    timeframe === "24h"
      ? await get24hTokenMarketChart(address)
      : timeframe === "hourly"
        ? await getHourlyTokenMarketChart(address, HOURLY_CHART_DAYS)
        : await getDailyTokenMarketChart(address, DAILY_CHART_DAYS);

  console.debug("[token-volatility] chart source", {
    address,
    timeframe,
    chartFunction:
      timeframe === "24h"
        ? "get24hTokenMarketChart"
        : timeframe === "hourly"
          ? "getHourlyTokenMarketChart"
          : "getDailyTokenMarketChart",
    rawChartPoints: rows.length,
    firstPoint: rows[0] ?? null,
    lastPoint: rows.at(-1) ?? null,
  });

  return rows
    .map(toPricePoint)
    .filter((point): point is PricePoint => point != null)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function getEvaluatedWindows(
  timeframe: TokenVolatilityTimeframe,
  window: TokenVolatilityWindow,
): EvaluatedWindow[] {
  if (window !== "auto") return [window];

  if (timeframe === "24h") {
    return ["adjacent", "15m", "1h", "6h"];
  }

  if (timeframe === "hourly") {
    return ["adjacent", "1h", "6h", "24h"];
  }

  return ["adjacent", "7d", "30d"];
}

function getSeverity(
  absChangePercent: number,
  thresholdPercent: number,
): TokenPriceVolatilitySeverity {
  if (absChangePercent >= thresholdPercent * 3) return "extreme";
  if (absChangePercent >= thresholdPercent * 2) return "high";
  return "medium";
}

function createEvent(
  address: string,
  previous: PricePoint,
  current: PricePoint,
  changePercent: number,
  thresholdPercent: number,
  window: EvaluatedWindow,
): TokenPriceVolatilityEvent {
  const type = changePercent >= 0 ? "price_spike" : "price_drop";

  return {
    id: `${address}:price:${current.timestampMs}:${type}:${window}`,
    type,
    metric: "price",
    timestamp: new Date(current.timestampMs).toISOString(),
    window,
    changePercent,
    before: previous.price,
    after: current.price,
    severity: getSeverity(Math.abs(changePercent), thresholdPercent),
  };
}

function findPointAtOrBefore(points: PricePoint[], targetTimestampMs: number) {
  let low = 0;
  let high = points.length - 1;
  let best: PricePoint | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const point = points[mid];

    if (point.timestampMs <= targetTimestampMs) {
      best = point;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function getComparisonPoint(
  points: PricePoint[],
  currentIndex: number,
  window: EvaluatedWindow,
) {
  if (currentIndex <= 0) return null;

  if (window === "adjacent") {
    return points[currentIndex - 1];
  }

  const lookbackMs = WINDOW_MS[window];
  if (!lookbackMs) return null;

  return findPointAtOrBefore(
    points,
    points[currentIndex].timestampMs - lookbackMs,
  );
}

function detectEventsForWindow(
  address: string,
  points: PricePoint[],
  thresholdPercent: number,
  window: EvaluatedWindow,
) {
  const events: TokenPriceVolatilityEvent[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const previous = getComparisonPoint(points, i, window);
    if (!previous || previous.price <= 0) continue;

    const current = points[i];
    const changePercent =
      ((current.price - previous.price) / previous.price) * 100;

    if (Math.abs(changePercent) >= thresholdPercent) {
      events.push(
        createEvent(
          address,
          previous,
          current,
          changePercent,
          thresholdPercent,
          window,
        ),
      );
    }
  }

  return events;
}

function detectRawEvents(
  address: string,
  points: PricePoint[],
  thresholdPercent: number,
  evaluatedWindows: EvaluatedWindow[],
) {
  return evaluatedWindows.flatMap((window) =>
    detectEventsForWindow(address, points, thresholdPercent, window),
  );
}

function getEventCooldownMs(
  event: TokenPriceVolatilityEvent,
  timeframe: TokenVolatilityTimeframe,
) {
  if (timeframe !== "daily") return DENSE_COOLDOWN_MS;

  return event.window === "7d" || event.window === "30d"
    ? DAILY_LONG_COOLDOWN_MS
    : DAILY_COOLDOWN_MS;
}

function isBetterEvent(
  candidate: TokenPriceVolatilityEvent,
  existing: TokenPriceVolatilityEvent,
) {
  const candidateAbs = Math.abs(candidate.changePercent);
  const existingAbs = Math.abs(existing.changePercent);
  const tolerance = Math.max(0.1, existingAbs * 0.05);

  if (candidateAbs > existingAbs + tolerance) return true;
  if (candidateAbs < existingAbs - tolerance) return false;

  const candidateRank = WINDOW_RANK[candidate.window as EvaluatedWindow] ?? 0;
  const existingRank = WINDOW_RANK[existing.window as EvaluatedWindow] ?? 0;
  return candidateRank > existingRank;
}

function groupNearbyEvents(
  events: TokenPriceVolatilityEvent[],
  timeframe: TokenVolatilityTimeframe,
) {
  const grouped: TokenPriceVolatilityEvent[] = [];
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );

  for (const event of sorted) {
    const eventTime = Date.parse(event.timestamp);
    const existingIndex = grouped.findIndex((candidate) => {
      if (candidate.type !== event.type) return false;

      const candidateTime = Date.parse(candidate.timestamp);
      const cooldownMs = Math.max(
        getEventCooldownMs(event, timeframe),
        getEventCooldownMs(candidate, timeframe),
      );

      return Math.abs(eventTime - candidateTime) <= cooldownMs;
    });

    if (existingIndex === -1) {
      grouped.push(event);
      continue;
    }

    if (isBetterEvent(event, grouped[existingIndex])) {
      grouped[existingIndex] = event;
    }
  }

  return grouped;
}

export async function getTokenPriceVolatilityEvents({
  address,
  symbol,
  name,
  thresholdPercent,
  timeframe,
  window,
}: TokenPriceVolatilityRequest) {
  const points = await getPricePoints(address, timeframe);
  const evaluatedWindows = getEvaluatedWindows(timeframe, window);
  const rawEvents = detectRawEvents(
    address,
    points,
    thresholdPercent,
    evaluatedWindows,
  );
  const groupedEvents = groupNearbyEvents(rawEvents, timeframe)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_VOLATILITY_EVENTS);

  console.info("[token-volatility] price volatility", {
    token: { address, symbol, name },
    timeframe,
    thresholdPercent,
    requestedWindow: window,
    evaluatedWindows,
    dataPointsAnalyzed: points.length,
    rawEventsDetected: rawEvents.length,
    groupedEventsReturned: groupedEvents.length,
  });

  return {
    token: { address, symbol, name },
    thresholdPercent,
    timeframe,
    metric: "price" as const,
    updatedAt: new Date().toISOString(),
    dataPointsAnalyzed: points.length,
    rawEventsDetected: rawEvents.length,
    groupedEventsReturned: groupedEvents.length,
    evaluatedWindows,
    events: groupedEvents,
  };
}
