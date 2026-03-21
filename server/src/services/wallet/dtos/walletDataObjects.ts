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


//{
//   "data": {
//     "summary": {
//       "unique_tokens": 2,
//       "counts": {
//         "total_buy": 2662,
//         "total_sell": 2662,
//         "total_trade": 5324,
//         "total_win": 0,
//         "total_loss": 0,
//         "win_rate": 0
//       },
//       "cashflow_usd": {
//         "total_invested": 1608115.2643622628,
//         "total_sold": 1599917.7121306476,
//         "current_value": 7969.512382030155
//       },
//       "pnl": {
//         "realized_profit_usd": 3828.869555830345,
//         "realized_profit_percent": 0.23989075380375421,
//         "unrealized_usd": 562.8603455227911,
//         "total_usd": 4391.729901353136,
//         "avg_profit_per_trade_usd": 0.8248929191121592
//       }
//     }
//   }
// }
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

//
// {
//   "data": {
//     "meta": {
//       "address": "123hJZ8FGVhesDUrv5dCgorewd7KMqBkFhoGdyZNp62D",
//       "currency": "usd",
//       "holding_check": false,
//       "time": "2025-10-31T08:38:25.295882105Z"
//     },
//     "tokens": [
//       {
//         "symbol": "G7",
//         "decimals": 6,
//         "address": "2VKDTnMF9hmDfCG4i7yPHsfYzYCRhLwQcgUQPxvvYKnV",
//         "counts": {
//           "total_buy": 1,
//           "total_sell": 1,
//           "total_trade": 2
//         },
//         "quantity": {
//           "total_bought_amount": 6152601.258849,
//           "total_sold_amount": 6152601.258849,
//           "holding": 0
//         },
//         "cashflow_usd": {
//           "cost_of_quantity_sold": 9.7233729560565,
//           "total_invested": 9.7233729560565,
//           "total_sold": 9.85555342050984,
//           "current_value": 0
//         },
//         "pnl": {
//           "realized_profit_usd": 0.13218046445334128,
//           "realized_profit_percent": 1.3594095901773329,
//           "unrealized_usd": 0,
//           "unrealized_percent": 0,
//           "total_usd": 0.13218046445334128,
//           "total_percent": 1.3594095901773329,
//           "avg_profit_per_trade_usd": 0.13218046445334128
//         },
//         "pricing": {
//           "current_price": null,
//           "avg_buy_cost": 0.0000015803678065552884,
//           "avg_sell_cost": 0.0000016018514780776761
//         }
//       }
//     ],
//     "summary": {
//       "unique_tokens": 7,
//       "counts": {
//         "total_buy": 19,
//         "total_sell": 19,
//         "total_trade": 38,
//         "total_win": 4,
//         "total_loss": 1,
//         "win_rate": 0.5714285714285714
//       },
//       "cashflow_usd": {
//         "total_invested": 424.183016567611,
//         "total_sold": 555.080692928933,
//         "current_value": 392.84271337031083
//       },
//       "pnl": {
//         "realized_profit_usd": 130.8976763613221,
//         "realized_profit_percent": 30.858773512554855,
//         "unrealized_usd": 0,
//         "total_usd": 130.8976763613221,
//         "avg_profit_per_trade_usd": 3.444675693719003
//       }
//     }
//   }
// }
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
