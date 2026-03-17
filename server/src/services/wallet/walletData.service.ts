import {
  WALLET_EXCHANGE_COUNTS_TTL_MS,
  WALLET_OVERVIEW_TTL_MS,
  WALLET_PORTFOLIO_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  walletExchangeCountsCache,
  walletOverviewCache,
  walletPortfolioCache,
} from "@sv/db/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import {
  getDailyTokenMarketChart,
  getHourlyTokenMarketChart,
} from "../tokens/token-chart.js";
import { getTokenHistoricalData } from "../tokens/token-history.js";
import { getTokenMeta } from "../tokens/token-info.js";
import {
  fetchAllTransactionHistory,
  fetchHeliusSolanaPortfolio,
  fetchHeliusSolanaSwap,
  fetchHeliusSolanaTransactions,
  fetchHeliusSolanaTransfers,
  timePeriodToFromSec,
} from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import {
  getCachedWalletTransactionsHelius,
  getCachedWalletSwaps,
  getCachedWalletTransactions,
  getCachedWalletTransfers,
} from "@sv/services/wallet/db/walletDataRetriever.js";
import type {
  SupportedChain,
  WalletExchangeCountItem,
  WalletExchangeCountsResponse,
  WalletOverview,
  WalletPortfolioItem,
  WalletSwap,
  WalletTransaction,
  WalletTransactionHelius,
  WalletTransactionsResponse,
  WalletTransfer,
  WalletTransfersResponse,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import * as moralis from "@sv/util/util-moralis.js";
import { resolveChainForAddress } from "@sv/util/util-helius.js";
import { Signature } from "ethers";
import {
  saveOverviewCache,
  saveSwapsCache,
  saveTransactionsCache,
  saveTransactionsHeliusCache,
  saveTransfersCache,
} from "./db/walletDataCacher.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
const SOL_NATIVE_ALIAS_MINT = "So11111111111111111111111111111111111111111";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_SEC = 24 * 60 * 60;

type WalletHistoryRange = {
  fromSec: number;
  toSec: number;
};

let chainRepairPromise: Promise<void> | null = null;

const DEFAULT_OVERVIEW_PERIOD_SEC = DAY_SEC;
const MIN_OVERVIEW_PERIOD_SEC = DAY_SEC;
const MAX_OVERVIEW_PERIOD_SEC = 7 * DAY_SEC;
const MAX_OVERVIEW_MORALIS_PAGES = 5;

const PORTFOLIO_METADATA_PLACEHOLDERS = new Set([
  "",
  "unknown",
  "unk",
  "n/a",
  "na",
  "null",
  "undefined",
  "-",
  "--",
  "?",
]);

type WalletOverviewCacheRow = {
  totalAssetValueUsd: number | string;
  tradingVolumeUsd24h: number | string | null;
  pnlUsdTotal: number | string | null;
  transactionCount24h: number | null;
  tokensTradedCount: number | null;
  tokensHoldingCount: number;
  fetchedAt: Date;
};

type NormalizedOverviewBalanceChange = {
  mint: string;
  amount: number;
  decimals: number;
  usdDeltaHint?: number;
};

type NormalizedOverviewTransaction = {
  signature: string;
  timestamp: string;
  balanceChanges: NormalizedOverviewBalanceChange[];
};

type OverviewHoldingsSnapshot = {
  totalAssetValueUsd: number;
  tokensHoldingCount: number;
  source:
  | "helius-portfolio"
  | "moralis-wallet-tokens"
  | "overview-cache"
  | "none";
};

type OverviewActivitySnapshot = {
  transactionCount24h: number | null;
  tokensTradedCount: number | null;
  tradingVolumeUsd24h: number | null;
  pnlUsdTotal: number | null;
  source: "helius-transactions" | "moralis-history" | "overview-cache" | "none";
  pricedChangesCount: number;
};

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }

  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  return new Date().toISOString();
}

function getHistoryRange(options?: { from?: "24h" | "7d"; fromSec?: number; toSec?: number }): WalletHistoryRange {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec =
    options?.fromSec != null
      ? Math.max(0, options.fromSec)
      : options?.from === "24h"
        ? nowSec - DAY_SEC
        : nowSec - 7 * DAY_SEC;
  const toSec = options?.toSec != null ? Math.max(fromSec, options.toSec) : nowSec;
  return { fromSec, toSec };
}

function getTimestampSecFromIso(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return 0;
  }
  return Math.floor(ms / 1000);
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

  return Array.from(bySignature.values()).sort(
    (a, b) => getTimestampSecFromIso(b.timestamp) - getTimestampSecFromIso(a.timestamp),
  );
}

async function normalizeWalletCacheChainsOnce(): Promise<void> {
  if (chainRepairPromise) {
    await chainRepairPromise;
    return;
  }

  chainRepairPromise = (async () => {
    try {
      await db.execute(sql`update wallet_helius_transactions set chain = lower(chain) where chain <> lower(chain)`);
      await db.execute(sql`update wallet_transactions_meta set chain = lower(chain) where chain <> lower(chain)`);
      await db.execute(sql`update wallet_transactions set chain = lower(chain) where chain <> lower(chain)`);
      await db.execute(sql`update wallet_swap set chain = lower(chain) where chain <> lower(chain)`);
      await db.execute(sql`update wallet_swap_meta set chain = lower(chain) where chain <> lower(chain)`);
      await db.execute(sql`update wallet_transfer_meta set chain = lower(chain) where chain <> lower(chain)`);
      await db.execute(sql`update token_transfers set chain = lower(chain) where chain <> lower(chain)`);
    } catch (err) {
      console.error("[wallet-cache-chain-repair] Failed to normalize chain values", err);
    }
  })();

  await chainRepairPromise;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeOverviewPeriodSec(periodSec?: number): number {
  const parsed = Number(periodSec ?? DEFAULT_OVERVIEW_PERIOD_SEC);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_OVERVIEW_PERIOD_SEC;
  }

  const normalized = Math.floor(parsed);
  if (normalized < MIN_OVERVIEW_PERIOD_SEC || normalized > MAX_OVERVIEW_PERIOD_SEC) {
    return DEFAULT_OVERVIEW_PERIOD_SEC;
  }

  return normalized;
}

function formatOverviewMetricsPeriod(periodSec: number): string {
  if (periodSec === DAY_SEC) {
    return "24h";
  }

  const days = Math.floor(periodSec / DAY_SEC);
  if (days * DAY_SEC === periodSec) {
    return `${days}d`;
  }

  const hours = Math.max(1, Math.round(periodSec / 3600));
  return `${hours}h`;
}

function normalizeOverviewMint(mint: unknown): string {
  const rawMint = String(mint ?? "").trim();
  if (!rawMint) {
    return "";
  }

  return rawMint.toUpperCase() === "SOL" ? SOL_MINT : rawMint;
}

function mapOverviewCacheRowToDto(
  row: WalletOverviewCacheRow,
  address: string,
  chain: SupportedChain,
  periodSec: number,
): WalletOverview {
  const tradingVolumeUsd =
    row.tradingVolumeUsd24h != null ? toFiniteNumber(row.tradingVolumeUsd24h, 0) : null;
  const pnlUsd = row.pnlUsdTotal != null ? toFiniteNumber(row.pnlUsdTotal, 0) : null;

  return {
    address,
    chain,
    totalAssetValueUsd: toFiniteNumber(row.totalAssetValueUsd, 0),
    tradingVolumeUsd24h: tradingVolumeUsd,
    pnlUsdTotal: pnlUsd,
    transactionCount24h: row.transactionCount24h ?? null,
    tokensTradedCount: row.tokensTradedCount ?? null,
    tokensHoldingCount: toFiniteNumber(row.tokensHoldingCount, 0),
    tradingVolumeUsdWindow: tradingVolumeUsd,
    pnlUsdWindow: pnlUsd,
    metricsPeriod: formatOverviewMetricsPeriod(periodSec),
  };
}

async function getLatestOverviewCacheRow(
  address: string,
  chain: SupportedChain,
): Promise<WalletOverviewCacheRow | null> {
  const cached = await db
    .select()
    .from(walletOverviewCache)
    .where(
      and(
        eq(walletOverviewCache.address, address),
        eq(walletOverviewCache.chain, chain),
      ),
    )
    .limit(1);

  if (cached.length === 0) {
    return null;
  }

  return cached[0] as unknown as WalletOverviewCacheRow;
}

function getOverviewFromFreshCache(
  cacheRow: WalletOverviewCacheRow | null,
  address: string,
  chain: SupportedChain,
  periodSec: number,
): WalletOverview | null {
  if (!cacheRow || periodSec !== DEFAULT_OVERVIEW_PERIOD_SEC) {
    return null;
  }

  const overviewThreshold = new Date(Date.now() - WALLET_OVERVIEW_TTL_MS);
  if (cacheRow.fetchedAt < overviewThreshold) {
    return null;
  }

  return mapOverviewCacheRowToDto(cacheRow, address, chain, periodSec);
}

async function fetchMoralisWalletTokensSnapshot(
  address: string,
  chain: SupportedChain,
): Promise<OverviewHoldingsSnapshot | null> {
  const endpoint = moralis.getEndpoint(`/wallets/${address}/tokens`);
  const searchParams = new URLSearchParams();
  if (chain) {
    searchParams.set("chain", chain);
  }
  searchParams.set("limit", "100");
  endpoint.search = searchParams.toString();

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: moralis.getRequiredHeaders(),
    });

    if (!resp.ok) {
      console.error("Moralis wallets/tokens error", resp.status, resp.statusText);
      return null;
    }

    const data = await resp.json();
    const result = Array.isArray(data?.result) ? data.result : [];

    return {
      totalAssetValueUsd: result.reduce(
        (sum: number, item: any) => sum + Number(item?.usd_value ?? 0),
        0,
      ),
      tokensHoldingCount: result.length,
      source: "moralis-wallet-tokens",
    };
  } catch (err) {
    console.error("Moralis wallets/tokens request failed", err);
    return null;
  }
}

