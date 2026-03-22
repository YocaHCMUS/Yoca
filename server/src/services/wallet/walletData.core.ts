import {
  WALLET_OVERVIEW_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  walletOverviewCache,
} from "@sv/db/schema.js";
import { and, eq } from "drizzle-orm";
import { getTokenMeta } from "../tokens/token-info.js";
import {
  fetchBirdeyeOverallPnL,
  fetchBirdeyePortfolio,
  fetchHeliusSolanaPortfolio,

} from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";
import type {
  ChartAggregation,
  PnLAggregation,
  WalletExchangeCountsOptions,
  WalletPageInfo,
  WalletExchangeCountsResponse,
  WalletHistoryQueryOptions,
  WalletOverview,
  WalletOverviewQueryOptions,
  WalletOverviewTimePeriod,
  WalletPortfolioItem,
  WalletTimePeriodInput,
  WalletTimePeriod,
  WalletTransactionHelius,
  PriceTimelinePoint,
  WalletOverviewCacheRow,
  OverviewHoldingsSnapshot,
  OverviewActivitySnapshot,
  WalletProviderPolicy,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
  DAY_MS,
  DAY_SEC,
  DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS,
  DEFAULT_OVERVIEW_PERIOD_SEC,
  DEFAULT_OVERVIEW_TIME_PERIOD,
  DEFAULT_WALLET_PROVIDER_POLICY,
  MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS,
  MAX_PNL_SNAPSHOT_POINTS,
  SOL_MINT,
  SOL_NATIVE_ALIAS_MINT,
  SOL_SYSTEM_PROGRAM_ADDRESS,
  WALLET_TABLE_PAGE_SIZE,
} from "@sv/services/wallet/wallet.constants.js";
import { getWalletExchangeCountsWithFetcher } from "@sv/services/wallet/walletExchangeAggregation.service.js";
import {
  saveOverviewCache,
} from "./db/walletDataCacher.js";
import { getWalletTransactionHeliusFromSources } from "@sv/services/wallet/walletHistory.service.js";
import { getWalletSwaps } from "./walletTransfersSwaps.service.js";

export type { WalletOverviewTimePeriod, WalletTimePeriod };

