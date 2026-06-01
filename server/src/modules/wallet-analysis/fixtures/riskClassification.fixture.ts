import { WalletBehaviorProfileSchema } from "../schemas/walletBehaviorProfile.schema";
import { enrichProfileWithRisk } from "../analyzers/enrichProfileWithRisk";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { WalletBehaviorProfile } from "../types/walletBehaviorProfile";

const WALLET_ADDRESS = "9xRiskFixtureWallet111111111111111111111111111111";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function createSwapEvent(params: {
    signature: string;
    timestamp: string;
    inputMint: string;
    outputMint: string;
    tradeDirectionForWallet: "BUY" | "SELL" | "TOKEN_TO_TOKEN" | "STABLE_TO_TOKEN" | "TOKEN_TO_STABLE" | "UNKNOWN";
    estimatedSwapValueUsd: number;
}): NormalizedWalletEvent {
    return {
        id: `${params.signature}:${WALLET_ADDRESS}`,
        walletAddress: WALLET_ADDRESS,
        signature: params.signature,
        slot: null,
        timestamp: params.timestamp,
        status: "SUCCESS",
        type: "SWAP",
        direction: "BOTH",
        protocol: {
            name: "Jupiter",
            category: "DEX",
            programId: null,
        },
        nativeTransfers: [],
        tokenTransfers: [],
        swap: {
            inputMint: params.inputMint,
            outputMint: params.outputMint,
            inputSymbol: null,
            outputSymbol: null,
            inputAmount: 100,
            outputAmount: 100,
            inputValueUsd: params.estimatedSwapValueUsd,
            outputValueUsd: params.estimatedSwapValueUsd,
            estimatedSwapValueUsd: params.estimatedSwapValueUsd,
            route: ["Jupiter"],
            dex: "Jupiter",
            tradeDirectionForWallet: params.tradeDirectionForWallet,
        },
        nftEvent: null,
        fee: {
            feeLamports: 5000,
            feeSol: 0.000005,
            priorityFeeLamports: 0,
            priorityFeeSol: 0,
            payer: WALLET_ADDRESS,
        },
        summary: "Fixture swap event for risk evidence validation.",
        rawSource: {
            provider: "CUSTOM",
            parserVersion: "risk-fixture-1.0.0",
        },
        warnings: [],
    };
}

const RISK_CLASSIFICATION_FIXTURE_EVENTS: NormalizedWalletEvent[] = [
    createSwapEvent({ signature: "sig-risk-001", timestamp: "2026-05-22T10:05:00.000Z", inputMint: USDC_MINT, outputMint: "TokenAlpha1111111111111111111111111111111111", tradeDirectionForWallet: "BUY", estimatedSwapValueUsd: 100 }),
    createSwapEvent({ signature: "sig-risk-002", timestamp: "2026-05-22T10:18:00.000Z", inputMint: "TokenAlpha1111111111111111111111111111111111", outputMint: USDC_MINT, tradeDirectionForWallet: "SELL", estimatedSwapValueUsd: 80 }),
    createSwapEvent({ signature: "sig-risk-003", timestamp: "2026-05-22T10:22:00.000Z", inputMint: USDC_MINT, outputMint: "TokenBeta1111111111111111111111111111111111", tradeDirectionForWallet: "BUY", estimatedSwapValueUsd: 140 }),
    createSwapEvent({ signature: "sig-risk-004", timestamp: "2026-05-22T10:41:00.000Z", inputMint: "TokenBeta1111111111111111111111111111111111", outputMint: USDC_MINT, tradeDirectionForWallet: "SELL", estimatedSwapValueUsd: 90 }),
    createSwapEvent({ signature: "sig-risk-005", timestamp: "2026-05-22T10:43:00.000Z", inputMint: USDC_MINT, outputMint: "TokenGamma111111111111111111111111111111111", tradeDirectionForWallet: "BUY", estimatedSwapValueUsd: 120 }),
    createSwapEvent({ signature: "sig-risk-006", timestamp: "2026-05-22T10:49:00.000Z", inputMint: "TokenGamma111111111111111111111111111111111", outputMint: USDC_MINT, tradeDirectionForWallet: "SELL", estimatedSwapValueUsd: 70 }),
    createSwapEvent({ signature: "sig-risk-007", timestamp: "2026-05-22T10:52:00.000Z", inputMint: USDC_MINT, outputMint: "TokenDelta1111111111111111111111111111111111", tradeDirectionForWallet: "BUY", estimatedSwapValueUsd: 110 }),
    createSwapEvent({ signature: "sig-risk-008", timestamp: "2026-05-22T10:57:00.000Z", inputMint: "TokenDelta1111111111111111111111111111111111", outputMint: USDC_MINT, tradeDirectionForWallet: "SELL", estimatedSwapValueUsd: 60 }),
    createSwapEvent({ signature: "sig-risk-009", timestamp: "2026-05-22T10:59:00.000Z", inputMint: USDC_MINT, outputMint: "TokenEpsilon11111111111111111111111111111111", tradeDirectionForWallet: "BUY", estimatedSwapValueUsd: 95 }),
    createSwapEvent({ signature: "sig-risk-010", timestamp: "2026-05-22T10:59:30.000Z", inputMint: "TokenEpsilon11111111111111111111111111111111", outputMint: USDC_MINT, tradeDirectionForWallet: "SELL", estimatedSwapValueUsd: 55 }),
];