async function buildHoldingsSnapshotFromProviders(
  address: string,
  chain: SupportedChain,
  cacheRow: WalletOverviewCacheRow | null,
): Promise<OverviewHoldingsSnapshot> {
  if (chain === "solana") {
    try {
      const heliusPortfolio = await fetchHeliusSolanaPortfolio(address);
      return {
        totalAssetValueUsd: heliusPortfolio.reduce(
          (sum, item) => sum + Number(item.valueUsd ?? 0),
          0,
        ),
        tokensHoldingCount: heliusPortfolio.length,
        source: "helius-portfolio",
      };
    } catch (err) {
      console.error("Failed to fetch Solana portfolio for overview holdings", err);
    }
  } else {
    const evmSnapshot = await fetchMoralisWalletTokensSnapshot(address, chain);
    if (evmSnapshot) {
      return evmSnapshot;
    }
  }

  if (cacheRow) {
    return {
      totalAssetValueUsd: toFiniteNumber(cacheRow.totalAssetValueUsd, 0),
      tokensHoldingCount: toFiniteNumber(cacheRow.tokensHoldingCount, 0),
      source: "overview-cache",
    };
  }

  return {
    totalAssetValueUsd: 0,
    tokensHoldingCount: 0,
    source: "none",
  };
}

function getSignedTransferDirection(
  fromAddress: unknown,
  toAddress: unknown,
  walletAddressLower: string,
): number {
  const fromLower = String(fromAddress ?? "").toLowerCase();
  const toLower = String(toAddress ?? "").toLowerCase();

  if (toLower === walletAddressLower && fromLower !== walletAddressLower) {
    return 1;
  }

  if (fromLower === walletAddressLower && toLower !== walletAddressLower) {
    return -1;
  }

  return 0;
}

function normalizeTransferAmount(
  transfer: Record<string, unknown>,
  defaultDecimals: number,
): number {
  const formatted = Number(transfer.value_formatted ?? Number.NaN);
  if (Number.isFinite(formatted)) {
    return formatted;
  }

  const rawAmount = Number(transfer.value ?? transfer.amount ?? Number.NaN);
  const decimals = Number(transfer.token_decimals ?? transfer.decimals ?? defaultDecimals);
  if (!Number.isFinite(rawAmount) || !Number.isFinite(decimals)) {
    return 0;
  }

  return rawAmount / 10 ** Math.max(0, decimals);
}

function normalizeUsdDeltaHint(value: unknown, direction: number): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.abs(parsed) * direction;
}

async function getSolanaOverviewActivityTransactions(
  address: string,
  chain: SupportedChain,
  range: WalletHistoryRange,
): Promise<NormalizedOverviewTransaction[]> {
  const txs = await getWalletTransactionHelius(address, chain, {
    fromSec: range.fromSec,
    toSec: range.toSec,
  });

  return txs.transactions.map((tx) => ({
    signature: tx.signature,
    timestamp: tx.timestamp,
    balanceChanges: (tx.balanceChanges ?? []).map((change) => ({
      mint: normalizeOverviewMint(change?.mint),
      amount: Number(change?.amount ?? 0),
      decimals: Number(change?.decimals ?? 0),
    })),
  }));
}

async function getEvmOverviewActivityTransactions(
  address: string,
  chain: SupportedChain,
  range: WalletHistoryRange,
): Promise<NormalizedOverviewTransaction[]> {
  const walletAddressLower = address.toLowerCase();
  const normalizedTransactions: NormalizedOverviewTransaction[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < MAX_OVERVIEW_MORALIS_PAGES; page += 1) {
    const endpoint = moralis.getEndpoint(`/wallets/${address}/history`);
    const params = new URLSearchParams();
    if (chain) {
      params.set("chain", chain);
    }
    params.set("order", "DESC");
    params.set("limit", "100");
    if (cursor) {
      params.set("cursor", cursor);
    }
    endpoint.search = params.toString();

    let payload: any = null;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: moralis.getRequiredHeaders(),
      });

      if (!response.ok) {
        console.error("Moralis wallet history error", response.status, response.statusText);
        break;
      }

      payload = await response.json();
    } catch (err) {
      console.error("Moralis wallet history request failed", err);
      break;
    }

    const result = Array.isArray(payload?.result) ? payload.result : [];
    if (result.length === 0) {
      break;
    }

    let reachedPastRange = false;

    for (const tx of result) {
      const timestamp = toIsoTimestamp(tx?.block_timestamp ?? tx?.blockTimestamp ?? tx?.timestamp);
      const txSec = getTimestampSecFromIso(timestamp);

      if (txSec > range.toSec) {
        continue;
      }
      if (txSec < range.fromSec) {
        reachedPastRange = true;
        continue;
      }

      const balanceChanges: NormalizedOverviewBalanceChange[] = [];

      const erc20Transfers = Array.isArray(tx?.erc20_transfers) ? tx.erc20_transfers : [];
      for (const transfer of erc20Transfers) {
        const direction = getSignedTransferDirection(
          transfer?.from_address,
          transfer?.to_address,
          walletAddressLower,
        );
        if (direction === 0) {
          continue;
        }

        const normalizedAmount = normalizeTransferAmount(transfer as Record<string, unknown>, 0);
        if (!Number.isFinite(normalizedAmount) || normalizedAmount === 0) {
          continue;
        }

        const mint = String(transfer?.address ?? "").trim().toLowerCase();
        if (!mint) {
          continue;
        }

        balanceChanges.push({
          mint,
          amount: normalizedAmount * direction,
          decimals: 0,
          usdDeltaHint: normalizeUsdDeltaHint(
            transfer?.value_usd ?? transfer?.usd_value,
            direction,
          ),
        });
      }

      const nativeTransfers = Array.isArray(tx?.native_transfers) ? tx.native_transfers : [];
      for (const transfer of nativeTransfers) {
        const direction = getSignedTransferDirection(
          transfer?.from_address,
          transfer?.to_address,
          walletAddressLower,
        );
        if (direction === 0) {
          continue;
        }

        const normalizedAmount = normalizeTransferAmount(transfer as Record<string, unknown>, 18);
        if (!Number.isFinite(normalizedAmount) || normalizedAmount === 0) {
          continue;
        }

        balanceChanges.push({
          mint: `native:${chain}`,
          amount: normalizedAmount * direction,
          decimals: 0,
          usdDeltaHint: normalizeUsdDeltaHint(
            transfer?.value_usd ?? transfer?.usd_value,
            direction,
          ),
        });
      }

      normalizedTransactions.push({
        signature: String(tx?.hash ?? tx?.transaction_hash ?? `${timestamp}-${normalizedTransactions.length}`),
        timestamp,
        balanceChanges,
      });
    }

    if (reachedPastRange) {
      break;
    }

    const nextCursor =
      typeof payload?.cursor === "string" && payload.cursor.length > 0
        ? payload.cursor
        : undefined;

    if (!nextCursor || seenCursors.has(nextCursor)) {
      break;
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return normalizedTransactions;
}

async function reduceActivityMetricsFromTransactions(
  transactions: NormalizedOverviewTransaction[],
): Promise<Omit<OverviewActivitySnapshot, "source">> {
  if (transactions.length === 0) {
    return {
      transactionCount24h: 0,
      tokensTradedCount: 0,
      tradingVolumeUsd24h: null,
      pnlUsdTotal: null,
      pricedChangesCount: 0,
    };
  }

  const tokenSet = new Set<string>();
  const mintsNeedingPrices = new Set<string>();

  for (const tx of transactions) {
    for (const change of tx.balanceChanges ?? []) {
      const mint = normalizeOverviewMint(change?.mint);
      if (!mint) {
        continue;
      }

      tokenSet.add(mint);

      const hasUsdHint = Number.isFinite(Number(change.usdDeltaHint));
      if (!hasUsdHint) {
        mintsNeedingPrices.add(mint);
      }
    }
  }

  const marketData =
    mintsNeedingPrices.size > 0
      ? await getTokenMarketData(Array.from(mintsNeedingPrices))
      : {};

  let volumeAcc = 0;
  let pnlAcc = 0;
  let pricedChangesCount = 0;

  for (const tx of transactions) {
    let txDeltaUsd = 0;
    let txHasPricing = false;

    for (const change of tx.balanceChanges ?? []) {
      const mint = normalizeOverviewMint(change?.mint);
      if (!mint) {
        continue;
      }

      let deltaUsd: number | null = null;
      const usdHint = Number(change.usdDeltaHint);

      if (Number.isFinite(usdHint)) {
        deltaUsd = usdHint;
      } else {
        const priceUsd = Number(marketData[mint]?.priceUsd ?? Number.NaN);
        const amountRaw = Number(change?.amount ?? 0);
        const decimals = Number(change?.decimals ?? 0);

        if (
          Number.isFinite(priceUsd) &&
          Number.isFinite(amountRaw) &&
          Number.isFinite(decimals)
        ) {
          const normalizedAmount = amountRaw / 10 ** Math.max(0, decimals);
          deltaUsd = normalizedAmount * priceUsd;
        }
      }

      if (deltaUsd == null || !Number.isFinite(deltaUsd)) {
        continue;
      }

      txDeltaUsd += deltaUsd;
      txHasPricing = true;
      pricedChangesCount += 1;
    }

    if (txHasPricing) {
      pnlAcc += txDeltaUsd;
      volumeAcc += Math.abs(txDeltaUsd);
    }
  }

  return {
    transactionCount24h: transactions.length,
    tokensTradedCount: tokenSet.size,
    tradingVolumeUsd24h: pricedChangesCount > 0 ? volumeAcc : null,
    pnlUsdTotal: pricedChangesCount > 0 ? pnlAcc : null,
    pricedChangesCount,
  };
}

