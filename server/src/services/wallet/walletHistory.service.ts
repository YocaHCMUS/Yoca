import {
    fetchAllTransactionHistory,
    fetchAllTransactionHistoryChunk,
} from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import { getCachedWalletTransactionsHelius } from "@sv/services/wallet/db/walletDataRetriever.js";
import { saveTransactionsHeliusCache } from "@sv/services/wallet/db/walletDataCacher.js";
import type {
    WalletHistoryQueryOptions,
    WalletTransactionHelius,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
    DEFAULT_HELIUS_HISTORY_CHUNK_PAGES,
    DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS,
    MAX_HELIUS_HISTORY_CHUNK_PAGES,
    MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS,
    WALLET_TABLE_PAGE_SIZE,
} from "@sv/services/wallet/wallet.constants.js";
import {
    getHistoryRange,
    getTimestampSecFromIso,
    normalizeCursorValue,
    type WalletHistoryRange,
} from "@sv/services/wallet/walletTime.utils.js";

function clampHistoryTransactionLimit(limit?: number): number | null {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    const normalized = Math.floor(parsed);
    if (normalized < 1) {
        return 1;
    }

    return Math.min(normalized, MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS);
}

function mergeTransactionsBySignature(
    existing: WalletTransactionHelius[],
    incoming: WalletTransactionHelius[],
): WalletTransactionHelius[] {
    const bySignature = new Map<string, WalletTransactionHelius>();

    for (const tx of existing) {
        bySignature.set(tx.signature, tx);
    }

    for (const tx of incoming) {
        bySignature.set(tx.signature, tx);
    }

    return Array.from(bySignature.values()).sort((a, b) =>
        Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
}

export async function getWalletTransactionHeliusFromSources(
    address: string,
    options?: WalletHistoryQueryOptions,
): Promise<{ address: string; transactions: WalletTransactionHelius[] }> {
    const requestedRange = getHistoryRange(options);
    const providerBeforeCursor = normalizeCursorValue(options?.before ?? options?.cursor);
    const requestedLimit = clampHistoryTransactionLimit(options?.limit);

    // Cursor- or limit-driven requests should avoid broad cache-range scans and
    // use a bounded provider fetch path to keep request memory stable.
    if (providerBeforeCursor || requestedLimit != null) {
        const maxTransactions = requestedLimit ?? DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS;
        const maxPages = Math.min(
            Math.max(
                DEFAULT_HELIUS_HISTORY_CHUNK_PAGES,
                Math.ceil(maxTransactions / WALLET_TABLE_PAGE_SIZE),
            ),
            MAX_HELIUS_HISTORY_CHUNK_PAGES,
        );

        try {
            const chunk = await fetchAllTransactionHistoryChunk(address, requestedRange, {
                beforeCursor: providerBeforeCursor,
                maxPages,
                maxTransactions,
            });

            const transactions = chunk.transactions.filter((tx) => {
                const txSec = getTimestampSecFromIso(tx.timestamp);
                return txSec >= requestedRange.fromSec && txSec <= requestedRange.toSec;
            });

            await saveTransactionsHeliusCache(address, transactions);

            console.log("[wallet-transaction-helius-cache]", {
                address,
                requestedRange,
                fetchMode: "bounded-provider",
                requestedLimit,
                maxPages,
                pagesFetched: chunk.pagesFetched,
                stopReason: chunk.stopReason,
                hasMore: chunk.hasMore,
                nextCursor: chunk.nextCursor,
                returnedCount: transactions.length,
            });

            return {
                address,
                transactions,
            };
        } catch (fetchErr) {
            console.error("[wallet-transaction-helius-cache] Bounded provider fetch failed", fetchErr);
            return {
                address,
                transactions: [],
            };
        }
    }

    const cacheRangeResult = await getCachedWalletTransactionsHelius(
        address,
        requestedRange,
    );

    let fetchedTransactions: WalletTransactionHelius[] = [];
    let mergedTransactions = cacheRangeResult.transactions;
    let confirmedCoverageRange: WalletHistoryRange | undefined =
        cacheRangeResult.isFullyCovered ? requestedRange : undefined;

    if (!cacheRangeResult.isFullyCovered) {
        const knownSignatures = new Set(
            cacheRangeResult.transactions.map((tx) => tx.signature),
        );

        let headCoverageConfirmed = false;
        let tailCoverageConfirmed = false;

        const hasNoCoverage =
            cacheRangeResult.coveredRange.earliestSec == null ||
            cacheRangeResult.coveredRange.latestSec == null;

        if (hasNoCoverage) {
            try {
                fetchedTransactions = await fetchAllTransactionHistory(address, requestedRange, {
                    beforeCursor: providerBeforeCursor,
                });
                headCoverageConfirmed = true;
                tailCoverageConfirmed = true;
            } catch (fetchErr) {
                console.error("[wallet-transaction-helius-cache] Full-range fetch failed", fetchErr);
            }
        } else {
            const coveredLatestSec = cacheRangeResult.coveredRange.latestSec;
            const coveredEarliestSec = cacheRangeResult.coveredRange.earliestSec;

            if (coveredLatestSec == null || coveredEarliestSec == null) {
                try {
                    fetchedTransactions = await fetchAllTransactionHistory(address, requestedRange, {
                        beforeCursor: providerBeforeCursor,
                    });
                    headCoverageConfirmed = true;
                    tailCoverageConfirmed = true;
                } catch (fetchErr) {
                    console.error("[wallet-transaction-helius-cache] Full-range fallback fetch failed", fetchErr);
                }
            } else {
                const needsHeadGapFill = coveredLatestSec < requestedRange.toSec;
                const needsTailGapFill = coveredEarliestSec > requestedRange.fromSec;

                headCoverageConfirmed = !needsHeadGapFill;
                tailCoverageConfirmed = !needsTailGapFill;

                if (needsHeadGapFill) {
                    try {
                        const headFetched = await fetchAllTransactionHistory(address, requestedRange, {
                            beforeCursor: providerBeforeCursor,
                            stopAtKnownSignatures: knownSignatures,
                        });
                        fetchedTransactions = mergeTransactionsBySignature(fetchedTransactions, headFetched);
                        for (const tx of headFetched) {
                            knownSignatures.add(tx.signature);
                        }
                        headCoverageConfirmed = true;
                    } catch (headErr) {
                        headCoverageConfirmed = false;
                        console.error("[wallet-transaction-helius-cache] Head-gap fetch failed", headErr);
                    }
                }

                if (needsTailGapFill) {
                    const oldestCachedTx = cacheRangeResult.transactions.reduce<WalletTransactionHelius | null>(
                        (oldest, tx) => {
                            if (!oldest) {
                                return tx;
                            }

                            return getTimestampSecFromIso(tx.timestamp) < getTimestampSecFromIso(oldest.timestamp)
                                ? tx
                                : oldest;
                        },
                        null,
                    );

                    const tailToSec = Math.max(
                        requestedRange.fromSec,
                        coveredEarliestSec - 1,
                    );

                    try {
                        const tailFetched = oldestCachedTx
                            ? await fetchAllTransactionHistory(
                                address,
                                { fromSec: requestedRange.fromSec, toSec: tailToSec },
                                { beforeCursor: oldestCachedTx.signature },
                            )
                            : await fetchAllTransactionHistory(
                                address,
                                { fromSec: requestedRange.fromSec, toSec: tailToSec },
                            );

                        fetchedTransactions = mergeTransactionsBySignature(fetchedTransactions, tailFetched);
                        tailCoverageConfirmed = true;
                    } catch (tailErr) {
                        tailCoverageConfirmed = false;
                        console.error("[wallet-transaction-helius-cache] Tail-gap fetch failed", tailErr);
                    }
                }
            }
        }

        confirmedCoverageRange =
            headCoverageConfirmed && tailCoverageConfirmed ? requestedRange : undefined;

        // Persist fetched rows on every sync attempt. Coverage bounds are widened
        // only for ranges confirmed by cache + completed provider fetch paths.
        await saveTransactionsHeliusCache(
            address,
            fetchedTransactions,
            confirmedCoverageRange,
        );

        mergedTransactions = mergeTransactionsBySignature(
            cacheRangeResult.transactions,
            fetchedTransactions,
        ).filter((tx) => {
            const txSec = getTimestampSecFromIso(tx.timestamp);
            return txSec >= requestedRange.fromSec && txSec <= requestedRange.toSec;
        });
    }

    console.log("[wallet-transaction-helius-cache]", {
        address,
        requestedRange,
        coveredRange: cacheRangeResult.coveredRange,
        cacheHitRatio:
            mergedTransactions.length > 0
                ? Number((cacheRangeResult.transactions.length / mergedTransactions.length).toFixed(4))
                : 0,
        cachedCount: cacheRangeResult.transactions.length,
        fetchedCount: fetchedTransactions.length,
        confirmedCoverageRange,
        returnedCount: mergedTransactions.length,
    });

    return {
        address,
        transactions: mergedTransactions,
    };
}

export async function getWalletTransactionHelius(
    address: string,
    options?: WalletHistoryQueryOptions,
): Promise<{ address: string; transactions: WalletTransactionHelius[] }> {
    return getWalletTransactionHeliusFromSources(address, options);
}