const baseProfile: WalletBehaviorProfile = {
    schemaVersion: "1.0.0",
    generatedAt: "2026-05-22T00:00:00.000Z",
    wallet: {
        address: WALLET_ADDRESS,
        label: null,
        clusterId: null,
        firstSeenAt: null,
        lastSeenAt: null,
    },
    analysisWindow: {
        mode: "RECENT_TRANSACTIONS",
        transactionLimit: 120,
        fromTimestamp: "2026-05-01T00:00:00.000Z",
        toTimestamp: "2026-05-22T00:00:00.000Z",
        latestSignatureAnalyzed: "sig-120",
        oldestSignatureAnalyzed: "sig-1",
        actualTransactionCount: 120,
        successfulTransactionCount: 116,
        failedTransactionCount: 4,
        includedSignatures: Array.from({ length: 120 }, (_, index) => `sig-${index + 1}`),
    },
    dataQuality: {
        completenessScore: 58,
        missingPriceCount: 12,
        missingTokenMetadataCount: 3,
        unsupportedTransactionCount: 11,
        suspiciousParsingCount: 2,
        warnings: ["Some price data is missing."],
    },
    activity: {
        activeDays: 14,
        averageTransactionsPerDay: 8.57,
        firstTransactionAt: "2026-05-01T00:00:00.000Z",
        lastTransactionAt: "2026-05-22T00:00:00.000Z",
        maxTransactionsInOneHour: 40,
        medianTimeBetweenTransactionsSeconds: 28,
        burstActivityScore: 85,
        failedTransactionRatio: 0.0333,
        activityLevel: "EXTREME",
    },
    portfolio: {
        totalEstimatedValueUsd: 22000,
        tokenCount: 35,
        nftCount: 0,
        stablecoinValueUsd: 5000,
        stablecoinRatio: 0.2272,
        topHoldings: [],
        concentration: {
            top1HoldingRatio: 0.31,
            top3HoldingRatio: 0.65,
            top5HoldingRatio: 0.82,
            concentrationRisk: "MEDIUM",
        },
    },
    trading: {
        swapCount: 80,
        buyCount: 44,
        sellCount: 36,
        uniqueTokensTraded: 35,
        uniqueTokensBought: 25,
        uniqueTokensSold: 21,
        totalVolumeUsd: 15400,
        averageTradeSizeUsd: 192.5,
        medianTradeSizeUsd: 88.4,
        largestTradeUsd: 2400,
        stablecoinUsageRatio: 0.6,
        averageHoldingPeriodHours: 10,
        medianHoldingPeriodHours: 0.5,
        shortTermTradeRatio: 0.75,
        longTermHoldRatio: 0.05,
        tradingStyle: "HIGH_FREQUENCY_TRADER",
    },
    pnl: {
        realizedPnlUsd: -500,
        unrealizedPnlUsd: null,
        totalPnlUsd: -500,
        closedPositionCount: 12,
        openPositionCount: 3,
        winningTradeCount: 4,
        losingTradeCount: 8,
        winRate: 0.32,
        lossRate: 0.68,
        averageWinUsd: 120,
        averageLossUsd: -180,
        bestTradeUsd: 420,
        worstTradeUsd: -640,
        profitFactor: 0.62,
        pnlStatus: "UNPROFITABLE",
        calculationMethod: "FIFO",
        limitations: ["Unrealized PnL is unavailable."],
    },
    protocolUsage: {
        protocols: [
            { protocolName: "Jupiter", category: "DEX", transactionCount: 95, volumeUsd: 12000, usageRatio: 0.79 },
            { protocolName: "Raydium", category: "DEX", transactionCount: 25, volumeUsd: 3400, usageRatio: 0.21 },
        ],
        dominantProtocol: "Jupiter",
        dexUsageRatio: 0.83,
        lendingUsageRatio: 0,
        nftMarketplaceUsageRatio: 0,
        stakingUsageRatio: 0,
    },
    risk: {
        riskScore: 0,
        trustScore: 0,
        riskLevel: "UNKNOWN",
        riskFactors: [],
        explanation: "Risk score has not been calculated yet.",
    },
    washTrading: {
        suspicionScore: 18,
        suspicionLevel: "LOW",
        signals: [],
        graphMetrics: {
            uniqueCounterparties: 44,
            repeatedCounterpartyRatio: 0.08,
            circularFlowCount: 0,
            reciprocityRatio: 0.14,
            internalVolumeRatio: 0.02,
        },
        explanation: "Wash trading analysis has not been calculated yet.",
    },
    persona: {
        primaryPersona: "HIGH_RISK_SPECULATOR",
        secondaryPersonas: ["BOT_LIKE_TRADER", "MEMECOIN_TRADER"],
        confidence: 0.82,
        personaScores: {
            UNKNOWN: 0,
            LONG_TERM_HOLDER: 2,
            CASUAL_USER: 8,
            DEFI_TRADER: 18,
            MEMECOIN_TRADER: 74,
            NFT_COLLECTOR: 0,
            AIRDROP_FARMER: 3,
            BOT_LIKE_TRADER: 66,
            HIGH_RISK_SPECULATOR: 90,
            SMART_MONEY_LIKE: 4,
            WASH_TRADING_SUSPECT: 5,
        },
        reasoning: ["High short-term trading activity and negative realized PnL suggest elevated risk."],
        evidenceIds: [],
    },
    evidence: [],
    aiContext: {
        summaryFacts: ["Fixture profile for risk scoring."],
        doNotInferBeyond: ["Do not infer intent beyond the computed metrics."],
        recommendedTone: "CAUTIOUS",
        userLevel: "BEGINNER",
        language: "en",
        maxSummaryLength: "SHORT",
    },
};

export const RISK_CLASSIFICATION_FIXTURE_PROFILE = enrichProfileWithRisk({ profile: baseProfile, events: RISK_CLASSIFICATION_FIXTURE_EVENTS });

export const RISK_CLASSIFICATION_FIXTURE_VALIDATED = WalletBehaviorProfileSchema.parse(RISK_CLASSIFICATION_FIXTURE_PROFILE);