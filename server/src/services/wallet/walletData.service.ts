import {
  WALLET_EXCHANGE_COUNTS_TTL_MS,
  WALLET_OVERVIEW_TTL_MS,
  WALLET_PORTFOLIO_TTL_MS,
  WALLET_TRANSACTIONS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import type { WalletBalanceInsert } from "@sv/db/schema.js";
import {
  walletExchangeCountsCache,
  walletOverviewCache,
  walletPortfolioCache,
  walletTransactions,
  walletTransactionsMeta,
} from "@sv/db/schema.js";
import { and, desc, eq } from "drizzle-orm";
import getWalletBalances from "@sv/routes/balances.js";

async function saveTransactionsCache(
  address: string,
  chain: string,
  transactions: WalletTransaction[],
): Promise<void> {
  try {
    await db.delete(walletTransactions).where(
      and(
        eq(walletTransactions.address, address),
        eq(walletTransactions.chain, chain),
      ),
    );

    if (transactions.length > 0) {
      // Deduplicate by transaction hash to avoid multiple rows with the same
      // (address, chain, hash) primary key when providers return several
      // legs for a single on-chain transaction.
      const uniqueByHash = new Map<string, WalletTransaction>();
      for (const tx of transactions) {
        if (!uniqueByHash.has(tx.hash)) {
          uniqueByHash.set(tx.hash, tx);
        }
      }

      const uniqueTransactions = Array.from(uniqueByHash.values());

      const rows = uniqueTransactions.map((tx) => ({
        address,
        chain,
        hash: tx.hash,
        blockTimestamp: new Date(Date.parse(tx.timestamp) || Date.now()),
        fromAddress: tx.from,
        toAddress: tx.to,
        receiptStatus: tx.status === true ? 1 : tx.status === false ? 0 : null,
        fee: tx.fee ?? null,
        mainAction: tx.mainAction ?? null,
        direction: tx.direction ?? null,
        primaryTokenSymbol: tx.primaryTokenSymbol ?? null,
        primaryTokenAmount: tx.primaryTokenAmount ?? null,
        primaryTokenAddress: tx.primaryTokenAddress ?? null,
        priceUsd: tx.priceUsd ?? null,
        totalUsd: tx.totalUsd ?? null,
        tokens: tx.tokens ?? null,
      }));

      await db.insert(walletTransactions).values(rows);
    }
    await db
      .insert(walletTransactionsMeta)
      .values({ address, chain })
      .onConflictDoUpdate({
        target: [walletTransactionsMeta.address, walletTransactionsMeta.chain],
        set: { fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to save wallet transactions cache", err);
  }
}

async function saveOverviewCache(overview: WalletOverview): Promise<void> {
  try {
    await db
      .insert(walletOverviewCache)
      .values({
        address: overview.address,
        chain: overview.chain,
        totalAssetValueUsd: overview.totalAssetValueUsd,
        tradingVolumeUsd24h: overview.tradingVolumeUsd24h ?? null,
        pnlUsdTotal: overview.pnlUsdTotal ?? null,
        transactionCount24h: overview.transactionCount24h ?? null,
        tokensTradedCount: overview.tokensTradedCount ?? null,
        tokensHoldingCount: overview.tokensHoldingCount,
      })
      .onConflictDoUpdate({
        target: [walletOverviewCache.address, walletOverviewCache.chain],
        set: {
          totalAssetValueUsd: overview.totalAssetValueUsd,
          tradingVolumeUsd24h: overview.tradingVolumeUsd24h ?? null,
          pnlUsdTotal: overview.pnlUsdTotal ?? null,
          transactionCount24h: overview.transactionCount24h ?? null,
          tokensTradedCount: overview.tokensTradedCount ?? null,
          tokensHoldingCount: overview.tokensHoldingCount,
          fetchedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("Failed to save wallet overview cache", err);
  }
}
import * as birdeye from "@sv/util/util-birdeye.js";
import * as moralis from "@sv/util/util-moralis.js";

export type SupportedChain = "solana" | "eth" | "polygon" | "bsc" | string;

export interface WalletOverview {
  address: string;
  chain: SupportedChain;
  totalAssetValueUsd: number;
  tradingVolumeUsd24h: number | null;
  pnlUsdTotal: number | null;
  transactionCount24h: number | null;
  tokensTradedCount: number | null;
  tokensHoldingCount: number;
}

export interface WalletPortfolioItem {
  tokenAddress: string;
  symbol: string;
  name?: string;
  amount: number;
  priceUsd?: number;
  valueUsd: number;
  change24hPercent?: number;
}

async function fetchHeliusSolanaPortfolio(
  address: string,
): Promise<WalletPortfolioItem[]> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.error("HELIUS_API_KEY is not set; falling back to other providers.");
    return [];
  }

  const portfolio: WalletPortfolioItem[] = [];

  const baseUrl =
    process.env.HELIUS_WALLET_API_BASE_URL && process.env.HELIUS_WALLET_API_BASE_URL.length > 0
      ? process.env.HELIUS_WALLET_API_BASE_URL
      : "https://api.helius.xyz";

  let page = 1;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = new URL(`${baseUrl}/v1/wallet/${address}/balances`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("showZeroBalance", "false");
    url.searchParams.set("showNative", "true");
    // NFTs are not our current focus; exclude them to reduce payload size.
    url.searchParams.set("showNfts", "false");

    let json: any;
    try {
      const resp = await fetch(url, {
        method: "GET",
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

async function fetchHeliusSolanaTransactions(
  address: string,
  maxCount: number,
): Promise<WalletTransaction[]> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    console.error("HELIUS_API_KEY is not set; cannot fetch Solana transactions from Helius.");
    return [];
  }

  const baseUrl =
    process.env.HELIUS_WALLET_API_BASE_URL && process.env.HELIUS_WALLET_API_BASE_URL.length > 0
      ? process.env.HELIUS_WALLET_API_BASE_URL
      : "https://api.helius.xyz";

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
    const url = new URL(`${baseUrl}/v1/wallet/${address}/transfers`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("limit", String(Math.min(100, maxCount - transactions.length)));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    let json: any = null;
    try {
      const resp = await fetch(url, {
        method: "GET",
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
      if (tsSec == null || tsSec < fromSec) {
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
          ? amountRaw /  10 ** decimal
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
        priceUsd: undefined,
        totalUsd: undefined,
      };

      transactions.push(txObj);
    }

    const hasMore = Boolean(json?.pagination?.hasMore);
    cursor =
      typeof json?.pagination?.nextCursor === "string" &&
      json.pagination.nextCursor.length > 0
        ? json.pagination.nextCursor
        : null;

    if (!hasMore || !cursor) {
      break;
    }
  }

  return transactions;
}

export interface WalletTransaction {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  status: boolean | null;
  fee?: number;
  mainAction?: string;
  direction?: "in" | "out" | "self" | "unknown";
  tokens?: string[];
  primaryTokenSymbol?: string;
  primaryTokenAmount?: number;
  primaryTokenAddress?: string;
  priceUsd?: number;
  totalUsd?: number;
}

export interface WalletTransactionsResponse {
  address: string;
  chain: SupportedChain;
  transactions: WalletTransaction[];
}

function toIsoTimestamp(value: unknown): string {
  console.log(`[toIsoTimestamp DEBUG] value: ${value}`)
  if (value instanceof Date) {
    const isNaN = Number.isNaN(value.getTime())
    const result = Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString()
    console.log(`[toIsoTimestamp DEBUG] value is date, result is: ${result}, is NaN: ${isNaN}`)
    return result;
  }

  if (typeof value === "string") {
    // Accept SQL datetime format like "YYYY-MM-DD HH:mm:ss".
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized);
    const result = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
    console.log(`[toIsoTimestamp DEBUG] value is string, result is: ${result}`)
    return result;
  }

  console.log(`[toIsoTimestamp DEBUG] unknowned value type, result is new date`)
  return new Date().toISOString();
}

function sumTotalAssetValueFromBalances(balances: WalletBalanceInsert[]): number {
  return balances.reduce((sum, bal) => sum + Number(bal.totalValueUsd ?? bal.valueUsd ?? 0), 0);
}

function isEvmAddress(address: string): boolean {
  return address.startsWith("0x") && address.length === 42;
}

function resolveChainForAddress(address: string, requestedChain: SupportedChain): SupportedChain {
  if (isEvmAddress(address)) {
    // For EVM addresses default to 'eth' if caller passed solana
    if (requestedChain === "solana" || !requestedChain) {
      return "eth";
    }
    return requestedChain;
  }
  // Non-0x address – default to solana for now
  if (!requestedChain || requestedChain === "solana") {
    return "solana";
  }
  return requestedChain;
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

    try {
      const txs = await getWalletTransactions(address, effectiveChain, { limit: 500 });
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const recent = txs.transactions.filter((tx) => {
        const ts = Date.parse(tx.timestamp);
        if (Number.isNaN(ts)) return false;
        return now - ts <= ONE_DAY_MS;
      });

      transactionCount24h = recent.length;

      const tokenSet = new Set<string>();
      for (const tx of recent) {
        if (Array.isArray(tx.tokens)) {
          tx.tokens.forEach((sym) => {
            if (sym) tokenSet.add(sym);
          });
        }
      }
      tokensTradedCount = tokenSet.size;
    } catch {
      // soft-fail: leave metrics as null if anything goes wrong
    }

    const overview: WalletOverview = {
      address,
      chain: effectiveChain,
      totalAssetValueUsd,
      tokensHoldingCount: heliusPortfolio.length,
      tradingVolumeUsd24h: null,
      pnlUsdTotal: null,
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
  try {
    const txs = await getWalletTransactions(address, effectiveChain, { limit: 500 });
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const recent = txs.transactions.filter((tx) => {
      const ts = Date.parse(tx.timestamp);
      if (Number.isNaN(ts)) return false;
      return now - ts <= ONE_DAY_MS;
    });

    transactionCount24h = recent.length;

    const tokenSet = new Set<string>();
    for (const tx of recent) {
      if (Array.isArray(tx.tokens)) {
        tx.tokens.forEach((sym) => {
          if (sym) tokenSet.add(sym);
        });
      }
    }
    tokensTradedCount = tokenSet.size;
  } catch (err) {
    console.error("Failed to derive EVM overview metrics from transactions", err);
  }

  const overview: WalletOverview = {
    address,
    chain: effectiveChain,
    totalAssetValueUsd,
    tokensHoldingCount: tokenItems.length,
    tradingVolumeUsd24h: null,
    pnlUsdTotal: null,
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

  // 0) DB-first: use cached transactions if fresh
  const txThreshold = new Date(Date.now() - WALLET_TRANSACTIONS_TTL_MS);
  const metaRows = await db
    .select()
    .from(walletTransactionsMeta)
    .where(
      and(
        eq(walletTransactionsMeta.address, address),
        eq(walletTransactionsMeta.chain, effectiveChain),
      ),
    )
    .limit(1);
  if (metaRows.length > 0 && metaRows[0].fetchedAt >= txThreshold) {
    const rows = await db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.address, address),
          eq(walletTransactions.chain, effectiveChain),
        ),
      )
      .orderBy(desc(walletTransactions.blockTimestamp))
      .limit(limit);

    // If cache has rows, use them; if it's empty, fall through to external API.
    if (rows.length > 0) {
      const transactions: WalletTransaction[] = rows.map((r) => ({
        hash: r.hash,
        timestamp: toIsoTimestamp(r.blockTimestamp),
        from: r.fromAddress,
        to: r.toAddress,
        status: r.receiptStatus === 1 ? true : r.receiptStatus === 0 ? false : null,
        fee: r.fee != null ? Number(r.fee) : undefined,
        mainAction: r.mainAction ?? undefined,
        direction: (r.direction as WalletTransaction["direction"]) ?? undefined,
        tokens: (r.tokens as string[]) ?? undefined,
        primaryTokenSymbol: r.primaryTokenSymbol ?? undefined,
        primaryTokenAmount: r.primaryTokenAmount != null ? Number(r.primaryTokenAmount) : undefined,
        primaryTokenAddress: r.primaryTokenAddress ?? undefined,
        priceUsd: r.priceUsd != null ? Number(r.priceUsd) : undefined,
        totalUsd: r.totalUsd != null ? Number(r.totalUsd) : undefined,
      }));
      return { address, chain: effectiveChain, transactions };
    }
  }

  if (effectiveChain === "solana") {
    // Use Helius getTransactionsForAddress to retrieve detailed token transfer
    // history for Solana wallets (replaces Birdeye wallet/v2/transfer). This
    // fetches up to `limit` successful transactions for the past month.
    const transactions = await fetchHeliusSolanaTransactions(address, limit);

    await saveTransactionsCache(address, effectiveChain, transactions);
    return {
      address,
      chain: effectiveChain,
      transactions,
    };

    /*
    // Previous Birdeye-based implementation (kept for reference).
    // Uncomment if you want to switch back to Birdeye wallet/v2/transfer in the future.
    //
    // const endpoint = birdeye.getEndpoint("/wallet/v2/transfer");
    //
    // const body: Record<string, unknown> = {
    //   wallet: address,
    //   sort_type: "desc",
    //   sort_by: "time",
    //   limit,
    //   offset: 0,
    // };
    //
    // if (options?.before) {
    //   body.cursor = options.before;
    // }
    //
    // let transfers: any[] = [];
    //
    // try {
    //   const resp = await birdeye.birdeyeFetch(endpoint, {
    //     method: "POST",
    //     headers: birdeye.getRequiredHeaders("solana"),
    //     body: JSON.stringify(body),
    //   });
    //
    //   if (!resp.ok) {
    //     console.error("Birdeye wallet/v2/transfer error", resp.status, resp.statusText);
    //   } else {
    //     const payload = await resp.json();
    //     transfers = Array.isArray(payload?.data) ? (payload.data as any[]) : [];
    //   }
    // } catch (err) {
    //   console.error("Birdeye wallet/v2/transfer request failed", err);
    // }
    //
    // const transactions: WalletTransaction[] = transfers.map((tx) => {
    //   const tokenInfo = (tx.token_info ?? {}) as {
    //     address?: string;
    //     symbol?: string;
    //     name?: string;
    //     decimals?: number;
    //   };
    //
    //   const primaryTokenSymbol =
    //     tokenInfo.symbol != null ? String(tokenInfo.symbol) : undefined;
    //   const primaryTokenAddress =
    //     tokenInfo.address != null ? String(tokenInfo.address) : undefined;
    //
    //   let primaryTokenAmount: number | undefined;
    //   if (tx.ui_amount != null) {
    //     primaryTokenAmount = Number(tx.ui_amount);
    //   } else if (tx.amount != null && tokenInfo.decimals != null) {
    //     const decimals = Number(tokenInfo.decimals);
    //     primaryTokenAmount = Number(tx.amount) / 10 ** decimals;
    //   }
    //
    //   const priceUsd =
    //     tx.price != null && !Number.isNaN(Number(tx.price))
    //       ? Number(tx.price)
    //       : undefined;
    //
    //   let totalUsd: number | undefined;
    //   if (tx.value != null && !Number.isNaN(Number(tx.value))) {
    //     totalUsd = Number(tx.value);
    //   } else if (primaryTokenAmount != null && priceUsd != null) {
    //     totalUsd = primaryTokenAmount * priceUsd;
    //   }
    //
    //   let direction: WalletTransaction["direction"] = "unknown";
    //   const flow = typeof tx.flow === "string" ? tx.flow : "";
    //   if (flow === "in" || flow === "out" || flow === "self") {
    //     direction = flow;
    //   } else {
    //     const fromAddr = String(tx.from_address ?? "").toLowerCase();
    //     const toAddr = String(tx.to_address ?? "").toLowerCase();
    //     const wallet = address.toLowerCase();
    //     if (fromAddr === wallet && toAddr === wallet) direction = "self";
    //     else if (toAddr === wallet) direction = "in";
    //     else if (fromAddr === wallet) direction = "out";
    //   }
    //
    //   const tokens: string[] = [];
    //   if (primaryTokenSymbol) {
    //     tokens.push(primaryTokenSymbol);
    //   } else if (primaryTokenAddress) {
    //     tokens.push(primaryTokenAddress);
    //   }
    //
    //   return {
    //     hash: String(tx.tx_hash),
    //     timestamp: String(tx.time ?? tx.unix_time),
    //     from: String(tx.from_address),
    //     to: String(tx.to_address),
    //     status: true,
    //     fee: undefined,
    //     mainAction: tx.action ? String(tx.action) : undefined,
    //     direction,
    //     tokens,
    //     primaryTokenSymbol,
    //     primaryTokenAmount,
    //     primaryTokenAddress,
    //     priceUsd,
    //     totalUsd,
    //   };
    // });
    //
    // await saveTransactionsCache(address, effectiveChain, transactions);
    // return {
    //   address,
    //   chain: effectiveChain,
    //   transactions,
    // };
    */
  }

  // EVM chains – Moralis wallet history (max limit 100 on free tier)
  const moralisLimit = Math.min(limit, 100);
  const endpoint = moralis.getEndpoint(`/wallets/${address}/history`);
  const params = new URLSearchParams();
  if (effectiveChain) {
    params.set("chain", effectiveChain);
  }
  params.set("order", "DESC"); // Required per Moralis docs example
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
      console.error("Moralis wallet history error", resp.status, resp.statusText, errBody.slice(0, 300));
    } else {
      const payload = await resp.json();
      result = Array.isArray(payload?.result) ? (payload.result as any[]) : [];
    }
  } catch (err) {
    console.error("Moralis wallet history request failed", err);
  }

  // First pass: collect unique token addresses and build transaction objects
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

    // Collect all token symbols from both ERC20 and native transfers
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

    // Determine primary token (prefer ERC20, fallback to native)
    const primaryErc20 = erc20Transfers[0];
    const primaryNative = nativeTransfers[0];

    let primaryTokenSymbol: string | undefined;
    let primaryTokenAmount: number | undefined;
    let primaryTokenAddress: string | null = null;

    if (primaryErc20) {
      // Use value_formatted if available (already formatted), otherwise calculate from value + decimals
      if (primaryErc20.value_formatted !== undefined) {
        primaryTokenAmount = Number(primaryErc20.value_formatted);
      } else {
        const decimals = Number(primaryErc20.token_decimals ?? 0);
        const raw = BigInt(primaryErc20.value ?? "0");
        primaryTokenAmount = Number(raw) / 10 ** decimals;
      }
      primaryTokenSymbol = String(primaryErc20.token_symbol ?? primaryErc20.token_name ?? "");
      primaryTokenAddress = primaryErc20.address ? String(primaryErc20.address) : null;
    } else if (primaryNative) {
      // Use value_formatted if available for native transfers
      if (primaryNative.value_formatted !== undefined) {
        primaryTokenAmount = Number(primaryNative.value_formatted);
      } else {
        const raw = BigInt(primaryNative.value ?? "0");
        primaryTokenAmount = Number(raw) / 10 ** 18; // ETH uses 18 decimals
      }
      primaryTokenSymbol = String(primaryNative.token_symbol ?? "ETH");
      // Native ETH doesn't have a contract address, use null
      primaryTokenAddress = null;
    }

    const txObj: WalletTransaction = {
      hash: String(tx.hash),
      timestamp: toIsoTimestamp(tx.block_timestamp),
      from: String(tx.from_address),
      to: String(tx.to_address),
      status: tx.receipt_status === "1" ? true : tx.receipt_status === "0" ? false : null,
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

  // Fetch prices for all unique token addresses
  const priceMap = new Map<string, number>();
  
  // Fetch prices in parallel (limit to avoid rate limits)
  const pricePromises = Array.from(tokenAddresses).slice(0, 50).map(async (tokenAddr) => {
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
    } catch (err) {
      // Silently fail for individual price fetches
    }
  });

  await Promise.all(pricePromises);

  // For native ETH, fetch price using WETH address as proxy (WETH price ≈ ETH price)
  let ethPrice: number | undefined;
  if (effectiveChain === "eth") {
    try {
      const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH on Ethereum
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
    } catch (err) {
      // Ignore ETH price fetch errors
    }
  }

  // Second pass: enrich transactions with prices and calculate totals
  const transactions: WalletTransaction[] = transactionsWithTokens.map(({ tx, tokenAddress }) => {
    let priceUsd: number | undefined;
    let totalUsd: number | undefined;

    if (tokenAddress && priceMap.has(tokenAddress)) {
      priceUsd = priceMap.get(tokenAddress);
      if (priceUsd !== undefined && tx.primaryTokenAmount !== undefined) {
        totalUsd = priceUsd * tx.primaryTokenAmount;
      }
    } else if (!tokenAddress && tx.primaryTokenSymbol === "ETH" && ethPrice !== undefined) {
      // Handle native ETH
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
  });

  await saveTransactionsCache(address, effectiveChain, transactions);
  console.log("[getWalletTransactions] fetched txs:");
  console.log(transactions)

  return {
    address,
    chain: effectiveChain,
    transactions,
  };
}

/** Exchange comparison item for chart (transaction count by platform). */
export interface WalletExchangeCountItem {
  name: string;
  deposits: number;
  withdrawals: number;
  depositsVolume: number;
  withdrawalsVolume: number;
}

export interface WalletExchangeCountsResponse {
  exchanges: WalletExchangeCountItem[];
  metadata: { period: string; metric: "count" | "volume" };
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

  // Calculate time range based on period
  const now = new Date();
  let startDate = new Date(now);
  switch (timePeriod) {
    case "7D":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30D":
      startDate.setDate(now.getDate() - 30);
      break;
    case "60D":
      startDate.setDate(now.getDate() - 60);
      break;
    case "90D":
      startDate.setDate(now.getDate() - 90);
      break;
    case "1Y":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "All":
      startDate = new Date(0); // Unix epoch
      break;
  }

  try {
    // 1. Get current portfolio (latest state)
    const currentPortfolio = await getWalletPortfolio(address, effectiveChain);
    const currentTotalValue = currentPortfolio.reduce(
      (sum, item) => sum + (item.valueUsd ?? 0),
      0
    );

    // Build a map of token addresses/symbols to current prices for fallback calculations
    const tokenPriceMap = new Map<string, number>();
    for (const item of currentPortfolio) {
      if (item.priceUsd && item.tokenAddress) {
        tokenPriceMap.set(item.tokenAddress, item.priceUsd);
      }
      if (item.priceUsd && item.symbol) {
        tokenPriceMap.set(item.symbol, item.priceUsd);
      }
    }

    // 2. Get transaction history (fetch more to reconstruct historical data)
    const txResponse = await getWalletTransactions(address, effectiveChain, { limit: 500 });
    const transactions = txResponse.transactions;

    // Filter transactions within the time period and sort by timestamp (oldest first)
    const relevantTxs = transactions
      .filter(tx => {
        const txDate = new Date(tx.timestamp);
        return txDate >= startDate && txDate <= now;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (relevantTxs.length === 0) {
      // No transactions in period, return flat line at current value
      return [
        {
          timestamp: startDate.getTime(),
          value: currentTotalValue,
          date: startDate.toISOString(),
        },
        {
          timestamp: now.getTime(),
          value: currentTotalValue,
          date: now.toISOString(),
        },
      ];
    }

    // Helper function to calculate transaction value in USD
    const calculateTxValue = (tx: WalletTransaction): number => {
      // 1. Use totalUsd if available
      if (tx.totalUsd != null && tx.totalUsd > 0) {
        return tx.totalUsd;
      }

      // 2. Calculate from primaryTokenAmount and priceUsd
      if (tx.primaryTokenAmount != null && tx.priceUsd != null && tx.priceUsd > 0) {
        return Math.abs(tx.primaryTokenAmount * tx.priceUsd);
      }

      // 3. Try to estimate using current token prices
      if (tx.primaryTokenAmount != null) {
        // Try to get current price for this token
        const tokenKey = tx.primaryTokenAddress || tx.primaryTokenSymbol;
        if (tokenKey && tokenPriceMap.has(tokenKey)) {
          const currentPrice = tokenPriceMap.get(tokenKey)!;
          return Math.abs(tx.primaryTokenAmount * currentPrice);
        }
      }

      // 4. No USD value available - return 0 (will not affect balance calculation significantly)
      return 0;
    };

    // 3. Build balance history data points
    const balanceHistory: BalanceDataPoint[] = [];
    
    // Start with current balance
    let runningBalance = currentTotalValue;
    
    // Walk backwards through transactions to estimate historical balances
    const reversedTxs = [...relevantTxs].reverse();
    
    for (let i = 0; i < reversedTxs.length; i++) {
      const tx = reversedTxs[i];
      const txDate = new Date(tx.timestamp);
      const txValue = calculateTxValue(tx);
      
      // Adjust running balance based on transaction direction
      if (tx.direction === "out") {
        // If funds went out, add them back to get previous balance
        runningBalance += txValue;
      } else if (tx.direction === "in") {
        // If funds came in, subtract them to get previous balance
        runningBalance -= txValue;
      }
      // For "self" or "unknown" direction, we don't adjust the balance
      
      // Add data point (going backwards in time)
      balanceHistory.unshift({
        timestamp: txDate.getTime(),
        value: Math.max(0, runningBalance), // Ensure non-negative
        date: txDate.toISOString(),
      });
    }
    
    // Add final data point with current balance
    balanceHistory.push({
      timestamp: now.getTime(),
      value: currentTotalValue,
      date: now.toISOString(),
    });

    // 4. Interpolate to create smoother daily data points
    const dailyBalances: BalanceDataPoint[] = [];
    const dayInMs = 24 * 60 * 60 * 1000;
    
    for (let date = new Date(startDate); date <= now; date = new Date(date.getTime() + dayInMs)) {
      const timestamp = date.getTime();
      
      // Find the most recent balance at or before this date
      let closestBalance = balanceHistory[0]?.value ?? currentTotalValue;
      for (const point of balanceHistory) {
        if (point.timestamp <= timestamp) {
          closestBalance = point.value;
        } else {
          break;
        }
      }
      
      dailyBalances.push({
        timestamp,
        value: closestBalance,
        date: date.toISOString(),
      });
    }

    return dailyBalances;
  } catch (error) {
    console.error("[WalletBalanceHistory] Error fetching balance history:", error);
    
    // Fallback: return current balance as flat line
    const currentPortfolio = await getWalletPortfolio(address, effectiveChain);
    const currentTotalValue = currentPortfolio.reduce(
      (sum, item) => sum + (item.valueUsd ?? 0),
      0
    );
    
    return [
      {
        timestamp: startDate.getTime(),
        value: currentTotalValue,
        date: startDate.toISOString(),
      },
      {
        timestamp: now.getTime(),
        value: currentTotalValue,
        date: now.toISOString(),
      },
    ];
  }
}

