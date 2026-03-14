/**
 * Wallet API Service
 * 
 * Provides functions to fetch wallet data from backend API endpoints.
 * Types are automatically inferred from the backend Hono routes via RPC client.
 * 
 * @module services/wallet/walletApi
 */

import client from '@/api/main';

/**
 * Utility type to extract the inferred response type from a fetcher function
 */
export type InferFetcherData<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

/**
 * Helper to handle API response with error checking
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
      }
    } catch (e) {
      console.error('[walletApi] Failed to parse error response:', e);
    }
    const error = new Error(errorMessage);
    console.error('[walletApi] Request failed:', { status: response.status, error });
    throw error;
  }
}

/**
 * Fetch wallet overview data
 * GET /api/wallets/overview
 */
export async function fetchWalletOverview(
  address: string,
  chain?: string,
  period?: string,
) {
  const query = {
    address,
    ...(chain && { chain }),
    ...(period && { period }),
  };
  const response = await (client.api as any).wallets.overview.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet portfolio data
 * GET /api/wallets/portfolio
 */
export async function fetchWalletPortfolio(
  address: string,
  chain?: string
) {
  const query = { address, ...(chain && { chain }) };
  const response = await (client.api as any).wallets.portfolio.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet transactions
 * GET /api/wallets/transactions
 */
export async function fetchWalletTransactions(
  address: string,
  params?: {
    chain?: string;
    limit?: number;
    cursor?: string;
    before?: string;
  }
) {
  const query = { address, ...params };
  const response = await (client.api as any).wallets.transactions.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet transfers
 * GET /api/wallets/transfers
 */
export async function fetchWalletTransfers(
  address: string,
  params?: {
    chain?: string;
    limit?: number;
    cursor?: string;
    before?: string;
  }
) {
  const query = { address, ...params };
  const response = await (client.api as any).wallets.transfers.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet swaps
 * GET /api/wallets/swap
 */
export async function fetchWalletSwaps(
  address: string,
  params?: {
    chain?: string;
    limit?: number;
    cursor?: string;
  }
) {
  const query = { address, ...params };
  const response = await (client.api as any).wallets.swap.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet exchange counts
 * GET /api/wallets/exchanges
 */
export async function fetchWalletExchanges(
  address: string,
  params?: {
    chain?: string;
    limit?: number;
  }
) {
  const query = { address, ...params };
  const response = await (client.api as any).wallets.exchanges.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet balances
 * GET /api/balances
 */
export async function fetchWalletBalances(address: string) {
  const response = await (client.api as any).balances.$get({
    query: { address },
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet asset distribution
 * GET /api/wallets/distribution
 */
export async function fetchWalletDistribution(
  address: string,
  chain?: string
) {
  const query = { address, ...(chain && { chain }) };
  const response = await (client.api as any).wallets.distribution.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

export const walletApi = {
  fetchWalletOverview,
  fetchWalletPortfolio,
  fetchWalletTransactions,
  fetchWalletTransfers,
  fetchWalletSwaps,
  fetchWalletExchanges,
  fetchWalletBalances,
  fetchWalletDistribution,
  // Aliases for convenience
  getOverview: fetchWalletOverview,
  getPortfolio: fetchWalletPortfolio,
  getTransactions: fetchWalletTransactions,
  getTransfers: fetchWalletTransfers,
  getSwaps: fetchWalletSwaps,
  getExchanges: fetchWalletExchanges,
  getBalances: fetchWalletBalances,
  getDistribution: fetchWalletDistribution,
};