function buildOverviewResponse(input: {
  address: string;
  chain: SupportedChain;
  periodSec: number;
  holdingsSnapshot: OverviewHoldingsSnapshot;
  activitySnapshot: OverviewActivitySnapshot;
}): WalletOverview {
  const {
    address,
    chain,
    periodSec,
    holdingsSnapshot,
    activitySnapshot,
  } = input;

  return {
    address,
    chain,
    totalAssetValueUsd: holdingsSnapshot.totalAssetValueUsd,
    tradingVolumeUsd24h: activitySnapshot.tradingVolumeUsd24h,
    pnlUsdTotal: activitySnapshot.pnlUsdTotal,
    transactionCount24h: activitySnapshot.transactionCount24h,
    tokensTradedCount: activitySnapshot.tokensTradedCount,
    tokensHoldingCount: holdingsSnapshot.tokensHoldingCount,
    tradingVolumeUsdWindow: activitySnapshot.tradingVolumeUsd24h,
    pnlUsdWindow: activitySnapshot.pnlUsdTotal,
    metricsPeriod: formatOverviewMetricsPeriod(periodSec),
  };
}

function normalizePortfolioText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePortfolioAddressKey(tokenAddress: string): string {
  return tokenAddress.trim().toLowerCase();
}

function normalizePortfolioLookupAddress(tokenAddress: string): string {
  const normalized = tokenAddress.trim();
  const lower = normalized.toLowerCase();

  if (
    lower === "native" ||
    lower === "sol" ||
    lower === SOL_MINT.toLowerCase() ||
    lower === SOL_SYSTEM_PROGRAM_ADDRESS.toLowerCase() ||
    lower === SOL_NATIVE_ALIAS_MINT.toLowerCase()
  ) {
    return SOL_MINT;
  }

  return normalized;
}

function shouldFillPortfolioText(value: string | undefined): boolean {
  const normalized = normalizePortfolioText(value);
  if (!normalized) {
    return true;
  }

  return PORTFOLIO_METADATA_PLACEHOLDERS.has(normalized.toLowerCase());
}

function isMissingPortfolioLogoUri(value: string | undefined): boolean {
  return normalizePortfolioText(value) == null;
}

function isValidPortfolioTokenAddress(tokenAddress: string | undefined): boolean {
  const normalized = normalizePortfolioText(tokenAddress);
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (PORTFOLIO_METADATA_PLACEHOLDERS.has(lower)) {
    return false;
  }

  return normalized.length >= 4;
}

async function enrichWalletPortfolioMetadata(
  portfolio: WalletPortfolioItem[],
  chain: SupportedChain,
  context: { address: string; source: string },
): Promise<{ portfolio: WalletPortfolioItem[]; changed: boolean }> {
  if (chain !== "solana" || portfolio.length === 0) {
    return { portfolio, changed: false };
  }

  const candidateAddressByKey = new Map<string, string>();

  for (const item of portfolio) {
    if (!isValidPortfolioTokenAddress(item.tokenAddress)) {
      continue;
    }

    const needsSymbol = shouldFillPortfolioText(item.symbol);
    const needsName = shouldFillPortfolioText(item.name);
    const needsLogoUri = isMissingPortfolioLogoUri(item.logoUri);
    if (!needsSymbol && !needsName && !needsLogoUri) {
      continue;
    }

    const rawAddress = String(item.tokenAddress).trim();
    // CoinGecko uses the WSOL mint for SOL metadata; normalize known SOL aliases.
    const lookupAddress = normalizePortfolioLookupAddress(rawAddress);
    const addressKey = normalizePortfolioAddressKey(lookupAddress);
    if (!candidateAddressByKey.has(addressKey)) {
      candidateAddressByKey.set(addressKey, lookupAddress);
    }
  }

  if (candidateAddressByKey.size === 0) {
    return { portfolio, changed: false };
  }

  type TokenMetaRow = {
    address: string;
    symbol: string;
    name: string;
    imageUrl: string | null;
  };

  let tokenMeta: TokenMetaRow[] = [];
  try {
    tokenMeta = await getTokenMeta(Array.from(candidateAddressByKey.values())) as TokenMetaRow[];
  } catch (err) {
    console.warn("[wallet-portfolio] Token metadata enrichment failed", {
      address: context.address,
      chain,
      source: context.source,
      error: err,
    });
    return { portfolio, changed: false };
  }

  if (tokenMeta.length === 0) {
    return { portfolio, changed: false };
  }

  const tokenMetaByKey = new Map<
    string,
    {
      symbol?: string;
      name?: string;
      logoUri?: string;
    }
  >();

  for (const meta of tokenMeta) {
    const address = normalizePortfolioText(meta.address);
    if (!address) {
      continue;
    }

    tokenMetaByKey.set(normalizePortfolioAddressKey(address), {
      symbol: normalizePortfolioText(meta.symbol),
      name: normalizePortfolioText(meta.name),
      logoUri: normalizePortfolioText(meta.imageUrl ?? undefined),
    });
  }

  let changed = false;
  const enrichedPortfolio = portfolio.map((item) => {
    if (!isValidPortfolioTokenAddress(item.tokenAddress)) {
      return item;
    }

    const rawAddress = String(item.tokenAddress).trim();
    const lookupAddress = normalizePortfolioLookupAddress(rawAddress);
    const meta = tokenMetaByKey.get(normalizePortfolioAddressKey(lookupAddress));
    if (!meta) {
      return item;
    }

    const shouldFillSymbol = shouldFillPortfolioText(item.symbol) && Boolean(meta.symbol);
    const shouldFillName = shouldFillPortfolioText(item.name) && Boolean(meta.name);
    const shouldFillLogo = isMissingPortfolioLogoUri(item.logoUri) && Boolean(meta.logoUri);

    if (!shouldFillSymbol && !shouldFillName && !shouldFillLogo) {
      return item;
    }

    changed = true;
    return {
      ...item,
      symbol: shouldFillSymbol ? String(meta.symbol) : item.symbol,
      name: shouldFillName ? String(meta.name) : item.name,
      logoUri: shouldFillLogo ? String(meta.logoUri) : item.logoUri,
    };
  });

  return {
    portfolio: changed ? enrichedPortfolio : portfolio,
    changed,
  };
}

export async function getWalletOverview(
  address: string,
  chain: SupportedChain,
  options?: { periodSec?: number },
): Promise<WalletOverview> {
  const effectiveChain = resolveChainForAddress(address, chain);
  const periodSec = normalizeOverviewPeriodSec(options?.periodSec);
  const nowSec = Math.floor(Date.now() / 1000);
  const requestedRange = getHistoryRange({
    fromSec: nowSec - periodSec,
    toSec: nowSec,
  });

  const cacheRow = await getLatestOverviewCacheRow(address, effectiveChain);
  const cachedOverview = getOverviewFromFreshCache(
    cacheRow,
    address,
    effectiveChain,
    periodSec,
  );
  if (cachedOverview) {
    console.log("[wallet-overview]", {
      address,
      chain: effectiveChain,
      periodSec,
      cacheHit: true,
    });
    return cachedOverview;
  }

  const holdingsSnapshot = await buildHoldingsSnapshotFromProviders(
    address,
    effectiveChain,
    cacheRow,
  );

  let activitySnapshot: OverviewActivitySnapshot;
  let activityFetchFailed = false;

  try {
    const normalizedTransactions =
      effectiveChain === "solana"
        ? await getSolanaOverviewActivityTransactions(address, effectiveChain, requestedRange)
        : await getEvmOverviewActivityTransactions(address, effectiveChain, requestedRange);

    const reducedMetrics = await reduceActivityMetricsFromTransactions(normalizedTransactions);

    activitySnapshot = {
      ...reducedMetrics,
      source: effectiveChain === "solana" ? "helius-transactions" : "moralis-history",
    };
  } catch (err) {
    activityFetchFailed = true;
    console.error("[wallet-overview] Failed to compute activity snapshot", {
      address,
      chain: effectiveChain,
      periodSec,
      error: err,
    });

    if (cacheRow && periodSec === DEFAULT_OVERVIEW_PERIOD_SEC) {
      activitySnapshot = {
        transactionCount24h: cacheRow.transactionCount24h ?? null,
        tokensTradedCount: cacheRow.tokensTradedCount ?? null,
        tradingVolumeUsd24h:
          cacheRow.tradingVolumeUsd24h != null
            ? toFiniteNumber(cacheRow.tradingVolumeUsd24h, 0)
            : null,
        pnlUsdTotal:
          cacheRow.pnlUsdTotal != null ? toFiniteNumber(cacheRow.pnlUsdTotal, 0) : null,
        pricedChangesCount: 0,
        source: "overview-cache",
      };
    } else {
      activitySnapshot = {
        transactionCount24h: null,
        tokensTradedCount: null,
        tradingVolumeUsd24h: null,
        pnlUsdTotal: null,
        pricedChangesCount: 0,
        source: "none",
      };
    }
  }

  const overview = buildOverviewResponse({
    address,
    chain: effectiveChain,
    periodSec,
    holdingsSnapshot,
    activitySnapshot,
  });

  const shouldPersistOverview = periodSec === DEFAULT_OVERVIEW_PERIOD_SEC;
  if (shouldPersistOverview) {
    await saveOverviewCache(overview);
  }

  console.log("[wallet-overview]", {
    address,
    chain: effectiveChain,
    periodSec,
    cacheHit: false,
    holdingsSource: holdingsSnapshot.source,
    activitySource: activitySnapshot.source,
    providerFailure: activityFetchFailed,
    pricedChangesCount: activitySnapshot.pricedChangesCount,
    persisted: shouldPersistOverview,
  });

  return overview;
}

