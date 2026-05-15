// --- ACMS API call cache table ---
// export const acmsApiCache = pgTable("acms_api_cache", {
//   key: varchar("key", { length: 128 }).primaryKey(),
//   provider: varchar("provider", { length: 32 }).notNull(),
//   endpoint: varchar("endpoint", { length: 128 }).notNull(),
//   params: jsonb("params").notNull(),
//   result: jsonb("result").notNull(),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
//   updatedAt: timestamp("updated_at")
//     .notNull()
//     .defaultNow()
//     .$onUpdate(() => new Date()),
// });
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  decimal as dec,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
//export * from "./alerts.js";

// Decimal has "string" mode by default, due to how node-postgres saves
// decimal numbers to keep precisions, this overrides that so you can pass
// number into the inferred types of these fields
function decimal(name: string) {
  return dec(name, { mode: "number" });
}

// #region Enums
export const enumAuthProvider = pgEnum("auth_provider", [
  "password",
  "google",
  "github",
  "solana",
  "other",
]);

export const enumTradeAction = pgEnum("trade_action", ["buy", "sell"]);

export const enumAlertRuleAction = pgEnum("alert_rule_action", [
  "SWAP",
  "TRANSFER",
  "ALL",
]);

export const enumAlertRuleTrigger = pgEnum("alert_rule_trigger", [
  "ONCE",
  "ALWAYS",
]);

export const enumAlertRuleVolumeUnit = pgEnum("alert_rule_volume_unit", [
  "USD",
  "SOL",
]);

export const enumPlanTier = pgEnum("plan_tier", ["Lite", "Plus", "Pro"]);

export const enumSubscriptionStatus = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "trialing",
  "unpaid",
  "paused",
]);

export const enumPaymentStatus = pgEnum("payment_status", [
  "succeeded",
  "failed",
  "pending",
]);

// #endregion

// #region Table definitions

// --- ACMS API call cache table ---
export const acmsApiCache = pgTable("acms_api_cache", {
  key: varchar("key", { length: 128 }).primaryKey(),
  provider: varchar("provider", { length: 32 }).notNull(),
  endpoint: varchar("endpoint", { length: 128 }).notNull(),
  params: jsonb("params").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: varchar("display_name"),
    // Email is not needed for wallet users, see it as contact
    email: varchar("email"),
    discordWebhookUrl: text("discord_webhook_url"),
    emailAlertsEnabled: boolean("email_alerts_enabled").notNull().default(false),
    /** Optional override: if set, alerts go here instead of users.email */
    emailAlertsAddress: text("email_alerts_address"),
    /** Stripe Customer ID — created lazily on first payment attempt */
    stripeCustomerId: varchar("stripe_customer_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_uq")
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id").notNull().unique(),
  stripeCustomerId: varchar("stripe_customer_id").notNull(),
  planTier: enumPlanTier("plan_tier").notNull(),
  status: enumSubscriptionStatus("status").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const paymentHistory = pgTable("payment_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
    onDelete: "set null",
  }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").unique(),
  stripeInvoiceId: varchar("stripe_invoice_id").unique(),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  status: enumPaymentStatus("status").notNull(),
  paymentMethodDetails: jsonb("payment_method_details"), // e.g. { brand: 'visa', last4: '4242' }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


export const userLinkedWallets = pgTable(
  "user_linked_wallets",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    isAuthWallet: boolean("is_auth_wallet").notNull().default(false),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.walletAddress],
    }),
  ],
);

export const userTokenWatchlist = pgTable(
  "user_token_watch_list",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tokenAddress] })],
);

export const userWalletWatchlist = pgTable(
  "user_wallet_watch_list",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.walletAddress] })],
);

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
    uniqueIndex("auth_accounts_user_provider_uq").on(
      table.userId,
      table.provider,
    ),
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
  marketCapChange24h: decimal("mark_cap_change_24h"),
  marketCapChangePercentage24h: decimal("market_cap_change_percentage_24h"),
  fullyDilutedValuation: decimal("fully_diluted_valuation"),

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
  dexImageUrl: varchar("dex_image_url"),

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

