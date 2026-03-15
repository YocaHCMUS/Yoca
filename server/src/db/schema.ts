import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  decimal as dec,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Decimal has "string" mode by default, due to how node-postgres saves
// decimal numbers to keep precisions, this overrides that so you can pass
// number into the inferred types of these fields
function decimal(name: string) {
  return dec(name, { mode: "number" });
}

// #region Table definitions
export const enumAuthProvider = pgEnum("auth_provider", [
  "password",
  "google",
  "github",
  "solana",
  "other",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: varchar("display_name"),
  // Email is not needed for wallet users, see it as contact
  email: varchar("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: enumAuthProvider("provider").notNull(),
    providerUserId: varchar("provider_user_id").notNull(),
    hashedPassword: varchar("hashed_password"),
    loginNounce: varchar("login_nounce"),
    nounceExpiredAt: timestamp("nounce_expired_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.providerUserId],
    }),
    check(
      "provider_password",
      sql`(${table.provider} = 'password' AND ${table.hashedPassword} IS NOT NULL)
          OR
          (${table.provider} <> 'password' AND ${table.hashedPassword} IS NULL)`,
    ),
  ],
);

export const tokenMeta = pgTable("token_meta", {
  address: varchar("address", { length: 44 }).primaryKey(),
  name: varchar("name").notNull(),
  symbol: varchar("symbol").notNull(),
  imageUrl: varchar("image_url"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenDetails = pgTable("token_details", {
  address: varchar("address", { length: 44 }).primaryKey(),
  decimals: integer("decimals").notNull(),
  coingeckoId: varchar("coingecko_id"),
  description: varchar("description"),
  linkHomepage: varchar("homepage"),
  linkDiscord: varchar("link_discord"),
  twitterScreenName: varchar("twitter_screen_name"),
  telegramChannel: varchar("telegram_channel"),
  linkBlockchainSites: varchar("link_blockchain_sites").array(),
  categories: varchar("categories").array(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar("address", { length: 44 }).primaryKey(),
  priceUsd: decimal("price_usd").notNull(),

  marketCapRank: integer("market_cap_rank"),
  high24h: decimal("high_24h"),
  low24h: decimal("low_24h"),

  priceChange24h: decimal("price_change_24h"),
  priceChangePercentage1h: decimal("price_change_percentage_1h"),
  priceChangePercentage24h: decimal("price_change_percentage_24h"),
  priceChangePercentage7d: decimal("price_change_percentage_7d"),
  priceChangePercentage14d: decimal("price_change_percentage_14d"),
  priceChangePercentage30d: decimal("price_change_percentage_30d"),
  priceChangePercentage200d: decimal("price_change_percentage_200d"),
  priceChangePercentage1y: decimal("price_change_percentage_1y"),

  marketCap: decimal("market_cap").notNull(),
  marketCapChange24h: decimal("market_cap_change_24h"),
  marketCapChangePercentage24h: decimal("market_cap_change_percentage_24h"),
  fullyDilutedValuation: decimal("fully_diluted_valuation").notNull(),

  volume24h: decimal("volume_24h").notNull(),
  circulatingSupply: decimal("circulating_supply"),
  maxSupply: decimal("max_supply"),
  totalSupply: decimal("total_supply"),

  ath: decimal("ath"),
  athChangePercentage: decimal("ath_change_percentage"),
  athDate: timestamp("ath_date"),
  atl: decimal("atl"),
  atlChangePercentage: decimal("atl_change_percentage"),
  atlDate: timestamp("atl_date"),

  sparkline7d: decimal("sparkline_7d").array(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const tokenPoolData = pgTable("token_pool_data", {
  poolAddress: varchar("address", { length: 44 }).primaryKey(),
  poolName: varchar("name"),

  baseAddress: varchar("base_address", { length: 44 }).notNull(),
  quoteAddress: varchar("quote_address", { length: 44 }).notNull(),

  dexId: varchar("dex_id"),

  poolCreatedAt: timestamp("pool_created_at"),
  liquidityUsd: decimal("liquidity_usd"),

  baseTokenPriceUsd: decimal("base_token_price_usd"),
  quoteTokenPriceUsd: decimal("quote_token_price_usd"),

  baseTokenPriceSol: decimal("base_token_price_sol"),
  quoteTokenPriceSol: decimal("quote_token_price_sol"),

  marketCapUsd: decimal("market_cap_usd"),
  fdvUsd: decimal("fdv_usd"),

  priceChangePercentage5m: decimal("price_change_percentage_5m"),
  priceChangePercentage1h: decimal("price_change_percentage_1h"),
  priceChangePercentage6h: decimal("price_change_percentage_6h"),
  priceChangePercentage24h: decimal("price_change_percentage_24h"),

  buys1h: decimal("buys_1h"),
  buys6h: decimal("buys_6h"),
  buys24h: decimal("buys_24h"),

  sells1h: decimal("sells_1h"),
  sells6h: decimal("sells_6h"),
  sells24h: decimal("sells_24h"),

  buyers1h: decimal("buyers_1h"),
  buyers6h: decimal("buyers_6h"),
  buyers24h: decimal("buyers_24h"),

  sellers1h: decimal("sellers_1h"),
  sellers6h: decimal("sellers_6h"),
  sellers24h: decimal("sellers_24h"),

  volumeUsd1h: decimal("volume_usd_1h"),
  volumeUsd6h: decimal("volume_usd_6h"),
  volumeUsd24h: decimal("volume_usd_24h"),

  buyVolumeUsd1h: decimal("buy_volume_usd_1h"),
  buyVolumeUsd6h: decimal("buy_volume_usd_6h"),
  buyVolumeUsd24h: decimal("buy_volume_usd_24h"),

  sellVolumeUsd1h: decimal("sell_volume_usd_1h"),
  sellVolumeUsd6h: decimal("sell_volume_usd_6h"),
  sellVolumeUsd24h: decimal("sell_volume_usd_24h"),

  updatedAt: timestamp("updated_at"),
  topPoolsUpdatedAt: timestamp("top_pools_updated_at"),
});

export const tokenTopPools = pgTable(
  "token_tops_pool",
  {
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    poolAddress: varchar("pool_address", { length: 44 }).notNull(),
    rank: integer("rank").notNull(),

    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.tokenAddress, table.rank],
    }),
  ],
);

export const tokenMarketChart24h = pgTable(
  "token_market_chart_24h",
  {
    address: varchar("address", { length: 44 }).notNull(),
    unixTimestampMs: bigint("unix_timestamp_ms", { mode: "number" }).notNull(),
    price: decimal("price").notNull(),
    marketCap: decimal("market_cap").notNull(),
    totalVolume: decimal("total_volume").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.address, table.unixTimestampMs],
    }),
  ],
);

export const tokenMarketChart30d = pgTable(
  "token_market_chart_30d",
  {
    address: varchar("address", { length: 44 }).notNull(),
    unixTimestampMs: bigint("unix_timestamp_ms", { mode: "number" }).notNull(),
    price: decimal("price").notNull(),
    marketCap: decimal("market_cap").notNull(),
    totalVolume: decimal("total_volume").notNull(),
    unixUpdatedAtMs: bigint("unix_updated_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.address, table.unixTimestampMs],
    }),
  ],
);

