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
import { walletBalanceHistory } from "@sv/db/schema.js";
import { and, between, eq, gte, lte } from "drizzle-orm";
import * as bds from "@sv/util/util-birdeye.js";
import { bds_WalletNetworthHistorySchema } from "../_types/wallet-raw-responses.js";
import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import {
  getEndOfUtcDatesFromNowMs,
  periodToDayCount,
} from "@sv/util/date.js";
import { DAY_MS } from "./wallet.constants.js";
import dayjs from "dayjs";
import { WALLET_BALANCE_HISTORY_CACHE_TTL_MS } from "@sv/config/constants.js";

function startOfUtcTodayMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
  if (balanceHistory.length === 0) {
    return [];
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
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
      const isInflow = transfer.to === address;
      const isOutflow = transfer.from === address;

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
  // TODO: Limit the day ("ALL" is not possible)
  const dayCount = periodToDayCount[timePeriod];
  const [start, end] = getEndOfUtcDatesFromNowMs(timePeriod);

  const res = await db
    .select()
    .from(walletBalanceHistory)
    .where(
      and(
        eq(walletBalanceHistory.address, address),
        between(walletBalanceHistory.timestampMs, start, end),
      ),
    )
    .orderBy(walletBalanceHistory.timestampMs);

  if (res.length == 0) {
    return fetchWalletBalanceHistory(address, timePeriod);
  }

  // Latest time check, this can be that today data needs update
  // or the data is too old (days or months ago)
  const latestTimestamp = res[res.length - 1].timestampMs;
  if (
    dayjs.utc().valueOf() - latestTimestamp >
    WALLET_BALANCE_HISTORY_CACHE_TTL_MS
  ) {
    return fetchWalletBalanceHistory(address, timePeriod);
  }

  // Group by day and keep only the latest data point per day
  const latestPerDay = new Map<number, (typeof res)[0]>();
  for (const row of res) {
    const dayStart = dayjs.utc(row.timestampMs).startOf("day").valueOf();
    const existing = latestPerDay.get(dayStart);
    if (!existing || row.timestampMs > existing.timestampMs) {
      latestPerDay.set(dayStart, row);
    }
  }

  const uniqueDays = latestPerDay.size;

  if (uniqueDays >= dayCount) {
    return Array.from(latestPerDay.values()).map((row) => ({
      usdValue: row.usdValue,
      timestampMs: row.timestampMs,
    }));
  } else {
    // The data has gap and need refetch
    return fetchWalletBalanceHistory(address, timePeriod);
  }
}

async function fetchWalletBalanceHistory(
  address: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletBalanceHistory> {
  const url = bds.getEndpoint("/wallet/v2/net-worth");

  url.search = new URLSearchParams({
    wallet: address,
    type: "1d",
    sort_type: "desc",
    direction: "back",
    limit: "100",
    offset: "0",
    count: String(Math.min(periodToDayCount[timePeriod], 30)),
  }).toString();

  const resp = await fetch(url, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const res = await getTrackedApiResult(bds_WalletNetworthHistorySchema, resp);

  if (!res || !res.data || !res.success) {
    return null;
  }

  const insertValues = res.data.history.map((point) => ({
    address: address,
    usdValue: point.net_worth,
    timestampMs: dayjs(point.timestamp).valueOf(),
  }));

  await db
    .insert(walletBalanceHistory)
    .values(insertValues)
    .onConflictDoNothing();

  return insertValues.map((point) => ({
    usdValue: point.usdValue,
    timestampMs: point.timestampMs,
  }));
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
    if (dailyAnchors.length === 0) {
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
