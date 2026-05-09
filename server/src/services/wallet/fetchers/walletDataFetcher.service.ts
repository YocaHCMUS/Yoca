import type {
  BirdeyeNetworthDirection,
  BirdeyeNetworthHistoryPoint,
  BirdeyeNetworthHistoryResult,
  BirdeyeNetworthType,
  BirdeyeOverallPnlResult,
  BirdeyePnlDuration,
  BirdeyePortfolioSnapshotResult,
  BirdeyeSortType,
  BirdeyeTokenPnlDetailsOptions,
  BirdeyeTokenPnlDetailsResult,
  HeliusWalletFirstFund,
  WalletPortfolio,
  WalletPortfolioItem,
  WalletSwap,
  WalletTransaction,
  WalletTransactionHelius,
  WalletTransfer,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
  runCursorPagination,
  runOffsetPagination,
} from "@sv/services/wallet/fetchers/walletPagination.js";
import {
  getNextCursor,
  getTokenLogoUri,
  mapHeliusTransferEntry,
  mapMoralisSwapEntry,
  toFiniteNumber,
  toIsoTimestamp,
  toOptionalNumber,
  toTokenAmount,
} from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { callBirdeye } from "@sv/services/wallet/providers/adapters/birdeye.adapter.js";
import {
  birdeyeGetJson,
  birdeyePostJson,
} from "@sv/services/wallet/providers/birdeye.client.js";
import { heliusGetJson } from "@sv/services/wallet/providers/helius.client.js";
import { normalizeBirdeyeTimeParam } from "@sv/util/util-birdeye.js";
import {
  getEndpoint,
  getRequiredHeaders,
  heliusFetch,
} from "@sv/util/util-helius.js";
import * as moralis from "@sv/util/util-moralis.js";
import type {
  MoralisSwapResponseRoot,
  MoralisSwapResult,
} from "./walletThirdPartyResponses";

export type WalletProviderChunk<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

const MAX_HELIUS_PORTFOLIO_BALANCE_PAGES = 250;
const MAX_HELIUS_PORTFOLIO_ITEMS = 5_000;
const MAX_HELIUS_PORTFOLIO_STAGNANT_PAGES = 3;

export type HeliusHistoryRange = {
  fromSec: number;
  toSec?: number;
};

export type FetchAllTransactionHistoryOptions = {
  beforeCursor?: string;
  stopAtKnownSignatures?: Set<string>;
};

export type FetchAllTransactionHistoryChunkOptions =
  FetchAllTransactionHistoryOptions & {
    maxPages?: number;
    maxTransactions?: number;
  };

export type FetchAllTransactionHistoryChunkResult = {
  transactions: WalletTransactionHelius[];
  nextCursor: string | null;
  hasMore: boolean;
  pagesFetched: number;
  stopReason:
  | "provider-end"
  | "range-cutoff"
  | "known-signature"
  | "max-pages"
  | "max-transactions"
  | "empty-page";
};

const HELIUS_HISTORY_PAGE_LIMIT = 100;
const DEFAULT_HELIUS_HISTORY_CHUNK_MAX_PAGES = 5;
const MAX_HELIUS_HISTORY_CHUNK_MAX_PAGES = 50;
const DEFAULT_HELIUS_HISTORY_CHUNK_MAX_TRANSACTIONS = 500;
const MAX_HELIUS_HISTORY_CHUNK_MAX_TRANSACTIONS = 10_000;

function resolveHistoryWindow(
  from: HeliusHistoryFrom | number | HeliusHistoryRange,
): { fromSec: number; toSec: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const daySec = 24 * 60 * 60;

  const fromSec =
    typeof from === "number"
      ? from
      : typeof from === "object"
        ? from.fromSec
        : nowSec - daySec * (from === "24h" ? 1 : 7);
  const toSec =
    typeof from === "object" && from.toSec != null ? from.toSec : nowSec;

  return {
    fromSec,
    toSec,
  };
}

