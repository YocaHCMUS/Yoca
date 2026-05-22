import { z } from "zod";

import type {
    AnalysisWindow,
    DataQualitySummary,
    EvidenceBundle,
    PnlProfile,
    PortfolioConcentration,
    PortfolioProfile,
    ProtocolUsageItem,
    ProtocolUsageProfile,
    RiskFactor,
    TradingBehaviorProfile,
    TokenHoldingSummary,
    WalletAIContext,
    WalletActivityProfile,
    WalletBehaviorProfile,
    WalletIdentity,
    WalletPersonaProfile,
    WalletPersonaType,
    WalletRiskProfile,
    WashTradingGraphMetrics,
    WashTradingProfile,
    WashTradingSignal,
} from "../types/walletBehaviorProfile";

const nonNegativeIntegerSchema = z.number().int().min(0);
const nonNegativeNumberSchema = z.number().min(0);
const score0to100Schema = z.number().min(0).max(100);
const ratio0to1Schema = z.number().min(0).max(1);
const optionalStringSchema = z.string().trim().min(1).nullable().optional();
const optionalTimestampSchema = z.string().trim().min(1).nullable().optional();

export const walletPersonaTypeValues = [
    "UNKNOWN",
    "LONG_TERM_HOLDER",
    "CASUAL_USER",
    "DEFI_TRADER",
    "MEMECOIN_TRADER",
    "NFT_COLLECTOR",
    "AIRDROP_FARMER",
    "BOT_LIKE_TRADER",
    "HIGH_RISK_SPECULATOR",
    "SMART_MONEY_LIKE",
    "WASH_TRADING_SUSPECT",
] as const satisfies readonly WalletPersonaType[];

export const walletPersonaTypeSchema = z.enum(walletPersonaTypeValues);

export const walletIdentitySchema: z.ZodType<WalletIdentity> = z
    .object({
        address: z.string().trim().min(1),
        label: optionalStringSchema,
        clusterId: optionalStringSchema,
        firstSeenAt: optionalTimestampSchema,
        lastSeenAt: optionalTimestampSchema,
    })
    .strict();

export const analysisWindowSchema: z.ZodType<AnalysisWindow> = z
    .object({
        mode: z.enum(["RECENT_TRANSACTIONS", "DATE_RANGE", "FULL_HISTORY"]),
        transactionLimit: nonNegativeIntegerSchema.nullable().optional(),
        fromTimestamp: optionalTimestampSchema,
        toTimestamp: optionalTimestampSchema,
        latestSignatureAnalyzed: optionalStringSchema,
        oldestSignatureAnalyzed: optionalStringSchema,
        actualTransactionCount: nonNegativeIntegerSchema,
        successfulTransactionCount: nonNegativeIntegerSchema,
        failedTransactionCount: nonNegativeIntegerSchema,
        includedSignatures: z.array(z.string().trim().min(1)),
    })
    .strict();

export const dataQualitySummarySchema: z.ZodType<DataQualitySummary> = z
    .object({
        completenessScore: score0to100Schema,
        missingPriceCount: nonNegativeIntegerSchema,
        missingTokenMetadataCount: nonNegativeIntegerSchema,
        unsupportedTransactionCount: nonNegativeIntegerSchema,
        suspiciousParsingCount: nonNegativeIntegerSchema,
        warnings: z.array(z.string().trim().min(1)),
    })
    .strict();

export const walletActivityProfileSchema: z.ZodType<WalletActivityProfile> = z
    .object({
        activeDays: nonNegativeIntegerSchema,
        averageTransactionsPerDay: nonNegativeNumberSchema,
        firstTransactionAt: optionalTimestampSchema,
        lastTransactionAt: optionalTimestampSchema,
        maxTransactionsInOneHour: nonNegativeIntegerSchema,
        medianTimeBetweenTransactionsSeconds: nonNegativeNumberSchema.nullable().optional(),
        burstActivityScore: score0to100Schema,
        failedTransactionRatio: ratio0to1Schema,
        activityLevel: z.enum(["LOW", "MEDIUM", "HIGH", "EXTREME"]),
    })
    .strict();

export const tokenHoldingSummarySchema: z.ZodType<TokenHoldingSummary> = z
    .object({
        mint: z.string().trim().min(1),
        symbol: optionalStringSchema,
        name: optionalStringSchema,
        amount: nonNegativeNumberSchema,
        valueUsd: nonNegativeNumberSchema.nullable().optional(),
        portfolioRatio: ratio0to1Schema.nullable().optional(),
    })
    .strict();

export const portfolioConcentrationSchema: z.ZodType<PortfolioConcentration> = z
    .object({
        top1HoldingRatio: ratio0to1Schema.nullable().optional(),
        top3HoldingRatio: ratio0to1Schema.nullable().optional(),
        top5HoldingRatio: ratio0to1Schema.nullable().optional(),
        concentrationRisk: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
    })
    .strict();

