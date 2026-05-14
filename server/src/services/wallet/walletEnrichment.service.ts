import { getTokenMeta } from "../tokens/token-info.js";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import {
    getEndpoint as getBirdeyeEndpoint,
    getRequiredHeaders as getBirdeyeHeaders,
} from "../../util/util-birdeye.js";
import * as moralis from "@sv/util/util-moralis.js";
import { db } from "@sv/db/index.js";
import { tokenMeta, type TokenMetaInsert } from "@sv/db/schema.js";
import { excludedAutoFromInsert } from "@sv/util/orm-sql.js";
import type { WalletTransaction, WalletTransfer, WalletSwap } from "./dtos/walletDataObjects.js";
import { SOL_MINT } from "./wallet.constants.js";
import { isMissingPortfolioLogoUri, isValidPortfolioTokenAddress, normalizePortfolioAddressKey, normalizePortfolioLookupAddress, normalizePortfolioText, shouldFillPortfolioText } from "./walletData.core.js";

type BirdeyeTokenMeta = { symbol: string; name?: string; logoUri?: string };

function extractBirdeyeTokenMeta(payload: unknown): BirdeyeTokenMeta | undefined {
    const root = payload as {
        success?: boolean;
        data?: {
            symbol?: unknown;
            tokenSymbol?: unknown;
            name?: unknown;
            logoURI?: unknown;
            token?: { symbol?: unknown; name?: unknown; logoURI?: unknown };
        };
    };
    const data = root?.data;
    if (!data) return undefined;

    const symbolCandidates = [data.symbol, data.tokenSymbol, data.token?.symbol];
    let symbol: string | undefined;
    for (const c of symbolCandidates) {
        const s = String(c ?? "").trim();
        if (s) { symbol = s.toUpperCase(); break; }
    }
    if (!symbol) return undefined;

    const nameCandidates = [data.name, data.token?.name];
    let name: string | undefined;
    for (const c of nameCandidates) {
        const n = String(c ?? "").trim();
        if (n) { name = n; break; }
    }

    const logoCandidates = [data.logoURI, data.token?.logoURI];
    let logoUri: string | undefined;
    for (const c of logoCandidates) {
        const l = String(c ?? "").trim();
        if (l) { logoUri = l; break; }
    }

    return { symbol, name, logoUri };
}

async function fetchBirdeyeTokenMeta(mint: string): Promise<BirdeyeTokenMeta | undefined> {
    if (!process.env.BIRDEYE_API_KEY || !process.env.BIRDEYE_API_BASE_URL) return undefined;
    try {
        const endpoint = getBirdeyeEndpoint("/defi/token_overview");
        endpoint.searchParams.set("address", mint);
        const response = await fetch(endpoint, { method: "GET", headers: getBirdeyeHeaders() });
        if (!response.ok) return undefined;
        return extractBirdeyeTokenMeta(await response.json());
    } catch {
        return undefined;
    }
}

async function fetchBirdeyeTokenMetasForMints(mints: string[]): Promise<Map<string, BirdeyeTokenMeta>> {
    const result = new Map<string, BirdeyeTokenMeta>();
    const uniqueMints = [...new Set(mints.filter(Boolean))];
    await Promise.all(uniqueMints.map(async (mint) => {
        const meta = await fetchBirdeyeTokenMeta(mint);
        if (meta) result.set(mint, meta);
    }));
    return result;
}

async function fetchMoralisTokenMeta(mint: string): Promise<BirdeyeTokenMeta | undefined> {
    try {
        const endpoint = moralis.getEndpoint(`/token/mainnet/${mint}/metadata`);
        const response = await moralis.moralisFetch(endpoint, {
            method: "GET",
            headers: moralis.getRequiredHeaders(),
        });
        if (!response.ok) return undefined;
        const data = (await response.json()) as {
            symbol?: unknown; name?: unknown; logo?: unknown;
        };
        const symbol = String(data.symbol ?? "").trim().toUpperCase();
        if (!symbol) return undefined;
        return {
            symbol,
            name: String(data.name ?? "").trim() || undefined,
            logoUri: String(data.logo ?? "").trim() || undefined,
        };
    } catch {
        return undefined;
    }
}

async function fetchMoralisTokenMetasForMints(mints: string[]): Promise<Map<string, BirdeyeTokenMeta>> {
    const result = new Map<string, BirdeyeTokenMeta>();
    const uniqueMints = [...new Set(mints.filter(Boolean))];
    await Promise.all(uniqueMints.map(async (mint) => {
        const meta = await fetchMoralisTokenMeta(mint);
        if (meta) result.set(mint, meta);
    }));
    return result;
}

