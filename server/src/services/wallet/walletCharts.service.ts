import type {
  BalanceDataPoint,
  WalletTimePeriod,
  WalletCumulativePnLResult,
  PnLDataPoint,
} from "./dtos/walletDataObjects.js";
import { getRangeStartMs } from "@sv/services/wallet/walletData.core.js";
import { roundUsd } from "./walletNormalization.utils.js";
import { getWalletTransfers } from "./walletTransfersSwaps.service.js";
import { getWalletOverview } from "./walletOverview.service.js";
import { db } from "@sv/db/index.js";
import {
  walletBalanceMonthHistory,
  walletBalanceWeekHistory,
} from "@sv/db/schema.js";
import { and, between, eq, gte } from "drizzle-orm";
import * as zrn from "@sv/util/util-zerion.js";
import { zrn_WalletBalanceChartSchema } from "../_types/wallet-raw-responses.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import dayjs from "dayjs";
import { WALLET_BALANCE_HISTORY_CACHE_TTL_MS } from "@sv/config/constants.js";

type ZerionErrorSummary = {
  title?: string;
  detail?: string;
};

/**
 * Safe, typed representation of a failed Zerion balance-chart request.
 * It intentionally excludes request headers, credentials, and raw response bodies.
 */
export class ZerionUpstreamError extends Error {
  readonly provider = "zerion";
  readonly upstreamStatus?: number;
  readonly upstreamStatusText?: string;
  readonly endpointPath: string;
  readonly errorTitle?: string;
  readonly errorDetail?: string;
  readonly reason: "upstream_response" | "invalid_response" | "network_error";

  constructor(input: {
    upstreamStatus?: number;
    upstreamStatusText?: string;
    endpointPath: string;
    errorSummary?: ZerionErrorSummary;
    reason: ZerionUpstreamError["reason"];
  }) {
    super(
      input.reason == "network_error"
        ? "Zerion balance chart request failed"
        : `Zerion balance chart request failed with status ${input.upstreamStatus}`,
    );
    this.name = "ZerionUpstreamError";
    this.upstreamStatus = input.upstreamStatus;
    this.upstreamStatusText = input.upstreamStatusText;
    this.endpointPath = input.endpointPath;
    this.errorTitle = input.errorSummary?.title;
    this.errorDetail = input.errorSummary?.detail;
    this.reason = input.reason;
  }
}

function truncateLogValue(value: string, maxLength = 500): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function parseZerionErrorSummary(body: string): ZerionErrorSummary {
  try {
    const parsed = JSON.parse(body) as {
      errors?: Array<{ title?: unknown; detail?: unknown }>;
    };
    const firstError = parsed.errors?.[0];
    return {
      title:
        typeof firstError?.title == "string"
          ? truncateLogValue(firstError.title)
          : undefined,
      detail:
        typeof firstError?.detail == "string"
          ? truncateLogValue(firstError.detail)
          : undefined,
    };
  } catch {
    return {};
  }
}

function logZerionBalanceFailure(error: ZerionUpstreamError) {
  console.warn("Zerion balance chart request failed", {
    provider: error.provider,
    endpointPath: error.endpointPath,
    upstreamStatus: error.upstreamStatus,
    upstreamStatusText: error.upstreamStatusText,
    errorTitle: error.errorTitle,
    errorDetail: error.errorDetail,
    reason: error.reason,
  });
}

async function parseZerionBalanceChartSuccessResponse(resp: Response) {
  let body: string;
  try {
    body = await resp.text();
  } catch {
    return;
  }

  if (!body) {
    return;
  }

  try {
    const parsed = zrn_WalletBalanceChartSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return;
  }
}

/**
 * Get UTC start-of-day timestamp (ms) for a given timestamp.
 */
