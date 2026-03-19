import { getEndpoint, getRequiredHeaders, heliusFetch } from "@sv/util/util-helius.js";
import * as moralis from "@sv/util/util-moralis.js";
import type { WalletPortfolioItem, WalletSwap, WalletTransaction, WalletTransactionHelius, WalletTransfer } from "@sv/services/wallet/dtos/walletDataObjects.js";

export type WalletProviderChunk<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

function getNextCursor(pagination: any): string | null {
  // Wallet API docs specify pagination.nextCursor; keep a legacy fallback for beta changes.
  const raw = pagination?.nextCursor;
  if (typeof raw !== "string") return null;
  return raw.length > 0 ? raw : null;
}

function getTokenLogoUri(token: any): string | undefined {
  const rawLogo = token?.logoURI ?? token?.logoUri ?? token?.image;
  if (rawLogo == null) {
    return undefined;
  }

  const normalized = String(rawLogo).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function getMoralisCursor(payload: any): string | null {
  const candidates = [
    payload?.cursor,
    payload?.nextCursor,
    payload?.pagination?.cursor,
    payload?.pagination?.nextCursor,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

function toOptionalNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTokenAmount(
  amountRaw: unknown,
  decimalsRaw: unknown,
  fallbackAmount: unknown,
): number {
  const numericRaw = toOptionalNumber(amountRaw);
  const numericDecimals = toOptionalNumber(decimalsRaw);

  if (numericRaw != null && numericDecimals != null) {
    return numericRaw / 10 ** Math.max(0, numericDecimals);
  }

  return toFiniteNumber(fallbackAmount, 0);
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  return null;
}

function mapHeliusTransferEntry(entry: any, address: string): WalletTransfer | null {
  const tsSec =
    typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : null;
  if (tsSec == null) {
    return null;
  }

  const direction = String(entry.direction ?? "").toLowerCase();
  const counterparty = String(entry.counterparty ?? "");

  const from = direction === "in" ? counterparty : address;
  const to = direction === "in" ? address : counterparty;

  const transactionSignature = String(entry.signature ?? "").trim();
  if (!transactionSignature) {
    return null;
  }

  const amount = toTokenAmount(entry.amountRaw, entry.decimal ?? entry.decimals, entry.amount);

  return {
    from,
    to,
    amount,
    timestamp: new Date(tsSec * 1000).toISOString(),
    tokenAddress: String(entry.mint ?? "unknown"),
    tokenSymbol: String(entry.symbol ?? "unknown"),
    transactionSignature,
    instructionIndex: 0,
  };
}

function mapHeliusSwapEntry(entry: any, address: string): WalletSwap | null {
  const tsSec =
    typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
      ? entry.timestamp
      : null;
  if (tsSec == null) {
    return null;
  }

  const signature = String(entry.signature ?? "").trim();
  if (!signature) {
    return null;
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

  const swapBalanceChanges = mappedBalanceChanges.slice(0, 2);
  const swapFeeBalanceChanges = mappedBalanceChanges.slice(2);

  return {
    walletAddress: address,
    signature,
    timestamp: new Date(tsSec * 1000).toISOString(),
    slot: Number(entry.slot ?? 0),
    fee: Number(entry.fee ?? 0),
    feePayer: String(entry.feePayer ?? ""),
    balanceChanges: swapBalanceChanges,
    feeChanges: swapFeeBalanceChanges,
  };
}

function mapMoralisLeg(raw: any): WalletSwap["sold"] {
  if (raw == null || typeof raw !== "object") {
    return null;
  }

  const mint = String(raw.address ?? raw.tokenAddress ?? raw.mint ?? "").trim();
  if (!mint) {
    return null;
  }

  const amount = Math.abs(toFiniteNumber(raw.amount ?? raw.amountRaw, 0));
  const decimals = Math.max(0, Math.floor(toFiniteNumber(raw.decimals ?? raw.decimal, 0)));

  return {
    mint,
    amount,
    decimals,
    symbol: raw.symbol ?? null,
    priceUsd: toOptionalNumber(raw.usdPrice ?? raw.priceUsd),
    valueUsd: toOptionalNumber(raw.usdAmount ?? raw.valueUsd),
  };
}

function mapMoralisSwapExchange(entry: any): WalletSwap["exchange"] {
  const nested = entry?.exchange;

  const name = String(
    nested?.name ?? entry.exchangeName ?? entry.exchange_name ?? "",
  ).trim();
  const address = String(
    nested?.address ?? entry.exchangeAddress ?? entry.exchange_address ?? "",
  ).trim();
  const logo = String(
    nested?.logo ?? entry.exchangeLogo ?? entry.exchange_logo ?? "",
  ).trim();

  if (!name && !address && !logo) {
    return null;
  }

  return {
    name: name || null,
    address: address || null,
    logo: logo || null,
  };
}

function mapMoralisSwapPair(entry: any): WalletSwap["pair"] {
  const nested = entry?.pair;

  const address = String(
    nested?.address ?? nested?.pairAddress ?? entry.pairAddress ?? entry.pair_address ?? "",
  ).trim();
  const label = String(
    nested?.label ?? entry.pairLabel ?? entry.pair_label ?? "",
  ).trim();
  const baseTokenAddress = String(
    nested?.baseTokenAddress ?? entry.baseToken ?? entry.base_token ?? "",
  ).trim();
  const quoteTokenAddress = String(
    nested?.quoteTokenAddress ?? entry.quoteToken ?? entry.quote_token ?? "",
  ).trim();

  if (!address && !label && !baseTokenAddress && !quoteTokenAddress) {
    return null;
  }

  return {
    address: address || null,
    label: label || null,
    baseTokenAddress: baseTokenAddress || null,
    quoteTokenAddress: quoteTokenAddress || null,
  };
}

function mapMoralisSwapEntry(entry: any, address: string): WalletSwap | null {
  const signature = String(
    entry.transactionHash ?? entry.transaction_hash ?? entry.signature ?? "",
  ).trim();

  if (!signature) {
    return null;
  }

  const timestamp = toIsoTimestamp(
    entry.blockTimestamp ?? entry.block_timestamp ?? entry.blockTime ?? entry.block_time,
  );
  if (!timestamp) {
    return null;
  }

  const sold = mapMoralisLeg(entry.sold);
  const bought = mapMoralisLeg(entry.bought);

  const balanceChanges = [
    sold ? { ...sold, amount: -Math.abs(sold.amount) } : null,
    bought ? { ...bought, amount: Math.abs(bought.amount) } : null,
  ].filter((item): item is NonNullable<WalletSwap["sold"]> => item != null);

  const blockNumber = toOptionalNumber(
    entry.blockNumber ?? entry.block_number,
  );

  const slot = toOptionalNumber(entry.slot) ?? blockNumber ?? 0;

  return {
    walletAddress: address,
    signature,
    timestamp,
    slot,
    fee: toOptionalNumber(entry.fee ?? entry.transactionFee ?? entry.transaction_fee) ?? 0,
    feePayer: String(entry.feePayer ?? entry.fee_payer ?? address),
    transactionType: entry.transactionType ?? entry.transaction_type ?? null,
    subCategory: entry.subCategory ?? entry.sub_category ?? null,
    blockNumber,
    exchange: mapMoralisSwapExchange(entry),
    pair: mapMoralisSwapPair(entry),

    sold,
    bought,
    baseQuotePrice: toOptionalNumber(entry.baseQuotePrice ?? entry.base_quote_price),
    totalValueUsd: toOptionalNumber(entry.totalValueUsd ?? entry.total_value_usd),
    source: "moralis",
    balanceChanges,
    feeChanges: [],
  };
}

export type HeliusHistoryRange = {
  fromSec: number;
  toSec?: number;
};

type FetchAllTransactionHistoryOptions = {
  beforeCursor?: string;
  stopAtKnownSignatures?: Set<string>;
};

export async function fetchHeliusSolanaPortfolio(
  address: string,
): Promise<WalletPortfolioItem[]> {
  const portfolio: WalletPortfolioItem[] = [];

  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
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

    for (const token of balances) {
      const amount = Number(token.balance ?? 0);
      if (!(amount > 0) || Number.isNaN(amount)) continue;

      const pricePerToken =
        token.pricePerToken != null && !Number.isNaN(Number(token.pricePerToken))
          ? Number(token.pricePerToken)
          : undefined;
      const usdValue =
        token.usdValue != null && !Number.isNaN(Number(token.usdValue))
          ? Number(token.usdValue)
          : pricePerToken != null
            ? amount * pricePerToken
            : 0;

      portfolio.push({
        tokenAddress: String(token.mint ?? ""),
        symbol: String(token.symbol ?? ""),
        name: token.name ? String(token.name) : undefined,
        logoUri: getTokenLogoUri(token),
        amount,
        priceUsd: pricePerToken,
        valueUsd: usdValue,
      });
    }

    const pagination = json?.pagination;
    hasMore = Boolean(pagination?.hasMore);
    page = (pagination?.page ?? page) + 1;
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
    url.searchParams.set("limit", String(Math.min(100, maxCount - transactions.length)));
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
      const counterparty = typeof entry.counterparty === "string" ? entry.counterparty : "";

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
          : undefined
      const decimal =
        typeof entry.decimal === "number" && Number.isFinite(entry.decimal)
          ? entry.decimal
          : undefined

      const amount =
        (typeof amountRaw === "number" && typeof decimal === "number")
          ? amountRaw / 10 ** decimal
          : entry.amount
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
};

export async function fetchHeliusSolanaTransfersChunk(
  address: string,
  options?: HeliusTransferChunkOptions,
): Promise<WalletProviderChunk<WalletTransfer>> {
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);

  const url = getEndpoint(`/v1/wallet/${address}/transfers`);
  url.searchParams.set("limit", String(limit));
  if (options?.cursor) {
    url.searchParams.set("cursor", options.cursor);
  }

  const headers = getRequiredHeaders();
  const response = await heliusFetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Helius transfers chunk request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
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

export async function fetchHeliusSolanaSwapChunk(
  address: string,
  options?: HeliusSwapChunkOptions,
): Promise<WalletProviderChunk<WalletSwap>> {
  const limit = Math.min(Math.max(Math.floor(options?.limit ?? 100), 1), 100);

  const url = getEndpoint(`/v1/wallet/${address}/history?type=SWAP&tokenAccounts=balanceChanged`);
  url.searchParams.set("limit", String(limit));
  if (options?.before) {
    url.searchParams.set("before", options.before);
  }

  const headers = getRequiredHeaders();
  const response = await heliusFetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Helius swap chunk request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const rows: any[] = Array.isArray(json?.data) ? json.data : [];
  const items = rows
    .map((entry) => mapHeliusSwapEntry(entry, address))
    .filter((entry): entry is WalletSwap => entry != null);

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

  const response = await moralis.moralisFetch(url, {
    method: "GET",
    headers: moralis.getRequiredHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Moralis swap chunk request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const rows: any[] = Array.isArray(json?.result)
    ? json.result
    : Array.isArray(json?.data)
      ? json.data
      : [];

  const items = rows
    .map((entry) => mapMoralisSwapEntry(entry, address))
    .filter((entry): entry is WalletSwap => entry != null);

  const nextCursor = getMoralisCursor(json);
  const hasMore = Boolean(json?.hasMore ?? json?.pagination?.hasMore ?? nextCursor);

  return {
    items,
    nextCursor,
    hasMore,
  };
}



// function toPubkey(entry: any): string {
//     if (!entry) return "";
//     if (typeof entry === "string") return entry;
//     if (typeof entry.pubkey === "string") return entry.pubkey;
//     return "";
// }

export async function fetchHeliusSolanaTransfers(
  address: string,
  from: HeliusHistoryFrom = "7d",
): Promise<WalletTransfer[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec =
    from === "24h"
      ? nowSec - 24 * 60 * 60
      : nowSec - 7 * 24 * 60 * 60;

  // Helius transfers endpoint returns at most 100 items per page.
  const HELIUS_PAGE_LIMIT = 100;

  const transfers: WalletTransfer[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  // Fetch pages until no more data or we reach entries older than the requested window.
  // Uses Wallet API: GET /v1/wallet/{wallet}/transfers (available on free plan).
  while (true) {
    pageCount++;
    const url = getEndpoint(`/v1/wallet/${address}/transfers`);
    url.searchParams.set("limit", String(HELIUS_PAGE_LIMIT));
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
      const mapped = mapHeliusTransferEntry(entry, address);
      if (!mapped) {
        continue;
      }

      const tsSec = Math.floor(Date.parse(mapped.timestamp) / 1000);
      if (tsSec < fromSec) {
        return transfers;
      }

      transfers.push(mapped);
    }

    console.log(`[fetchHeliusSolanaTransfers] Page ${pageCount}: Collected ${transfers.length} transfers so far`);


    const hasMore = Boolean(json?.pagination?.hasMore);
    cursor = getNextCursor(json?.pagination);

    if (!hasMore || !cursor) {
      break;
    }
  }

  return transfers;
}

export async function fetchHeliusSolanaSwap(
  address: string,
  from: HeliusHistoryFrom = "7d",
): Promise<WalletSwap[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec =
    from === "24h"
      ? nowSec - 24 * 60 * 60
      : nowSec - 7 * 24 * 60 * 60;

  // Helius history endpoint returns at most 100 items per page.
  const HELIUS_PAGE_LIMIT = 100;

  const swaps: WalletSwap[] = [];
  let cursor: string | null = null;
  let pageCount = 0;

  // Fetch pages until no more data or we reach entries older than the requested window.
  // Uses Wallet API: GET /v1/wallet/{wallet}/history (available on free plan).
  while (true) {
    pageCount++;
    const url = getEndpoint(`/v1/wallet/${address}/history?type=SWAP&tokenAccounts=balanceChanged`);
    url.searchParams.set("limit", String(HELIUS_PAGE_LIMIT));
    if (cursor) {
      url.searchParams.set("before", cursor);
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
          "Helius wallet transaction error",
          resp.status,
          resp.statusText,
        );
        throw new Error(`Helius history request failed: ${resp.status} ${resp.statusText}`);
      }

      json = await resp.json();
    } catch (err) {
      console.error("Helius wallet transaction request failed", err);
      throw err;
    }

    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    if (data.length === 0) {
      break;
    }

    for (const entry of data) {
      const mapped = mapHeliusSwapEntry(entry, address);
      if (!mapped) {
        continue;
      }

      const tsSec = Math.floor(Date.parse(mapped.timestamp) / 1000);
      if (tsSec < fromSec) {
        return swaps;
      }

      swaps.push(mapped);
    }

    console.log(`[fetchHeliusSolanaSwap] Page ${pageCount}: Collected ${swaps.length} swaps so far`);

    const hasMore = Boolean(json?.pagination?.hasMore);
    cursor = getNextCursor(json?.pagination);

    if (!hasMore || !cursor) {
      break;
    }
  }

  return swaps;
}

type MoralisSwapFetchOptions = {
  limit?: number; // Max total swaps to fetch across all pages (will be capped by API limits)
  cursor?: string;
};

export async function fetchMoralisSolanaSwap(
  address: string,
  from: HeliusHistoryFrom = "7d",
  options?: MoralisSwapFetchOptions,
): Promise<WalletSwap[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec =
    from === "24h"
      ? nowSec - 24 * 60 * 60
      : nowSec - 7 * 24 * 60 * 60;

  const MORALIS_PAGE_LIMIT = Math.min(Math.max(options?.limit ?? 100, 1), 100);
  const fromDateIso = new Date(fromSec * 1000).toISOString();
  const toDateIso = new Date(nowSec * 1000).toISOString();

  const swaps: WalletSwap[] = [];
  let cursor: string | null = options?.cursor ?? null;
  let pageCount = 0;
  const seenCursors = new Set<string>();

  while (true) {
    pageCount++;

    const url = moralis.getEndpoint(`/account/mainnet/${address}/swaps`);
    // url.searchParams.set("limit", String(MORALIS_PAGE_LIMIT));
    url.searchParams.set("fromDate", fromDateIso);
    url.searchParams.set("toDate", toDateIso);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    let json: any;
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
        throw new Error(
          `Moralis wallet-swaps request failed: ${response.status} ${response.statusText}`,
        );
      }

      json = await response.json();
    } catch (err) {
      console.error("Moralis wallet-swaps request failed", err);
      throw err;
    }

    const rows: any[] = Array.isArray(json?.result)
      ? json.result
      : Array.isArray(json?.data)
        ? json.data
        : [];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const mapped = mapMoralisSwapEntry(row, address);
      if (!mapped) {
        continue;
      }

      const tsSec = Math.floor(Date.parse(mapped.timestamp) / 1000);
      if (!Number.isFinite(tsSec) || tsSec < fromSec || tsSec > nowSec) {
        continue;
      }

      swaps.push(mapped);
    }

    console.log(
      `[fetchMoralisSolanaSwap] Page ${pageCount}: Collected ${swaps.length} swaps so far`,
    );

    const nextCursor = getMoralisCursor(json);
    if (!nextCursor || seenCursors.has(nextCursor)) {
      break;
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return swaps;
}

export type HeliusHistoryFrom = "24h" | "7d";

export function timePeriodToFromSec(timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All"): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const daySec = 24 * 60 * 60;
  switch (timePeriod) {
    case "7D": return nowSec - 7 * daySec;
    case "30D": return nowSec - 30 * daySec;
    case "60D": return nowSec - 60 * daySec;
    case "90D": return nowSec - 90 * daySec;
    case "1Y": return nowSec - 365 * daySec;
    case "All": return 0;
  }
}

export async function fetchAllTransactionHistory(
  address: string,
  from: HeliusHistoryFrom | number | HeliusHistoryRange = "7d",
  options?: FetchAllTransactionHistoryOptions,
) {
  const nowSec = Math.floor(Date.now() / 1000);
  const daySec = 24 * 60 * 60;
  const fromSec = typeof from === "number"
    ? from
    : typeof from === "object"
      ? from.fromSec
      : nowSec - (daySec * (from === "24h" ? 1 : 7));
  const toSec = typeof from === "object" && from.toSec != null ? from.toSec : nowSec;

  // Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60)
  // Helius history endpoint returns at most 100 items per page.
  const HELIUS_PAGE_LIMIT = 100;

  const transactions: WalletTransactionHelius[] = [];
  let cursor: string | null = options?.beforeCursor ?? null;
  let pageCount = 0;
  const knownSignatures = options?.stopAtKnownSignatures;

  // Fetch pages until no more data or we reach entries older than the requested window.
  // Uses Wallet API: GET /v1/wallet/{wallet}/history (available on free plan).
  do {
    pageCount++;
    const url = getEndpoint(`/v1/wallet/${address}/history?tokenAccounts=balanceChanged`);
    url.searchParams.set("limit", String(HELIUS_PAGE_LIMIT));
    if (cursor) {
      url.searchParams.set("before", cursor);
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
          "Helius wallet transaction error",
          resp.status,
          resp.statusText,
        );
        break;
      }

      json = await resp.json();
    } catch (err) {
      console.error("Helius wallet transaction request failed", err);
      break;
    }

    const data: any[] = Array.isArray(json?.data) ? json.data : [];

    if (data.length === 0) {
      break;
    }

    for (const entry of data) {
      const tsSec =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : null;

      if (tsSec == null) {
        // Recent entries can occasionally have null timestamp while still processing.
        continue;
      }
      if (tsSec > toSec) {
        continue;
      }

      if (tsSec < fromSec) {
        return transactions;
      }

      const signature = String(entry.signature ?? "");
      if (!signature) {
        continue;
      }

      if (knownSignatures?.has(signature)) {
        return transactions;
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


      const txObj: WalletTransactionHelius = {
        walletAddress: address,
        signature,
        timestamp: new Date(tsSec * 1000).toISOString(),
        slot: Number(entry.slot ?? 0),
        fee: Number(entry.fee ?? 0),
        feePayer: String(entry.feePayer ?? ""),
        balanceChanges: mappedBalanceChanges
      };

      transactions.push(txObj);
    }

    console.log(`[fetchAllTransactionHistory] Page ${pageCount}: Collected ${transactions.length} transactions so far`);

    const hasMore = Boolean(json?.pagination?.hasMore);
    cursor = hasMore ? getNextCursor(json?.pagination) : null;
    if (transactions.length > 0) {
      const lastTxTimestamp = transactions[transactions.length - 1].timestamp;
      console.log(`[fetchAllTransactionHistory] Last transaction timestamp: ${lastTxTimestamp}`);
    }

  } while (cursor)


  return transactions;
};

// getAllTransactionHistory("86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY");