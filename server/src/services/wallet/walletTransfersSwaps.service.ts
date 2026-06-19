import {
    saveSwapsCache,
    saveTransfersCache,
} from "@sv/services/wallet/db/walletDataCacher.js";
import {
    getCachedWalletTransfers,
    getCachedWalletSwaps,
    getCachedWalletTransfersMeta,
    getCachedWalletSwapsMeta,
} from "@sv/services/wallet/db/walletDataRetriever.js";
import type {
    WalletTransfersResponse,
    WalletSwapsResponse,
    WalletSwap,
    WalletTransfer,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
    enrichWithSolanaTokenPrices,
    postEnrichTransfers,
    postEnrichSwaps,
} from "@sv/services/wallet/walletEnrichment.service.js";
import { toWalletPageInfo } from "@sv/services/wallet/walletData.core.js";
import { resolveEnhancedTransactions } from "@sv/services/wallet/providers/walletEnhancedTx.service.js";
import { mapHeliusTxsToSwaps } from "@sv/services/wallet/providers/helius-to-swap.js";
import { mapHeliusTxsToTransfers } from "@sv/services/wallet/providers/helius-to-transfer.js";
import {
    resolveRequestedRange,
    isMissingRangeSignificant,
    getMissingRanges,
} from "@sv/services/wallet/walletRange.utils.js";
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
} from "@sv/db/schema";
import dayjs from "dayjs";
import { db } from "@sv/db";
import {
    WALLET_SWAPS_TTL_MS,
    WALLET_TRANSFERS_TTL_MS,
    WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
    WALLET_RECENT_TRANSACTIONS_PRUNE_INTERVAL_MS,
    WALLET_RECENT_TRANSACTIONS_RETENTION_MS,
    ZERION_WALLET_TRANSACTIONS_PAGE_SIZE,
    WSOL_MINT,
    DAY_MS,
} from "@sv/config/constants";
import { and, desc, eq, gte, inArray, lt, max } from "drizzle-orm";

type ZRN_WalletTransaction = ZRN_WalletTransactions["data"][number];
type ZRN_WalletTransfer =
  ZRN_WalletTransaction["attributes"]["transfers"][number];
type ZRN_FungibleInfo = ZRN_WalletTransfer["fungible_info"];
type SourcedZRNWalletTransaction = ZRN_WalletTransaction & {
  sourceEndpoint: string;
};

type ZrnTradeTransferMatch = {
  inTransfer: ZRN_WalletTransfer;
  outTransfer: ZRN_WalletTransfer;
  diffUsd: number;
};

type ZrnTradeTransferMatchResult =
  | {
      match: ZrnTradeTransferMatch;
      reason: null;
    }
  | {
      match: null;
      reason:
        | "transfer_match_no_transfers"
        | "transfer_match_missing_in_transfer"
        | "transfer_match_missing_out_transfer"
        | "transfer_match_no_valid_priced_pair";
    };

const ZRN_SOL_FUNGIBLE_ID = "11111111111111111111111111111111";

let lastRecentTransactionsPruneAtMs = 0;

function normalizeRecentTransactionsLimit(limit: number): number {
  if (!Number.isFinite(limit)) return WALLET_RECENT_TRANSACTIONS_MAX_COUNT;
  return Math.min(
    Math.max(Math.trunc(limit), 1),
    WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
  );
}

async function pruneStaleRecentTransactionRows(nowMs: number): Promise<void> {
  if (
    nowMs - lastRecentTransactionsPruneAtMs <
    WALLET_RECENT_TRANSACTIONS_PRUNE_INTERVAL_MS
  ) {
    return;
  }

  lastRecentTransactionsPruneAtMs = nowMs;
  const staleBeforeMs = nowMs - WALLET_RECENT_TRANSACTIONS_RETENTION_MS;
  try {
    await Promise.all([
      db
        .delete(walletRecentSwaps)
        .where(lt(walletRecentSwaps.fetchedAtMs, staleBeforeMs)),
      db
        .delete(walletRecentTransfers)
        .where(lt(walletRecentTransfers.fetchedAtMs, staleBeforeMs)),
    ]);
  } catch (error) {
    console.error("Failed to prune stale recent wallet transactions", error);
  }
}

