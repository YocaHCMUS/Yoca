import { mapWithConcurrency } from "@sv/util/concurrency.js";
import type {
  BirdeyePnlDuration,
  BirdeyePnlSummary,
  BirdeyeTokenPnlDetailsToken,
  WalletTimePeriod,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import { fetchBirdeyeTokenPnLDetails } from "@sv/services/wallet/fetchers/walletDataFetcher.service.js";

interface WinrateBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

interface WalletWinrateData {
  walletAddress: string;
  walletName?: string;
  winrate: number;

  /** Total unique tokens traded in the selected period. */
  totalTrades: number;
  /** Tokens whose realized PnL is positive. */
  winningTrades: number;
  /** Tokens whose realized PnL is negative. */
  losingTrades: number;
  /** Tokens with zero / missing realized PnL in the selected period. */
  breakEvenTrades: number;
  /** Tokens that currently have unrealized PnL below zero. This can overlap with realized buckets. */
  unrealizedLossTrades: number;
  /** Tokens that have a non-zero realized PnL. */
  closedTrades: number;

  winningDistribution: WinrateBin[];
  losingDistribution: WinrateBin[];
  avgWinUsd: number;
  avgLossUsd: number;
  totalWinUsd: number;
  totalLossUsd: number;
  /** Realized PnL explained by token-level profit/loss buckets. */
  classifiedRealizedPnlUsd: number;
  /** Wallet realized PnL from Birdeye summary when available; otherwise token-level classified PnL. */
  realizedPnlUsd: number;
  /** Difference between wallet realized PnL and token-level classified PnL. Usually fees, missing token rows, or provider scope differences. */
  unclassifiedRealizedPnlUsd: number;
  /** Number of token detail rows used for classification after period filtering/capping. */
  classifiedTokenCount: number;
}

interface WinrateResponse {
  wallets: WalletWinrateData[];
  metadata: {
    period: string;
    timestamp: number;
  };
}

const MAX_WALLET_CHART_CONCURRENCY = 4;
const EPSILON = 1e-9;

const DISTRIBUTION_BINS = [
  { range: "0-5%", min: 0, max: 5 },
  { range: "5-10%", min: 5, max: 10 },
  { range: "10-20%", min: 10, max: 20 },
  { range: "20-50%", min: 20, max: 50 },
  { range: "50-100%", min: 50, max: 100 },
  { range: ">100%", min: 100, max: Infinity },
];

function mapPeriodToBirdeyeDuration(
  period: WalletTimePeriod,
): BirdeyePnlDuration {
  if (period === "24H") return "24h";
  if (period === "7D") return "7d";
  if (period === "30D") return "30d";
  if (period === "90D") return "90d";
  return "all";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function generateDistributionBins(pnlValues: number[]): WinrateBin[] {
  const bins = DISTRIBUTION_BINS.map((b) => ({ ...b, count: 0 }));

  for (const pnl of pnlValues) {
    const absPnl = Math.abs(pnl);
    for (const bin of bins) {
      if (absPnl >= bin.min && (absPnl < bin.max || bin.max === Infinity)) {
        bin.count++;
        break;
      }
    }
  }

  return bins.filter((b) => b.count > 0);
}

function getSummaryUniqueTokens(
  summary: BirdeyePnlSummary | null | undefined,
): number | null {
  const uniqueTokens = toFiniteNumber(summary?.unique_tokens);
  return uniqueTokens == null ? null : Math.max(0, Math.floor(uniqueTokens));
}

function getSummaryRealizedPnlUsd(
  summary: BirdeyePnlSummary | null | undefined,
): number | null {
  return toFiniteNumber(summary?.pnl?.realized_profit_usd);
}

function isPositiveNumber(value: unknown): boolean {
  const n = toFiniteNumber(value);
  return n != null && n > EPSILON;
}

function isNonZeroNumber(value: unknown): boolean {
  const n = toFiniteNumber(value);
  return n != null && Math.abs(n) > EPSILON;
}

function hasPeriodTradeActivity(token: BirdeyeTokenPnlDetailsToken): boolean {
  const counts = token.counts;
  const cashflow = token.cashflow_usd;
  const pnl = token.pnl;

  // Birdeye may return holding rows in token PnL details. For a period-based win rate,
  // only classify tokens with trade/cashflow evidence or non-zero realized PnL in that period.
  return (
    isPositiveNumber(counts?.total_trade) ||
    isPositiveNumber(counts?.total_buy) ||
    isPositiveNumber(counts?.total_sell) ||
    isPositiveNumber(cashflow?.total_invested) ||
    isPositiveNumber(cashflow?.total_sold) ||
    isNonZeroNumber(pnl?.realized_profit_usd)
  );
}

function getClassifiableTokens(
  tokens: BirdeyeTokenPnlDetailsToken[],
  summary: BirdeyePnlSummary | null | undefined,
): BirdeyeTokenPnlDetailsToken[] {
  const summaryUniqueTokens = getSummaryUniqueTokens(summary);
  const activityTokens = tokens.filter(hasPeriodTradeActivity);
  const candidates = activityTokens.length > 0 ? activityTokens : tokens;

  // The wallet overview uses summary.unique_tokens as the period "tokens traded" value.
  // Cap classified rows to the same denominator when Birdeye returns extra holding rows,
  // otherwise the topbar can show impossible counts such as 9 classified tokens while
  // the hero says only 4 tokens traded. Details are sorted by last_trade desc by the fetcher.
  if (
    summaryUniqueTokens != null &&
    summaryUniqueTokens > 0 &&
    candidates.length > summaryUniqueTokens
  ) {
    return candidates.slice(0, summaryUniqueTokens);
  }

  return candidates;
}

function calculateWinrate(
  tokens: BirdeyeTokenPnlDetailsToken[],
  summary: BirdeyePnlSummary | null,
) {
  const winningPnLs: number[] = [];
  const losingPnLs: number[] = [];
  let winningTrades = 0;
  let losingTrades = 0;
  let unrealizedLossTrades = 0;
  let totalWinUsd = 0;
  let totalLossUsd = 0;

  const classifiableTokens = getClassifiableTokens(tokens, summary);

  for (const token of classifiableTokens) {
    // Realized PnL is the only source used to classify closed profit/loss.
    // Do not use total_percent because it can mix realized and unrealized performance.
    const realizedPnlUsd = toFiniteNumber(token.pnl?.realized_profit_usd) ?? 0;
    const realizedPnlPercent = toFiniteNumber(
      token.pnl?.realized_profit_percent,
    );
    const unrealizedPnlUsd = toFiniteNumber(token.pnl?.unrealized_usd) ?? 0;

    if (unrealizedPnlUsd < -EPSILON) {
      unrealizedLossTrades++;
    }

    if (realizedPnlUsd > EPSILON) {
      winningTrades++;
      winningPnLs.push(realizedPnlPercent ?? realizedPnlUsd);
      totalWinUsd += realizedPnlUsd;
      continue;
    }

    if (realizedPnlUsd < -EPSILON) {
      losingTrades++;
      losingPnLs.push(realizedPnlPercent ?? realizedPnlUsd);
      totalLossUsd += Math.abs(realizedPnlUsd);
    }
  }

  const closedTrades = winningTrades + losingTrades;
  const summaryUniqueTokens = getSummaryUniqueTokens(summary);
  const totalTrades = Math.max(
    summaryUniqueTokens ?? classifiableTokens.length,
    closedTrades,
  );
  const breakEvenTrades = Math.max(totalTrades - closedTrades, 0);
  const classifiedRealizedPnlUsd = totalWinUsd - totalLossUsd;

  // Use Birdeye summary realized PnL as the wallet-level source of truth when available,
  // because this is the same source used by the wallet overview PnL card.
  const summaryRealizedPnlUsd = getSummaryRealizedPnlUsd(summary);
  const realizedPnlUsd = summaryRealizedPnlUsd ?? classifiedRealizedPnlUsd;
  const unclassifiedRealizedPnlUsd = realizedPnlUsd - classifiedRealizedPnlUsd;

  return {
    winningPnLs,
    losingPnLs,
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    unrealizedLossTrades,
    closedTrades,
    avgWinUsd: winningTrades > 0 ? totalWinUsd / winningTrades : 0,
    avgLossUsd: losingTrades > 0 ? totalLossUsd / losingTrades : 0,
    totalWinUsd,
    totalLossUsd,
    classifiedRealizedPnlUsd,
    realizedPnlUsd,
    unclassifiedRealizedPnlUsd,
    classifiedTokenCount: classifiableTokens.length,
  };
}

async function fetchAllTokenPnlDetails(
  walletAddress: string,
  duration: BirdeyePnlDuration,
): Promise<{
  tokens: BirdeyeTokenPnlDetailsToken[];
  summary: BirdeyePnlSummary | null;
}> {
  const allTokens: BirdeyeTokenPnlDetailsToken[] = [];
  let summary: BirdeyePnlSummary | null = null;
  let offset = 0;
  const limit = 100;

  while (true) {
    const pnlDetails = await fetchBirdeyeTokenPnLDetails(walletAddress, {
      limit,
      offset,
      duration,
    });

    if (!summary && pnlDetails.summary) {
      summary = pnlDetails.summary;
    }

    const tokens = Array.isArray(pnlDetails.tokens) ? pnlDetails.tokens : [];
    if (tokens.length === 0) break;

    allTokens.push(...tokens);

    if (tokens.length < limit) break;
    offset += limit;
  }

  return { tokens: allTokens, summary };
}

async function calculateWalletWinrate(
  walletAddress: string,
  walletName: string,
  timePeriod: WalletTimePeriod,
): Promise<WalletWinrateData> {
  let tokens: BirdeyeTokenPnlDetailsToken[] = [];
  let summary: BirdeyePnlSummary | null = null;

  try {
    const duration = mapPeriodToBirdeyeDuration(timePeriod);

    // Fetch PnL details for the exact selected period so closed Win/Loss and Avg Win/Loss
    // use the same timeframe as the wallet overview.
    const result = await fetchAllTokenPnlDetails(walletAddress, duration);
    tokens = result.tokens;
    summary = result.summary;

    console.log(
      `[WalletWinrate] Fetched ${tokens.length} token PnL rows for ${walletAddress}, duration=${duration}, unique_tokens=${summary?.unique_tokens ?? "n/a"}`,
    );
  } catch (error) {
    console.error(
      `[WalletWinrate] Failed to fetch PnL details for ${walletAddress}:`,
      error,
    );
  }

  const winrateStats = calculateWinrate(tokens, summary);

  if (winrateStats.totalTrades === 0) {
    return {
      walletAddress,
      walletName,
      winrate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      unrealizedLossTrades: 0,
      closedTrades: 0,
      winningDistribution: [],
      losingDistribution: [],
      avgWinUsd: 0,
      avgLossUsd: 0,
      totalWinUsd: 0,
      totalLossUsd: 0,
      classifiedRealizedPnlUsd: 0,
      realizedPnlUsd: 0,
      unclassifiedRealizedPnlUsd: 0,
      classifiedTokenCount: 0,
    };
  }

  // Token Win Rate answers: among all tokens traded in this period, how many generated realized profit?
  const winrate = (winrateStats.winningTrades / winrateStats.totalTrades) * 100;

  return {
    walletAddress,
    walletName,
    winrate: Math.round(winrate * 100) / 100,
    totalTrades: winrateStats.totalTrades,
    winningTrades: winrateStats.winningTrades,
    losingTrades: winrateStats.losingTrades,
    breakEvenTrades: winrateStats.breakEvenTrades,
    unrealizedLossTrades: winrateStats.unrealizedLossTrades,
    closedTrades: winrateStats.closedTrades,
    winningDistribution: generateDistributionBins(winrateStats.winningPnLs),
    losingDistribution: generateDistributionBins(winrateStats.losingPnLs),
    avgWinUsd: winrateStats.avgWinUsd,
    avgLossUsd: winrateStats.avgLossUsd,
    totalWinUsd: winrateStats.totalWinUsd,
    totalLossUsd: winrateStats.totalLossUsd,
    classifiedRealizedPnlUsd: winrateStats.classifiedRealizedPnlUsd,
    realizedPnlUsd: winrateStats.realizedPnlUsd,
    unclassifiedRealizedPnlUsd: winrateStats.unclassifiedRealizedPnlUsd,
    classifiedTokenCount: winrateStats.classifiedTokenCount,
  };
}

export async function getWinrateData(
  wallets: string[] = [],
  period: WalletTimePeriod = "30D",
): Promise<WinrateResponse> {
  console.log(
    `[getWinrateData] Starting winrate calculation for period: ${period}, wallets: ${wallets.join(", ")}`,
  );

  const normalizedWallets = wallets.map((w) => w.trim()).filter(Boolean);

  if (normalizedWallets.length === 0) {
    return {
      wallets: [],
      metadata: {
        period,
        timestamp: Date.now(),
      },
    };
  }

  const winrateItems = await mapWithConcurrency(
    normalizedWallets,
    MAX_WALLET_CHART_CONCURRENCY,
    async (walletAddress) =>
      calculateWalletWinrate(walletAddress, walletAddress, period),
  );

  return {
    wallets: winrateItems,
    metadata: {
      period,
      timestamp: Date.now(),
    },
  };
}
