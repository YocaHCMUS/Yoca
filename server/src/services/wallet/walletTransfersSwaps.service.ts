import { saveSwapsCache, saveTransfersCache } from "@sv/services/wallet/db/walletDataCacher.js";
import { getCachedWalletTransfers, getCachedWalletTransfersChunk, getCachedWalletSwaps, getCachedWalletSwapsChunk } from "@sv/services/wallet/db/walletDataRetriever.js";
import type { WalletTransfersQueryOptions, WalletTransfersResponse, WalletSwapsQueryOptions, WalletSwapsResponse, WalletSwap, SwapProviderSource } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { fetchHeliusSolanaTransfers, fetchHeliusSolanaTransfersChunk, fetchMoralisSolanaSwap, fetchMoralisSolanaSwapChunk } from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import { WALLET_TABLE_PAGE_SIZE } from "@sv/services/wallet/wallet.constants.js";
import { enrichWithSolanaTokenPrices } from "@sv/services/wallet/walletEnrichment.service.js";
import { normalizeCursorValue } from "@sv/services/wallet/walletTime.utils.js";
import { normalizeShortHistoryPeriod, toWalletPageInfo } from "@sv/services/wallet/walletData.core.js";

export async function getWalletTransfers(
    address: string,
    options?: WalletTransfersQueryOptions,
): Promise<WalletTransfersResponse> {
    const shortPeriod = normalizeShortHistoryPeriod(options?.from);
    if (shortPeriod) {
        const cachedTransfers = await getCachedWalletTransfers(
            address,
            shortPeriod,
        );
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

        try {
            const transfers = await fetchHeliusSolanaTransfers(address, shortPeriod);

            console.log(
                `[getWalletTransfers] Successfully fetched ${transfers.length} transfers from Helius for ${address}`,
            );

            await saveTransfersCache(address, transfers);
            await enrichWithSolanaTokenPrices(transfers);

            return {
                address,
                transfers,
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "provider",
                }),
            };
        } catch (err) {
            console.error("[getWalletTransfers] Failed to fetch Solana transfers from Helius", err);
            return {
                address,
                transfers: [],
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "provider",
                }),
            };
        }
    }

    const cursor = normalizeCursorValue(options?.cursor ?? options?.before);

    const cachedChunk = await getCachedWalletTransfersChunk(address, {
        cursor,
        limit: WALLET_TABLE_PAGE_SIZE,
    });

    if (cachedChunk.available && (!cursor || cachedChunk.cursorMatched)) {
        await enrichWithSolanaTokenPrices(cachedChunk.items);
        return {
            address,
            transfers: cachedChunk.items,
            pageInfo: toWalletPageInfo({
                hasMore: cachedChunk.hasMore,
                nextCursor: cachedChunk.nextCursor,
                source: "cache",
            }),
        };
    }

    // Cache-generated transfer cursors include instruction index, and are not valid provider cursors.
    if (cursor && cursor.includes(":")) {
        return {
            address,
            transfers: [],
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: cachedChunk.available ? "cache" : "mixed",
            }),
        };
    }

    try {
        const chunk = await fetchHeliusSolanaTransfersChunk(address, {
            cursor,
            limit: WALLET_TABLE_PAGE_SIZE,
        });

        await saveTransfersCache(address, chunk.items);
        await enrichWithSolanaTokenPrices(chunk.items);

        return {
            address,
            transfers: chunk.items,
            pageInfo: toWalletPageInfo({
                hasMore: chunk.hasMore,
                nextCursor: chunk.nextCursor,
                source: "provider",
            }),
        };
    } catch (err) {
        console.error("[getWalletTransfers] Failed to fetch Solana transfer chunk", err);
        return {
            address,
            transfers: [],
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: "provider",
            }),
        };
    }
}

export async function getWalletSwaps(
    address: string,
    options?: WalletSwapsQueryOptions,
): Promise<WalletSwapsResponse> {
    const shortPeriod = normalizeShortHistoryPeriod(options?.from);
    if (shortPeriod) {
        const limit = Math.min(options?.limit ?? 100, 500);

        const cachedSwaps = await getCachedWalletSwaps(address, shortPeriod);
        if (cachedSwaps) {
            await enrichWithSolanaTokenPrices(cachedSwaps);
            return {
                address,
                swaps: cachedSwaps.slice(0, limit),
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "cache",
                }),
            };
        }

        try {
            let swaps: WalletSwap[] = [];
            try {
                swaps = await fetchMoralisSolanaSwap(address, shortPeriod, {
                    limit,
                    cursor: options?.cursor ?? options?.before,
                });

                console.log(
                    `[getWalletSwaps] Successfully fetched ${swaps.length} swaps from Moralis for ${address}`,
                );
            } catch (moralisErr) {
                console.error("[getWalletSwaps] Moralis swap fetch failed", moralisErr);
            }

            await saveSwapsCache(address, swaps);
            await enrichWithSolanaTokenPrices(swaps);

            return {
                address,
                swaps: swaps.slice(0, limit),
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "provider",
                }),
            };
        } catch (err) {
            console.error("[getWalletSwaps] Failed to fetch Solana swaps", err);
            return {
                address,
                swaps: [],
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "provider",
                }),
            };
        }
    }

    const cursor = normalizeCursorValue(options?.cursor ?? options?.before);

    const cachedChunk = await getCachedWalletSwapsChunk(address, {
        before: cursor,
        limit: WALLET_TABLE_PAGE_SIZE,
    });

    if (cachedChunk.available && (!cursor || cachedChunk.cursorMatched)) {
        await enrichWithSolanaTokenPrices(cachedChunk.items);
        return {
            address,
            swaps: cachedChunk.items,
            pageInfo: toWalletPageInfo({
                hasMore: cachedChunk.hasMore,
                nextCursor: cachedChunk.nextCursor,
                source: "cache",
            }),
        };
    }

    try {
        let chunk: { items: WalletSwap[]; nextCursor: string | null; hasMore: boolean } = {
            items: [],
            nextCursor: null,
            hasMore: false,
        };

        try {
            chunk = await fetchMoralisSolanaSwapChunk(address, {
                limit: WALLET_TABLE_PAGE_SIZE,
                cursor,
            });

            console.log(
                `[getWalletSwaps] Successfully fetched ${chunk.items.length} swaps from Moralis chunk for ${address}`,
            );
        } catch (moralisErr) {
            console.error("[getWalletSwaps] Moralis swap fetch failed", moralisErr);
            console.log(
                `[getWalletSwaps] Moralis failed; fallback fetched ${chunk.items.length} swaps from Helius chunk for ${address}`,
            );
        }

        if (!chunk.items.length) {
            return {
                address,
                swaps: [],
                pageInfo: toWalletPageInfo({
                    hasMore: false,
                    nextCursor: null,
                    source: "provider",
                }),
            }
        }

        chunk.items.filter(swap => swap != null);

        await saveSwapsCache(address, chunk.items);
        await enrichWithSolanaTokenPrices(chunk.items);

        return {
            address,
            swaps: chunk.items,
            pageInfo: toWalletPageInfo({
                hasMore: chunk.hasMore,
                nextCursor: chunk.nextCursor,
                source: "provider",
            }),
        };
    } catch (err) {
        console.error("[getWalletSwaps] Failed to fetch Solana swap chunk", err);
        return {
            address,
            swaps: [],
            pageInfo: toWalletPageInfo({
                hasMore: false,
                nextCursor: null,
                source: "provider",
            }),
        };
    }
}
