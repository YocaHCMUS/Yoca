/**
 * Chart API Service
 * 
 * Provides functions to fetch chart data from backend API endpoints.
 * 
 * @module chartApi
 */

import type {
  BalanceTrendResponse,
  AssetDistributionResponse,
  ExchangeComparisonResponse,
  CounterpartyActivityResponse,
  PnLChartResponse,
  TransactionDistributionResponse,
  HoldingDurationsResponse,
  VolumeBenchmarkResponse,
  PriceHistoryResponse,
  TradingVolumeDistributionResponse,
  TradingVolumePerTransactionResponse,
  RollingAnnualReturnResponse,
  AverageRollingAnnualReturnResponse,
  WinrateResponse,
  DrawdownResponse,
  TotalTradingVolumeResponse,
  StablecoinRatioResponse,
  BalanceRequestParams,
  DistributionRequestParams,
  ExchangesRequestParams,
  CounterpartiesRequestParams,
  PnLRequestParams,
  TransactionDistributionRequestParams,
  HoldingsRequestParams,
  VolumeBenchmarkRequestParams,
  PriceHistoryRequestParams,
  TradingVolumeDistributionRequestParams,
  TradingVolumePerTransactionRequestParams,
  RollingAnnualReturnRequestParams,
  AverageRollingAnnualReturnRequestParams,
  WinrateRequestParams,
  DrawdownRequestParams,
  TotalTradingVolumeRequestParams,
  StablecoinRatioRequestParams,
} from '../../types/chart-api.types';

/**
 * Base API URL
 */
const API_BASE_URL = '/api/charts';

/**
 * Convert params object to URL search params
 */
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const queryString = params ? `?${buildQueryString(params)}` : '';
  const url = `${API_BASE_URL}${endpoint}${queryString}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown API error');
  }
}

/**
 * Fetch balance trend data
 * GET /api/charts/balance
 */
export async function fetchBalanceTrend(params?: BalanceRequestParams): Promise<BalanceTrendResponse> {
  return fetchAPI<BalanceTrendResponse>('/balance', params);
}

/**
 * Fetch asset distribution data
 * GET /api/charts/distribution
 */
export async function fetchAssetDistribution(params?: DistributionRequestParams): Promise<AssetDistributionResponse> {
  return fetchAPI<AssetDistributionResponse>('/distribution', params);
}

/**
 * Fetch exchange comparison data
 * GET /api/charts/exchanges
 */
export async function fetchExchangeComparison(params?: ExchangesRequestParams): Promise<ExchangeComparisonResponse> {
  return fetchAPI<ExchangeComparisonResponse>('/exchanges', params);
}

/**
 * Fetch counterparty activity data
 * GET /api/charts/counterparties
 */
export async function fetchCounterpartyActivity(params?: CounterpartiesRequestParams): Promise<CounterpartyActivityResponse> {
  return fetchAPI<CounterpartyActivityResponse>('/counterparties', params);
}

/**
 * Fetch P&L chart data
 * GET /api/charts/pnl
 */
export async function fetchPnLChart(params?: PnLRequestParams): Promise<PnLChartResponse> {
  return fetchAPI<PnLChartResponse>('/pnl', params);
}

/**
 * Fetch transaction distribution data
 * GET /api/charts/transactions
 */
export async function fetchTransactionDistribution(params?: TransactionDistributionRequestParams): Promise<TransactionDistributionResponse> {
  return fetchAPI<TransactionDistributionResponse>('/transactions', params);
}

/**
 * Fetch holding durations data
 * GET /api/charts/holdings
 */
export async function fetchHoldingDurations(params?: HoldingsRequestParams): Promise<HoldingDurationsResponse> {
  return fetchAPI<HoldingDurationsResponse>('/holdings', params);
}

/**
 * Fetch volume benchmark data
 * GET /api/charts/volume
 */
export async function fetchVolumeBenchmark(params?: VolumeBenchmarkRequestParams): Promise<VolumeBenchmarkResponse> {
  return fetchAPI<VolumeBenchmarkResponse>('/volume', params);
}

/**
 * Fetch price history data
 * GET /api/charts/price-history
 */
export async function fetchPriceHistory(params?: PriceHistoryRequestParams): Promise<PriceHistoryResponse> {
  return fetchAPI<PriceHistoryResponse>('/price-history', params);
}

/**
 * Fetch trading volume distribution data
 * GET /api/charts/trading-volume-distribution
 */
export async function fetchTradingVolumeDistribution(params?: TradingVolumeDistributionRequestParams): Promise<TradingVolumeDistributionResponse> {
  return fetchAPI<TradingVolumeDistributionResponse>('/trading-volume-distribution', params);
}

/**
 * Fetch trading volume per transaction data
 * GET /api/charts/trading-volume-per-transaction
 */
export async function fetchTradingVolumePerTransaction(params?: TradingVolumePerTransactionRequestParams): Promise<TradingVolumePerTransactionResponse> {
  return fetchAPI<TradingVolumePerTransactionResponse>('/trading-volume-per-transaction', params);
}

/**
 * Fetch rolling annual return data
 * GET /api/charts/rolling-annual-return
 */
export async function fetchRollingAnnualReturn(params?: RollingAnnualReturnRequestParams): Promise<RollingAnnualReturnResponse> {
  return fetchAPI<RollingAnnualReturnResponse>('/rolling-annual-return', params);
}

/**
 * Fetch average rolling annual return data
 * GET /api/charts/average-rolling-annual-return
 */
export async function fetchAverageRollingAnnualReturn(params?: AverageRollingAnnualReturnRequestParams): Promise<AverageRollingAnnualReturnResponse> {
  return fetchAPI<AverageRollingAnnualReturnResponse>('/average-rolling-annual-return', params);
}

/**
 * Fetch winrate data
 * GET /api/charts/winrate
 */
export async function fetchWinrate(params?: WinrateRequestParams): Promise<WinrateResponse> {
  return fetchAPI<WinrateResponse>('/winrate', params);
}

/**
 * Fetch drawdown data
 * GET /api/charts/drawdown
 */
export async function fetchDrawdown(params?: DrawdownRequestParams): Promise<DrawdownResponse> {
  return fetchAPI<DrawdownResponse>('/drawdown', params);
}

/**
 * Fetch total trading volume data
 * GET /api/charts/total-trading-volume
 */
export async function fetchTotalTradingVolume(params?: TotalTradingVolumeRequestParams): Promise<TotalTradingVolumeResponse> {
  return fetchAPI<TotalTradingVolumeResponse>('/total-trading-volume', params);
}

/**
 * Fetch stablecoin ratio data
 * GET /api/charts/stablecoin-ratio
 */
export async function fetchStablecoinRatio(params?: StablecoinRatioRequestParams): Promise<StablecoinRatioResponse> {
  return fetchAPI<StablecoinRatioResponse>('/stablecoin-ratio', params);
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
  fetchPriceHistory,
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
  getPriceHistory: fetchPriceHistory,
  getTradingVolumeDistribution: fetchTradingVolumeDistribution,
  getTradingVolumePerTransaction: fetchTradingVolumePerTransaction,
  getRollingAnualReturn: fetchRollingAnnualReturn,
  getAverageRollingAnnualReturn: fetchAverageRollingAnnualReturn,
  getWinrate: fetchWinrate,
  getDrawdown: fetchDrawdown,
  getTotalTradingVolume: fetchTotalTradingVolume,
  getStablecoinRatio: fetchStablecoinRatio,
};
