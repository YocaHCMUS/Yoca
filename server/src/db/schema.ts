import {
  integer,
  pgTable,
  uuid,
  text,
  timestamp,
  decimal as dec,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/*
 * Notes:
 * [Old]:
 * When you define a field with the type of decimal or numeric, you should
 * add config with mode option of "number" for drizzle to be able to infer
 * the field as number for future reference, or else it would be inferred
 * as string. This is not drizzle's fault as node-postgress defined decimal
 * and numeric values as string to keep precisions.
 * Example:
 * ```ts
 * export const tokenMarketData = pgTable("token_market_data", {
 *   priceUsd: dec("price_usd", { mode: "number" }).notNull(),
 *   marketCap: dec("market_cap", { mode: "number" }).notNull(),
 * }
 * ```
 * [New]:
 * For readability:
 * I've overwritten the decimal function to have default mode of "number"
 */

function decimal(name: string) {
  return dec(name, { mode: "number" });
}

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

  // Don't think they are very useful
  // isNative: boolean("is_native").notNull().default(false),
  // isWrapped: boolean("is_wrapped").notNull().default(false),

  imageUrl: varchar("image_url"),
  description: varchar("description"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar("address", { length: 44 }),
  priceUsd: decimal("price_usd").notNull(),
  priceChange24h: decimal("price_change_24").notNull(),
  priceChangePercentage24h: decimal("price_change_24").notNull(),
  marketCapChange24h: decimal("market_cap_change_24h").notNull(),
  marketCapChangePercentage24h: decimal(
    "market_cap_change_percentage_24h",
  ).notNull(),
  marketCap: decimal("market_cap").notNull(),
  marketCapRank: decimal("market_cap_rank").notNull(),

  // Currently require seperate API call to cg's simple/price
  // usd24hVol: decimal("usd_24h_vol").notNull(),
  // usd24hChange: decimal("usd_24h_change").notNull(),

  high24h: decimal("high_24h").notNull(),
  low24h: decimal("low_24h").notNull(),
  fullyDilutedValuation: decimal("fully_diluted_valuation").notNull(),
  totalVolume: decimal("total_volume").notNull(),
  circulatingSupply: decimal("circulating_supply").notNull(),
  totalSupply: decimal("total_supply").notNull(),
  maxSupply: decimal("max_supply").notNull(),
  ath: decimal("ath").notNull(),
  athChangePercentage: decimal("ath_change_percentage").notNull(),
  atl: decimal("atl").notNull(),
  atlChangePercentage: decimal("atl_change_percentage").notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenTransfers = pgTable("token_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromAddress: varchar("from_address", { length: 44 }).notNull(),
  toAddress: varchar("to_address", { length: 44 }).notNull(),
  amount: decimal("amount").notNull(),
  amountUsd: decimal("amount_usd").notNull(),
  time: integer("time").notNull(),
  tokenAddress: varchar("token_address", { length: 44 }).notNull(),
});

export const wallets = pgTable("wallets", {
  address: varchar("address", { length: 44 }).primaryKey(),
  balanceCount: integer().notNull().default(0),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const walletBalances = pgTable("wallet_balances", {
  address: varchar("wallet_address", { length: 44 }).primaryKey(),
  tokenAddress: varchar("token_address", { length: 44 }),
  totalValueUsd: decimal("total_value_usd").notNull(),
  // Amount of token units
  amount: decimal("amount").notNull(),
  valueUsd: decimal("value_usd").notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tableMeta = pgTable("table_meta", {
  tableName: text("table_name").notNull(),
  lastRefresh: timestamp("last_refresh")
    .notNull()
    .$onUpdate(() => new Date()),
});

// The point of cg token - id list is that it rarely changes, and when it does,
// it'd be better that we update all at once
export const coinGeckoTokenList = pgTable("coin_gecko_token_list", {
  tokenAddress: varchar("token_address", { length: 44 }).primaryKey(),
  // coinGeckId won't be unique during let's say an update that swaps two ids
  coinGeckoId: text().notNull(),
  outes,
});

// Relations

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
