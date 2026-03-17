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
 * Wallet portfolio token item returned by the /wallets/portfolio endpoint.
 * All additive metadata fields are optional to allow graceful degradation
 * when enrichment data is partially unavailable.
 */
export interface WalletPortfolioItem {
  tokenAddress: string;
  symbol: string;
  name?: string;
  logoUri?: string;
  amount: number;
  priceUsd?: number;
  valueUsd: number;
  change24hPercent?: number;
}

export interface WalletCounterpartyIdentity {
  status: "known" | "unknown" | "unavailable";
  name: string | null;
  category: string | null;
  type: string | null;
}

export interface WalletCounterpartyRow {
  address: string;
  identity: WalletCounterpartyIdentity;
  uniqueTokenCount: number;
  tokens: string[];
  transactionCount: number;
  totalVolumeUsd: number;
}

export interface WalletCounterpartyRankingItem {
  address: string;
  label: string;
  transactionCount: number;
  totalVolumeUsd: number;
}

export interface WalletCounterpartiesResponse {
  counterparties: WalletCounterpartyRow[];
  rankings: {
    byTransactionCount: WalletCounterpartyRankingItem[];
    byVolume: WalletCounterpartyRankingItem[];
  };
  metadata: {
    period: "24h" | "7d";
    chain: string;
    source: "cache" | "provider" | "mixed";
    totals: {
      counterparties: number;
      transactions: number;
      volume: number;
    };
  };
}

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
): Promise<WalletPortfolioItem[]> {
  const query = { address, ...(chain && { chain }) };
  const response = await (client.api as any).wallets.portfolio.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletPortfolioItem[];
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
 * Fetch wallet counterparties data
 * GET /api/wallets/counterparties
 */
export async function fetchWalletCounterparties(
  address: string,
  params?: {
    chain?: string;
    period?: "24h" | "7d";
    limit?: number;
    includeTokens?: boolean;
  }
): Promise<WalletCounterpartiesResponse> {
  const query = {
    address,
    ...(params?.chain && { chain: params.chain }),
    ...(params?.period && { period: params.period }),
    ...(params?.limit != null && { limit: params.limit }),
    ...(params?.includeTokens != null && { includeTokens: String(params.includeTokens) }),
  };

  const response = await (client.api as any).wallets.counterparties.$get({
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

/**
 * Fetch wallet identity data
 * GET /api/wallets/identity
 */
export async function fetchWalletIdentity(
  address: string,
  chain?: string,
) {
  const query = { address, ...(chain && { chain }) };
  const response = await (client.api as any).wallets.identity.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch wallet identity batch data
 * POST /api/wallets/identity/batch
 */
export async function fetchWalletIdentityBatch(
  addresses: string[],
  chain?: string,
) {
  const response = await (client.api as any).wallets.identity.batch.$post({
    json: {
      addresses,
      ...(chain && { chain }),
    },
  });
  await handleResponse(response);
  const data = await response.json();
  return data;
}

/**
 * Fetch composed wallet intelligence data
 * GET /api/wallets/intelligence
 */
export async function fetchWalletIntelligence(
  address: string,
  chain?: string,
) {
  const query = { address, ...(chain && { chain }) };
  const response = await (client.api as any).wallets.intelligence.$get({
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
  fetchWalletCounterparties,
  fetchWalletExchanges,
  fetchWalletBalances,
  fetchWalletDistribution,
  fetchWalletIdentity,
  fetchWalletIdentityBatch,
  fetchWalletIntelligence,
  // Aliases for convenience
  getOverview: fetchWalletOverview,
  getPortfolio: fetchWalletPortfolio,
  getTransactions: fetchWalletTransactions,
  getTransfers: fetchWalletTransfers,
  getSwaps: fetchWalletSwaps,
  getCounterparties: fetchWalletCounterparties,
  getExchanges: fetchWalletExchanges,
  getBalances: fetchWalletBalances,
  getDistribution: fetchWalletDistribution,
  getIdentity: fetchWalletIdentity,
  getIdentityBatch: fetchWalletIdentityBatch,
  getIntelligence: fetchWalletIntelligence,
};