export async function fetchAllTransactionHistoryChunk(
  address: string,
  from: HeliusHistoryFrom | number | HeliusHistoryRange = "7d",
  options?: FetchAllTransactionHistoryChunkOptions,
): Promise<FetchAllTransactionHistoryChunkResult> {
  const { fromSec, toSec } = resolveHistoryWindow(from);
  const maxPages = Math.min(
    Math.max(
      Math.floor(options?.maxPages ?? DEFAULT_HELIUS_HISTORY_CHUNK_MAX_PAGES),
      1,
    ),
    MAX_HELIUS_HISTORY_CHUNK_MAX_PAGES,
  );
  const maxTransactions = Math.min(
    Math.max(
      Math.floor(
        options?.maxTransactions ??
        DEFAULT_HELIUS_HISTORY_CHUNK_MAX_TRANSACTIONS,
      ),
      1,
    ),
    MAX_HELIUS_HISTORY_CHUNK_MAX_TRANSACTIONS,
  );

  const knownSignatures = options?.stopAtKnownSignatures;
  const transactions: WalletTransactionHelius[] = [];

  let cursor: string | null = options?.beforeCursor ?? null;
  let pagesFetched = 0;
  let hasMoreFromProvider = false;
  let stopReason: FetchAllTransactionHistoryChunkResult["stopReason"] =
    "provider-end";

  while (pagesFetched < maxPages && transactions.length < maxTransactions) {
    pagesFetched += 1;

    let json: any = null;
    try {
      json = await heliusGetJson<any>(
        `/v1/wallet/${address}/history?tokenAccounts=balanceChanged`,
        {
          limit: HELIUS_HISTORY_PAGE_LIMIT,
          ...(cursor ? { before: cursor } : {}),
        },
      );
    } catch (err) {
      console.error("Helius wallet transaction chunk request failed", err);
      break;
    }

    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    if (data.length === 0) {
      stopReason = "empty-page";
      hasMoreFromProvider = false;
      cursor = null;
      break;
    }

    let reachedRangeCutoff = false;
    let reachedKnownSignature = false;

    for (const entry of data) {
      const tsSec =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : null;

      if (tsSec == null) {
        continue;
      }

      if (tsSec > toSec) {
        continue;
      }

      if (tsSec < fromSec) {
        reachedRangeCutoff = true;
        break;
      }

      const signature = String(entry.signature ?? "").trim();
      if (!signature) {
        continue;
      }

      if (knownSignatures?.has(signature)) {
        reachedKnownSignature = true;
        break;
      }

      const mappedBalanceChanges = Array.isArray(entry.balanceChanges)
        ? entry.balanceChanges
          .map((change: any) => ({
            mint: String(change?.mint ?? ""),
            amount: Number(change?.amount ?? 0),
            decimals: Number(change?.decimals ?? 0),
          }))
          .filter(
            (change: { mint: string; amount: number; decimals: number }) =>
              change.mint.length > 0 &&
              Number.isFinite(change.amount) &&
              Number.isFinite(change.decimals),
          )
        : [];

      transactions.push({
        walletAddress: address,
        signature,
        timestamp: new Date(tsSec * 1000).toISOString(),
        slot: Number(entry.slot ?? 0),
        fee: Number(entry.fee ?? 0),
        feePayer: String(entry.feePayer ?? ""),
        balanceChanges: mappedBalanceChanges,
      });

      if (transactions.length >= maxTransactions) {
        break;
      }
    }

    hasMoreFromProvider = Boolean(json?.pagination?.hasMore);
    cursor = hasMoreFromProvider ? getNextCursor(json?.pagination) : null;

    if (reachedKnownSignature) {
      stopReason = "known-signature";
      break;
    }

    if (reachedRangeCutoff) {
      stopReason = "range-cutoff";
      break;
    }

    if (transactions.length >= maxTransactions) {
      stopReason = "max-transactions";
      break;
    }

    if (!hasMoreFromProvider || !cursor) {
      stopReason = "provider-end";
      break;
    }
  }

  if (
    stopReason === "provider-end" &&
    hasMoreFromProvider &&
    cursor &&
    pagesFetched >= maxPages &&
    transactions.length < maxTransactions
  ) {
    stopReason = "max-pages";
  }

  return {
    transactions,
    nextCursor: hasMoreFromProvider ? cursor : null,
    hasMore: Boolean(hasMoreFromProvider && cursor),
    pagesFetched,
    stopReason,
  };
}

export async function fetchHeliusSolanaPortfolio(
  address: string,
): Promise<WalletPortfolioItem[]> {
  const portfolio: WalletPortfolioItem[] = [];
  const seenPortfolioKeys = new Set<string>();

  let page = 1;
  const limit = 100;
  let hasMore = true;
  let pageCount = 0;
  let stagnantPageCount = 0;

  while (hasMore) {
    pageCount += 1;
    if (pageCount > MAX_HELIUS_PORTFOLIO_BALANCE_PAGES) {
      console.warn("[wallet-portfolio-fetch] Max balances page limit reached", {
        address,
        pageCount,
        itemCount: portfolio.length,
      });
      break;
    }

    const url = getEndpoint(`/v1/wallet/${address}/balances`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("showZeroBalance", "false");
    url.searchParams.set("showNative", "true");
    // NFTs are not our current focus; exclude them to reduce payload size.
    url.searchParams.set("showNfts", "false");

    let json: any;
    try {
      const headers = getRequiredHeaders();
      const resp = await heliusFetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          "Helius wallet balances error",
          resp.status,
          resp.statusText,
        );
        break;
      }

      json = await resp.json();
    } catch (err) {
      console.error("Helius wallet balances request failed", err);
      break;
    }

    const balances: any[] = Array.isArray(json?.balances) ? json.balances : [];
    if (balances.length === 0) {
      break;
    }

    let addedOnPage = 0;

    for (const token of balances) {
      const amount = Number(token.balance ?? 0);
      if (!(amount > 0) || Number.isNaN(amount)) continue;

      const tokenAddress = String(token.mint ?? "");
      const tokenAddressKey = tokenAddress.trim().toLowerCase();
      const fallbackKey = `${String(token.symbol ?? "")
        .trim()
        .toLowerCase()}::${String(token.name ?? "")
          .trim()
          .toLowerCase()}`;
      const dedupeKey = tokenAddressKey || fallbackKey;

      if (dedupeKey && seenPortfolioKeys.has(dedupeKey)) {
        continue;
      }

      if (dedupeKey) {
        seenPortfolioKeys.add(dedupeKey);
      }

      const pricePerToken =
        token.pricePerToken != null &&
          !Number.isNaN(Number(token.pricePerToken))
          ? Number(token.pricePerToken)
          : undefined;
      const usdValue =
        token.usdValue != null && !Number.isNaN(Number(token.usdValue))
          ? Number(token.usdValue)
          : pricePerToken != null
            ? amount * pricePerToken
            : 0;

      portfolio.push({
        tokenAddress,
        symbol: String(token.symbol ?? ""),
        name: token.name ? String(token.name) : undefined,
        logoUri: getTokenLogoUri(token),
        amount,
        priceUsd: pricePerToken,
        valueUsd: usdValue,
      });

      addedOnPage += 1;
      if (portfolio.length >= MAX_HELIUS_PORTFOLIO_ITEMS) {
        console.warn(
          "[wallet-portfolio-fetch] Max portfolio item limit reached",
          {
            address,
            pageCount,
            itemCount: portfolio.length,
          },
        );
        hasMore = false;
        break;
      }
    }

    if (!hasMore) {
      break;
    }

    if (addedOnPage === 0) {
      stagnantPageCount += 1;
      if (stagnantPageCount >= MAX_HELIUS_PORTFOLIO_STAGNANT_PAGES) {
        console.warn(
          "[wallet-portfolio-fetch] Stagnant pagination detected; stopping fetch",
          {
            address,
            pageCount,
            itemCount: portfolio.length,
          },
        );
        break;
      }
    } else {
      stagnantPageCount = 0;
    }

    const pagination = json?.pagination;
    hasMore = Boolean(pagination?.hasMore);
    const currentPageRaw = Number(pagination?.page);
    const nextPage = Number.isFinite(currentPageRaw)
      ? Math.max(page + 1, Math.floor(currentPageRaw) + 1)
      : page + 1;
    page = nextPage;
  }

  return portfolio;
}

