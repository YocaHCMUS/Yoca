import {
  pgTable,
  varchar,
  numeric,
  timestamp,
  foreignKey,
  serial,
  text,
  uuid,
  boolean,
  unique,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tokenMarketData = pgTable("token_market_data", {
  address: varchar({ length: 44 }),
  priceUsd: numeric().notNull(),
  marketCap: numeric().notNull(),
  usd24HVol: numeric().notNull(),
  usd24HChange: numeric().notNull(),
  high24H: numeric().notNull(),
  low24H: numeric().notNull(),
  fullyDilutedValuation: numeric().notNull(),
  totalVolume: numeric().notNull(),
  circulatingSupply: numeric().notNull(),
  totalSupply: numeric().notNull(),
  maxSupply: numeric().notNull(),
  ath: numeric().notNull(),
  athChangePercentage: numeric().notNull(),
  atl: numeric().notNull(),
  atlChangePercentage: numeric().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const postsTable = pgTable(
  "posts_table",
  {
    id: serial().primaryKey().notNull(),
    title: text().notNull(),
    content: text().notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "posts_table_user_id_users_id_fk",
    }).onDelete("cascade"),
  ],
);

export const tokenMeta = pgTable("token_meta", {
  address: varchar({ length: 44 }).primaryKey().notNull(),
  name: text().notNull(),
  symbol: text().notNull(),
  isNative: boolean("is_native").default(false).notNull(),
  isWrapped: boolean("is_wrapped").default(false).notNull(),
  imageUrl: text("image_url"),
  description: text(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    age: integer().notNull(),
    email: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [unique("users_email_unique").on(table.email)],
);

export const wallets = pgTable("wallets", {
  address: varchar({ length: 44 }).primaryKey().notNull(),
  balanceCount: integer().default(0).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const tokenTransfers = pgTable("token_transfers", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  fromAddress: varchar("from_address", { length: 44 }).notNull(),
  toAddress: varchar("to_address", { length: 44 }).notNull(),
  amount: numeric().notNull(),
  amountUsd: numeric().notNull(),
  time: integer().notNull(),
  tokenAddress: varchar("token_address", { length: 44 }).notNull(),
});
