import type { HeliusEnhancedTransaction } from "@sv/services/transactions.js";
import { runCursorPagination } from "@sv/services/wallet/fetchers/walletPagination.js";
import { heliusGetJson } from "./helius.client.js";
import { TRANSACTION_FETCH_MAX_ITEM_COUNT, TRANSACTION_FETCH_MAX_PAGE_COUNT } from "@sv/config/constants.js";
import { getNextkey } from "@sv/util/util-helius.js";

export type HeliusTxFetcherResult = {
  transactions: HeliusEnhancedTransaction[];
  cursor: string | null;
  hasMore: boolean;
  pagesFetched: number;
};

export async function fetchHeliusAddressTransactions(
  address: string,
  options?: {
    limit?: number;
    before?: string;
    fromMs?: number;
    toMs?: number;
  },
): Promise<HeliusTxFetcherResult> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 100);
  const rangeToMs = options?.toMs ?? Date.now();
  const rangeFromMs = options?.fromMs ?? 0;
  const apikey = getNextkey()

  const paged = await runCursorPagination<HeliusEnhancedTransaction>({
    initialCursor: options?.before ?? null,
    maxPages: TRANSACTION_FETCH_MAX_PAGE_COUNT,
    maxItems: TRANSACTION_FETCH_MAX_ITEM_COUNT,
    fetchPage: async (cursor) => {
      let json: unknown;
      try {
        const params: Record<string, string | number | boolean> = { limit, "api-key": apikey };
        if (cursor) params.before = cursor;
        json = await heliusGetJson<unknown>(
          `/v0/addresses/${address}/transactions`,
          params,
        );
      } catch (err) {
        console.error("Helius address transactions request failed", err);
        return { pageItems: [], nextCursor: null, hasMore: false };
      }

      const data = Array.isArray(json)
        ? (json as HeliusEnhancedTransaction[])
        : [];
      if (data.length === 0) {
        return { pageItems: [], nextCursor: null, hasMore: false };
      }

      const pageItems: HeliusEnhancedTransaction[] = [];
      let reachedLowerBound = false;

      for (const tx of data) {
        const tsSec = Number(tx.timestamp ?? tx.info?.timestamp ?? 0);
        if (!tsSec) continue;

        const tsMs = tsSec * 1000;
        if (tsMs > rangeToMs) continue;
        if (tsMs < rangeFromMs) {
          reachedLowerBound = true;
          break;
        }

        pageItems.push(tx);
      }

      const lastTx = data[data.length - 1];
      const nextCursor =
        lastTx?.signature && !reachedLowerBound ? lastTx.signature : null;
      const hasMore = !reachedLowerBound && data.length >= limit;

      return { pageItems, nextCursor, hasMore };
    },
  });

  return {
    transactions: paged.items,
    cursor: paged.cursor,
    hasMore: paged.hasMore,
    pagesFetched: paged.pagesFetched,
  };
}