export const tokenMarketChartHourly = pgTable(
  "token_market_chart_hourly",
  {
    address: varchar("address", { length: 44 }).notNull(),
    unixTimestampMs: bigint("unix_timestamp_ms", { mode: "number" }).notNull(),
    price: decimal("price").notNull(),
    marketCap: decimal("market_cap").notNull(),
    totalVolume: decimal("total_volume").notNull(),
    unixUpdatedAtMs: bigint("unix_updated_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.address, table.unixTimestampMs],
    }),
  ],
);

export const tokenMarketChartDaily = pgTable(
  "token_market_chart_daily",
  {
    address: varchar("address", { length: 44 }).notNull(),
    unixTimestampMs: bigint("unix_timestamp_ms", { mode: "number" }).notNull(),
    price: decimal("price").notNull(),
    marketCap: decimal("market_cap").notNull(),
    totalVolume: decimal("total_volume").notNull(),
    unixUpdatedAtMs: bigint("unix_updated_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.address, table.unixTimestampMs],
    }),
  ],
);

export const tokenTransfers = pgTable(
  "token_transfers",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    fromOwner: varchar("from_address", { length: 44 }).notNull(),
    toOwner: varchar("to_address", { length: 44 }).notNull(),
    // In the according token units
    amount: decimal("amount").notNull(),
    amountUsd: decimal("amount_usd").notNull(),
    blockTime: timestamp("block_time").notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 10 }).notNull(),
    transactionSignature: varchar("transaction_signature", {
      length: 88,
    }).notNull(),
    instructionIndex: integer("instruction_index").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.transactionSignature, table.instructionIndex],
    }),
  ],
);

