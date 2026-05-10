import { saveSwapsCache, saveTransfersCache } from "@sv/services/wallet/db/walletDataCacher.js";
import { getCachedWalletTransfers, getCachedWalletSwaps, getCachedWalletTransfersMeta, getCachedWalletSwapsMeta } from "@sv/services/wallet/db/walletDataRetriever.js";
import type { WalletTransfersResponse, WalletSwapsResponse, WalletSwap, WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { fetchHeliusSolanaTransfers, fetchMoralisSolanaSwap } from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import { enrichWithSolanaTokenPrices } from "@sv/services/wallet/walletEnrichment.service.js";
import { toWalletPageInfo } from "@sv/services/wallet/walletData.core.js";

type WalletRangeMs = {
    fromMs: number;
    toMs: number;
};

function resolveRequestedRange(from?: number, to?: number): WalletRangeMs {
    const nowMs = Date.now();
    // const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const monthMs = 30 * 24 * 60 * 60 * 1000

    const requestedToMs = to ?? nowMs;
    const requestedFromMs =
        // from ?? (to != null ? requestedToMs - sevenDaysMs : nowMs - sevenDaysMs);
        from ?? (to != null ? requestedToMs - monthMs : nowMs - monthMs)

    return {
        fromMs: Math.min(requestedFromMs, requestedToMs),
        toMs: Math.max(requestedFromMs, requestedToMs),
    };
}

function getMissingRanges(
    requestedRange: WalletRangeMs,
    coveredRange: WalletRangeMs | null,
): WalletRangeMs[] {
    if (!coveredRange) {
        return [requestedRange];
    }

    const missingRanges: WalletRangeMs[] = [];

    if (requestedRange.fromMs < coveredRange.fromMs) {
        missingRanges.push({
            fromMs: requestedRange.fromMs,
            toMs: coveredRange.fromMs - 1,
        });
    }

    if (coveredRange.toMs < requestedRange.toMs) {
        missingRanges.push({
            fromMs: coveredRange.toMs + 1,
            toMs: requestedRange.toMs,
        });
    }

    return missingRanges.filter((range) => range.fromMs <= range.toMs);
}

function sortTransfersByTimestampDesc(transfers: WalletTransfer[]): WalletTransfer[] {
    return [...transfers].sort(
        (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
}

function sortSwapsByTimestampDesc(swaps: WalletSwap[]): WalletSwap[] {
    return [...swaps].sort(
        (left, right) =>
            Date.parse(right.blockTimestampIso) - Date.parse(left.blockTimestampIso),
    );
}

export async function getWalletTransfers(
    address: string,
    from?: number,
    to?: number
): Promise<WalletTransfersResponse> {
    const metaRows = await getCachedWalletTransfersMeta(address);
    const walletTransferMeta = metaRows.length > 0 ? metaRows[0] : null;

    const requestedRange = resolveRequestedRange(from, to);
    const coveredRange =
        walletTransferMeta?.coveredFromMs != null &&
            walletTransferMeta?.coveredToMs != null
            ? {
                fromMs: walletTransferMeta.coveredFromMs,
                toMs: walletTransferMeta.coveredToMs,
            }
            : null;

    const cachedRange = coveredRange
        ? {
            fromMs: Math.max(requestedRange.fromMs, coveredRange.fromMs),
            toMs: Math.min(requestedRange.toMs, coveredRange.toMs),
        }
        : null;
    const cachedTransfers =
        cachedRange != null && cachedRange.fromMs <= cachedRange.toMs
            ? (await getCachedWalletTransfers(
                address,
                cachedRange.fromMs,
                cachedRange.toMs,
            )) ?? []
            : [];

    const missingRanges = getMissingRanges(requestedRange, coveredRange);
    if (missingRanges.length === 0) {
        if (cachedTransfers.length === 0) {
            return {
                address,
                transfers: [],
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "cache",
                }),
            };
        }

        const transfers = sortTransfersByTimestampDesc(cachedTransfers);
        await enrichWithSolanaTokenPrices(transfers);
        return {
            address,
            transfers,
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: "cache",
            }),
        };
    }

    const fetchedTransfers: WalletTransfer[] = [];
    for (const range of missingRanges) {
        const segment = await fetchHeliusSolanaTransfers(
            address,
            range.fromMs,
            range.toMs,
        );
        fetchedTransfers.push(...segment);
    }

    const combinedTransfers = sortTransfersByTimestampDesc([
        ...cachedTransfers,
        ...fetchedTransfers,
    ]);

    if (combinedTransfers.length === 0) {
        return {
            address,
            transfers: [],
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: cachedTransfers.length > 0 ? "mixed" : "provider",
            }),
        };
    }

    await saveTransfersCache(address, combinedTransfers);
    await enrichWithSolanaTokenPrices(combinedTransfers);

    return {
        address,
        transfers: combinedTransfers,
        pageInfo: toWalletPageInfo({
            hasMore: false,
            nextCursor: null,
            source:
                cachedTransfers.length > 0 && fetchedTransfers.length > 0
                    ? "mixed"
                    : fetchedTransfers.length > 0
                        ? "provider"
                        : "cache",
        }),
    };

}