export async function getWalletPortfolio(
  address: string,
  chain: SupportedChain,
): Promise<WalletPortfolioItem[]> {
  const effectiveChain = resolveChainForAddress(address, chain);

  // 0) DB-first: use cached portfolio if fresh
  const portfolioThreshold = new Date(Date.now() - WALLET_PORTFOLIO_TTL_MS);
  const cachedPortfolio = await db
    .select()
    .from(walletPortfolioCache)
    .where(
      and(
        eq(walletPortfolioCache.address, address),
        eq(walletPortfolioCache.chain, effectiveChain),
      ),
    )
    .limit(1);
  if (cachedPortfolio.length > 0 && cachedPortfolio[0].fetchedAt >= portfolioThreshold) {
    const cachedData = (cachedPortfolio[0].data as WalletPortfolioItem[]) ?? [];
    if (cachedData.length > 0) {
      const enrichedCached = await enrichWalletPortfolioMetadata(cachedData, effectiveChain, {
        address,
        source: "cache-hit",
      });

      if (enrichedCached.changed) {
        await db
          .insert(walletPortfolioCache)
          .values({ address, chain: effectiveChain, data: enrichedCached.portfolio })
          .onConflictDoUpdate({
            target: [walletPortfolioCache.address, walletPortfolioCache.chain],
            set: { data: enrichedCached.portfolio, fetchedAt: new Date() },
          });
      }

      return enrichedCached.portfolio;
    }
    // If cached portfolio is empty (likely from an earlier failed API call),
    // fall through to external fetch instead of treating it as valid.
  }

  // 1) For Solana: use Helius directly because it provides native portfolio metadata.
  if (effectiveChain === "solana") {
    let heliusPortfolio: WalletPortfolioItem[] = [];
    try {
      heliusPortfolio = await fetchHeliusSolanaPortfolio(address);
    } catch (err) {
      console.error("Failed to fetch Solana portfolio from Helius", err);
    }

    if (heliusPortfolio.length > 0) {
      const enrichedPortfolio = await enrichWalletPortfolioMetadata(heliusPortfolio, effectiveChain, {
        address,
        source: "helius",
      });

      await db
        .insert(walletPortfolioCache)
        .values({ address, chain: effectiveChain, data: enrichedPortfolio.portfolio })
        .onConflictDoUpdate({
          target: [walletPortfolioCache.address, walletPortfolioCache.chain],
          set: { data: enrichedPortfolio.portfolio, fetchedAt: new Date() },
        });
      return enrichedPortfolio.portfolio;
    }
    // Helius returned nothing; return empty portfolio for Solana.
    return [];
  }

  const endpoint = moralis.getEndpoint(`/wallets/${address}/tokens`);
  const searchParams = new URLSearchParams();
  if (effectiveChain) {
    searchParams.set("chain", effectiveChain);
  }
  searchParams.set("limit", "100");
  endpoint.search = searchParams.toString();

  let result: any[] = [];

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: moralis.getRequiredHeaders(),
    });

    if (!resp.ok) {
      console.error("Moralis wallets/tokens error", resp.status, resp.statusText);
    } else {
      const data = await resp.json();
      result = Array.isArray(data?.result) ? data.result : [];
    }
  } catch (err) {
    console.error("Moralis wallets/tokens request failed", err);
  }

  const portfolio: WalletPortfolioItem[] = result.map((t: any) => {
    const decimals = Number(t.decimals ?? 0);
    let amount: number;
    if (t.balance_formatted != null && t.balance_formatted !== "") {
      amount = Number(t.balance_formatted);
    } else {
      const rawBalance = BigInt(t.balance ?? "0");
      amount = Number(rawBalance) / 10 ** decimals;
    }
    const priceUsd = t.usd_price != null ? Number(t.usd_price) : undefined;
    const valueUsd = t.usd_value != null ? Number(t.usd_value) : 0;
    const change24hPercent =
      t.usd_price_24hr_percent_change != null
        ? Number(t.usd_price_24hr_percent_change)
        : undefined;

    return {
      tokenAddress: String(t.token_address ?? ""),
      symbol: String(t.symbol ?? ""),
      name: t.name ? String(t.name) : undefined,
      amount,
      priceUsd,
      valueUsd,
      change24hPercent,
    };
  });
  const enrichedPortfolio = await enrichWalletPortfolioMetadata(portfolio, effectiveChain, {
    address,
    source: "moralis",
  });

  await db
    .insert(walletPortfolioCache)
    .values({ address, chain: effectiveChain, data: enrichedPortfolio.portfolio })
    .onConflictDoUpdate({
      target: [walletPortfolioCache.address, walletPortfolioCache.chain],
      set: { data: enrichedPortfolio.portfolio, fetchedAt: new Date() },
    });
  return enrichedPortfolio.portfolio;
}

export async function getWalletTransactions(
  address: string,
  chain: SupportedChain,
  options?: { limit?: number; cursor?: string; before?: string },
): Promise<WalletTransactionsResponse> {
  const effectiveChain = resolveChainForAddress(address, chain);
  const limit = Math.min(options?.limit ?? 100, 500);

  await normalizeWalletCacheChainsOnce();

  const cachedTransactions = await getCachedWalletTransactions(
    address,
    effectiveChain,
    limit,
  );
  if (cachedTransactions) {
    if (effectiveChain === "solana") {
      await enrichWithSolanaTokenPrices(cachedTransactions);
    }
    return { address, chain: effectiveChain, transactions: cachedTransactions };
  }
  if (effectiveChain === "solana") {
    // Use Helius to retrieve detailed token transfer history for Solana.
    const transactions = await fetchHeliusSolanaTransactions(address, limit);
    await enrichWithSolanaTokenPrices(transactions);
    await saveTransactionsCache(address, effectiveChain, transactions);
    return {
      address,
      chain: effectiveChain,
      transactions,
    };
  }

  // EVM chains – Moralis wallet history (max limit 100 on free tier)
  const moralisLimit = Math.min(limit, 100);
  const endpoint = moralis.getEndpoint(`/wallets/${address}/history`);
  const params = new URLSearchParams();
  if (effectiveChain) {
    params.set("chain", effectiveChain);
  }
  params.set("order", "DESC");
  params.set("limit", String(moralisLimit));
  if (options?.cursor) {
    params.set("cursor", options.cursor);
  }
  endpoint.search = params.toString();

  let result: any[] = [];

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: moralis.getRequiredHeaders(),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(
        "Moralis wallet history error",
        resp.status,
        resp.statusText,
        errBody.slice(0, 300),
      );
    } else {
      const payload = await resp.json();
      result = Array.isArray(payload?.result) ? (payload.result as any[]) : [];
    }
  } catch (err) {
    console.error("Moralis wallet history request failed", err);
  }

  const tokenAddresses = new Set<string>();
  const transactionsWithTokens: Array<{
    tx: WalletTransaction;
    tokenAddress: string | null;
  }> = [];

  for (const tx of result) {
    const erc20Transfers = Array.isArray(tx.erc20_transfers)
      ? (tx.erc20_transfers as any[])
      : [];
    const nativeTransfers = Array.isArray(tx.native_transfers)
      ? (tx.native_transfers as any[])
      : [];

    const tokenSymbols = new Set<string>();
    for (const tr of erc20Transfers) {
      const sym = tr.token_symbol ?? tr.token_name;
      if (sym) tokenSymbols.add(String(sym));
      if (tr.address) tokenAddresses.add(String(tr.address));
    }
    for (const tr of nativeTransfers) {
      const sym = tr.token_symbol;
      if (sym) tokenSymbols.add(String(sym));
    }

    const primaryErc20 = erc20Transfers[0];
    const primaryNative = nativeTransfers[0];

    let primaryTokenSymbol: string | undefined;
    let primaryTokenAmount: number | undefined;
    let primaryTokenAddress: string | null = null;

    if (primaryErc20) {
      if (primaryErc20.value_formatted !== undefined) {
        primaryTokenAmount = Number(primaryErc20.value_formatted);
      } else {
        const decimals = Number(primaryErc20.token_decimals ?? 0);
        const raw = BigInt(primaryErc20.value ?? "0");
        primaryTokenAmount = Number(raw) / 10 ** decimals;
      }
      primaryTokenSymbol = String(
        primaryErc20.token_symbol ?? primaryErc20.token_name ?? "",
      );
      primaryTokenAddress = primaryErc20.address
        ? String(primaryErc20.address)
        : null;
    } else if (primaryNative) {
      if (primaryNative.value_formatted !== undefined) {
        primaryTokenAmount = Number(primaryNative.value_formatted);
      } else {
        const raw = BigInt(primaryNative.value ?? "0");
        primaryTokenAmount = Number(raw) / 10 ** 18;
      }
      primaryTokenSymbol = String(primaryNative.token_symbol ?? "ETH");
      primaryTokenAddress = null;
    }

    const txObj: WalletTransaction = {
      hash: String(tx.hash),
      timestamp: toIsoTimestamp(tx.block_timestamp),
      from: String(tx.from_address),
      to: String(tx.to_address),
      status:
        tx.receipt_status === "1"
          ? true
          : tx.receipt_status === "0"
            ? false
            : null,
      fee:
        typeof tx.gas === "string" && typeof tx.gas_price === "string"
          ? Number(tx.gas) * Number(tx.gas_price)
          : undefined,
      mainAction: tx.category ? String(tx.category) : undefined,
      direction:
        tx.from_address === address && tx.to_address === address
          ? "self"
          : tx.to_address === address
            ? "in"
            : tx.from_address === address
              ? "out"
              : "unknown",
      tokens: Array.from(tokenSymbols),
      primaryTokenSymbol,
      primaryTokenAmount,
      primaryTokenAddress: primaryTokenAddress ?? undefined,
    };

    transactionsWithTokens.push({ tx: txObj, tokenAddress: primaryTokenAddress });
  }

  const priceMap = new Map<string, number>();
  const pricePromises = Array.from(tokenAddresses)
    .slice(0, 50)
    .map(async (tokenAddr) => {
      try {
        const priceEndpoint = moralis.getEndpoint(`/erc20/${tokenAddr}/price`);
        const priceParams = new URLSearchParams();
        if (effectiveChain) {
          priceParams.set("chain", effectiveChain);
        }
        priceEndpoint.search = priceParams.toString();

        const priceResp = await fetch(priceEndpoint, {
          method: "GET",
          headers: moralis.getRequiredHeaders(),
        });

        if (priceResp.ok) {
          const priceData = await priceResp.json();
          const usdPrice = priceData?.usdPrice ?? priceData?.usd_price;
          if (typeof usdPrice === "number") {
            priceMap.set(tokenAddr, usdPrice);
          }
        }
      } catch {
        // Ignore individual token price failures.
      }
    });

  await Promise.all(pricePromises);

  let ethPrice: number | undefined;
  if (effectiveChain === "eth") {
    try {
      const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
      const ethPriceEndpoint = moralis.getEndpoint(`/erc20/${wethAddress}/price`);
      const ethPriceParams = new URLSearchParams();
      ethPriceParams.set("chain", effectiveChain);
      ethPriceEndpoint.search = ethPriceParams.toString();

      const ethPriceResp = await fetch(ethPriceEndpoint, {
        method: "GET",
        headers: moralis.getRequiredHeaders(),
      });

      if (ethPriceResp.ok) {
        const ethPriceData = await ethPriceResp.json();
        ethPrice = ethPriceData?.usdPrice ?? ethPriceData?.usd_price;
      }
    } catch {
      // Ignore ETH price fetch errors.
    }
  }

  const transactions: WalletTransaction[] = transactionsWithTokens.map(
    ({ tx, tokenAddress }) => {
      let priceUsd: number | undefined;
      let totalUsd: number | undefined;

      if (tokenAddress && priceMap.has(tokenAddress)) {
        priceUsd = priceMap.get(tokenAddress);
        if (priceUsd !== undefined && tx.primaryTokenAmount !== undefined) {
          totalUsd = priceUsd * tx.primaryTokenAmount;
        }
      } else if (
        !tokenAddress &&
        tx.primaryTokenSymbol === "ETH" &&
        ethPrice !== undefined
      ) {
        priceUsd = ethPrice;
        if (tx.primaryTokenAmount !== undefined) {
          totalUsd = ethPrice * tx.primaryTokenAmount;
        }
      }

      return {
        ...tx,
        priceUsd,
        totalUsd,
      };
    },
  );

  await saveTransactionsCache(address, effectiveChain, transactions);
  return {
    address,
    chain: effectiveChain,
    transactions,
  };
}