// Token holders info
export const tokenHolderStats = pgTable("token_holder_stats", {
  address: varchar("address", { length: 44 }).primaryKey(),
  holdersCount: integer("holders_count").notNull(),
  // Percentage of market cap held by top 10%
  top10Percent: decimal("top_10_percent").notNull(),
  rank11To30Percent: decimal("rank_11_to_30_percent").notNull(),
  rank31To50Percent: decimal("rank_31_to_50_percent").notNull(),
  rank51PlusPercent: decimal("rank_51_plus_percent").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const topTokenHolders = pgTable(
  "top_token_holders",
  {
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    holderAddress: varchar("holder_address", { length: 44 }).notNull(),
    rank: integer("rank").notNull(),
    percentage: decimal("percentage").notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.tokenAddress, table.rank],
    }),
  ],
);

export const wallets = pgTable("wallets", {
  address: varchar("address", { length: 44 }).primaryKey(),
  balanceCount: integer("balance_count").notNull().default(0),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const walletBalances = pgTable(
  "wallet_balances",
  {
    address: varchar("address", { length: 44 }).notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    totalValueUsd: decimal("total_value_usd").notNull(),
    // In the according token units
    amount: decimal("amount").notNull(),
    valueUsd: decimal("value_usd").notNull(),

    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.address, table.tokenAddress] })],
);

export const coinGeckoTokenListMeta = pgTable("coin_gecko_token_list_meta", {
  key: text("key").primaryKey(),
  lastRefresh: timestamp("last_refresh").notNull(),
});

// The point of cg token - id list is that it rarely changes, and when it does,
// it'd be better that we update all at once
export const coinGeckoTokenList = pgTable("coin_gecko_token_list", {
  tokenAddress: varchar("token_address", { length: 44 }).primaryKey(),
  // coinGeckId won't be unique during let's say an update that swaps two ids
  coinGeckoId: text("coin_gecko_id").notNull(),
});

