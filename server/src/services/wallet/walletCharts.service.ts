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
import * as mobula from "@sv/util/util-mobula.js";
import { mbl_WalletHistorySchema } from "../_types/wallet-raw-responses.js";
import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import dayjs from "dayjs";
import { WALLET_BALANCE_HISTORY_CACHE_TTL_MS } from "@sv/config/constants.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import { excluded } from "@sv/util/orm-sql.js";

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

type WalletBalanceHistory =
  | {
      usdValue: number;
      timestampMs: number;
    }[]
  | null;

export async function getWalletBalanceHistory(
  address: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletBalanceHistory> {
  // TODO: enforce this
  const toBalanceChartPeriod: Record<string, "week" | "month"> = {
    "7D": "week",
    "30D": "month",
  };
  const balanceChartPeriod = toBalanceChartPeriod[timePeriod] ?? "month";

  const nowUtc = dayjs.utc();
  const end = nowUtc.valueOf();
  const start = nowUtc.subtract(1, balanceChartPeriod).valueOf();
  const thresholdDateMs = end - WALLET_BALANCE_HISTORY_CACHE_TTL_MS;

  const balanceTable =
    balanceChartPeriod == "week"
      ? walletBalanceWeekHistory
      : walletBalanceMonthHistory;

  const res = await db
    .select()
    .from(balanceTable)
    .where(
      and(
        eq(balanceTable.address, address),
        between(balanceTable.timestampMs, start, end),
        gte(balanceTable.updatedAtMs, thresholdDateMs),
      ),
    )
    .orderBy(balanceTable.timestampMs);

  if (res.length == 0) {
    return fetchWalletBalanceHistory(address, balanceChartPeriod, start, end);
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
  startMs: number,
  endMs: number,
): Promise<WalletBalanceHistory> {
  const endpoint = mobula.getEndpoint("/1/wallet/history");
  endpoint.search = new URLSearchParams({
    wallet: address,
    blockchains: "solana:solana",
    from: String(startMs),
    to: String(endMs),
    period: "1d",
    filterSpam: "true",
    unlistedAssets: "false",
  }).toString();

  const resp = await rlFetch(endpoint, {
    method: "GET",
    headers: mobula.getRequiredHeaders(),
    rlLimiter: mobula.limiter,
  });

  const res = await getTrackedApiResult(mbl_WalletHistorySchema, resp);
  if (!res) {
    return null;
  }

  const fetchedAtMs = dayjs.utc().valueOf();
  const insertValues = res.data.balance_history.map((point) => ({
    address: address,
    timestampMs: point[0],
    usdValue: point[1],
    updatedAtMs: fetchedAtMs,
  }));

  if (insertValues.length == 0) {
    return [];
  }

  const balanceTable =
    timePeriod == "week" ? walletBalanceWeekHistory : walletBalanceMonthHistory;

  await db.insert(balanceTable).values(insertValues).onConflictDoUpdate({
    target: [balanceTable.address, balanceTable.timestampMs],
    set: {
      usdValue: excluded(balanceTable.usdValue),
      updatedAtMs: excluded(balanceTable.updatedAtMs),
    },
  });

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
