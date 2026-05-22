import type { UserAlertPeriod } from "@sv/db/alerts.js";
import {
  alertState,
  alerts,
  tokenAlertConditions,
  tokenAlertTargets,
} from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { get24hTokenMarketChart } from "./token-chart.js";

interface PriceDataPoint {
  timestamp: number;
  price: number;
}

interface AggregatedPrice {
  period: UserAlertPeriod;
  price: number;
  priceChange: number;
  priceChangePercentage: number;
}

interface TokenPriceAlert {
  address: string;
  currentPrice: number;
  aggregatedPrices: AggregatedPrice[];
}

interface TrackedToken {
  address: string;
  periods: UserAlertPeriod[];
}

const pollingIntervalMs = 30_000; // 30 seconds
let isPolling = false;

async function stopExpiredAlerts(now: Date) {
  const expiredAlerts = await db
    .select({ alertId: alerts.id })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .where(
      and(
        eq(alerts.alertType, "token"),
        lte(alerts.expiresAt, now),
        eq(alertState.status, "running"),
      ),
    );

  if (expiredAlerts.length == 0) {
    return;
  }

  const expiredAlertIds = expiredAlerts.map((a) => a.alertId);

  await db
    .update(alertState)
    .set({
      status: "stopped",
    })
    .where(inArray(alertState.alertId, expiredAlertIds));
}

async function getTrackedTokensWithPeriods(): Promise<TrackedToken[]> {
  const now = new Date();
  const result = await db
    .selectDistinct({
      address: tokenAlertTargets.tokenAddress,
      period: tokenAlertConditions.period,
    })
    .from(alerts)
    .innerJoin(alertState, eq(alertState.alertId, alerts.id))
    .innerJoin(tokenAlertTargets, eq(tokenAlertTargets.alertId, alerts.id))
    .innerJoin(
      tokenAlertConditions,
      eq(tokenAlertConditions.alertId, alerts.id),
    )
    .where(
      and(
        eq(alerts.alertType, "token"),
        gt(alerts.expiresAt, now),
        eq(alertState.status, "running"),
      ),
    );

  const tokenPeriodMap = new Map<string, Set<UserAlertPeriod>>();

  for (const row of result) {
    const existing =
      tokenPeriodMap.get(row.address) ?? new Set<UserAlertPeriod>();
    existing.add(row.period);
    tokenPeriodMap.set(row.address, existing);
  }

  return Array.from(tokenPeriodMap.entries()).map(([address, periods]) => ({
    address,
    periods: Array.from(periods),
  }));
}

function getPeriodMs(period: UserAlertPeriod): number {
  switch (period) {
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
  }
}

function aggregatePriceByPeriod(
  dataPoints: PriceDataPoint[],
  period: UserAlertPeriod,
): AggregatedPrice | null {
  if (dataPoints.length == 0) return null;

  const periodMs = getPeriodMs(period);
  const now = Date.now();
  const periodStartTime = now - periodMs;

  // Get price at the beginning of the period
  const priceAtPeriodStart = dataPoints.find(
    (p) => p.timestamp <= periodStartTime,
  );
  if (!priceAtPeriodStart) return null;

  const currentPrice = dataPoints[dataPoints.length - 1].price;
  const priceChange = currentPrice - priceAtPeriodStart.price;
  const priceChangePercentage = (priceChange / priceAtPeriodStart.price) * 100;

  return {
    period,
    price: currentPrice,
    priceChange,
    priceChangePercentage,
  };
}

async function pollTokenPrices() {
  if (isPolling) return;

  try {
    isPolling = true;

    const now = new Date();
    await stopExpiredAlerts(now);

    const trackedTokens = await getTrackedTokensWithPeriods();
    if (trackedTokens.length == 0) {
      console.log("Token Polling:  No tracked tokens");
      return;
    }

    const tokenAlerts: TokenPriceAlert[] = [];

    // Fetch 24h chart for each token
    for (const trackedToken of trackedTokens) {
      const { address, periods } = trackedToken;

      try {
        const chartData = await get24hTokenMarketChart(address);
        if (!chartData || chartData.length == 0) continue;

        // Convert chart data to price points (timestamp in ms, sorted)
        const pricePoints: PriceDataPoint[] = chartData.map((point) => ({
          timestamp: point.unixTimestampMs,
          price: point.price,
        }));

        // Aggregate prices for each period
        const aggregatedPrices: AggregatedPrice[] = [];
        for (const period of periods) {
          const agg = aggregatePriceByPeriod(pricePoints, period);
          if (agg) {
            aggregatedPrices.push(agg);
          }
        }

        if (aggregatedPrices.length > 0) {
          const currentPrice = pricePoints[pricePoints.length - 1].price;
          tokenAlerts.push({
            address,
            currentPrice,
            aggregatedPrices,
          });
        }
      } catch (err) {
        console.error(
          `Token Polling:  Failed to fetch chart for ${address}:`,
          err,
        );
      }
    }

    if (tokenAlerts.length > 0) {
      console.log(
        `Token Polling:  Updated ${tokenAlerts.length} tokens at ${new Date().toISOString()}`,
      );
      tokenAlerts.forEach((alert) => {
        console.log(`  ${alert.address}: $${alert.currentPrice.toFixed(6)}`);
        alert.aggregatedPrices.forEach((agg) => {
          console.log(
            `    ${agg.period}: ${agg.priceChangePercentage > 0 ? "+" : ""}${agg.priceChangePercentage.toFixed(2)}%`,
          );
        });
      });
    }
  } catch (err) {
    console.error("Token Polling:  Error:", err);
  } finally {
    isPolling = false;
  }
}

export async function startTokenPolling() {
  console.log("Token Polling:  Started");

  // Poll immediately first
  await pollTokenPrices();

  // Then set up recurring polling
  setInterval(pollTokenPrices, pollingIntervalMs);
}

export async function stopTokenPolling() {
  console.log("Token Polling:  Stopped");
}
