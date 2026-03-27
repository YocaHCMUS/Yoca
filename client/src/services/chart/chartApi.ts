/**
 * Chart API Service
 * 
 * Provides functions to fetch chart data from backend API endpoints.
 * Types are automatically inferred from the backend Hono routes via RPC client.
 * NO manual type annotations needed - Hono handles type inference automatically.
 * 
 * @module chartApi
 */

import client from '@/api/main';

/**
 * Utility type to extract the inferred response type from a fetcher function
 * This allows components to get proper typing without manual type annotations
 * 
 * @example
 * type AssetDistData = InferFetcherData<typeof fetchAssetDistribution>;
 */
export type InferFetcherData<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

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
      console.error('[chartApi] Failed to parse error response:', e);
    }
    const error = new Error(errorMessage);
    console.error('[chartApi] Request failed:', { status: response.status, error });
    throw error;
  }
}


/**
 * Fetch balance trend data
 * GET /api/charts/balance
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchBalanceTrend(params?: Parameters<typeof client.api.charts.balance.$get>[0]) {
  // Hono RPC client requires wrapping query params in { query: {...} }
  const honoParams = params ? { query: params } : undefined;

  const response = await client.api.charts.balance.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch asset distribution data
 * GET /api/charts/distribution
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchAssetDistribution(params?: Parameters<typeof client.api.charts.distribution.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.distribution.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch exchange comparison data
 * GET /api/charts/exchanges
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchExchangeComparison(params?: Parameters<typeof client.api.charts.exchanges.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.exchanges.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch counterparty activity data
 * GET /api/charts/counterparties
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchCounterpartyActivity(params?: Parameters<typeof client.api.charts.counterparties.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.counterparties.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch P&L chart data
 * GET /api/charts/pnl
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchPnLChart(params?: Parameters<typeof client.api.charts.pnl.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.pnl.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch transaction distribution data
 * GET /api/charts/transactions
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTransactionDistribution(params?: Parameters<typeof client.api.charts.transactions.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.transactions.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch holding durations data
 * GET /api/charts/holdings
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchHoldingDurations(params?: Parameters<typeof client.api.charts.holdings.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.holdings.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch volume benchmark data
 * GET /api/charts/volume
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchVolumeBenchmark(params?: Parameters<typeof client.api.charts.volume.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.volume.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch price history data
 * GET /api/charts/price-history
 */
// export async function fetchPriceHistory(params?: PriceHistoryRequestParams): Promise<PriceHistoryResponse> {
//   return fetchAPI<PriceHistoryResponse>('/price-history', params);
// }