async function zrn_fetchWalletTransactions(
  address: string,
  operationTypes: string,
  limit: number,
): Promise<SourcedZRNWalletTransaction[] | null> {
  const maxTransactions = normalizeRecentTransactionsLimit(limit);
  const firstPageUrl = zrn.getEndpoint(`/wallets/${address}/transactions/`);
  firstPageUrl.search = new URLSearchParams({
    currency: "usd",
    "filter[operation_types]": operationTypes,
    "filter[chain_ids]": "solana",
    "page[size]": String(
      Math.min(maxTransactions, ZERION_WALLET_TRANSACTIONS_PAGE_SIZE),
    ),
  }).toString();

  const transactions: SourcedZRNWalletTransaction[] = [];
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
      ...page.data
        .slice(0, maxTransactions - transactions.length)
        .map((transaction) => ({
          ...transaction,
          sourceEndpoint: currentUrl,
        })),
    );

    // console.info("[zerion-wallet-transactions] page fetched", {
    //   address,
    //   operationTypes,
    //   pageTransactionCount: page.data.length,
    //   collectedTransactions: transactions.length,
    //   nextLink: page.links.next ?? null,
    // });

    if (transactions.length >= maxTransactions) break;

    nextUrl = page.links.next ? new URL(page.links.next) : null;
  }

  return transactions;
}

function sortTransfersByTimestampDesc(
  transfers: WalletTransfer[],
): WalletTransfer[] {
  return [...transfers].sort(
    (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
  );
}

function sortSwapsByTimestampDesc(swaps: WalletSwap[]): WalletSwap[] {
  return [...swaps].sort(
    (left, right) =>
      dayjs.utc(right.blockTimestampIso).valueOf() - dayjs.utc(left.blockTimestampIso).valueOf(),
  );
}

function zrn_getTransferTradePair(
  transfers: ZRN_WalletTransfer[],
): ZrnTradeTransferMatchResult {
  if (transfers.length == 0) {
    return { match: null, reason: "transfer_match_no_transfers" };
  }

  const ins = transfers.filter((transfer) => transfer.direction == "in" && transfer.value != null && Number.isFinite(Number(transfer.value)));
  const outs = transfers.filter((transfer) => transfer.direction == "out" && transfer.value != null && Number.isFinite(Number(transfer.value)));
  if (ins.length == 0) {
    return { match: null, reason: "transfer_match_missing_in_transfer" };
  }
  if (outs.length == 0) {
    return { match: null, reason: "transfer_match_missing_out_transfer" };
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
    return { match: null, reason: "transfer_match_no_valid_priced_pair" };
  }

  return { match: best, reason: null };
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
      ? ((await getCachedWalletTransfers(
          address,
          cachedRange.fromMs,
          cachedRange.toMs,
          tokenAddress,
          direction,
          minAmountUsd,
        )) ?? [])
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
      const txs = await resolveEnhancedTransactions(
        address,
        range.fromMs,
        range.toMs,
      );
      const segment = mapHeliusTxsToTransfers(txs, address);
      fetchedTransfers.push(...segment);
    }
  }

  let combinedTransfers = sortTransfersByTimestampDesc([
    ...cachedTransfers,
    ...fetchedTransfers,
  ]);

  if (tokenAddress != null || direction != null || minAmountUsd != null) {
    combinedTransfers = combinedTransfers.filter((tr) => {
      if (tokenAddress != null && tr.tokenAddress !== tokenAddress)
        return false;
      if (direction === "in" && tr.to !== address) return false;
      if (direction === "out" && tr.from !== address) return false;
      if (minAmountUsd != null) {
        const usd = tr.amountUsd;
        if (usd == null || usd < minAmountUsd) return false;
      }
      return true;
    });
  }

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

  const cacheTo = to || Date.now();
  const fromDate = new Date(cacheTo - 30 * 24 * 60 * 60 * 1000);
  const cachefrom =
    from ||
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
      0,
      0,
      0,
      0,
    );
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
  to?: number,
  tokenAddress?: string,
): Promise<WalletSwapsResponse> {
  const metaRows = await getCachedWalletSwapsMeta(address);
  const walletSwapMeta = metaRows.length > 0 ? metaRows[0] : null;
  const requestedRange = resolveRequestedRange(from, to);
  const coveredRange =
    walletSwapMeta?.coveredFromSec != null &&
    walletSwapMeta?.coveredToSec != null
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
      ? ((await getCachedWalletSwaps(
          address,
          cachedRange.fromMs,
          cachedRange.toMs,
          tokenAddress,
        )) ?? [])
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
      const txs = await resolveEnhancedTransactions(
        address,
        range.fromMs,
        range.toMs,
      );
      const mapped = mapHeliusTxsToSwaps(txs, address);
      fetchedSwaps.push(...mapped);
    }
  }

  let combinedSwaps = sortSwapsByTimestampDesc([
    ...cachedSwaps,
    ...fetchedSwaps,
  ]);

  if (tokenAddress != null) {
    combinedSwaps = combinedSwaps.filter((s) => {
      if (s.bought.address === tokenAddress || s.sold.address === tokenAddress)
        return true;
      return false;
    });
  }

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

  const cacheTo = to || Date.now();
  const fromDate = new Date(cacheTo - 30 * DAY_MS);
  const cachefrom =
    from ||
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
      0,
      0,
      0,
      0,
    );
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

