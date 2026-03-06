export type SupportedChain = "solana" | "eth" | "polygon" | "bsc" | string;

export interface WalletOverview {
  address: string;
  chain: SupportedChain;
  totalAssetValueUsd: number;
  tradingVolumeUsd24h: number | null;
  pnlUsdTotal: number | null;
  transactionCount24h: number | null;
  tokensTradedCount: number | null;
  tokensHoldingCount: number;
}

export interface WalletPortfolioItem {
  tokenAddress: string;
  symbol: string;
  name?: string;
  amount: number;
  priceUsd?: number;
  valueUsd: number;
  change24hPercent?: number;
}


export interface WalletTransaction {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  status: boolean | null;
  fee?: number;
  mainAction?: string;
  direction?: "in" | "out" | "self" | "unknown";
  tokens?: string[];
  primaryTokenSymbol?: string;
  primaryTokenAmount?: number;
  primaryTokenAddress?: string;
  priceUsd?: number;
  totalUsd?: number;
}

export interface WalletTransactionsResponse {
  address: string;
  chain: SupportedChain;
  transactions: WalletTransaction[];
}

/** Exchange comparison item for chart (transaction count by platform). */
export interface WalletExchangeCountItem {
  name: string;
  deposits: number;
  withdrawals: number;
  depositsVolume: number;
  withdrawalsVolume: number;
}

export interface WalletExchangeCountsResponse {
  exchanges: WalletExchangeCountItem[];
  metadata: { period: string; metric: "count" | "volume" };
}