import { analyzeWalletWithAI, AnalyzeWalletWithAIError } from "../services/analyzeWalletWithAI.js";
import { isValidSolanaAddress } from "../utils/solanaAddressUtils.js";

import type { Context } from "hono";

type WalletAnalysisRequestBody = {
    walletAddress?: unknown;
    transactionLimit?: unknown;
    language?: unknown;
    userLevel?: unknown;
    maxSummaryLength?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTransactionLimit(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
}

function normalizeLanguage(value: unknown): "vi" | "en" | undefined {
    return value === "en" || value === "vi" ? value : undefined;
}

function normalizeUserLevel(value: unknown): "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | undefined {
    return value === "BEGINNER" || value === "INTERMEDIATE" || value === "ADVANCED" ? value : undefined;
}

function normalizeSummaryLength(value: unknown): "SHORT" | "MEDIUM" | "DETAILED" | undefined {
    return value === "SHORT" || value === "MEDIUM" || value === "DETAILED" ? value : undefined;
}

export async function handleAnalyzeWallet(c: Context) {
    let body: WalletAnalysisRequestBody = {};
    try {
        const rawBody = await c.req.json();
        if (isRecord(rawBody)) {
            body = rawBody;
        }
    } catch {
        body = {};
    }

    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
    if (!isValidSolanaAddress(walletAddress)) {
        return c.json(
            {
                success: false,
                error: {
                    code: "INVALID_WALLET_ADDRESS",
                    message: "Wallet address is invalid.",
                },
            },
            400,
        );
    }

    try {
        const result = await analyzeWalletWithAI({
            walletAddress,
            transactionLimit: normalizeTransactionLimit(body.transactionLimit),
            language: normalizeLanguage(body.language),
            userLevel: normalizeUserLevel(body.userLevel),
            maxSummaryLength: normalizeSummaryLength(body.maxSummaryLength),
        });

        return c.json({ success: true, data: result });
    } catch (error) {
        if (error instanceof AnalyzeWalletWithAIError) {
            const statusCode = error.code === "TRANSACTION_FETCH_FAILED" ? 502 : 500;
            return c.json(
                {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                },
                statusCode,
            );
        }

        return c.json(
            {
                success: false,
                error: {
                    code: "ANALYSIS_FAILED",
                    message: "Wallet analysis failed.",
                },
            },
            500,
        );
    }
}