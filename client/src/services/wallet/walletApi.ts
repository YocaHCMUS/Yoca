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
export type InferFetcherData<T extends (...args: unknown[]) => Promise<unknown>> = Awaited<ReturnType<T>>;

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

export interface WalletSwapBalanceChange {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string | null;
  name?: string | null;
  logoUri?: string | null;
  priceUsd?: number | null;
  valueUsd?: number | null;
}

export interface WalletSwapExchange {
  name?: string | null;
  address?: string | null;
  logo?: string | null;
}

export interface WalletSwapPair {
  address?: string | null;
  label?: string | null;
  baseTokenAddress?: string | null;
  quoteTokenAddress?: string | null;
}

export interface WalletSwap {
  transactionHash: string,
  transactionType: string,
  blockTimestampIso: string,

  subcategory: string | null,

  walletAddress: string,
  pairAddress: string,

  tokensInvolved: string,
  exchangeAddress: string,
  exchangeName: string,
  exchangeLogo: string,

  bought: WalletSwapTokenChange,
  sold: WalletSwapTokenChange,

  totalValueUsd: number | null;
  baseQuotePrice: number | null;
}

export interface WalletSwapTokenChange {
  address: string;
  amount: number;
  symbol: string | null;
  name: string | null;
  logoUri: string | null;
  priceUsd: number;
  valueUsd: number;
}


export interface WalletSwapTokenInfo {
  address: string;
  amount: number;
  symbol: string | null;
  name: string | null;
  logoUri: string | null;
  priceUsd: number;
  valueUsd: number;
}

export interface WalletPageInfo {
  pageSize: 100;
  hasMore: boolean;
  nextCursor: string | null;
  source: "cache" | "provider" | "mixed";
}

// export interface WalletSwapsResponse {
//   address: string;
//   chain?: string;
//   swaps: WalletSwap[];
//   pageInfo: WalletPageInfo;
// }

export interface WalletSwapsResponse {
  address: string;
  swaps: WalletSwap[];
  pageInfo: WalletPageInfo;
}
export interface WalletTransfer {
  from: string;
  to: string;
  amount: number;
  amountUsd?: number;
  timestamp: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  tokenLogoUri?: string;
  priceUsd?: number;
  transactionSignature: string;
  instructionIndex: number;
}

export interface WalletTransfersResponse {
  address: string;
  chain?: string;
  transfers: WalletTransfer[];
  pageInfo: WalletPageInfo;
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

export interface WalletFirstFundInsight {
  targetAddress: string;
  funderAddress: string | null;
  funderName: string | null;
  funderType: string | null;
  funderLabel: string | null;
  firstFundDate: string | null;
  firstFundTimestampSec: number | null;
  walletAgeDays: number | null;
  walletAgeLabel: string | null;
  signature: string | null;
}

export interface WalletIdentityAnalysis {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  signals: string[];
  counterpartyProfile: {
    exchangeInteractions24h: number;
    uniqueKnownEntities7d: number;
  };
  firstFund: WalletFirstFundInsight | null;
  userTags?: string[];
}

export interface WalletIdentityNormalized {
  status: "known" | "unknown" | "unavailable";
  type: string | null;
  name: string | null;
  category: string | null;
  tags: string[];
  domainNames: string[];
  provider: "helius";
  providerVersion: "wallet-api-beta";
  resolvedAt: string;
}

export interface WalletIdentityProviderMetadata {
  statusCode?: number;
  errorCode?: string;
}

export interface WalletIntelligenceResponse {
  address: string;
  identity: WalletIdentityNormalized;
  analysis: WalletIdentityAnalysis;
  metadata: {
    cache: {
      identityHit: boolean;
      analysisHit: boolean;
      ttlSec: number;
      staleIdentity: boolean;
    };
    provider: WalletIdentityProviderMetadata;
  };
}

export type WalletAiAnalysisLanguage = "en" | "vn";

export interface WalletAiReferenceEntry {
  ref_id: number;
  type: "wallet" | "exchange" | "token";
  address?: string;
  name?: string;
  symbol?: string;
  logoUri?: string;
}

export interface WalletAiAnalysisResponse {
  wallet_address: string;
  version?: string;
  data: {
    swaps: "ok" | "insufficient_data";
    portfolio: "ok" | "insufficient_data";
    first_funder: "ok" | "insufficient_data";
    identity: "ok" | "insufficient_data";
  };
  activity_profile: {
    archetype: string;
    activity_level: "dormant" | "low" | "moderate" | "high";
    last_active: string;
  };
  interaction_fingerprint: {
    preferred_protocols: string[];
    transaction_timing: "uniform" | "burst_mode" | "sporadic";
    preffered_trading_tokens: string[];
    preffered_holding_tokens: string[];
    trading_volume_range: string;
  };
  funder: {
    type: string;
    notes: string;
  };
  wallet_age: {
    category: "new" | "mid" | "old" | "unknown";
    first_seen: string;
    consistency: string;
  };
  summary: string;
  signals: string[];
  reference?: WalletAiReferenceEntry[];
}

export type WalletOverviewPeriodKey = "24H" | "7D" | "30D" | "90D" | "All";

export interface WalletOverviewPeriodStats {
  tradingVolumeUsd: number | null;
  buy: {
    transactionCount: number | null;
    volumeUsd: number | null;
  };
  sell: {
    transactionCount: number | null;
    volumeUsd: number | null;
  };
  tokensTradedCount: number | null;
  transactionCount: number | null;
  pnl: {
    totalUsd: number | null;
    realizedUsd: number | null;
    unrealizedUsd: number | null;
  };
  source: "birdeye-overall-pnl" | "overview-cache" | "none";
}

export interface WalletOverviewHoldingsStats {
  totalAssetValueUsd: number;
  change24hPercent: number | null;
  tokensHoldingCount: number;
  source: "birdeye-portfolio" | "helius-portfolio-fallback" | "overview-cache" | "none";
}

export interface WalletOverviewMultiPeriodResponse {
  address: string;
  availablePeriods: WalletOverviewPeriodKey[];
  selectedPeriod: WalletOverviewPeriodKey;
  holdings: WalletOverviewHoldingsStats;
  periods: Record<WalletOverviewPeriodKey, WalletOverviewPeriodStats>;
  legacy: {
    totalAssetValueUsd: number;
    tradingVolumeUsd24h: number | null;
    pnlUsdTotal: number | null;
    transactionCount24h: number | null;
    tokensTradedCount: number | null;
    tokensHoldingCount: number;
    metricsPeriod: string;
  };
  // Legacy top-level fields during migration window.
  totalAssetValueUsd: number;
  tradingVolumeUsd24h: number | null;
  pnlUsdTotal: number | null;
  transactionCount24h: number | null;
  tokensTradedCount: number | null;
  tokensHoldingCount: number;
  tradingVolumeUsdWindow?: number | null;
  pnlUsdWindow?: number | null;
  metricsPeriod?: string;
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
): Promise<WalletOverviewMultiPeriodResponse> {
  const query = {
    address,
    ...(chain && { chain }),
  };
  const response = await client.api.wallets.overview.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletOverviewMultiPeriodResponse;
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
  const response = await client.api.wallets.portfolio.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletPortfolioItem[];
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
): Promise<WalletTransfersResponse> {
  const query = { address, ...params };
  const response = await client.api.wallets.transfers.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletTransfersResponse;
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
    before?: string;
  }
): Promise<WalletSwapsResponse> {
  const query = { address, ...params };
  const response = await client.api.wallets.swap.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletSwapsResponse;
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

  const response = await client.api.wallets.counterparties.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletCounterpartiesResponse;
}

