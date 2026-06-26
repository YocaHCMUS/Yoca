import type {
    WalletTransfersResponse,
    WalletSwapsResponse,
    WalletSwap,
    WalletTransfer,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import { toWalletPageInfo } from "@sv/services/wallet/walletData.core.js";
import { resolveRequestedRange } from "@sv/services/wallet/walletRange.utils.js";
import * as zrn from "@sv/util/util-zerion";
import { rlFetch } from "@sv/util/rate-limit";
import { getTrackedApiResult } from "@sv/middlewares/validation";
import {
    zrn_WalletTransactionsSchema,
    type ZRN_WalletTransactions,
} from "../_types/wallet-raw-responses";
import {
    tokenMeta,
    TokenMetaInsert,
    walletRecentSwaps,
    WalletRecentSwapsInsert,
    walletRecentTransfers,
    WalletRecentTransfersInsert,
    walletTransferHistory,
    walletTransferHistoryMeta,
    walletSwapHistory,
    walletSwapHistoryMeta,
} from "@sv/db/schema";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@sv/db";
import {
    WALLET_SWAPS_TTL_MS,
    WALLET_TRANSFERS_TTL_MS,
    WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
    ZERION_WALLET_TRANSACTIONS_PAGE_SIZE,
    WSOL_MINT,
    DAY_MS,
    ZRN_SOL_FUNGIBLE_ID,
    WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT,
    WALLET_SWAP_HISTORY_LATEST_TOLERANCE_MS,
    WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT,
    WALLET_TRANSFER_HISTORY_LATEST_TOLERANCE_MS,
} from "@sv/config/constants";
import { and, desc, eq, gt, gte, inArray, lt, lte, max, or } from "drizzle-orm";

type ZRN_WalletTransaction = ZRN_WalletTransactions["data"][number];
type ZRN_WalletTransfer =
  ZRN_WalletTransaction["attributes"]["transfers"][number];
type ZRN_FungibleInfo = ZRN_WalletTransfer["fungible_info"];

type ZrnTradeTransferMatch = {
  inTransfer: ZRN_WalletTransfer;
  outTransfer: ZRN_WalletTransfer;
  diffUsd: number;
};

function normalizeTxLimit(reqLimit: number, maxLimit: number): number {
  if (!Number.isFinite(reqLimit)) return maxLimit;
  return Math.min(Math.max(Math.trunc(reqLimit), 1), maxLimit);
}

export type WalletHistoryCursor = {
  version: 1;
  fromExclusiveMs: number;
  blockTimestampMs: number;
  transactionHash: string;
  actId: string;
};

type WalletTransaction<T> = {
  transaction: T;
  blockTimestampMs: number;
  transactionHash: string;
  actId: string;
};

export type WalletTransactionHistory<T> = {
  transactions: T[];
  cursor: string | null;
};

export function mapSwapToTokenTradeRow(
  swap: WalletSwap,
  walletAddress: string,
  tokenAddress: string,
) {
  const normalizedToken = tokenAddress.trim().toLowerCase();
  const boughtAddress = swap.bought.address.trim().toLowerCase();

  const inferredAction: "buy" | "sell" =
    boughtAddress == normalizedToken ? "buy" : "sell";

  const selectedAmount =
    inferredAction == "buy" ? swap.bought.amount : swap.sold.amount;
  const selectedTokenAddress =
    inferredAction == "buy" ? swap.bought.address : swap.sold.address;
  const otherTokenAddress =
    inferredAction == "buy" ? swap.sold.address : swap.bought.address;
  const selectedPrice =
    inferredAction == "buy" ? swap.bought.priceUsd : swap.sold.priceUsd;
  const otherPrice =
    inferredAction == "buy" ? swap.sold.priceUsd : swap.bought.priceUsd;

  return {
    address: walletAddress,
    tokenAddress,
    transactionHash: swap.transactionHash,
    blockUnixTimeMs: new Date(swap.blockTimestampIso).getTime(),
    baseTokenAddress: selectedTokenAddress,
    quoteTokenAddress: otherTokenAddress,
    baseAmount: selectedAmount,
    quoteAmount: selectedAmount,
    basePrice: selectedPrice,
    quotePrice: otherPrice,
    volumeUsd: swap.totalValueUsd ?? 0,
    poolAddress: swap.pairAddress,
    poolName: null,
    tradeAction: inferredAction,
  };
}

const walletHistoryCursorSchema = z
  .tuple([
    z.literal("1"),
    z.coerce.number<string>().int().min(0),
    z.coerce.number<string>().int().min(0),
    z.string().min(1),
    z.string().min(1),
  ])
  .refine(
    (cursor) => cursor[1] < cursor[2],
    "Cursor row must be inside its history range",
  )
  .transform((cursor): WalletHistoryCursor => ({
    version: 1,
    fromExclusiveMs: cursor[1],
    blockTimestampMs: cursor[2],
    transactionHash: cursor[3],
    actId: cursor[4],
  }));

export const walletHistoryCursorQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .transform((rawCursor) => rawCursor.split(","))
  .pipe(walletHistoryCursorSchema);

function postProcessWalletTxHistory<T>(data: {
  entries: WalletTransaction<T>[];
  limit: number;
  fromExclusiveMs: number;
  hasUnresolvedRange: boolean;
}): WalletTransactionHistory<T> {
  const pageEntries = data.entries.slice(0, data.limit);
  const lastEntry = pageEntries[pageEntries.length - 1];
  const hasMore = data.entries.length > data.limit || data.hasUnresolvedRange;

  return {
    transactions: pageEntries.map((entry) => entry.transaction),
    cursor:
      hasMore && lastEntry
        ? [
            1,
            data.fromExclusiveMs,
            lastEntry.blockTimestampMs,
            lastEntry.transactionHash,
            lastEntry.actId,
          ].join(",")
        : null,
  };
}

async function zrn_fetchWalletTransactions(
  address: string,
  operationTypes: string,
  limit: number,
): Promise<ZRN_WalletTransaction[] | null> {
  const maxTransactions = normalizeTxLimit(
    limit,
    WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
  );
  const firstPageUrl = zrn.getEndpoint(`/wallets/${address}/transactions/`);
  firstPageUrl.search = new URLSearchParams({
    currency: "usd",
    "filter[operation_types]": operationTypes,
    "filter[chain_ids]": "solana",
    "page[size]": String(
      Math.min(maxTransactions, ZERION_WALLET_TRANSACTIONS_PAGE_SIZE),
    ),
  }).toString();

  const transactions: ZRN_WalletTransaction[] = [];
  const visitedUrls = new Set<string>();
  let nextUrl: URL | null = firstPageUrl;

  while (nextUrl && transactions.length < maxTransactions) {
    const currentUrl = nextUrl.toString();
    if (visitedUrls.has(currentUrl)) {
      break;
    }
    visitedUrls.add(currentUrl);

    const resp = await rlFetch(nextUrl, {
      rlLimiter: zrn.limiter,
      method: "GET",
      headers: zrn.getRequiredHeaders(),
    });
    const page = await getTrackedApiResult(zrn_WalletTransactionsSchema, resp);
    if (!page) return null;

    transactions.push(
      ...page.data.slice(0, maxTransactions - transactions.length),
    );

    if (transactions.length >= maxTransactions) break;

    nextUrl = page.links.next ? new URL(page.links.next) : null;
  }

  return transactions;
}

type ZRN_WalletTransactionsRange = {
  transactions: ZRN_WalletTransaction[];
  coveredFromExclusiveMs: number;
  coveredToInclusiveMs: number;
  cutOffByLimit: boolean;
};

async function zrn_fetchWalletTransactionsRange(
  address: string,
  operationTypes: string,
  fromMs: number,
  toMs: number,
  limit: number,
  maxLimit: number,
): Promise<ZRN_WalletTransactionsRange | null> {
  const maxTransactions = normalizeTxLimit(limit, maxLimit);
  const firstPageUrl = zrn.getEndpoint(`/wallets/${address}/transactions/`);
  firstPageUrl.search = new URLSearchParams({
    currency: "usd",
    "filter[operation_types]": operationTypes,
    "filter[chain_ids]": "solana",
    "filter[min_mined_at]": fromMs.toString(),
    "filter[max_mined_at]": toMs.toString(),
    "page[size]": String(
      Math.min(maxTransactions, ZERION_WALLET_TRANSACTIONS_PAGE_SIZE),
    ),
  }).toString();

  const transactions: ZRN_WalletTransaction[] = [];
  const visitedUrls = new Set<string>();
  let nextUrl: URL | null = firstPageUrl;
  let oldestFetchedMs = toMs;
  let cutOffByLimit = false;

  while (nextUrl && transactions.length < maxTransactions) {
    const currentUrl = nextUrl.toString();
    if (visitedUrls.has(currentUrl)) {
      break;
    }
    visitedUrls.add(currentUrl);

    const resp = await rlFetch(nextUrl, {
      rlLimiter: zrn.limiter,
      method: "GET",
      headers: zrn.getRequiredHeaders(),
    });
    const page = await getTrackedApiResult(zrn_WalletTransactionsSchema, resp);
    if (!page) return null;

    const rawTxs = page.data;

    transactions.push(...rawTxs);

    if (rawTxs.length > 0) {
      oldestFetchedMs = Math.min(
        oldestFetchedMs,
        ...rawTxs.map((tx) => dayjs.utc(tx.attributes.mined_at).valueOf()),
      );
    }

    if (transactions.length >= maxTransactions) {
      cutOffByLimit = page.links.next != null;
      break;
    }

    nextUrl = page.links.next ? new URL(page.links.next) : null;
  }

  return {
    transactions,
    coveredFromExclusiveMs: cutOffByLimit ? oldestFetchedMs : fromMs,
    coveredToInclusiveMs: toMs,
    cutOffByLimit,
  };
}

function zrn_getTransferTradePair(
  transfers: ZRN_WalletTransfer[],
): ZrnTradeTransferMatch | null {
  if (transfers.length == 0) {
    return null;
  }

  const ins = transfers.filter(
    (transfer) =>
      transfer.direction == "in" &&
      transfer.value != null &&
      Number.isFinite(Number(transfer.value)),
  );
  const outs = transfers.filter(
    (transfer) =>
      transfer.direction == "out" &&
      transfer.value != null &&
      Number.isFinite(Number(transfer.value)),
  );
  if (ins.length == 0) {
    return null;
  }
  if (outs.length == 0) {
    return null;
  }

  let best: ZrnTradeTransferMatch | null = null;
  for (const inTransfer of ins) {
    for (const outTransfer of outs) {
      const diffUsd = Math.abs(
        Number(inTransfer.value) - Number(outTransfer.value),
      );
      if (best == null || diffUsd < best.diffUsd) {
        best = {
          inTransfer,
          outTransfer,
          diffUsd,
        };
      }
    }
  }

  if (!best) {
    return null;
  }

  return best;
}

function zrn_getSolanaTokenAddress(token: ZRN_FungibleInfo): string | null {
  const solanaAddress = token.implementations.find(
    (impl) => impl.chain_id == "solana",
  )?.address;

  if (solanaAddress) return solanaAddress;
  if (token.id == ZRN_SOL_FUNGIBLE_ID) return WSOL_MINT;
  return null;
}

export async function getWalletTransfers(
  address: string,
  from?: number,
  to?: number,
  tokenAddress?: string,
  direction?: "in" | "out",
  minAmountUsd?: number,
): Promise<WalletTransfersResponse> {
  const requestedRange = resolveRequestedRange(from, to);
  const history = await getWalletTransferHistory(
    address,
    requestedRange.fromMs,
    requestedRange.toMs,
    WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT,
  );
  if (history == null) {
    throw new Error(`Failed to get wallet transfer history for ${address}`);
  }

  const transfers = history.transactions
    .filter((transfer) => {
      if (tokenAddress != null && transfer.token.address !== tokenAddress) {
        return false;
      }
      if (direction == "in" && transfer.direction !== "receive") return false;
      if (direction == "out" && transfer.direction !== "send") return false;
      if (minAmountUsd != null && transfer.valueUsd < minAmountUsd) return false;
      return true;
    })
    .map((transfer): WalletTransfer => ({
      from:
        transfer.direction == "send"
          ? address
          : transfer.counterpartyAddress,
      to:
        transfer.direction == "receive"
          ? address
          : transfer.counterpartyAddress,
      amount: transfer.token.amount,
      amountUsd: transfer.valueUsd,
      timestamp: new Date(transfer.blockTimestampMs).toISOString(),
      tokenAddress: transfer.token.address,
      tokenSymbol: transfer.token.symbol ?? "",
      tokenName: transfer.token.name ?? undefined,
      tokenLogoUri: transfer.token.logoUri ?? undefined,
      priceUsd: transfer.token.priceUsd ?? undefined,
      transactionSignature: transfer.transactionHash,
      instructionIndex: 0,
    }));

  return {
    address,
    transfers,
    pageInfo: toWalletPageInfo({
      hasMore: history.cursor != null,
      nextCursor: history.cursor,
      source: "cache",
    }),
  };
}

export async function getWalletSwaps(
  address: string,
  from?: number,
  to?: number,
  tokenAddress?: string,
): Promise<WalletSwapsResponse> {
  const requestedRange = resolveRequestedRange(from, to);
  const history = await getWalletSwapHistory(
    address,
    requestedRange.fromMs,
    requestedRange.toMs,
    WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT,
  );
  if (history == null) {
    throw new Error(`Failed to get wallet swap history for ${address}`);
  }

  const swaps = history.transactions
    .filter(
      (swap) =>
        tokenAddress == null ||
        swap.bought.address == tokenAddress ||
        swap.sold.address == tokenAddress,
    )
    .map((swap): WalletSwap => {
      const boughtLabel =
        swap.bought.symbol ?? swap.bought.name ?? swap.bought.address;
      const soldLabel =
        swap.sold.symbol ?? swap.sold.name ?? swap.sold.address;

      return {
        transactionHash: swap.transactionHash,
        transactionType: "trade",
        blockTimestampIso: new Date(swap.blockTimestampMs).toISOString(),
        subcategory: null,
        walletAddress: address,
        pairAddress: "",
        tokensInvolved: `${boughtLabel}/${soldLabel}`,
        bought: {
          ...swap.bought,
          priceUsd: swap.bought.priceUsd ?? 0,
          valueUsd:
            swap.bought.priceUsd == null
              ? 0
              : swap.bought.amount * swap.bought.priceUsd,
        },
        sold: {
          ...swap.sold,
          priceUsd: swap.sold.priceUsd ?? 0,
          valueUsd:
            swap.sold.priceUsd == null
              ? 0
              : swap.sold.amount * swap.sold.priceUsd,
        },
        totalValueUsd: swap.totalValueUsd,
        baseQuotePrice: null,
      };
    });

  return {
    address,
    swaps,
    pageInfo: toWalletPageInfo({
      hasMore: history.cursor != null,
      nextCursor: history.cursor,
      source: "cache",
    }),
  };
}

export type WalletTransferToken = {
  address: string;
  amount: number;
  symbol: string | null;
  name: string | null;
  logoUri: string | null;
  priceUsd: number | null;
};

export interface WalletSwapV2 {
  transactionHash: string;
  blockTimestampMs: number;
  bought: WalletTransferToken;
  sold: WalletTransferToken;
  totalValueUsd: number | null;
}

export async function fetchWalletRecentSwaps(
  address: string,
  limit: number = WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
): Promise<WalletSwapV2[] | null> {
  const transactions = await zrn_fetchWalletTransactions(
    address,
    "trade",
    limit,
  );
  if (!transactions) return null;

  const tokenMetaInsertValues: TokenMetaInsert[] = [];
  const fetchedAtMs = dayjs.utc().valueOf();

  const combinedValues = await zrn_extractSwaps(address, transactions);

  if (combinedValues.returnValues.length == 0) {
    return [];
  }

  await db
    .insert(walletRecentSwaps)
    .values(combinedValues.insertValues)
    .onConflictDoUpdate({
      target: [
        walletRecentSwaps.address,
        walletRecentSwaps.transactionHash,
        walletRecentSwaps.actId,
      ],
      set: {
        fetchedAtMs,
      },
    });

  // conveniently update token meta
  if (tokenMetaInsertValues.length > 0) {
    await db
      .insert(tokenMeta)
      .values(tokenMetaInsertValues)
      .onConflictDoNothing();
  }

  return combinedValues.returnValues;
}

export async function getWalletRecentSwaps(
  address: string,
  limit: number = WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
): Promise<WalletSwapV2[] | null> {
  const normalizedLimit = normalizeTxLimit(
    limit,
    WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
  );
  const thresholdDateMs = dayjs
    .utc()
    .subtract(WALLET_SWAPS_TTL_MS, "millisecond")
    .valueOf();

  const [latestFetchRes] = await db
    .select({ maxFetchedAtMs: max(walletRecentSwaps.fetchedAtMs) })
    .from(walletRecentSwaps)
    .where(
      and(
        eq(walletRecentSwaps.address, address),
        gte(walletRecentSwaps.fetchedAtMs, thresholdDateMs),
      ),
    )
    .limit(1);

  if (latestFetchRes == undefined || latestFetchRes.maxFetchedAtMs == null) {
    await db.delete(walletRecentSwaps);
    const fetched = await fetchWalletRecentSwaps(address);
    return fetched?.slice(0, normalizedLimit) ?? null;
  }

  const res = await db
    .select()
    .from(walletRecentSwaps)
    .where(
      and(
        eq(walletRecentSwaps.address, address),
        eq(walletRecentSwaps.fetchedAtMs, latestFetchRes.maxFetchedAtMs),
      ),
    )
    .orderBy(desc(walletRecentSwaps.blockTimestampMs))
    .limit(normalizedLimit);

  if (res.length == 0) {
    await db.delete(walletRecentSwaps);
    const fetched = await fetchWalletRecentSwaps(address);
    return fetched?.slice(0, normalizedLimit) ?? null;
  }

  // enrich metadata
  const tokenAddresses = new Set(
    res.flatMap((item) => [item.tokenIn, item.tokenOut]),
  );
  const tokenMetaRes = await db
    .select()
    .from(tokenMeta)
    .where(inArray(tokenMeta.address, Array.from(tokenAddresses)));
  const tokenMetaLookup = Object.fromEntries(
    tokenMetaRes.map((tm) => [tm.address, tm]),
  );

  return res.map((item) => ({
    transactionHash: item.transactionHash,
    blockTimestampMs: item.blockTimestampMs,
    bought: {
      address: item.tokenIn,
      amount: item.amountIn,
      symbol: tokenMetaLookup[item.tokenIn]?.symbol ?? null,
      name: tokenMetaLookup[item.tokenIn]?.name ?? null,
      logoUri: tokenMetaLookup[item.tokenIn]?.imageUrl ?? null,
      priceUsd: item.tokenInPriceUsd,
    },
    sold: {
      address: item.tokenOut,
      amount: item.amountOut,
      symbol: tokenMetaLookup[item.tokenOut]?.symbol ?? null,
      name: tokenMetaLookup[item.tokenOut]?.name ?? null,
      logoUri: tokenMetaLookup[item.tokenOut]?.imageUrl ?? null,
      priceUsd: item.tokenOutPriceUsd,
    },
    totalValueUsd: item.valueUsd,
  }));
}

export interface WalletTransferV2 {
  transactionHash: string;
  blockTimestampMs: number;
  token: WalletTransferToken;
  direction: "send" | "receive";
  counterpartyAddress: string;
  valueUsd: number;
}

export async function fetchWalletRecentTransfers(
  address: string,
  limit: number = WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
): Promise<WalletTransferV2[] | null> {
  const transactions = await zrn_fetchWalletTransactions(
    address,
    "receive,send",
    limit,
  );
  if (!transactions) return null;

  const combinedValues = zrn_extractTransfers(address, transactions);

  if (combinedValues.returnValues.length == 0) return [];

  const fetchedAtMs = dayjs.utc().valueOf();

  await db
    .insert(walletRecentTransfers)
    .values(combinedValues.insertValues)
    .onConflictDoUpdate({
      target: [
        walletRecentTransfers.address,
        walletRecentTransfers.transactionHash,
        walletRecentTransfers.actId,
      ],
      set: { fetchedAtMs },
    });

  if (combinedValues.tokenMetaInsertValues.length > 0) {
    await db
      .insert(tokenMeta)
      .values(combinedValues.tokenMetaInsertValues)
      .onConflictDoNothing();
  }

  return combinedValues.returnValues;
}

export async function getWalletRecentTransfers(
  address: string,
  limit: number = WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
): Promise<WalletTransferV2[] | null> {
  const normalizedLimit = normalizeTxLimit(
    limit,
    WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
  );
  const thresholdDateMs = dayjs
    .utc()
    .subtract(WALLET_TRANSFERS_TTL_MS, "millisecond")
    .valueOf();

  const [latestFetchRes] = await db
    .select({ maxFetchedAtMs: max(walletRecentTransfers.fetchedAtMs) })
    .from(walletRecentTransfers)
    .where(
      and(
        eq(walletRecentTransfers.address, address),
        gte(walletRecentTransfers.fetchedAtMs, thresholdDateMs),
      ),
    )
    .limit(1);

  if (!latestFetchRes?.maxFetchedAtMs) {
    await db.delete(walletRecentTransfers);
    const fetched = await fetchWalletRecentTransfers(address);
    return fetched?.slice(0, normalizedLimit) ?? null;
  }

  const res = await db
    .select()
    .from(walletRecentTransfers)
    .where(
      and(
        eq(walletRecentTransfers.address, address),
        eq(walletRecentTransfers.fetchedAtMs, latestFetchRes.maxFetchedAtMs),
      ),
    )
    .orderBy(desc(walletRecentTransfers.blockTimestampMs))
    .limit(normalizedLimit);

  if (res.length == 0) {
    await db.delete(walletRecentTransfers);
    const fetched = await fetchWalletRecentTransfers(address);
    return fetched?.slice(0, normalizedLimit) ?? null;
  }

  const tokenAddresses = new Set(res.map((item) => item.tokenAddress));
  const tokenMetaRes = await db
    .select()
    .from(tokenMeta)
    .where(inArray(tokenMeta.address, Array.from(tokenAddresses)));

  const tokenMetaLookup = Object.fromEntries(
    tokenMetaRes.map((tm) => [tm.address, tm]),
  );

  return res.map((item) => ({
    transactionHash: item.transactionHash,
    blockTimestampMs: item.blockTimestampMs,
    token: {
      address: item.tokenAddress,
      amount: item.amount,
      symbol: tokenMetaLookup[item.tokenAddress]?.symbol ?? null,
      name: tokenMetaLookup[item.tokenAddress]?.name ?? null,
      logoUri: tokenMetaLookup[item.tokenAddress]?.imageUrl ?? null,
      priceUsd: item.priceUsd,
    },
    direction: item.direction,
    counterpartyAddress: item.counterpartyAddress,
    valueUsd: item.valueUsd,
  }));
}

function zrn_extractTransfers(
  address: string,
  transactions: ZRN_WalletTransaction[],
): {
  returnValues: WalletTransferV2[];
  tokenMetaInsertValues: TokenMetaInsert[];
  insertValues: WalletRecentTransfersInsert[];
} {
  const returnValues: WalletTransferV2[] = [];
  const insertValues: WalletRecentTransfersInsert[] = [];
  const tokenMetaInsertValues: TokenMetaInsert[] = [];
  const fetchedAtMs = dayjs.utc().valueOf();

  for (const transaction of transactions) {
    for (const act of transaction.attributes.acts) {
      if (act.type != "receive" && act.type != "send") continue;

      const transfers = transaction.attributes.transfers.filter(
        (t) => t.act_id == act.id,
      );
      if (transfers.length != 1) continue; // each send/receive act has exactly one transfer

      const transfer = transfers[0];
      const token = transfer.fungible_info;
      const tokenAddress = zrn_getSolanaTokenAddress(token);
      if (tokenAddress == null) continue;

      const amount = Number(transfer.quantity.numeric);
      if (!Number.isFinite(amount)) continue;

      const priceUsd = transfer.price;
      const valueUsd = transfer.value == null ? null : Number(transfer.value);
      if (valueUsd == null || !Number.isFinite(valueUsd)) continue;

      const blockTimestampMs = dayjs
        .utc(transaction.attributes.mined_at)
        .valueOf();

      const direction = act.type == "receive" ? "receive" : "send";
      const counterpartyAddress =
        direction == "receive" ? transfer.sender : transfer.recipient;

      tokenMetaInsertValues.push({
        address: tokenAddress,
        symbol: token.symbol,
        name: token.name,
        imageUrl: token.icon?.url || null,
      });

      returnValues.push({
        transactionHash: transaction.attributes.hash,
        blockTimestampMs,
        token: {
          address: tokenAddress,
          amount,
          symbol: token.symbol,
          name: token.name,
          logoUri: token.icon?.url || null,
          priceUsd,
        },
        direction,
        counterpartyAddress,
        valueUsd,
      });

      insertValues.push({
        address,
        transactionHash: transaction.attributes.hash,
        actId: act.id,
        blockTimestampMs,
        tokenAddress,
        amount,
        valueUsd,
        direction,
        counterpartyAddress,
        priceUsd,
        fetchedAtMs,
      });
    }
  }

  return { returnValues, insertValues, tokenMetaInsertValues };
}

async function zrn_extractSwaps(
  address: string,
  transactions: ZRN_WalletTransaction[],
): Promise<{
  returnValues: WalletSwapV2[];
  tokenMetaInsertValues: TokenMetaInsert[];
  insertValues: WalletRecentSwapsInsert[];
}> {
  const returnValues: WalletSwapV2[] = [];
  const insertValues: WalletRecentSwapsInsert[] = [];
  const tokenMetaInsertValues: TokenMetaInsert[] = [];
  for (const transaction of transactions) {
    for (const act of transaction.attributes.acts) {
      if (act.type != "trade") continue;

      const transfers = transaction.attributes.transfers.filter(
        (t) => t.act_id == act.id,
      );
      const transferMatch = zrn_getTransferTradePair(transfers);
      if (!transferMatch) continue;
      const { inTransfer, outTransfer } = transferMatch;

      const tokenIn = inTransfer.fungible_info;
      const tokenOut = outTransfer.fungible_info;

      const tokenInAddress = zrn_getSolanaTokenAddress(tokenIn);
      const tokenOutAddress = zrn_getSolanaTokenAddress(tokenOut);
      if (tokenInAddress == null || tokenOutAddress == null) continue;

      tokenMetaInsertValues.push({
        address: tokenInAddress,
        symbol: tokenIn.symbol,
        name: tokenIn.name,
        imageUrl: tokenIn.icon?.url || null,
      });

      const amountIn = Number(inTransfer.quantity.numeric);
      const amountOut = Number(outTransfer.quantity.numeric);
      if (!Number.isFinite(amountIn) || !Number.isFinite(amountOut)) continue;

      const tokenInPriceUsd = inTransfer.price;
      const tokenOutPriceUsd = outTransfer.price;

      const valueUsd = Number(
        inTransfer.value ??
          outTransfer.value ??
          (tokenInPriceUsd
            ? amountIn * tokenInPriceUsd
            : tokenOutPriceUsd
              ? amountOut * tokenOutPriceUsd
              : null),
      );
      if (!valueUsd || !Number.isFinite(valueUsd)) continue;

      const blockTimestampMs = dayjs
        .utc(transaction.attributes.mined_at)
        .valueOf();

      returnValues.push({
        transactionHash: transaction.attributes.hash,
        blockTimestampMs,
        bought: {
          address: tokenInAddress,
          amount: amountIn,
          symbol: tokenIn.symbol,
          name: tokenIn.name,
          logoUri: tokenIn.icon?.url || null,
          priceUsd: tokenInPriceUsd,
        },
        sold: {
          address: tokenOutAddress,
          amount: amountOut,
          symbol: tokenOut.symbol,
          name: tokenOut.name,
          logoUri: tokenOut.icon?.url || null,
          priceUsd: tokenOutPriceUsd,
        },
        totalValueUsd: valueUsd,
      });

      insertValues.push({
        address,
        transactionHash: transaction.attributes.hash,
        actId: act.id,
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn,
        amountOut,
        tokenInPriceUsd,
        tokenOutPriceUsd,
        valueUsd,
        blockTimestampMs,
        fetchedAtMs: dayjs.utc().valueOf(),
      });
    }
  }
  return { returnValues, insertValues, tokenMetaInsertValues };
}

type WalletSwapHistoryFetchResult = {
  values: WalletSwapV2[];
  coveredFromExclusiveMs: number;
  coveredToInclusiveMs: number;
  cutOffByLimit: boolean;
};

async function fetchWalletSwapHistoryGap(
  address: string,
  fromMs: number,
  toMs: number,
  limit?: number,
): Promise<WalletSwapHistoryFetchResult | null> {
  return await fetchWalletSwapHistoryCore(address, fromMs, toMs, limit, false);
}

async function fetchWalletSwapHistoryCore(
  address: string,
  fromMs: number,
  toMs: number,
  limit: number = WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT,
  writeMeta: boolean = true,
): Promise<WalletSwapHistoryFetchResult | null> {
  const res = await zrn_fetchWalletTransactionsRange(
    address,
    "trade",
    fromMs,
    toMs,
    limit,
    WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT,
  );

  if (!res) return null;
  if (res.transactions.length == 0) {
    if (writeMeta) {
      await db.insert(walletSwapHistoryMeta).values({
        address,
        fromExclusiveMs: res.coveredFromExclusiveMs,
        toInclusiveMs: res.coveredToInclusiveMs,
        fetchedAtMs: dayjs.utc().valueOf(),
      });
    }

    return {
      values: [],
      coveredFromExclusiveMs: res.coveredFromExclusiveMs,
      coveredToInclusiveMs: res.coveredToInclusiveMs,
      cutOffByLimit: res.cutOffByLimit,
    };
  }

  const combinedValues = await zrn_extractSwaps(address, res.transactions);

  if (combinedValues.returnValues.length == 0) {
    if (writeMeta) {
      await db.insert(walletSwapHistoryMeta).values({
        address,
        fromExclusiveMs: res.coveredFromExclusiveMs,
        toInclusiveMs: res.coveredToInclusiveMs,
        fetchedAtMs: dayjs.utc().valueOf(),
      });
    }

    return {
      values: [],
      coveredFromExclusiveMs: res.coveredFromExclusiveMs,
      coveredToInclusiveMs: res.coveredToInclusiveMs,
      cutOffByLimit: res.cutOffByLimit,
    };
  }

  await db
    .insert(walletSwapHistory)
    .values(combinedValues.insertValues)
    .onConflictDoUpdate({
      target: [
        walletSwapHistory.address,
        walletSwapHistory.transactionHash,
        walletSwapHistory.actId,
      ],
      set: {
        fetchedAtMs: dayjs.utc().valueOf(),
      },
    });

  // update token meta
  if (combinedValues.tokenMetaInsertValues.length > 0) {
    await db
      .insert(tokenMeta)
      .values(combinedValues.tokenMetaInsertValues)
      .onConflictDoNothing();
  }

  if (writeMeta) {
    await db.insert(walletSwapHistoryMeta).values({
      address,
      fromExclusiveMs: res.coveredFromExclusiveMs,
      toInclusiveMs: res.coveredToInclusiveMs,
      fetchedAtMs: dayjs.utc().valueOf(),
    });
  }

  return {
    values: combinedValues.returnValues.slice(
      0,
      normalizeTxLimit(limit, WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT),
    ),
    coveredFromExclusiveMs: res.coveredFromExclusiveMs,
    coveredToInclusiveMs: res.coveredToInclusiveMs,
    cutOffByLimit: res.cutOffByLimit,
  };
}

function normalizeRange(
  fromMs?: number,
  toMs?: number,
): { fromMs: number; toMs: number } {
  const nowMs = dayjs.utc().valueOf();
  const defaultPeriodMs = 3 * DAY_MS;

  const requestedToMs = toMs ?? nowMs;
  const requestedFromMs =
    fromMs ??
    (toMs != null ? requestedToMs - defaultPeriodMs : nowMs - defaultPeriodMs);

  return {
    fromMs: Math.min(requestedFromMs, requestedToMs),
    toMs: Math.max(requestedFromMs, requestedToMs),
  };
}

async function db_getSwapHistory(
  address: string,
  fromExclusiveMs: number,
  toInclusiveMs: number,
  limit: number,
  cursor: WalletHistoryCursor | null,
): Promise<WalletTransaction<WalletSwapV2>[]> {
  const predicates = [
    eq(walletSwapHistory.address, address),
    gt(walletSwapHistory.blockTimestampMs, fromExclusiveMs),
    lte(walletSwapHistory.blockTimestampMs, toInclusiveMs),
  ];
  if (cursor) {
    const cursorPredicate = or(
      lt(walletSwapHistory.blockTimestampMs, cursor.blockTimestampMs),
      and(
        eq(walletSwapHistory.blockTimestampMs, cursor.blockTimestampMs),
        lt(walletSwapHistory.transactionHash, cursor.transactionHash),
      ),
      and(
        eq(walletSwapHistory.blockTimestampMs, cursor.blockTimestampMs),
        eq(walletSwapHistory.transactionHash, cursor.transactionHash),
        lt(walletSwapHistory.actId, cursor.actId),
      ),
    );
    if (cursorPredicate) predicates.push(cursorPredicate);
  }

  const rows = await db
    .select()
    .from(walletSwapHistory)
    .where(and(...predicates))
    .orderBy(
      desc(walletSwapHistory.blockTimestampMs),
      desc(walletSwapHistory.transactionHash),
      desc(walletSwapHistory.actId),
    )
    .limit(limit);

  const tokenAddresses = new Set(
    rows.flatMap((item) => [item.tokenIn, item.tokenOut]),
  );
  const tokenMetaRes = await db
    .select()
    .from(tokenMeta)
    .where(inArray(tokenMeta.address, Array.from(tokenAddresses)));
  const tokenMetaLookup = Object.fromEntries(
    tokenMetaRes.map((tm) => [tm.address, tm]),
  );

  return rows.map((item) => ({
    blockTimestampMs: item.blockTimestampMs,
    transactionHash: item.transactionHash,
    actId: item.actId,
    transaction: {
      transactionHash: item.transactionHash,
      blockTimestampMs: item.blockTimestampMs,
      bought: {
        address: item.tokenIn,
        amount: item.amountIn,
        symbol: tokenMetaLookup[item.tokenIn]?.symbol ?? null,
        name: tokenMetaLookup[item.tokenIn]?.name ?? null,
        logoUri: tokenMetaLookup[item.tokenIn]?.imageUrl ?? null,
        priceUsd: item.tokenInPriceUsd,
      },
      sold: {
        address: item.tokenOut,
        amount: item.amountOut,
        symbol: tokenMetaLookup[item.tokenOut]?.symbol ?? null,
        name: tokenMetaLookup[item.tokenOut]?.name ?? null,
        logoUri: tokenMetaLookup[item.tokenOut]?.imageUrl ?? null,
        priceUsd: item.tokenOutPriceUsd,
      },
      totalValueUsd: item.valueUsd,
    },
  }));
}

export async function getWalletSwapHistory(
  address: string,
  requestFromMs?: number,
  requestToMs?: number,
  limit = WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT,
  parsedCursor?: WalletHistoryCursor,
): Promise<WalletTransactionHistory<WalletSwapV2> | null> {
  const cursor = parsedCursor ?? null;
  const requestedRange = cursor
    ? {
        fromMs: cursor.fromExclusiveMs,
        toMs: cursor.blockTimestampMs,
      }
    : normalizeRange(requestFromMs, requestToMs);
  const fromMs = requestedRange.fromMs;

  limit = normalizeTxLimit(limit, WALLET_SWAP_HISTORY_TRANSACTIONS_MAX_COUNT);

  const [latestMeta] = await db
    .select({ toInclusiveMs: max(walletSwapHistoryMeta.toInclusiveMs) })
    .from(walletSwapHistoryMeta)
    .where(eq(walletSwapHistoryMeta.address, address))
    .limit(1);

  const latestCoveredToMs = latestMeta?.toInclusiveMs ?? null;
  const toMs = cursor
    ? cursor.blockTimestampMs
    : latestCoveredToMs != null &&
        latestCoveredToMs < requestedRange.toMs &&
        requestedRange.toMs - latestCoveredToMs <=
          WALLET_SWAP_HISTORY_LATEST_TOLERANCE_MS
      ? latestCoveredToMs
      : requestedRange.toMs;

  const intersecting = await db
    .select()
    .from(walletSwapHistoryMeta)
    .where(
      and(
        eq(walletSwapHistoryMeta.address, address),
        gt(walletSwapHistoryMeta.toInclusiveMs, fromMs),
        lt(walletSwapHistoryMeta.fromExclusiveMs, toMs),
      ),
    )
    .orderBy(desc(walletSwapHistoryMeta.toInclusiveMs));

  if (intersecting.length == 0) {
    const fetched = await fetchWalletSwapHistoryCore(
      address,
      fromMs,
      toMs,
      limit,
      true,
    );
    if (!fetched) return null;

    const hasUnresolvedRange =
      fetched.cutOffByLimit && fetched.coveredFromExclusiveMs > fromMs;
    const entries = await db_getSwapHistory(
      address,
      hasUnresolvedRange ? fetched.coveredFromExclusiveMs : fromMs,
      toMs,
      limit + 1,
      cursor,
    );
    return postProcessWalletTxHistory({
      entries,
      limit,
      fromExclusiveMs: fromMs,
      hasUnresolvedRange,
    });
  }

  const merged: { fromExclusiveMs: number; toInclusiveMs: number }[] = [];
  for (const item of intersecting) {
    if (
      merged.length == 0 ||
      item.toInclusiveMs < merged[merged.length - 1].fromExclusiveMs
    ) {
      merged.push({
        fromExclusiveMs: item.fromExclusiveMs,
        toInclusiveMs: item.toInclusiveMs,
      });
    } else {
      merged[merged.length - 1].fromExclusiveMs = Math.min(
        merged[merged.length - 1].fromExclusiveMs,
        item.fromExclusiveMs,
      );
    }
  }

  let cursorMs = toMs;
  const gaps: { fromExclusiveMs: number; toInclusiveMs: number }[] = [];
  for (const interval of merged) {
    if (interval.toInclusiveMs <= fromMs) {
      continue;
    }
    if (interval.fromExclusiveMs >= cursorMs) {
      continue;
    }
    if (interval.toInclusiveMs < cursorMs) {
      gaps.push({
        fromExclusiveMs: Math.max(interval.toInclusiveMs, fromMs),
        toInclusiveMs: cursorMs,
      });
    }
    if (interval.fromExclusiveMs < cursorMs) {
      cursorMs = Math.max(interval.fromExclusiveMs, fromMs);
    }
  }

  if (cursorMs > fromMs) {
    gaps.push({
      fromExclusiveMs: fromMs,
      toInclusiveMs: cursorMs,
    });
  }

  if (gaps.length == 0) {
    const entries = await db_getSwapHistory(
      address,
      fromMs,
      toMs,
      limit + 1,
      cursor,
    );
    return postProcessWalletTxHistory({
      entries,
      limit,
      fromExclusiveMs: fromMs,
      hasUnresolvedRange: false,
    });
  }

  const fetchedGapIntervals: {
    fromExclusiveMs: number;
    toInclusiveMs: number;
  }[] = [];
  let safeFromExclusiveMs: number | null = null;
  for (const gap of gaps) {
    const gapRes = await fetchWalletSwapHistoryGap(
      address,
      gap.fromExclusiveMs,
      gap.toInclusiveMs,
      limit,
    );

    if (!gapRes) {
      // TODO: Distinguish verified-empty gaps from fetch/extraction failures;
      // failures must terminate filling without marking the gap as covered.
      fetchedGapIntervals.push(gap);
      continue;
    }

    fetchedGapIntervals.push({
      fromExclusiveMs: gapRes.coveredFromExclusiveMs,
      toInclusiveMs: gapRes.coveredToInclusiveMs,
    });

    if (gapRes.cutOffByLimit) {
      safeFromExclusiveMs = gapRes.coveredFromExclusiveMs;
      break;
    }
  }

  const allIntervals = [...merged, ...fetchedGapIntervals].sort(
    (a, b) => b.toInclusiveMs - a.toInclusiveMs,
  );
  const finalMerged: { fromExclusiveMs: number; toInclusiveMs: number }[] = [];
  for (const interval of allIntervals) {
    if (
      finalMerged.length == 0 ||
      interval.toInclusiveMs <
        finalMerged[finalMerged.length - 1].fromExclusiveMs
    ) {
      finalMerged.push({
        fromExclusiveMs: interval.fromExclusiveMs,
        toInclusiveMs: interval.toInclusiveMs,
      });
    } else {
      finalMerged[finalMerged.length - 1].fromExclusiveMs = Math.min(
        finalMerged[finalMerged.length - 1].fromExclusiveMs,
        interval.fromExclusiveMs,
      );
    }
  }

  const idsToDelete = intersecting.map((row) => row.toInclusiveMs);
  await db
    .delete(walletSwapHistoryMeta)
    .where(
      and(
        eq(walletSwapHistoryMeta.address, address),
        inArray(walletSwapHistoryMeta.toInclusiveMs, idsToDelete),
      ),
    );

  const mergedInsertValues = finalMerged.map((interval) => ({
    address,
    fromExclusiveMs: interval.fromExclusiveMs,
    toInclusiveMs: interval.toInclusiveMs,
    fetchedAtMs: dayjs.utc().valueOf(),
  }));
  await db.insert(walletSwapHistoryMeta).values(mergedInsertValues);

  const returnFromExclusiveMs = safeFromExclusiveMs ?? fromMs;
  const entries = await db_getSwapHistory(
    address,
    returnFromExclusiveMs,
    toMs,
    limit + 1,
    cursor,
  );
  return postProcessWalletTxHistory({
    entries,
    limit,
    fromExclusiveMs: fromMs,
    hasUnresolvedRange:
      safeFromExclusiveMs != null && safeFromExclusiveMs > fromMs,
  });
}

type WalletTransferHistoryFetchResult = {
  values: WalletTransferV2[];
  coveredFromExclusiveMs: number;
  coveredToInclusiveMs: number;
  cutOffByLimit: boolean;
};

async function fetchWalletTransferHistoryGap(
  address: string,
  fromMs: number,
  toMs: number,
  limit?: number,
): Promise<WalletTransferHistoryFetchResult | null> {
  return await fetchWalletTransferHistoryCore(
    address,
    fromMs,
    toMs,
    limit,
    false,
  );
}

async function fetchWalletTransferHistoryCore(
  address: string,
  fromMs: number,
  toMs: number,
  limit: number = WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT,
  writeMeta: boolean = true,
): Promise<WalletTransferHistoryFetchResult | null> {
  const res = await zrn_fetchWalletTransactionsRange(
    address,
    "receive,send",
    fromMs,
    toMs,
    limit,
    WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT,
  );

  if (!res) return null;
  if (res.transactions.length == 0) {
    if (writeMeta) {
      await db.insert(walletTransferHistoryMeta).values({
        address,
        fromExclusiveMs: res.coveredFromExclusiveMs,
        toInclusiveMs: res.coveredToInclusiveMs,
        fetchedAtMs: dayjs.utc().valueOf(),
      });
    }

    return {
      values: [],
      coveredFromExclusiveMs: res.coveredFromExclusiveMs,
      coveredToInclusiveMs: res.coveredToInclusiveMs,
      cutOffByLimit: res.cutOffByLimit,
    };
  }

  const combinedValues = zrn_extractTransfers(address, res.transactions);
  if (combinedValues.returnValues.length == 0) {
    if (writeMeta) {
      await db.insert(walletTransferHistoryMeta).values({
        address,
        fromExclusiveMs: res.coveredFromExclusiveMs,
        toInclusiveMs: res.coveredToInclusiveMs,
        fetchedAtMs: dayjs.utc().valueOf(),
      });
    }

    return {
      values: [],
      coveredFromExclusiveMs: res.coveredFromExclusiveMs,
      coveredToInclusiveMs: res.coveredToInclusiveMs,
      cutOffByLimit: res.cutOffByLimit,
    };
  }

  await db
    .insert(walletTransferHistory)
    .values(combinedValues.insertValues)
    .onConflictDoUpdate({
      target: [
        walletTransferHistory.address,
        walletTransferHistory.transactionHash,
        walletTransferHistory.actId,
      ],
      set: {
        fetchedAtMs: dayjs.utc().valueOf(),
      },
    });

  if (combinedValues.tokenMetaInsertValues.length > 0) {
    await db
      .insert(tokenMeta)
      .values(combinedValues.tokenMetaInsertValues)
      .onConflictDoNothing();
  }

  if (writeMeta) {
    await db.insert(walletTransferHistoryMeta).values({
      address,
      fromExclusiveMs: res.coveredFromExclusiveMs,
      toInclusiveMs: res.coveredToInclusiveMs,
      fetchedAtMs: dayjs.utc().valueOf(),
    });
  }

  return {
    values: combinedValues.returnValues.slice(
      0,
      normalizeTxLimit(limit, WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT),
    ),
    coveredFromExclusiveMs: res.coveredFromExclusiveMs,
    coveredToInclusiveMs: res.coveredToInclusiveMs,
    cutOffByLimit: res.cutOffByLimit,
  };
}

async function db_getTransferHistory(
  address: string,
  fromExclusiveMs: number,
  toInclusiveMs: number,
  limit: number,
  cursor: WalletHistoryCursor | null,
): Promise<WalletTransaction<WalletTransferV2>[]> {
  const predicates = [
    eq(walletTransferHistory.address, address),
    gt(walletTransferHistory.blockTimestampMs, fromExclusiveMs),
    lte(walletTransferHistory.blockTimestampMs, toInclusiveMs),
  ];
  if (cursor) {
    const cursorPredicate = or(
      lt(walletTransferHistory.blockTimestampMs, cursor.blockTimestampMs),
      and(
        eq(walletTransferHistory.blockTimestampMs, cursor.blockTimestampMs),
        lt(walletTransferHistory.transactionHash, cursor.transactionHash),
      ),
      and(
        eq(walletTransferHistory.blockTimestampMs, cursor.blockTimestampMs),
        eq(walletTransferHistory.transactionHash, cursor.transactionHash),
        lt(walletTransferHistory.actId, cursor.actId),
      ),
    );
    if (cursorPredicate) predicates.push(cursorPredicate);
  }

  const rows = await db
    .select()
    .from(walletTransferHistory)
    .where(and(...predicates))
    .orderBy(
      desc(walletTransferHistory.blockTimestampMs),
      desc(walletTransferHistory.transactionHash),
      desc(walletTransferHistory.actId),
    )
    .limit(limit);

  const tokenAddresses = new Set(rows.map((item) => item.tokenAddress));
  const tokenMetaRes = await db
    .select()
    .from(tokenMeta)
    .where(inArray(tokenMeta.address, Array.from(tokenAddresses)));
  const tokenMetaLookup = Object.fromEntries(
    tokenMetaRes.map((tm) => [tm.address, tm]),
  );

  return rows.map((item) => ({
    blockTimestampMs: item.blockTimestampMs,
    transactionHash: item.transactionHash,
    actId: item.actId,
    transaction: {
      transactionHash: item.transactionHash,
      blockTimestampMs: item.blockTimestampMs,
      token: {
        address: item.tokenAddress,
        amount: item.amount,
        symbol: tokenMetaLookup[item.tokenAddress]?.symbol ?? null,
        name: tokenMetaLookup[item.tokenAddress]?.name ?? null,
        logoUri: tokenMetaLookup[item.tokenAddress]?.imageUrl ?? null,
        priceUsd: item.priceUsd,
      },
      direction: item.direction,
      counterpartyAddress: item.counterpartyAddress,
      valueUsd: item.valueUsd,
    },
  }));
}

export async function getWalletTransferHistory(
  address: string,
  requestFromMs?: number,
  requestToMs?: number,
  limit = WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT,
  parsedCursor?: WalletHistoryCursor,
): Promise<WalletTransactionHistory<WalletTransferV2> | null> {
  const cursor = parsedCursor ?? null;
  const requestedRange = cursor
    ? {
        fromMs: cursor.fromExclusiveMs,
        toMs: cursor.blockTimestampMs,
      }
    : normalizeRange(requestFromMs, requestToMs);
  const fromMs = requestedRange.fromMs;
  limit = normalizeTxLimit(
    limit,
    WALLET_TRANSFER_HISTORY_TRANSACTIONS_MAX_COUNT,
  );

  const [latestMeta] = await db
    .select({ toInclusiveMs: max(walletTransferHistoryMeta.toInclusiveMs) })
    .from(walletTransferHistoryMeta)
    .where(eq(walletTransferHistoryMeta.address, address))
    .limit(1);

  const latestCoveredToMs = latestMeta?.toInclusiveMs ?? null;
  const toMs = cursor
    ? cursor.blockTimestampMs
    : latestCoveredToMs != null &&
        latestCoveredToMs < requestedRange.toMs &&
        requestedRange.toMs - latestCoveredToMs <=
          WALLET_TRANSFER_HISTORY_LATEST_TOLERANCE_MS
      ? latestCoveredToMs
      : requestedRange.toMs;

  const intersecting = await db
    .select()
    .from(walletTransferHistoryMeta)
    .where(
      and(
        eq(walletTransferHistoryMeta.address, address),
        gt(walletTransferHistoryMeta.toInclusiveMs, fromMs),
        lt(walletTransferHistoryMeta.fromExclusiveMs, toMs),
      ),
    )
    .orderBy(desc(walletTransferHistoryMeta.toInclusiveMs));

  if (intersecting.length == 0) {
    const fetched = await fetchWalletTransferHistoryCore(
      address,
      fromMs,
      toMs,
      limit,
      true,
    );
    if (!fetched) return null;

    const hasUnresolvedRange =
      fetched.cutOffByLimit && fetched.coveredFromExclusiveMs > fromMs;
    const entries = await db_getTransferHistory(
      address,
      hasUnresolvedRange ? fetched.coveredFromExclusiveMs : fromMs,
      toMs,
      limit + 1,
      cursor,
    );

    return postProcessWalletTxHistory({
      entries,
      limit,
      fromExclusiveMs: fromMs,
      hasUnresolvedRange,
    });
  }

  const merged: { fromExclusiveMs: number; toInclusiveMs: number }[] = [];
  for (const item of intersecting) {
    if (
      merged.length == 0 ||
      item.toInclusiveMs < merged[merged.length - 1].fromExclusiveMs
    ) {
      merged.push({
        fromExclusiveMs: item.fromExclusiveMs,
        toInclusiveMs: item.toInclusiveMs,
      });
    } else {
      merged[merged.length - 1].fromExclusiveMs = Math.min(
        merged[merged.length - 1].fromExclusiveMs,
        item.fromExclusiveMs,
      );
    }
  }

  let cursorMs = toMs;
  const gaps: { fromExclusiveMs: number; toInclusiveMs: number }[] = [];
  for (const interval of merged) {
    if (interval.toInclusiveMs <= fromMs) continue;
    if (interval.fromExclusiveMs >= cursorMs) continue;
    if (interval.toInclusiveMs < cursorMs) {
      gaps.push({
        fromExclusiveMs: Math.max(interval.toInclusiveMs, fromMs),
        toInclusiveMs: cursorMs,
      });
    }
    if (interval.fromExclusiveMs < cursorMs) {
      cursorMs = Math.max(interval.fromExclusiveMs, fromMs);
    }
  }

  if (cursorMs > fromMs) {
    gaps.push({
      fromExclusiveMs: fromMs,
      toInclusiveMs: cursorMs,
    });
  }

  if (gaps.length == 0) {
    const entries = await db_getTransferHistory(
      address,
      fromMs,
      toMs,
      limit + 1,
      cursor,
    );

    return postProcessWalletTxHistory({
      entries,
      limit,
      fromExclusiveMs: fromMs,
      hasUnresolvedRange: false,
    });
  }

  const fetchedGapIntervals: {
    fromExclusiveMs: number;
    toInclusiveMs: number;
  }[] = [];
  let safeFromExclusiveMs: number | null = null;
  for (const gap of gaps) {
    const gapRes = await fetchWalletTransferHistoryGap(
      address,
      gap.fromExclusiveMs,
      gap.toInclusiveMs,
      limit,
    );

    if (!gapRes) {
      // TODO: Distinguish verified-empty gaps from fetch/extraction failures;
      // failures must terminate filling without marking the gap as covered.
      fetchedGapIntervals.push(gap);
      continue;
    }

    fetchedGapIntervals.push({
      fromExclusiveMs: gapRes.coveredFromExclusiveMs,
      toInclusiveMs: gapRes.coveredToInclusiveMs,
    });

    if (gapRes.cutOffByLimit) {
      safeFromExclusiveMs = gapRes.coveredFromExclusiveMs;
      break;
    }
  }

  const allIntervals = [...merged, ...fetchedGapIntervals].sort(
    (a, b) => b.toInclusiveMs - a.toInclusiveMs,
  );
  const finalMerged: { fromExclusiveMs: number; toInclusiveMs: number }[] = [];
  for (const interval of allIntervals) {
    if (
      finalMerged.length == 0 ||
      interval.toInclusiveMs <
        finalMerged[finalMerged.length - 1].fromExclusiveMs
    ) {
      finalMerged.push({
        fromExclusiveMs: interval.fromExclusiveMs,
        toInclusiveMs: interval.toInclusiveMs,
      });
    } else {
      finalMerged[finalMerged.length - 1].fromExclusiveMs = Math.min(
        finalMerged[finalMerged.length - 1].fromExclusiveMs,
        interval.fromExclusiveMs,
      );
    }
  }

  const idsToDelete = intersecting.map((row) => row.toInclusiveMs);
  await db
    .delete(walletTransferHistoryMeta)
    .where(
      and(
        eq(walletTransferHistoryMeta.address, address),
        inArray(walletTransferHistoryMeta.toInclusiveMs, idsToDelete),
      ),
    );

  const mergedInsertValues = finalMerged.map((interval) => ({
    address,
    fromExclusiveMs: interval.fromExclusiveMs,
    toInclusiveMs: interval.toInclusiveMs,
    fetchedAtMs: dayjs.utc().valueOf(),
  }));
  await db.insert(walletTransferHistoryMeta).values(mergedInsertValues);

  const returnFromExclusiveMs = safeFromExclusiveMs ?? fromMs;
  const entries = await db_getTransferHistory(
    address,
    returnFromExclusiveMs,
    toMs,
    limit + 1,
    cursor,
  );

  return postProcessWalletTxHistory({
    entries,
    limit,
    fromExclusiveMs: fromMs,
    hasUnresolvedRange:
      safeFromExclusiveMs != null && safeFromExclusiveMs > fromMs,
  });
}