/**
 * Token price cache for timestamp-aware enrichment.
 *
 * Stores price-at-timestamp lookups bucketed to 5-min intervals.
 * Composite PK prevents duplicate (mint, bucket) entries.
 * Populated by resolve-token-price.ts cache-first flow.
 */
export const tokenPriceCache = pgTable(
  "token_price_cache",
  {
    mint: varchar("mint", { length: 44 }).notNull(),
    timestampSec: bigint("timestamp_sec", { mode: "number" }).notNull(),
    priceUsd: decimal("price_usd").notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.mint, table.timestampSec] }),
  ],
);

// {
//     "signature": "5wHu1qwD7Jsj3xqWjdSEJmYr3Q5f5RjXqjqQJ7jqEj7jqEj7jqEj7jqEj7jqEj7jqE",
//     "timestamp": 1704067200,
//     "direction": "in",
//     "counterparty": "HXsKP7wrBWaQ8T2Vtjry3Nj3oUgwYcqq9vrHDM12G664",
//     "mint": "So11111111111111111111111111111111111111112",
//     "symbol": "SOL",
//     "amount": 1.5,
//     "amountRaw": "1500000000",
//     "decimals": 9
//   },
export const tokenTransfers = pgTable(
  "token_transfers",
  {
    address: varchar("address", { length: 66 }).notNull(),
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
  rank11To20Percent: decimal("rank_11_to_20_percent").notNull(),
  rank21To40Percent: decimal("rank_21_to_40_percent").notNull(),
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

export const topLosers = pgTable("top_losers", {
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

  tradeAction: enumTradeAction("trade_action").notNull(),

  baseAddress: varchar("base_address", { length: 44 }).notNull(),
  basePrice: decimal("base_price"),
  baseAmount: decimal("base_amount"),

  quoteAddress: varchar("quote_address", { length: 44 }).notNull(),
  quotePrice: decimal("quote_price"),
  quoteAmount: decimal("quote_amount"),

  blockUnixTime: integer("block_unix_time").notNull(),
  volumeUsd: decimal("volume_usd").notNull(),

  owner: varchar("owner", { length: 44 }).notNull(),
  source: varchar("source").notNull(),
  poolAddress: varchar("pool_address", { length: 44 }).notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

// / --- Wallet API cache (DB-first: use cache if fresh, else fetch from Moralis/Birdeye) ---

export const walletOverviewCache = pgTable(
  "wallet_overview_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    totalAssetValueUsd: decimal("total_asset_value_usd").notNull(),
    totalAssetValueChange24hPercent: decimal(
      "total_asset_value_change_24h_percent",
    ),
    tradingVolumeUsd24h: decimal("trading_volume_usd_24h"),
    tradingVolumeUsd7d: decimal("trading_volume_usd_7d"),
    tradingVolumeUsd30d: decimal("trading_volume_usd_30d"),
    tradingVolumeUsd90d: decimal("trading_volume_usd_90d"),
    tradingVolumeUsdAll: decimal("trading_volume_usd_all"),
    pnlUsdTotal: decimal("pnl_usd_total"),
    pnlTotalUsd24h: decimal("pnl_total_usd_24h"),
    pnlTotalUsd7d: decimal("pnl_total_usd_7d"),
    pnlTotalUsd30d: decimal("pnl_total_usd_30d"),
    pnlTotalUsd90d: decimal("pnl_total_usd_90d"),
    pnlTotalUsdAll: decimal("pnl_total_usd_all"),
    pnlRealizedUsd24h: decimal("pnl_realized_usd_24h"),
    pnlRealizedUsd7d: decimal("pnl_realized_usd_7d"),
    pnlRealizedUsd30d: decimal("pnl_realized_usd_30d"),
    pnlRealizedUsd90d: decimal("pnl_realized_usd_90d"),
    pnlRealizedUsdAll: decimal("pnl_realized_usd_all"),
    pnlUnrealizedUsd24h: decimal("pnl_unrealized_usd_24h"),
    pnlUnrealizedUsd7d: decimal("pnl_unrealized_usd_7d"),
    pnlUnrealizedUsd30d: decimal("pnl_unrealized_usd_30d"),
    pnlUnrealizedUsd90d: decimal("pnl_unrealized_usd_90d"),
    pnlUnrealizedUsdAll: decimal("pnl_unrealized_usd_all"),
    transactionCount24h: integer("transaction_count_24h"),
    transactionCount7d: integer("transaction_count_7d"),
    transactionCount30d: integer("transaction_count_30d"),
    transactionCount90d: integer("transaction_count_90d"),
    transactionCountAll: integer("transaction_count_all"),
    tokensTradedCount: integer("tokens_traded_count"),
    tokensTradedCount24h: integer("tokens_traded_count_24h"),
    tokensTradedCount7d: integer("tokens_traded_count_7d"),
    tokensTradedCount30d: integer("tokens_traded_count_30d"),
    tokensTradedCount90d: integer("tokens_traded_count_90d"),
    tokensTradedCountAll: integer("tokens_traded_count_all"),
    buyTxCount24h: integer("buy_tx_count_24h"),
    buyTxCount7d: integer("buy_tx_count_7d"),
    buyTxCount30d: integer("buy_tx_count_30d"),
    buyTxCount90d: integer("buy_tx_count_90d"),
    buyTxCountAll: integer("buy_tx_count_all"),
    sellTxCount24h: integer("sell_tx_count_24h"),
    sellTxCount7d: integer("sell_tx_count_7d"),
    sellTxCount30d: integer("sell_tx_count_30d"),
    sellTxCount90d: integer("sell_tx_count_90d"),
    sellTxCountAll: integer("sell_tx_count_all"),
    buyVolumeUsd24h: decimal("buy_volume_usd_24h"),
    buyVolumeUsd7d: decimal("buy_volume_usd_7d"),
    buyVolumeUsd30d: decimal("buy_volume_usd_30d"),
    buyVolumeUsd90d: decimal("buy_volume_usd_90d"),
    buyVolumeUsdAll: decimal("buy_volume_usd_all"),
    sellVolumeUsd24h: decimal("sell_volume_usd_24h"),
    sellVolumeUsd7d: decimal("sell_volume_usd_7d"),
    sellVolumeUsd30d: decimal("sell_volume_usd_30d"),
    sellVolumeUsd90d: decimal("sell_volume_usd_90d"),
    sellVolumeUsdAll: decimal("sell_volume_usd_all"),
    tokensHoldingCount: integer("tokens_holding_count").notNull(),
    holdingsFetchedAt: timestamp("holdings_fetched_at"),
    activityFetchedAt: timestamp("activity_fetched_at"),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletPortfolioCache = pgTable(
  "wallet_portfolio_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    data: jsonb("data")
      .$type<
        Array<{
          tokenAddress: string;
          symbol: string;
          name?: string;
          logoUri?: string;
          amount: number;
          priceUsd?: number;
          valueUsd: number;
          change24hPercent?: number;
        }>
      >()
      .notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletTransactionsMeta = pgTable(
  "wallet_transactions_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    // Explicit persisted bounds for coverage checks.
    // Nullable so pre-migration rows don't break existing reads.
    coveredFromSec: integer("covered_from_sec"),
    coveredToSec: integer("covered_to_sec"),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletSwapMeta = pgTable(
  "wallet_swap_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    coveredFromSec: integer("covered_from_sec"),
    coveredToSec: integer("covered_to_sec"),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletTransferMeta = pgTable(
  "wallet_transfer_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    coveredFromSec: integer("covered_from_sec"),
    coveredToSec: integer("covered_to_sec"),
    coveredFromCursor: varchar("last_wallet_address", { length: 66 }),
    coveredToCursor: varchar("first_wallet_address", { length: 66 })
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletHeliusTransactions = pgTable(
  "wallet_helius_transactions",
  {
    address: varchar("address", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    timestamp: timestamp("block_timestamp").notNull(),
    slot: decimal("slot"),
    fee: decimal("fee"),
    feePayer: varchar("fee_payer", { length: 66 }).notNull(),
    balanceChanges: jsonb("transaction_balance_changes")
      .$type<Array<{ mint: string; amount: number; decimals: number }>>()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.address, t.signature] })],
);

export const walletEnhancedTransactions = pgTable(
  "wallet_enhanced_transactions",
  {
    address: varchar("address", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    blockTimestampMs: bigint("block_timestamp_ms", { mode: "number" }).notNull(),
    slot: bigint("slot", { mode: "number" }),
    fee: bigint("fee", { mode: "number" }),
    feePayer: varchar("fee_payer", { length: 66 }).notNull(),
    source: text("source"),
    type: text("type"),
    programId: varchar("program_id", { length: 66 }),
  },
  (t) => [primaryKey({ columns: [t.address, t.signature] })],
);

export const walletEnhancedTokenTransfers = pgTable(
  "wallet_enhanced_token_transfers",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    mint: varchar("mint", { length: 66 }).notNull(),
    tokenAmount: decimal("token_amount").notNull(),
    fromUserAccount: varchar("from_user_account", { length: 66 }).notNull(),
    toUserAccount: varchar("to_user_account", { length: 66 }).notNull(),
    symbol: text("symbol"),
    tokenSymbol: text("token_symbol"),
    instructionIndex: integer("instruction_index").notNull(),
  },
  (t) => [uniqueIndex("uq_enh_token_tx").on(t.address, t.signature, t.instructionIndex)],
);

export const walletEnhancedNativeTransfers = pgTable(
  "wallet_enhanced_native_transfers",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    amount: decimal("amount").notNull(),
    fromUserAccount: varchar("from_user_account", { length: 66 }).notNull(),
    toUserAccount: varchar("to_user_account", { length: 66 }).notNull(),
    transferIndex: integer("transfer_index").notNull(),
  },
  (t) => [uniqueIndex("uq_enh_native_tx").on(t.address, t.signature, t.transferIndex)],
);

export const walletEnhancedInstructions = pgTable(
  "wallet_enhanced_instructions",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    instructionIndex: integer("instruction_index").notNull(),
    programId: varchar("program_id", { length: 66 }).notNull(),
    data: text("data"),
    accounts: varchar("accounts").array(),
  },
  (t) => [uniqueIndex("uq_enh_ins_tx").on(t.address, t.signature, t.instructionIndex)],
);

export const walletEnhancedInnerInstructions = pgTable(
  "wallet_enhanced_inner_instructions",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 66 }).notNull(),
    signature: text("signature").notNull(),
    instructionIndex: integer("instruction_index").notNull(),
    innerIndex: integer("inner_index").notNull(),
    programId: varchar("program_id", { length: 66 }).notNull(),
    data: text("data"),
    accounts: varchar("accounts").array(),
  },
  (t) => [
    uniqueIndex("uq_enh_inner_ins_tx").on(
      t.address,
      t.signature,
      t.instructionIndex,
      t.innerIndex,
    ),
  ],
);

export const walletEnhancedTxMeta = pgTable(
  "wallet_enhanced_tx_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    coveredFromMs: bigint("covered_from_ms", { mode: "number" }),
    coveredToMs: bigint("covered_to_ms", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    address: varchar("address", { length: 66 }).notNull(),
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
  (t) => [primaryKey({ columns: [t.address, t.hash] })],
);

export const walletSwap = pgTable(
  "wallet_swap",
  {
    transactionHash: text("transaction_hash").notNull(),
    transactionType: text("transaction_type").notNull(),
    blockTimestampMs: bigint("block_timestamp_ms", {
      mode: "number",
    }).notNull(),

    subcategory: text("subcategory"),

    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    pairAddress: varchar("pair_address", { length: 66 }).notNull(),

    tokensInvoled: text("tokens_involved").notNull(),


    boughtTokenAddress: varchar("bought_token_address", {
      length: 66,
    }).notNull(),
    boughtTokenAmount: decimal("bought_token_amount").notNull(),
    boughtTokenPriceUsd: decimal("bought_token_price_usd").notNull(),

    soldTokenAddress: varchar("sold_token_address", { length: 66 }).notNull(),
    soldTokenAmount: decimal("sold_token_amount").notNull(),
    soldTokenPriceUsd: decimal("sold_token_price_usd").notNull(),

    totalValueUsd: decimal("total_value_usd"),
    baseQuotePrice: decimal("base_quote_price_usd"),

    providerSource: text("provider_source"),
  },
  (t) => [primaryKey({ columns: [t.transactionHash] })],
);

export const walletIdentityCache = pgTable(
  "wallet_identity_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    type: varchar("type", { length: 64 }),
    name: varchar("name", { length: 255 }),
    category: varchar("category", { length: 255 }),
    tags: jsonb("tags").$type<string[]>().notNull(),
    domainNames: jsonb("domain_names").$type<string[]>().notNull(),
    raw: jsonb("raw").$type<Record<string, unknown> | null>(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletAiAnalysisCache = pgTable(
  "wallet_ai_analysis_cache",
  {
    key: varchar("key", { length: 256 }).primaryKey(),
    address: varchar("address", { length: 66 }).notNull(),
    language: varchar("language", { length: 10 }).notNull(),
    modelVersion: varchar("model_version", { length: 64 }),
    promptVersion: varchar("prompt_version", { length: 64 }),
    raw: jsonb("raw").notNull(),
    normalized: jsonb("normalized").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("wallet_ai_analysis_cache_address_lang_ver_uq").on(
      t.address,
      t.language,
      t.modelVersion,
      t.promptVersion,
    ),
  ],
);

export const walletBalanceHistoryCache = pgTable(
  "wallet_balance_history_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timePeriod: varchar("time_period", { length: 10 }).notNull(),
    data: jsonb("data")
      .$type<
        Array<{
          timestamp: number;
          value: number;
          date: string;
          changeUsd?: number;
          changePercent?: number;
        }>
      >()
      .notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    coveredFromMs: bigint("covered_from_ms", { mode: "number" }).notNull(),
    coveredToMs: bigint("covered_to_ms", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.address, t.timePeriod] })],
);

export const walletTokenBalanceHistoryCache = pgTable(
  "wallet_token_balance_history_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    tokenAddress: varchar("token_address", { length: 66 }).notNull(),
    tokenSymbol: varchar("token_symbol", { length: 64 }).notNull(),
    tokenSeries: jsonb("token_series")
      .$type<
        Array<{
          timestamp: number;
          value: number;
          date: string;
          changeUsd?: number;
          changePercent?: number;
        }>
      >()
      .notNull(),
    usdSeries: jsonb("usd_series")
      .$type<
        Array<{
          timestamp: number;
          value: number;
          date: string;
          changeUsd?: number;
          changePercent?: number;
        }>
      >()
      .notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    coveredFromMs: bigint("covered_from_ms", { mode: "number" }).notNull(),
    coveredToMs: bigint("covered_to_ms", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.address, t.tokenAddress] })],
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