/**
 * Fetch trading volume distribution data
 * GET /api/charts/trading-volume-distribution
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTradingVolumeDistribution(params?: Parameters<typeof client.api.charts.tradingVolumeDistribution.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.tradingVolumeDistribution.$get(honoParams as any);
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

  return { wallets, metadata: { currency: 'USD', timestamp: Date.now() } } as any;
}


/**
 * Fetch trading volume per transaction data
 * GET /api/charts/trading-volume-per-transaction
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTradingVolumePerTransaction(params?: Parameters<typeof client.api.charts.tradingVolumePerTransaction.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.tradingVolumePerTransaction.$get(honoParams as any);
  await handleResponse(response);
  const raw = await response.json();

  return { wallets: raw, metadata: { currency: 'USD', timestamp: Date.now() } } as any;
}

/**
 * Fetch rolling annual return data
 * GET /api/charts/rolling-annual-return
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchRollingAnnualReturn(params?: Parameters<typeof client.api.charts.rollingAnnualReturn.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.rollingAnnualReturn.$get(honoParams as any);
  await handleResponse(response);
  const raw = await response.json();

  // Backend returns array of { wallet, rollingAnnualReturns } or aggregated object
  if (Array.isArray(raw)) {
    const wallets = raw.map((r: any) => {
      const totalUsd = r.rollingAnnualReturns.totalUsd;
      const realizedUsd = r.rollingAnnualReturns.realizedUsd;
      const unrealizedUsd = r.rollingAnnualReturns.unrealizedUsd;

      return {
        walletAddress: r.wallet ?? r.walletAddress ?? '',
        totalUsd,
        realizedUsd,
        unrealizedUsd,
      };
    });
    return { wallets, metadata: { timestamp: Date.now() } } as any;
  }
}

/**
 * Fetch average rolling annual return data
 * GET /api/charts/average-rolling-annual-return
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchAverageRollingAnnualReturn(params?: Parameters<typeof client.api.charts.averageRollingAnnualReturn.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.averageRollingAnnualReturn.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch winrate data
 * GET /api/charts/winrate
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchWinrate(params?: Parameters<typeof client.api.charts.winrate.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.winrate.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch drawdown data
 * GET /api/charts/drawdown
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchDrawdown(params?: Parameters<typeof client.api.charts.drawdown.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.drawdown.$get(honoParams as any);
  await handleResponse(response);
  const raw = await response.json();
  if (!Array.isArray(raw) && raw.error) {
    throw new Error(`API error: ${raw.error}`);
  }

  return { wallets: raw, metadata: { timestamp: Date.now() } };
}

/**
 * Fetch total trading volume data
 * GET /api/charts/total-trading-volume
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchTotalTradingVolume(params?: Parameters<typeof client.api.charts.totalTradingVolume.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.totalTradingVolume.$get(honoParams as any);
  await handleResponse(response);
  const raw = await response.json();

  return { wallets: raw, metadata: { currency: 'USD', timestamp: Date.now() } };
}

/**
 * Fetch daily trading volume data
 * GET /api/charts/dailyTradingVolume
 */
export async function fetchDailyTradingVolume(params?: Parameters<typeof client.api.charts.dailyTradingVolume.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.dailyTradingVolume.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch stablecoin ratio data
 * GET /api/charts/stablecoin-ratio
 * Type automatically inferred from server route via Hono RPC
 */
export async function fetchStablecoinRatio(params?: Parameters<typeof client.api.charts.stablecoinRatio.$get>[0]) {
  const honoParams = params ? { query: params } : undefined;
  const response = await client.api.charts.stablecoinRatio.$get(honoParams as any);
  await handleResponse(response);
  const data = await response.json();
  return data;
}

export const chartApi = {
  fetchBalanceTrend,
  fetchAssetDistribution,
  fetchExchangeComparison,
  fetchCounterpartyActivity,
  fetchPnLChart,
  fetchTransactionDistribution,
  fetchHoldingDurations,
  fetchVolumeBenchmark,
  // fetchPriceHistory,
  fetchTradingVolumeDistribution,
  fetchTradingVolumePerTransaction,
  fetchRollingAnnualReturn,
  fetchAverageRollingAnnualReturn,
  fetchWinrate,
  fetchDrawdown,
  fetchTotalTradingVolume,
  fetchStablecoinRatio,
  // Aliases for convenience
  getBalance: fetchBalanceTrend,
  getDistribution: fetchAssetDistribution,
  getExchanges: fetchExchangeComparison,
  getCounterparties: fetchCounterpartyActivity,
  getPnL: fetchPnLChart,
  getTransactionDistribution: fetchTransactionDistribution,
  getHoldings: fetchHoldingDurations,
  getVolumeBenchmark: fetchVolumeBenchmark,
  // getPriceHistory: fetchPriceHistory,
  getTradingVolumeDistribution: fetchTradingVolumeDistribution,
  getTradingVolumePerTransaction: fetchTradingVolumePerTransaction,
  getRollingAnualReturn: fetchRollingAnnualReturn,
  getAverageRollingAnnualReturn: fetchAverageRollingAnnualReturn,
  getWinrate: fetchWinrate,
  getDrawdown: fetchDrawdown,
  getTotalTradingVolume: fetchTotalTradingVolume,
  getStablecoinRatio: fetchStablecoinRatio,
};
