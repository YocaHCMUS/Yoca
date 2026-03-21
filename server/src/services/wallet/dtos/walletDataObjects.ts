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

export type BirdeyeOverallPnlResult = {
    address: string;
    duration: BirdeyePnlDuration;
    summary: any;
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
    meta: any;
    tokens: any[];
    summary: any;
};
