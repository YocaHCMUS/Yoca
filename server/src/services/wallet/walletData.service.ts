import {
  WALLET_EXCHANGE_COUNTS_TTL_MS,
  WALLET_OVERVIEW_TTL_MS,
  WALLET_PORTFOLIO_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import type { WalletBalanceInsert } from "@sv/db/schema.js";
import {
  walletExchangeCountsCache,
  walletOverviewCache,
  walletPortfolioCache,
} from "@sv/db/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";
import getWalletBalances from "@sv/routes/balances.js";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import {
  getDailyTokenMarketChart,
  getHourlyTokenMarketChart,
} from "../tokens/token-chart.js";
import { getTokenHistoricalData } from "../tokens/token-history.js";
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
import * as birdeye from "@sv/util/util-birdeye.js";
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
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_SEC = 24 * 60 * 60;

type WalletHistoryRange = {
  fromSec: number;
  toSec: number;
};

let chainRepairPromise: Promise<void> | null = null;

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

function sumTotalAssetValueFromBalances(balances: WalletBalanceInsert[]): number {
  return balances.reduce((sum, bal) => sum + Number(bal.totalValueUsd ?? bal.valueUsd ?? 0), 0);
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

export async function getWalletOverview(
  address: string,
  chain: SupportedChain,
): Promise<WalletOverview> {
  const effectiveChain = resolveChainForAddress(address, chain);

  // 0) DB-first: use cached overview if fresh
  const overviewThreshold = new Date(Date.now() - WALLET_OVERVIEW_TTL_MS);
  const cached = await db
    .select()
    .from(walletOverviewCache)
    .where(
      and(
        eq(walletOverviewCache.address, address),
        eq(walletOverviewCache.chain, effectiveChain),
      ),
    )
    .limit(1);
  if (cached.length > 0 && cached[0].fetchedAt >= overviewThreshold) {
    const row = cached[0];
    return {
      address,
      chain: effectiveChain,
      totalAssetValueUsd: Number(row.totalAssetValueUsd),
      tradingVolumeUsd24h: row.tradingVolumeUsd24h != null ? Number(row.tradingVolumeUsd24h) : null,
      pnlUsdTotal: row.pnlUsdTotal != null ? Number(row.pnlUsdTotal) : null,
      transactionCount24h: row.transactionCount24h,
      tokensTradedCount: row.tokensTradedCount,
      tokensHoldingCount: row.tokensHoldingCount,
    };
  }

  // 1) Try DB first via existing balances service
  let balances: WalletBalanceInsert[] | null = null;

  try {
    // getWalletBalances already implements DB-first with TTL and external fetch as fallback
    const res = getWalletBalances.get(address) as unknown as WalletBalanceInsert[] | null;
    if (res && res.length > 0) {
      balances = res;
    }
  } catch {
    // ignore and fall through to external APIs
  }

  if (balances && balances.length > 0) {
    const totalAssetValueUsd = sumTotalAssetValueFromBalances(balances);
    const overview: WalletOverview = {
      address,
      chain: effectiveChain,
      totalAssetValueUsd,
      tokensHoldingCount: balances.length,
      tradingVolumeUsd24h: null,
      pnlUsdTotal: null,
      transactionCount24h: null,
      tokensTradedCount: null,
    };
    await saveOverviewCache(overview);
    return overview;
  }

  // 2) Fallback to external APIs when DB has no data
  if (effectiveChain === "solana") {
    // Prefer Helius DAS getAssetsByOwner for Solana overview (total asset value + holdings).
    let heliusPortfolio: WalletPortfolioItem[] = [];
    try {
      heliusPortfolio = await fetchHeliusSolanaPortfolio(address);
    } catch (err) {
      console.error("Failed to fetch Solana overview from Helius", err);
    }

    const totalAssetValueUsd = heliusPortfolio.reduce(
      (sum, item) => sum + Number(item.valueUsd ?? 0),
      0,
    );

    // Fetch recent transactions to enrich overview metrics (24h window)
    let transactionCount24h: number | null = null;
    let tokensTradedCount: number | null = null;
    let tradingVolumeUsd24h: number | null = null;
    let pnlUsd24h: number | null = null;

    try {
      // const txs = await getWalletTransactionHelius(address, effectiveChain, { limit: 500 });
      // const txs = await getWalletSwaps(address, effectiveChain, {from: "24h"});
      const txs = await getWalletTransactionHelius(address, effectiveChain, { from: "24h" });


      // const now = Date.now();
      // const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      // // const recent = txs.transactions.filter((tx) => {
      // const recent = txs.swaps.filter((tx) => {
      //   const ts = Date.parse(tx.timestamp);
      //   if (Number.isNaN(ts)) return false;
      //   return now - ts <= ONE_DAY_MS;
      // });
      const recent = txs.transactions

      transactionCount24h = recent.length;
      // transactionCount24h = txs.swaps.length;

      const tokenSet = new Set<string>();
      const mintSet = new Set<string>();
      for (const tx of recent) {
        if (Array.isArray(tx.balanceChanges)) {
          tx.balanceChanges.forEach((change) => {
            const mintRaw = String(change?.mint ?? "").trim();
            if (!mintRaw) return;
            const mint = mintRaw === "SOL" ? SOL_MINT : mintRaw;
            tokenSet.add(mint);
            mintSet.add(mint);
          });
        }
      }
      tokensTradedCount = tokenSet.size;

      if (recent.length > 0 && mintSet.size > 0) {
        const marketData = await getTokenMarketData(Array.from(mintSet));

        let volumeAcc = 0;
        let pnlAcc = 0;
        let pricedChanges = 0;

        for (const tx of recent) {
          let txDeltaUsd = 0;
          for (const change of tx.balanceChanges ?? []) {
            const mintRaw = String(change?.mint ?? "").trim();
            if (!mintRaw) continue;
            const mint = mintRaw === "SOL" ? SOL_MINT : mintRaw;
            const priceUsd = marketData[mint]?.priceUsd;
            if (priceUsd == null || !Number.isFinite(priceUsd)) continue;

            const amountRaw = Number(change?.amount ?? 0);
            const decimals = Number(change?.decimals ?? 0);
            if (!Number.isFinite(amountRaw) || !Number.isFinite(decimals)) continue;

            const normalizedAmount = amountRaw / 10 ** Math.max(0, decimals);
            txDeltaUsd += normalizedAmount * priceUsd;
            pricedChanges += 1;
          }

          pnlAcc += txDeltaUsd;
          volumeAcc += Math.abs(txDeltaUsd);
        }

        if (pricedChanges > 0) {
          tradingVolumeUsd24h = volumeAcc;
          pnlUsd24h = pnlAcc;
        }
      }
    } catch {
      // soft-fail: leave metrics as null if anything goes wrong
    }

    const overview: WalletOverview = {
      address,
      chain: effectiveChain,
      totalAssetValueUsd,
      tokensHoldingCount: heliusPortfolio.length,
      tradingVolumeUsd24h,
      pnlUsdTotal: pnlUsd24h,
      transactionCount24h,
      tokensTradedCount,
    };
    await saveOverviewCache(overview);
    return overview;

    /*
    // Previous Birdeye-based implementation for Solana overview (kept for reference).
    // Uncomment if you want to switch back to Birdeye current-net-worth in the future.
    //
    // const endpoint = birdeye.getEndpoint("/wallet/v2/current-net-worth");
    // endpoint.search = new URLSearchParams({
    //   wallet: address,
    //   sort_type: "desc",
    // }).toString();
    //
    // let items: any[] = [];
    // let totalAssetValueUsd = 0;
    //
    // try {
    //   const resp = await birdeye.birdeyeFetch(endpoint, {
    //     method: "GET",
    //     headers: birdeye.getRequiredHeaders("solana"),
    //   });
    //
    //   if (resp.ok) {
    //     const payload = await resp.json();
    //     const data = payload?.data;
    //     items = Array.isArray(data?.items) ? data.items : [];
    //     totalAssetValueUsd = Number(data?.total_value ?? 0);
    //   } else {
    //     console.error(
    //       "Birdeye current-net-worth error",
    //       resp.status,
    //       resp.statusText,
    //     );
    //   }
    // } catch (err) {
    //   console.error("Birdeye current-net-worth request failed", err);
    // }
    //
    // const overview: WalletOverview = {
    //   address,
    //   chain: effectiveChain,
    //   totalAssetValueUsd,
    //   tokensHoldingCount: items.length,
    //   tradingVolumeUsd24h: null,
    //   pnlUsdTotal: null,
    //   transactionCount24h,
    //   tokensTradedCount,
    // };
    // await saveOverviewCache(overview);
    // return overview;
    */
  }

  // EVM chains – use Moralis wallets/:address/tokens (includes USD prices and 24h change)
  const endpoint = moralis.getEndpoint(`/wallets/${address}/tokens`);
  const searchParams = new URLSearchParams();
  if (effectiveChain) {
    searchParams.set("chain", effectiveChain);
  }
  searchParams.set("limit", "100");
  endpoint.search = searchParams.toString();

  let tokenItems: Array<{
    token_address: string;
    name: string;
    symbol: string;
    decimals: number | string;
    balance: string;
    balance_formatted?: string;
    usd_price?: number;
    usd_value?: number;
    usd_price_24hr_percent_change?: number;
  }> = [];
  let totalAssetValueUsd = 0;

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: moralis.getRequiredHeaders(),
    });

    if (!resp.ok) {
      console.error("Moralis wallets/tokens error", resp.status, resp.statusText);
    } else {
      const data = await resp.json();
      const result = Array.isArray(data?.result) ? data.result : [];
      tokenItems = result;
      totalAssetValueUsd = result.reduce(
        (sum: number, t: any) => sum + Number(t?.usd_value ?? 0),
        0,
      );
    }
  } catch (err) {
    console.error("Moralis wallets/tokens request failed", err);
  }

  // Derive tokens traded count and transaction count over recent history
  let transactionCount24h: number | null = null;
  let tokensTradedCount: number | null = null;
  let tradingVolumeUsd24h: number | null = null;
  let pnlUsd24h: number | null = null;
  try {
    const txs = await getWalletTransactionHelius(address, effectiveChain, { limit: 500 });
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const recent = txs.transactions.filter((tx) => {
      const ts = Date.parse(tx.timestamp);
      if (Number.isNaN(ts)) return false;
      return now - ts <= ONE_DAY_MS;
    });

    transactionCount24h = recent.length;

    const mintSet = new Set<string>();
    for (const tx of recent) {
      for (const change of tx.balanceChanges ?? []) {
        const mintRaw = String(change?.mint ?? "").trim();
        if (!mintRaw) continue;
        const mint = mintRaw === "SOL" ? SOL_MINT : mintRaw;
        mintSet.add(mint);
      }
    }
    tokensTradedCount = mintSet.size;

    if (recent.length > 0 && mintSet.size > 0) {
      const marketData = await getTokenMarketData(Array.from(mintSet));

      let volumeAcc = 0;
      let pnlAcc = 0;
      let pricedChanges = 0;

      for (const tx of recent) {
        let txDeltaUsd = 0;
        for (const change of tx.balanceChanges ?? []) {
          const mintRaw = String(change?.mint ?? "").trim();
          if (!mintRaw) continue;
          const mint = mintRaw === "SOL" ? SOL_MINT : mintRaw;
          const priceUsd = marketData[mint]?.priceUsd;
          if (priceUsd == null || !Number.isFinite(priceUsd)) continue;

          const amountRaw = Number(change?.amount ?? 0);
          const decimals = Number(change?.decimals ?? 0);
          if (!Number.isFinite(amountRaw) || !Number.isFinite(decimals)) continue;

          const normalizedAmount = amountRaw / 10 ** Math.max(0, decimals);
          txDeltaUsd += normalizedAmount * priceUsd;
          pricedChanges += 1;
        }

        pnlAcc += txDeltaUsd;
        volumeAcc += Math.abs(txDeltaUsd);
      }

      if (pricedChanges > 0) {
        tradingVolumeUsd24h = volumeAcc;
        pnlUsd24h = pnlAcc;
      }
    }
  } catch (err) {
    console.error("Failed to derive EVM overview metrics from transactions", err);
  }

  const overview: WalletOverview = {
    address,
    chain: effectiveChain,
    totalAssetValueUsd,
    tokensHoldingCount: tokenItems.length,
    tradingVolumeUsd24h,
    pnlUsdTotal: pnlUsd24h,
    transactionCount24h,
    tokensTradedCount,
  };
  await saveOverviewCache(overview);
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
      return cachedData;
    }
    // If cached portfolio is empty (likely from an earlier failed API call),
    // fall through to external fetch instead of treating it as valid.
  }

  // 1) Try DB balances first
  try {
    const balances = getWalletBalances.get(address) as unknown as WalletBalanceInsert[] | null;
    if (balances && balances.length > 0) {
      const portfolio: WalletPortfolioItem[] = balances.map((b) => ({
        tokenAddress: b.tokenAddress,
        symbol: "",
        name: undefined,
        amount: Number(b.amount),
        priceUsd: undefined,
        valueUsd: Number(b.valueUsd),
      }));
      await db
        .insert(walletPortfolioCache)
        .values({ address, chain: effectiveChain, data: portfolio })
        .onConflictDoUpdate({
          target: [walletPortfolioCache.address, walletPortfolioCache.chain],
          set: { data: portfolio, fetchedAt: new Date() },
        });
      return portfolio;
    }
  } catch {
    // ignore and fall through
  }

  // 2) Fallback to external APIs
  if (effectiveChain === "solana") {
    // Prefer Helius DAS getAssetsByOwner for Solana portfolio data.
    // Birdeye implementation is kept below in comments for future reference.
    let heliusPortfolio: WalletPortfolioItem[] = [];
    try {
      heliusPortfolio = await fetchHeliusSolanaPortfolio(address);
    } catch (err) {
      console.error("Failed to fetch Solana portfolio from Helius", err);
    }

    if (heliusPortfolio.length > 0) {
      await db
        .insert(walletPortfolioCache)
        .values({ address, chain: effectiveChain, data: heliusPortfolio })
        .onConflictDoUpdate({
          target: [walletPortfolioCache.address, walletPortfolioCache.chain],
          set: { data: heliusPortfolio, fetchedAt: new Date() },
        });
      return heliusPortfolio;
    }

    // If Helius failed or returned no items, we currently return an empty portfolio.
    // The previous Birdeye-based implementation is preserved below in comments if you
    // want to re-enable it later.
    //
    // const endpoint = birdeye.getEndpoint("/wallet/v2/current-net-worth");
    // endpoint.search = new URLSearchParams({
    //   wallet: address,
    //   sort_type: "desc",
    // }).toString();
    //
    // let items: any[] = [];
    // try {
    //   const resp = await birdeye.birdeyeFetch(endpoint, {
    //     method: "GET",
    //     headers: birdeye.getRequiredHeaders("solana"),
    //   });
    //
    //   if (resp.ok) {
    //     const payload = await resp.json();
    //     items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    //   } else {
    //     console.error(
    //       "Birdeye current-net-worth error",
    //       resp.status,
    //       resp.statusText,
    //     );
    //   }
    // } catch (err) {
    //   console.error("Birdeye current-net-worth request failed", err);
    // }
    //
    // if (items.length > 0) {
    //   const portfolio: WalletPortfolioItem[] = items.map((item: any) => ({
    //     tokenAddress: String(item.address),
    //     symbol: String(item.symbol ?? ""),
    //     name: item.name ? String(item.name) : undefined,
    //     amount: Number(item.amount ?? 0),
    //     priceUsd: item.price !== undefined ? Number(item.price) : undefined,
    //     valueUsd: Number(item.value ?? 0),
    //   }));
    //   await db
    //     .insert(walletPortfolioCache)
    //     .values({ address, chain: effectiveChain, data: portfolio })
    //     .onConflictDoUpdate({
    //       target: [walletPortfolioCache.address, walletPortfolioCache.chain],
    //       set: { data: portfolio, fetchedAt: new Date() },
    //     });
    //   return portfolio;
    // }
    //
    // // If Birdeye failed or returned no items, do not cache empty array.
    // // Fall back to empty portfolio in API response.
    // return [];

    return [];
  }

  // EVM: use Moralis wallets/:address/tokens (includes usd_price, usd_value, 24h change)
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
  await db
    .insert(walletPortfolioCache)
    .values({ address, chain: effectiveChain, data: portfolio })
    .onConflictDoUpdate({
      target: [walletPortfolioCache.address, walletPortfolioCache.chain],
      set: { data: portfolio, fetchedAt: new Date() },
    });
  return portfolio;
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

const SOL_NATIVE_SYSTEM_ADDRESS = "11111111111111111111111111111111";

function normalizeMint(mint: unknown): string {
  const raw = String(mint ?? "").trim();
  if (!raw) {
    return "";
  }

  if (
    raw.toUpperCase() === "SOL" ||
    raw === SOL_NATIVE_SYSTEM_ADDRESS ||
    raw.toLowerCase() === SOL_MINT.toLowerCase()
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