/** Wallets followed for Helius webhook-driven alerts */
export const followedWallets = pgTable(
  "followed_wallets",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    label: text("label"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.address)],
);

/**
 * User-defined alert predicates (Observer stream + server-side filtering).
 * Helius delivers raw events; matching rows determine Discord/email fan-out.
 */
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }),
  walletAddress: text("wallet_address").notNull(),
  actionType: enumAlertRuleAction("action_type").notNull(),
  minVolume: dec("min_volume", { mode: "number" }).notNull(),
  maxVolume: dec("max_volume", { mode: "number" }),
  volumeUnit: enumAlertRuleVolumeUnit("volume_unit").notNull().default("USD"),
  triggerType: enumAlertRuleTrigger("trigger_type").notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
  oneShotFiredAt: timestamp("one_shot_fired_at", { withTimezone: true }),
  useDefaultDelivery: boolean("use_default_delivery").notNull().default(true),
  discordWebhookOverride: text("discord_webhook_override"),
  emailOverride: text("email_override"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const walletTokenDetails = pgTable(
  "wallet_token_details",
  {
    address: varchar("address", { length: 44 }).notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    symbol: varchar("symbol"),

    lastTradeUnixTime: integer("last_trade_unix_time").notNull(),

    // Counts
    totalBuyCount: integer("total_buy_count").notNull(),
    totalSellCount: integer("total_sell_count").notNull(),
    totalTradeCount: integer("total_trade_count").notNull(),

    // Quantity
    totalBoughtAmount: decimal("total_bought_amount").notNull(),
    totalSoldAmount: decimal("total_sold_amount").notNull(),
    balanceAmount: decimal("balance_amount").notNull(),

    // Cashflow
    costOfQuantitySold: decimal("cost_of_quantity_sold").notNull(),
    totalBoughtUsd: decimal("total_bought_usd").notNull(),
    totalSoldUsd: decimal("total_sold_usd").notNull(),
    currentValue: decimal("current_value").notNull(),

    // PnL
    realizedProfitUsd: decimal("realized_profit_usd").notNull(),
    realizedProfitPercent: decimal("realized_profit_percent").notNull(),
    unrealizedProfitUsd: decimal("unrealized_profit_usd").notNull(),
    unrealizedProfitPercent: decimal("unrealized_profit_percent").notNull(),

    // Pricing
    avgBuyCost: decimal("avg_buy_cost").notNull(),
    avgSellCost: decimal("avg_sell_cost").notNull(),

    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.address, t.tokenAddress] })],
);

