import { saveSwapsCache, saveTransfersCache } from "@sv/services/wallet/db/walletDataCacher.js";
import { getCachedWalletTransfers, getCachedWalletTransfersChunk, getCachedWalletSwaps, getCachedWalletSwapsChunk, getCachedWalletTransfersMeta, getCachedWalletSwapsMeta } from "@sv/services/wallet/db/walletDataRetriever.js";
import type { WalletTransfersQueryOptions, WalletTransfersResponse, WalletSwapsQueryOptions, WalletSwapsResponse, WalletSwap } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { fetchHeliusSolanaTransfers, fetchHeliusSolanaTransfersChunk, fetchMoralisSolanaSwap, fetchMoralisSolanaSwapChunk } from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import { WALLET_TABLE_PAGE_SIZE } from "@sv/services/wallet/wallet.constants.js";
import { enrichWithSolanaTokenPrices } from "@sv/services/wallet/walletEnrichment.service.js";
import { normalizeCursorValue } from "@sv/services/wallet/walletTime.utils.js";
import { normalizeShortHistoryPeriod, toWalletPageInfo } from "@sv/services/wallet/walletData.core.js";

function filterSwapsByToken(swaps: WalletSwap[], tokenAddress?: string): WalletSwap[] {
    const normalizedTokenAddress = tokenAddress?.trim().toLowerCase();
    if (!normalizedTokenAddress) {
        return swaps;
    }

    return swaps.filter((swap) => {
        const boughtAddress = swap.bought.address.trim().toLowerCase();
        const soldAddress = swap.sold.address.trim().toLowerCase();
        return boughtAddress === normalizedTokenAddress || soldAddress === normalizedTokenAddress;
    });
}

// export async function getWalletTransfers(
//     address: string,
//     options?: WalletTransfersQueryOptions,
// ): Promise<WalletTransfersResponse> {
//     const shortPeriod = normalizeShortHistoryPeriod(options?.from);
//     if (shortPeriod) {
//         const cachedTransfers = await getCachedWalletTransfers(
//             address,
//             shortPeriod,
//         );
//         if (cachedTransfers) {
//             await enrichWithSolanaTokenPrices(cachedTransfers);
//             return {
//                 address,
//                 transfers: cachedTransfers,
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "cache",
//                 }),
//             };
//         }

//         try {
//             const transfers = await fetchHeliusSolanaTransfers(address, shortPeriod);

//             console.log(
//                 `[getWalletTransfers] Successfully fetched ${transfers.length} transfers from Helius for ${address}`,
//             );

//             await saveTransfersCache(address, transfers);
//             await enrichWithSolanaTokenPrices(transfers);

//             return {
//                 address,
//                 transfers,
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "provider",
//                 }),
//             };
//         } catch (err) {
//             console.error("[getWalletTransfers] Failed to fetch Solana transfers from Helius", err);
//             return {
//                 address,
//                 transfers: [],
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "provider",
//                 }),
//             };
//         }
//     }

//     const cursor = normalizeCursorValue(options?.cursor ?? options?.before);

//     const cachedChunk = await getCachedWalletTransfersChunk(address, {
//         cursor,
//         limit: WALLET_TABLE_PAGE_SIZE,
//     });

//     if (cachedChunk.available && (!cursor || cachedChunk.cursorMatched)) {
//         await enrichWithSolanaTokenPrices(cachedChunk.items);
//         return {
//             address,
//             transfers: cachedChunk.items,
//             pageInfo: toWalletPageInfo({
//                 hasMore: cachedChunk.hasMore,
//                 nextCursor: cachedChunk.nextCursor,
//                 source: "cache",
//             }),
//         };
//     }

//     // Cache-generated transfer cursors include instruction index, and are not valid provider cursors.
//     if (cursor && cursor.includes(":")) {
//         return {
//             address,
//             transfers: [],
//             pageInfo: toWalletPageInfo({
//                 hasMore: false,
//                 nextCursor: null,
//                 source: cachedChunk.available ? "cache" : "mixed",
//             }),
//         };
//     }

//     try {
//         const chunk = await fetchHeliusSolanaTransfersChunk(address, {
//             cursor,
//             limit: WALLET_TABLE_PAGE_SIZE,
//         });

//         await saveTransfersCache(address, chunk.items);
//         await enrichWithSolanaTokenPrices(chunk.items);

//         return {
//             address,
//             transfers: chunk.items,
//             pageInfo: toWalletPageInfo({
//                 hasMore: chunk.hasMore,
//                 nextCursor: chunk.nextCursor,
//                 source: "provider",
//             }),
//         };
//     } catch (err) {
//         console.error("[getWalletTransfers] Failed to fetch Solana transfer chunk", err);
//         return {
//             address,
//             transfers: [],
//             pageInfo: toWalletPageInfo({
//                 hasMore: false,
//                 nextCursor: null,
//                 source: "provider",
//             }),
//         };
//     }
// }


