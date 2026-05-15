import { saveSwapsCache, saveTransfersCache } from "@sv/services/wallet/db/walletDataCacher.js";
import { getCachedWalletTransfers, getCachedWalletSwaps, getCachedWalletTransfersMeta, getCachedWalletSwapsMeta } from "@sv/services/wallet/db/walletDataRetriever.js";
import type { WalletTransfersResponse, WalletSwapsResponse, WalletSwap, WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { enrichWithSolanaTokenPrices, postEnrichTransfers, postEnrichSwaps } from "@sv/services/wallet/walletEnrichment.service.js";
import { toWalletPageInfo } from "@sv/services/wallet/walletData.core.js";
import { resolveEnhancedTransactions } from "@sv/services/wallet/providers/walletEnhancedTx.service.js";
import { mapHeliusTxsToSwaps } from "@sv/services/wallet/providers/helius-to-swap.js";
import { mapHeliusTxsToTransfers } from "@sv/services/wallet/providers/helius-to-transfer.js";
import { resolveRequestedRange, isMissingRangeSignificant, getMissingRanges } from "@sv/services/wallet/walletRange.utils.js";

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
        walletTransferMeta?.coveredFromSec != null &&
            walletTransferMeta?.coveredToSec != null
            ? {
                fromMs: walletTransferMeta.coveredFromSec * 1000,
                toMs: walletTransferMeta.coveredToSec * 1000,
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
        await postEnrichTransfers(transfers);
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
        if (isMissingRangeSignificant(range.fromMs, range.toMs)) {
            console.log(`[get wallet transfer] Fetch missing ranges ${new Date(range.fromMs)} - ${new Date(range.toMs)}`)
            const txs = await resolveEnhancedTransactions(
                address,
                range.fromMs,
                range.toMs,
            );
            const segment = mapHeliusTxsToTransfers(txs, address);
            fetchedTransfers.push(...segment);
        }
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

    const cacheTo = to || Date.now()
    const fromDate = new Date(cacheTo - (30 * 24 * 60 * 60 * 1000))
    const cachefrom = from || Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth(),
        fromDate.getUTCDate(),
        0,
        0,
        0,
        0,
    )
    await enrichWithSolanaTokenPrices(combinedTransfers);
    await postEnrichTransfers(combinedTransfers);
    await saveTransfersCache(address, combinedTransfers, cachefrom, cacheTo);

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
        walletSwapMeta?.coveredFromSec != null && walletSwapMeta?.coveredToSec != null
            ? {
                fromMs: walletSwapMeta.coveredFromSec * 1000,
                toMs: walletSwapMeta.coveredToSec * 1000,
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
        await postEnrichSwaps(swaps);
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
        if (isMissingRangeSignificant(range.fromMs, range.toMs)) {
            console.log(`[get wallet swaps] Fetch missing ranges ${new Date(range.fromMs)} - ${new Date(range.toMs)}`)

            const txs = await resolveEnhancedTransactions(
                address,
                range.fromMs,
                range.toMs,
            );
            const mapped = mapHeliusTxsToSwaps(txs, address);
            fetchedSwaps.push(...mapped);
        }
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

    const cacheTo = to || Date.now()
    const fromDate = new Date(cacheTo - (30 * 24 * 60 * 60 * 1000))
    const cachefrom = from || Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth(),
        fromDate.getUTCDate(),
        0,
        0,
        0,
        0,
    )
    await enrichWithSolanaTokenPrices(combinedSwaps);
    await postEnrichSwaps(combinedSwaps);
    await saveSwapsCache(address, combinedSwaps, cachefrom, cacheTo);

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