export const walletFirstFund = pgTable(
  "wallet_first_fund",
  {
    reciepient: varchar("recipient", { length: 44 }).notNull(),
    funder: varchar("funder", { length: 44 }).notNull(),
    funderName: varchar("funder_name", { length: 256 }),
    funderType: varchar("funder_type", { length: 256 }),
    mint: varchar("mint", { length: 44 }),
    symbol: varchar("symbol", { length: 64 }),
    amount: decimal("amount"),
    amountRaw: varchar("amount_raw", { length: 256 }),
    decimals: integer("decimals").notNull(),
    date: varchar("date", { length: 256 }),
    signature: varchar("signature", { length: 256 }),
    timestamp: integer("timestamp").notNull(),
    slot: integer("slot").notNull(),
    explorerUrl: varchar("explorer_url", { length: 256 }),
  },
  (t) => [primaryKey({ columns: [t.reciepient] })],
);



// for AI agent workflow, and to easily access strategy to reduce token usage in the workflow
export const tradingStrategyDictionary = pgTable("trading_strategy_dictionary", {
  id: varchar("id", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // for AI agent workflow
  description: text("description").notNull(), // for AI agent workflow
  name_key: varchar("name_key", { length: 100 }).notNull(), // for frontend display, use localization key to support localization context
  description_key: text("description_key").notNull(), // for frontend display, use localization key to support localization context
})

// a trading strategy can have multiple benefits and risks, we store them in separate tables with foreign key reference to the strategy dictionary
export const tradingStrategyBenefit = pgTable("trading_strategy_benefit", {
  id: serial("id").primaryKey(),
  strategyId: varchar("strategy_id", { length: 20 }).notNull().references(() => tradingStrategyDictionary.id, { onDelete: "cascade" }),
  benefit_key: text("benefit_key").notNull(),
})

export const tradingStrategyRisk = pgTable("trading_strategy_risk", {
  id: serial("id").primaryKey(),
  strategyId: varchar("strategy_id", { length: 20 }).notNull().references(() => tradingStrategyDictionary.id, { onDelete: "cascade" }),
  risk_key: text("risk_key").notNull(),
})

// to store the weight of each metric for a trading strategy, which can be used in the AI agent workflow to calculate the score of a strategy based on the metrics of a wallet
export const tradingStrategyWeight = pgTable("trading_strategy_weight", {
  id: serial("id").primaryKey(),
  strategyId: varchar("strategy_id", { length: 20 }).notNull().references(() => tradingStrategyDictionary.id, { onDelete: "cascade" }),
  metric_name: varchar("metric_name", { length: 100 }).notNull(),
  weight: decimal("weight").notNull(),
})

// to store any other rules for a trading strategy that are not covered by the benefits, risks and weights, such as if a strategy requires a certain token holding or trading volume, we can store them in this table with a key-value pair format
export const tradingStrategyRule = pgTable("trading_strategy_rule", {
  id: serial("id").primaryKey(),
  strategyId: varchar("strategy_id", { length: 20 }).notNull().references(() => tradingStrategyDictionary.id, { onDelete: "cascade" }),
  rule_key: text("rule_key").notNull(),
  value: decimal("value").notNull(),
});

export const walletCategoryDictionary = pgTable("wallet_category_dictionary", {
  id: varchar("id", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // for AI agent workflow
  description: text("description").notNull(), // for AI agent workflow
  name_key: varchar("name_key", { length: 100 }).notNull(), // for frontend display, use localization key to support localization context
  description_key: text("description_key").notNull(), // for frontend display, use localization key to support localization context
});

export const firstFunderCategoryDictionary = pgTable("first_funder_category_dictionary", {
  id: varchar("id", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // for AI agent workflow
  description: text("description").notNull(), // for AI agent workflow
  name_key: varchar("name_key", { length: 100 }).notNull(), // for frontend display, use localization key to support localization context
  description_key: text("description_key").notNull(), // for frontend display, use localization key to support localization context
});

// --- Wallet PnL Cache tables ---

/**
 * Daily wallet PnL cache (normalized: one row per day, not JSONB array).
 * 
 * Stores computed daily PnL data per wallet/period/aggregation combination.
 * Each row represents a single day of data within the requested period.
 * Primary key prevents duplicate daily entries for same wallet/period/aggregation/day combo.
 */
export const walletPnlDataCache = pgTable(
  "wallet_pnl_data_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timePeriod: varchar("time_period", { length: 10 }).notNull(),
    aggregation: varchar("aggregation", { length: 20 }).notNull(),
    dayStartMs: bigint("day_start_ms", { mode: "number" }).notNull(),
    dailyPnl: decimal("daily_pnl").notNull(),
    cumulativePnl: decimal("cumulative_pnl").notNull(),
    dayOpen: decimal("day_open").notNull(),
    dayClose: decimal("day_close").notNull(),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.address, t.timePeriod, t.aggregation, t.dayStartMs],
    }),
  ],
);

