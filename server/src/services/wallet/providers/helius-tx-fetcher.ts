import type { HeliusEnhancedTransaction } from "@sv/services/transactions.js";
import { runCursorPagination } from "@sv/services/wallet/fetchers/walletPagination.js";
import { getEndpoint, getNextkey, heliusFetch } from "@sv/util/util-helius.js";

export type HeliusTxFetcherResult = {
  transactions: HeliusEnhancedTransaction[];
  cursor: string | null;
  hasMore: boolean;
  pagesFetched: number;
};

async function heliusAddressFetch<T>(
  path: string,
  searchParams: Record<string, string | number | boolean>,
): Promise<T> {
  const url = getEndpoint(path);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }
  if (!url.searchParams.has("api-key")) {
    const apiKey = getNextkey();
    url.searchParams.set("api-key", apiKey);
  }
  const response = await heliusFetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Helius API error ${response.status}: ${response.statusText}`);
  }
  return (await response.json()) as T;
}

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

  const paged = await runCursorPagination<HeliusEnhancedTransaction>({
    initialCursor: options?.before ?? null,
    maxPages: 50,
    maxItems: 5000,
    fetchPage: async (cursor) => {
      let json: unknown;
      try {
        const params: Record<string, string | number | boolean> = { limit };
        if (cursor) params.before = cursor;
        json = await heliusAddressFetch<unknown>(
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