export async function enrichWithSolanaTokenPrices(
    transactions: WalletTransaction[] | WalletTransfer[] | WalletSwap[],
): Promise<void> {
    type RecordLike = Record<string, unknown>;
    type TokenMetaRow = {
        address?: unknown;
        symbol?: unknown;
        name?: unknown;
        imageUrl?: unknown;
    };

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

    console.log("[enrichWithSolanaTokenPrices] Candidate collection summary", {
        processed: transactions.length,
        uniqueCandidates: candidateAddressesByKey.size,
        candidatesCollected: counters.candidatesCollected,
        invalidCandidatesDropped: counters.invalidCandidatesDropped,
        invalidEntriesSkipped: counters.invalidEntriesSkipped,
    });

    if (candidateAddressesByKey.size === 0) {
        return;
    }

    try {
        const candidateAddresses = Array.from(candidateAddressesByKey.values());
        const tokenMetaByKey = new Map<string, { symbol?: string; name?: string; logoUri?: string }>();
        const marketPriceByKey = new Map<string, number>();

        try {
            const tokenMeta = await getTokenMeta(candidateAddresses) as TokenMetaRow[];
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

        // Track which keys CoinGecko populated so we know what to persist later
        const coinGeckoKeys = new Set(tokenMetaByKey.keys());

        // Birdeye fallback: fetch metadata for mints CoinGecko missed
        const birdeyeFallbackAddresses = candidateAddresses.filter((addr) => {
            const resolved = resolveLookupAndKey(addr);
            return resolved ? !tokenMetaByKey.has(resolved.addressKey) : false;
        });
        if (birdeyeFallbackAddresses.length > 0) {
            try {
                const birdeyeMetas = await fetchBirdeyeTokenMetasForMints(birdeyeFallbackAddresses);
                for (const [address, meta] of birdeyeMetas) {
                    const resolved = resolveLookupAndKey(address);
                    if (resolved && !tokenMetaByKey.has(resolved.addressKey)) {
                        counters.tokenMetaHits += 1;
                        tokenMetaByKey.set(resolved.addressKey, {
                            symbol: meta.symbol,
                            name: meta.name,
                            logoUri: meta.logoUri,
                        });
                    }
                }
            } catch (err) {
                console.warn("[enrichWithSolanaTokenPrices] Birdeye metadata fallback failed", err);
            }
        }

        // Moralis fallback: fetch metadata for mints still missed
        const moralisFallbackAddresses = candidateAddresses.filter((addr) => {
            const resolved = resolveLookupAndKey(addr);
            return resolved ? !tokenMetaByKey.has(resolved.addressKey) : false;
        });
        if (moralisFallbackAddresses.length > 0) {
            try {
                const moralisMetas = await fetchMoralisTokenMetasForMints(moralisFallbackAddresses);
                for (const [address, meta] of moralisMetas) {
                    const resolved = resolveLookupAndKey(address);
                    if (resolved && !tokenMetaByKey.has(resolved.addressKey)) {
                        counters.tokenMetaHits += 1;
                        tokenMetaByKey.set(resolved.addressKey, {
                            symbol: meta.symbol,
                            name: meta.name,
                            logoUri: meta.logoUri,
                        });
                    }
                }
            } catch (err) {
                console.warn("[enrichWithSolanaTokenPrices] Moralis metadata fallback failed", err);
            }
        }

        // Persist fallback results to token_meta DB so future runs skip API calls
        const fallbackInserts: TokenMetaInsert[] = [];
        for (const [addressKey, meta] of tokenMetaByKey) {
            if (!coinGeckoKeys.has(addressKey) && meta.symbol) {
                const lookupAddr = candidateAddressesByKey.get(addressKey);
                if (lookupAddr) {
                    fallbackInserts.push({
                        address: lookupAddr,
                        name: meta.name ?? "",
                        symbol: meta.symbol,
                        imageUrl: meta.logoUri ?? null,
                    });
                }
            }
        }
        if (fallbackInserts.length > 0) {
            try {
                await db.insert(tokenMeta).values(fallbackInserts).onConflictDoUpdate({
                    target: [tokenMeta.address],
                    set: excludedAutoFromInsert(tokenMeta, tokenMeta.address, fallbackInserts),
                });
            } catch (err) {
                console.warn("[enrichWithSolanaTokenPrices] Failed to persist fallback metadata", err);
            }
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
                }

                const priceUsd = resolvePriceUsd(addressKey);
                if (priceUsd != null) {
                    counters.marketDataHits += 1;
                    const hasPriceUsd = toOptionalFiniteNumber(transfer.priceUsd) != null;
                    if (!hasPriceUsd) {
                        transfer.priceUsd = priceUsd;
                        changed = true;
                    }

                    const hasAmountUsd = toOptionalFiniteNumber(transfer.amountUsd) != null;
                    const amount = toOptionalFiniteNumber(transfer.amount);
                    const basePrice = toOptionalFiniteNumber(transfer.priceUsd) ?? priceUsd;
                    const amountUsd = amount != null ? amount * basePrice : undefined;

                    if (!hasAmountUsd && amountUsd != null && Number.isFinite(amountUsd)) {
                        transfer.amountUsd = amountUsd;
                        changed = true;
                    }
                } else {
                    counters.marketDataMisses += 1;
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