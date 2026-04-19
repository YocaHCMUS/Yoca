import type { UserAlertPeriod } from "@sv/db/alerts.js";
import { userAlertPeriods, userAlerts } from "@sv/db/alerts.js";
import { db } from "@sv/db/index.js";
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

const pollingIntervalMs = 30_000; // 30 seconds
let isPolling = false;

async function getTrackedTokenAddresses(): Promise<string[]> {
  const result = await db
    .selectDistinct({ address: userAlerts.tokenAddress })
    .from(userAlerts);

  return result.map((row) => row.address);
}

function getPeriodMs(period: UserAlertPeriod): number {
  switch (period) {
    case "30m":
      return 30 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
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

    const addresses = await getTrackedTokenAddresses();
    if (addresses.length == 0) {
      console.log("Token Polling:  No tracked tokens");
      return;
    }

    const tokenAlerts: TokenPriceAlert[] = [];

    // Fetch 24h chart for each token
    for (const address of addresses) {
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
        for (const period of userAlertPeriods) {
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