export async function getWalletTransactionHelius(
  address: string,
  chain: SupportedChain,
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d"; fromSec?: number; toSec?: number },
): Promise<{ address: string; chain: SupportedChain; transactions: WalletTransactionHelius[] }> {
  const effectiveChain = resolveChainForAddress(address, chain);

  if (effectiveChain !== "solana") {
    return { address, chain: effectiveChain, transactions: [] };
  }

  await normalizeWalletCacheChainsOnce();

  const requestedRange = getHistoryRange(options);
  const cacheRangeResult = await getCachedWalletTransactionsHelius(
    address,
    effectiveChain,
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
        fetchedTransactions = await fetchAllTransactionHistory(address, requestedRange);
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
          fetchedTransactions = await fetchAllTransactionHistory(address, requestedRange);
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
      effectiveChain,
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
    chain: effectiveChain,
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
    chain: effectiveChain,
    transactions: mergedTransactions,
  };
}



export async function getWalletTransfers(
  address: string,
  chain: SupportedChain,
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d" },
): Promise<WalletTransfersResponse> {
  const effectiveChain = resolveChainForAddress(address, chain);
  const limit = Math.min(options?.limit ?? 100, 500);

  await normalizeWalletCacheChainsOnce();

  const cachedTransfers = await getCachedWalletTransfers(
    address,
    effectiveChain,
    options?.from ?? "7d",
  );
  if (cachedTransfers) {
    if (effectiveChain === "solana") {
      await enrichWithSolanaTokenPrices(cachedTransfers);
    }
    return { address, chain: effectiveChain, transfers: cachedTransfers };
  }

  if (effectiveChain === "solana") {
    // Use Helius to retrieve token transfers for Solana
    try {
      const transfers = await fetchHeliusSolanaTransfers(address, options?.from ?? "7d");

      console.log(
        `[getWalletTransfers] Successfully fetched ${transfers.length} transfers from Helius for ${address}`
      );

      // Save to cache for future retrieval
      await saveTransfersCache(address, effectiveChain, transfers);

      return {
        address,
        chain: effectiveChain,
        transfers,
      };
    } catch (err) {
      console.error("[getWalletTransfers] Failed to fetch Solana transfers from Helius", err);
      // Return empty transfers on error instead of throwing
      return {
        address,
        chain: effectiveChain,
        transfers: [],
      };
    }
  }

  // EVM chains – Moralis doesn't have a direct transfers endpoint
  // We can extract transfers from transaction history as a fallback
  console.log(
    `[getWalletTransfers] EVM chain ${effectiveChain}: Moralis doesn't provide dedicated transfers endpoint. Returning empty.`
  );

  return {
    address,
    chain: effectiveChain,
    transfers: [],
  };
}

export async function getWalletSwaps(
  address: string,
  chain: SupportedChain,
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d" },
): Promise<{ address: string; chain: SupportedChain; swaps: WalletSwap[] }> {
  const effectiveChain = resolveChainForAddress(address, chain);
  const limit = Math.min(options?.limit ?? 100, 500);

  await normalizeWalletCacheChainsOnce();

  const cachedSwaps = await getCachedWalletSwaps(address, effectiveChain, options?.from ?? "7d");
  if (cachedSwaps) {
    if (effectiveChain === "solana") {
      await enrichWithSolanaTokenPrices(cachedSwaps);
    }
    return { address, chain: effectiveChain, swaps: cachedSwaps };
  }



  // Only Solana supports swap detection via Helius
  if (effectiveChain !== "solana") {
    console.log(
      `[getWalletSwaps] Chain ${effectiveChain} not supported. Swaps only available for Solana.`
    );
    return {
      address,
      chain: effectiveChain,
      swaps: [],
    };
  }

  try {
    // Use Helius to retrieve swap history for Solana
    const swaps = await fetchHeliusSolanaSwap(address, options?.from ?? "7d");

    console.log(
      `[getWalletSwaps] Successfully fetched ${swaps.length} swaps from Helius for ${address}`
    );

    // Save to cache for future retrieval
    await saveSwapsCache(address, effectiveChain, swaps);

    return {
      address,
      chain: effectiveChain,
      swaps,
    };
  } catch (err) {
    console.error("[getWalletSwaps] Failed to fetch Solana swaps from Helius", err);
    // Return empty swaps on error instead of throwing
    return {
      address,
      chain: effectiveChain,
      swaps: [],
    };
  }
}

/** Normalize platform label (e.g. "Binance 1" -> "Binance"). */
function normalizePlatformName(label: string): string {
  return label.replace(/\s+\d+$/, "").trim() || "Unknown";
}

/**
 * Get transaction counts by platform (exchange) for a wallet using Moralis Wallet History.
 * Uses from_address_entity/label and to_address_entity/label to attribute each tx to a platform.
 * Only supported for EVM chains (Moralis); returns empty exchanges for Solana.
 */
