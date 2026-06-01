import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { DataQualitySummary } from "../types/walletBehaviorProfile";
import { clamp, safeDivide } from "../utils/mathUtils";

export function analyzeDataQuality(events: NormalizedWalletEvent[]): DataQualitySummary {
    if (events.length === 0) {
        return {
            completenessScore: 0,
            missingPriceCount: 0,
            missingTokenMetadataCount: 0,
            unsupportedTransactionCount: 0,
            suspiciousParsingCount: 0,
            warnings: [],
        };
    }

    const swapEvents = events.filter((event) => event.type === "SWAP" && event.swap != null);
    const missingPriceCount = swapEvents.filter((event) => {
        const swap = event.swap!;
        return swap.estimatedSwapValueUsd == null && swap.inputValueUsd == null && swap.outputValueUsd == null;
    }).length;
    const unsupportedTransactionCount = events.filter((event) => event.type === "UNKNOWN").length;
    const suspiciousParsingCount = events.filter((event) => event.warnings.length > 0).length;
    const failedTransactionCount = events.filter((event) => event.status === "FAILED").length;
    const warnings = [...new Set(events.flatMap((event) => event.warnings))].slice(0, 10);

    const missingPriceRatio = safeDivide(missingPriceCount, Math.max(1, swapEvents.length), 0) ?? 0;
    const unsupportedRatio = safeDivide(unsupportedTransactionCount, events.length, 0) ?? 0;
    const suspiciousParsingRatio = safeDivide(suspiciousParsingCount, events.length, 0) ?? 0;
    const failedTransactionRatio = safeDivide(failedTransactionCount, events.length, 0) ?? 0;

    const completenessScore = clamp(
        100
            - missingPriceRatio * 30
            - unsupportedRatio * 30
            - suspiciousParsingRatio * 20
            - failedTransactionRatio * 20,
        0,
        100,
    );

    return {
        completenessScore,
        missingPriceCount,
        missingTokenMetadataCount: 0,
        unsupportedTransactionCount,
        suspiciousParsingCount,
        warnings,
    };
}