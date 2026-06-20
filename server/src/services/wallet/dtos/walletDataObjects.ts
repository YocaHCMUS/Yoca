export interface WalletOverview {
    address: string;
    availablePeriods: WalletOverviewPeriodKey[];
    selectedPeriod: WalletOverviewPeriodKey;
    holdings: WalletOverviewHoldingsStats;
    periods: Record<WalletOverviewPeriodKey, WalletOverviewPeriodStats>;
    legacy: WalletOverviewLegacy;
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

export type WalletOverviewPeriodKey = "24H" | "7D" | "30D" | "90D" | "All";
export interface WalletOverviewWinRateStats {
    winRate: number;       // VD: 68.4
    winCount: number;      // Số token lãi
    lossCount: number;     // Số token lỗ
    totalTraded: number;   // Tổng số token có giao dịch chốt lời/lỗ
    avgWinUsd: number;     // Trung bình số tiền lãi
    avgLossUsd: number;    // Trung bình số tiền lỗ
}
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
    source: "mobula-wallet-analysis" | "birdeye-overall-pnl" | "overview-cache" | "none";
    winRateStats?: WalletOverviewWinRateStats;
}

export interface WalletOverviewHoldingsStats {
    totalAssetValueUsd: number;
    change24hPercent: number | null;
    tokensHoldingCount: number;
    source: "mobula-wallet-analysis" | "birdeye-portfolio" | "helius-portfolio-fallback" | "overview-cache" | "none";
}

export interface WalletOverviewLegacy {
    totalAssetValueUsd: number;
    tradingVolumeUsd24h: number | null;
    pnlUsdTotal: number | null;
    transactionCount24h: number | null;
    tokensTradedCount: number | null;
    tokensHoldingCount: number;
    metricsPeriod: string;
}

export interface WalletPortfolio {
    address: string;
    totalAssetValueUsd: number;
    totalAssetValueChange24hPercent?: number | null;
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

export interface WalletTransactionBalanceChange {
    mint: string,
    amount: number,
    decimals: number,
    symbol?: string | null,
    name?: string | null,
    logoUri?: string | null,
    priceUsd?: number | null,
    valueUsd?: number | null,
}

// export interface WalletSwapExchange {
//     name?: string | null,
//     address?: string | null,
//     logo?: string | null,
// }

// export interface WalletSwapPair {
//     address?: string | null,
//     label?: string | null,
//     baseTokenAddress?: string | null,
//     quoteTokenAddress?: string | null,
// }

export interface WalletSwap {
    transactionHash: string,
    transactionType: string,
    blockTimestampIso: string,

    subcategory: string | null,

    walletAddress: string,
    pairAddress: string,

