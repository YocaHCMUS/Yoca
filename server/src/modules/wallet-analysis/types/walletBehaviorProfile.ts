export type WalletBehaviorProfile = {
    schemaVersion: string;
    generatedAt: string;
    wallet: WalletIdentity;
    analysisWindow: AnalysisWindow;
    dataQuality: DataQualitySummary;
    activity: WalletActivityProfile;
    portfolio: PortfolioProfile;
    trading: TradingBehaviorProfile;
    pnl: PnlProfile;
    protocolUsage: ProtocolUsageProfile;
    risk: WalletRiskProfile;
    washTrading: WashTradingProfile;
    persona: WalletPersonaProfile;
    evidence: EvidenceBundle[];
    aiContext: WalletAIContext;
};

export type WalletIdentity = {
    address: string;
    label?: string | null;
    clusterId?: string | null;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
};

export type AnalysisWindow = {
    mode: "RECENT_TRANSACTIONS" | "DATE_RANGE" | "FULL_HISTORY";
    transactionLimit?: number | null;
    fromTimestamp?: string | null;
    toTimestamp?: string | null;
    latestSignatureAnalyzed?: string | null;
    oldestSignatureAnalyzed?: string | null;
    actualTransactionCount: number;
    successfulTransactionCount: number;
    failedTransactionCount: number;
    includedSignatures: string[];
};

export type DataQualitySummary = {
    completenessScore: number;
    missingPriceCount: number;
    missingTokenMetadataCount: number;
    unsupportedTransactionCount: number;
    suspiciousParsingCount: number;
    warnings: string[];
};

export type WalletActivityProfile = {
    activeDays: number;
    averageTransactionsPerDay: number;
    firstTransactionAt?: string | null;
    lastTransactionAt?: string | null;
    maxTransactionsInOneHour: number;
    medianTimeBetweenTransactionsSeconds?: number | null;
    burstActivityScore: number;
    failedTransactionRatio: number;
    activityLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
};

export type PortfolioProfile = {
    totalEstimatedValueUsd?: number | null;
    tokenCount: number;
    nftCount?: number | null;
    stablecoinValueUsd?: number | null;
    stablecoinRatio?: number | null;
    topHoldings: TokenHoldingSummary[];
    concentration: PortfolioConcentration;
};

export type TokenHoldingSummary = {
    mint: string;
    symbol?: string | null;
    name?: string | null;
    amount: number;
    valueUsd?: number | null;
    portfolioRatio?: number | null;
};

export type PortfolioConcentration = {
    top1HoldingRatio?: number | null;
    top3HoldingRatio?: number | null;
    top5HoldingRatio?: number | null;
    concentrationRisk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
};

export type TradingBehaviorProfile = {
    swapCount: number;
    buyCount: number;
    sellCount: number;
    uniqueTokensTraded: number;
    uniqueTokensBought: number;
    uniqueTokensSold: number;
    totalVolumeUsd?: number | null;
    averageTradeSizeUsd?: number | null;
    medianTradeSizeUsd?: number | null;
    largestTradeUsd?: number | null;
    stablecoinUsageRatio?: number | null;
    averageHoldingPeriodHours?: number | null;
    medianHoldingPeriodHours?: number | null;
    shortTermTradeRatio?: number | null;
    longTermHoldRatio?: number | null;
    tradingStyle:
        | "UNKNOWN"
        | "HOLDER"
        | "CASUAL_TRADER"
        | "ACTIVE_TRADER"
        | "HIGH_FREQUENCY_TRADER"
        | "SNIPER"
        | "AIRDROP_FARMER";
};

export type PnlProfile = {
    realizedPnlUsd?: number | null;
    unrealizedPnlUsd?: number | null;
    totalPnlUsd?: number | null;
    closedPositionCount: number;
    openPositionCount: number;
    winningTradeCount: number;
    losingTradeCount: number;
    winRate?: number | null;
    lossRate?: number | null;
    averageWinUsd?: number | null;
    averageLossUsd?: number | null;
    bestTradeUsd?: number | null;
    worstTradeUsd?: number | null;
    profitFactor?: number | null;
    pnlStatus: "PROFITABLE" | "UNPROFITABLE" | "BREAKEVEN" | "UNKNOWN";
    calculationMethod: "FIFO" | "AVERAGE_COST" | "UNKNOWN";
    limitations: string[];
};

