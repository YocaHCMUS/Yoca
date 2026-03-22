import {
    getWalletSwaps,
    getWalletTransfers,
} from "@sv/services/wallet/walletTransfersSwaps.service.js";
import type {
    WalletCounterpartiesResponse,
    WalletCounterpartyIdentity,
    WalletCounterpartyPeriod,
    WalletCounterpartyRankingItem,
    WalletCounterpartyRow,
    WalletSwap,
    WalletTransfer,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import { getWalletIdentityBatch } from "@sv/services/wallet/walletIdentity.service.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_COUNTERPARTY_PERIOD: WalletCounterpartyPeriod = "7d";
const DEFAULT_COUNTERPARTY_LIMIT = 20;
const MAX_COUNTERPARTY_LIMIT = 100;
const COUNTERPARTY_MAX_RECORDS = 5000;

const UNKNOWN_IDENTITY: WalletCounterpartyIdentity = {
    status: "unknown",
    name: null,
    category: null,
    type: null,
};

const UNAVAILABLE_IDENTITY: WalletCounterpartyIdentity = {
    status: "unavailable",
    name: null,
    category: null,
    type: null,
};

type CounterpartyAccumulator = {
    address: string;
    tokens: Set<string>;
    transactionSignatures: Set<string>;
    signatureVolumeUsd: Map<string, number>;
};

export type WalletCounterpartiesOptions = {
    period?: string;
    limit?: number;
    includeTokens?: boolean;
};

type CounterpartyActivityFetchOptions = {
    period: WalletCounterpartyPeriod;
    maxRecords: number;
};

type CounterpartyActivityDataset = {
    transfers: WalletTransfer[];
    swaps: WalletSwap[];
    truncated: boolean;
    source: "cache" | "provider" | "mixed";
};

type CounterpartyActivityEvent =
    | {
        kind: "transfer";
        key: string;
        timestampMs: number;
        item: WalletTransfer;
    }
    | {
        kind: "swap";
        key: string;
        timestampMs: number;
        item: WalletSwap;
    };

function normalizeCounterpartyPeriod(rawPeriod?: string): WalletCounterpartyPeriod {
    const normalized = String(rawPeriod ?? "").trim().toLowerCase();

    if (normalized === "24h") {
        return "24h";
    }

    if (normalized === "7d") {
        return "7d";
    }

    return DEFAULT_COUNTERPARTY_PERIOD;
}

function clampCounterpartyLimit(rawLimit?: number): number {
    const parsed = Number(rawLimit ?? DEFAULT_COUNTERPARTY_LIMIT);

    if (!Number.isFinite(parsed)) {
        return DEFAULT_COUNTERPARTY_LIMIT;
    }

    const integerLimit = Math.floor(parsed);
    if (integerLimit < 1) {
        return 1;
    }

    if (integerLimit > MAX_COUNTERPARTY_LIMIT) {
        return MAX_COUNTERPARTY_LIMIT;
    }

    return integerLimit;
}

function clampCounterpartyMaxRecords(rawMaxRecords?: number): number {
    const parsed = Number(rawMaxRecords ?? COUNTERPARTY_MAX_RECORDS);
    if (!Number.isFinite(parsed)) {
        return COUNTERPARTY_MAX_RECORDS;
    }

    const integerLimit = Math.floor(parsed);
    if (integerLimit < 1) {
        return 1;
    }

    if (integerLimit > COUNTERPARTY_MAX_RECORDS) {
        return COUNTERPARTY_MAX_RECORDS;
    }

    return integerLimit;
}

function collapseCounterpartySource(
    sources: Set<"cache" | "provider" | "mixed">,
): "cache" | "provider" | "mixed" {
    if (sources.size === 0) {
        return "mixed";
    }

    if (sources.has("mixed")) {
        return "mixed";
    }

    if (sources.size === 1) {
        const [single] = Array.from(sources);
        return single;
    }

    return "mixed";
}

function isLikelySolanaAddress(address: string): boolean {
    const normalized = normalizeAddress(address);
    if (normalized.length < 32 || normalized.length > 44) {
        return false;
    }

    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(normalized);
}

function normalizeAddress(value: unknown): string {
    return String(value ?? "").trim();
}

function normalizeSignature(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function toTimestampMs(value: unknown): number {
    if (value instanceof Date) {
        return value.getTime();
    }

    const parsed = Date.parse(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function inRange(timestampMs: number, fromMs: number, toMs: number): boolean {
    return Number.isFinite(timestampMs) && timestampMs >= fromMs && timestampMs <= toMs;
}

function toFiniteNonNegative(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.max(0, parsed);
}

function shortenAddress(address: string): string {
    if (address.length <= 12) {
        return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeTokenLabel(symbol: unknown, tokenAddress: unknown): string {
    const symbolText = String(symbol ?? "").trim();
    if (symbolText) {
        return symbolText.toUpperCase();
    }

    const tokenAddressText = String(tokenAddress ?? "").trim();
    if (tokenAddressText) {
        return tokenAddressText;
    }

    return "UNKNOWN";
}

function getCounterpartyFromTransfer(transfer: WalletTransfer, walletLower: string): string | null {
    const from = normalizeAddress(transfer.from);
    const to = normalizeAddress(transfer.to);

    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    if (fromLower === walletLower && toLower !== walletLower) {
        return to;
    }

    if (toLower === walletLower && fromLower !== walletLower) {
        return from;
    }

    return null;
}

function getCounterpartyFromSwap(swap: WalletSwap): string {
    const exchangeAddress = normalizeAddress(swap.exchange?.address);
    if (exchangeAddress) {
        return exchangeAddress;
    }

    const pairAddress = normalizeAddress(swap.pair?.address);
    if (pairAddress) {
        return pairAddress;
    }

    const normalizedSignature = normalizeSignature(swap.signature) || "unknown";
    return `swap:unknown:${normalizedSignature}`;
}

function getSwapVolumeUsd(swap: WalletSwap): number {
    const totalValueUsd = toFiniteNonNegative(swap.totalValueUsd);
    if (totalValueUsd > 0) {
        return totalValueUsd;
    }

    const soldValueUsd = toFiniteNonNegative(swap.sold?.valueUsd);
    if (soldValueUsd > 0) {
        return soldValueUsd;
    }

    const boughtValueUsd = toFiniteNonNegative(swap.bought?.valueUsd);
    if (boughtValueUsd > 0) {
        return boughtValueUsd;
    }

    return 0;
}

function getSwapTokenLabels(swap: WalletSwap): string[] {
    const labels = new Set<string>();

    const soldSymbol = String(swap.sold?.symbol ?? "").trim();
    if (soldSymbol) {
        labels.add(soldSymbol.toUpperCase());
    }

    const boughtSymbol = String(swap.bought?.symbol ?? "").trim();
    if (boughtSymbol) {
        labels.add(boughtSymbol.toUpperCase());
    }

    return Array.from(labels.values());
}

function getOrCreateAccumulator(
    byCounterparty: Map<string, CounterpartyAccumulator>,
    counterpartyAddress: string,
): CounterpartyAccumulator {
    const existing = byCounterparty.get(counterpartyAddress);
    if (existing) {
        return existing;
    }

    const created: CounterpartyAccumulator = {
        address: counterpartyAddress,
        tokens: new Set<string>(),
        transactionSignatures: new Set<string>(),
        signatureVolumeUsd: new Map<string, number>(),
    };
    byCounterparty.set(counterpartyAddress, created);
    return created;
}

async function buildTransferPriceMap(
    transfers: WalletTransfer[],
    fromMs: number,
    toMs: number,
): Promise<Map<string, number>> {
    const tokenAddresses = new Set<string>();

    for (const transfer of transfers) {
        const timestampMs = toTimestampMs(transfer.timestamp);
        if (!inRange(timestampMs, fromMs, toMs)) {
            continue;
        }

        const tokenAddress = String(transfer.tokenAddress ?? "").trim();
        if (!tokenAddress || tokenAddress.toLowerCase() === "unknown") {
            continue;
        }

        tokenAddresses.add(tokenAddress);
    }

    if (tokenAddresses.size === 0) {
        return new Map<string, number>();
    }

    const marketData = await getTokenMarketData(Array.from(tokenAddresses));
    const priceByTokenAddress = new Map<string, number>();

    for (const [tokenAddress, market] of Object.entries(marketData)) {
        const price = Number(market?.priceUsd ?? Number.NaN);
        if (!Number.isFinite(price)) {
            continue;
        }

        priceByTokenAddress.set(tokenAddress, price);
    }

    return priceByTokenAddress;
}

function getTransferVolumeUsd(
    transfer: WalletTransfer,
    priceByTokenAddress: Map<string, number>,
): number {
    const amount = toFiniteNonNegative(Math.abs(Number(transfer.amount ?? 0)));
    if (amount <= 0) {
        return 0;
    }

    const tokenAddress = String(transfer.tokenAddress ?? "").trim();
    if (!tokenAddress || tokenAddress.toLowerCase() === "unknown") {
        return 0;
    }

    const tokenPrice = Number(priceByTokenAddress.get(tokenAddress) ?? Number.NaN);
    if (!Number.isFinite(tokenPrice)) {
        return 0;
    }

    return amount * tokenPrice;
}

function aggregateCounterpartiesFromTransfers(input: {
    walletAddress: string;
    transfers: WalletTransfer[];
    priceByTokenAddress: Map<string, number>;
    fromMs: number;
    toMs: number;
}): Map<string, CounterpartyAccumulator> {
    const { walletAddress, transfers, priceByTokenAddress, fromMs, toMs } = input;
    const byCounterparty = new Map<string, CounterpartyAccumulator>();
    const walletLower = walletAddress.toLowerCase();

    for (const transfer of transfers) {
        const timestampMs = toTimestampMs(transfer.timestamp);
        if (!inRange(timestampMs, fromMs, toMs)) {
            continue;
        }

        const counterpartyAddress = getCounterpartyFromTransfer(transfer, walletLower);
        if (!counterpartyAddress) {
            continue;
        }

        const signature =
            normalizeSignature(transfer.transactionSignature) ||
            `${counterpartyAddress.toLowerCase()}:${timestampMs}:${transfer.instructionIndex}`;

        const accumulator = getOrCreateAccumulator(byCounterparty, counterpartyAddress);
        accumulator.transactionSignatures.add(signature);

        const tokenLabel = normalizeTokenLabel(transfer.tokenSymbol, transfer.tokenAddress);
        if (tokenLabel) {
            accumulator.tokens.add(tokenLabel);
        }

        if (!accumulator.signatureVolumeUsd.has(signature)) {
            accumulator.signatureVolumeUsd.set(signature, 0);
        }

        const currentSignatureVolume = toFiniteNonNegative(
            accumulator.signatureVolumeUsd.get(signature) ?? 0,
        );
        accumulator.signatureVolumeUsd.set(
            signature,
            currentSignatureVolume + getTransferVolumeUsd(transfer, priceByTokenAddress),
        );
    }

    return byCounterparty;
}

function mergeCounterpartiesFromSwaps(input: {
    swaps: WalletSwap[];
    byCounterparty: Map<string, CounterpartyAccumulator>;
    fromMs: number;
    toMs: number;
}): void {
    const { swaps, byCounterparty, fromMs, toMs } = input;

    for (const swap of swaps) {
        const timestampMs = toTimestampMs(swap.timestamp);
        if (!inRange(timestampMs, fromMs, toMs)) {
            continue;
        }

        const counterpartyAddress = getCounterpartyFromSwap(swap);
        if (!counterpartyAddress) {
            continue;
        }

        const normalizedSignature = normalizeSignature(swap.signature);
        const signature = normalizedSignature || `${counterpartyAddress.toLowerCase()}:${timestampMs}`;
        const dedupeKey = `${signature}:${counterpartyAddress.toLowerCase()}`;

        const accumulator = getOrCreateAccumulator(byCounterparty, counterpartyAddress);
        accumulator.transactionSignatures.add(dedupeKey);

        for (const label of getSwapTokenLabels(swap)) {
            accumulator.tokens.add(label);
        }

        if (!accumulator.signatureVolumeUsd.has(dedupeKey)) {
            accumulator.signatureVolumeUsd.set(dedupeKey, getSwapVolumeUsd(swap));
        }
    }
}

async function fetchCounterpartyActivityDataset(
    address: string,
    options: CounterpartyActivityFetchOptions,
): Promise<CounterpartyActivityDataset> {
    const nowMs = Date.now();
    const fromMs = computePeriodStart(options.period, nowMs);
    const maxRecords = clampCounterpartyMaxRecords(options.maxRecords);

    const sourceSet = new Set<"cache" | "provider" | "mixed">();

    let transferCursor: string | undefined;
    let swapCursor: string | undefined;
    let transferHasMore = true;
    let swapHasMore = true;

    const transferEvents: CounterpartyActivityEvent[] = [];
    const swapEvents: CounterpartyActivityEvent[] = [];
    const seenTransferKeys = new Set<string>();
    const seenSwapKeys = new Set<string>();

    while ((transferHasMore || swapHasMore) && transferEvents.length + swapEvents.length < maxRecords) {
        if (transferHasMore && transferEvents.length + swapEvents.length < maxRecords) {
            const transferPage = await getWalletTransfers(address, {
                cursor: transferCursor,
            });
            sourceSet.add(transferPage.pageInfo.source);

            let reachedTransferBoundary = false;
            for (const transfer of transferPage.transfers) {
                const timestampMs = toTimestampMs(transfer.timestamp);
                if (!Number.isFinite(timestampMs) || timestampMs > nowMs) {
                    continue;
                }

                if (timestampMs < fromMs) {
                    reachedTransferBoundary = true;
                    continue;
                }

                const signature = normalizeSignature(transfer.transactionSignature) || "unknown";
                const dedupeKey = `${signature}:${transfer.instructionIndex}`;
                if (seenTransferKeys.has(dedupeKey)) {
                    continue;
                }

                seenTransferKeys.add(dedupeKey);
                transferEvents.push({
                    kind: "transfer",
                    key: dedupeKey,
                    timestampMs,
                    item: transfer,
                });
            }

            transferHasMore =
                !reachedTransferBoundary &&
                transferPage.pageInfo.hasMore &&
                Boolean(transferPage.pageInfo.nextCursor);
            transferCursor = transferHasMore
                ? transferPage.pageInfo.nextCursor ?? undefined
                : undefined;
        }

        if (swapHasMore && transferEvents.length + swapEvents.length < maxRecords) {
            const swapPage = await getWalletSwaps(address, {
                cursor: swapCursor,
            });
            sourceSet.add(swapPage.pageInfo.source);

            let reachedSwapBoundary = false;
            for (const swap of swapPage.swaps) {
                const timestampMs = toTimestampMs(swap.timestamp);
                if (!Number.isFinite(timestampMs) || timestampMs > nowMs) {
                    continue;
                }

                if (timestampMs < fromMs) {
                    reachedSwapBoundary = true;
                    continue;
                }

                const signature = normalizeSignature(swap.signature) || "unknown";
                const dedupeKey = `swap:${signature}`;
                if (seenSwapKeys.has(dedupeKey)) {
                    continue;
                }

                seenSwapKeys.add(dedupeKey);
                swapEvents.push({
                    kind: "swap",
                    key: dedupeKey,
                    timestampMs,
                    item: swap,
                });
            }

            swapHasMore =
                !reachedSwapBoundary &&
                swapPage.pageInfo.hasMore &&
                Boolean(swapPage.pageInfo.nextCursor);
            swapCursor = swapHasMore ? swapPage.pageInfo.nextCursor ?? undefined : undefined;
        }
    }

    const mergedEvents = [...transferEvents, ...swapEvents]
        .sort((a, b) => {
            if (b.timestampMs !== a.timestampMs) {
                return b.timestampMs - a.timestampMs;
            }

            return a.key.localeCompare(b.key);
        });

    const truncatedByVolume = mergedEvents.length > maxRecords;
    const selectedEvents = mergedEvents.slice(0, maxRecords);
    const truncated = truncatedByVolume || transferHasMore || swapHasMore;

    const transfers = selectedEvents
        .filter((event): event is Extract<CounterpartyActivityEvent, { kind: "transfer" }> =>
            event.kind === "transfer",
        )
        .map((event) => event.item);

    const swaps = selectedEvents
        .filter((event): event is Extract<CounterpartyActivityEvent, { kind: "swap" }> =>
            event.kind === "swap",
        )
        .map((event) => event.item);

    return {
        transfers,
        swaps,
        truncated,
        source: collapseCounterpartySource(sourceSet),
    };
}

function toCounterpartyIdentity(value: {
    status?: "known" | "unknown" | "unavailable";
    name?: string | null;
    category?: string | null;
    type?: string | null;
} | null): WalletCounterpartyIdentity {
    if (!value) {
        return UNKNOWN_IDENTITY;
    }

    return {
        status: value.status ?? "unknown",
        name: value.name ?? null,
        category: value.category ?? null,
        type: value.type ?? null,
    };
}

async function buildCounterpartyIdentityMap(
    addresses: string[]
): Promise<Map<string, WalletCounterpartyIdentity>> {
    const identityByAddress = new Map<string, WalletCounterpartyIdentity>();

    if (addresses.length === 0) {
        return identityByAddress;
    }

    const lookupAddresses = addresses.filter(isLikelySolanaAddress);
    for (const address of addresses) {
        if (!isLikelySolanaAddress(address)) {
            identityByAddress.set(address, UNKNOWN_IDENTITY);
        }
    }

    if (lookupAddresses.length === 0) {
        return identityByAddress;
    }

    try {
        const identityBatch = await getWalletIdentityBatch(lookupAddresses);
        for (const item of identityBatch.results) {
            identityByAddress.set(item.address, toCounterpartyIdentity(item.identity));
        }

        for (const address of lookupAddresses) {
            if (!identityByAddress.has(address)) {
                identityByAddress.set(address, UNKNOWN_IDENTITY);
            }
        }

        return identityByAddress;
    } catch {
        for (const address of addresses) {
            identityByAddress.set(address, UNAVAILABLE_IDENTITY);
        }
        return identityByAddress;
    }
}

function compareByTransactionCount(a: WalletCounterpartyRow, b: WalletCounterpartyRow): number {
    if (b.transactionCount !== a.transactionCount) {
        return b.transactionCount - a.transactionCount;
    }

    if (b.totalVolumeUsd !== a.totalVolumeUsd) {
        return b.totalVolumeUsd - a.totalVolumeUsd;
    }

    return a.address.localeCompare(b.address);
}

function compareByVolume(a: WalletCounterpartyRow, b: WalletCounterpartyRow): number {
    if (b.totalVolumeUsd !== a.totalVolumeUsd) {
        return b.totalVolumeUsd - a.totalVolumeUsd;
    }

    if (b.transactionCount !== a.transactionCount) {
        return b.transactionCount - a.transactionCount;
    }

    return a.address.localeCompare(b.address);
}

function toRankingRows(
    rows: WalletCounterpartyRow[],
    limit: number,
    sorter: (a: WalletCounterpartyRow, b: WalletCounterpartyRow) => number,
): WalletCounterpartyRankingItem[] {
    return [...rows]
        .sort(sorter)
        .slice(0, limit)
        .map((row) => ({
            address: row.address,
            label: row.identity.name ?? shortenAddress(row.address),
            transactionCount: row.transactionCount,
            totalVolumeUsd: row.totalVolumeUsd,
        }));
}

function toCounterpartyRows(
    byCounterparty: Map<string, CounterpartyAccumulator>,
    identityByAddress: Map<string, WalletCounterpartyIdentity>,
    includeTokens: boolean,
): WalletCounterpartyRow[] {
    const rows: WalletCounterpartyRow[] = [];

    for (const [address, aggregate] of byCounterparty.entries()) {
        const totalVolumeUsd = Array.from(aggregate.signatureVolumeUsd.values()).reduce(
            (sum, value) => sum + toFiniteNonNegative(value),
            0,
        );

        const sortedTokens = Array.from(aggregate.tokens.values()).sort((a, b) =>
            a.localeCompare(b),
        );

        rows.push({
            address,
            identity: identityByAddress.get(address) ?? UNKNOWN_IDENTITY,
            uniqueTokenCount: sortedTokens.length,
            tokens: includeTokens ? sortedTokens : [],
            transactionCount: aggregate.transactionSignatures.size,
            totalVolumeUsd,
        });
    }

    return rows;
}

function computePeriodStart(period: WalletCounterpartyPeriod, nowMs: number): number {
    return period === "24h" ? nowMs - DAY_MS : nowMs - 7 * DAY_MS;
}

/**
 * PURPOSE: Aggregate top wallet counterparties, including identity enrichment and rank views.
 * USAGE:
 * const data = await getWalletCounterparties("wallet-address", "solana", {
 *   period: "7d",
 *   limit: 20,
 *   includeTokens: true,
 * });
 */
export async function getWalletCounterparties(
    address: string,
    options?: WalletCounterpartiesOptions,
): Promise<WalletCounterpartiesResponse> {
    const normalizedAddress = normalizeAddress(address);
    const period = normalizeCounterpartyPeriod(options?.period);
    const limit = clampCounterpartyLimit(options?.limit);
    const includeTokens = options?.includeTokens ?? true;

    const nowMs = Date.now();
    const fromMs = computePeriodStart(period, nowMs);
    const activityDataset = await fetchCounterpartyActivityDataset(normalizedAddress, {
        period,
        maxRecords: COUNTERPARTY_MAX_RECORDS,
    });
    const priceByTokenAddress = await buildTransferPriceMap(activityDataset.transfers, fromMs, nowMs);

    const aggregatedByCounterparty = aggregateCounterpartiesFromTransfers({
        walletAddress: normalizedAddress,
        transfers: activityDataset.transfers,
        priceByTokenAddress,
        fromMs,
        toMs: nowMs,
    });

    mergeCounterpartiesFromSwaps({
        swaps: activityDataset.swaps,
        byCounterparty: aggregatedByCounterparty,
        fromMs,
        toMs: nowMs,
    });

    const counterpartyAddresses = Array.from(aggregatedByCounterparty.keys());
    const identityByAddress = await buildCounterpartyIdentityMap(counterpartyAddresses);

    const allRows = toCounterpartyRows(
        aggregatedByCounterparty,
        identityByAddress,
        includeTokens,
    );

    const counterparties = [...allRows].sort(compareByTransactionCount).slice(0, limit);

    const byTransactionCount = toRankingRows(allRows, limit, compareByTransactionCount);
    const byVolume = toRankingRows(allRows, limit, compareByVolume);

    const totals = allRows.reduce(
        (acc, row) => {
            acc.counterparties += 1;
            acc.transactions += row.transactionCount;
            acc.volume += row.totalVolumeUsd;
            return acc;
        },
        {
            counterparties: 0,
            transactions: 0,
            volume: 0,
        },
    );

    return {
        counterparties,
        rankings: {
            byTransactionCount,
            byVolume,
        },
        metadata: {
            period,
            source: activityDataset.source,
            totals,
        },
    };
}
