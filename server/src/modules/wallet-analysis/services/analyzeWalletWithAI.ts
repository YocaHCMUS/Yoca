import { WalletBehaviorProfileSchema } from "../schemas/walletBehaviorProfile.schema.js";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent.js";
import type { WalletAISummary } from "../../../services/wallet/walletAiSummary.service.js";
import type { WalletBehaviorProfile } from "../types/walletBehaviorProfile.js";
import { normalizeHeliusTransactions } from "../normalizers/normalizeHeliusTransactions.js";
import { buildWalletBehaviorProfile } from "../analyzers/buildWalletBehaviorProfile.js";
import { enrichProfileWithPersona } from "../analyzers/enrichProfileWithPersona.js";
import { enrichProfileWithRisk } from "../analyzers/enrichProfileWithRisk.js";
import { buildWalletAiSummaryFallback, summarizeWalletWithGemini } from "../../../services/wallet/walletAiSummary.service.js";
import {
    getWalletAnalysisTransactions,
    type WalletAnalysisTransactionSource,
} from "./walletAnalysisDataSource.js";
import { isValidSolanaAddress } from "../utils/solanaAddressUtils.js";

const DEFAULT_TRANSACTION_LIMIT = 200;
const MIN_TRANSACTION_LIMIT = 20;
const MAX_TRANSACTION_LIMIT = 300;

export type AnalyzeWalletWithAIResult = {
    walletAddress: string;
    profile: WalletBehaviorProfile;
    aiSummary: WalletAISummary;
    generatedAt: string;
    debug?: {
        transactionSource: WalletAnalysisTransactionSource;
        rawTransactionCount: number;
        normalizedEventCount: number;
        warnings: string[];
    };
};

export type AnalyzeWalletWithAIParams = {
    walletAddress: string;
    transactionLimit?: number;
    language?: "vi" | "en";
    userLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    maxSummaryLength?: "SHORT" | "MEDIUM" | "DETAILED";
};

export type AnalyzeWalletWithAIErrorCode =
    | "INVALID_WALLET_ADDRESS"
    | "TRANSACTION_FETCH_FAILED"
    | "ANALYSIS_FAILED";

export class AnalyzeWalletWithAIError extends Error {
    constructor(
        public readonly code: AnalyzeWalletWithAIErrorCode,
        message: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = "AnalyzeWalletWithAIError";
    }
}

function clampTransactionLimit(value?: number): number {
    const parsed = Number(value ?? DEFAULT_TRANSACTION_LIMIT);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_TRANSACTION_LIMIT;
    }

    return Math.min(Math.max(Math.floor(parsed), MIN_TRANSACTION_LIMIT), MAX_TRANSACTION_LIMIT);
}

function applyAiPreferences(profile: WalletBehaviorProfile, params: AnalyzeWalletWithAIParams): WalletBehaviorProfile {
    return WalletBehaviorProfileSchema.parse({
        ...profile,
        aiContext: {
            ...profile.aiContext,
            language: params.language ?? "vi",
            userLevel: params.userLevel ?? "BEGINNER",
            maxSummaryLength: params.maxSummaryLength ?? "SHORT",
        },
        analysisWindow: {
            ...profile.analysisWindow,
            transactionLimit: clampTransactionLimit(params.transactionLimit),
        },
    });
}

export async function analyzeWalletWithAI(params: AnalyzeWalletWithAIParams): Promise<AnalyzeWalletWithAIResult> {
    const walletAddress = params.walletAddress.trim();
    if (!isValidSolanaAddress(walletAddress)) {
        throw new AnalyzeWalletWithAIError(
            "INVALID_WALLET_ADDRESS",
            "Wallet address is invalid.",
        );
    }

    const transactionLimit = clampTransactionLimit(params.transactionLimit);

    let dataSourceResult: Awaited<ReturnType<typeof getWalletAnalysisTransactions>>;
    try {
        dataSourceResult = await getWalletAnalysisTransactions({
            walletAddress,
            limit: transactionLimit,
        });
    } catch (error) {
        throw new AnalyzeWalletWithAIError(
            "TRANSACTION_FETCH_FAILED",
            "Failed to load wallet transactions for AI analysis.",
            error,
        );
    }

    let events: NormalizedWalletEvent[];
    try {
        events = normalizeHeliusTransactions({
            walletAddress,
            transactions: dataSourceResult.transactions,
        });
    } catch (error) {
        throw new AnalyzeWalletWithAIError(
            "ANALYSIS_FAILED",
            "Failed to normalize wallet transactions.",
            error,
        );
    }

    let profile: WalletBehaviorProfile;
    try {
        profile = buildWalletBehaviorProfile({ walletAddress, events });
        profile = applyAiPreferences(profile, params);
        if (dataSourceResult.warnings.length > 0) {
            profile = WalletBehaviorProfileSchema.parse({
                ...profile,
                dataQuality: {
                    ...profile.dataQuality,
                    warnings: [
                        ...profile.dataQuality.warnings,
                        ...dataSourceResult.warnings,
                    ],
                },
            });
        }
        profile = enrichProfileWithPersona({ profile, events });
        profile = enrichProfileWithRisk({ profile, events });
    } catch (error) {
        throw new AnalyzeWalletWithAIError(
            "ANALYSIS_FAILED",
            "Failed to build wallet analysis profile.",
            error,
        );
    }

    const rawTransactionCount = dataSourceResult.transactions.length;
    const normalizedEventCount = events.length;
    const warnings = [
        ...dataSourceResult.warnings,
        ...events.flatMap((event) => event.warnings),
    ];

    console.info("[wallet-analysis] analyzed wallet", {
        walletAddress,
        transactionSource: dataSourceResult.source,
        rawTransactionCount,
        normalizedEventCount,
        warnings,
    });

    const aiSummary = events.length === 0
        ? {
            ...buildWalletAiSummaryFallback(profile),
            shortSummary: "No analyzable wallet activity was found in the current analysis window.",
            riskSummary: "Risk is UNKNOWN because no analyzable transactions were found.",
            pnlSummary: "PnL is unavailable because no analyzable transactions were found.",
            behaviorInsights: [
                {
                    title: "No analyzable activity",
                    explanation: "The transaction data loaded successfully, but no wallet events were available for evidence-backed analysis.",
                    evidenceIds: [],
                },
            ],
            suspiciousFindings: [],
            confidenceNote: "No evidence-backed findings can be produced without analyzable wallet events.",
        }
        : await summarizeWalletWithGemini({ profile });

    const debug = process.env.NODE_ENV === "development"
        ? {
            transactionSource: dataSourceResult.source,
            rawTransactionCount,
            normalizedEventCount,
            warnings,
        }
        : undefined;

    return {
        walletAddress,
        profile,
        aiSummary,
        generatedAt: new Date().toISOString(),
        ...(debug ? { debug } : {}),
    };
}
