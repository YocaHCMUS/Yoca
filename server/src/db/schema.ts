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

export * from "./alerts";

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

export const enumTradeAction = pgEnum("trade_action", ["buy", "sell"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: varchar("display_name"),
    // Email is not needed for wallet users, see it as contact
    email: varchar("email"),
    discordWebhookUrl: text("discord_webhook_url"),
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
  },
  (t) => [primaryKey({ columns: [t.address] })],
);

export const walletTransferMeta = pgTable(
  "wallet_transfer_meta",
  {
    address: varchar("address", { length: 66 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
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

    exchangeAddress: varchar("exchange_address", { length: 66 }).notNull(),
    exchangeName: text("exchange_name").notNull(),
    exchangeLogo: text("exchange_logo").notNull(),

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
  },
  (t) => [primaryKey({ columns: [t.transactionHash] })],
);

export const walletExchangeCountsCache = pgTable(
  "wallet_exchange_counts_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
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
  (t) => [primaryKey({ columns: [t.address] })],
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
export type TopLoserInsert = typeof topLosers.$inferInsert;
export type WalletOverviewCacheInsert = typeof walletOverviewCache.$inferInsert;
export type WalletPortfolioCacheInsert =
  typeof walletPortfolioCache.$inferInsert;
export type WalletTransactionsMetaInsert =
  typeof walletTransactionsMeta.$inferInsert;
export type WalletTransactionInsert = typeof walletTransactions.$inferInsert;
export type WalletSwapInsert = typeof walletSwap.$inferInsert;
export type WalletExchangeCountsCacheInsert =
  typeof walletExchangeCountsCache.$inferInsert;
export type WalletIdentityCacheInsert = typeof walletIdentityCache.$inferInsert;
export type WalletBalanceHistoryCacheInsert =
  typeof walletBalanceHistoryCache.$inferInsert;
export type WalletTokenBalanceHistoryCacheInsert =
  typeof walletTokenBalanceHistoryCache.$inferInsert;
export type walletHeliusTransactionsInsert =
  typeof walletHeliusTransactions.$inferInsert;
export type walletSwapMetaInsert = typeof walletSwapMeta.$inferInsert;
export type WalletUserTagsInsert = typeof walletUserTags.$inferInsert;
export type walletTransferMetaInsert = typeof walletTransferMeta.$inferInsert;
export type WalletTokenDetailsInsert = typeof walletTokenDetails.$inferInsert;
export type WalletFirstFundInsert = typeof walletFirstFund.$inferInsert;
export type UserLinkedWalletInsert = typeof userLinkedWallets.$inferInsert;
export type FollowedWalletInsert = typeof followedWallets.$inferInsert;
export type FollowedWalletRow = typeof followedWallets.$inferSelect;

// #endregion
