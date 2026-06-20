import { getTokenMeta } from "../tokens/token-info.js";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import { resolveTokenPriceAtTimestamp, resolveTokenPricesAtTimestamp } from "@sv/services/wallet/providers/resolve-token-price.js";
import type { WalletTransaction, WalletTransfer, WalletSwap } from "./dtos/walletDataObjects.js";
import { SOL_MINT } from "./wallet.constants.js";
import { isMissingPortfolioLogoUri, isValidPortfolioTokenAddress, normalizePortfolioAddressKey, normalizePortfolioLookupAddress, normalizePortfolioText, shouldFillPortfolioText } from "./walletData.core.js";

export async function enrichWithSolanaTokenPrices(
    transactions: WalletTransaction[] | WalletTransfer[] | WalletSwap[],
): Promise<void> {
    type RecordLike = Record<string, unknown>;
    const counters = {
        candidatesCollected: 0,
        invalidCandidatesDropped: 0,
        tokenMetaHits: 0,
        tokenMetaMisses: 0,
        marketDataHits: 0,
        marketDataMisses: 0,
        transferFieldFills: 0,
        swapFieldFills: 0,
        transactionFieldFills: 0,
        invalidEntriesSkipped: 0,
    };

    const toOptionalString = (value: unknown): string | undefined => {
        if (typeof value !== "string") {
            return undefined;
        }

        const normalized = normalizePortfolioText(value);
        return normalized ?? undefined;
    };

    const toOptionalFiniteNumber = (value: unknown): number | undefined => {
        if (value == null) {
            return undefined;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const toTokenDisplaySymbol = (value: unknown, fallback = "Unknown"): string => {
        const fromString = toOptionalString(value);
        if (fromString) {
            return fromString;
        }

        if (value && typeof value === "object") {
            const nestedSymbol = toOptionalString((value as RecordLike).symbol);
            if (nestedSymbol) {
                return nestedSymbol;
            }
        }

        const normalizedFallback = toOptionalString(fallback);
        return normalizedFallback || "Unknown";
    };

    const isRecord = (value: unknown): value is RecordLike =>
        Boolean(value) && typeof value === "object";

    const isWalletTransactionRecord = (value: unknown): value is WalletTransaction =>
        isRecord(value) && ("hash" in value);

    const isWalletTransferRecord = (value: unknown): value is WalletTransfer =>
        isRecord(value) && ("transactionSignature" in value);

    const isWalletSwapRecord = (value: unknown): value is WalletSwap =>
        isRecord(value) && ("bought" in value || "sold" in value || "transactionHash" in value);

    const resolveLookupAndKey = (
        rawTokenAddress: unknown,
        rawTokenSymbol?: unknown,
    ): { lookupAddress: string; addressKey: string } | undefined => {
        const normalizedSymbol = normalizePortfolioText(toOptionalString(rawTokenSymbol));
        if (normalizedSymbol?.toLowerCase() === "sol") {
            const lookupAddress = normalizePortfolioLookupAddress(SOL_MINT);
            return {
                lookupAddress,
                addressKey: normalizePortfolioAddressKey(lookupAddress),
            };
        }

        const normalizedAddress = normalizePortfolioText(toOptionalString(rawTokenAddress));
        if (!normalizedAddress) {
            counters.invalidCandidatesDropped += 1;
            return undefined;
        }

        const lookupAddress = normalizePortfolioLookupAddress(normalizedAddress);
        if (!isValidPortfolioTokenAddress(lookupAddress)) {
            counters.invalidCandidatesDropped += 1;
            return undefined;
        }

        return {
            lookupAddress,
            addressKey: normalizePortfolioAddressKey(lookupAddress),
        };
    };

    const collectTransactionCandidateAddress = (
        tx: WalletTransaction,
        candidateAddressesByKey: Map<string, string>,
    ) => {
        const resolved = resolveLookupAndKey(tx.primaryTokenAddress, tx.primaryTokenSymbol);
        if (!resolved) {
            return;
        }

        candidateAddressesByKey.set(resolved.addressKey, resolved.lookupAddress);
        counters.candidatesCollected += 1;
    };

    const collectTransferCandidateAddress = (
        transfer: WalletTransfer,
        candidateAddressesByKey: Map<string, string>,
    ) => {
        const resolved = resolveLookupAndKey(transfer.tokenAddress, transfer.tokenSymbol);
        if (!resolved) {
            return;
        }

        candidateAddressesByKey.set(resolved.addressKey, resolved.lookupAddress);
        counters.candidatesCollected += 1;
    };

    const getSwapLegCandidates = (swap: WalletSwap): RecordLike[] => {
        const rawSwap = swap as unknown as RecordLike;
        const candidates: unknown[] = [
            rawSwap.bought,
            rawSwap.sold,
        ];

        return candidates.filter(isRecord);
    };

    const collectSwapCandidateAddresses = (
        swap: WalletSwap,
        candidateAddressesByKey: Map<string, string>,
    ) => {
        for (const change of getSwapLegCandidates(swap)) {
            const resolved = resolveLookupAndKey(change.address ?? change.mint);
            if (!resolved) {
                continue;
            }

            candidateAddressesByKey.set(resolved.addressKey, resolved.lookupAddress);
            counters.candidatesCollected += 1;
        }
    };

    const candidateAddressesByKey = new Map<string, string>();
    for (const record of transactions as unknown[]) {
        if (isWalletTransactionRecord(record)) {
            collectTransactionCandidateAddress(record, candidateAddressesByKey);
            continue;
        }

        if (isWalletTransferRecord(record)) {
            collectTransferCandidateAddress(record, candidateAddressesByKey);
            continue;
        }

        if (isWalletSwapRecord(record)) {
            collectSwapCandidateAddresses(record, candidateAddressesByKey);
            continue;
        }

        counters.invalidEntriesSkipped += 1;
    }

    if (candidateAddressesByKey.size === 0) {
        return;
    }

    try {
        const candidateAddresses = Array.from(candidateAddressesByKey.values());
        const tokenMetaByKey = new Map<string, { symbol?: string; name?: string; logoUri?: string }>();
        const marketPriceByKey = new Map<string, number>();

        try {
            const tokenMeta = await getTokenMeta(candidateAddresses);
            for (const meta of tokenMeta) {
                const resolved = resolveLookupAndKey(meta.address);
                if (!resolved) {
                    continue;
                }

                tokenMetaByKey.set(resolved.addressKey, {
                    symbol: toOptionalString(meta.symbol),
                    name: toOptionalString(meta.name),
                    logoUri: toOptionalString(meta.imageUrl),
                });
            }
        } catch (err) {
            console.warn("[enrichWithSolanaTokenPrices] Token metadata enrichment failed", err);
        }

        try {
            const marketData = await getTokenMarketData(candidateAddresses);
            for (const [rawAddress, data] of Object.entries(marketData ?? {})) {
                const resolved = resolveLookupAndKey(rawAddress);
                if (!resolved) {
                    continue;
                }

                const priceUsd = toOptionalFiniteNumber((data as RecordLike)?.priceUsd);
                if (priceUsd == null) {
                    continue;
                }

                marketPriceByKey.set(resolved.addressKey, priceUsd);
            }
        } catch (err) {
            console.warn("[enrichWithSolanaTokenPrices] Token market-data enrichment failed", err);
        }

        const getAddressKey = (
            rawTokenAddress: unknown,
            rawTokenSymbol?: unknown,
        ): string | undefined => resolveLookupAndKey(rawTokenAddress, rawTokenSymbol)?.addressKey;

        const resolvePriceUsd = (addressKey: string | undefined): number | undefined => {
            if (!addressKey) {
                return undefined;
            }

            const priceUsd = marketPriceByKey.get(addressKey);
            return Number.isFinite(priceUsd) ? priceUsd : undefined;
        };

        for (const record of transactions as unknown[]) {
            if (isWalletTransactionRecord(record)) {
                const tx = record;
                const addressKey = getAddressKey(tx.primaryTokenAddress, tx.primaryTokenSymbol);
                const priceUsd = resolvePriceUsd(addressKey);

                if (addressKey && priceUsd != null) {
                    counters.marketDataHits += 1;
                    tx.priceUsd = priceUsd;
                    const amount = toOptionalFiniteNumber(tx.primaryTokenAmount);
                    tx.totalUsd = amount != null ? priceUsd * amount : undefined;
                    counters.transactionFieldFills += 1;
                } else {
                    counters.marketDataMisses += 1;
                    tx.priceUsd = undefined;
                    tx.totalUsd = undefined;
                }
                continue;
            }

            if (isWalletTransferRecord(record)) {
                const transfer = record;
                let changed = false;

                transfer.tokenSymbol = toTokenDisplaySymbol(transfer.tokenSymbol, "Unknown");
                transfer.tokenName = toOptionalString(transfer.tokenName);
                transfer.tokenLogoUri = toOptionalString(transfer.tokenLogoUri);

                const addressKey = getAddressKey(transfer.tokenAddress, transfer.tokenSymbol);
                const tokenMeta = addressKey ? tokenMetaByKey.get(addressKey) : undefined;

                if (tokenMeta) {
                    counters.tokenMetaHits += 1;
                    if (shouldFillPortfolioText(transfer.tokenSymbol) && tokenMeta.symbol) {
                        transfer.tokenSymbol = toTokenDisplaySymbol(tokenMeta.symbol, transfer.tokenSymbol);
                        changed = true;
                    }

                    if (shouldFillPortfolioText(transfer.tokenName) && tokenMeta.name) {
                        transfer.tokenName = tokenMeta.name;
                        changed = true;
                    }

                    if (isMissingPortfolioLogoUri(transfer.tokenLogoUri) && tokenMeta.logoUri) {
                        transfer.tokenLogoUri = tokenMeta.logoUri;
                        changed = true;
                    }
                } else {
                    counters.tokenMetaMisses += 1;
                    if (shouldFillPortfolioText(transfer.tokenSymbol)) {
                        transfer.tokenSymbol = transfer.tokenAddress;
                    }
                }

                if (changed) {
                    counters.transferFieldFills += 1;
                }
                continue;
            }

            if (!isWalletSwapRecord(record)) {
                counters.invalidEntriesSkipped += 1;
                continue;
            }

            const swap = record;
            const rawSwap = swap as unknown as RecordLike;
            let changed = false;

            const enrichSwapLeg = (leg: unknown) => {
                if (!isRecord(leg)) {
                    return;
                }

                leg.symbol = toTokenDisplaySymbol(leg.symbol, "Unknown");
                leg.name = toOptionalString(leg.name) ?? null;
                leg.logoUri = toOptionalString(leg.logoUri) ?? null;

                const addressKey = getAddressKey(leg.address ?? leg.mint, leg.symbol);
                const tokenMeta = addressKey ? tokenMetaByKey.get(addressKey) : undefined;

                if (tokenMeta) {
                    counters.tokenMetaHits += 1;
                    if (shouldFillPortfolioText(toOptionalString(leg.symbol)) && tokenMeta.symbol) {
                        leg.symbol = toTokenDisplaySymbol(tokenMeta.symbol, "Unknown");
                        changed = true;
                    }

                    if (shouldFillPortfolioText(toOptionalString(leg.name)) && tokenMeta.name) {
                        leg.name = tokenMeta.name;
                        changed = true;
                    }

                    if (isMissingPortfolioLogoUri(toOptionalString(leg.logoUri)) && tokenMeta.logoUri) {
                        leg.logoUri = tokenMeta.logoUri;
                        changed = true;
                    }
                } else {
                    counters.tokenMetaMisses += 1;
                    if (shouldFillPortfolioText(toOptionalString(leg.symbol))) {
                        leg.symbol =
                            toOptionalString(leg.address ?? leg.mint) ?? "Unknown";
                    }
                }
            };

            enrichSwapLeg(rawSwap.bought);
            enrichSwapLeg(rawSwap.sold);

            if (changed) {
                counters.swapFieldFills += 1;
            }
        }

        console.log("[enrichWithSolanaTokenPrices] Enrichment summary", {
            processed: transactions.length,
            tokenMetaCount: tokenMetaByKey.size,
            marketPriceCount: marketPriceByKey.size,
            ...counters,
        });
    } catch (err) {
        console.error("Failed to enrich transactions with Solana token prices", err);
        for (const record of transactions as unknown[]) {
            if (isWalletTransactionRecord(record)) {
                record.priceUsd = undefined;
                record.totalUsd = undefined;
            }
        }
    }
}

export async function postEnrichTransfers(transfers: WalletTransfer[]): Promise<void> {
    const pending = transfers.filter(t => (t.priceUsd == null || t.amountUsd == null || t.amountUsd == 0) && t.timestamp);
    if (pending.length === 0) return;

    const lookupMap = new Map<string, { mint: string; bucket: number }>();
    for (const t of pending) {
        const tsSec = Math.floor(new Date(t.timestamp).getTime() / 1000);
        const bucket = Math.floor(tsSec / 300) * 300;
        const key = `${t.tokenAddress}:${bucket}`;
        if (!lookupMap.has(key)) {
            lookupMap.set(key, { mint: t.tokenAddress, bucket });
        }
    }

    const lookups = Array.from(lookupMap.values());
    const results = await Promise.all(
        lookups.map(({ mint, bucket }) =>
            resolveTokenPriceAtTimestamp(mint, bucket).then(price => ({ mint, bucket, price })),
        ),
    );

    const priceMap = new Map<string, number>();
    for (const { mint, bucket, price } of results) {
        if (price != null && Number.isFinite(price) && price > 0) {
            priceMap.set(`${mint}:${bucket}`, price);
        }
    }

    for (const t of pending) {
        const tsSec = Math.floor(new Date(t.timestamp).getTime() / 1000);
        const bucket = Math.floor(tsSec / 300) * 300;
        const price = priceMap.get(`${t.tokenAddress}:${bucket}`);
        if (price != null) {
            t.priceUsd ??= price;
            t.amountUsd ??= t.amount * price;
        }
    }
}

export async function postEnrichSwaps(swaps: WalletSwap[]): Promise<void> {
    for (const swap of swaps) {
        const boughtSym = swap.bought?.symbol ?? swap.bought?.address ?? "?";
        const soldSym = swap.sold?.symbol ?? swap.sold?.address ?? "?";
        const uniqueSyms = [...new Set([soldSym, boughtSym])];
        swap.tokensInvolved = uniqueSyms.join("/");
    }

    const pending = swaps.filter(s => (s.totalValueUsd == null || s.totalValueUsd == 0) && s.blockTimestampIso);
    if (pending.length === 0) return;

    await Promise.all(pending.map(async (swap) => {
        const tsSec = Math.floor(new Date(swap.blockTimestampIso!).getTime() / 1000);
        const mints = [swap.sold?.address, swap.bought?.address].filter(Boolean) as string[];
        if (mints.length === 0) return;
        const prices = await resolveTokenPricesAtTimestamp(mints, tsSec);

        if (swap.sold?.address) {
            const p = prices.get(swap.sold.address);
            if (p != null && Number.isFinite(p) && p > 0) {
                swap.sold.priceUsd = p;
                swap.sold.valueUsd = swap.sold.amount * p;
            }
        }
        if (swap.bought?.address) {
            const p = prices.get(swap.bought.address);
            if (p != null && Number.isFinite(p) && p > 0) {
                swap.bought.priceUsd = p;
                swap.bought.valueUsd = swap.bought.amount * p;
            }
        }

        const values = [swap.bought?.valueUsd, swap.sold?.valueUsd]
            .filter((v): v is number => Number.isFinite(v) && v > 0);
        if (values.length > 0) swap.totalValueUsd = Math.max(...values);
    }));
}
