import {
  WALLET_OVERVIEW_TTL_MS,
  WALLET_PORTFOLIO_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  walletOverviewCache,
  walletPortfolioCache,
} from "@sv/db/schema.js";
import { and, desc, eq } from "drizzle-orm";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import {
  getDailyTokenMarketChart,
  getHourlyTokenMarketChart,
} from "../tokens/token-chart.js";
import { getTokenHistoricalData } from "../tokens/token-history.js";
import { getTokenMeta } from "../tokens/token-info.js";
import {
  fetchAllTransactionHistory,
  fetchAllTransactionHistoryChunk,
  fetchHeliusSolanaPortfolio,
  fetchMoralisSolanaSwap,
  fetchMoralisSolanaSwapChunk,
  fetchHeliusSolanaSwap,
  fetchHeliusSolanaSwapChunk,
  fetchHeliusSolanaTransactions,
  fetchHeliusSolanaTransfers,
  fetchHeliusSolanaTransfersChunk,
  timePeriodToFromSec,
} from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import {
  getCachedWalletTransactionsHelius,
  getCachedWalletSwapsChunk,
  getCachedWalletSwaps,
  getCachedWalletTransactions,
  getCachedWalletTransfersChunk,
  getCachedWalletTransfers,
} from "@sv/services/wallet/db/walletDataRetriever.js";
import type {
  WalletPageInfo,
  WalletExchangeCountsResponse,
  WalletOverview,
  WalletPortfolioItem,
  WalletSwap,
  WalletSwapsResponse,
  WalletTransaction,
  WalletTransactionHelius,
  WalletTransactionsResponse,
  WalletTransfer,
  WalletTransfersResponse,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
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

export type WalletTimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";

type WalletHistoryRange = {
  fromSec: number;
  toSec: number;
};

const DEFAULT_OVERVIEW_PERIOD_SEC = DAY_SEC;
const MIN_OVERVIEW_PERIOD_SEC = DAY_SEC;
const MAX_OVERVIEW_PERIOD_SEC = 7 * DAY_SEC;
const DEFAULT_SWAP_PROVIDER_SOURCE = "helius";
const WALLET_TABLE_PAGE_SIZE = 100;
const DEFAULT_EXCHANGE_LIMIT = 2000;
const MAX_EXCHANGE_LIMIT = 10000;
const DEFAULT_HELIUS_HISTORY_CHUNK_PAGES = 5;
const MAX_HELIUS_HISTORY_CHUNK_PAGES = 50;
const DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS = 1_500;
const MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS = 10_000;

type SwapProviderSource = "helius" | "moralis";
type WalletExchangeAccumulator = {
  name: string;
  deposits: number;
  withdrawals: number;
  depositsVolume: number;
  withdrawalsVolume: number;
};

function normalizeCursorValue(value?: string): string | undefined {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toWalletPageInfo(input: {
  hasMore: boolean;
  nextCursor: string | null;
  source: WalletPageInfo["source"];
}): WalletPageInfo {
  return {
    pageSize: WALLET_TABLE_PAGE_SIZE,
    hasMore: input.hasMore,
    nextCursor: input.nextCursor,
    source: input.source,
  };
}

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

function resolveSwapProviderSource(): SwapProviderSource {
  const raw = String(process.env.SWAP_PROVIDER_SOURCE ?? DEFAULT_SWAP_PROVIDER_SOURCE)
    .trim()
    .toLowerCase();

  return raw === "moralis" ? "moralis" : "helius";
}

function isHeliusSwapFallbackEnabled(): boolean {
  const raw = String(process.env.SWAP_PROVIDER_FALLBACK_TO_HELIUS ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

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
  | "overview-cache"
  | "none";
};

type OverviewActivitySnapshot = {
  transactionCount24h: number | null;
  tokensTradedCount: number | null;
  tradingVolumeUsd24h: number | null;
  pnlUsdTotal: number | null;
  source: "helius-transactions" | "overview-cache" | "none";
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
  periodSec: number,
): WalletOverview {
  const tradingVolumeUsd =
    row.tradingVolumeUsd24h != null ? toFiniteNumber(row.tradingVolumeUsd24h, 0) : null;
  const pnlUsd = row.pnlUsdTotal != null ? toFiniteNumber(row.pnlUsdTotal, 0) : null;

  return {
    address,
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
): Promise<WalletOverviewCacheRow | null> {
  const cached = await db
    .select()
    .from(walletOverviewCache)
    .where(
      and(
        eq(walletOverviewCache.address, address),
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
  periodSec: number,
): WalletOverview | null {
  if (!cacheRow || periodSec !== DEFAULT_OVERVIEW_PERIOD_SEC) {
    return null;
  }

  const overviewThreshold = new Date(Date.now() - WALLET_OVERVIEW_TTL_MS);
  if (cacheRow.fetchedAt < overviewThreshold) {
    return null;
  }

  return mapOverviewCacheRowToDto(cacheRow, address, periodSec);
}

async function buildHoldingsSnapshotFromProviders(
  address: string,
  cacheRow: WalletOverviewCacheRow | null,
): Promise<OverviewHoldingsSnapshot> {
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

async function getSolanaOverviewActivityTransactions(
  address: string,
  range: WalletHistoryRange,
): Promise<NormalizedOverviewTransaction[]> {
  const txs = await getWalletTransactionHelius(address, {
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
  periodSec: number;
  holdingsSnapshot: OverviewHoldingsSnapshot;
  activitySnapshot: OverviewActivitySnapshot;
}): WalletOverview {
  const {
    address,
    periodSec,
    holdingsSnapshot,
    activitySnapshot,
  } = input;

  return {
    address,
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
  context: { address: string; source: string },
): Promise<{ portfolio: WalletPortfolioItem[]; changed: boolean }> {
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
  options?: { periodSec?: number },
): Promise<WalletOverview> {
  const periodSec = normalizeOverviewPeriodSec(options?.periodSec);
  const nowSec = Math.floor(Date.now() / 1000);
  const requestedRange = getHistoryRange({
    fromSec: nowSec - periodSec,
    toSec: nowSec,
  });

  const cacheRow = await getLatestOverviewCacheRow(address);
  const cachedOverview = getOverviewFromFreshCache(
    cacheRow,
    address,
    periodSec,
  );
  if (cachedOverview) {
    console.log("[wallet-overview]", {
      address,
      periodSec,
      cacheHit: true,
    });
    return cachedOverview;
  }

  const holdingsSnapshot = await buildHoldingsSnapshotFromProviders(
    address,
    cacheRow,
  );

  let activitySnapshot: OverviewActivitySnapshot;
  let activityFetchFailed = false;

  try {
    const normalizedTransactions = await getSolanaOverviewActivityTransactions(
      address,
      requestedRange,
    );

    const reducedMetrics = await reduceActivityMetricsFromTransactions(normalizedTransactions);

    activitySnapshot = {
      ...reducedMetrics,
      source: "helius-transactions",
    };
  } catch (err) {
    activityFetchFailed = true;
    console.error("[wallet-overview] Failed to compute activity snapshot", {
      address,
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
): Promise<WalletPortfolioItem[]> {
  // 0) DB-first: use cached portfolio if fresh
  const portfolioThreshold = new Date(Date.now() - WALLET_PORTFOLIO_TTL_MS);
  const cachedPortfolio = await db
    .select()
    .from(walletPortfolioCache)
    .where(
      and(
        eq(walletPortfolioCache.address, address)
      ),
    )
    .limit(1);
  if (cachedPortfolio.length > 0 && cachedPortfolio[0].fetchedAt >= portfolioThreshold) {
    const cachedData = (cachedPortfolio[0].data as WalletPortfolioItem[]) ?? [];
    if (cachedData.length > 0) {
      const enrichedCached = await enrichWalletPortfolioMetadata(cachedData, {
        address,
        source: "cache-hit",
      });

      if (enrichedCached.changed) {
        await db
          .insert(walletPortfolioCache)
          .values({ address, data: enrichedCached.portfolio })
          .onConflictDoUpdate({
            target: [walletPortfolioCache.address],
            set: { data: enrichedCached.portfolio, fetchedAt: new Date() },
          });
      }

      return enrichedCached.portfolio;
    }
    // If cached portfolio is empty (likely from an earlier failed API call),
    // fall through to external fetch instead of treating it as valid.
  }

  let heliusPortfolio: WalletPortfolioItem[] = [];
  try {
    heliusPortfolio = await fetchHeliusSolanaPortfolio(address);
  } catch (err) {
    console.error("Failed to fetch Solana portfolio from Helius", err);
  }

  if (heliusPortfolio.length === 0) {
    return [];
  }

  const enrichedPortfolio = await enrichWalletPortfolioMetadata(heliusPortfolio, {
    address,
    source: "helius",
  });

  await db
    .insert(walletPortfolioCache)
    .values({ address, data: enrichedPortfolio.portfolio })
    .onConflictDoUpdate({
      target: [walletPortfolioCache.address],
      set: { data: enrichedPortfolio.portfolio, fetchedAt: new Date() },
    });
  return enrichedPortfolio.portfolio;
}

export async function getWalletTransactionHelius(
  address: string,
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d"; fromSec?: number; toSec?: number },
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



export async function getWalletTransfers(
  address: string,
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d" },
): Promise<WalletTransfersResponse> {
  if (options?.from) {
    const cachedTransfers = await getCachedWalletTransfers(
      address,
      options.from,
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
      const transfers = await fetchHeliusSolanaTransfers(address, options.from);

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
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d" },
): Promise<WalletSwapsResponse> {
  const providerSource = resolveSwapProviderSource();

  if (options?.from) {
    const limit = Math.min(options?.limit ?? 100, 500);

    const cachedSwaps = await getCachedWalletSwaps(address, options.from);
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
      let swaps: WalletSwap[];
      if (providerSource === "moralis") {
        try {
          swaps = await fetchMoralisSolanaSwap(address, options.from, {
            limit,
            cursor: options?.cursor ?? options?.before,
          });

          console.log(
            `[getWalletSwaps] Successfully fetched ${swaps.length} swaps from Moralis for ${address}`,
          );
        } catch (moralisErr) {
          console.error("[getWalletSwaps] Moralis swap fetch failed", moralisErr);
          if (!isHeliusSwapFallbackEnabled()) {
            throw moralisErr;
          }

          swaps = await fetchHeliusSolanaSwap(address, options.from);
          console.log(
            `[getWalletSwaps] Moralis failed; fallback fetched ${swaps.length} swaps from Helius for ${address}`,
          );
        }
      } else {
        swaps = await fetchHeliusSolanaSwap(address, options.from);
        console.log(
          `[getWalletSwaps] Successfully fetched ${swaps.length} swaps from Helius for ${address}`,
        );
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
    let chunk: { items: WalletSwap[]; nextCursor: string | null; hasMore: boolean };

    if (providerSource === "moralis") {
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
        if (!isHeliusSwapFallbackEnabled()) {
          throw moralisErr;
        }

        chunk = await fetchHeliusSolanaSwapChunk(address, {
          limit: WALLET_TABLE_PAGE_SIZE,
          before: cursor,
        });
        console.log(
          `[getWalletSwaps] Moralis failed; fallback fetched ${chunk.items.length} swaps from Helius chunk for ${address}`,
        );
      }
    } else {
      chunk = await fetchHeliusSolanaSwapChunk(address, {
        limit: WALLET_TABLE_PAGE_SIZE,
        before: cursor,
      });
      console.log(
        `[getWalletSwaps] Successfully fetched ${chunk.items.length} swaps from Helius chunk for ${address}`,
      );
    }

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

function normalizeExchangeMetric(rawMetric?: "count" | "volume"): "count" | "volume" {
  return rawMetric === "volume" ? "volume" : "count";
}

function normalizeExchangeBucketToken(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toFiniteNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function resolveExchangeBucketFromSwap(swap: WalletSwap): { key: string; name: string } {
  const exchangeName = String(swap.exchange?.name ?? "").trim();
  const exchangeAddress = String(swap.exchange?.address ?? "").trim();
  if (exchangeName || exchangeAddress) {
    return {
      key: `exchange:${normalizeExchangeBucketToken(exchangeName)}:${normalizeExchangeBucketToken(exchangeAddress)}`,
      name: exchangeName || exchangeAddress,
    };
  }

  const pairLabel = String(swap.pair?.label ?? "").trim();
  const pairAddress = String(swap.pair?.address ?? "").trim();
  if (pairLabel || pairAddress) {
    return {
      key: `pair:${normalizeExchangeBucketToken(pairLabel)}:${normalizeExchangeBucketToken(pairAddress)}`,
      name: pairLabel || pairAddress,
    };
  }

  return {
    key: "unknown",
    name: "Unknown",
  };
}

function resolveSwapSideVolumes(swap: WalletSwap): {
  depositsVolume: number;
  withdrawalsVolume: number;
} {
  const hasBoughtLeg = swap.bought != null;
  const hasSoldLeg = swap.sold != null;

  let depositsVolume = toFiniteNonNegativeNumber(swap.bought?.valueUsd);
  let withdrawalsVolume = toFiniteNonNegativeNumber(swap.sold?.valueUsd);

  const hasDepositsVolume = depositsVolume > 0;
  const hasWithdrawalsVolume = withdrawalsVolume > 0;
  const totalValueUsd = toFiniteNonNegativeNumber(swap.totalValueUsd);

  if (totalValueUsd <= 0) {
    return { depositsVolume, withdrawalsVolume };
  }

  if (hasBoughtLeg && hasSoldLeg) {
    if (!hasDepositsVolume && !hasWithdrawalsVolume) {
      depositsVolume = totalValueUsd / 2;
      withdrawalsVolume = totalValueUsd / 2;
      return { depositsVolume, withdrawalsVolume };
    }

    if (!hasDepositsVolume) {
      depositsVolume = Math.max(0, totalValueUsd - withdrawalsVolume);
    }

    if (!hasWithdrawalsVolume) {
      withdrawalsVolume = Math.max(0, totalValueUsd - depositsVolume);
    }

    return { depositsVolume, withdrawalsVolume };
  }

  if (hasBoughtLeg && !hasDepositsVolume) {
    depositsVolume = totalValueUsd;
  }

  if (hasSoldLeg && !hasWithdrawalsVolume) {
    withdrawalsVolume = totalValueUsd;
  }

  return { depositsVolume, withdrawalsVolume };
}

function collapseSwapSources(
  sources: Set<WalletPageInfo["source"]>,
): WalletPageInfo["source"] {
  if (sources.size === 0) {
    return "mixed";
  }

  if (sources.has("mixed")) {
    return "mixed";
  }

  if (sources.size === 1) {
    const [single] = Array.from(sources);
    return single;
  }

  return "mixed";
}

async function collectWalletSwapsForExchangeAggregation(
  address: string,
  transactionLimit: number,
): Promise<{
  swaps: WalletSwap[];
  source: WalletPageInfo["source"];
  truncated: boolean;
}> {
  const swaps: WalletSwap[] = [];
  const sources = new Set<WalletPageInfo["source"]>();

  let cursor: string | undefined;
  let hasMore = true;
  let pageCount = 0;

  while (
    hasMore &&
    swaps.length < transactionLimit
  ) {
    pageCount += 1;

    const remainingCapacity = Math.max(1, transactionLimit - swaps.length);
    const pageLimit = Math.min(WALLET_TABLE_PAGE_SIZE, remainingCapacity);
    const page = await getWalletSwaps(address, {
      limit: pageLimit,
      cursor,
      before: cursor,
    });

    sources.add(page.pageInfo.source);

    for (const swap of page.swaps) {
      swaps.push(swap);

      if (swaps.length >= transactionLimit) {
        break;
      }
    }

    hasMore = Boolean(page.pageInfo.hasMore);
    const nextCursor = normalizeCursorValue(page.pageInfo.nextCursor ?? undefined);
    if (!hasMore || !nextCursor || nextCursor === cursor || page.swaps.length === 0) {
      break;
    }

    cursor = nextCursor;
  }

  const truncated =
    hasMore &&
    (swaps.length >= transactionLimit);

  return {
    swaps,
    source: collapseSwapSources(sources),
    truncated,
  };
}

export type WalletExchangeCountsOptions = {
  period?: string;
  chain?: string;
  limit?: number;
  metric?: "count" | "volume";
};

function normalizeExchangePeriod(rawPeriod?: string): WalletTimePeriod {
  const normalized = String(rawPeriod ?? "").trim().toUpperCase();
  if (
    normalized === "7D" ||
    normalized === "30D" ||
    normalized === "60D" ||
    normalized === "90D" ||
    normalized === "1Y" ||
    normalized === "ALL"
  ) {
    return normalized === "ALL" ? "All" : (normalized as WalletTimePeriod);
  }

  return "30D";
}

function normalizeExchangeChain(rawChain?: string): string {
  const normalized = String(rawChain ?? "solana").trim().toLowerCase();
  return normalized || "solana";
}

/**
 * PURPOSE: Aggregate per-exchange swap activity for a wallet.
 * RULES:
 * - Bucket priority: exchange -> pair -> Unknown.
 * - Dedup key: wallet + signature + exchange bucket.
 * - Counts map to side presence (bought/sold).
 * - Volumes use side USD values, with totalValueUsd fallback when needed.
 */
export async function getWalletExchangeCounts(
  address: string,
  options?: WalletExchangeCountsOptions,
): Promise<WalletExchangeCountsResponse> {
  const transactionLimit = Math.min(
    Math.max(Math.floor(options?.limit ?? DEFAULT_EXCHANGE_LIMIT), 1),
    MAX_EXCHANGE_LIMIT,
  );
  const period = normalizeExchangePeriod(options?.period);
  const chain = normalizeExchangeChain(options?.chain);
  const metric = normalizeExchangeMetric(options?.metric);

  const dataset = await collectWalletSwapsForExchangeAggregation(
    address,
    transactionLimit,
  );
  const byBucket = new Map<string, WalletExchangeAccumulator>();
  const dedupe = new Set<string>();
  const walletLower = address.toLowerCase();

  for (const swap of dataset.swaps) {
    const signature = String(swap.signature ?? "").trim().toLowerCase();
    if (!signature) {
      continue;
    }

    const bucket = resolveExchangeBucketFromSwap(swap);
    const dedupeKey = `${walletLower}:${signature}:${bucket.key}`;
    if (dedupe.has(dedupeKey)) {
      continue;
    }
    dedupe.add(dedupeKey);

    const accumulator = byBucket.get(bucket.key) ?? {
      name: bucket.name,
      deposits: 0,
      withdrawals: 0,
      depositsVolume: 0,
      withdrawalsVolume: 0,
    };

    const { depositsVolume, withdrawalsVolume } = resolveSwapSideVolumes(swap);

    const transactionType = swap.transactionType ?? "unknown";
    if (transactionType === "buy") {
      accumulator.deposits += 1;
      accumulator.depositsVolume += depositsVolume;
    } else if (transactionType === "sell") {
      accumulator.withdrawals += 1;
      accumulator.withdrawalsVolume += withdrawalsVolume;
    }

    byBucket.set(bucket.key, accumulator);
  }

  const exchanges = Array.from(byBucket.values())
    .sort((a, b) => {
      const interactionDiff =
        b.deposits + b.withdrawals - (a.deposits + a.withdrawals);
      if (interactionDiff !== 0) {
        return interactionDiff;
      }

      const volumeDiff =
        b.depositsVolume + b.withdrawalsVolume - (a.depositsVolume + a.withdrawalsVolume);
      if (volumeDiff !== 0) {
        return volumeDiff;
      }

      return a.name.localeCompare(b.name);
    })
    .map((item) => ({
      ...item,
      depositsVolume: roundUsd(item.depositsVolume),
      withdrawalsVolume: roundUsd(item.withdrawalsVolume),
    }));

  return {
    exchanges,
    metadata: {
      period,
      chain,
      metric,
      source: dataset.source,
      limit: transactionLimit,
      truncated: dataset.truncated,
    },
  };
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

export type ChartAggregation = "hourly" | "daily" | "weekly" | "monthly";

export interface ChartPageInfo {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
  source: "cache" | "provider" | "mixed";
}

export interface ChartChunkInfo {
  chunkFromSec: number;
  chunkToSec: number;
  requestedFromSec: number;
  requestedToSec: number;
  effectiveAggregation: ChartAggregation;
}

export interface ChartChunkState {
  hasMore: boolean;
  nextChunkToSec: number | null;
  heliusCursor: string | null;
  lastProcessedSignature: string | null;
}

type PriceTimelinePoint = {
  timestampMs: number;
  price: number;
};

const MAX_PNL_SNAPSHOT_POINTS = 1500;
const DEFAULT_CHART_POINTS_PER_CHUNK = 180;
const MAX_CHART_POINTS_PER_CHUNK = 500;

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

function getRangeStartMs(
  nowMs: number,
  timePeriod: WalletTimePeriod,
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
  startMs: number,
  endMs: number,
  intervalMs: number,
  options?: {
    beforeCursor?: string;
    transactionLimit?: number;
    onTransactionsLoaded?: (transactions: WalletTransactionHelius[]) => void;
  },
): Promise<PnLDataPoint[]> {
  const snapshots = buildSnapshotTimestamps(startMs, endMs, intervalMs);
  const requestedFromSec = Math.floor(startMs / 1000);
  const requestedToSec = Math.floor(endMs / 1000);

  const [portfolio, txResponse] = await Promise.all([
    getWalletPortfolio(address),
    getWalletTransactionHelius(address, {
      fromSec: requestedFromSec,
      toSec: requestedToSec,
      before: options?.beforeCursor,
      limit: options?.transactionLimit,
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

  options?.onTransactionsLoaded?.(transactions);

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
 * @param timePeriod - Time period for historical data
 * @returns Array of balance data points over time
 */
export async function getWalletBalanceHistory(
  address: string,
  timePeriod: WalletTimePeriod = "30D"
): Promise<BalanceDataPoint[]> {
  const nowMs = Date.now();
  const startMs = getRangeStartMs(nowMs, timePeriod);
  const now = new Date(nowMs);
  const startDate = new Date(startMs);

  try {
    const portfolioValues = await getHistoricalPortfolioValueSeries(
      address,
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
    const currentPortfolio = await getWalletPortfolio(address);
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

export async function getWalletBalanceHistoryChunk(
  address: string,
  options: {
    timePeriod?: WalletTimePeriod;
    requestedFromSec?: number;
    requestedToSec?: number;
    chunkToSec?: number;
    limit?: number;
    heliusCursor?: string | null;
  },
): Promise<{
  series: BalanceDataPoint[];
  chunkInfo: ChartChunkInfo;
  chunkState: ChartChunkState;
}> {
  const nowSec = Math.floor(Date.now() / 1000);
  const resolvedRequestedRange =
    options.requestedFromSec != null || options.requestedToSec != null
      ? {
        fromSec: Math.max(0, Math.floor(options.requestedFromSec ?? 0)),
        toSec: Math.max(
          Math.max(0, Math.floor(options.requestedFromSec ?? 0)),
          Math.floor(options.requestedToSec ?? nowSec),
        ),
      }
      : resolveWalletTimeRangeSec(options.timePeriod ?? "30D", nowSec);

  const requestedGapSec = Math.max(
    0,
    resolvedRequestedRange.toSec - resolvedRequestedRange.fromSec,
  );
  const effectiveAggregation = resolveBalanceAggregationByGapSec(requestedGapSec);
  const intervalMs = getBalanceAggregationIntervalMs(effectiveAggregation);
  const intervalSec = Math.max(1, Math.floor(intervalMs / 1000));
  const limit = clampChartPointsPerChunk(options.limit);
  const transactionLimit = resolveChartTransactionLimit(limit);
  const chunkWindow = resolveChunkWindow({
    requestedFromSec: resolvedRequestedRange.fromSec,
    requestedToSec: resolvedRequestedRange.toSec,
    chunkToSec: options.chunkToSec,
    limit,
    intervalSec,
  });

  const chunkFromMs = chunkWindow.chunkFromSec * 1000;
  const chunkToMs = chunkWindow.chunkToSec * 1000;
  let lastProcessedSignature: string | null = null;

  try {
    const portfolioValues = await getHistoricalPortfolioValueSeries(
      address,
      chunkFromMs,
      chunkToMs,
      intervalMs,
      {
        beforeCursor: normalizeCursorValue(options.heliusCursor ?? undefined),
        transactionLimit,
        onTransactionsLoaded: (transactions) => {
          lastProcessedSignature =
            transactions[transactions.length - 1]?.signature ?? null;
        },
      },
    );

    return {
      series: portfolioValues.map((point) => ({
        timestamp: point.timestamp,
        value: point.value,
        date: new Date(point.timestamp).toISOString(),
      })),
      chunkInfo: {
        chunkFromSec: chunkWindow.chunkFromSec,
        chunkToSec: chunkWindow.chunkToSec,
        requestedFromSec: resolvedRequestedRange.fromSec,
        requestedToSec: resolvedRequestedRange.toSec,
        effectiveAggregation,
      },
      chunkState: {
        hasMore: chunkWindow.hasMore,
        nextChunkToSec: chunkWindow.nextChunkToSec,
        heliusCursor: lastProcessedSignature ?? options.heliusCursor ?? null,
        lastProcessedSignature,
      },
    };
  } catch (error) {
    console.error("[WalletBalanceHistoryChunk] Error fetching balance chunk:", error);

    const currentPortfolio = await getWalletPortfolio(address);
    const currentTotalValue = currentPortfolio.reduce(
      (sum, item) => sum + (item.valueUsd ?? 0),
      0,
    );

    return {
      series: [
        {
          timestamp: chunkFromMs,
          value: Math.max(0, currentTotalValue),
          date: new Date(chunkFromMs).toISOString(),
        },
        {
          timestamp: chunkToMs,
          value: Math.max(0, currentTotalValue),
          date: new Date(chunkToMs).toISOString(),
        },
      ],
      chunkInfo: {
        chunkFromSec: chunkWindow.chunkFromSec,
        chunkToSec: chunkWindow.chunkToSec,
        requestedFromSec: resolvedRequestedRange.fromSec,
        requestedToSec: resolvedRequestedRange.toSec,
        effectiveAggregation,
      },
      chunkState: {
        hasMore: chunkWindow.hasMore,
        nextChunkToSec: chunkWindow.nextChunkToSec,
        heliusCursor: options.heliusCursor ?? null,
        lastProcessedSignature: null,
      },
    };
  }
}

/**
 * Get cumulative wallet PnL using transaction-derived balance snapshots
 * and historical token prices from cached token chart services.
 */
export async function getCumulativePnL(
  address: string,
  timePeriod: WalletTimePeriod = "30D",
  aggregation: PnLAggregation = "daily",
): Promise<WalletCumulativePnLResult> {
  const nowMs = Date.now();
  const startMs = getRangeStartMs(nowMs, timePeriod);
  const intervalMs = getAggregationIntervalMs(aggregation);
  const snapshots = buildSnapshotTimestamps(startMs, nowMs, intervalMs);

  const zeroSeries: PnLDataPoint[] = snapshots.map((timestamp) => ({
    timestamp,
    value: 0,
  }));

  try {
    const portfolioValues = await getHistoricalPortfolioValueSeries(
      address,
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

export async function getCumulativePnLChunk(
  address: string,
  options: {
    timePeriod?: WalletTimePeriod;
    requestedFromSec?: number;
    requestedToSec?: number;
    chunkToSec?: number;
    limit?: number;
    aggregation?: PnLAggregation;
    heliusCursor?: string | null;
  },
): Promise<WalletCumulativePnLResult & {
  chunkInfo: ChartChunkInfo;
  chunkState: ChartChunkState;
}> {
  const nowSec = Math.floor(Date.now() / 1000);
  const resolvedRequestedRange =
    options.requestedFromSec != null || options.requestedToSec != null
      ? {
        fromSec: Math.max(0, Math.floor(options.requestedFromSec ?? 0)),
        toSec: Math.max(
          Math.max(0, Math.floor(options.requestedFromSec ?? 0)),
          Math.floor(options.requestedToSec ?? nowSec),
        ),
      }
      : resolveWalletTimeRangeSec(options.timePeriod ?? "30D", nowSec);

  const requestedGapSec = Math.max(
    0,
    resolvedRequestedRange.toSec - resolvedRequestedRange.fromSec,
  );
  const effectivePnLAggregation = resolvePnLAggregationByGap(
    options.aggregation ?? "daily",
    requestedGapSec,
  );
  const effectiveAggregation: ChartAggregation = effectivePnLAggregation;
  const intervalMs = getAggregationIntervalMs(effectivePnLAggregation);
  const intervalSec = Math.max(1, Math.floor(intervalMs / 1000));
  const limit = clampChartPointsPerChunk(options.limit);
  const transactionLimit = resolveChartTransactionLimit(limit);
  const chunkWindow = resolveChunkWindow({
    requestedFromSec: resolvedRequestedRange.fromSec,
    requestedToSec: resolvedRequestedRange.toSec,
    chunkToSec: options.chunkToSec,
    limit,
    intervalSec,
  });

  const chunkFromMs = chunkWindow.chunkFromSec * 1000;
  const chunkToMs = chunkWindow.chunkToSec * 1000;
  const snapshots = buildSnapshotTimestamps(chunkFromMs, chunkToMs, intervalMs);
  const zeroSeries: PnLDataPoint[] = snapshots.map((timestamp) => ({
    timestamp,
    value: 0,
  }));

  let lastProcessedSignature: string | null = null;

  try {
    const portfolioValues = await getHistoricalPortfolioValueSeries(
      address,
      chunkFromMs,
      chunkToMs,
      intervalMs,
      {
        beforeCursor: normalizeCursorValue(options.heliusCursor ?? undefined),
        transactionLimit,
        onTransactionsLoaded: (transactions) => {
          lastProcessedSignature =
            transactions[transactions.length - 1]?.signature ?? null;
        },
      },
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
      chunkInfo: {
        chunkFromSec: chunkWindow.chunkFromSec,
        chunkToSec: chunkWindow.chunkToSec,
        requestedFromSec: resolvedRequestedRange.fromSec,
        requestedToSec: resolvedRequestedRange.toSec,
        effectiveAggregation,
      },
      chunkState: {
        hasMore: chunkWindow.hasMore,
        nextChunkToSec: chunkWindow.nextChunkToSec,
        heliusCursor: lastProcessedSignature ?? options.heliusCursor ?? null,
        lastProcessedSignature,
      },
    };
  } catch (error) {
    console.error("[WalletCumulativePnLChunk] Error computing cumulative PnL chunk:", error);
    return {
      dailyPnL: zeroSeries,
      cumulativePnL: zeroSeries,
      startBalance: 0,
      endBalance: 0,
      chunkInfo: {
        chunkFromSec: chunkWindow.chunkFromSec,
        chunkToSec: chunkWindow.chunkToSec,
        requestedFromSec: resolvedRequestedRange.fromSec,
        requestedToSec: resolvedRequestedRange.toSec,
        effectiveAggregation,
      },
      chunkState: {
        hasMore: chunkWindow.hasMore,
        nextChunkToSec: chunkWindow.nextChunkToSec,
        heliusCursor: options.heliusCursor ?? null,
        lastProcessedSignature: null,
      },
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
  tokenSelector: string,
  timePeriod: WalletTimePeriod = "30D"
): Promise<TokenBalanceSeriesResult> {
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
    const portfolio = await getWalletPortfolio(address);

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

    const txResponse = await getWalletTransactionHelius(address, {
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

function sliceBalanceSeriesToChunk(
  series: BalanceDataPoint[],
  chunkFromSec: number,
  chunkToSec: number,
  maxPoints: number,
): BalanceDataPoint[] {
  const fromMs = chunkFromSec * 1000;
  const toMs = chunkToSec * 1000;

  const filtered = series
    .filter((point) => point.timestamp >= fromMs && point.timestamp <= toMs)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (filtered.length <= maxPoints) {
    return filtered;
  }

  const step = Math.max(1, Math.ceil(filtered.length / maxPoints));
  const sampled = filtered.filter((_, index) => index % step === 0);
  const lastPoint = filtered[filtered.length - 1];

  if (sampled[sampled.length - 1]?.timestamp !== lastPoint.timestamp) {
    sampled.push(lastPoint);
  }

  return sampled;
}

export async function getWalletTokenBalanceHistoryChunk(
  address: string,
  tokenSelector: string,
  options: {
    timePeriod?: WalletTimePeriod;
    requestedFromSec?: number;
    requestedToSec?: number;
    chunkToSec?: number;
    limit?: number;
  },
): Promise<TokenBalanceSeriesResult & {
  chunkInfo: ChartChunkInfo;
  chunkState: ChartChunkState;
}> {
  const nowSec = Math.floor(Date.now() / 1000);
  const resolvedRequestedRange =
    options.requestedFromSec != null || options.requestedToSec != null
      ? {
        fromSec: Math.max(0, Math.floor(options.requestedFromSec ?? 0)),
        toSec: Math.max(
          Math.max(0, Math.floor(options.requestedFromSec ?? 0)),
          Math.floor(options.requestedToSec ?? nowSec),
        ),
      }
      : resolveWalletTimeRangeSec(options.timePeriod ?? "30D", nowSec);

  const requestedGapSec = Math.max(
    0,
    resolvedRequestedRange.toSec - resolvedRequestedRange.fromSec,
  );
  const effectiveAggregation = resolveBalanceAggregationByGapSec(requestedGapSec);
  const intervalMs = getBalanceAggregationIntervalMs(effectiveAggregation);
  const intervalSec = Math.max(1, Math.floor(intervalMs / 1000));
  const limit = clampChartPointsPerChunk(options.limit);

  const chunkWindow = resolveChunkWindow({
    requestedFromSec: resolvedRequestedRange.fromSec,
    requestedToSec: resolvedRequestedRange.toSec,
    chunkToSec: options.chunkToSec,
    limit,
    intervalSec,
  });

  const fullSeries = await getWalletTokenBalanceHistory(
    address,
    tokenSelector,
    options.timePeriod ?? "30D",
  );

  return {
    tokenSeries: sliceBalanceSeriesToChunk(
      fullSeries.tokenSeries,
      chunkWindow.chunkFromSec,
      chunkWindow.chunkToSec,
      limit,
    ),
    usdSeries: sliceBalanceSeriesToChunk(
      fullSeries.usdSeries,
      chunkWindow.chunkFromSec,
      chunkWindow.chunkToSec,
      limit,
    ),
    tokenSymbol: fullSeries.tokenSymbol,
    tokenAddress: fullSeries.tokenAddress,
    chunkInfo: {
      chunkFromSec: chunkWindow.chunkFromSec,
      chunkToSec: chunkWindow.chunkToSec,
      requestedFromSec: resolvedRequestedRange.fromSec,
      requestedToSec: resolvedRequestedRange.toSec,
      effectiveAggregation,
    },
    chunkState: {
      hasMore: chunkWindow.hasMore,
      nextChunkToSec: chunkWindow.nextChunkToSec,
      heliusCursor: null,
      lastProcessedSignature: null,
    },
  };
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

  const candidateAddressesByKey = new Map<string, string>();

  const resolveLookupAddress = (
    rawTokenAddress: unknown,
    rawTokenSymbol?: unknown,
  ): string | undefined => {
    const normalizedSymbol = normalizePortfolioText(rawTokenSymbol);
    if (normalizedSymbol?.toLowerCase() === "sol") {
      return SOL_MINT;
    }

    const normalizedAddress = normalizePortfolioText(rawTokenAddress);
    if (!normalizedAddress) {
      return undefined;
    }

    const lookupAddress = normalizePortfolioLookupAddress(normalizedAddress);
    if (!isValidPortfolioTokenAddress(lookupAddress)) {
      return undefined;
    }

    return lookupAddress;
  };

  const getAddressKey = (
    rawTokenAddress: unknown,
    rawTokenSymbol?: unknown,
  ): string | undefined => {
    const lookupAddress = resolveLookupAddress(rawTokenAddress, rawTokenSymbol);
    return lookupAddress ? normalizePortfolioAddressKey(lookupAddress) : undefined;
  };

  for (const tx of transactions) {
    if (isWalletTransaction(tx)) {
      const lookupAddress = resolveLookupAddress(
        tx.primaryTokenAddress,
        tx.primaryTokenSymbol,
      );
      if (lookupAddress) {
        candidateAddressesByKey.set(
          normalizePortfolioAddressKey(lookupAddress),
          lookupAddress,
        );
      }
      continue;
    }

    if (isWalletTransfer(tx)) {
      const lookupAddress = resolveLookupAddress(tx.tokenAddress, tx.tokenSymbol);
      if (lookupAddress) {
        candidateAddressesByKey.set(
          normalizePortfolioAddressKey(lookupAddress),
          lookupAddress,
        );
      }
      continue;
    }

    if (isWalletSwap(tx)) {
      const swapChanges = [
        ...tx.balanceChanges,
        ...tx.feeChanges,
        ...(tx.sold ? [tx.sold] : []),
        ...(tx.bought ? [tx.bought] : []),
      ];

      for (const change of swapChanges) {
        const lookupAddress = resolveLookupAddress(change.mint, change.symbol);
        if (!lookupAddress) {
          continue;
        }

        candidateAddressesByKey.set(
          normalizePortfolioAddressKey(lookupAddress),
          lookupAddress,
        );
      }
    }
  }

  console.log(
    `[enrichWithSolanaTokenPrices] Processing ${transactions.length} records with ${candidateAddressesByKey.size} unique tokens`,
  );

  if (candidateAddressesByKey.size === 0) {
    // No tokens to enrich.
    return;
  }

  try {
    type TokenMetaRow = {
      address?: unknown;
      symbol?: unknown;
      name?: unknown;
      imageUrl?: unknown;
    };

    const candidateAddresses = Array.from(candidateAddressesByKey.values());

    const tokenMetaByKey = new Map<
      string,
      {
        symbol?: string;
        name?: string;
        logoUri?: string;
      }
    >();
    const marketPriceByKey = new Map<string, number>();

    try {
      const tokenMeta = await getTokenMeta(candidateAddresses) as TokenMetaRow[];
      for (const meta of tokenMeta) {
        const address = normalizePortfolioText(meta.address);
        if (!address) {
          continue;
        }

        const lookupAddress = normalizePortfolioLookupAddress(address);
        if (!isValidPortfolioTokenAddress(lookupAddress)) {
          continue;
        }

        tokenMetaByKey.set(normalizePortfolioAddressKey(lookupAddress), {
          symbol: normalizePortfolioText(meta.symbol),
          name: normalizePortfolioText(meta.name),
          logoUri: normalizePortfolioText(meta.imageUrl),
        });
      }
    } catch (err) {
      console.warn("[enrichWithSolanaTokenPrices] Token metadata enrichment failed", err);
    }

    try {
      const marketData = await getTokenMarketData(candidateAddresses);
      for (const [rawAddress, data] of Object.entries(marketData ?? {})) {
        const normalizedAddress = normalizePortfolioText(rawAddress);
        if (!normalizedAddress) {
          continue;
        }

        const lookupAddress = normalizePortfolioLookupAddress(normalizedAddress);
        if (!isValidPortfolioTokenAddress(lookupAddress)) {
          continue;
        }

        const priceUsd = Number(data?.priceUsd);
        if (!Number.isFinite(priceUsd)) {
          continue;
        }

        marketPriceByKey.set(normalizePortfolioAddressKey(lookupAddress), priceUsd);
      }
    } catch (err) {
      console.warn("[enrichWithSolanaTokenPrices] Token market-data enrichment failed", err);
    }

    const resolvePriceUsd = (addressKey: string | undefined): number | undefined => {
      if (!addressKey) {
        return undefined;
      }

      const priceUsd = marketPriceByKey.get(addressKey);
      return Number.isFinite(priceUsd) ? priceUsd : undefined;
    };

    let transactionEnrichedCount = 0;
    let transferEnrichedCount = 0;
    let swapEnrichedCount = 0;

    for (const tx of transactions) {
      if (isWalletTransaction(tx)) {
        const addressKey = getAddressKey(
          tx.primaryTokenAddress,
          tx.primaryTokenSymbol,
        );

        if (!addressKey) {
          tx.priceUsd = undefined;
          tx.totalUsd = undefined;
          continue;
        }

        const priceUsd = resolvePriceUsd(addressKey);
        if (priceUsd == null) {
          tx.priceUsd = undefined;
          tx.totalUsd = undefined;
          continue;
        }

        tx.priceUsd = priceUsd;
        tx.totalUsd =
          tx.primaryTokenAmount != null ? priceUsd * tx.primaryTokenAmount : undefined;
        transactionEnrichedCount += 1;
        continue;
      }

      if (isWalletTransfer(tx)) {
        let changed = false;

        const addressKey = getAddressKey(tx.tokenAddress, tx.tokenSymbol);
        if (addressKey) {
          const tokenMeta = tokenMetaByKey.get(addressKey);
          if (tokenMeta) {
            const shouldFillSymbol = shouldFillPortfolioText(tx.tokenSymbol) && Boolean(tokenMeta.symbol);
            const shouldFillName = shouldFillPortfolioText(tx.tokenName) && Boolean(tokenMeta.name);
            const shouldFillLogo = isMissingPortfolioLogoUri(tx.tokenLogoUri) && Boolean(tokenMeta.logoUri);

            if (shouldFillSymbol) {
              tx.tokenSymbol = String(tokenMeta.symbol);
              changed = true;
            }

            if (shouldFillName) {
              tx.tokenName = String(tokenMeta.name);
              changed = true;
            }

            if (shouldFillLogo) {
              tx.tokenLogoUri = String(tokenMeta.logoUri);
              changed = true;
            }
          }

          const priceUsd = resolvePriceUsd(addressKey);
          if (priceUsd != null) {
            const hasPriceUsd = tx.priceUsd != null && Number.isFinite(Number(tx.priceUsd));
            if (!hasPriceUsd) {
              tx.priceUsd = priceUsd;
              changed = true;
            }

            const amountUsd = Number(tx.amount) * Number(tx.priceUsd ?? priceUsd);
            const hasAmountUsd = tx.amountUsd != null && Number.isFinite(Number(tx.amountUsd));
            if (!hasAmountUsd && Number.isFinite(amountUsd)) {
              tx.amountUsd = amountUsd;
              changed = true;
            }
          }
        }

        if (changed) {
          transferEnrichedCount += 1;
        }
        continue;
      }

      if (!isWalletSwap(tx)) {
        continue;
      }

      let changed = false;

      const enrichSwapChange = (change: WalletSwap["sold"]) => {
        if (!change) {
          return;
        }

        const addressKey = getAddressKey(change.mint, change.symbol);
        if (!addressKey) {
          return;
        }

        const tokenMeta = tokenMetaByKey.get(addressKey);
        if (tokenMeta) {
          const shouldFillSymbol = shouldFillPortfolioText(change.symbol ?? undefined) && Boolean(tokenMeta.symbol);
          const shouldFillName = shouldFillPortfolioText(change.name ?? undefined) && Boolean(tokenMeta.name);
          const shouldFillLogo = isMissingPortfolioLogoUri(change.logoUri ?? undefined) && Boolean(tokenMeta.logoUri);

          if (shouldFillSymbol) {
            change.symbol = String(tokenMeta.symbol);
            changed = true;
          }

          if (shouldFillName) {
            change.name = String(tokenMeta.name);
            changed = true;
          }

          if (shouldFillLogo) {
            change.logoUri = String(tokenMeta.logoUri);
            changed = true;
          }
        }

        const priceUsd = resolvePriceUsd(addressKey);
        if (priceUsd == null) {
          return;
        }

        const hasPriceUsd = change.priceUsd != null && Number.isFinite(Number(change.priceUsd));
        if (!hasPriceUsd) {
          change.priceUsd = priceUsd;
          changed = true;
        }

        const hasValueUsd = change.valueUsd != null && Number.isFinite(Number(change.valueUsd));
        if (!hasValueUsd) {
          const computedValueUsd = Math.abs(Number(change.amount)) * Number(change.priceUsd ?? priceUsd);
          if (Number.isFinite(computedValueUsd)) {
            change.valueUsd = computedValueUsd;
            changed = true;
          }
        }
      };

      for (const change of tx.balanceChanges) {
        enrichSwapChange(change);
      }

      for (const change of tx.feeChanges) {
        enrichSwapChange(change);
      }

      enrichSwapChange(tx.sold);
      enrichSwapChange(tx.bought);

      const hasTotalValueUsd = tx.totalValueUsd != null && Number.isFinite(Number(tx.totalValueUsd));
      if (!hasTotalValueUsd) {
        const fallbackCandidates = [
          Number(tx.sold?.valueUsd),
          Number(tx.bought?.valueUsd),
          ...tx.balanceChanges.map((change) => Number(change.valueUsd)),
        ];

        const derivedTotalValueUsd = fallbackCandidates.find(
          (value) => Number.isFinite(value) && value > 0,
        );

        if (derivedTotalValueUsd != null) {
          tx.totalValueUsd = derivedTotalValueUsd;
          changed = true;
        }
      }

      if (changed) {
        swapEnrichedCount += 1;
      }
    }

    console.log("[enrichWithSolanaTokenPrices] Enrichment summary", {
      processed: transactions.length,
      tokenMetaCount: tokenMetaByKey.size,
      marketPriceCount: marketPriceByKey.size,
      transactionEnrichedCount,
      transferEnrichedCount,
      swapEnrichedCount,
    });
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

export function resolveWalletTimeRangeSec(
  timePeriod: WalletTimePeriod,
  nowSec = Math.floor(Date.now() / 1000),
): { fromSec: number; toSec: number } {
  const nowMs = nowSec * 1000;
  const fromMs = getRangeStartMs(nowMs, timePeriod);
  return {
    fromSec: Math.max(0, Math.floor(fromMs / 1000)),
    toSec: nowSec,
  };
}

export function clampChartPointsPerChunk(limit?: number): number {
  const parsed = Number(limit ?? DEFAULT_CHART_POINTS_PER_CHUNK);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHART_POINTS_PER_CHUNK;
  }

  const normalized = Math.floor(parsed);
  if (normalized < 1) {
    return 1;
  }

  if (normalized > MAX_CHART_POINTS_PER_CHUNK) {
    return MAX_CHART_POINTS_PER_CHUNK;
  }

  return normalized;
}

function resolveChartTransactionLimit(pointLimit: number): number {
  const estimated = Math.max(
    DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS,
    pointLimit * 20,
  );

  return Math.min(estimated, MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS);
}

function resolveBalanceAggregationByGapSec(gapSec: number): ChartAggregation {
  if (gapSec > 2 * 365 * DAY_SEC) {
    return "monthly";
  }

  if (gapSec > 120 * DAY_SEC) {
    return "weekly";
  }

  return "daily";
}

function getBalanceAggregationIntervalMs(aggregation: ChartAggregation): number {
  if (aggregation === "monthly") {
    return 30 * DAY_MS;
  }

  if (aggregation === "weekly") {
    return 7 * DAY_MS;
  }

  return DAY_MS;
}

function resolvePnLAggregationByGap(
  aggregation: PnLAggregation,
  gapSec: number,
): PnLAggregation {
  if (gapSec > 2 * 365 * DAY_SEC) {
    return "monthly";
  }

  if (gapSec > 180 * DAY_SEC && aggregation === "daily") {
    return "weekly";
  }

  return aggregation;
}

function resolveChunkWindow(args: {
  requestedFromSec: number;
  requestedToSec: number;
  chunkToSec?: number;
  limit: number;
  intervalSec: number;
}): {
  chunkFromSec: number;
  chunkToSec: number;
  hasMore: boolean;
  nextChunkToSec: number | null;
} {
  const requestedFromSec = Math.max(0, Math.floor(args.requestedFromSec));
  const requestedToSec = Math.max(requestedFromSec, Math.floor(args.requestedToSec));
  const normalizedToSec = Math.min(
    requestedToSec,
    Math.max(requestedFromSec, Math.floor(args.chunkToSec ?? requestedToSec)),
  );
  const safeLimit = Math.max(1, Math.floor(args.limit));
  const safeIntervalSec = Math.max(1, Math.floor(args.intervalSec));
  const windowSpanSec = Math.max(safeIntervalSec, (safeLimit - 1) * safeIntervalSec);

  const chunkFromSec = Math.max(requestedFromSec, normalizedToSec - windowSpanSec);
  const hasMore = chunkFromSec > requestedFromSec;
  const nextChunkToSec = hasMore
    ? Math.max(requestedFromSec, chunkFromSec - safeIntervalSec)
    : null;

  return {
    chunkFromSec,
    chunkToSec: normalizedToSec,
    hasMore,
    nextChunkToSec,
  };
}