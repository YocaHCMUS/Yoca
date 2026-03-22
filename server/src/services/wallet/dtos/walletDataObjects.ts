export interface WalletOverview {
    address: string;
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

export interface WalletPortfolio {
    address: string;
    totalAssetValueUsd: number;
    items: WalletPortfolioItem[];
}

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

export interface WalletSwapBalanceChange {
    mint: string,
    amount: number,
    decimals: number,
    symbol?: string | null,
    name?: string | null,
    logoUri?: string | null,
    priceUsd?: number | null,
    valueUsd?: number | null,
}

export interface WalletSwapExchange {
    name?: string | null,
    address?: string | null,
    logo?: string | null,
}

export interface WalletSwapPair {
    address?: string | null,
    label?: string | null,
    baseTokenAddress?: string | null,
    quoteTokenAddress?: string | null,
}

export interface WalletSwap {
    walletAddress: string,
    signature: string,
    timestamp: string,
    slot: number,
    fee: number,
    feePayer: string,
    balanceChanges: WalletSwapBalanceChange[],
    feeChanges: WalletSwapBalanceChange[],
    transactionType?: string | null,
    subCategory?: string | null,
    blockNumber?: number | null,
    exchange?: WalletSwapExchange | null,
    pair?: WalletSwapPair | null,
    sold?: WalletSwapBalanceChange | null,
    bought?: WalletSwapBalanceChange | null,
    baseQuotePrice?: number | null,
    totalValueUsd?: number | null,
    source?: "helius" | "moralis" | string,

}

export interface WalletTransactionHelius {
    walletAddress: string,
    signature: string,
    timestamp: string,
    slot: number,
    fee: number,
    feePayer: string,
    balanceChanges: WalletSwapBalanceChange[],
}

export interface WalletTransfer {
    from: string,
    to: string,
    // In the according token units
    amount: number,
    amountUsd?: number,
    timestamp: string,
    tokenAddress: string,
    tokenSymbol: string,
    tokenName?: string,
    tokenLogoUri?: string,
    priceUsd?: number,
    transactionSignature: string,
    instructionIndex: number,
}

export interface WalletTransactionsResponse {
    address: string;
    transactions: WalletTransaction[];
}

export interface WalletPageInfo {
    pageSize: 100;
    hasMore: boolean;
    nextCursor: string | null;
    source: "cache" | "provider" | "mixed";
}

export interface WalletTransfersResponse {
    address: string;
    transfers: WalletTransfer[];
    pageInfo: WalletPageInfo;
}

export interface WalletSwapsResponse {
    address: string;
    swaps: WalletSwap[];
    pageInfo: WalletPageInfo;
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
    metadata: {
        period?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
        chain?: string;
        metric: "count" | "volume";
        source?: "cache" | "provider" | "mixed";
        limit?: number;
        truncated?: boolean;
    };
}

export type WalletTimePeriod = "24H" | "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
export type WalletOverviewTimePeriod = WalletTimePeriod;
export type WalletTimePeriodInput =
    | WalletTimePeriod
    | "24h"
    | "7d"
    | "30d"
    | "60d"
    | "90d"
    | "1y"
    | "all";

export type WalletCursorOptions = {
    limit?: number;
    cursor?: string;
    before?: string;
};

export type WalletRangeOptions = {
    from?: WalletTimePeriodInput;
    fromSec?: number;
    toSec?: number;
};

export type WalletOverviewQueryOptions = {
    timePeriod?: WalletOverviewTimePeriod;
};

export type WalletHistoryQueryOptions = WalletCursorOptions & WalletRangeOptions;

export type WalletTransfersQueryOptions = WalletCursorOptions & {
    from?: WalletTimePeriodInput;
};

export type WalletSwapsQueryOptions = WalletCursorOptions & {
    from?: WalletTimePeriodInput;
};

export type PnLAggregation = "daily" | "weekly" | "monthly";
export type ChartAggregation = "hourly" | "daily" | "weekly" | "monthly";

export interface BalanceDataPoint {
    timestamp: number;
    value: number;
    date: string;
}

export interface PnLDataPoint {
    timestamp: number;
    value: number;
}

export interface WalletCumulativePnLResult {
    dailyPnL: PnLDataPoint[];
    cumulativePnL: PnLDataPoint[];
    startBalance: number;
    endBalance: number;
    realizedPnL?: number;
}

export interface ChartPageInfo {
    pageSize: number;
    hasMore: boolean;
    nextCursor: string | null;
    source: "cache" | "provider" | "mixed";
}

export interface ChartChunkInfo {
    chunkFromSec: number;
    chunkToSec: number;
    requestedFromSec: number;
    requestedToSec: number;
    effectiveAggregation: ChartAggregation;
}

export interface ChartChunkState {
    hasMore: boolean;
    nextChunkToSec: number | null;
    heliusCursor: string | null;
    lastProcessedSignature: string | null;
}

export type WalletBalanceHistoryChunkOptions = {
    timePeriod?: WalletTimePeriod;
    requestedFromSec?: number;
    requestedToSec?: number;
    chunkToSec?: number;
    limit?: number;
    heliusCursor?: string | null;
};

export type WalletPnLChunkOptions = {
    timePeriod?: WalletTimePeriod;
    requestedFromSec?: number;
    requestedToSec?: number;
    chunkToSec?: number;
    limit?: number;
    aggregation?: PnLAggregation;
    heliusCursor?: string | null;
};

export interface TokenBalanceSeriesResult {
    tokenSeries: BalanceDataPoint[];
    usdSeries: BalanceDataPoint[];
    tokenSymbol: string;
    tokenAddress: string;
}

export type WalletTokenBalanceChunkOptions = {
    timePeriod?: WalletTimePeriod;
    requestedFromSec?: number;
    requestedToSec?: number;
    chunkToSec?: number;
    limit?: number;
};

export type WalletExchangeCountsOptions = {
    period?: string;
    chain?: string;
    limit?: number;
    metric?: "count" | "volume";
};

export type WalletCounterpartyPeriod = "24h" | "7d";

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
        period: WalletCounterpartyPeriod;
        source: "cache" | "provider" | "mixed";
        totals: {
            counterparties: number;
            transactions: number;
            volume: number;
        };
    };
}