// Trending tokens
export const trendingTokens = pgTable("trending_tokens", {
  address: varchar("address", { length: 44 }).primaryKey(),
  rank: integer("rank").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

// Top tokens by market cap
export const topTokensByMarketCap = pgTable("top_tokens_by_marketcap", {
  address: varchar("address", { length: 44 }).primaryKey(),
  rank: integer("rank").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const topTraders = pgTable("top_traders", {
  address: varchar("address", { length: 66 }).primaryKey(),
  rank: integer("rank").notNull(),
  pnl: decimal("pnl").notNull(),
  volume: decimal("volume").notNull(),
  tradeCount: integer("trade_count").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const poolTrades24h = pgTable("pool_trades_24h", {
  id: varchar("id", { length: 128 }).primaryKey(),

  poolAddress: varchar("pool_address", { length: 44 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 88 }).notNull(),

  signerAddress: varchar("signer_address", { length: 44 }).notNull(),

  sellTokenAmount: decimal("sell_token_amount").notNull(),
  buyTokenAmount: decimal("buy_token_amount").notNull(),

  sellTokenAddress: varchar("sell_token_address", { length: 44 }).notNull(),
  buyTokenAddress: varchar("buy_token_address", { length: 44 }).notNull(),

  sellTokenPriceUsd: decimal("sell_token_price_usd").notNull(),
  buyTokenPriceUsd: decimal("buy_token_price_usd").notNull(),

  blockTimestamp: timestamp("block_timestamp").notNull(),

  volumeInUsd: decimal("volume_in_usd").notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const recentTrades = pgTable("recent_trades", {
  // Underscore before name to signal this is synthetic field and is not
  // inferred from the actual data by any means (which usually discouraged)
  _tradeId: uuid("_trade_id").primaryKey().defaultRandom(),

  transactionHash: varchar("transaction_hash", { length: 88 }).notNull(),
  instructionIndex: integer("instruction_index"),
  // If instruction index is null, it doesn't mean the trade happened at top
  // leve instruction, Birdeye might just didn't have that information
  innerInstructionIndex: integer("inner_instruction_index"),

  baseSymbol: varchar("base_symbol"),
  baseAddress: varchar("base_address", { length: 44 }).notNull(),
  baseDecimals: integer("base_decimals"),
  basePrice: decimal("base_price"),
  baseAmount: varchar("base_amount"),

  quoteSymbol: varchar("quote_symbol"),
  quoteAddress: varchar("quote_address", { length: 44 }).notNull(),
  quoteDecimals: integer("quote_decimals"),
  quotePrice: decimal("quote_price"),
  quoteAmount: varchar("quote_amount"),

  blockUnixTime: integer("block_unix_time").notNull(),
  volumeUsd: decimal("volume_usd").notNull(),

  owner: varchar("owner", { length: 44 }).notNull(),
  source: varchar("source").notNull(),
  poolAddress: varchar("poolAddress", { length: 44 }).notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

// / --- Wallet API cache (DB-first: use cache if fresh, else fetch from Moralis/Birdeye) ---

export const walletOverviewCache = pgTable(
  "wallet_overview_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    totalAssetValueUsd: decimal("total_asset_value_usd").notNull(),
    tradingVolumeUsd24h: decimal("trading_volume_usd_24h"),
    pnlUsdTotal: decimal("pnl_usd_total"),
    transactionCount24h: integer("transaction_count_24h"),
    tokensTradedCount: integer("tokens_traded_count"),
    tokensHoldingCount: integer("tokens_holding_count").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

export const walletPortfolioCache = pgTable(
  "wallet_portfolio_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    data: jsonb("data")
      .$type<
        Array<{
          tokenAddress: string;
          symbol: string;
          name?: string;
          amount: number;
          priceUsd?: number;
          valueUsd: number;
          change24hPercent?: number;
        }>
      >()
      .notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

export const walletTransactionsMeta = pgTable(
  "wallet_transactions_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

export const walletSwapMeta = pgTable(
  "wallet_swap_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

export const walletTransferMeta = pgTable(
  "wallet_transfer_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

export const walletHeliusTransactions = pgTable(
  "wallet_helius_transactions",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    signature: text("signature").notNull(),
    timestamp: timestamp("block_timestamp").notNull(),
    slot: decimal("slot"),
    fee: decimal("fee"),
    feePayer: varchar("fee_payer", { length: 66 }).notNull(),
    balanceChanges: jsonb("transaction_balance_changes")
      .$type<Array<{ mint: string; amount: number; decimals: number }>>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain, t.signature] })],
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    hash: text("hash").notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    fromAddress: varchar("from_address", { length: 66 }).notNull(),
    toAddress: varchar("to_address", { length: 66 }).notNull(),
    receiptStatus: smallint("receipt_status"), // 1 success, 0 fail, null unknown
    fee: decimal("fee"),
    mainAction: text("main_action"),
    direction: text("direction"), // in | out | self | unknown
    primaryTokenSymbol: text("primary_token_symbol"),
    primaryTokenAmount: decimal("primary_token_amount"),
    primaryTokenAddress: varchar("primary_token_address", { length: 66 }),
    priceUsd: decimal("price_usd"),
    totalUsd: decimal("total_usd"),
    tokens: jsonb("tokens").$type<string[]>(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain, t.hash] })],
);

export const walletSwap = pgTable(
  "wallet_swap",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    signature: varchar("signature", { length: 128 }).notNull(),
    blockTimestamp: timestamp("block_timestamp").notNull(),
    slot: bigint("slot", { mode: "number" }).notNull(),
    fee: decimal("fee").notNull(),
    feePayer: varchar("fee_payer", { length: 66 }).notNull(),
    // First two entries are the swap legs
    swapBalanceChanges: jsonb("swap_balance_changes")
      .$type<Array<{ mint: string; amount: number; decimals: number }>>()
      .notNull(),
    // Remaining entries represent fee/rent/other adjustments
    feeBalanceChanges: jsonb("fee_balance_changes")
      .$type<Array<{ mint: string; amount: number; decimals: number }>>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain, t.signature] })],
);

export const walletExchangeCountsCache = pgTable(
  "wallet_exchange_counts_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    data: jsonb("data")
      .$type<{
        exchanges: Array<{
          name: string;
          deposits: number;
          withdrawals: number;
          depositsVolume: number;
          withdrawalsVolume: number;
        }>;
        metadata: { period: string; metric: string };
      }>()
      .notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

export const walletUserTags = pgTable(
  "wallet_user_tags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.walletAddress] })],
);

// #endregion

// #region Types
export type TokenMetaInsert = typeof tokenMeta.$inferInsert;
export type TokenDetailedInfoInsert = typeof tokenDetails.$inferInsert;
export type TokenMarketDataInsert = typeof tokenMarketData.$inferInsert;
export type WalletBalanceInsert = typeof walletBalances.$inferInsert;
export type UserInsert = typeof users.$inferInsert;
export type AuthAccountInsert = typeof authAccounts.$inferInsert;
export type TokenTransferInsert = typeof tokenTransfers.$inferInsert;
export type PoolTrade24hInsert = typeof poolTrades24h.$inferInsert;
export type TokenMarketChart24hInsert = typeof tokenMarketChart24h.$inferInsert;
export type TokenMarketChartHourlyInsert =
  typeof tokenMarketChartHourly.$inferInsert;
export type TokenMarketChartDailyInsert =
  typeof tokenMarketChartDaily.$inferInsert;
export type CoingeckoTokenListInsert = typeof coinGeckoTokenList.$inferInsert;
export type TokenTopPoolInsert = typeof tokenTopPools.$inferInsert;
export type TrendingTokenInsert = typeof trendingTokens.$inferInsert;
export type TokenHolderStatsInsert = typeof tokenHolderStats.$inferInsert;
export type RecentTradeInsert = typeof recentTrades.$inferInsert;
export type TokenPoolDataInsert = typeof tokenPoolData.$inferInsert;
export type TokenTopHolderInsert = typeof topTokenHolders.$inferInsert;
export type TopTokensByMarketCapInsert =
  typeof topTokensByMarketCap.$inferInsert;
export type TopTraderInsert = typeof topTraders.$inferInsert;
export type WalletOverviewCacheInsert = typeof walletOverviewCache.$inferInsert;
export type WalletPortfolioCacheInsert =
  typeof walletPortfolioCache.$inferInsert;
export type WalletTransactionsMetaInsert =
  typeof walletTransactionsMeta.$inferInsert;
export type WalletTransactionInsert = typeof walletTransactions.$inferInsert;
export type WalletSwapInsert = typeof walletSwap.$inferInsert;
export type WalletExchangeCountsCacheInsert =
  typeof walletExchangeCountsCache.$inferInsert;
export type walletHeliusTransactionsInsert =
  typeof walletHeliusTransactions.$inferInsert;
export type walletSwapMetaInsert = typeof walletSwapMeta.$inferInsert;
export type WalletUserTagsInsert = typeof walletUserTags.$inferInsert;
export type walletTransferMetaInsert = typeof walletTransferMeta.$inferInsert;

// #endregion