export type ProtocolUsageProfile = {
    protocols: ProtocolUsageItem[];
    dominantProtocol?: string | null;
    dexUsageRatio?: number | null;
    lendingUsageRatio?: number | null;
    nftMarketplaceUsageRatio?: number | null;
    stakingUsageRatio?: number | null;
};

export type ProtocolUsageItem = {
    protocolName: string;
    category: "DEX" | "LENDING" | "NFT_MARKETPLACE" | "STAKING" | "BRIDGE" | "CEX" | "UNKNOWN";
    transactionCount: number;
    volumeUsd?: number | null;
    usageRatio?: number | null;
};

export type WalletRiskProfile = {
    riskScore: number;
    trustScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
    riskFactors: RiskFactor[];
    explanation: string;
};

export type RiskFactor = {
    code:
        | "HIGH_FREQUENCY_ACTIVITY"
        | "SHORT_HOLDING_PERIOD"
        | "NEGATIVE_PNL"
        | "LOW_WIN_RATE"
        | "HIGH_TOKEN_DIVERSITY"
        | "HIGH_PORTFOLIO_CONCENTRATION"
        | "SUSPICIOUS_COUNTERPARTY_PATTERN"
        | "WASH_TRADING_SUSPECTED"
        | "MISSING_DATA";
    severity: "LOW" | "MEDIUM" | "HIGH";
    scoreImpact: number;
    description: string;
    evidenceIds: string[];
};

export type WashTradingProfile = {
    suspicionScore: number;
    suspicionLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
    signals: WashTradingSignal[];
    graphMetrics?: WashTradingGraphMetrics;
    explanation: string;
};

export type WashTradingSignal = {
    code:
        | "REPEATED_COUNTERPARTY"
        | "CIRCULAR_TOKEN_FLOW"
        | "REPEATED_SIMILAR_AMOUNTS"
        | "HIGH_VOLUME_LOW_POSITION_CHANGE"
        | "TIGHT_CLUSTER_ACTIVITY"
        | "LOW_EXTERNAL_INTERACTION";
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
    evidenceIds: string[];
};

export type WashTradingGraphMetrics = {
    uniqueCounterparties: number;
    repeatedCounterpartyRatio?: number | null;
    circularFlowCount?: number | null;
    reciprocityRatio?: number | null;
    internalVolumeRatio?: number | null;
};

export type WalletPersonaProfile = {
    primaryPersona: WalletPersonaType;
    secondaryPersonas: WalletPersonaType[];
    confidence: number;
    personaScores: Record<WalletPersonaType, number>;
    reasoning: string[];
    evidenceIds: string[];
};

export type WalletPersonaType =
    | "UNKNOWN"
    | "LONG_TERM_HOLDER"
    | "CASUAL_USER"
    | "DEFI_TRADER"
    | "MEMECOIN_TRADER"
    | "NFT_COLLECTOR"
    | "AIRDROP_FARMER"
    | "BOT_LIKE_TRADER"
    | "HIGH_RISK_SPECULATOR"
    | "SMART_MONEY_LIKE"
    | "WASH_TRADING_SUSPECT";

export type EvidenceBundle = {
    id: string;
    type: "TRANSACTION_SIGNATURES" | "METRIC_THRESHOLD" | "TOKEN_HOLDING" | "PROTOCOL_USAGE" | "PNL_RESULT" | "GRAPH_PATTERN";
    title: string;
    description: string;
    relatedSignatures?: string[];
    relatedTokenMints?: string[];
    value?: number | string | null;
    threshold?: number | string | null;
    severity?: "LOW" | "MEDIUM" | "HIGH" | null;
};

export type WalletAIContext = {
    summaryFacts: string[];
    doNotInferBeyond: string[];
    recommendedTone: "NEUTRAL" | "CAUTIOUS" | "WARNING" | "POSITIVE";
    userLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    language: "vi" | "en";
    maxSummaryLength: "SHORT" | "MEDIUM" | "DETAILED";
};