/**
 * Wallet PnL cache metadata and coverage tracking.
 *
 * Stores coverage ranges (from/to ms), source data ranges for balance history
 * and transfer data, and update timestamp. Used to determine cache validity
 * and whether recomputation is needed for a requested range.
 */
export const walletPnlDataMeta = pgTable(
  "wallet_pnl_data_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timePeriod: varchar("time_period", { length: 10 }).notNull(),
    aggregation: varchar("aggregation", { length: 20 }).notNull(),
    coverageFromMs: bigint("coverage_from_ms", { mode: "number" }).notNull(),
    coverageToMs: bigint("coverage_to_ms", { mode: "number" }).notNull(),
    sourceBalanceRangeFromMs: bigint("source_balance_range_from_ms", {
      mode: "number",
    }).notNull(),
    sourceBalanceRangeToMs: bigint("source_balance_range_to_ms", {
      mode: "number",
    }).notNull(),
    sourceTransferRangeFromMs: bigint("source_transfer_range_from_ms", {
      mode: "number",
    }).notNull(),
    sourceTransferRangeToMs: bigint("source_transfer_range_to_ms", {
      mode: "number",
    }).notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.timePeriod, t.aggregation] }),
  ],
);

/**
 * AI Wallet Forensic Audit cache.
 *
 * Stores Gemini-generated behavioural reports per wallet so we don't pay the
 * model cost on every page view. Read path checks `fetchedAt >= now - 24h`.
 */
