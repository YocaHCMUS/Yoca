import { WalletBehaviorProfileSchema, walletPersonaTypeValues } from "../schemas/walletBehaviorProfile.schema";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type {
    WalletAIContext,
    WalletActivityProfile,
    WalletBehaviorProfile,
    WalletPersonaType,
} from "../types/walletBehaviorProfile";
import { analyzeActivity } from "./analyzeActivity";
import { analyzeDataQuality } from "./analyzeDataQuality";
import { analyzePnl } from "./analyzePnl";
import { analyzeProtocolUsage } from "./analyzeProtocolUsage";
import { analyzeTrading } from "./analyzeTrading";
import { sortEventsByTimestampAsc } from "../utils/timeUtils";

function createPersonaScoreMap(): Record<WalletPersonaType, number> {
    return Object.fromEntries(walletPersonaTypeValues.map((value) => [value, 0])) as Record<WalletPersonaType, number>;
}

function buildAiContext(params: {
    events: NormalizedWalletEvent[];
    dataQualityScore: number;
    activity: WalletActivityProfile;
    tradingSwapCount: number;
    protocolUsageDominant: string | null;
    pnlRealized: number | null;
    analysisVersion?: string;
}): WalletAIContext {
    const summaryFacts = [
        `Analyzed ${params.events.length} events.`,
        `Detected ${params.tradingSwapCount} swaps.`,
        `Data completeness score: ${params.dataQualityScore.toFixed(2)}.`,
        `Dominant protocol: ${params.protocolUsageDominant ?? "Unknown"}.`,
    ];

    if (params.pnlRealized == null) {
        summaryFacts.push("Realized PnL was not calculable from available swap USD values.");
    } else {
        summaryFacts.push(`Realized PnL: ${params.pnlRealized.toFixed(2)} USD.`);
    }

    if (params.analysisVersion != null && params.analysisVersion.trim().length > 0) {
        summaryFacts.push(`Analysis version: ${params.analysisVersion.trim()}.`);
    }

    return {
        summaryFacts,
        doNotInferBeyond: [
            "Do not claim this analysis represents the wallet's full history unless the analysis window is FULL_HISTORY.",
            "Do not claim confirmed fraud or wash trading.",
            "Do not infer intent beyond the computed metrics.",
        ],
        recommendedTone: params.dataQualityScore < 60 ? "CAUTIOUS" : "NEUTRAL",
        userLevel: "BEGINNER",
        language: "vi",
        maxSummaryLength: "SHORT",
    };
}

export function buildWalletBehaviorProfile(params: {
    walletAddress: string;
    events: NormalizedWalletEvent[];
    schemaVersion?: string;
    analysisVersion?: string;
}): WalletBehaviorProfile {
    const sortedEvents = sortEventsByTimestampAsc(params.events);
    const dataQuality = analyzeDataQuality(sortedEvents);
    const activity = analyzeActivity(sortedEvents);
    const trading = analyzeTrading(sortedEvents, activity);
    const protocolUsage = analyzeProtocolUsage(sortedEvents);
    const pnl = analyzePnl(sortedEvents);

    const oldestEvent = sortedEvents[0] ?? null;
    const newestEvent = sortedEvents[sortedEvents.length - 1] ?? null;

    const profile: WalletBehaviorProfile = {
        schemaVersion: params.schemaVersion ?? "1.0.0",
        generatedAt: new Date().toISOString(),
        wallet: {
            address: params.walletAddress,
            label: null,
            clusterId: null,
            firstSeenAt: null,
            lastSeenAt: null,
        },
        analysisWindow: {
            mode: "RECENT_TRANSACTIONS",
            transactionLimit: sortedEvents.length,
            fromTimestamp: oldestEvent?.timestamp ?? null,
            toTimestamp: newestEvent?.timestamp ?? null,
            latestSignatureAnalyzed: newestEvent?.signature ?? null,
            oldestSignatureAnalyzed: oldestEvent?.signature ?? null,
            actualTransactionCount: sortedEvents.length,
            successfulTransactionCount: sortedEvents.filter((event) => event.status === "SUCCESS").length,
            failedTransactionCount: sortedEvents.filter((event) => event.status === "FAILED").length,
            includedSignatures: sortedEvents.map((event) => event.signature),
        },
        dataQuality,
        activity,
        portfolio: {
            totalEstimatedValueUsd: null,
            tokenCount: 0,
            nftCount: null,
            stablecoinValueUsd: null,
            stablecoinRatio: null,
            topHoldings: [],
            concentration: {
                top1HoldingRatio: null,
                top3HoldingRatio: null,
                top5HoldingRatio: null,
                concentrationRisk: "UNKNOWN",
            },
        },
        trading,
        pnl,
        protocolUsage,
        risk: {
            riskScore: 0,
            trustScore: 0,
            riskLevel: "UNKNOWN",
            riskFactors: [],
            explanation: "Risk score has not been calculated yet.",
        },
        washTrading: {
            suspicionScore: 0,
            suspicionLevel: "UNKNOWN",
            signals: [],
            graphMetrics: {
                uniqueCounterparties: 0,
                repeatedCounterpartyRatio: null,
                circularFlowCount: null,
                reciprocityRatio: null,
                internalVolumeRatio: null,
            },
            explanation: "Wash trading analysis has not been calculated yet.",
        },
        persona: {
            primaryPersona: "UNKNOWN",
            secondaryPersonas: [],
            confidence: 0,
            personaScores: createPersonaScoreMap(),
            reasoning: [],
            evidenceIds: [],
        },
        evidence: [],
        aiContext: buildAiContext({
            events: sortedEvents,
            dataQualityScore: dataQuality.completenessScore,
            activity,
            tradingSwapCount: trading.swapCount,
            protocolUsageDominant: protocolUsage.dominantProtocol ?? null,
            pnlRealized: pnl.realizedPnlUsd ?? null,
            analysisVersion: params.analysisVersion,
        }),
    };

    return WalletBehaviorProfileSchema.parse(profile);
}