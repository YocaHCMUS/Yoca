import { resolveEnhancedTransactions } from "../../../services/wallet/providers/walletEnhancedTx.service.js";
import type { HeliusEnhancedTransactionLike } from "../types/normalizedWalletEvent.js";
import { fetchWalletTransactions } from "./walletTransactionFetcher.js";

export type WalletAnalysisTransactionSource =
    | "CACHE"
    | "CACHE_PLUS_HELIUS"
    | "HELIUS_DIRECT";

function timestampMs(tx: HeliusEnhancedTransactionLike): number {
    const timestamp = Number(tx.timestamp ?? tx.info?.timestamp ?? 0);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp * 1000 : 0;
}

function latestTransactions(
    transactions: HeliusEnhancedTransactionLike[],
    limit: number,
): HeliusEnhancedTransactionLike[] {
    return [...transactions]
        .sort((left, right) => timestampMs(right) - timestampMs(left))
        .slice(0, limit);
}

function defaultAnalysisRangeMs(): { fromMs: number; toMs: number } {
    const toMs = Date.now();
    const fromMs = toMs - 30 * 24 * 60 * 60 * 1000;
    return { fromMs, toMs };
}

export async function getWalletAnalysisTransactions(params: {
    walletAddress: string;
    limit: number;
}): Promise<{
    transactions: HeliusEnhancedTransactionLike[];
    source: WalletAnalysisTransactionSource;
    warnings: string[];
}> {
    const limit = Math.max(1, Math.floor(params.limit));
    const warnings: string[] = [];
    const range = defaultAnalysisRangeMs();
    let enhancedPipelineReturnedEmpty = false;

    try {
        const enhancedTransactions = await resolveEnhancedTransactions(
            params.walletAddress,
            range.fromMs,
            range.toMs,
        );

        if (enhancedTransactions.length > 0) {
            return {
                transactions: latestTransactions(enhancedTransactions as HeliusEnhancedTransactionLike[], limit),
                source: "CACHE_PLUS_HELIUS",
                warnings,
            };
        }

        enhancedPipelineReturnedEmpty = true;
        warnings.push("Cached/enriched wallet transaction pipeline returned no transactions for the analysis window.");
    } catch (error) {
        warnings.push(
            error instanceof Error
                ? `Cached/enriched wallet transaction pipeline failed: ${error.message}`
                : "Cached/enriched wallet transaction pipeline failed.",
        );
    }

    try {
        const directTransactions = await fetchWalletTransactions({
            walletAddress: params.walletAddress,
            limit,
        });

        return {
            transactions: latestTransactions(directTransactions, limit),
            source: "HELIUS_DIRECT",
            warnings,
        };
    } catch (error) {
        warnings.push(
            error instanceof Error
                ? `Direct Helius fallback failed: ${error.message}`
                : "Direct Helius fallback failed.",
        );
        if (enhancedPipelineReturnedEmpty) {
            return {
                transactions: [],
                source: "CACHE_PLUS_HELIUS",
                warnings,
            };
        }
        throw new Error("Unable to load wallet transactions for AI analysis.", {
            cause: error,
        });
    }
}