function getUtcStartOfDayMs(tsMs: number): number {
  const d = new Date(tsMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Build daily balance anchors for PnL computation.
 * Returns array of {dayStartMs, balanceAtStart, balanceAtEnd} for each day.
 * Uses linear interpolation if no data point exists at exact day boundary.
 * For the current/last day, uses the final balance point as end-of-day.
 */
function buildDailyBalanceAnchors(balanceHistory: BalanceDataPoint[]): Array<{
  dayStartMs: number;
  balanceAtStart: number;
  balanceAtEnd: number;
}> {
  if (balanceHistory.length == 0) {
    return [];
  }

  const anchors: Array<{
    dayStartMs: number;
    balanceAtStart: number;
    balanceAtEnd: number;
  }> = [];
  const sortedHistory = [...balanceHistory].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  for (let index = 0; index < sortedHistory.length - 1; index++) {
    const point = sortedHistory[index];
    const nextPoint = sortedHistory[index + 1];

    anchors.push({
      dayStartMs: point.timestamp,
      balanceAtStart: point.value,
      balanceAtEnd: nextPoint.value,
    });
  }

  return anchors;
}

/**
 * Compute daily net inflow (inflow - outflow) per UTC day.
 * Returns map of dayStartMs -> netInflowUsd.
 *
 * Direction is inferred from transfer.from vs address:
 * - transfer.from == address: outflow (negative)
 * - transfer.to == address: inflow (positive)
 */
async function computeDailyNetInflow(
  address: string,
  fromMs: number,
  toMs: number,
): Promise<Map<number, number>> {
  const dailyNetInflow = new Map<number, number>();

  try {
    const transfersResponse = await getWalletTransfers(address, fromMs, toMs);
    const transfers = transfersResponse?.transfers ?? [];

    // console.log("[computeDailyNetInflow] transfers: ")
    // console.info(transfers)

    for (const transfer of transfers) {
      if (!transfer.amountUsd) {
        continue; // Skip transfers without USD value
      }

      const tsMs = Date.parse(transfer.timestamp);
      if (!Number.isFinite(tsMs)) {
        continue;
      }

      // Only include transfers within the requested range
      if (tsMs < fromMs || tsMs > toMs) {
        continue;
      }

      const dayStartMs = getUtcStartOfDayMs(tsMs);

      // Determine direction: inflow (+) or outflow (-)
      const isInflow = transfer.to == address;
      const isOutflow = transfer.from == address;

      let flowAmount = 0;
      if (isInflow) {
        flowAmount = transfer.amountUsd; // positive
      } else if (isOutflow) {
        flowAmount = -transfer.amountUsd; // negative
      }

      // Accumulate into daily total
      const current = dailyNetInflow.get(dayStartMs) ?? 0;
      dailyNetInflow.set(dayStartMs, current + flowAmount);
    }
  } catch (error) {
    console.error("[computeDailyNetInflow] failed to fetch/compute transfers", {
      address,
      error,
    });
  }

  return dailyNetInflow;
}

type WalletBalanceHistory = {
  usdValue: number;
  timestampMs: number;
}[];

export async function getWalletBalanceHistory(
  address: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletBalanceHistory> {
  // TODO: enforce this
  const toZrnChartPeriod: Record<any, "week" | "month"> = {
    "7D": "week",
    "30D": "month",
  };
  const zrnPeriod = toZrnChartPeriod[timePeriod];

  const nowUtc = dayjs.utc();
  const end = nowUtc.valueOf();
  const start = nowUtc.subtract(1, zrnPeriod).valueOf();
  const thresholdDateMs = end - WALLET_BALANCE_HISTORY_CACHE_TTL_MS;

  const balanceTable =
    zrnPeriod == "week" ? walletBalanceWeekHistory : walletBalanceMonthHistory;

  const res = await db
    .select()
    .from(balanceTable)
    .where(
      and(
        eq(balanceTable.address, address),
        between(balanceTable.timestampMs, start, end),
      ),
    )
    .orderBy(balanceTable.timestampMs);

  if (res.length == 0 || res[res.length - 1].timestampMs < thresholdDateMs) {
    return fetchWalletBalanceHistory(address, zrnPeriod);
  }

  return normalizeByDay(
    res.map((point) => ({
      timestampMs: point.timestampMs,
      usdValue: point.usdValue,
    })),
  );
}

async function fetchWalletBalanceHistory(
  address: string,
  timePeriod: "week" | "month",
): Promise<WalletBalanceHistory> {
  const url = zrn.getEndpoint(`/wallets/${address}/charts/${timePeriod}`);
  const req = new URL(url);
  req.search = new URLSearchParams({
    currency: "usd",
    "filter[positions]": "only_simple",
    "filter[chain_ids]": "solana",
  }).toString();

  let resp: Response;
  try {
    resp = await rlFetch(req, {
      rlLimiter: zrn.limiter,
      method: "GET",
      headers: zrn.getRequiredHeaders(),
      rlRetries: 3,
      rlRetryDelayMs: 500,
      rlTimeoutMs: 30_000,
      rlLogContext: {
        provider: "zerion",
        endpointPath: req.pathname,
      },
    });
  } catch {
    const error = new ZerionUpstreamError({
      endpointPath: req.pathname,
      reason: "network_error",
    });
    logZerionBalanceFailure(error);
    throw error;
  }

  if (!resp.ok) {
    let body = "";
    try {
      body = await resp.text();
    } catch {
      // The status and endpoint path below are sufficient for safe diagnostics.
    }

    const error = new ZerionUpstreamError({
      upstreamStatus: resp.status,
      upstreamStatusText: resp.statusText
        ? truncateLogValue(resp.statusText)
        : undefined,
      endpointPath: req.pathname,
      errorSummary: parseZerionErrorSummary(body),
      reason: "upstream_response",
    });
    logZerionBalanceFailure(error);
    throw error;
  }

  const res = await parseZerionBalanceChartSuccessResponse(resp);
  if (!res) {
    const error = new ZerionUpstreamError({
      upstreamStatus: resp.status,
      upstreamStatusText: resp.statusText
        ? truncateLogValue(resp.statusText)
        : undefined,
      endpointPath: req.pathname,
      reason: "invalid_response",
    });
    logZerionBalanceFailure(error);
    throw error;
  }

  const insertValues = res.data.attributes.points.map((point) => ({
    address: address,
    // s -> ms
    timestampMs: point[0] * 1000,
    usdValue: point[1] * 1000,
  }));

  const balanceTable =
    timePeriod == "week" ? walletBalanceWeekHistory : walletBalanceMonthHistory;

  await db.insert(balanceTable).values(insertValues).onConflictDoNothing();

  return normalizeByDay(
    insertValues.map((point) => ({
      usdValue: point.usdValue,
      timestampMs: point.timestampMs,
    })),
  );
}

// Group data points by UTC day, keeping only the latest point per day.
function normalizeByDay(
  dataPoints: NonNullable<WalletBalanceHistory>,
): NonNullable<WalletBalanceHistory> {
  const normalized = dataPoints
    .reduce((acc, point) => {
      const dayMs = dayjs.utc(point.timestampMs).startOf("day").valueOf();
      if (!acc.has(dayMs) || acc.get(dayMs)!.timestampMs < point.timestampMs) {
        acc.set(dayMs, point);
      }
      return acc;
    }, new Map<number, NonNullable<WalletBalanceHistory>[number]>())
    .values();

  return [...normalized];
}

export async function getCumulativePnL(
  address: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletCumulativePnLResult> {
  const rangeSec = resolveWalletTimeRangeSec(timePeriod);
  const fromMs = rangeSec.fromSec * 1000;
  const toMs = rangeSec.toSec * 1000;

  try {
    // Get balance history and build daily anchors
    const balanceHistory = await getWalletBalanceHistory(address, timePeriod);

    // get Current balance
    const currentBalance = (await getWalletOverview(address)).holdings
      .totalAssetValueUsd;
    const historyPoint: BalanceDataPoint = {
      timestamp: Date.now(),
      value: currentBalance,
      date: "", // this value is not used to calculate so can be left as ''
    };
    const fullBalanceHistory = [
      ...(balanceHistory?.map((point) => ({
        timestamp: point.timestampMs,
        value: point.usdValue,
        date: dayjs.utc(point.timestampMs).toISOString(),
      })) || []),
      historyPoint,
    ];

    const dailyAnchors = buildDailyBalanceAnchors(fullBalanceHistory);
    if (dailyAnchors.length == 0) {
      return emptyPnL();
    }

    // Compute daily net inflow
    const dailyNetInflowMap = await computeDailyNetInflow(
      address,
      fromMs,
      toMs,
    );
    // console.log("[getCumulativePnL] dailyNetInflowMap")
    // console.info(dailyNetInflowMap)

    // Apply formula: dailyPnL[i] = (balanceEnd - balanceStart) - netInflow[i]
    const dailyPnLArray: PnLDataPoint[] = [];
    let cumulativePnL = 0;
    const cumulativePnLArray: PnLDataPoint[] = [];

    for (const anchor of dailyAnchors) {
      const dayStartMs = anchor.dayStartMs;
      const balanceDelta = anchor.balanceAtEnd - anchor.balanceAtStart;
      const netInflow = dailyNetInflowMap.get(dayStartMs) ?? 0;

      // Formula: dailyPnL = dayDelta - netInflow
      const dayPnL = roundUsd(balanceDelta - netInflow);
      // const dayPnL = roundUsd(balanceDelta);
      // const dayPnL = roundUsd(netInflow);

      dailyPnLArray.push({
        timestamp: dayStartMs,
        value: dayPnL,
      });

      // Cumulative as prefix sum
      cumulativePnL += dayPnL;
      cumulativePnLArray.push({
        timestamp: dayStartMs,
        value: roundUsd(cumulativePnL),
      });
    }

    // startBalance and endBalance from day-anchor balances
    const startBalance =
      dailyAnchors.length > 0 ? roundUsd(dailyAnchors[0]!.balanceAtStart) : 0;
    const endBalance =
      dailyAnchors.length > 0
        ? roundUsd(dailyAnchors[dailyAnchors.length - 1]!.balanceAtEnd)
        : 0;

    return {
      dailyPnL: dailyPnLArray,
      cumulativePnL: cumulativePnLArray,
      startBalance,
      endBalance,
    };
  } catch (error) {
    console.error("[WalletCumulativePnL] failed to compute series", {
      address,
      timePeriod,
      // aggregation,
      error,
    });
    return emptyPnL();
  }
}

export function resolveWalletTimeRangeSec(
  timePeriod: WalletTimePeriod,
  nowSec = Math.floor(Date.now() / 1000),
): { fromSec: number; toSec: number } {
  const nowMs = nowSec * 1000;
  const fromMs = getRangeStartMs(nowMs, timePeriod);
  return {
    fromSec: Math.max(0, Math.floor(fromMs / 1000)),
    toSec: nowSec,
  };
}

function emptyPnL(): WalletCumulativePnLResult {
  return {
    dailyPnL: [],
    cumulativePnL: [],
    startBalance: 0,
    endBalance: 0,
  };
}
