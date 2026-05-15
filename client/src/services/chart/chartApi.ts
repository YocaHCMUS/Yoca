/**
 * Chart API Service
 *
 * Provides functions to fetch chart data from backend API endpoints.
 * Types are automatically inferred from the backend Hono routes via RPC client.
 * NO manual type annotations needed - Hono handles type inference automatically.
 *
 * @module chartApi
 */

import client from "@/api/main";
import type { RollingProfitAndLossResponse } from "@/types/chart-api.types";

/**
 * Utility type to extract the inferred response type from a fetcher function
 * This allows components to get proper typing without manual type annotations
 *
 * @example
 * type AssetDistData = InferFetcherData<typeof fetchAssetDistribution>;
 */
export type InferFetcherData<T extends (...args: any[]) => Promise<any>> =
  Awaited<ReturnType<T>>;

/**
 * Helper to handle API response with error checking
 * Throws an error if the response is not successful
 */
async function handleResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.details) {
        errorMessage = `Validation error: ${JSON.stringify(errorData.details)}`;
      }
    } catch (e) {
      console.error("[chartApi] Failed to parse error response:", e);
    }
    const error = new Error(errorMessage);
    console.error("[chartApi] Request failed:", {
      status: response.status,
      error,
    });
    throw error;
  }
}

/**
 * Fetch balance trend data
 * GET /api/charts/balance
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchBalanceTrend(
  params?: Parameters<typeof client.api.charts.balance.$get>[0],
) {
  // Hono RPC client requires wrapping query params in { query: {...} }
  const honoParams = params ? { query: params } : undefined;

  const response = await client.api.charts.balance.$get(honoParams);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch asset distribution data
 * GET /api/charts/distribution
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchAssetDistribution(
  params?: Parameters<typeof client.api.charts.distribution.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.distribution.$get(honoParams);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch P&L chart data
 * GET /api/charts/pnl
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchPnLChart(
  params?: Parameters<typeof client.api.charts.pnl.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.pnl.$get(honoParams);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch transaction distribution data
 * GET /api/charts/transactions
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTransactionDistribution(
  params?: Parameters<typeof client.api.charts.transactions.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.transactions.$get(honoParams);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch trading volume distribution data
 * GET /api/charts/trading-volume-distribution
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTradingVolumeDistribution(
  params?: Parameters<
    typeof client.api.charts.tradingVolumeDistribution.$get
  >[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response =
    await client.api.charts.tradingVolumeDistribution.$get(honoParams);
  await handleResponse(response);
  const raw = await response.json();

  // Normalize backend shape to { wallets: [{ walletAddress, data: [{name,value,percentage}], totalVolume }] }
  const wallets = Array.isArray(raw)
    ? raw.map((r: any) => {
      const buyVol = r.buy.volumeUsd || 0;
      const sellVol = r.sell.volumeUsd || 0;
      const buyTx = r.buy.transactionCount || 0;
      const sellTx = r.sell.transactionCount || 0;
      const total = buyVol + sellVol;
      const totalTx = buyTx + sellTx;

      return {
        walletAddress: r.wallet,
        buyVolume: buyVol,
        sellVolume: sellVol,
        totalVolume: total,
        buyTransactionCount: buyTx,
        sellTransactionCount: sellTx,
        totalTransactionCount: totalTx,
      };
    })
    : [];

  return { wallets, metadata: { currency: "USD", timestamp: Date.now() } };
}

/**
 * Fetch trading volume per transaction data
 * GET /api/charts/trading-volume-per-transaction
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTradingVolumePerTransaction(
  params?: Parameters<
    typeof client.api.charts.tradingVolumePerTransaction.$get
  >[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response =
    await client.api.charts.tradingVolumePerTransaction.$get(honoParams);
  await handleResponse(response);
  const raw = await response.json();

  return { wallets: raw, metadata: { currency: "USD", timestamp: Date.now() } };
}

/**
 * Fetch rolling annual return data
 * GET /api/charts/rolling-annual-return
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchRollingAnnualReturn(
  params?: Parameters<typeof client.api.charts.rollingAnnualReturn.$get>[0],
) {
  // Map client-side period values to backend-accepted options
  const mapPeriod = (p?: any) => {
    if (p == null) return p;
    const s = String(p);
    const allowed = ["7D", "30D", "90D", "All"];
    if (allowed.includes(s)) return s;
    const mappings: Record<string, string> = {
      "1Y": "All",
      "1M": "30D",
      "3M": "90D",
      "1W": "7D",
    };
    if (mappings[s]) return mappings[s];
    if (/^\d+D$/.test(s)) return s;
    // conservative fallback
    return "30D";
  };

  const safeParams = params
    ? { ...(params as any), period: mapPeriod((params as any).period) }
    : undefined;
  const honoParams = safeParams ? { query: safeParams } : undefined;
  const response = await client.api.charts.rollingAnnualReturn.$get(honoParams);
  await handleResponse(response);
  const raw = await response.json();

  // Normalize period-based P&L (per-wallet array or aggregated object)
  const toNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // If backend returns an array of per-wallet metrics
  if (Array.isArray(raw)) {
    const wallets = raw.map((r: any) => {
      const source = r.rollingAnnualReturns ?? r;
      return {
        walletAddress: r.wallet ?? r.walletAddress ?? "",
        walletName: r.walletName ?? r.walletLabel ?? undefined,
        metrics: {
          total: toNumber(source.totalUsd ?? source.total ?? r.totalUsd ?? 0),
          realized: toNumber(
            source.realizedUsd ?? source.realized ?? r.realizedUsd ?? 0,
          ),
          unrealized: toNumber(
            source.unrealizedUsd ?? source.unrealized ?? r.unrealizedUsd ?? 0,
          ),
        },
      };
    });

    const availableSet = new Set<string>();
    wallets.forEach((w) => {
      if (typeof w.metrics.total === "number" && !isNaN(w.metrics.total))
        availableSet.add("total");
      if (typeof w.metrics.realized === "number" && !isNaN(w.metrics.realized))
        availableSet.add("realized");
      if (
        typeof w.metrics.unrealized === "number" &&
        !isNaN(w.metrics.unrealized)
      )
        availableSet.add("unrealized");
    });

    const availableValueTypes = Array.from(availableSet) as (
      | "total"
      | "realized"
      | "unrealized"
    )[];

    return {
      wallets,
      metadata: { timestamp: Date.now(), currency: "USD", availableValueTypes },
    } as RollingProfitAndLossResponse;
  }

  // // If backend returns an aggregated object with rollingAnnualReturns
  // if (raw && (raw.rollingAnnualReturns || raw.totalUsd || raw.realizedUsd || raw.unrealizedUsd)) {
  //   const source = raw.rollingAnnualReturns ?? raw;
  //   const metrics = {
  //     total: toNumber(source.totalUsd ?? source.total ?? raw.totalUsd ?? 0),
  //     realized: toNumber(source.realizedUsd ?? source.realized ?? raw.realizedUsd ?? 0),
  //     unrealized: toNumber(source.unrealizedUsd ?? source.unrealized ?? raw.unrealizedUsd ?? 0),
  //   };

  //   const availableValueTypes: ('total' | 'realized' | 'unrealized')[] = [];
  //   if (!isNaN(metrics.total)) availableValueTypes.push('total');
  //   if (!isNaN(metrics.realized)) availableValueTypes.push('realized');
  //   if (!isNaN(metrics.unrealized)) availableValueTypes.push('unrealized');

  //   return { metrics, metadata: { timestamp: Date.now(), currency: raw?.currency ?? 'USD', availableValueTypes } } as RollingProfitAndLossResponse;
  // }

  // // Fallback: return raw for backward compatibility (timeseries shape)
  // return raw;
}

// /**
/**
 * Fetch winrate data
 * GET /api/charts/winrate
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchWinrate(
  params?: Parameters<typeof client.api.charts.winrate.$get>[0],
) {
  console.log("[fetchWinrate] Requesting winrate data with params:", params);

  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.winrate.$get(honoParams);

  await handleResponse(response);
  const data = await response.json();

  if ("error" in data) {
    console.error("[fetchWinrate] API returned error:", data.error);
    throw new Error(`API error: ${data.error}`);
  }

  console.log("[fetchWinrate] RAW API RESPONSE:", data);
  console.log("[fetchWinrate] Response structure - wallets count:", data.wallets?.length ?? 0);

  if (data.wallets && Array.isArray(data.wallets)) {
    console.log("[fetchWinrate] FINAL CHART DATA:", JSON.stringify(data, null, 2));
  }

  return data;
}

/**
 * Fetch drawdown data
 * GET /api/charts/drawdown
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchDrawdown(
  params?: Parameters<typeof client.api.charts.drawdown.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.drawdown.$get(honoParams);
  await handleResponse(response);
  const raw = await response.json();
  if (!Array.isArray(raw) && raw.error) {
    throw new Error(`API error: ${raw.error}`);
  }

  return { wallets: raw, metadata: { timestamp: Date.now(), currency: "USD" } };
}

/**
 * Fetch total trading volume data
 * GET /api/charts/total-trading-volume
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTotalTradingVolume(
  params?: Parameters<typeof client.api.charts.totalTradingVolume.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.totalTradingVolume.$get(honoParams);
  await handleResponse(response);
  const raw = await response.json();

  return { wallets: raw, metadata: { currency: "USD", timestamp: Date.now() } };
}

/**
 * Fetch daily trading volume data
 * GET /api/charts/dailyTradingVolume
 */