export async function fetchHeliusSolanaTransactions(
  address: string,
  maxCount: number,
): Promise<WalletTransaction[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const ONE_MONTH_SEC = 30 * 24 * 60 * 60;
  const fromSec = nowSec - ONE_MONTH_SEC;

  const transactions: WalletTransaction[] = [];
  let cursor: string | null = null;

  const walletLower = address.toLowerCase();

  // Helper to safely extract a public key string from accountKeys entries
  function toPubkey(entry: any): string {
    if (!entry) return "";
    if (typeof entry === "string") return entry;
    if (typeof entry.pubkey === "string") return entry.pubkey;
    return "";
  }

  // Fetch pages until we hit maxCount, run out of data, or reach beyond 1 month.
  // Uses Wallet API: GET /v1/wallet/{wallet}/transfers (available on free plan).
  while (transactions.length < maxCount) {
    const url = getEndpoint(`/v1/wallet/${address}/transfers`);
    url.searchParams.set(
      "limit",
      String(Math.min(100, maxCount - transactions.length)),
    );
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    let json: any = null;
    try {
      const headers = getRequiredHeaders();
      const resp = await heliusFetch(url, {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        console.error(
          "Helius wallet transfers error",
          resp.status,
          resp.statusText,
        );
        break;
      }

      json = await resp.json();
    } catch (err) {
      console.error("Helius wallet transfers request failed", err);
      break;
    }

    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    if (data.length === 0) {
      break;
    }

    for (const entry of data) {
      if (transactions.length >= maxCount) break;

      const tsSec =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : null;
      if (tsSec == null) {
        // Recent entries can occasionally have null timestamp while still processing.
        continue;
      }
      if (tsSec < fromSec) {
        // Older than our 1-month window; stop collecting further pages
        return transactions;
      }

      const timestamp = tsSec
        ? new Date(tsSec * 1000).toISOString()
        : new Date().toISOString();

      let direction: WalletTransaction["direction"] = "unknown";
      if (entry.direction === "in" || entry.direction === "out") {
        direction = entry.direction;
      }
      const counterparty =
        typeof entry.counterparty === "string" ? entry.counterparty : "";

      let from = address;
      let to = address;
      if (direction === "in") {
        from = counterparty || address;
        to = address;
      } else if (direction === "out") {
        from = address;
        to = counterparty || address;
      }

      const mint = typeof entry.mint === "string" ? entry.mint : "";
      const amountRaw =
        typeof entry.amountRaw === "number" && Number.isFinite(entry.amountRaw)
          ? entry.amountRaw
          : undefined;
      const decimal =
        typeof entry.decimal === "number" && Number.isFinite(entry.decimal)
          ? entry.decimal
          : undefined;

      const amount =
        typeof amountRaw === "number" && typeof decimal === "number"
          ? amountRaw / 10 ** decimal
          : entry.amount;
      // const amount =
      //   typeof entry.amount === "number" && Number.isFinite(entry.amount)
      //     ? entry.amount
      //     : undefined;
      const symbol =
        entry.symbol != null && entry.symbol !== ""
          ? String(entry.symbol)
          : undefined;

      const hash = String(entry.signature ?? "");
      if (!hash) continue;

      const txObj: WalletTransaction = {
        hash,
        timestamp,
        from,
        to,
        status: true,
        fee: undefined,
        mainAction: undefined,
        direction,
        tokens: mint ? [mint] : undefined,
        primaryTokenSymbol: symbol != null ? symbol : mint || undefined,
        primaryTokenAmount: amount,
        primaryTokenAddress: mint || undefined,
        priceUsd: undefined, // Will be populated after fetching market data
        totalUsd: undefined,
      };

      transactions.push(txObj);
    }

    const hasMore = Boolean(json?.pagination?.hasMore);
    cursor = getNextCursor(json?.pagination);

    if (!hasMore || !cursor) {
      break;
    }
  }

  return transactions;
}

export type HeliusTransferChunkOptions = {
  cursor?: string;
  limit?: number;
};

export type HeliusSwapChunkOptions = {
  before?: string;
  limit?: number;
};

export type MoralisSwapChunkOptions = {
  cursor?: string;
  limit?: number;
  tokenAddress?: string; // Optional filter to only include swaps involving a specific token address
};

export async function fetchHeliusSolanaTransfersChunk(
  address: string,
  options?: HeliusTransferChunkOptions,
): Promise<WalletProviderChunk<WalletTransfer>> {
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);

  const json = await heliusGetJson<any>(`/v1/wallet/${address}/transfers`, {
    limit,
    ...(options?.cursor ? { cursor: options.cursor } : {}),
  });
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  const items = rows
    .map((entry) => mapHeliusTransferEntry(entry, address))
    .filter((entry): entry is WalletTransfer => entry != null);

  return {
    items,
    nextCursor: getNextCursor(json?.pagination),
    hasMore: Boolean(json?.pagination?.hasMore),
  };
}

