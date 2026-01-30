/**
 * Chart API Response Types
 * 
 * Defines TypeScript interfaces for API endpoint responses.
 * 
 * @module chart-api.types
 */

import type { TimeSeriesPoint, DistributionPoint } from './chart-data.types';

/**
 * Base interface for all responses
 */
export interface ChartResponseBase {
}

/**
 * Common API response metadata
 */
export interface ApiResponseMetadata extends ChartResponseBase {
  /** Display currency (e.g., 'USD') */
  currency?: string;
  
  /** Timezone used for timestamps */
  timezone?: string;
  
  /** Data aggregation granularity */
  aggregation?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  
  /** Response timestamp */
  timestamp?: number;
}

/**
 * Balance trend API response
 * GET /api/charts/balance
 */
export interface BalanceTrendResponse extends ChartResponseBase {
  /** Data series for each token or total */
  series: {
    /** Token symbol or "Total" */
    name: string;
    
    /** Time series data points */
    data: TimeSeriesPoint[];
  }[];
  
  /** Response metadata */
  metadata: ApiResponseMetadata & {
    currency: string;
    timezone: string;
    aggregation: string;
  };
}

/**
 * Asset distribution API response
 * GET /api/charts/distribution
 */
export interface AssetDistributionResponse extends ChartResponseBase {
  /** Distribution data points */
  data: (DistributionPoint & {
    /** Percentage of total (calculated) */
    percentage: number;
  })[];
  
  /** Total portfolio value */
  totalValue: number;
  
  /** Response metadata */
  metadata: {
    currency: string;
    timestamp: number;
  };
}

/**
 * Exchange comparison API response
 * GET /api/charts/exchanges
 */
export interface ExchangeComparisonResponse extends ChartResponseBase {
  /** Data for each exchange */
  exchanges: {
    /** Exchange name */
    name: string;
    
    /** Deposit count */
    deposits: number;
    
    /** Withdrawal count */
    withdrawals: number;
    
    /** Deposit volume in USD */
    depositsVolume: number;
    
    /** Withdrawal volume in USD */
    withdrawalsVolume: number;
  }[];
  
  /** Response metadata */
  metadata: {
    period: string;
    metric: 'count' | 'volume';
  };
}

/**
 * Counterparty activity API response
 * GET /api/charts/counterparties
 */
export interface CounterpartyActivityResponse extends ChartResponseBase {
  /** Data for each counterparty */
  counterparties: {
    /** Counterparty identifier (address or name) */
    id: string;
    
    /** Display name */
    name: string;
    
    /** Transaction count */
    transactionCount: number;
    
    /** Total volume */
    totalVolume: number;
  }[];
  
  /** Response metadata */
  metadata: {
    period: string;
    transactionType: string;
    limit?: number;
  };
}

/**
 * P&L chart API response
 * GET /api/charts/pnl
 */
export interface PnLChartResponse extends ChartResponseBase {
  /** Daily P&L data */
  dailyPnL: TimeSeriesPoint[];
  
  /** Cumulative P&L data */
  cumulativePnL: TimeSeriesPoint[];
  
  /** Response metadata */
  metadata: {
    currency: string;
    startBalance: number;
    endBalance: number;
  };
}

/**
 * Transaction distribution API response
 * GET /api/charts/transactions/distribution
 */
export interface TransactionDistributionResponse extends ChartResponseBase {
  /** Transaction count by wallet over time */
  transactionCounts: {
    /** Wallet identifier */
    walletId: string;
    
    /** Wallet display name */
    walletName: string;
    
    /** Time series data */
    data: TimeSeriesPoint[];
  }[];
  
  /** Unique token counts per day */
  uniqueTokenCounts: TimeSeriesPoint[];
  
  /** Response metadata */
  metadata: {
    period: string;
    transactionType: string;
  };
}

/**
 * Holding durations API response
 * GET /api/charts/holdings
 */
export interface HoldingDurationsResponse extends ChartResponseBase {
  /** Holdings data by wallet */
  wallets: {
    /** Wallet identifier */
    id: string;
    
    /** Wallet display name */
    name: string;
    
    /** Holdings data */
    holdings: {
      /** Token symbol */
      tokenSymbol: string;
      
      /** Holding duration in days */
      durationDays: number;
    }[];
  }[];
  
  /** Response metadata */
  metadata: {
    unit: 'days' | 'weeks' | 'months';
  };
}

/**
 * Volume benchmark API response
 * GET /api/charts/volume-benchmark
 */
export interface VolumeBenchmarkResponse extends ChartResponseBase {
  /** Volume data for each wallet */
  wallets: {
    /** Wallet identifier */
    id: string;
    
    /** Wallet display name */
    name: string;
    
    /** Time series data points with volume */
    dataPoints: {
      /** Timestamp in milliseconds */
      timestamp: number;
      
      /** Trading volume in USD */
      volume: number;
    }[];
  }[];
  
  /** Response metadata */
  metadata: {
    period: string;
    currency: string;
    timezone: string;
  };
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse extends ChartResponseBase {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Detailed error information */
  details?: unknown;
  
  /** Timestamp of error */
  timestamp: number;
}

/**
 * API request parameters for balance endpoint
 */
export interface BalanceRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Comma-separated token list */
  tokens?: string;
  
  /** Aggregation level */
  aggregation?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for distribution endpoint
 */
export interface DistributionRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Comma-separated wallet list */
  wallets?: string;
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for exchanges endpoint
 */
export interface ExchangesRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Transaction type filter */
  type?: string;
  
  /** Metric type */
  metric?: 'count' | 'volume';
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for counterparties endpoint
 */
export interface CounterpartiesRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Transaction type filter */
  type?: string;
  
  /** Limit to top N counterparties */
  limit?: number;
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for P&L endpoint
 */
export interface PnLRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Aggregation level */
  aggregation?: 'daily' | 'weekly' | 'monthly';
  
  /** Comma-separated wallet list */
  wallets?: string;
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for transaction distribution endpoint
 */
export interface TransactionDistributionRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Comma-separated wallet list */
  wallets?: string;
  
  /** Transaction type filter */
  type?: string;
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for holdings endpoint
 */
export interface HoldingsRequestParams extends ChartResponseBase {
  /** Comma-separated wallet list */
  wallets?: string;
  
  /** Limit to top N tokens */
  limit?: number;
  
  /** Time unit for duration */
  unit?: 'days' | 'weeks' | 'months';
  
  [key: string]: string | number | undefined;
}

/**
 * API request parameters for volume benchmark endpoint
 */
export interface VolumeBenchmarkRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Comma-separated wallet list */
  wallets?: string;
  
  [key: string]: string | number | undefined;
}

/**
 * Price history API response
 * GET /api/charts/price-history
 */
export interface PriceHistoryResponse extends ChartResponseBase {
  /** Price data series for each token */
  series: {
    /** Token symbol */
    symbol: string;
    
    /** Token name */
    name: string;
    
    /** Time series price data points */
    data: TimeSeriesPoint[];
  }[];
  
  /** Response metadata */
  metadata: ApiResponseMetadata & {
    currency: string;
    timezone: string;
    aggregation: string;
  };
}

/**
 * API request parameters for price history endpoint
 */
export interface PriceHistoryRequestParams extends ChartResponseBase {
  /** Time period filter */
  period?: string;
  
  /** Comma-separated token list */
  tokens?: string;
  
  /** Aggregation level */
  aggregation?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  
  [key: string]: string | number | undefined;
}