export async function getWalletExchangeCounts(
  address: string,
  chain: SupportedChain,
  options?: { limit?: number }
): Promise<WalletExchangeCountsResponse> {
  const effectiveChain = resolveChainForAddress(address, chain);

  if (effectiveChain === "solana") {
    return { exchanges: [], metadata: { period: "30D", metric: "count" } };
  }

  // 0) DB-first: use cached exchange counts if fresh
  const exchangeThreshold = new Date(Date.now() - WALLET_EXCHANGE_COUNTS_TTL_MS);
  const cached = await db
    .select()
    .from(walletExchangeCountsCache)
    .where(
      and(
        eq(walletExchangeCountsCache.address, address),
        eq(walletExchangeCountsCache.chain, effectiveChain),
      ),
    )
    .limit(1);
  if (cached.length > 0 && cached[0].fetchedAt >= exchangeThreshold) {
    return cached[0].data as WalletExchangeCountsResponse;
  }

  // Moralis free tier max limit is 100
  const moralisLimit = Math.min(options?.limit ?? 100, 100);
  const endpoint = moralis.getEndpoint(`/wallets/${address}/history`);
  const params = new URLSearchParams();
  params.set("chain", effectiveChain);
  params.set("order", "DESC");
  params.set("limit", String(moralisLimit));
  endpoint.search = params.toString();

  let result: any[] = [];

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: moralis.getRequiredHeaders(),
    });
    if (resp.ok) {
      const payload = await resp.json();
      result = Array.isArray(payload?.result) ? (payload.result as any[]) : [];
    } else {
      const errBody = await resp.text();
      console.error("[WalletExchangeCounts] Moralis error", resp.status, resp.statusText, errBody.slice(0, 300));
    }
  } catch (err) {
    console.error("Moralis wallet history request failed (exchange counts)", err);
    return { exchanges: [], metadata: { period: "30D", metric: "count" } };
  }

  // Debug: see whether we got any txs and if they have entity/label (Wallet History may use different shape than native tx API)
  if (result.length > 0) {
    const first = result[0] as Record<string, unknown>;
    const hasEntityOrLabel =
      [first?.from_address_entity, first?.from_address_label, first?.to_address_entity, first?.to_address_label].some(
        (v) => v != null && String(v).trim() !== ""
      );
    console.log(
      `[WalletExchangeCounts] chain=${effectiveChain} transactions=${result.length} firstTxHasEntityOrLabel=${hasEntityOrLabel}`
    );
  } else {
    console.log(`[WalletExchangeCounts] chain=${effectiveChain} transactions=0 (Moralis returned empty or request failed)`);
  }

  const byPlatform = new Map<
    string,
    { deposits: number; withdrawals: number; depositsVolume: number; withdrawalsVolume: number }
  >();

  for (const tx of result) {
    const fromAddr = String(tx.from_address ?? "").toLowerCase();
    const toAddr = String(tx.to_address ?? "").toLowerCase();
    const wallet = address.toLowerCase();
    const isIn = toAddr === wallet;

    const entityFrom = tx.from_address_entity ? String(tx.from_address_entity).trim() : "";
    const labelFrom = tx.from_address_label ? String(tx.from_address_label).trim() : "";
    const entityTo = tx.to_address_entity ? String(tx.to_address_entity).trim() : "";
    const labelTo = tx.to_address_label ? String(tx.to_address_label).trim() : "";

    const counterpartyName = isIn ? (entityTo || labelTo || "Unknown") : (entityFrom || labelFrom || "Unknown");
    const platform = normalizePlatformName(counterpartyName);

    const cur = byPlatform.get(platform) ?? {
      deposits: 0,
      withdrawals: 0,
      depositsVolume: 0,
      withdrawalsVolume: 0,
    };
    if (isIn) {
      cur.deposits += 1;
    } else {
      cur.withdrawals += 1;
    }
    byPlatform.set(platform, cur);
  }

  const exchanges: WalletExchangeCountItem[] = Array.from(byPlatform.entries())
    .map(([name, counts]) => ({
      name,
      deposits: counts.deposits,
      withdrawals: counts.withdrawals,
      depositsVolume: counts.depositsVolume,
      withdrawalsVolume: counts.withdrawalsVolume,
    }))
    .sort((a, b) => b.deposits + b.withdrawals - (a.deposits + a.withdrawals));

  const response: WalletExchangeCountsResponse = {
    exchanges,
    metadata: { period: "30D", metric: "count" },
  };
  try {
    await db
      .insert(walletExchangeCountsCache)
      .values({ address, chain: effectiveChain, data: response })
      .onConflictDoUpdate({
        target: [walletExchangeCountsCache.address, walletExchangeCountsCache.chain],
        set: { data: response, fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet exchange counts cache", err);
  }
  return response;
}

/**
 * Historical Balance Data Point
 */
export interface BalanceDataPoint {
  timestamp: number;
  value: number;
  date: string;
}

export interface PnLDataPoint {
  timestamp: number;
  value: number;
}

export type PnLAggregation = "daily" | "weekly" | "monthly";

export interface WalletCumulativePnLResult {
  dailyPnL: PnLDataPoint[];
  cumulativePnL: PnLDataPoint[];
  startBalance: number;
  endBalance: number;
  realizedPnL?: number;
}

type PriceTimelinePoint = {
  timestampMs: number;
  price: number;
};

const MAX_PNL_SNAPSHOT_POINTS = 1500;

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

function getRangeStartMs(
  nowMs: number,
  timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All",
): number {
  if (timePeriod === "All") {
    return 0;
  }

  const dayCountByPeriod: Record<"7D" | "30D" | "60D" | "90D" | "1Y", number> = {
    "7D": 7,
    "30D": 30,
    "60D": 60,
    "90D": 90,
    "1Y": 365,
  };

  return nowMs - dayCountByPeriod[timePeriod] * DAY_MS;
}

function getAggregationIntervalMs(aggregation: PnLAggregation): number {
  if (aggregation === "weekly") {
    return 7 * DAY_MS;
  }
  if (aggregation === "monthly") {
    return 30 * DAY_MS;
  }
  return DAY_MS;
}

function normalizeMint(mint: unknown): string {
  const raw = String(mint ?? "").trim();
  if (!raw) {
    return "";
  }

  const rawLower = raw.toLowerCase();

  if (
    raw.toUpperCase() === "SOL" ||
    raw === SOL_SYSTEM_PROGRAM_ADDRESS ||
    rawLower === SOL_MINT.toLowerCase() ||
    rawLower === SOL_NATIVE_ALIAS_MINT.toLowerCase()
  ) {
    return SOL_MINT;
  }

  return raw;
}

function isSolSymbol(symbol: unknown): boolean {
  return String(symbol ?? "").trim().toUpperCase() === "SOL";
}

function parseTimestampMs(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? 0 : ms;
}

function normalizeBalanceDelta(
  change: { amount: number; decimals: number },
): number {
  const amountRaw = Number(change.amount);
  const decimals = Number(change.decimals);
  if (!Number.isFinite(amountRaw) || !Number.isFinite(decimals)) {
    return 0;
  }

  return amountRaw / 10 ** Math.max(0, decimals);
}

function buildSnapshotTimestamps(
  startMs: number,
  endMs: number,
  intervalMs: number,
): number[] {
  if (endMs <= startMs) {
    return [endMs];
  }

  const totalRangeMs = endMs - startMs;
  const expectedPointCount = Math.floor(totalRangeMs / intervalMs) + 1;
  const effectiveIntervalMs =
    expectedPointCount > MAX_PNL_SNAPSHOT_POINTS
      ? Math.max(intervalMs, Math.ceil(totalRangeMs / (MAX_PNL_SNAPSHOT_POINTS - 1)))
      : intervalMs;

  const points: number[] = [];
  for (let ts = startMs; ts <= endMs; ts += effectiveIntervalMs) {
    points.push(ts);
  }

  if (points.length === 0 || points[points.length - 1] !== endMs) {
    points.push(endMs);
  }

  return points;
}

function normalizePriceTimeline(
  rows: Array<{ unixTimestampMs: number; price: unknown }>,
): PriceTimelinePoint[] {
  return rows
    .map((row) => ({
      timestampMs: Number(row.unixTimestampMs),
      price: Number(row.price),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestampMs) &&
        Number.isFinite(point.price) &&
        point.price > 0,
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function findPriceAtOrBefore(
  timeline: PriceTimelinePoint[],
  timestampMs: number,
): number | null {
  if (timeline.length === 0) {
    return null;
  }

  let left = 0;
  let right = timeline.length - 1;
  let foundIndex = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const point = timeline[mid];

    if (point.timestampMs <= timestampMs) {
      foundIndex = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (foundIndex >= 0) {
    return timeline[foundIndex].price;
  }

  return null;
}

function toCurrentPriceFallback(
  marketData: Record<string, { priceUsd?: number | string }>,
): Record<string, number> {
  const fallback: Record<string, number> = {};
  for (const [tokenAddress, entry] of Object.entries(marketData)) {
    const value = Number(entry?.priceUsd ?? Number.NaN);
    if (Number.isFinite(value) && value > 0) {
      fallback[tokenAddress] = value;
    }
  }
  return fallback;
}

function calculatePortfolioValueUsd(
  balances: Map<string, number>,
  timelinesByToken: Map<string, PriceTimelinePoint[]>,
  currentPriceFallback: Record<string, number>,
  timestampMs: number,
): number {
  let totalValueUsd = 0;

  for (const [tokenAddress, rawBalance] of balances.entries()) {
    const normalizedBalance = Number(rawBalance);
    if (!Number.isFinite(normalizedBalance) || normalizedBalance <= 0) {
      continue;
    }

    const timeline = timelinesByToken.get(tokenAddress) ?? [];
    const historicalPrice = findPriceAtOrBefore(timeline, timestampMs);
    const priceUsd = historicalPrice ?? currentPriceFallback[tokenAddress] ?? 0;

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      continue;
    }

    totalValueUsd += normalizedBalance * priceUsd;
  }

  return totalValueUsd;
}

async function getHistoricalPortfolioValueSeries(
  address: string,
  chain: SupportedChain,
  startMs: number,
  endMs: number,
  intervalMs: number,
): Promise<PnLDataPoint[]> {
  const snapshots = buildSnapshotTimestamps(startMs, endMs, intervalMs);
  const requestedFromSec = Math.floor(startMs / 1000);
  const requestedToSec = Math.floor(endMs / 1000);

  const [portfolio, txResponse] = await Promise.all([
    getWalletPortfolio(address, chain),
    getWalletTransactionHelius(address, chain, {
      fromSec: requestedFromSec,
      toSec: requestedToSec,
    }),
  ]);

  const balances = new Map<string, number>();
  const tokenAddresses = new Set<string>();

  for (const item of portfolio) {
    const tokenAddress = normalizeMint(item.tokenAddress);
    if (!tokenAddress) {
      continue;
    }

    const amount = Number(item.amount ?? 0);
    if (!Number.isFinite(amount)) {
      continue;
    }

    const nextAmount = (balances.get(tokenAddress) ?? 0) + amount;
    if (Math.abs(nextAmount) < 1e-12) {
      balances.delete(tokenAddress);
    } else {
      balances.set(tokenAddress, nextAmount);
    }
    tokenAddresses.add(tokenAddress);
  }

  const transactions = txResponse.transactions
    .filter((tx) => {
      const timestampMs = parseTimestampMs(tx.timestamp);
      return timestampMs >= startMs && timestampMs <= endMs;
    })
    .sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));

  for (const tx of transactions) {
    for (const change of tx.balanceChanges ?? []) {
      const tokenAddress = normalizeMint(change?.mint);
      if (!tokenAddress) {
        continue;
      }
      tokenAddresses.add(tokenAddress);
    }
  }

  if (tokenAddresses.size === 0) {
    return snapshots.map((timestamp) => ({
      timestamp,
      value: 0,
    }));
  }

  const tokenAddressList = Array.from(tokenAddresses);
  const daysSpan = Math.max(
    1,
    Math.min(365, Math.ceil((endMs - startMs) / DAY_MS) + 2),
  );
  const useHourlyChart = daysSpan <= 90;

  const [currentMarketData, priceTimelineEntries] = await Promise.all([
    getTokenMarketData(tokenAddressList),
    Promise.all(
      tokenAddressList.map(async (tokenAddress) => {
        const chartRows = useHourlyChart
          ? await getHourlyTokenMarketChart(tokenAddress, daysSpan)
          : await getDailyTokenMarketChart(tokenAddress, daysSpan);

        const timeline = normalizePriceTimeline(
          chartRows.map((row) => ({
            unixTimestampMs: row.unixTimestampMs,
            price: row.price,
          })),
        );

        return [tokenAddress, timeline] as const;
      }),
    ),
  ]);

  const timelinesByToken = new Map<string, PriceTimelinePoint[]>(
    priceTimelineEntries,
  );
  const currentPriceFallback = toCurrentPriceFallback(currentMarketData);

  const snapshotsDescending = [...snapshots].sort((a, b) => b - a);
  const portfolioValuesDescending: PnLDataPoint[] = [];
  let txIndex = 0;

  for (const snapshotMs of snapshotsDescending) {
    while (txIndex < transactions.length) {
      const tx = transactions[txIndex];
      const txTimestampMs = parseTimestampMs(tx.timestamp);
      if (txTimestampMs <= snapshotMs) {
        break;
      }

      for (const change of tx.balanceChanges ?? []) {
        const tokenAddress = normalizeMint(change?.mint);
        if (!tokenAddress) {
          continue;
        }

        const balanceDelta = normalizeBalanceDelta({
          amount: Number(change?.amount ?? 0),
          decimals: Number(change?.decimals ?? 0),
        });

        if (!Number.isFinite(balanceDelta) || balanceDelta === 0) {
          continue;
        }

        const previousAmount = (balances.get(tokenAddress) ?? 0) - balanceDelta;
        if (Math.abs(previousAmount) < 1e-12) {
          balances.delete(tokenAddress);
        } else {
          balances.set(tokenAddress, previousAmount);
        }
      }

      txIndex += 1;
    }

    const portfolioValueUsd = calculatePortfolioValueUsd(
      balances,
      timelinesByToken,
      currentPriceFallback,
      snapshotMs,
    );

    portfolioValuesDescending.push({
      timestamp: snapshotMs,
      value: roundUsd(Math.max(0, portfolioValueUsd)),
    });
  }

  return portfolioValuesDescending.reverse();
}

/**
 * Get historical wallet balance by reconstructing from current state and transaction history
 * 
 * @param address - Wallet address
 * @param chain - Blockchain (solana, eth, etc.)
 * @param timePeriod - Time period for historical data
 * @returns Array of balance data points over time
 */
export async function getWalletBalanceHistory(
  address: string,
  chain: SupportedChain,
  timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All" = "30D"
): Promise<BalanceDataPoint[]> {
  const effectiveChain = resolveChainForAddress(address, chain);
  const nowMs = Date.now();
  const startMs = getRangeStartMs(nowMs, timePeriod);
  const now = new Date(nowMs);
  const startDate = new Date(startMs);

  if (effectiveChain !== "solana") {
    const currentPortfolio = await getWalletPortfolio(address, effectiveChain);
    const currentTotalValue = currentPortfolio.reduce(
      (sum, item) => sum + (item.valueUsd ?? 0),
      0,
    );

    return [
      {
        timestamp: startMs,
        value: Math.max(0, currentTotalValue),
        date: startDate.toISOString(),
      },
      {
        timestamp: nowMs,
        value: Math.max(0, currentTotalValue),
        date: now.toISOString(),
      },
    ];
  }

  try {
    const portfolioValues = await getHistoricalPortfolioValueSeries(
      address,
      effectiveChain,
      startMs,
      nowMs,
      DAY_MS,
    );

    return portfolioValues.map((point) => ({
      timestamp: point.timestamp,
      value: point.value,
      date: new Date(point.timestamp).toISOString(),
    }));
  } catch (error) {
    console.error("[WalletBalanceHistory] Error fetching balance history:", error);

    // Fallback: return current balance as flat line
    const currentPortfolio = await getWalletPortfolio(address, effectiveChain);
    const currentTotalValue = currentPortfolio.reduce(
      (sum, item) => sum + (item.valueUsd ?? 0),
      0,
    );

    return [
      {
        timestamp: startMs,
        value: Math.max(0, currentTotalValue),
        date: startDate.toISOString(),
      },
      {
        timestamp: nowMs,
        value: Math.max(0, currentTotalValue),
        date: now.toISOString(),
      },
    ];
  }
}

/**
 * Get cumulative wallet PnL using transaction-derived balance snapshots
 * and historical token prices from cached token chart services.
 */
export async function getCumulativePnL(
  address: string,
  chain: SupportedChain,
  timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All" = "30D",
  aggregation: PnLAggregation = "daily",
): Promise<WalletCumulativePnLResult> {
  const effectiveChain = resolveChainForAddress(address, chain);
  const nowMs = Date.now();
  const startMs = getRangeStartMs(nowMs, timePeriod);
  const intervalMs = getAggregationIntervalMs(aggregation);
  const snapshots = buildSnapshotTimestamps(startMs, nowMs, intervalMs);

  const zeroSeries: PnLDataPoint[] = snapshots.map((timestamp) => ({
    timestamp,
    value: 0,
  }));

  if (effectiveChain !== "solana") {
    return {
      dailyPnL: zeroSeries,
      cumulativePnL: zeroSeries,
      startBalance: 0,
      endBalance: 0,
    };
  }

  try {
    const portfolioValues = await getHistoricalPortfolioValueSeries(
      address,
      effectiveChain,
      startMs,
      nowMs,
      intervalMs,
    );
    const startingValue = portfolioValues[0]?.value ?? 0;

    let previousValue = startingValue;
    const dailyPnL = portfolioValues.map((point, index) => {
      const periodDelta = index === 0 ? 0 : point.value - previousValue;
      previousValue = point.value;
      return {
        timestamp: point.timestamp,
        value: roundUsd(periodDelta),
      };
    });

    const cumulativePnL = portfolioValues.map((point) => ({
      timestamp: point.timestamp,
      value: roundUsd(point.value - startingValue),
    }));

    return {
      dailyPnL,
      cumulativePnL,
      startBalance: roundUsd(startingValue),
      endBalance: roundUsd(portfolioValues[portfolioValues.length - 1]?.value ?? 0),
    };
  } catch (error) {
    console.error("[WalletCumulativePnL] Error computing cumulative PnL:", error);
    return {
      dailyPnL: zeroSeries,
      cumulativePnL: zeroSeries,
      startBalance: 0,
      endBalance: 0,
    };
  }
}

export interface TokenBalanceSeriesResult {
  tokenSeries: BalanceDataPoint[];
  usdSeries: BalanceDataPoint[];
  tokenSymbol: string;
  tokenAddress: string;
}

export async function getWalletTokenBalanceHistory(
  address: string,
  chain: SupportedChain,
  tokenSelector: string,
  timePeriod: "7D" | "30D" | "60D" | "90D" | "1Y" | "All" = "30D"
): Promise<TokenBalanceSeriesResult> {
  const effectiveChain = resolveChainForAddress(address, chain);

  const now = new Date();
  let startDate = new Date(now);
  switch (timePeriod) {
    case "7D": startDate.setDate(now.getDate() - 7); break;
    case "30D": startDate.setDate(now.getDate() - 30); break;
    case "60D": startDate.setDate(now.getDate() - 60); break;
    case "90D": startDate.setDate(now.getDate() - 90); break;
    case "1Y": startDate.setFullYear(now.getFullYear() - 1); break;
    case "All": startDate = new Date(0); break;
  }

  const flatZero = (): TokenBalanceSeriesResult => ({
    tokenSeries: [
      { timestamp: startDate.getTime(), value: 0, date: startDate.toISOString() },
      { timestamp: now.getTime(), value: 0, date: now.toISOString() },
    ],
    usdSeries: [
      { timestamp: startDate.getTime(), value: 0, date: startDate.toISOString() },
      { timestamp: now.getTime(), value: 0, date: now.toISOString() },
    ],
    tokenSymbol: tokenSelector,
    tokenAddress: "",
  });

  try {
    const portfolio = await getWalletPortfolio(address, effectiveChain);

    const selectorLower = tokenSelector.trim().toLowerCase();
    const resolvedItem = portfolio.find(
      (item) =>
        item.tokenAddress.toLowerCase() === selectorLower ||
        item.symbol.toLowerCase() === selectorLower ||
        (selectorLower === "sol" && item.tokenAddress === SOL_MINT)
    );

    if (!resolvedItem) {
      return flatZero();
    }

    const resolvedMint =
      isSolSymbol(resolvedItem.symbol) || selectorLower === "sol"
        ? SOL_MINT
        : normalizeMint(resolvedItem.tokenAddress);
    if (!resolvedMint) {
      return flatZero();
    }

    const resolvedSymbol = resolvedItem.symbol || tokenSelector;
    const currentTokenBalance = resolvedItem.amount ?? 0;
    const requestedFromSec = timePeriodToFromSec(timePeriod);

    const txResponse = await getWalletTransactionHelius(address, effectiveChain, {
      fromSec: requestedFromSec,
    });
    const transactions = txResponse.transactions;

    const relevantTxs = transactions
      .filter((tx) => {
        const txDate = new Date(tx.timestamp);
        return txDate >= startDate && txDate <= now;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const marketData = await getTokenMarketData([resolvedMint]);
    const currentPriceRaw = Number(marketData[resolvedMint]?.priceUsd ?? Number.NaN);
    const currentPrice = Number.isFinite(currentPriceRaw) && currentPriceRaw > 0
      ? currentPriceRaw
      : 0;

    const daysSpan = Math.max(
      1,
      Math.min(3650, Math.ceil((now.getTime() - startDate.getTime()) / DAY_MS) + 2),
    );

    let historicalPriceTimeline: Array<{ timestampSec: number; price: number }> = [];
    try {
      const historicalData = await getTokenHistoricalData(resolvedMint, daysSpan);
      historicalPriceTimeline = (historicalData ?? [])
        .map((point) => ({
          timestampSec: Math.floor(point.timestampMs / 1000),
          price: Number(point.price ?? Number.NaN),
        }))
        .filter((point) => Number.isFinite(point.price) && point.price > 0)
        .sort((a, b) => a.timestampSec - b.timestampSec);
    } catch (historyErr) {
      console.error("[getWalletTokenBalanceHistory] Failed to fetch historical prices", historyErr);
    }

    const tokenBalanceHistory: BalanceDataPoint[] = [];

    if (relevantTxs.length === 0) {
      tokenBalanceHistory.push(
        { timestamp: startDate.getTime(), value: currentTokenBalance, date: startDate.toISOString() },
        { timestamp: now.getTime(), value: currentTokenBalance, date: now.toISOString() },
      );
    } else {
      let runningTokenBalance = currentTokenBalance;
      const reversedTxs = [...relevantTxs].reverse();

      for (const tx of reversedTxs) {
        const txDate = new Date(tx.timestamp);
        let tokenDelta = 0;

        for (const change of tx.balanceChanges ?? []) {
          const canonicalMint = normalizeMint(change?.mint);
          if (!canonicalMint || canonicalMint !== resolvedMint) {
            continue;
          }

          const amountRaw = Number(change?.amount ?? 0);
          const decimals = Number(change?.decimals ?? 0);
          if (!Number.isFinite(amountRaw) || !Number.isFinite(decimals)) {
            continue;
          }

          tokenDelta += amountRaw / 10 ** Math.max(0, decimals);
        }

        runningTokenBalance -= tokenDelta;
        tokenBalanceHistory.unshift({
          timestamp: txDate.getTime(),
          value: Math.max(0, runningTokenBalance),
          date: txDate.toISOString(),
        });
      }

      tokenBalanceHistory.push({
        timestamp: now.getTime(),
        value: Math.max(0, currentTokenBalance),
        date: now.toISOString(),
      });
    }

    const tokenSeries: BalanceDataPoint[] = [];
    const usdSeries: BalanceDataPoint[] = [];
    let priceCursor = 0;
    let latestHistoricalPrice: number | null = null;
    let historicalPricedPoints = 0;
    let fallbackPricedPoints = 0;

    for (let date = new Date(startDate); date <= now; date = new Date(date.getTime() + DAY_MS)) {
      const timestamp = date.getTime();
      let closestTokenBalance = tokenBalanceHistory[0]?.value ?? currentTokenBalance;
      for (const point of tokenBalanceHistory) {
        if (point.timestamp <= timestamp) {
          closestTokenBalance = point.value;
        } else {
          break;
        }
      }

      tokenSeries.push({ timestamp, value: closestTokenBalance, date: date.toISOString() });

      const pointSec = Math.floor(timestamp / 1000);
      while (
        priceCursor < historicalPriceTimeline.length &&
        historicalPriceTimeline[priceCursor].timestampSec <= pointSec
      ) {
        latestHistoricalPrice = historicalPriceTimeline[priceCursor].price;
        priceCursor += 1;
      }

      const appliedPrice = latestHistoricalPrice ?? currentPrice;
      if (latestHistoricalPrice != null) {
        historicalPricedPoints += 1;
      } else {
        fallbackPricedPoints += 1;
      }

      usdSeries.push({
        timestamp,
        value: closestTokenBalance * appliedPrice,
        date: date.toISOString(),
      });
    }

    console.log("[wallet-token-balance-history-price]", {
      address,
      tokenAddress: resolvedMint,
      requestedRange: { fromSec: requestedFromSec, toSec: Math.floor(now.getTime() / 1000) },
      historicalPricePoints: historicalPriceTimeline.length,
      historicalPricedPoints,
      fallbackPricedPoints,
    });

    return { tokenSeries, usdSeries, tokenSymbol: resolvedSymbol, tokenAddress: resolvedMint };
  } catch (err) {
    console.error("[getWalletTokenBalanceHistory] Error:", err);
    return flatZero();
  }
}

// async function getTokenPriceMapFromTransactions(

// ) {
//   const uniqueTokenAddresses = new Set<string>();

//   for (const tx of transactions) {
//     if (tx.primaryTokenAddress) {
//       uniqueTokenAddresses.add(tx.primaryTokenAddress);
//     }
//   }
//   return await getTokenMarketData(Array.from(uniqueTokenAddresses))
// }

export async function fetchTestTransaction(address: string) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is not configured");
  }

  const getTransactionHistory = async (address: string, apiKey: string) => {
    const url = `https://api.helius.xyz/v1/wallet/${address}/history?api-key=${apiKey}?type=SWAP`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log(`Found ${data.data.length} transactions`);

    // Display recent transactions
    data.data.forEach((tx: any) => {
      const date = new Date(tx.timestamp * 1000).toLocaleString();
      const status = tx.error ? 'Failed' : 'Success';

      console.log(`\n${status} - ${date}`);
      console.log(`Signature: ${tx.signature.slice(0, 20)}...`);
      console.log(`Fee: ${tx.fee} SOL`);

      // Show balance changes
      tx.balanceChanges.forEach((change: any) => {
        const sign = change.amount > 0 ? '+' : '';
        console.log(`  ${sign}${change.amount} ${change.mint === 'SOL' ? 'SOL' : change.mint.slice(0, 8)}...`);
      });
    });

    return data;
  };

  return getTransactionHistory(address, apiKey);
}

async function enrichWithSolanaTokenPrices(
  transactions: WalletTransaction[] | WalletTransfer[] | WalletSwap[],
): Promise<void> {
  const isWalletTransaction = (
    tx: WalletTransaction | WalletTransfer | WalletSwap,
  ): tx is WalletTransaction => "hash" in tx;

  const isWalletTransfer = (
    tx: WalletTransaction | WalletTransfer | WalletSwap,
  ): tx is WalletTransfer => "transactionSignature" in tx;

  const isWalletSwap = (
    tx: WalletTransaction | WalletTransfer | WalletSwap,
  ): tx is WalletSwap => "balanceChanges" in tx && "feeChanges" in tx;

  const uniqueTokenAddresses = new Set<string>();

  for (const tx of transactions) {
    if (isWalletTransaction(tx)) {
      if (!tx.primaryTokenAddress && tx.primaryTokenSymbol !== "SOL") {
        continue;
      }

      // Some providers may return non-canonical SOL mint strings. Ensure we
      // always fetch native SOL price when symbol indicates SOL.
      if (tx.primaryTokenSymbol === "SOL") {
        uniqueTokenAddresses.add(SOL_MINT);
      } else if (tx.primaryTokenAddress) {
        uniqueTokenAddresses.add(tx.primaryTokenAddress);
      }
      continue;
    }

    if (isWalletTransfer(tx)) {
      if (tx.tokenSymbol === "SOL") {
        uniqueTokenAddresses.add(SOL_MINT);
      } else if (tx.tokenAddress) {
        uniqueTokenAddresses.add(tx.tokenAddress);
      }
      continue;
    }

    if (isWalletSwap(tx)) {
      for (const change of [...tx.balanceChanges, ...tx.feeChanges]) {
        const mint = String(change.mint ?? "").trim();
        if (!mint) continue;
        uniqueTokenAddresses.add(mint === "SOL" ? SOL_MINT : mint);
      }
    }
  }

  console.log(`[enrichWithSolanaTokenPrices] Processing ${transactions.length} records with ${uniqueTokenAddresses.size} unique tokens`);

  if (uniqueTokenAddresses.size === 0) {
    // No tokens to enrich.
    return;
  }

  try {
    const marketData = await getTokenMarketData(
      Array.from(uniqueTokenAddresses),
    );
    console.log(`[enrichWithSolanaTokenPrices] Got market data for ${Object.keys(marketData).length} tokens`);

    let enrichedCount = 0;
    for (const tx of transactions) {
      if (!isWalletTransaction(tx)) {
        continue;
      }

      if (!tx.primaryTokenAddress && tx.primaryTokenSymbol !== "SOL") {
        tx.priceUsd = undefined;
        tx.totalUsd = undefined;
        continue;
      }

      const tokenAddress =
        tx.primaryTokenSymbol === "SOL" ? SOL_MINT : tx.primaryTokenAddress;
      if (!tokenAddress) {
        tx.priceUsd = undefined;
        tx.totalUsd = undefined;
        continue;
      }

      const tokenData = marketData[tokenAddress];
      const priceUsd = tokenData?.priceUsd;

      if (priceUsd != null && !isNaN(priceUsd)) {
        tx.priceUsd = priceUsd;
        if (tx.primaryTokenAmount != null) {
          tx.totalUsd = priceUsd * tx.primaryTokenAmount;
        } else {
          tx.totalUsd = undefined;
        }
        enrichedCount++;
      } else {
        // Set explicitly to undefined for consistency
        tx.priceUsd = undefined;
        tx.totalUsd = undefined;
      }
    }
    console.log(`[enrichWithSolanaTokenPrices] Successfully enriched ${enrichedCount}/${transactions.length} transactions with prices`);
  } catch (err) {
    console.error(
      "Failed to enrich transactions with Solana token prices",
      err,
    );
    // Only transaction DTOs include output price fields.
    for (const tx of transactions) {
      if (isWalletTransaction(tx)) {
        tx.priceUsd = undefined;
        tx.totalUsd = undefined;
      }
    }
  }
}