export function toWalletPageInfo(input: {
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



export function resolveWalletProviderPolicy(envKey: string): WalletProviderPolicy {
  const raw = String(process.env[envKey] ?? DEFAULT_WALLET_PROVIDER_POLICY)
    .trim()
    .toLowerCase();

  if (raw === "birdeye") {
    return "birdeye";
  }

  if (raw === "fallback") {
    return "fallback";
  }

  return "helius";
}


export function mapTimePeriodToBirdeyeDuration(
  timePeriod: WalletTimePeriod,
): "all" | "90d" | "30d" | "7d" | "24h" {
  switch (timePeriod) {
    case "24H":
      return "24h";
    case "7D":
      return "7d";
    case "30D":
      return "30d";
    case "60D":
    case "90D":
      return "90d";
    case "1Y":
    case "All":
      return "all";
    default:
      return "30d";
  }
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

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function startOfUtcDaySec(inputSec: number): number {
  const date = new Date(Math.max(0, inputSec) * 1000);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000;
}

export function toIsoFromSec(inputSec: number): string {
  return new Date(Math.max(0, inputSec) * 1000).toISOString();
}

export function getDailySnapshotSecRange(fromSec: number, toSec: number): number[] {
  const startDay = startOfUtcDaySec(fromSec);
  const endDay = startOfUtcDaySec(toSec);

  const values: number[] = [];
  for (let cursor = endDay; cursor >= startDay; cursor -= DAY_SEC) {
    values.push(cursor);
  }

  return values;
}



function normalizeOverviewTimePeriod(
  timePeriod?: WalletOverviewTimePeriod,
): WalletOverviewTimePeriod {
  const normalized = String(timePeriod ?? DEFAULT_OVERVIEW_TIME_PERIOD).trim();
  if (
    normalized === "24H" ||
    normalized === "7D" ||
    normalized === "30D" ||
    normalized === "60D" ||
    normalized === "90D" ||
    normalized === "1Y" ||
    normalized === "All"
  ) {
    return normalized;
  }

  return DEFAULT_OVERVIEW_TIME_PERIOD;
}

function mapOverviewTimePeriodToPeriodSec(timePeriod: WalletOverviewTimePeriod): number {
  switch (timePeriod) {
    case "24H":
      return DAY_SEC;
    case "7D":
      return 7 * DAY_SEC;
    case "30D":
      return 30 * DAY_SEC;
    case "60D":
      return 60 * DAY_SEC;
    case "90D":
      return 90 * DAY_SEC;
    case "1Y":
      return 365 * DAY_SEC;
    case "All":
      return 365 * DAY_SEC;
    default:
      return DAY_SEC;
  }
}

function mapOverviewTimePeriodToBirdeyeDuration(
  timePeriod: WalletOverviewTimePeriod,
): "all" | "90d" | "30d" | "7d" | "24h" {
  if (timePeriod === "24H") {
    return "24h";
  }

  return mapTimePeriodToBirdeyeDuration(timePeriod);
}

export function normalizeShortHistoryPeriod(
  timePeriod?: WalletTimePeriodInput,
): "24h" | "7d" | undefined {
  if (!timePeriod) {
    return undefined;
  }

  return timePeriod === "24H" ? "24h" : "7d";
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

async function getLatestOverviewCacheRow(address: string): Promise<WalletOverviewCacheRow | null> {
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
    const birdeyePortfolio = await fetchBirdeyePortfolio(address);
    if (birdeyePortfolio.items.length > 0 || Number(birdeyePortfolio.totalAssetValueUsd ?? 0) > 0) {
      return {
        totalAssetValueUsd: toFiniteNumber(birdeyePortfolio.totalAssetValueUsd, 0),
        tokensHoldingCount: birdeyePortfolio.items.length,
        source: "birdeye-portfolio",
      };
    }
  } catch (err) {
    console.error("Failed to fetch Birdeye portfolio for overview holdings", err);
  }

  try {
    const heliusPortfolio = await fetchHeliusSolanaPortfolio(address);
    return {
      totalAssetValueUsd: heliusPortfolio.reduce(
        (sum, item) => sum + Number(item.valueUsd ?? 0),
        0,
      ),
      tokensHoldingCount: heliusPortfolio.length,
      source: "helius-portfolio-fallback",
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

async function buildActivitySnapshotFromProviders(
  address: string,
  timePeriod: WalletOverviewTimePeriod,
  cacheRow: WalletOverviewCacheRow | null,
  periodSec: number,
): Promise<{ activitySnapshot: OverviewActivitySnapshot; providerFailure: boolean }> {
  try {
    const birdeyeSummary = await fetchBirdeyeOverallPnL(address, {
      duration: mapOverviewTimePeriodToBirdeyeDuration(timePeriod),
    });

    const summary = birdeyeSummary.summary ?? undefined;
    const counts = summary?.counts ?? undefined;
    const cashflowUsd = summary?.cashflow_usd ?? undefined;
    const pnl = summary?.pnl ?? undefined;

    const totalInvested = toFiniteNumber(cashflowUsd?.total_invested, 0);
    const totalSold = toFiniteNumber(cashflowUsd?.total_sold, 0);
    const totalVolume = totalInvested + totalSold;
    const totalTrade = Number(counts?.total_trade);
    const uniqueTokens = Number(summary?.unique_tokens);
    const totalPnlUsd = Number(pnl?.total_usd);

    return {
      activitySnapshot: {
        transactionCount24h: Number.isFinite(totalTrade) ? totalTrade : null,
        tokensTradedCount: Number.isFinite(uniqueTokens) ? uniqueTokens : null,
        tradingVolumeUsd24h: Number.isFinite(totalVolume) ? totalVolume : null,
        pnlUsdTotal: Number.isFinite(totalPnlUsd) ? totalPnlUsd : null,
        pricedChangesCount: 0,
        source: "birdeye-overall-pnl",
      },
      providerFailure: false,
    };
  } catch (err) {
    console.error("[wallet-overview] Failed to compute activity snapshot from Birdeye", {
      address,
      periodSec,
      error: err,
    });

    if (cacheRow && periodSec === DEFAULT_OVERVIEW_PERIOD_SEC) {
      return {
        activitySnapshot: {
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
        },
        providerFailure: true,
      };
    }

    return {
      activitySnapshot: {
        transactionCount24h: null,
        tokensTradedCount: null,
        tradingVolumeUsd24h: null,
        pnlUsdTotal: null,
        pricedChangesCount: 0,
        source: "none",
      },
      providerFailure: true,
    };
  }
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

export function normalizePortfolioText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizePortfolioAddressKey(tokenAddress: string): string {
  return tokenAddress.trim().toLowerCase();
}

export function normalizePortfolioLookupAddress(tokenAddress: string): string {
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

export function shouldFillPortfolioText(value: string | undefined): boolean {
  const normalized = normalizePortfolioText(value);
  if (!normalized) {
    return true;
  }

  return PORTFOLIO_METADATA_PLACEHOLDERS.has(normalized.toLowerCase());
}

export function isMissingPortfolioLogoUri(value: string | undefined): boolean {
  return normalizePortfolioText(value) == null;
}

export function isValidPortfolioTokenAddress(tokenAddress: string | undefined): boolean {
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

export async function enrichWalletPortfolioMetadata(
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
  options?: WalletOverviewQueryOptions,
): Promise<WalletOverview> {
  const timePeriod = normalizeOverviewTimePeriod(options?.timePeriod);
  const periodSec = mapOverviewTimePeriodToPeriodSec(timePeriod);

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

  const {
    activitySnapshot,
    providerFailure: activityFetchFailed,
  } = await buildActivitySnapshotFromProviders(address, timePeriod, cacheRow, periodSec);

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
    timePeriod,
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
  return getWalletExchangeCountsWithFetcher(
    address,
    options,
    getWalletSwaps,
  );
}

export function getRangeStartMs(
  nowMs: number,
  timePeriod: WalletTimePeriod,
): number {
  if (timePeriod === "All") {
    return 0;
  }

  if (timePeriod === "24H") {
    return nowMs - DAY_MS;
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

export function getAggregationIntervalMs(aggregation: PnLAggregation): number {
  if (aggregation === "weekly") {
    return 7 * DAY_MS;
  }
  if (aggregation === "monthly") {
    return 30 * DAY_MS;
  }
  return DAY_MS;
}

export function normalizeMint(mint: unknown): string {
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

export function isSolSymbol(symbol: unknown): boolean {
  return String(symbol ?? "").trim().toUpperCase() === "SOL";
}

export function buildSnapshotTimestamps(
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

export function normalizePriceTimeline(
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

export function findPriceAtOrBefore(
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

export function toCurrentPriceFallback(
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

export function calculatePortfolioValueUsd(
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

export function resolveChartTransactionLimit(pointLimit: number): number {
  const estimated = Math.max(
    DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS,
    pointLimit * 20,
  );

  return Math.min(estimated, MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS);
}

export function resolveBalanceAggregationByGapSec(gapSec: number): ChartAggregation {
  if (gapSec > 2 * 365 * DAY_SEC) {
    return "monthly";
  }

  if (gapSec > 120 * DAY_SEC) {
    return "weekly";
  }

  return "daily";
}

export function getBalanceAggregationIntervalMs(aggregation: ChartAggregation): number {
  if (aggregation === "monthly") {
    return 30 * DAY_MS;
  }

  if (aggregation === "weekly") {
    return 7 * DAY_MS;
  }

  return DAY_MS;
}

export function resolvePnLAggregationByGap(
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