export const portfolioProfileSchema: z.ZodType<PortfolioProfile> = z
    .object({
        totalEstimatedValueUsd: nonNegativeNumberSchema.nullable().optional(),
        tokenCount: nonNegativeIntegerSchema,
        nftCount: nonNegativeIntegerSchema.nullable().optional(),
        stablecoinValueUsd: nonNegativeNumberSchema.nullable().optional(),
        stablecoinRatio: ratio0to1Schema.nullable().optional(),
        topHoldings: z.array(tokenHoldingSummarySchema),
        concentration: portfolioConcentrationSchema,
    })
    .strict();

export const tradingBehaviorProfileSchema: z.ZodType<TradingBehaviorProfile> = z
    .object({
        swapCount: nonNegativeIntegerSchema,
        buyCount: nonNegativeIntegerSchema,
        sellCount: nonNegativeIntegerSchema,
        uniqueTokensTraded: nonNegativeIntegerSchema,
        uniqueTokensBought: nonNegativeIntegerSchema,
        uniqueTokensSold: nonNegativeIntegerSchema,
        totalVolumeUsd: nonNegativeNumberSchema.nullable().optional(),
        averageTradeSizeUsd: nonNegativeNumberSchema.nullable().optional(),
        medianTradeSizeUsd: nonNegativeNumberSchema.nullable().optional(),
        largestTradeUsd: nonNegativeNumberSchema.nullable().optional(),
        stablecoinUsageRatio: ratio0to1Schema.nullable().optional(),
        averageHoldingPeriodHours: nonNegativeNumberSchema.nullable().optional(),
        medianHoldingPeriodHours: nonNegativeNumberSchema.nullable().optional(),
        shortTermTradeRatio: ratio0to1Schema.nullable().optional(),
        longTermHoldRatio: ratio0to1Schema.nullable().optional(),
        tradingStyle: z.enum([
            "UNKNOWN",
            "HOLDER",
            "CASUAL_TRADER",
            "ACTIVE_TRADER",
            "HIGH_FREQUENCY_TRADER",
            "SNIPER",
            "AIRDROP_FARMER",
        ]),
    })
    .strict();

export const pnlProfileSchema: z.ZodType<PnlProfile> = z
    .object({
        realizedPnlUsd: z.number().nullable().optional(),
        unrealizedPnlUsd: z.number().nullable().optional(),
        totalPnlUsd: z.number().nullable().optional(),
        closedPositionCount: nonNegativeIntegerSchema,
        openPositionCount: nonNegativeIntegerSchema,
        winningTradeCount: nonNegativeIntegerSchema,
        losingTradeCount: nonNegativeIntegerSchema,
        winRate: ratio0to1Schema.nullable().optional(),
        lossRate: ratio0to1Schema.nullable().optional(),
        averageWinUsd: z.number().nullable().optional(),
        averageLossUsd: z.number().nullable().optional(),
        bestTradeUsd: z.number().nullable().optional(),
        worstTradeUsd: z.number().nullable().optional(),
        profitFactor: z.number().min(0).nullable().optional(),
        pnlStatus: z.enum(["PROFITABLE", "UNPROFITABLE", "BREAKEVEN", "UNKNOWN"]),
        calculationMethod: z.enum(["FIFO", "AVERAGE_COST", "UNKNOWN"]),
        limitations: z.array(z.string().trim().min(1)),
    })
    .strict();

export const protocolUsageItemSchema: z.ZodType<ProtocolUsageItem> = z
    .object({
        protocolName: z.string().trim().min(1),
        category: z.enum(["DEX", "LENDING", "NFT_MARKETPLACE", "STAKING", "BRIDGE", "CEX", "UNKNOWN"]),
        transactionCount: nonNegativeIntegerSchema,
        volumeUsd: nonNegativeNumberSchema.nullable().optional(),
        usageRatio: ratio0to1Schema.nullable().optional(),
    })
    .strict();

export const protocolUsageProfileSchema: z.ZodType<ProtocolUsageProfile> = z
    .object({
        protocols: z.array(protocolUsageItemSchema),
        dominantProtocol: optionalStringSchema,
        dexUsageRatio: ratio0to1Schema.nullable().optional(),
        lendingUsageRatio: ratio0to1Schema.nullable().optional(),
        nftMarketplaceUsageRatio: ratio0to1Schema.nullable().optional(),
        stakingUsageRatio: ratio0to1Schema.nullable().optional(),
    })
    .strict();

export const riskFactorSchema: z.ZodType<RiskFactor> = z
    .object({
        code: z.enum([
            "HIGH_FREQUENCY_ACTIVITY",
            "SHORT_HOLDING_PERIOD",
            "NEGATIVE_PNL",
            "LOW_WIN_RATE",
            "HIGH_TOKEN_DIVERSITY",
            "HIGH_PORTFOLIO_CONCENTRATION",
            "SUSPICIOUS_COUNTERPARTY_PATTERN",
            "WASH_TRADING_SUSPECTED",
            "MISSING_DATA",
        ]),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
        scoreImpact: score0to100Schema,
        description: z.string().trim().min(1),
        evidenceIds: z.array(z.string().trim().min(1)),
    })
    .strict();

