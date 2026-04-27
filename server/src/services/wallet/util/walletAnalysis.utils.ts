import type {
    WalletAiAnalysisLanguage,
    WalletAiAnalysisResponse,
} from "@sv/services/wallet/dtos/walletAnalysisObjects.js";
import { walletAiAnalysisWebhookPayloadSchema, walletAiAnalysisResponseSchema } from "@sv/services/wallet/dtos/walletAnalysisObjects.js";

const DEFAULT_WALLET_AI_ANALYSIS_WEBHOOK_URL =
    "http://localhost:5678/webhook/analyse-wallet";

export function createWalletAiAnalysisRequestId(): string {
    return `wai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

export function resolveWalletAiAnalysisWebhookEndpoint(): string {
    const configured = process.env.WALLET_AI_ANALYSIS_WEBHOOK_URL?.trim();
    return configured && configured.length > 0
        ? configured
        : DEFAULT_WALLET_AI_ANALYSIS_WEBHOOK_URL;
}

export function normalizeWalletAiLanguage(
    language: string | undefined,
): WalletAiAnalysisLanguage {
    const normalized = language?.trim().toLowerCase();
    return normalized === "vn" ? "vn" : "en";
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value != null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function unwrapWebhookPayload(payload: unknown): unknown {
    let current: unknown = payload;

    if (Array.isArray(current)) {
        current = current[0];
    }

    const asObject = asRecord(current);
    if (asObject?.output !== undefined) {
        current = asObject.output;
    }

    if (Array.isArray(current)) {
        current = current[0];
    }

    return current;
}

export function normalizeWalletAiAnalysisWebhookPayload(
    payload: unknown,
): WalletAiAnalysisResponse {
    const unwrappedPayload = unwrapWebhookPayload(payload);
    const parsedPayload = walletAiAnalysisWebhookPayloadSchema.parse(unwrappedPayload);
    const normalized = Array.isArray(parsedPayload)
        ? parsedPayload[0]
        : parsedPayload;

    return walletAiAnalysisResponseSchema.parse(normalized);
}
