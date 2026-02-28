import { relations } from "drizzle-orm";
import {
  bigint,
  char,
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

export const chartGranularityOrder = {
  five_minutely: 0,
  hourly: 1,
  daily: 2,
} as const;

type ChartGranularityKey = keyof typeof chartGranularityOrder;

const chartGranularity = pgEnum(
  "chart_granularity",
  Object.keys(chartGranularityOrder) as [
    ChartGranularityKey,
    ...ChartGranularityKey[],
  ],
  // The above type means an array of atleast one ChartGranularityKey,
  // as pgEnum doesn't allow empty arrays
);

// #region Table definitions

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

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar("address", { length: 44 }).primaryKey(),
  priceUsd: decimal("price_usd").notNull(),
  priceChange24h: decimal("price_change_24h").notNull(),
  priceChangePercentage1h: decimal("price_change_percentage_1h").notNull(),
  priceChangePercentage24h: decimal("price_change_percentage_24h").notNull(),
  priceChangePercentage14d: decimal("price_change_percentage_14d"),
  priceChangePercentage30d: decimal("price_change_percentage_30d"),
  priceChangePercentage200d: decimal("price_change_percentage_200d"),
  priceChangePercentage1y: decimal("price_change_percentage_1y"),
  marketCap: decimal("market_cap").notNull(),
  marketCapChange24h: decimal("market_cap_change_24h").notNull(),
  marketCapChangePercentage24h: decimal(
    "market_cap_change_percentage_24h",
  ).notNull(),
  marketCapRank: decimal("market_cap_rank").notNull(),
  high24h: decimal("high_24h").notNull(),
  low24h: decimal("low_24h").notNull(),
  fullyDilutedValuation: decimal("fully_diluted_valuation").notNull(),
  volume24h: decimal("volume_24h").notNull(),
  circulatingSupply: decimal("circulating_supply").notNull(),
  totalSupply: decimal("total_supply").notNull(),
  maxSupply: decimal("max_supply"),
  ath: decimal("ath").notNull(),
  athDate: timestamp("ath_date").notNull(),
  athChangePercentage: decimal("ath_change_percentage").notNull(),
  atl: decimal("atl").notNull(),
  atlDate: timestamp("atl_date").notNull(),
  atlChangePercentage: decimal("atl_change_percentage").notNull(),

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
    unixUpdatedAt: integer("unix_updated_at").notNull() ,
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

// --- Wallet API cache (DB-first: use cache if fresh, else fetch from Moralis/Birdeye) ---

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
    data: jsonb("data").$type<Array<{ tokenAddress: string; symbol: string; name?: string; amount: number; priceUsd?: number; valueUsd: number; change24hPercent?: number }>>().notNull(),
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

export const walletExchangeCountsCache = pgTable(
  "wallet_exchange_counts_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    data: jsonb("data").$type<{ exchanges: Array<{ name: string; deposits: number; withdrawals: number; depositsVolume: number; withdrawalsVolume: number }>; metadata: { period: string; metric: string } }>().notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.address, t.chain] })],
);

// #endregion
// #region Relations

export const tokenMarketData_tokenMeta = relations(
  tokenMarketData,
  ({ one }) => ({
    tokenMeta: one(tokenMeta, {
      fields: [tokenMarketData.address],
      references: [tokenMeta.address],
    }),
  }),
);

export const walletBalances_tokenMeta = relations(
  walletBalances,
  ({ one }) => ({
    tokenMeta: one(tokenMeta, {
      fields: [walletBalances.tokenAddress],
      references: [tokenMeta.address],
    }),
  }),
);

export const walletBalances_wallets = relations(walletBalances, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletBalances.address],
    references: [wallets.address],
  }),
}));

// #endregion

// #region Types
export type TokenMetaInsert = typeof tokenMeta.$inferInsert;
export type TokenMarketDataInsert = typeof tokenMarketData.$inferInsert;
export type WalletBalanceInsert = typeof walletBalances.$inferInsert;
export type UserInsert = typeof users.$inferInsert;
export type TokenTransferInsert = typeof tokenTransfers.$inferInsert;
export type TokenMarketChart24hInsert = typeof tokenMarketChart24h.$inferInsert;
export type ChartGranularity = (typeof chartGranularity.enumValues)[number];
export type CoingeckoTokenListInsert = typeof coinGeckoTokenList.$inferInsert;
export type WalletOverviewCacheInsert = typeof walletOverviewCache.$inferInsert;
export type WalletPortfolioCacheInsert = typeof walletPortfolioCache.$inferInsert;
export type WalletTransactionsMetaInsert = typeof walletTransactionsMeta.$inferInsert;
export type WalletTransactionInsert = typeof walletTransactions.$inferInsert;
export type WalletExchangeCountsCacheInsert = typeof walletExchangeCountsCache.$inferInsert;

// #endregion