    tokensInvolved: string,

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

export interface WalletTransactionHelius {
    walletAddress: string,
    signature: string,
    timestamp: string,
    slot: number,
    fee: number,
    feePayer: string,
    balanceChanges: WalletTransactionBalanceChange[],
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
    // Kept for backward source compatibility. Overview now returns all periods.
    timePeriod?: WalletOverviewTimePeriod;
};

export type WalletHistoryQueryOptions = WalletCursorOptions & WalletRangeOptions;

export type WalletTransfersQueryOptions = WalletCursorOptions & {
    from?: WalletTimePeriodInput;
};

export type WalletSwapsQueryOptions = WalletCursorOptions & {
    from?: WalletTimePeriodInput;
    tokenAddress?: string;
};

export type PnLAggregation = "daily" | "weekly" | "monthly";
export type ChartAggregation = "hourly" | "daily" | "weekly" | "monthly";

export interface BalanceDataPoint {
    timestamp: number;
    value: number;
    date: string;
    changeUsd?: number;
    changePercent?: number;
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
    address: string;
    totalAssetValueUsd: number | string;
    totalAssetValueChange24hPercent: number | string | null;
    tradingVolumeUsd24h: number | string | null;
    tradingVolumeUsd7d: number | string | null;
    tradingVolumeUsd30d: number | string | null;
    tradingVolumeUsd90d: number | string | null;
    tradingVolumeUsdAll: number | string | null;
    pnlUsdTotal: number | string | null;
    pnlTotalUsd24h: number | string | null;
    pnlTotalUsd7d: number | string | null;
    pnlTotalUsd30d: number | string | null;
    pnlTotalUsd90d: number | string | null;
    pnlTotalUsdAll: number | string | null;
    pnlRealizedUsd24h: number | string | null;
    pnlRealizedUsd7d: number | string | null;
    pnlRealizedUsd30d: number | string | null;
    pnlRealizedUsd90d: number | string | null;
    pnlRealizedUsdAll: number | string | null;
    pnlUnrealizedUsd24h: number | string | null;
    pnlUnrealizedUsd7d: number | string | null;
    pnlUnrealizedUsd30d: number | string | null;
    pnlUnrealizedUsd90d: number | string | null;
    pnlUnrealizedUsdAll: number | string | null;
    transactionCount24h: number | null;
    transactionCount7d: number | null;
    transactionCount30d: number | null;
    transactionCount90d: number | null;
    transactionCountAll: number | null;
    tokensTradedCount: number | null;
    tokensTradedCount24h: number | null;
    tokensTradedCount7d: number | null;
    tokensTradedCount30d: number | null;
    tokensTradedCount90d: number | null;
    tokensTradedCountAll: number | null;
    buyTxCount24h: number | null;
    buyTxCount7d: number | null;
    buyTxCount30d: number | null;
    buyTxCount90d: number | null;
    buyTxCountAll: number | null;
    sellTxCount24h: number | null;
    sellTxCount7d: number | null;
    sellTxCount30d: number | null;
    sellTxCount90d: number | null;
    sellTxCountAll: number | null;
    buyVolumeUsd24h: number | string | null;
    buyVolumeUsd7d: number | string | null;
    buyVolumeUsd30d: number | string | null;
    buyVolumeUsd90d: number | string | null;
    buyVolumeUsdAll: number | string | null;
    sellVolumeUsd24h: number | string | null;
    sellVolumeUsd7d: number | string | null;
    sellVolumeUsd30d: number | string | null;
    sellVolumeUsd90d: number | string | null;
    sellVolumeUsdAll: number | string | null;
    tokensHoldingCount: number;
    fetchedAt: Date;
    holdingsFetchedAt: Date | null;
    activityFetchedAt: Date | null;
};

export type OverviewHoldingsSnapshot = {
    totalAssetValueUsd: number;
    change24hPercent: number | null;
    tokensHoldingCount: number;
    source:
    | "birdeye-portfolio"
    | "helius-portfolio-fallback"
    | "overview-cache"
    | "none";
};

export type OverviewActivitySnapshot = {
    tradingVolumeUsd: number | null;
    buyTransactionCount: number | null;
    buyVolumeUsd: number | null;
    sellTransactionCount: number | null;
    sellVolumeUsd: number | null;
    transactionCount: number | null;
    tokensTradedCount: number | null;
    pnlTotalUsd: number | null;
    pnlRealizedUsd: number | null;
    pnlUnrealizedUsd: number | null;
    source: "mobula-wallet-analysis" | "birdeye-overall-pnl" | "overview-cache" | "none";
};

export type SwapProviderSource = "helius" | "moralis";
export type WalletProviderPolicy = "helius" | "birdeye" | "fallback";

export type HeliusWalletFirstFund = {
    reciepient: string
    funder: string
    funderName: string | null
    funderType: string | null
    mint: string
    symbol: string
    amount: number
    amountRaw: string
    decimals: number
    date: string
    signature: string
    timestamp: number
    slot: number
    explorerUrl: string
};

export interface TokenHourlyVolume {
    hour: number;
    buyVolumeUsd: number;
    sellVolumeUsd: number;
}

export interface WalletDayToken {
    address: string;
    symbol: string;
    logoUri: string | null;
    buyVolumeUsd: number;
    sellVolumeUsd: number;
    buyAmount: number;
    sellAmount: number;
    totalVolumeUsd: number;
    hourlyVolumes: TokenHourlyVolume[];
}

export interface WalletDayActivitySummary {
    walletAddress: string;
    date: string;
    buyVolumeUsd: number;
    sellVolumeUsd: number;
    buyTxCount: number;
    sellTxCount: number;
    allTokens: WalletDayToken[];
    totalTokensTraded: number;
    swaps: WalletDaySwapSummary[];
}

export interface WalletDaySwapSummary {
    transactionHash: string;
    timestamp: string;
    pair: string;
    valueUsd: number;
    action: "buy" | "sell";
    soldSymbol: string | null;
    boughtSymbol: string | null;
    soldTokenAddress: string | null;
    boughtTokenAddress: string | null;
    soldAmount: number;
    boughtAmount: number;

}

export interface WalletTxTransfer {
    from: string;
    to: string;
    mint: string;
    symbol: string | null;
    name: string | null;
    logoUri: string | null;
    amount: number;
    amountUsd: number | null;
    fromTokenAccount?: string;
    toTokenAccount?: string;
}

export interface WalletFeeReceiver {
    address: string;
    amount: number;
    amountUsd: number | null;
    label: string | null;
}

export interface WalletTxDetail {
    transactionHash: string;
    timestamp: string;
    pair: string;
    valueUsd: number;
    action: "buy" | "sell";
    transfers: WalletTxTransfer[];
    feePaid: number;
    feePaidUsd: number | null;
    feePayer: string;
    feeReceivers: WalletFeeReceiver[];
}

export interface WalletInnerInstruction {
    index: number;
    programId: string;
    programLabel: string | null;
    accounts: string[];
}

export interface WalletInstruction {
    index: number;
    programId: string;
    programLabel: string | null;
    accounts: string[];
    innerInstructions: WalletInnerInstruction[];
}

export interface WalletTxInstructionDetail {
    transactionHash: string;
    instructions: WalletInstruction[];
}

export interface WalletDayActivityMultiResponse {
    wallets: WalletDayActivitySummary[];
    combined?: WalletDayActivitySummary;
}

