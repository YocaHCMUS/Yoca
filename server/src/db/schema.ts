import {
  integer,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  decimal,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  isNative: boolean("is_native").notNull().default(false),
  isWrapped: boolean("is_wrapped").notNull().default(false),
  imageUrl: text("image_url"),
  description: text("description"),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar("address", { length: 44 }),
  priceUsd: decimal("price_usd").notNull(),
  marketCap: decimal("market_cap").notNull(),
  usd24hVol: decimal("usd_24h_vol").notNull(),
  usd24hChange: decimal("usd_24h_change").notNull(),
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
  walletAddress: varchar("wallet_address", { length: 44 }).primaryKey(),
  tokenAddress: varchar("token_address", { length: 44 }).primaryKey(),
  totalValueUsd: decimal("total_value_usd").notNull(),
  // Amount of token units
  amount: decimal("amount").notNull(),
  valueUsd: decimal("value_usd").notNull(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const coinGeckoTokenList = pgTable("coin_gecko_token_list", {
  tokenAddress: varchar("token_address", { length: 44 }).primaryKey(),
  coinGeckoId: text().notNull().unique(),
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
    fields: [walletBalances.walletAddress],
    references: [wallets.address],
  }),
}));

export type TokenMetaSelect = typeof tokenMeta.$inferSelect;
