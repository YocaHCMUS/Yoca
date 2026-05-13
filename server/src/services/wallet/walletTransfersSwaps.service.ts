import { saveSwapsCache, saveTransfersCache } from "@sv/services/wallet/db/walletDataCacher.js";
import { getCachedWalletTransfers, getCachedWalletSwaps, getCachedWalletTransfersMeta, getCachedWalletSwapsMeta } from "@sv/services/wallet/db/walletDataRetriever.js";
import type { WalletTransfersResponse, WalletSwapsResponse, WalletSwap, WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { fetchHeliusSolanaTransfers } from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import { fetchAndProcessWalletTransactions } from "@sv/services/wallet/providers/helius-transaction-provider.js";
import { enrichWithSolanaTokenPrices } from "@sv/services/wallet/walletEnrichment.service.js";
import { resolveTokenPricesAtTimestamp } from "@sv/services/wallet/providers/resolve-token-price.js";
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

function isMissingRangeSignificant(from: number, to: number) {
    const TTL = 5 * 60 * 1000
    return to - from > TTL
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

async function postEnrichSwaps(swaps: WalletSwap[]): Promise<void> {
  for (const swap of swaps) {
    const boughtSym = swap.bought?.symbol ?? swap.bought?.address ?? "?";
    const soldSym = swap.sold?.symbol ?? swap.sold?.address ?? "?";
    const uniqueSyms = [...new Set([soldSym, boughtSym])];
    swap.tokensInvolved = uniqueSyms.join("/");
    swap.pairAddress = swap.tokensInvolved;
  }

  const pending = swaps.filter(s => s.totalValueUsd == null && s.blockTimestampIso);
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
            const segment = await fetchHeliusSolanaTransfers(
                address,
                range.fromMs,
                range.toMs,
            );
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
    await saveTransfersCache(address, combinedTransfers, cachefrom, cacheTo);
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

            const result = await fetchAndProcessWalletTransactions(
                address,
                { fromMs: range.fromMs, toMs: range.toMs },
            );
            fetchedSwaps.push(...result.swaps);
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
    await saveSwapsCache(address, combinedSwaps, cachefrom, cacheTo);
    await enrichWithSolanaTokenPrices(combinedSwaps);
    await postEnrichSwaps(combinedSwaps);

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