export async function getWalletTransfers(
    address: string,
    from?: number,
    to?: number
): Promise<WalletTransfersResponse> {
    const metaRows = await getCachedWalletTransfersMeta(address);
    const walletTransferMeta = metaRows.length > 0 ? metaRows[0] : null;

    // Determine requested range (in ms)
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let requestedFromMs: number;
    let requestedToMs: number = nowMs;

    if (from == null && to == null) {
        // Fetch all: 7 days back
        requestedFromMs = nowMs - sevenDaysMs;
    } else {
        requestedFromMs = from ?? (nowMs - sevenDaysMs);
        requestedToMs = to ?? nowMs;
    }

    // Check cache validity: both coverage bounds must be non-null.
    // If one bound missing, treat cache as invalid and skip overlap logic.
    const coveredFromMs = walletTransferMeta?.coveredFromMs ?? null;
    const coveredToMs = walletTransferMeta?.coveredToMs ?? null;
    const cacheValid =
        walletTransferMeta != null &&
        coveredFromMs != null &&
        coveredToMs != null;

    if (cacheValid) {
        const missingRanges: Array<{ fromMs: number; toMs: number }> = [];

        if (requestedFromMs < coveredFromMs) {
            missingRanges.push({ fromMs: requestedFromMs, toMs: coveredFromMs });
        }

        if (coveredToMs < requestedToMs) {
            missingRanges.push({ fromMs: coveredToMs, toMs: requestedToMs });
        }

        // Check if requested range is fully covered by cache.
        if (missingRanges.length === 0) {
            const cachedTransfers = await getCachedWalletTransfers(address, requestedFromMs, requestedToMs);
            if (cachedTransfers) {
                await enrichWithSolanaTokenPrices(cachedTransfers);
                return {
                    address,
                    transfers: cachedTransfers,
                    pageInfo: toWalletPageInfo({
                        hasMore: false,
                        nextCursor: null,
                        source: "cache",
                    }),
                };
            }
        }

        const overlapFromMs = Math.max(requestedFromMs, coveredFromMs);
        const overlapToMs = Math.min(requestedToMs, coveredToMs);

        if (overlapFromMs < overlapToMs) {
            const cachedTransfers = await getCachedWalletTransfers(address, overlapFromMs, overlapToMs);
            if (cachedTransfers) {
                await enrichWithSolanaTokenPrices(cachedTransfers);
                return {
                    address,
                    transfers: cachedTransfers,
                    pageInfo: toWalletPageInfo({
                        hasMore: missingRanges.length > 0,
                        nextCursor: null,
                        source: "cache",
                    }),
                };
            }
        }

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


// export async function getWalletSwaps(
//     address: string,
//     options?: WalletSwapsQueryOptions,
// ): Promise<WalletSwapsResponse> {
//     const limit = Math.min(options?.limit ?? WALLET_TABLE_PAGE_SIZE, WALLET_TABLE_PAGE_SIZE);

//     const shortPeriod = normalizeShortHistoryPeriod(options?.from);
//     if (shortPeriod) {
//         const shortPeriodLimit = Math.min(limit, 500);

//         const nowMs = Date.now();
//         const periodMs = shortPeriod === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
//         const cachedSwaps = await getCachedWalletSwaps(address, nowMs - periodMs, nowMs);
//         if (cachedSwaps) {
//             const filteredCachedSwaps = filterSwapsByToken(cachedSwaps, options?.tokenAddress);
//             await enrichWithSolanaTokenPrices(filteredCachedSwaps);
//             return {
//                 address,
//                 swaps: filteredCachedSwaps.slice(0, shortPeriodLimit),
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "cache",
//                 }),
//             };
//         }

//         try {
//             let swaps: WalletSwap[] = [];
//             try {
//                 swaps = await fetchMoralisSolanaSwap(address, shortPeriod, {
//                     limit: shortPeriodLimit,
//                     cursor: options?.cursor ?? options?.before,
//                     tokenAddress: options?.tokenAddress,
//                 });

//                 console.log(
//                     `[getWalletSwaps] Successfully fetched ${swaps.length} swaps from Moralis for ${address}`,
//                 );
//             } catch (moralisErr) {
//                 console.error("[getWalletSwaps] Moralis swap fetch failed", moralisErr);
//             }

//             await saveSwapsCache(address, swaps);
//             const filteredSwaps = filterSwapsByToken(swaps, options?.tokenAddress);
//             await enrichWithSolanaTokenPrices(filteredSwaps);

//             return {
//                 address,
//                 swaps: filteredSwaps.slice(0, shortPeriodLimit),
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "provider",
//                 }),
//             };
//         } catch (err) {
//             console.error("[getWalletSwaps] Failed to fetch Solana swaps", err);
//             return {
//                 address,
//                 swaps: [],
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "provider",
//                 }),
//             };
//         }
//     }

//     const cursor = normalizeCursorValue(options?.cursor ?? options?.before);

//     const cachedChunk = await getCachedWalletSwapsChunk(address, {
//         before: cursor,
//         limit,
//     });

//     if (cachedChunk.available && (!cursor || cachedChunk.cursorMatched)) {
//         const filteredCachedItems = filterSwapsByToken(cachedChunk.items, options?.tokenAddress).slice(0, limit);
//         await enrichWithSolanaTokenPrices(filteredCachedItems);
//         return {
//             address,
//             swaps: filteredCachedItems,
//             pageInfo: toWalletPageInfo({
//                 hasMore: cachedChunk.hasMore,
//                 nextCursor: cachedChunk.nextCursor,
//                 source: "cache",
//             }),
//         };
//     }

//     try {
//         let chunk: { items: WalletSwap[]; nextCursor: string | null; hasMore: boolean } = {
//             items: [],
//             nextCursor: null,
//             hasMore: false,
//         };

//         try {
//             chunk = await fetchMoralisSolanaSwapChunk(address, {
//                 limit,
//                 cursor,
//                 tokenAddress: options?.tokenAddress,
//             });

//             console.log(
//                 `[getWalletSwaps] Successfully fetched ${chunk.items.length} swaps from Moralis chunk for ${address}`,
//             );
//         } catch (moralisErr) {
//             console.error("[getWalletSwaps] Moralis swap fetch failed", moralisErr);
//         }

//         if (!chunk.items.length) {
//             return {
//                 address,
//                 swaps: [],
//                 pageInfo: toWalletPageInfo({
//                     hasMore: false,
//                     nextCursor: null,
//                     source: "provider",
//                 }),
//             }
//         }

//         chunk.items.filter(swap => swap != null);

//         await saveSwapsCache(address, chunk.items);
//         const filteredChunkItems = filterSwapsByToken(chunk.items, options?.tokenAddress).slice(0, limit);
//         await enrichWithSolanaTokenPrices(filteredChunkItems);

//         return {
//             address,
//             swaps: filteredChunkItems,
//             pageInfo: toWalletPageInfo({
//                 hasMore: chunk.hasMore,
//                 nextCursor: chunk.nextCursor,
//                 source: "provider",
//             }),
//         };
//     } catch (err) {
//         console.error("[getWalletSwaps] Failed to fetch Solana swap chunk", err);
//         return {
//             address,
//             swaps: [],
//             pageInfo: toWalletPageInfo({
//                 hasMore: false,
//                 nextCursor: null,
//                 source: "provider",
//             }),
//         };
//     }
// }

export async function getWalletSwaps(
    address: string,
    from?: number,
    to?: number
): Promise<WalletSwapsResponse> {
    const metaRows = await getCachedWalletSwapsMeta(address);
    const walletSwapMeta = metaRows.length > 0 ? metaRows[0] : null;

    // Determine requested range (in ms)
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let requestedFromMs: number;
    let requestedToMs: number = nowMs;

    if (from == null && to == null) {
        // Fetch all: 7 days back
        requestedFromMs = nowMs - sevenDaysMs;
    } else {
        requestedFromMs = from ?? (nowMs - sevenDaysMs);
        requestedToMs = to ?? nowMs;
    }

    // Check cache validity: both coverage bounds must be non-null.
    // If one bound missing, treat cache as invalid and skip overlap logic.
    const coveredFromMs = walletSwapMeta?.coveredFromMs ?? null;
    const coveredToMs = walletSwapMeta?.coveredToMs ?? null;
    const cacheValid =
        walletSwapMeta != null &&
        coveredFromMs != null &&
        coveredToMs != null;

    if (cacheValid) {
        const missingRanges: Array<{ fromMs: number; toMs: number }> = [];

        if (requestedFromMs < coveredFromMs) {
            missingRanges.push({ fromMs: requestedFromMs, toMs: coveredFromMs });
        }

        if (coveredToMs < requestedToMs) {
            missingRanges.push({ fromMs: coveredToMs, toMs: requestedToMs });
        }

        // Check if requested range is fully covered by cache.
        if (missingRanges.length === 0) {
            const cachedSwaps = await getCachedWalletSwaps(address, requestedFromMs, requestedToMs);
            if (cachedSwaps) {
                await enrichWithSolanaTokenPrices(cachedSwaps);
                return {
                    address,
                    swaps: cachedSwaps,
                    pageInfo: toWalletPageInfo({
                        hasMore: false,
                        nextCursor: null,
                        source: "cache",
                    }),
                };
            }
        }

        const overlapFromMs = Math.max(requestedFromMs, coveredFromMs);
        const overlapToMs = Math.min(requestedToMs, coveredToMs);

        if (overlapFromMs < overlapToMs) {
            const cachedSwaps = await getCachedWalletSwaps(address, overlapFromMs, overlapToMs);
            if (cachedSwaps) {
                await enrichWithSolanaTokenPrices(cachedSwaps);
                return {
                    address,
                    swaps: cachedSwaps,
                    pageInfo: toWalletPageInfo({
                        hasMore: missingRanges.length > 0,
                        nextCursor: null,
                        source: "cache",
                    }),
                };
            }
        }

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