export async function fetchMoralisSolanaSwapChunk(
  address: string,
  options?: MoralisSwapChunkOptions,
): Promise<WalletProviderChunk<WalletSwap>> {
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);

  const url = moralis.getEndpoint(`/account/mainnet/${address}/swaps`);
  url.searchParams.set("limit", String(limit));

  if (options?.cursor) {
    url.searchParams.set("cursor", options.cursor);
  }

  if (options?.tokenAddress) {
    url.searchParams.set("tokenAddress", options.tokenAddress);
  }

  const response = await moralis.moralisFetch(url, {
    method: "GET",
    headers: moralis.getRequiredHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Moralis swap chunk request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as MoralisSwapResponseRoot;

  const rows = json.result || [];

  const items = rows
    .map((entry) => mapMoralisSwapEntry(entry, address))
    .filter((entry): entry is WalletSwap => entry != null);

  const nextCursor = json.cursor;
  const hasMore = Boolean(nextCursor);

  return {
    items,
    nextCursor,
    hasMore,
  };
}

// export async function fetchHeliusSolanaTransfers(
//   address: string,
//   from: HeliusHistoryFrom = "7d",
// ): Promise<WalletTransfer[]> {
//   const nowSec = Math.floor(Date.now() / 1000);
//   const fromSec =
//     from === "24h" ? nowSec - 24 * 60 * 60 : nowSec - 7 * 24 * 60 * 60;

//   // Helius transfers endpoint returns at most 100 items per page.
//   const HELIUS_PAGE_LIMIT = 100;

//   const paged = await runCursorPagination<WalletTransfer>({
//     initialCursor: null,
//     maxPages: 500,
//     maxItems: Number.MAX_SAFE_INTEGER,
//     fetchPage: async (cursor, page) => {
//       let json: any = null;
//       try {
//         json = await heliusGetJson<any>(`/v1/wallet/${address}/transfers`, {
//           limit: HELIUS_PAGE_LIMIT,
//           ...(cursor ? { cursor } : {}),
//         });
//       } catch (err) {
//         console.error("Helius wallet transfers request failed", err);
//         return {
//           pageItems: [],
//           nextCursor: null,
//           hasMore: false,
//         };
//       }

//       const data: any[] = Array.isArray(json?.data) ? json.data : [];
//       const pageItems: WalletTransfer[] = [];
//       let reachedRangeCutoff = false;

//       for (const entry of data) {
//         const mapped = mapHeliusTransferEntry(entry, address);
//         if (!mapped) {
//           continue;
//         }

//         const tsSec = Math.floor(Date.parse(mapped.timestamp) / 1000);
//         if (tsSec < fromSec) {
//           reachedRangeCutoff = true;
//           break;
//         }

//         pageItems.push(mapped);
//       }

//       console.log(
//         `[fetchHeliusSolanaTransfers] Page ${page}: Collected ${pageItems.length} transfers on page`,
//       );

//       const nextCursor = getNextCursor(json?.pagination);
//       const hasMore = reachedRangeCutoff
//         ? false
//         : Boolean(json?.pagination?.hasMore && nextCursor);

//       return {
//         pageItems,
//         nextCursor,
//         hasMore,
//       };
//     },
//   });

//   return paged.items;
// }

export async function fetchHeliusSolanaTransfers(
  address: string,
  from?: number,
  to?: number,
  startCursor?: string,
  endCursor?: string,
): Promise<WalletTransfer[]> {
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const resolvedToMs = to ?? nowMs;
  const resolvedFromMs =
    from ?? (to != null ? resolvedToMs - sevenDaysMs : nowMs - sevenDaysMs);

  const rangeFromMs = Math.min(resolvedFromMs, resolvedToMs);
  const rangeToMs = Math.max(resolvedFromMs, resolvedToMs);

  const transactions: WalletTransfer[] = [];
  let cursor: string | null = startCursor ?? null;

  while (true) {
    let json: any = null;
    try {
      json = await heliusGetJson<any>(`/v1/wallet/${address}/transfers`, {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
    } catch (err) {
      console.error("Helius wallet transfers request failed", err);
      break;
    }

    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    if (data.length === 0) {
      break;
    }

    let reachedRangeCutoff = false;

    for (const entry of data) {
      const mapped = mapHeliusTransferEntry(entry, address);
      if (!mapped) {
        continue;
      }

      const tsMs = Date.parse(mapped.timestamp);
      if (!Number.isFinite(tsMs)) {
        continue;
      }

      if (tsMs > rangeToMs) {
        continue;
      }

      if (tsMs < rangeFromMs) {
        reachedRangeCutoff = true;
        break;
      }

      transactions.push(mapped);
    }

    const nextCursor = getNextCursor(json?.pagination);
    const hasMore = Boolean(json?.pagination?.hasMore && nextCursor);

    if (
      endCursor != null &&
      (cursor === endCursor || nextCursor === endCursor)
    ) {
      break;
    }

    if (reachedRangeCutoff || !hasMore || !nextCursor) {
      break;
    }

    cursor = nextCursor;
  }
  return transactions;
}

// type MoralisSwapFetchOptions = {
//   limit?: number; // Max total swaps to fetch across all pages (will be capped by API limits)
//   cursor?: string;
//   tokenAddress?: string; // Optional filter to only include swaps involving a specific token address
// };

// export async function fetchMoralisSolanaSwap(
//   address: string,
//   from: HeliusHistoryFrom = "7d",
//   options?: MoralisSwapFetchOptions,
// ): Promise<WalletSwap[]> {
//   const nowSec = Math.floor(Date.now() / 1000);
//   const fromSec =
//     from === "24h" ? nowSec - 24 * 60 * 60 : nowSec - 7 * 24 * 60 * 60;

//   const fromDateIso = new Date(fromSec * 1000).toISOString();
//   const toDateIso = new Date(nowSec * 1000).toISOString();

//   const paged = await runCursorPagination<WalletSwap>({
//     initialCursor: options?.cursor ?? null,
//     maxPages: 500,
//     maxItems: Number.MAX_SAFE_INTEGER,
//     fetchPage: async (cursor, page) => {
//       const url = moralis.getEndpoint(`/account/mainnet/${address}/swaps`);
//       // url.searchParams.set("limit", String(MORALIS_PAGE_LIMIT));
//       url.searchParams.set("fromDate", fromDateIso);
//       url.searchParams.set("toDate", toDateIso);
//       if (options?.tokenAddress) {
//         url.searchParams.set("tokenAddress", options.tokenAddress);
//       }

//       if (cursor) {
//         url.searchParams.set("cursor", cursor);
//       }

//       let json: MoralisSwapResponseRoot;
//       try {
//         const response = await moralis.moralisFetch(url, {
//           method: "GET",
//           headers: moralis.getRequiredHeaders(),
//         });

//         if (!response.ok) {
//           console.error(
//             "Moralis wallet-swaps error",
//             response.status,
//             response.statusText,
//           );
//           throw new Error(
//             `Moralis wallet-swaps request failed: ${response.status} ${response.statusText}`,
//           );
//         }

//         json = (await response.json()) as MoralisSwapResponseRoot;
//         console.log(
//           `[fetchMoralisSolanaSwap] Fetched page ${page} with ${Array.isArray(json?.result) ? json.result.length : 0} swaps, cursor: ${json?.cursor}`,
//           {
//             url: url.toString(),
//             responseStatus: response.status,
//           },
//         );
//       } catch (err) {
//         console.error("Moralis wallet-swaps request failed", err);
//         throw err;
//       }

//       const rows: MoralisSwapResult[] = Array.isArray(json?.result)
//         ? json.result
//         : [];

//       const pageItems = rows
//         .map((row) => mapMoralisSwapEntry(row, address))
//         .filter((row): row is WalletSwap => row != null)
//         .filter((row) => {
//           const tsSec = Math.floor(Date.parse(row.blockTimestampIso) / 1000);
//           return Number.isFinite(tsSec) && tsSec >= fromSec && tsSec <= nowSec;
//         });

//       const nextCursor = json.cursor;
//       const hasMore = Boolean(nextCursor);

//       console.log(
//         `[fetchMoralisSolanaSwap] Page ${page}: Collected ${pageItems.length} swaps on page`,
//       );

//       return {
//         pageItems,
//         nextCursor,
//         hasMore,
//       };
//     },
//   });

//   return paged.items;
// }

export async function fetchMoralisSolanaSwap(
  address: string,
  from?: number,
  to?: number,
): Promise<WalletSwap[]> {
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const resolvedToMs = to ?? nowMs;
  const resolvedFromMs =
    from ?? (to != null ? resolvedToMs - sevenDaysMs : nowMs - sevenDaysMs);

  const rangeFromMs = Math.min(resolvedFromMs, resolvedToMs);
  const rangeToMs = Math.max(resolvedFromMs, resolvedToMs);
  const fromDateIso = new Date(rangeFromMs).toISOString();
  const toDateIso = new Date(rangeToMs).toISOString();

  const paged = await runCursorPagination<WalletSwap>({
    initialCursor: null,
    maxPages: 500,
    maxItems: Number.MAX_SAFE_INTEGER,
    fetchPage: async (cursor, page) => {
      const url = moralis.getEndpoint(`/account/mainnet/${address}/swaps`);
      url.searchParams.set("limit", "100");
      url.searchParams.set("fromDate", fromDateIso);
      url.searchParams.set("toDate", toDateIso);

      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      let json: MoralisSwapResponseRoot;
      try {
        const response = await moralis.moralisFetch(url, {
          method: "GET",
          headers: moralis.getRequiredHeaders(),
        });

        if (!response.ok) {
          console.error(
            "Moralis wallet-swaps error",
            response.status,
            response.statusText,
          );
          return {
            pageItems: [],
            nextCursor: null,
            hasMore: false,
          };
        }

        json = (await response.json()) as MoralisSwapResponseRoot;
        console.log(
          `[fetchMoralisSolanaSwap] Fetched page ${page} with ${Array.isArray(json?.result) ? json.result.length : 0} swaps, cursor: ${json?.cursor}`,
          {
            url: url.toString(),
            responseStatus: response.status,
          },
        );
      } catch (err) {
        console.error("Moralis wallet-swaps request failed", err);
        return {
          pageItems: [],
          nextCursor: null,
          hasMore: false,
        };
      }

      const rows: MoralisSwapResult[] = Array.isArray(json?.result)
        ? json.result
        : [];

      const pageItems: WalletSwap[] = [];
      let reachedRangeCutoff = false;

      for (const row of rows) {
        const mapped = mapMoralisSwapEntry(row, address);
        if (!mapped) {
          continue;
        }

        const tsMs = Date.parse(mapped.blockTimestampIso);
        if (!Number.isFinite(tsMs)) {
          continue;
        }

        if (tsMs > rangeToMs) {
          continue;
        }

        if (tsMs < rangeFromMs) {
          reachedRangeCutoff = true;
          break;
        }

        pageItems.push(mapped);
      }

      console.log(
        `[fetchMoralisSolanaSwap] Page ${page}: Collected ${pageItems.length} swaps on page`,
      );

      const nextCursor = json.cursor || null;
      const hasMore = reachedRangeCutoff ? false : Boolean(nextCursor);

      return {
        pageItems,
        nextCursor,
        hasMore,
      };
    },
  });

  return paged.items;
}

export type HeliusHistoryFrom = "24h" | "7d";

export function timePeriodToFromSec(
  timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All",
): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const daySec = 24 * 60 * 60;
  switch (timePeriod) {
    case "7D":
      return nowSec - 7 * daySec;
    case "30D":
      return nowSec - 30 * daySec;
    case "60D":
      return nowSec - 60 * daySec;
    case "90D":
      return nowSec - 90 * daySec;
    case "1Y":
      return nowSec - 365 * daySec;
    case "All":
      return 0;
  }
}

export async function fetchAllTransactionHistory(
  address: string,
  from: HeliusHistoryFrom | number | HeliusHistoryRange = "7d",
  options?: FetchAllTransactionHistoryOptions,
) {
  const { fromSec, toSec } = resolveHistoryWindow(from);

  const knownSignatures = options?.stopAtKnownSignatures;

  const paged = await runCursorPagination<WalletTransactionHelius>({
    initialCursor: options?.beforeCursor ?? null,
    maxPages: MAX_HELIUS_HISTORY_CHUNK_MAX_PAGES,
    maxItems: MAX_HELIUS_HISTORY_CHUNK_MAX_TRANSACTIONS,
    fetchPage: async (cursor, page) => {
      let json: any = null;
      try {
        json = await heliusGetJson<any>(
          `/v1/wallet/${address}/history?tokenAccounts=balanceChanged`,
          {
            limit: HELIUS_HISTORY_PAGE_LIMIT,
            ...(cursor ? { before: cursor } : {}),
          },
        );
      } catch (err) {
        console.error("Helius wallet transaction request failed", err);
        return {
          pageItems: [],
          nextCursor: null,
          hasMore: false,
        };
      }

      const data: any[] = Array.isArray(json?.data) ? json.data : [];
      const pageItems: WalletTransactionHelius[] = [];
      let stopByRange = false;
      let stopByKnownSignature = false;

      for (const entry of data) {
        const tsSec =
          typeof entry.timestamp === "number" &&
            Number.isFinite(entry.timestamp)
            ? entry.timestamp
            : null;

        if (tsSec == null) {
          continue;
        }

        if (tsSec > toSec) {
          continue;
        }

        if (tsSec < fromSec) {
          stopByRange = true;
          break;
        }

        const signature = String(entry.signature ?? "").trim();
        if (!signature) {
          continue;
        }

        if (knownSignatures?.has(signature)) {
          stopByKnownSignature = true;
          break;
        }

        const mappedBalanceChanges = Array.isArray(entry.balanceChanges)
          ? entry.balanceChanges
            .map((change: any) => ({
              mint: String(change?.mint ?? ""),
              amount: Number(change?.amount ?? 0),
              decimals: Number(change?.decimals ?? 0),
            }))
            .filter(
              (change: { mint: string; amount: number; decimals: number }) =>
                change.mint.length > 0 &&
                Number.isFinite(change.amount) &&
                Number.isFinite(change.decimals),
            )
          : [];

        pageItems.push({
          walletAddress: address,
          signature,
          timestamp: new Date(tsSec * 1000).toISOString(),
          slot: Number(entry.slot ?? 0),
          fee: Number(entry.fee ?? 0),
          feePayer: String(entry.feePayer ?? ""),
          balanceChanges: mappedBalanceChanges,
        });
      }

      console.log(
        `[fetchAllTransactionHistory] Page ${page}: Collected ${pageItems.length} transactions on page`,
      );

      const nextCursor = getNextCursor(json?.pagination);
      const hasMore =
        !stopByRange &&
        !stopByKnownSignature &&
        Boolean(json?.pagination?.hasMore && nextCursor);

      return {
        pageItems,
        nextCursor,
        hasMore,
      };
    },
  });

  return paged.items;
}

async function fetchBirdeyeJson(
  path: string,
  method: "GET" | "POST",
  options?: {
    searchParams?: Record<string, string | number | boolean>;
    body?: unknown;
  },
): Promise<any | null> {
  const fetcher = async () => {
    if (method === "GET") {
      return await birdeyeGetJson(path, options?.searchParams);
    }

    return await birdeyePostJson(path, options?.body);
  };

  try {
    return await callBirdeye(path, options ?? {}, fetcher);
  } catch (err) {
    console.error("Birdeye request failed", { method, path, err });
    return null;
  }
}

export async function fetchBirdeyePortfolio(
  address: string,
): Promise<WalletPortfolio> {
  const limit = 100;
  const seenPortfolioKeys = new Set<string>();
  let lastPayload: any = null;
  const paged = await runOffsetPagination<WalletPortfolioItem>({
    initialOffset: 0,
    maxPages: MAX_HELIUS_PORTFOLIO_BALANCE_PAGES,
    maxItems: MAX_HELIUS_PORTFOLIO_ITEMS,
    pageSize: limit,
    stagnantPageLimit: MAX_HELIUS_PORTFOLIO_STAGNANT_PAGES,
    fetchPage: async (offset) => {
      const json = await fetchBirdeyeJson(
        "/wallet/v2/current-net-worth",
        "GET",
        {
          searchParams: {
            wallet: address,
            filter_value: 0.0001,
            sort_type: "desc",
            limit,
            offset,
          },
        },
      );

      if (!json) {
        return {
          pageItems: [],
          hasMore: false,
        };
      }

      lastPayload = json;
      const balances: any[] = Array.isArray(json?.data?.items)
        ? json.data.items
        : [];
      const total = Math.max(
        0,
        Math.floor(toFiniteNumber(json?.pagination?.total, 0)),
      );
      const pageItems: WalletPortfolioItem[] = [];

      for (const token of balances) {
        const amount = toTokenAmount(
          token.balance,
          token.decimals,
          token.amount,
        );
        if (!(amount > 0) || Number.isNaN(amount)) continue;

        const tokenAddress = token.address;
        const tokenAddressKey = tokenAddress.trim().toLowerCase();
        const fallbackKey = `${String(token.symbol ?? "")
          .trim()
          .toLowerCase()}::${String(token.name ?? "")
            .trim()
            .toLowerCase()}`;
        const dedupeKey = tokenAddressKey || fallbackKey;

        if (dedupeKey && seenPortfolioKeys.has(dedupeKey)) {
          continue;
        }

        if (dedupeKey) {
          seenPortfolioKeys.add(dedupeKey);
        }

        const pricePerToken = toOptionalNumber(token.price);
        const usdValue =
          toOptionalNumber(token.value) ??
          (pricePerToken != null ? amount * pricePerToken : 0);

        pageItems.push({
          tokenAddress,
          symbol: String(token.symbol ?? ""),
          name: token.name ? String(token.name) : undefined,
          logoUri: getTokenLogoUri(token),
          amount,
          priceUsd: pricePerToken ?? undefined,
          valueUsd: usdValue,
        });
      }

      return {
        pageItems,
        hasMore: balances.length >= limit && offset + limit < total,
      };
    },
  });

  if (paged.stopReason === "max-items") {
    console.warn("[wallet-portfolio-fetch] Max portfolio item limit reached", {
      address,
      pagesFetched: paged.pagesFetched,
      itemCount: paged.items.length,
    });
  }

  if (paged.stopReason === "stagnant") {
    console.warn(
      "[wallet-portfolio-fetch] Stagnant pagination detected; stopping fetch",
      {
        address,
        pagesFetched: paged.pagesFetched,
        itemCount: paged.items.length,
      },
    );
  }

  return {
    address,
    items: paged.items,
    totalAssetValueUsd: toFiniteNumber(lastPayload?.data?.total_value, 0),
  };
}

export async function fetchBirdeyeNetworthHistory(
  address: string,
  options?: {
    count?: number;
    direction?: BirdeyeNetworthDirection;
    time?: string;
    type?: BirdeyeNetworthType;
    sortType?: BirdeyeSortType;
  },
): Promise<BirdeyeNetworthHistoryResult> {
  const count = Math.min(Math.max(Math.floor(options?.count ?? 7), 1), 30);
  const direction = options?.direction ?? "back";
  const type = options?.type ?? "1d";
  const sortType = options?.sortType ?? "desc";
  const time = normalizeBirdeyeTimeParam(options?.time);

  const json = await fetchBirdeyeJson("/wallet/v2/net-worth", "GET", {
    searchParams: {
      wallet: address,
      count,
      direction,
      type,
      sort_type: sortType,
      ...(time ? { time } : {}),
    },
  });
  const data = json?.data ?? {};
  const rows: any[] = Array.isArray(data?.history) ? data.history : [];
  const currentTimestamp = toIsoTimestamp(data?.current_timestamp);
  const pastTimestamp = toIsoTimestamp(data?.past_timestamp);

  const history = rows
    .map((row) => ({
      timestamp: toIsoTimestamp(row?.timestamp),
      netWorthUsd: toOptionalNumber(row?.net_worth),
      netWorthChangeUsd: toOptionalNumber(row?.net_worth_change),
      netWorthChangePercent: toOptionalNumber(row?.net_worth_change_percent),
    }))
    .filter(
      (row): row is BirdeyeNetworthHistoryPoint =>
        row.timestamp != null && row.netWorthUsd != null,
    );

  if (history.length === 0) {
    const snapshotTimestamp =
      currentTimestamp ??
      toIsoTimestamp(data?.requested_timestamp) ??
      toIsoTimestamp(data?.resolved_timestamp);
    const snapshotValue = toOptionalNumber(
      data?.total_value ?? data?.net_worth,
    );

    if (snapshotTimestamp != null && snapshotValue != null) {
      history.push({
        timestamp: snapshotTimestamp,
        netWorthUsd: snapshotValue,
        netWorthChangeUsd: null,
        netWorthChangePercent: null,
      });
    }
  }

  return {
    address: String(data?.wallet_address ?? address),
    currency: String(data?.currency ?? "usd"),
    currentTimestamp: currentTimestamp,
    pastTimestamp: pastTimestamp,
    history,
  };
}

export async function fetchBirdeyePortfolioSnapshot(
  address: string,
  options?: {
    time?: string;
    type?: BirdeyeNetworthType;
    sortType?: BirdeyeSortType;
    limit?: number;
    offset?: number;
  },
): Promise<BirdeyePortfolioSnapshotResult> {
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);
  const offset = Math.max(Math.floor(options?.offset ?? 0), 0);
  const type = options?.type ?? "1d";
  const sortType = options?.sortType ?? "desc";
  const time = normalizeBirdeyeTimeParam(options?.time);

  const json = await fetchBirdeyeJson("/wallet/v2/net-worth-details", "GET", {
    searchParams: {
      wallet: address,
      type,
      sort_type: sortType,
      limit,
      offset,
      ...(time ? { time } : {}),
    },
  });
  const data = json?.data ?? {};
  const rows: any[] = Array.isArray(data?.net_assets) ? data.net_assets : [];

  return {
    address: String(data?.wallet_address ?? address),
    currency: String(data?.currency ?? "usd"),
    netWorthUsd: toFiniteNumber(data?.net_worth, 0),
    requestedTimestamp: toIsoTimestamp(data?.requested_timestamp),
    resolvedTimestamp: toIsoTimestamp(data?.resolved_timestamp),
    assets: rows.map((asset) => ({
      symbol: String(asset?.symbol ?? ""),
      tokenAddress: String(asset?.token_address ?? ""),
      decimals: Math.max(0, Math.floor(toFiniteNumber(asset?.decimal, 0))),
      balanceRaw: String(asset?.balance ?? "0"),
      priceUsd: toOptionalNumber(asset?.price),
      valueUsd: toFiniteNumber(asset?.value, 0),
    })),
  };
}

export async function fetchBirdeyeOverallPnL(
  address: string,
  options?: {
    duration?: BirdeyePnlDuration;
  },
): Promise<BirdeyeOverallPnlResult> {
  const duration = options?.duration ?? "all";

  const json = await fetchBirdeyeJson("/wallet/v2/pnl/summary", "GET", {
    searchParams: {
      wallet: address,
      duration,
    },
  });
  const summary = json?.data?.summary ?? null;

  return {
    address,
    duration,
    summary,
  };
}

export async function fetchBirdeyeTokenPnLDetails(
  address: string,
  options?: BirdeyeTokenPnlDetailsOptions,
): Promise<BirdeyeTokenPnlDetailsResult> {
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 10), 1), 100);
  const offset = Math.max(Math.floor(options?.offset ?? 0), 0);

  const body = {
    wallet: address,
    token_addresses: options?.tokenAddresses,
    duration: options?.duration ?? "all",
    sort_type: options?.sortType ?? "desc",
    sort_by: options?.sortBy ?? "last_trade",
    limit,
    offset,
  };

  console.log(`[fetchBirdeyeTokenPnLDetails] Fetching PnL data for wallet ${address}. Options:`, body);

  const json = await fetchBirdeyeJson("/wallet/v2/pnl/details", "POST", {
    body,
  });

  const data = json?.data ?? {};

  console.log(`[fetchBirdeyeTokenPnLDetails] Birdeye response received. Tokens count: ${Array.isArray(data?.tokens) ? data.tokens.length : 0}`);
  console.log(`[fetchBirdeyeTokenPnLDetails] RAW BIRDEYE RESPONSE - data.tokens:`, JSON.stringify(data?.tokens, null, 2));

  const result = {
    meta: data?.meta ?? null,
    tokens: Array.isArray(data?.tokens) ? data.tokens : [],
    summary: data?.summary ?? null,
  };

  return result;
}

export async function fetchHeliusWalletFirstFund(address: string) {
  const json = await heliusGetJson<any>(`/v1/wallet/${address}/funded-by`);

  if ("error" in json) {
    throw new Error(`Helius API error: ${json.error}`);
  }

  return { reciepient: address, ...json } as HeliusWalletFirstFund;
}
