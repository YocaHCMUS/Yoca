import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

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

export type CoingeckoTokenListInsert = typeof coinGeckoTokenList.$inferInsert;

export const zerionTokenList = pgTable("zerion_token_list", {
  tokenAddress: varchar("token_address", { length: 44 }).primaryKey(),
  // coinGeckId won't be unique during let's say an update that swaps two ids
  zerionId: text("zerion_id").notNull(),
});

export type ZerionTokenListInsert = typeof zerionTokenList.$inferInsert;
