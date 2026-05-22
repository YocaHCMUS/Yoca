import { mapProtocolSource } from "../utils/protocolUtils";
import {
    inferTradeDirection,
    isSolLikeMint,
    isStablecoinMint,
    SOL_MINT,
} from "../utils/tokenUtils";
import { classifyWalletEvent } from "./classifyWalletEvent";
import type {
    HeliusEnhancedTransactionLike,
    NormalizedNativeTransfer,
    NormalizedNftEvent,
    NormalizedSwap,
    NormalizedTokenTransfer,
    NormalizedWalletEvent,
    ProtocolInfo,
    TransactionFeeInfo,
    WalletEventDraft,
    WalletEventDirection,
} from "../types/normalizedWalletEvent";

const LAMPORTS_PER_SOL = 1_000_000_000;
const DEFAULT_PARSER_VERSION = "1.0.0";

function nowIsoString(): string {
    return new Date().toISOString();
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function normalizeAddressLike(...values: unknown[]): string {
    for (const value of values) {
        if (isNonEmptyString(value)) {
            return value.trim();
        }
    }
    return "";
}

function toFiniteNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function toNonNegativeNumber(value: unknown): number | null {
    const numeric = toFiniteNumber(value);
    if (numeric == null || numeric < 0) {
        return null;
    }
    return numeric;
}

function toAmountFromRaw(rawAmount: unknown, decimals: unknown): number | null {
    const rawNumeric = toFiniteNumber(rawAmount);
    const decimalsNumeric = toFiniteNumber(decimals);

    if (rawNumeric == null || rawNumeric < 0) {
        return null;
    }

    if (decimalsNumeric == null || decimalsNumeric <= 0) {
        return rawNumeric;
    }

    return rawNumeric / 10 ** decimalsNumeric;
}

function resolveTimestampIso(tx: HeliusEnhancedTransactionLike, warnings: string[]): string {
    const sourceTimestamp = tx.timestamp ?? tx.info?.timestamp;
    if (sourceTimestamp == null) {
        warnings.push("Transaction timestamp was missing; using normalization time instead.");
        return nowIsoString();
    }

    const date = new Date(sourceTimestamp * 1000);
    if (Number.isNaN(date.getTime())) {
        warnings.push("Transaction timestamp was invalid; using normalization time instead.");
        return nowIsoString();
    }

    return date.toISOString();
}

function resolveStatus(tx: HeliusEnhancedTransactionLike): "SUCCESS" | "FAILED" | "UNKNOWN" {
    const hasTransactionErrorProperty = Object.prototype.hasOwnProperty.call(tx, "transactionError");
    if (!hasTransactionErrorProperty) {
        return "SUCCESS";
    }

    if (tx.transactionError == null) {
        return "UNKNOWN";
    }

    return "FAILED";
}

function resolveTransferDirectionForWallet(
    walletAddress: string,
    from: string,
    to: string,
): "IN" | "OUT" | "NEUTRAL" | "UNKNOWN" {
    const walletMatchesFrom = from === walletAddress && from.length > 0;
    const walletMatchesTo = to === walletAddress && to.length > 0;

    if (walletMatchesFrom && walletMatchesTo) {
        return "NEUTRAL";
    }
    if (walletMatchesTo) {
        return "IN";
    }
    if (walletMatchesFrom) {
        return "OUT";
    }
    return "UNKNOWN";
}

function pickTokenAmount(transfer: any): { amount: number; rawAmount?: string | null; decimals?: number | null } {
    const directAmount = toNonNegativeNumber(transfer?.tokenAmount ?? transfer?.amount);
    if (directAmount != null) {
        return {
            amount: directAmount,
            rawAmount: isNonEmptyString(transfer?.rawAmount) ? String(transfer.rawAmount) : null,
            decimals: toFiniteNumber(transfer?.decimals),
        };
    }

    const rawAmount = transfer?.rawTokenAmount?.tokenAmount ?? transfer?.rawAmount?.tokenAmount;
    const decimals = transfer?.rawTokenAmount?.decimals ?? transfer?.decimals ?? transfer?.rawAmount?.decimals;
    const normalized = toAmountFromRaw(rawAmount, decimals);

    return {
        amount: normalized ?? 0,
        rawAmount: isNonEmptyString(rawAmount) ? String(rawAmount) : null,
        decimals: toFiniteNumber(decimals),
    };
}

function normalizeNativeTransfers(
    walletAddress: string,
    transfers: any[] | undefined,
): NormalizedNativeTransfer[] {
    const normalized: NormalizedNativeTransfer[] = [];

    for (const transfer of transfers ?? []) {
        const amountLamports = toNonNegativeNumber(transfer?.amount);
        if (amountLamports == null) {
            continue;
        }

        const from = normalizeAddressLike(transfer?.fromUserAccount, transfer?.fromWallet, transfer?.from);
        const to = normalizeAddressLike(transfer?.toUserAccount, transfer?.toWallet, transfer?.to);

        normalized.push({
            from,
            to,
            amountLamports,
            amountSol: amountLamports / LAMPORTS_PER_SOL,
            directionForWallet: resolveTransferDirectionForWallet(walletAddress, from, to),
        });
    }

    return normalized;
}

function normalizeTokenTransfers(
    walletAddress: string,
    transfers: any[] | undefined,
): NormalizedTokenTransfer[] {
    const normalized: NormalizedTokenTransfer[] = [];

    for (const transfer of transfers ?? []) {
        const mint = normalizeAddressLike(transfer?.mint);
        if (!mint) {
            continue;
        }

        const amountInfo = pickTokenAmount(transfer);
        const fromUserAccount = isNonEmptyString(transfer?.fromUserAccount) ? String(transfer.fromUserAccount).trim() : null;
        const toUserAccount = isNonEmptyString(transfer?.toUserAccount) ? String(transfer.toUserAccount).trim() : null;
        const fromTokenAccount = isNonEmptyString(transfer?.fromTokenAccount) ? String(transfer.fromTokenAccount).trim() : null;
        const toTokenAccount = isNonEmptyString(transfer?.toTokenAccount) ? String(transfer.toTokenAccount).trim() : null;
        const from = fromUserAccount ?? fromTokenAccount ?? "";
        const to = toUserAccount ?? toTokenAccount ?? "";

        normalized.push({
            mint,
            fromUserAccount,
            toUserAccount,
            fromTokenAccount,
            toTokenAccount,
            amount: amountInfo.amount,
            rawAmount: amountInfo.rawAmount ?? null,
            decimals: amountInfo.decimals ?? null,
            symbol: isNonEmptyString(transfer?.symbol) ? String(transfer.symbol).trim() : isNonEmptyString(transfer?.tokenSymbol) ? String(transfer.tokenSymbol).trim() : null,
            name: isNonEmptyString(transfer?.name) ? String(transfer.name).trim() : isNonEmptyString(transfer?.tokenName) ? String(transfer.tokenName).trim() : null,
            directionForWallet: resolveTransferDirectionForWallet(walletAddress, from, to),
            valueUsd: toNonNegativeNumber(transfer?.valueUsd),
        });
    }

    return normalized;
}

function extractSwapLeg(
    leg: any,
): { mint: string; amount: number; decimals: number | null; symbol?: string | null } | null {
    const mint = normalizeAddressLike(leg?.mint, leg?.inputMint, leg?.outputMint);
    if (!mint) {
        return null;
    }

    const rawAmount = leg?.rawTokenAmount?.tokenAmount ?? leg?.tokenAmount ?? leg?.amount;
    const decimals = leg?.rawTokenAmount?.decimals ?? leg?.decimals ?? null;
    const amount = toAmountFromRaw(rawAmount, decimals) ?? toNonNegativeNumber(rawAmount);

    if (amount == null) {
        return null;
    }

    return {
        mint,
        amount,
        decimals: toFiniteNumber(decimals),
        symbol: isNonEmptyString(leg?.symbol) ? String(leg.symbol).trim() : isNonEmptyString(leg?.tokenSymbol) ? String(leg.tokenSymbol).trim() : null,
    };
}

function normalizeSwap(tx: HeliusEnhancedTransactionLike, warnings: string[]): NormalizedSwap | null {
    const swap = tx.events?.swap;
    if (swap == null) {
        return null;
    }

    const swapLegs: Array<{ inputs?: any[]; outputs?: any[]; source?: string; programId?: string }> = [];
    if (Array.isArray(swap.innerSwaps) && swap.innerSwaps.length > 0) {
        for (const innerSwap of swap.innerSwaps) {
            swapLegs.push({
                inputs: Array.isArray(innerSwap?.tokenInputs) ? innerSwap.tokenInputs : [],
                outputs: Array.isArray(innerSwap?.tokenOutputs) ? innerSwap.tokenOutputs : [],
                source: innerSwap?.source,
                programId: innerSwap?.programId,
            });
        }
    } else {
        swapLegs.push({
            inputs: Array.isArray(swap.tokenInputs) ? swap.tokenInputs : [],
            outputs: Array.isArray(swap.tokenOutputs) ? swap.tokenOutputs : [],
            source: swap?.source,
            programId: swap?.programId,
        });
    }

    const flattenedInputs = swapLegs.flatMap((leg) => leg.inputs ?? []);
    const flattenedOutputs = swapLegs.flatMap((leg) => leg.outputs ?? []);

    const inputLeg = extractSwapLeg(flattenedInputs[0]);
    const outputLeg = extractSwapLeg(flattenedOutputs[0]);

    if (inputLeg == null || outputLeg == null) {
        warnings.push("Swap parser result was present but lacked enough token leg data to normalize the trade.");
        return null;
    }

    const protocol = mapProtocolSource(swapLegs[0]?.source ?? tx.source);
    const tradeDirectionForWallet = inferTradeDirection(inputLeg.mint, outputLeg.mint);
    const estimatedSwapValueUsd = inputLeg.mint && (isStablecoinMint(inputLeg.mint) || isSolLikeMint(inputLeg.mint))
        ? inputLeg.amount
        : outputLeg.mint && (isStablecoinMint(outputLeg.mint) || isSolLikeMint(outputLeg.mint))
            ? outputLeg.amount
            : null;

    return {
        inputMint: inputLeg.mint,
        outputMint: outputLeg.mint,
        inputSymbol: inputLeg.symbol ?? null,
        outputSymbol: outputLeg.symbol ?? null,
        inputAmount: inputLeg.amount,
        outputAmount: outputLeg.amount,
        inputValueUsd: isStablecoinMint(inputLeg.mint) ? inputLeg.amount : null,
        outputValueUsd: isStablecoinMint(outputLeg.mint) ? outputLeg.amount : null,
        estimatedSwapValueUsd,
        route: swapLegs
            .map((leg) => leg.source ?? leg.programId)
            .filter((entry): entry is string => isNonEmptyString(entry))
            .map((entry) => entry.trim())
            .filter((entry, index, array) => array.indexOf(entry) === index),
        dex: protocol.category === "DEX" ? protocol.name : null,
        tradeDirectionForWallet,
    };
}

function normalizeNftEvent(tx: HeliusEnhancedTransactionLike): NormalizedNftEvent | null {
    const nft = tx.events?.nft;
    if (nft == null) {
        return null;
    }

    const mint = normalizeAddressLike(nft?.mint, nft?.tokenMint, nft?.nftMint);
    if (!mint) {
        return null;
    }

    const actionRaw = String(nft?.action ?? nft?.type ?? nft?.eventType ?? "UNKNOWN").toUpperCase();
    let action: NormalizedNftEvent["action"] = "UNKNOWN";
    if (actionRaw.includes("PURCHASE") || actionRaw.includes("BUY")) {
        action = "PURCHASE";
    } else if (actionRaw.includes("SALE") || actionRaw.includes("SELL")) {
        action = "SALE";
    } else if (actionRaw.includes("LIST")) {
        action = "LIST";
    } else if (actionRaw.includes("DELIST")) {
        action = "DELIST";
    } else if (actionRaw.includes("TRANSFER_IN") || actionRaw === "IN") {
        action = "TRANSFER_IN";
    } else if (actionRaw.includes("TRANSFER_OUT") || actionRaw === "OUT") {
        action = "TRANSFER_OUT";
    }

    return {
        mint,
        name: isNonEmptyString(nft?.name) ? String(nft.name).trim() : null,
        collection: isNonEmptyString(nft?.collection) ? String(nft.collection).trim() : isNonEmptyString(nft?.collectionName) ? String(nft.collectionName).trim() : null,
        action,
        priceUsd: toNonNegativeNumber(nft?.priceUsd ?? nft?.salePriceUsd ?? nft?.amountUsd),
        marketplace: isNonEmptyString(nft?.marketplace) ? String(nft.marketplace).trim() : isNonEmptyString(nft?.source) ? String(nft.source).trim() : null,
    };
}

function normalizeFee(tx: HeliusEnhancedTransactionLike): TransactionFeeInfo | null {
    const feeLamports = toNonNegativeNumber(tx.fee ?? tx.info?.fee);
    const payer = normalizeAddressLike(tx.feePayer, tx.info?.feePayer);

    if (feeLamports == null && !payer) {
        return null;
    }

    return {
        feeLamports,
        feeSol: feeLamports == null ? null : feeLamports / LAMPORTS_PER_SOL,
        priorityFeeLamports: null,
        priorityFeeSol: null,
        payer: payer || null,
    };
}

function buildSummary(eventType: string, protocol: ProtocolInfo | null, swap: NormalizedSwap | null, nftEvent: NormalizedNftEvent | null): string {
    if (swap != null) {
        const protocolName = protocol?.name ?? "unknown protocol";
        return `${protocolName} swap: ${swap.tradeDirectionForWallet} ${swap.inputMint} → ${swap.outputMint}`;
    }

    if (nftEvent != null) {
        return `NFT ${nftEvent.action.toLowerCase()}: ${nftEvent.mint}`;
    }

    return `Wallet event classified as ${eventType}`;
}

function normalizeProtocol(tx: HeliusEnhancedTransactionLike): ProtocolInfo {
    return mapProtocolSource(tx.source ?? null);
}

export function normalizeHeliusTransactions(params: {
    walletAddress: string;
    transactions: HeliusEnhancedTransactionLike[];
    parserVersion?: string;
}): NormalizedWalletEvent[] {
    const parserVersion = params.parserVersion ?? DEFAULT_PARSER_VERSION;
    const walletAddress = params.walletAddress.trim();
    const events: NormalizedWalletEvent[] = [];

    for (const tx of params.transactions) {
        const signature = normalizeAddressLike(tx.signature);
        if (!signature || !walletAddress) {
            continue;
        }

        const warnings: string[] = [];
        const timestamp = resolveTimestampIso(tx, warnings);
        const protocol = normalizeProtocol(tx);
        const nativeTransfers = normalizeNativeTransfers(walletAddress, tx.nativeTransfers);
        const tokenTransfers = normalizeTokenTransfers(walletAddress, tx.tokenTransfers);
        const swap = normalizeSwap(tx, warnings);
        const nftEvent = normalizeNftEvent(tx);
        const fee = normalizeFee(tx);

        const classification = classifyWalletEvent({
            walletAddress,
            signature,
            transactionType: tx.type ?? null,
            description: tx.description ?? null,
            protocol,
            nativeTransfers,
            tokenTransfers,
            swap,
            nftEvent,
            warnings,
        });

        const status = resolveStatus(tx);
        const summary = buildSummary(classification.type, protocol, swap, nftEvent);
        const slot = tx.slot ?? tx.info?.slot ?? null;

        events.push({
            id: `${signature}:${walletAddress}`,
            walletAddress,
            signature,
            slot,
            timestamp,
            status,
            type: classification.type,
            direction: classification.direction,
            protocol,
            nativeTransfers,
            tokenTransfers,
            swap,
            nftEvent,
            fee,
            summary,
            rawSource: {
                provider: "HELIUS",
                parserVersion,
            },
            warnings: classification.warnings,
        });
    }

    return events;
}