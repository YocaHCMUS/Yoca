import dayjs from "dayjs";
import {
  bigint,
  decimal as dec,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

function decimal(name: string) {
  return dec(name, { mode: "number" });
}

export const walletTokenBalanceHistory = pgTable(
  "wallet_token_balance_history",
  {
    address: varchar("address", { length: 66 }).notNull(),

    tokenAddress: varchar("token_address", {
      length: 66,
    }).notNull(),

    timestampMs: bigint("timestamp_ms", {
      mode: "number",
    }).notNull(),

    tokenBalance: decimal("token_balance").notNull(),

    usdValue: decimal("usd_value").notNull(),

    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.address, t.tokenAddress, t.timestampMs],
    }),
  ],
);

export type WalletTokenBalanceHistorySelect =
  typeof walletTokenBalanceHistory.$inferSelect;
export type WalletTokenBalanceHistoryInsert =
  typeof walletTokenBalanceHistory.$inferInsert;

// Currrently in migration to Zerion API, this
// table now store at max a month (can store previous
// months but gaps won't be resolved)
export const walletBalanceHistory = pgTable(
  "wallet_balance_history",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timestampMs: bigint("timestamp_ms", {
      mode: "number",
    }).notNull(),
    usdValue: decimal("usd_value").notNull(),
    updatedAtMs: bigint("updated_at_ms", {
      mode: "number",
    }).$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({
      columns: [t.address, t.timestampMs],
    }),
  ],
);

export const walletBalanceWeekHistory = pgTable(
  "wallet_balance_week_history",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timestampMs: bigint("timestamp_ms", {
      mode: "number",
    }).notNull(),
    usdValue: decimal("usd_value").notNull(),
    updatedAtMs: bigint("updated_at_ms", {
      mode: "number",
    }).$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({
      columns: [t.address, t.timestampMs],
    }),
  ],
);

export const walletBalanceMonthHistory = pgTable(
  "wallet_balance_month_history",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timestampMs: bigint("timestamp_ms", {
      mode: "number",
    }).notNull(),
    usdValue: decimal("usd_value").notNull(),
    updatedAtMs: bigint("updated_at_ms", {
      mode: "number",
    }).$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({
      columns: [t.address, t.timestampMs],
    }),
  ],
);

// Unfortunately, there is no token amount yet
export const walletTokenBalanceWeekHistory = pgTable(
  "wallet_token_balance_week_history",
  {
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    timestampMs: bigint("timestamp_ms", {
      mode: "number",
    }).notNull(),
    usdValue: decimal("usd_value").notNull(),
    updatedAtMs: bigint("updated_at_ms", {
      mode: "number",
    }).$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({
      columns: [t.walletAddress, t.tokenAddress, t.timestampMs],
    }),
  ],
);

export const walletTokenBalanceMonthHistory = pgTable(
  "wallet_token_balance_month_history",
  {
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    timestampMs: bigint("timestamp_ms", {
      mode: "number",
    }).notNull(),
    usdValue: decimal("usd_value").notNull(),
    updatedAtMs: bigint("updated_at_ms", {
      mode: "number",
    }).$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({
      columns: [t.walletAddress, t.timestampMs],
    }),
  ],
);

export type WalletBalanceHistorySelect =
  typeof walletBalanceHistory.$inferSelect;
export type WalletBalanceHistoryInsert =
  typeof walletBalanceHistory.$inferInsert;