export type WalletTransferToken =
  {
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

  type CombinedValues = {
    insertValue: WalletRecentSwapsInsert;
    returnValue: WalletSwapV2;
  };

  function logRejectedTradeAct(
    reason: string,
    transaction: SourcedZRNWalletTransaction,
    actId: string,
    details: Record<string, unknown> = {},
  ): null {
    if (reason.startsWith("transfer_match_")) {
      console.info("[zerion-wallet-swaps] failed to match trade transfer pair", {
        reason,
        sourceEndpoint: transaction.sourceEndpoint,
        transactionHash: transaction.attributes.hash,
        transactionOperationType: transaction.attributes.operation_type,
        transactionStatus: transaction.attributes.status,
        actId,
        transactionActTypes: transaction.attributes.acts.map((act) => act.type),
        transactionTransferCount: transaction.attributes.transfers.length,
        ...details,
      });
    }
    return null;
  }

  const combinedValues: CombinedValues[] = transactions
    .flatMap((transaction) =>
      transaction.attributes.acts
        .filter((act) => act.type == "trade")
        .map((act): CombinedValues | null => {
          // Zerion trades are one in and one out; noisy legs are handled by
          // picking the closest valued in/out pair.
          const transfers = transaction.attributes.transfers.filter(
            (transfer) =>
              transfer.act_id == act.id,
          );
          const transferMatchResult = zrn_getTransferTradePair(transfers);
          if (!transferMatchResult.match) {
            return logRejectedTradeAct(
              transferMatchResult.reason,
              transaction,
              act.id,
              {
                matchedTransferCount: transfers.length,
                matchedTransferDirections: transfers.map(
                  (transfer) => transfer.direction,
                ),
                matchedTransferSymbols: transfers.map(
                  (transfer) => transfer.fungible_info.symbol,
                ),
                matchedTransferValues: transfers.map(
                  (transfer) => transfer.value,
                ),
                matchedTransferPrices: transfers.map(
                  (transfer) => transfer.price,
                ),
                allTransferActIds: transaction.attributes.transfers.map(
                  (transfer) => transfer.act_id,
                ),
              },
            );
          }
          const { inTransfer, outTransfer } = transferMatchResult.match;

          const tokenIn = inTransfer?.fungible_info;
          const tokenOut = outTransfer?.fungible_info;

          const tokenInAddress = zrn_getSolanaTokenAddress(tokenIn);
          const tokenOutAddress = zrn_getSolanaTokenAddress(tokenOut);

          if (
            !tokenIn ||
            !tokenOut ||
            tokenInAddress == null ||
            tokenOutAddress == null
          ) {
            return logRejectedTradeAct(
              "missing_solana_token_address",
              transaction,
              act.id,
              {
                tokenInSymbol: tokenIn.symbol,
                tokenOutSymbol: tokenOut.symbol,
                tokenInImplementations: tokenIn.implementations,
                tokenOutImplementations: tokenOut.implementations,
              },
            );
          }

          const amountIn = Number(inTransfer.quantity.numeric);
          const amountOut = Number(outTransfer.quantity.numeric);
          if (!Number.isFinite(amountIn) || !Number.isFinite(amountOut)) {
            return logRejectedTradeAct(
              "invalid_transfer_amount",
              transaction,
              act.id,
              {
                amountInRaw: inTransfer.quantity.numeric,
                amountOutRaw: outTransfer.quantity.numeric,
              },
            );
          }

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

          if (!valueUsd || !Number.isFinite(valueUsd)) {
            return logRejectedTradeAct(
              "missing_or_invalid_usd_value",
              transaction,
              act.id,
              {
                inTransferValue: inTransfer.value,
                outTransferValue: outTransfer.value,
                tokenInPriceUsd,
                tokenOutPriceUsd,
                amountIn,
                amountOut,
                computedValueUsd: valueUsd,
              },
            );
          }

          const blockTimestampMs = dayjs
            .utc(transaction.attributes.mined_at)
            .valueOf();

          tokenMetaInsertValues.push(
            {
              address: tokenInAddress,
              symbol: tokenIn.symbol,
              name: tokenIn.name,
              imageUrl: tokenIn.icon?.url || null,
            },
            {
              address: tokenOutAddress,
              symbol: tokenOut.symbol,
              name: tokenOut.name,
              imageUrl: tokenOut.icon?.url || null,
            },
          );
          return {
            // enrich metadata
            returnValue: {
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
            },
            insertValue: {
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
              fetchedAtMs,
            },
          };
        }),
    )
    .filter((item) => item != null);

  const insertValues = combinedValues.map((v) => v.insertValue);
  if (insertValues.length == 0) {
    return [];
  }

  await db
    .insert(walletRecentSwaps)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [walletRecentSwaps.transactionHash, walletRecentSwaps.actId],
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

  const returnValues = combinedValues.map((v) => v.returnValue);
  return returnValues;
}

