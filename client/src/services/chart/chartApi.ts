/**
 * Chart API Service
 * 
 * Provides functions to fetch chart data from backend API endpoints.
 * Types are automatically inferred from the backend Hono routes via RPC client.
 * 
 * @module chartApi
 */

import client from '@/api/main';

// /**
//  * Convert params object to URL search params
//  */
// function buildQueryString(params: Record<string, string | number | undefined>): string {
//   const searchParams = new URLSearchParams();
  
//   Object.entries(params).forEach(([key, value]) => {
//     if (value !== undefined) {
//       searchParams.append(key, String(value));
//     }
//   });
  
//   return searchParams.toString();
// }

// /**
//  * Generic fetch wrapper with error handling
//  */
// async function fetchAPI<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
//   const queryString = params ? `?${buildQueryString(params)}` : '';
//   const url = `${API_BASE_URL}${endpoint}${queryString}`;
  
//   try {
//     const response = await fetch(url);
    
//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({}));
//       throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
//     }
    
//     return await response.json();
//   } catch (error) {
//     if (error instanceof Error) {
//       throw error;
//     }
//     throw new Error('Unknown API error');
//   }
// }
/**
 * Reusable response processor
 * Handles success and error responses from the Hono API
 * Follows the same pattern as useGet hook
 */
async function processResponse(response: any) {
  // Success response - return data directly
  if (response.status === 200) {
    return response.json();
  }
  
  // For error responses, try to get error details
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
    // Failed to parse error response, use generic message
    console.error('[chartApi] Failed to parse error response:', e);
  }
  
  const error = new Error(errorMessage);
  console.error('[chartApi] Request failed:', { status: response.status, error });
  throw error;
}


/**
 * Fetch balance trend data
 * GET /api/charts/balance
 */
export async function fetchBalanceTrend(params?: Parameters<typeof client.api.charts.balance.$get>[0]) {
  const response = await client.api.charts.balance.$get(params);
  return processResponse(response);
}

/**
 * Fetch asset distribution data
 * GET /api/charts/distribution
 */
export async function fetchAssetDistribution(params?: Parameters<typeof client.api.charts.distribution.$get>[0]) {
  const response = await client.api.charts.distribution.$get(params);
  return processResponse(response);
}

/**
 * Fetch exchange comparison data
 * GET /api/charts/exchanges
 */
export async function fetchExchangeComparison(params?: Parameters<typeof client.api.charts.exchanges.$get>[0]) {
  const response = await client.api.charts.exchanges.$get(params);
  return processResponse(response);
}

/**
 * Fetch counterparty activity data
 * GET /api/charts/counterparties
 */
export async function fetchCounterpartyActivity(params?: Parameters<typeof client.api.charts.counterparties.$get>[0]) {
  const response = await client.api.charts.counterparties.$get(params);
  return processResponse(response);
}

/**
 * Fetch P&L chart data
 * GET /api/charts/pnl
 */
export async function fetchPnLChart(params?: Parameters<typeof client.api.charts.pnl.$get>[0]) {
  const response = await client.api.charts.pnl.$get(params);
  return processResponse(response);
}

/**
 * Fetch transaction distribution data
 * GET /api/charts/transactions
 */
export async function fetchTransactionDistribution(params?: Parameters<typeof client.api.charts.transactions.$get>[0]) {
  const response = await client.api.charts.transactions.$get(params);
  return processResponse(response);
}

/**
 * Fetch holding durations data
 * GET /api/charts/holdings
 */
export async function fetchHoldingDurations(params?: Parameters<typeof client.api.charts.holdings.$get>[0]) {
  const response = await client.api.charts.holdings.$get(params);
  return processResponse(response);
}

/**
 * Fetch volume benchmark data
 * GET /api/charts/volume
 */
export async function fetchVolumeBenchmark(params?: Parameters<typeof client.api.charts.volume.$get>[0]) {
  const response = await client.api.charts.volume.$get(params);
  return processResponse(response);
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
 */
export async function fetchTradingVolumeDistribution(params?: Parameters<typeof client.api.charts.tradingVolumeDistribution.$get>[0]) {
  const response = await client.api.charts.tradingVolumeDistribution.$get(params);
  return processResponse(response);
}


/**
 * Fetch trading volume per transaction data
 * GET /api/charts/trading-volume-per-transaction
 */
export async function fetchTradingVolumePerTransaction(params?:  Parameters<typeof client.api.charts.tradingVolumePerTransaction.$get>[0]) {
  const response = await client.api.charts.tradingVolumePerTransaction.$get(params);
  return processResponse(response);
}

/**
 * Fetch rolling annual return data
 * GET /api/charts/rolling-annual-return
 */
export async function fetchRollingAnnualReturn(params?: Parameters<typeof client.api.charts.rollingAnnualReturn.$get>[0]) {
  const response = await client.api.charts.rollingAnnualReturn.$get(params);
  return processResponse(response);
}

/**
 * Fetch average rolling annual return data
 * GET /api/charts/average-rolling-annual-return
 */
export async function fetchAverageRollingAnnualReturn(params?: Parameters<typeof client.api.charts.averageRollingAnnualReturn.$get>[0]) {
  const response = await client.api.charts.averageRollingAnnualReturn.$get(params);
  return processResponse(response);
}

/**
 * Fetch winrate data
 * GET /api/charts/winrate
 */
export async function fetchWinrate(params?: Parameters<typeof client.api.charts.winrate.$get>[0]) {
  const response = await client.api.charts.winrate.$get(params);
  return processResponse(response);
}

/**
 * Fetch drawdown data
 * GET /api/charts/drawdown
 */
export async function fetchDrawdown(params?: Parameters<typeof client.api.charts.drawdown.$get>[0]) {
  const response = await client.api.charts.drawdown.$get(params);
  return processResponse(response);
}

/**
 * Fetch total trading volume data
 * GET /api/charts/total-trading-volume
 */
export async function fetchTotalTradingVolume(params?: Parameters<typeof client.api.charts.totalTradingVolume.$get>[0]) {
  const response = await client.api.charts.totalTradingVolume.$get(params);
  return processResponse(response);
}

/**
 * Fetch stablecoin ratio data
 * GET /api/charts/stablecoin-ratio
 */
export async function fetchStablecoinRatio(params?: Parameters<typeof client.api.charts.stablecoinRatio.$get>[0]) {
  const response = await client.api.charts.stablecoinRatio.$get(params);
  return processResponse(response);
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
