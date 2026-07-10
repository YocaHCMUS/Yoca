import { db } from "@sv/db/index.js";
import { walletAiAnalysisCache } from "@sv/db/schema.js";
import type {
    WalletAiAnalysisLanguage,
    WalletAiAnalysisResponse,
} from "@sv/services/wallet/dtos/walletAnalysisObjects.js";
import { walletAiAnalysisResponseSchema } from "@sv/services/wallet/dtos/walletAnalysisObjects.js";
import { eq } from "drizzle-orm";

const WALLET_AI_ANALYSIS_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

type WalletAnalysisCacheRow = typeof walletAiAnalysisCache.$inferSelect;

let warnedMissingWalletAiAnalysisCacheTable = false;

function isMissingWalletAiAnalysisCacheTableError(error: unknown): boolean {
    if (error == null || typeof error !== "object") {
        return false;
    }

    const record = error as {
        cause?: { code?: unknown };
        message?: unknown;
    };

    if (record.cause != null && typeof record.cause === "object") {
        const causeCode = (record.cause as { code?: unknown }).code;
        if (causeCode === "42P01") {
            return true;
        }
    }

    if (typeof record.message !== "string") {
        return false;
    }

    return (
        record.message.includes("wallet_ai_analysis_cache") &&
        record.message.toLowerCase().includes("does not exist")
    );
}

function warnMissingWalletAiAnalysisCacheTableOnce(): void {
    if (warnedMissingWalletAiAnalysisCacheTable) {
        return;
    }

    warnedMissingWalletAiAnalysisCacheTable = true;
    console.warn(
        "[wallet-ai-analysis-cache] wallet_ai_analysis_cache table not found; continuing without AI analysis DB cache until migration is applied",
    );
}

export function createWalletAiAnalysisCacheKey(input: {
    address: string;
    language: WalletAiAnalysisLanguage;
    modelVersion?: string;
    promptVersion?: string;
}): string {
    const modelPart = input.modelVersion?.trim() || "-";
    const promptPart = input.promptVersion?.trim() || "-";
    return `wai:${input.address}:${input.language}:${modelPart}:${promptPart}`;
}

export async function getCachedWalletAiAnalysis(
    key: string,
): Promise<WalletAiAnalysisResponse | null> {
    let rows: WalletAnalysisCacheRow[];

    try {
        rows = await db
            .select()
            .from(walletAiAnalysisCache)
            .where(eq(walletAiAnalysisCache.key, key))
            .limit(1);
    } catch (error) {
        if (isMissingWalletAiAnalysisCacheTableError(error)) {
            warnMissingWalletAiAnalysisCacheTableOnce();
            return null;
        }

        throw error;
    }

    if (rows.length === 0) {
        return null;
    }

    const row = rows[0];
    const fetchedAt =
        row.fetchedAt instanceof Date
            ? row.fetchedAt
            : new Date(row.fetchedAt ?? Date.now());

    const isFresh = fetchedAt.getTime() >= Date.now() - WALLET_AI_ANALYSIS_CACHE_TTL_MS;
    if (!isFresh) {
        return null;
    }

    try {
        return walletAiAnalysisResponseSchema.parse(row.normalized);
    } catch {
        return null;
    }
}

export async function saveCachedWalletAiAnalysis(input: {
    key: string;
    address: string;
    language: WalletAiAnalysisLanguage;
    modelVersion?: string;
    promptVersion?: string;
    raw: unknown;
    normalized: WalletAiAnalysisResponse;
}): Promise<void> {
    try {
        await db
            .insert(walletAiAnalysisCache)
            .values({
                key: input.key,
                address: input.address,
                language: input.language,
                modelVersion: input.modelVersion ?? null,
                promptVersion: input.promptVersion ?? null,
                raw: input.raw,
                normalized: input.normalized,
                fetchedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [walletAiAnalysisCache.key],
                set: {
                    raw: input.raw,
                    normalized: input.normalized,
                    fetchedAt: new Date(),
                    updatedAt: new Date(),
                    address: input.address,
                    language: input.language,
                    modelVersion: input.modelVersion ?? null,
                    promptVersion: input.promptVersion ?? null,
                },
            });
    } catch (error) {
        if (isMissingWalletAiAnalysisCacheTableError(error)) {
            warnMissingWalletAiAnalysisCacheTableOnce();
            return;
        }

        throw error;
    }
}