export async function getWalletRecentSwaps(
  address: string,
  limit: number = WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
): Promise<WalletSwapV2[] | null> {
  const normalizedLimit = normalizeRecentTransactionsLimit(limit);
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
    await pruneStaleRecentTransactionRows(dayjs.utc().valueOf());
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
    await pruneStaleRecentTransactionRows(dayjs.utc().valueOf());
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

  const tokenMetaInsertValues: TokenMetaInsert[] = [];
  const fetchedAtMs = dayjs.utc().valueOf();
  const combinedValues: {
    insertValue: WalletRecentTransfersInsert;
    returnValue: WalletTransferV2;
  }[] = [];

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
      if (!token || tokenAddress == null) continue;

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

      const returnValue: WalletTransferV2 = {
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
      };

      const insertValue: WalletRecentTransfersInsert = {
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
      };

      combinedValues.push({ insertValue, returnValue });
    }
  }
  if (combinedValues.length == 0) return [];

  await db
    .insert(walletRecentTransfers)
    .values(combinedValues.map((v) => v.insertValue))
    .onConflictDoUpdate({
      target: [
        walletRecentTransfers.transactionHash,
        walletRecentTransfers.actId,
      ],
      set: { fetchedAtMs },
    });

  if (tokenMetaInsertValues.length > 0) {
    await db
      .insert(tokenMeta)
      .values(tokenMetaInsertValues)
      .onConflictDoNothing();
  }

  return combinedValues.map((v) => v.returnValue);
}

export async function getWalletRecentTransfers(
  address: string,
  limit: number = WALLET_RECENT_TRANSACTIONS_MAX_COUNT,
): Promise<WalletTransferV2[] | null> {
  const normalizedLimit = normalizeRecentTransactionsLimit(limit);
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
    await pruneStaleRecentTransactionRows(dayjs.utc().valueOf());
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
    await pruneStaleRecentTransactionRows(dayjs.utc().valueOf());
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