export async function getWalletSwaps(
    address: string,
    from?: number,
    to?: number
): Promise<WalletSwapsResponse> {
    const metaRows = await getCachedWalletSwapsMeta(address);
    const walletSwapMeta = metaRows.length > 0 ? metaRows[0] : null;

    const requestedRange = resolveRequestedRange(from, to);
    const coveredRange =
        walletSwapMeta?.coveredFromMs != null && walletSwapMeta?.coveredToMs != null
            ? {
                fromMs: walletSwapMeta.coveredFromMs,
                toMs: walletSwapMeta.coveredToMs,
            }
            : null;

    const cachedRange = coveredRange
        ? {
            fromMs: Math.max(requestedRange.fromMs, coveredRange.fromMs),
            toMs: Math.min(requestedRange.toMs, coveredRange.toMs),
        }
        : null;
    const cachedSwaps =
        cachedRange != null && cachedRange.fromMs <= cachedRange.toMs
            ? (await getCachedWalletSwaps(
                address,
                cachedRange.fromMs,
                cachedRange.toMs,
            )) ?? []
            : [];

    const missingRanges = getMissingRanges(requestedRange, coveredRange);
    if (missingRanges.length === 0) {
        if (cachedSwaps.length === 0) {
            return {
                address,
                swaps: [],
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "cache",
                }),
            };
        }

        const swaps = sortSwapsByTimestampDesc(cachedSwaps);
        await enrichWithSolanaTokenPrices(swaps);
        return {
            address,
            swaps,
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: "cache",
            }),
        };
    }

    const fetchedSwaps: WalletSwap[] = [];
    for (const range of missingRanges) {
        const segment = await fetchMoralisSolanaSwap(
            address,
            range.fromMs,
            range.toMs,
        );
        fetchedSwaps.push(...segment);
    }

    const combinedSwaps = sortSwapsByTimestampDesc([
        ...cachedSwaps,
        ...fetchedSwaps,
    ]);

    if (combinedSwaps.length === 0) {
        return {
            address,
            swaps: [],
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: cachedSwaps.length > 0 ? "mixed" : "provider",
            }),
        };
    }

    await saveSwapsCache(address, combinedSwaps);
    await enrichWithSolanaTokenPrices(combinedSwaps);

    const source =
        cachedSwaps.length > 0 && fetchedSwaps.length > 0
            ? "mixed"
            : fetchedSwaps.length > 0
                ? "provider"
                : "cache";

    return {
        address,
        swaps: combinedSwaps,
        pageInfo: toWalletPageInfo({
            hasMore: false,
            nextCursor: null,
            source,
        }),
    };
}
