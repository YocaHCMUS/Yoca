import { z } from "zod";

import type {
    NormalizedNativeTransfer,
    NormalizedNftEvent,
    NormalizedSwap,
    NormalizedTokenTransfer,
    NormalizedWalletEvent,
    ProtocolInfo,
    TransactionFeeInfo,
    WalletEventDirection,
    WalletEventType,
} from "../types/normalizedWalletEvent";

function isIsoTimestampString(value: string): boolean {
    if (typeof value !== "string") {
        return false;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return false;
    }

    const time = Date.parse(trimmed);
    return Number.isFinite(time) && new Date(time).toISOString() === trimmed;
}

const isoTimestampSchema = z.string().trim().min(1).refine(isIsoTimestampString, {
    message: "Expected ISO timestamp",
});

const nonNegativeIntegerSchema = z.number().int().min(0);
const nonNegativeNumberSchema = z.number().min(0);
const nonEmptyStringSchema = z.string().trim().min(1);

export const protocolInfoSchema: z.ZodType<ProtocolInfo> = z
    .object({
        name: nonEmptyStringSchema,
        category: z.enum(["DEX", "LENDING", "NFT_MARKETPLACE", "STAKING", "BRIDGE", "CEX", "SYSTEM", "UNKNOWN"]),
        programId: z.string().trim().min(1).nullable().optional(),
    })
    .strict();

export const normalizedNativeTransferSchema: z.ZodType<NormalizedNativeTransfer> = z
    .object({
        from: z.string(),
        to: z.string(),
        amountSol: nonNegativeNumberSchema,
        amountLamports: nonNegativeNumberSchema,
        directionForWallet: z.enum(["IN", "OUT", "NEUTRAL", "UNKNOWN"]),
    })
    .strict();

export const normalizedTokenTransferSchema: z.ZodType<NormalizedTokenTransfer> = z
    .object({
        mint: nonEmptyStringSchema,
        fromUserAccount: z.string().trim().min(1).nullable().optional(),
        toUserAccount: z.string().trim().min(1).nullable().optional(),
        fromTokenAccount: z.string().trim().min(1).nullable().optional(),
        toTokenAccount: z.string().trim().min(1).nullable().optional(),
        amount: nonNegativeNumberSchema,
        rawAmount: z.string().trim().min(1).nullable().optional(),
        decimals: nonNegativeIntegerSchema.nullable().optional(),
        symbol: z.string().trim().min(1).nullable().optional(),
        name: z.string().trim().min(1).nullable().optional(),
        directionForWallet: z.enum(["IN", "OUT", "NEUTRAL", "UNKNOWN"]),
        valueUsd: nonNegativeNumberSchema.nullable().optional(),
    })
    .strict();

export const normalizedSwapSchema: z.ZodType<NormalizedSwap> = z
    .object({
        inputMint: nonEmptyStringSchema,
        outputMint: nonEmptyStringSchema,
        inputSymbol: z.string().trim().min(1).nullable().optional(),
        outputSymbol: z.string().trim().min(1).nullable().optional(),
        inputAmount: nonNegativeNumberSchema,
        outputAmount: nonNegativeNumberSchema,
        inputValueUsd: nonNegativeNumberSchema.nullable().optional(),
        outputValueUsd: nonNegativeNumberSchema.nullable().optional(),
        estimatedSwapValueUsd: nonNegativeNumberSchema.nullable().optional(),
        route: z.array(z.string().trim().min(1)).nullable().optional(),
        dex: z.string().trim().min(1).nullable().optional(),
        tradeDirectionForWallet: z.enum(["BUY", "SELL", "TOKEN_TO_TOKEN", "STABLE_TO_TOKEN", "TOKEN_TO_STABLE", "UNKNOWN"]),
    })
    .strict();

export const normalizedNftEventSchema: z.ZodType<NormalizedNftEvent> = z
    .object({
        mint: nonEmptyStringSchema,
        name: z.string().trim().min(1).nullable().optional(),
        collection: z.string().trim().min(1).nullable().optional(),
        action: z.enum(["TRANSFER_IN", "TRANSFER_OUT", "PURCHASE", "SALE", "LIST", "DELIST", "UNKNOWN"]),
        priceUsd: nonNegativeNumberSchema.nullable().optional(),
        marketplace: z.string().trim().min(1).nullable().optional(),
    })
    .strict();

export const transactionFeeInfoSchema: z.ZodType<TransactionFeeInfo> = z
    .object({
        feeLamports: nonNegativeIntegerSchema.nullable().optional(),
        feeSol: nonNegativeNumberSchema.nullable().optional(),
        priorityFeeLamports: nonNegativeIntegerSchema.nullable().optional(),
        priorityFeeSol: nonNegativeNumberSchema.nullable().optional(),
        payer: z.string().trim().min(1).nullable().optional(),
    })
    .strict();

export const normalizedWalletEventSchema: z.ZodType<NormalizedWalletEvent> = z
    .object({
        id: nonEmptyStringSchema,
        walletAddress: nonEmptyStringSchema,
        signature: nonEmptyStringSchema,
        slot: nonNegativeIntegerSchema.nullable().optional(),
        timestamp: isoTimestampSchema,
        status: z.enum(["SUCCESS", "FAILED", "UNKNOWN"]),
        type: z.enum([
            "SWAP",
            "TOKEN_TRANSFER_IN",
            "TOKEN_TRANSFER_OUT",
            "NATIVE_TRANSFER_IN",
            "NATIVE_TRANSFER_OUT",
            "NFT_TRANSFER_IN",
            "NFT_TRANSFER_OUT",
            "NFT_PURCHASE",
            "NFT_SALE",
            "STAKE",
            "UNSTAKE",
            "AIRDROP_CLAIM",
            "BRIDGE",
            "APPROVAL_OR_AUTHORITY_CHANGE",
            "UNKNOWN",
        ]) satisfies z.ZodType<WalletEventType>,
        direction: z.enum(["IN", "OUT", "BOTH", "NEUTRAL", "UNKNOWN"]) satisfies z.ZodType<WalletEventDirection>,
        protocol: protocolInfoSchema.nullable().optional(),
        nativeTransfers: z.array(normalizedNativeTransferSchema),
        tokenTransfers: z.array(normalizedTokenTransferSchema),
        swap: normalizedSwapSchema.nullable().optional(),
        nftEvent: normalizedNftEventSchema.nullable().optional(),
        fee: transactionFeeInfoSchema.nullable().optional(),
        summary: nonEmptyStringSchema,
        rawSource: z
            .object({
                provider: z.enum(["HELIUS", "JUPITER", "CUSTOM"]),
                parserVersion: nonEmptyStringSchema,
            })
            .strict(),
        warnings: z.array(z.string().trim().min(1)),
    })
    .strict();

export function validateNormalizedWalletEvent(input: unknown): NormalizedWalletEvent {
    return normalizedWalletEventSchema.parse(input);
}