export const walletAuditCache = pgTable(
  "wallet_audit_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    persona: varchar("persona", { length: 64 }).notNull(),
    trustScore: integer("trust_score").notNull(),
    summary: text("summary").notNull(),
    observations: jsonb("observations").$type<string[]>().notNull(),
    transactionCount: integer("transaction_count").notNull(),
    model: varchar("model", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

// --- News tables (Phase 1: news-fetching AI filter integration) ---
export const newsBatches = pgTable("news_batches", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 44 }).notNull(),
  symbol: varchar("symbol").notNull(),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const newsArticles = pgTable(
  "news_articles",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id").notNull().references(() => newsBatches.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 512 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at"),
    sourceName: varchar("source_name"),
    faviconUrl: varchar("favicon_url"),
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    extraSnippets: jsonb("extra_snippets").$type<string[] | null>(),
    // raw: jsonb("raw"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("news_articles_url_uq").on(t.url),
    uniqueIndex("news_articles_content_hash_uq").on(t.contentHash),
  ],
);

export const userSources = pgTable(
  "user_sources",
  {
    id: serial("id").primaryKey(),
    address: varchar("address", { length: 44 }).notNull(),
    sourceName: varchar("source_name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
  },
  (t) => [unique().on(t.address, t.sourceName)],
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
export type TokenPriceCacheInsert = typeof tokenPriceCache.$inferInsert;
export type TokenPriceCacheRow = typeof tokenPriceCache.$inferSelect;
export type TokenHolderStatsInsert = typeof tokenHolderStats.$inferInsert;
export type RecentTradeInsert = typeof recentTrades.$inferInsert;
export type TokenPoolDataInsert = typeof tokenPoolData.$inferInsert;
export type TokenTopHolderInsert = typeof topTokenHolders.$inferInsert;
export type TopTokensByMarketCapInsert =
  typeof topTokensByMarketCap.$inferInsert;
export type TopTraderInsert = typeof topTraders.$inferInsert;
export type TopLoserInsert = typeof topLosers.$inferInsert;
export type WalletOverviewCacheInsert = typeof walletOverviewCache.$inferInsert;
export type WalletPortfolioCacheInsert =
  typeof walletPortfolioCache.$inferInsert;
export type WalletTransactionsMetaInsert =
  typeof walletTransactionsMeta.$inferInsert;
export type WalletTransactionInsert = typeof walletTransactions.$inferInsert;
export type WalletSwapInsert = typeof walletSwap.$inferInsert;

export type WalletIdentityCacheInsert = typeof walletIdentityCache.$inferInsert;
export type WalletBalanceHistoryCacheInsert =
  typeof walletBalanceHistoryCache.$inferInsert;
export type WalletTokenBalanceHistoryCacheInsert =
  typeof walletTokenBalanceHistoryCache.$inferInsert;
export type walletHeliusTransactionsInsert =
  typeof walletHeliusTransactions.$inferInsert;
export type WalletEnhancedTransactionsInsert =
  typeof walletEnhancedTransactions.$inferInsert;
export type WalletEnhancedTokenTransfersInsert =
  typeof walletEnhancedTokenTransfers.$inferInsert;
export type WalletEnhancedNativeTransfersInsert =
  typeof walletEnhancedNativeTransfers.$inferInsert;
export type WalletEnhancedInstructionsInsert =
  typeof walletEnhancedInstructions.$inferInsert;
export type WalletEnhancedInnerInstructionsInsert =
  typeof walletEnhancedInnerInstructions.$inferInsert;
export type WalletEnhancedTxMetaInsert =
  typeof walletEnhancedTxMeta.$inferInsert;
export type walletSwapMetaInsert = typeof walletSwapMeta.$inferInsert;
export type WalletUserTagsInsert = typeof walletUserTags.$inferInsert;
export type walletTransferMetaInsert = typeof walletTransferMeta.$inferInsert;
export type WalletTokenDetailsInsert = typeof walletTokenDetails.$inferInsert;
export type WalletFirstFundInsert = typeof walletFirstFund.$inferInsert;
export type UserLinkedWalletInsert = typeof userLinkedWallets.$inferInsert;
export type FollowedWalletInsert = typeof followedWallets.$inferInsert;
export type FollowedWalletRow = typeof followedWallets.$inferSelect;
export type AlertRuleInsert = typeof alertRules.$inferInsert;
export type AlertRuleRow = typeof alertRules.$inferSelect;
export type WalletAuditCacheInsert = typeof walletAuditCache.$inferInsert;
export type WalletAuditCacheRow = typeof walletAuditCache.$inferSelect;
export type WalletPnlDataCacheInsert = typeof walletPnlDataCache.$inferInsert;
export type WalletPnlDataCacheRow = typeof walletPnlDataCache.$inferSelect;
export type WalletPnlDataMetaInsert = typeof walletPnlDataMeta.$inferInsert;
export type WalletPnlDataMetaRow = typeof walletPnlDataMeta.$inferSelect;
export type NewsBatchInsert = typeof newsBatches.$inferInsert;
export type NewsArticleInsert = typeof newsArticles.$inferInsert;
export type UserSourceInsert = typeof userSources.$inferInsert;

// #endregion
