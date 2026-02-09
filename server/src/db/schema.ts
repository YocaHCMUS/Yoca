import {
  bigint,
  char,
  decimal as dec,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
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
export const tradeType = pgEnum("trade_type", ["buy", "sell"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMeta = pgTable("token_meta", {
  address: varchar("address", { length: 44 }).primaryKey(),
  name: varchar("name").notNull(),
  symbol: varchar("symbol").notNull(),
  imageUrl: varchar("image_url"),
  description: varchar("description"),
  coingeckoId: varchar("coingecko_id"),

  linkHomepage: varchar("homepage"),
  linkDiscord: varchar("link_discord"),
  twitterScreenName: varchar("twitter_screen_name"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar("address", { length: 44 }).primaryKey(),
  decimals: integer("decimals").notNull(),
  priceUsd: decimal("price_usd").notNull(),
  priceChange24h: decimal("price_change_24h"),
  priceChangePercentage1h: decimal("price_change_percentage_1h"),
  priceChangePercentage24h: decimal("price_change_percentage_24h"),
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
  athDate: timestamp("ath_date"),
  athChangePercentage: decimal("ath_change_percentage"),
  atl: decimal("atl"),
  atlDate: timestamp("atl_date"),
  atlChangePercentage: decimal("atl_change_percentage"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenPoolData = pgTable("token_pool_data", {
  poolAddress: varchar("address", { length: 44 }).primaryKey(),
  poolName: varchar("name"),

  baseAddress: varchar("address", { length: 44 }),
  quoteAddress: varchar("address", { length: 44 }),

  dexId: varchar("dexName"),

  baseToQuote: decimal("baseToQuote").notNull(),

  poolCreatedAt: timestamp("pool_created_at"),
  liquidityUsd: decimal("liquidity_usd"),

  buyVolume1h: decimal("buy_volume_1h"),
  buyVolume6h: decimal("buy_volume_6h"),
  buyVolume24h: decimal("buy_volume_24h"),

  buys1h: decimal("buys_1h"),
  buys6h: decimal("buys_6h"),
  buys24h: decimal("buys_24h"),

  sellVolume1h: decimal("sell_volume_1h"),
  sellVolume6h: decimal("sell_volume_6h"),
  sellVolume24h: decimal("sell_volume_24h"),

  sells1h: decimal("sells_1h"),
  sells6h: decimal("sells_6h"),
  sells24h: decimal("sells_24h"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenTopPools = pgTable(
  "token_tops_pool",
  {
    tokenAddress: varchar("address", { length: 44 }).notNull(),
    poolAddress: varchar("address", { length: 44 }).notNull(),
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

export const onchainTokenData = pgTable("onchain_token_data", {
  address: varchar({ length: 44 }).primaryKey(),
  name: varchar("name").notNull(),
  symbol: varchar("symbol").notNull(),
  priceUsd: decimal("price_usd").notNull(),
  marketCapUsd: decimal("market_cap_usd").notNull(),
  fdvUsd: decimal("fdv_usd"),
  totalSupply: decimal("total_supply").notNull(),
  volume5m: decimal("volume_5m").notNull(),
  volume1h: decimal("volume_1h").notNull(),
  volume24h: decimal("volume_24h").notNull(),
  priceChange5m: decimal("price_change_5m").notNull(),
  priceChange1h: decimal("price_change_1h").notNull(),
  priceChange24h: decimal("price_change_24h").notNull(),
  totalTxn24h: integer("total_txn_24h").notNull(),
  buyTxn24h: integer("buy_txn_24h").notNull(),
  sellTxn24h: integer("sell_txn_24h").notNull(),
  uniqueBuyers24h: integer("unique_buyers_24h").notNull(),
  uniqueSellers24h: integer("unique_sellers_24h").notNull(),
  poolVolume24h: decimal("pool_volume_24h").notNull(),
  totalLiquidityUsd: decimal("total_liquidity_usd").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

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

export const tokenMarketChartHourly = pgTable(
  "token_market_chart_hourly",
  {
    address: varchar("address", { length: 44 }).notNull(),
    unixTimestampMs: bigint("unix_timestamp_ms", { mode: "number" }).notNull(),
    price: decimal("price").notNull(),
    marketCap: decimal("market_cap").notNull(),
    totalVolume: decimal("total_volume").notNull(),
    unixUpdatedAt: integer("unix_updated_at").notNull(),
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
    unixUpdatedAt: integer("unix_updated_at").notNull(),
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
    fromOwner: varchar("from_address", { length: 44 }).notNull(),
    toOwner: varchar("to_address", { length: 44 }).notNull(),
    // In the according token units
    amount: decimal("amount").notNull(),
    amountUsd: decimal("amount_usd").notNull(),
    blockTime: timestamp("block_time").notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    transactionSignature: char("transaction_signature", {
      length: 64,
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
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const topTokenHolders = pgTable("top_token_holders", {
  tokenAddress: varchar("token_address", { length: 44 }).primaryKey(),
  holderAddress: varchar("holder_address", { length: 44 }).notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

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

// Pools data - Aggregated pool information for tokens
export const tokenPools = pgTable("token_pools", {
  address: varchar("address", { length: 44 }).primaryKey(),
  tokenAddress: varchar("token_address", { length: 44 }).notNull(),
  network: varchar("network", { length: 32 }).notNull().default("solana"),
  name: varchar("name").notNull(),
  source: varchar("source").notNull(), // dex name like "raydium", "orca"
  volume24h: decimal("volume_24h").notNull(),
  volumeBuy24h: decimal("volume_buy_24h").notNull(),
  volumeSell24h: decimal("volume_sell_24h").notNull(),
  volumeNet24h: decimal("volume_net_24h").notNull(),
  reserve: decimal("reserve").notNull(),
  liquidity: decimal("liquidity").notNull(),
  marketCap: decimal("market_cap"),
  fdv: decimal("fdv"),
  priceUsd: decimal("price_usd").notNull(),
  priceQuoteToken: decimal("price_quote_token").notNull(),
  quoteTokenSymbol: varchar("quote_token_symbol", { length: 16 }),
  priceChangeM5: decimal("price_change_m5").notNull(),
  priceChangeH1: decimal("price_change_h1").notNull(),
  priceChangeH6: decimal("price_change_h6").notNull(),
  priceChangeH24: decimal("price_change_h24").notNull(),
  txns24h: integer("txns_24h").notNull(),
  buys24h: integer("buys_24h").notNull(),
  sells24h: integer("sells_24h").notNull(),
  traders24h: integer("traders_24h").notNull(),
  buyers24h: integer("buyers_24h").notNull(),
  sellers24h: integer("sellers_24h").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

// Trending tokens
export const trendingTokens = pgTable("trending_tokens", {
  address: varchar("address", { length: 44 }).primaryKey(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

// Pool trades - Recent trades for pools
export const poolTrades = pgTable(
  "pool_trades",
  {
    id: varchar("id", { length: 128 }).notNull(),
    poolAddress: varchar("pool_address", { length: 44 }).notNull(),
    network: varchar("network", { length: 32 }).notNull().default("solana"),
    type: varchar("type", { length: 4 }).notNull(), // "buy" or "sell"
    kind: varchar("kind", { length: 4 }).notNull(), // "buy" or "sell"
    priceUsd: decimal("price_usd").notNull(),
    priceQuote: decimal("price_quote").notNull(), // price in quote token
    volumeUsd: decimal("volume_usd").notNull(),
    amount: decimal("amount").notNull(), // token amount
    baseTokenAmount: decimal("base_token_amount").notNull(),
    quoteTokenAmount: decimal("quote_token_amount").notNull(),
    fromAddress: varchar("from_address", { length: 44 }).notNull(),
    txHash: varchar("tx_hash", { length: 128 }).notNull(),
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.id, table.poolAddress],
    }),
  ],
);

// #endregion

// #region Types
export type TokenMetaInsert = typeof tokenMeta.$inferInsert;
export type TokenMarketDataInsert = typeof tokenMarketData.$inferInsert;
export type WalletBalanceInsert = typeof walletBalances.$inferInsert;
export type UserInsert = typeof users.$inferInsert;
export type TokenTransferInsert = typeof tokenTransfers.$inferInsert;
export type TokenMarketChart24hInsert = typeof tokenMarketChart24h.$inferInsert;
export type CoingeckoTokenListInsert = typeof coinGeckoTokenList.$inferInsert;
export type TokenPoolInsert = typeof tokenPools.$inferInsert;
export type OnchainTokenDataInsert = typeof onchainTokenData.$inferInsert;
export type TrendingTokenInsert = typeof trendingTokens.$inferInsert;
export type TokenHolderStatsInsert = typeof tokenHolderStats.$inferInsert;
export type PoolTradeInsert = typeof poolTrades.$inferInsert;

// #endregion