export async function fetchDailyTradingVolume(
  params?: Parameters<typeof client.api.charts.dailyTradingVolume.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.dailyTradingVolume.$get(honoParams);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch stablecoin ratio data
 * GET /api/charts/stablecoin-ratio
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchStablecoinRatio(
  params?: Parameters<typeof client.api.charts.stablecoinRatio.$get>[0],
) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.stablecoinRatio.$get(honoParams);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

export const chartApi = {
  fetchBalanceTrend,
  fetchAssetDistribution,
  fetchPnLChart,
  fetchTransactionDistribution,
  // fetchPriceHistory,
  fetchTradingVolumeDistribution,
  fetchTradingVolumePerTransaction,
  fetchRollingAnnualReturn,
  fetchWinrate,
  fetchDrawdown,
  fetchTotalTradingVolume,
  fetchStablecoinRatio,
  // Aliases for convenience
  getBalance: fetchBalanceTrend,
  getDistribution: fetchAssetDistribution,
  getPnL: fetchPnLChart,
  getTransactionDistribution: fetchTransactionDistribution,
  getTradingVolumeDistribution: fetchTradingVolumeDistribution,
  getTradingVolumePerTransaction: fetchTradingVolumePerTransaction,
  getRollingAnualReturn: fetchRollingAnnualReturn,
  getWinrate: fetchWinrate,
  getDrawdown: fetchDrawdown,
  getTotalTradingVolume: fetchTotalTradingVolume,
  getStablecoinRatio: fetchStablecoinRatio,
};
