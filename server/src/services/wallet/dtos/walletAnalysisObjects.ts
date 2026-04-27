import { z } from "zod";

export const walletAiAnalysisRequestSchema = z.object({
    address: z.string().trim().min(1),
    language: z.enum(["en", "vn"]).default("en"),
});

export type WalletAiAnalysisLanguage = "en" | "vn";

const walletAiAnalysisReferenceEntrySchema = z
    .object({
        ref_id: z.number(),
        type: z.enum(["wallet", "exchange", "token"]),
        address: z.string().trim().optional(),
        name: z.string().trim().optional(),
        symbol: z.string().trim().optional(),
        logoUri: z.string().trim().optional(),
    })
    .passthrough();

export const walletAiAnalysisResponseSchema = z
    .object({
        wallet_address: z.string().trim().min(1),
        data: z.object({
            swaps: z.enum(["ok", "insufficient_data"]),
            portfolio: z.enum(["ok", "insufficient_data"]),
            first_funder: z.enum(["ok", "insufficient_data"]),
            identity: z.enum(["ok", "insufficient_data"]),
        }),
        activity_profile: z.object({
            archetype: z.string().trim().min(1),
            activity_level: z.enum(["dormant", "low", "moderate", "high"]),
            last_active: z.string().trim().min(1),
        }),
        interaction_fingerprint: z.object({
            preferred_protocols: z.array(z.string().trim().min(1)).default([]),
            transaction_timing: z.enum(["uniform", "burst_mode", "sporadic"]),
            preffered_trading_tokens: z.array(z.string().trim().min(1)).default([]),
            preffered_holding_tokens: z.array(z.string().trim().min(1)).default([]),
            trading_volume_range: z.string().trim().min(1),
        }),
        funder: z.object({
            type: z.string().trim().min(1),
            notes: z.string().trim().min(1),
        }),
        wallet_age: z.object({
            category: z.enum(["new", "mid", "old", "unknown"]),
            first_seen: z.string().trim().min(1),
            consistency: z.string().trim().min(1),
        }),
        summary: z.string().trim().min(1),
        signals: z.array(z.string().trim().min(1)).default([]),
        reference: z.array(walletAiAnalysisReferenceEntrySchema).optional(),
    })
    .passthrough();

export const walletAiAnalysisWebhookPayloadSchema = z.union([
    walletAiAnalysisResponseSchema,
    z.array(walletAiAnalysisResponseSchema).min(1),
]);

export type WalletAiAnalysisResponse = z.infer<typeof walletAiAnalysisResponseSchema>;

export type WalletAnalysisErrorCode =
    | "invalid_address"
    | "dependency_not_ready"
    | "provider_timeout"
    | "provider_unavailable"
    | "provider_bad_payload"
    | "provider_unknown";

export type WalletAnalysisMissingDependency =
    | "identity"
    | "first_fund"
    | "portfolio"
    | "swaps";

export type WalletAnalysisErrorDetails = {
    missingDependencies?: WalletAnalysisMissingDependency[];
    providerStatusCode?: number;
    requestId?: string;
};