export const walletRiskProfileSchema: z.ZodType<WalletRiskProfile> = z
    .object({
        riskScore: score0to100Schema,
        trustScore: score0to100Schema,
        riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]),
        riskFactors: z.array(riskFactorSchema),
        explanation: z.string().trim().min(1),
    })
    .strict();

export const washTradingSignalSchema: z.ZodType<WashTradingSignal> = z
    .object({
        code: z.enum([
            "REPEATED_COUNTERPARTY",
            "CIRCULAR_TOKEN_FLOW",
            "REPEATED_SIMILAR_AMOUNTS",
            "HIGH_VOLUME_LOW_POSITION_CHANGE",
            "TIGHT_CLUSTER_ACTIVITY",
            "LOW_EXTERNAL_INTERACTION",
        ]),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
        description: z.string().trim().min(1),
        evidenceIds: z.array(z.string().trim().min(1)),
    })
    .strict();

export const washTradingGraphMetricsSchema: z.ZodType<WashTradingGraphMetrics> = z
    .object({
        uniqueCounterparties: nonNegativeIntegerSchema,
        repeatedCounterpartyRatio: ratio0to1Schema.nullable().optional(),
        circularFlowCount: nonNegativeIntegerSchema.nullable().optional(),
        reciprocityRatio: ratio0to1Schema.nullable().optional(),
        internalVolumeRatio: ratio0to1Schema.nullable().optional(),
    })
    .strict();

export const washTradingProfileSchema: z.ZodType<WashTradingProfile> = z
    .object({
        suspicionScore: score0to100Schema,
        suspicionLevel: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
        signals: z.array(washTradingSignalSchema),
        graphMetrics: washTradingGraphMetricsSchema.optional(),
        explanation: z.string().trim().min(1),
    })
    .strict();

export const walletPersonaProfileSchema: z.ZodType<WalletPersonaProfile> = z
    .object({
        primaryPersona: walletPersonaTypeSchema,
        secondaryPersonas: z.array(walletPersonaTypeSchema),
        confidence: ratio0to1Schema,
        personaScores: z
            .object({
                UNKNOWN: ratio0to1Schema,
                LONG_TERM_HOLDER: ratio0to1Schema,
                CASUAL_USER: ratio0to1Schema,
                DEFI_TRADER: ratio0to1Schema,
                MEMECOIN_TRADER: ratio0to1Schema,
                NFT_COLLECTOR: ratio0to1Schema,
                AIRDROP_FARMER: ratio0to1Schema,
                BOT_LIKE_TRADER: ratio0to1Schema,
                HIGH_RISK_SPECULATOR: ratio0to1Schema,
                SMART_MONEY_LIKE: ratio0to1Schema,
                WASH_TRADING_SUSPECT: ratio0to1Schema,
            })
            .strict(),
        reasoning: z.array(z.string().trim().min(1)),
        evidenceIds: z.array(z.string().trim().min(1)),
    })
    .strict();

export const evidenceBundleSchema: z.ZodType<EvidenceBundle> = z
    .object({
        id: z.string().trim().min(1),
        type: z.enum(["TRANSACTION_SIGNATURES", "METRIC_THRESHOLD", "TOKEN_HOLDING", "PROTOCOL_USAGE", "PNL_RESULT", "GRAPH_PATTERN"]),
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        relatedSignatures: z.array(z.string().trim().min(1)).optional(),
        relatedTokenMints: z.array(z.string().trim().min(1)).optional(),
        value: z.union([z.number(), z.string()]).nullable().optional(),
        threshold: z.union([z.number(), z.string()]).nullable().optional(),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().optional(),
    })
    .strict();

export const walletAIContextSchema: z.ZodType<WalletAIContext> = z
    .object({
        summaryFacts: z.array(z.string().trim().min(1)),
        doNotInferBeyond: z.array(z.string().trim().min(1)),
        recommendedTone: z.enum(["NEUTRAL", "CAUTIOUS", "WARNING", "POSITIVE"]),
        userLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
        language: z.enum(["vi", "en"]),
        maxSummaryLength: z.enum(["SHORT", "MEDIUM", "DETAILED"]),
    })
    .strict();

export const walletBehaviorProfileSchema: z.ZodType<WalletBehaviorProfile> = z
    .object({
        schemaVersion: z.string().trim().min(1),
        generatedAt: z.string().trim().min(1),
        wallet: walletIdentitySchema,
        analysisWindow: analysisWindowSchema,
        dataQuality: dataQualitySummarySchema,
        activity: walletActivityProfileSchema,
        portfolio: portfolioProfileSchema,
        trading: tradingBehaviorProfileSchema,
        pnl: pnlProfileSchema,
        protocolUsage: protocolUsageProfileSchema,
        risk: walletRiskProfileSchema,
        washTrading: washTradingProfileSchema,
        persona: walletPersonaProfileSchema,
        evidence: z.array(evidenceBundleSchema),
        aiContext: walletAIContextSchema,
    })
    .strict();

export const WalletBehaviorProfileSchema = walletBehaviorProfileSchema;

export function validateWalletBehaviorProfile(input: unknown): WalletBehaviorProfile {
    return walletBehaviorProfileSchema.parse(input);
}