export type BirdeyeNetworthDirection = "back" | "forward";
export type BirdeyeNetworthType = "1h" | "1d";
export type BirdeyeSortType = "asc" | "desc";
export type BirdeyePnlDuration = "all" | "90d" | "30d" | "7d" | "24h";

export type BirdeyeNetworthHistoryPoint = {
    timestamp: string;
    netWorthUsd: number;
    netWorthChangeUsd: number | null;
    netWorthChangePercent: number | null;
};

export type BirdeyeNetworthHistoryResult = {
    address: string;
    currency: string;
    currentTimestamp: string | null;
    pastTimestamp: string | null;
    history: BirdeyeNetworthHistoryPoint[];
};

export type BirdeyePortfolioSnapshotAsset = {
    symbol: string;
    tokenAddress: string;
    decimals: number;
    balanceRaw: string;
    priceUsd: number | null;
    valueUsd: number;
};

export type BirdeyePortfolioSnapshotResult = {
    address: string;
    currency: string;
    netWorthUsd: number;
    requestedTimestamp: string | null;
    resolvedTimestamp: string | null;
    assets: BirdeyePortfolioSnapshotAsset[];
};

export type BirdeyeOverallPnlResult = {
    address: string;
    duration: BirdeyePnlDuration;
    summary: BirdeyePnlSummary | null;
};



export type BirdeyeTokenPnlDetailsOptions = {
    tokenAddresses?: string[];
    duration?: BirdeyePnlDuration;
    sortType?: BirdeyeSortType;
    sortBy?: "last_trade";
    limit?: number;
    offset?: number;
};

export type BirdeyeTokenPnlDetailsResult = {
    meta: BirdeyeTokenPnlMeta | null;
    tokens: BirdeyeTokenPnlDetailsToken[];
    summary: BirdeyePnlSummary | null;
};

export type BirdeyePnlCounts = {
    total_buy: number | null;
    total_sell: number | null;
    total_trade: number | null;
    total_win: number | null;
    total_loss: number | null;
    win_rate: number | null;
};

export type BirdeyePnlCashflowUsd = {
    total_invested: number | null;
    total_sold: number | null;
    current_value: number | null;
};

export type BirdeyePnlBreakdown = {
    realized_profit_usd: number | null;
    realized_profit_percent: number | null;
    unrealized_usd: number | null;
    unrealized_percent?: number | null;
    total_usd: number | null;
    total_percent?: number | null;
    avg_profit_per_trade_usd: number | null;
};

export type BirdeyePnlSummary = {
    unique_tokens: number | null;
    counts: BirdeyePnlCounts | null;
    cashflow_usd: BirdeyePnlCashflowUsd | null;
    pnl: BirdeyePnlBreakdown | null;
};

export type BirdeyeTokenPnlMeta = {
    address?: string;
    currency?: string;
    holding_check?: boolean;
    time?: string;
} | null;

export type BirdeyeTokenPnlQuantity = {
    total_bought_amount?: number | null;
    total_sold_amount?: number | null;
    holding?: number | null;
};

export type BirdeyeTokenPnlPricing = {
    current_price?: number | null;
    avg_buy_cost?: number | null;
    avg_sell_cost?: number | null;
};

export type BirdeyeTokenPnlDetailsToken = {
    symbol?: string;
    decimals?: number;
    address?: string;
    counts?: BirdeyePnlCounts | null;
    quantity?: BirdeyeTokenPnlQuantity | null;
    cashflow_usd?: BirdeyePnlCashflowUsd | null;
    pnl?: BirdeyePnlBreakdown | null;
    pricing?: BirdeyeTokenPnlPricing | null;
};

export type PriceTimelinePoint = {
    timestampMs: number;
    price: number;
};


export type WalletOverviewCacheRow = {
    totalAssetValueUsd: number | string;
    tradingVolumeUsd24h: number | string | null;
    pnlUsdTotal: number | string | null;
    transactionCount24h: number | null;
    tokensTradedCount: number | null;
    tokensHoldingCount: number;
    fetchedAt: Date;
};

export type OverviewHoldingsSnapshot = {
    totalAssetValueUsd: number;
    tokensHoldingCount: number;
    source:
    | "birdeye-portfolio"
    | "helius-portfolio-fallback"
    | "overview-cache"
    | "none";
};

export type OverviewActivitySnapshot = {
    transactionCount24h: number | null;
    tokensTradedCount: number | null;
    tradingVolumeUsd24h: number | null;
    pnlUsdTotal: number | null;
    source: "birdeye-overall-pnl" | "overview-cache" | "none";
    pricedChangesCount: number;
};

export type SwapProviderSource = "helius" | "moralis";
export type WalletProviderPolicy = "helius" | "birdeye" | "fallback";