/**
 * Fetch wallet exchange counts
 * GET /api/wallets/exchanges
 */
export async function fetchWalletExchanges(
  address: string,
  params?: {
    chain?: string;
    period?: string;
    limit?: number;
    metric?: "count" | "volume";
  }
) {
  const query = { address, ...params };
  const response = await client.api.wallets.exchanges.$get({
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
  const response = await client.api.balances[":address"].$get({
    param: { address },
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
  const response = await client.api.wallets.distribution.$get({
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
  const response = await client.api.wallets.identity.$get({
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
  const response = await client.api.wallets.identity.batch.$post({
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
): Promise<WalletIntelligenceResponse> {
  const query = { address, ...(chain && { chain }) };
  const response = await client.api.wallets.intelligence.$get({
    query,
  });
  await handleResponse(response);
  const data = await response.json();
  return data as WalletIntelligenceResponse;
}

/**
 * Fetch wallet AI analysis
 * POST /api/wallets/ai-analysis
 */
export async function fetchWalletAiAnalysis(
  address: string,
  language: WalletAiAnalysisLanguage,
): Promise<WalletAiAnalysisResponse> {
  const response = await client.api.wallets["ai-analysis"].$post({
    json: { address, language },
  });

  if (!response.ok) {
    let message = `Failed to fetch wallet AI analysis (${response.status})`;

    try {
      const errorData = await response.json() as {
        error?: string;
        message?: string;
        code?: string;
        details?: {
          missingDependencies?: string[];
        };
      };

      if (
        errorData?.code === "dependency_not_ready" &&
        Array.isArray(errorData.details?.missingDependencies)
      ) {
        const missing = errorData.details.missingDependencies.join(", ");
        message =
          missing.length > 0
            ? `AI analysis dependencies are not ready: ${missing}`
            : "AI analysis dependencies are not ready";
      } else if (typeof errorData?.message === "string" && errorData.message.trim()) {
        message = errorData.message;
      } else if (typeof errorData?.error === "string" && errorData.error.trim()) {
        message = errorData.error;
      }
    } catch (e) {
      console.error("[walletApi] Failed to parse AI analysis error response:", e);
    }

    throw new Error(message);
  }

  const data = await response.json();
  return data as WalletAiAnalysisResponse;
}

export const walletApi = {
  fetchWalletOverview,
  fetchWalletPortfolio,
  fetchWalletTransfers,
  fetchWalletSwaps,
  fetchWalletCounterparties,
  fetchWalletExchanges,
  fetchWalletBalances,
  fetchWalletDistribution,
  fetchWalletIdentity,
  fetchWalletIdentityBatch,
  fetchWalletIntelligence,
  fetchWalletAiAnalysis,
  // Aliases for convenience
  getOverview: fetchWalletOverview,
  getPortfolio: fetchWalletPortfolio,
  getTransfers: fetchWalletTransfers,
  getSwaps: fetchWalletSwaps,
  getCounterparties: fetchWalletCounterparties,
  getExchanges: fetchWalletExchanges,
  getBalances: fetchWalletBalances,
  getDistribution: fetchWalletDistribution,
  getIdentity: fetchWalletIdentity,
  getIdentityBatch: fetchWalletIdentityBatch,
  getIntelligence: fetchWalletIntelligence,
  getAiAnalysis: fetchWalletAiAnalysis,
};
