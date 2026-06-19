import dayjs from "dayjs";
import {
    bigint,
    decimal as dec,
    index,
    pgEnum,
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

// Currently in migration to Zerion API, this
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

export const walletRecentSwaps = pgTable(
  "wallet_recent_swaps",
  {
    transactionHash: varchar("transaction_hash", { length: 88 }).notNull(),
    actId: varchar("act_id", { length: 10 }).notNull(),
    address: varchar("address", { length: 44 }).notNull(),
    blockTimestampMs: bigint("block_timestamp_ms", {
      mode: "number",
    }).notNull(),
    tokenIn: varchar("token_in", { length: 44 }).notNull(), // token received (bought)
    tokenOut: varchar("token_out", { length: 44 }).notNull(), // token sent (sold)
    tokenInPriceUsd: decimal("token_in_price_usd"),
    tokenOutPriceUsd: decimal("token_out_price_usd"),
    amountIn: decimal("amount_in").notNull(),
    amountOut: decimal("amount_out").notNull(),
    valueUsd: decimal("value_usd").notNull(),
    // No direction field needed – it's implicit: "in" is received, "out" is sent
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" })
      .notNull()
      .$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.transactionHash, t.actId] }),
    index("wallet_recent_swaps_address_fetched_at_idx").on(
      t.address,
      t.fetchedAtMs,
    ),
  ],
);

export type WalletRecentSwapsSelect = typeof walletRecentSwaps.$inferSelect;
export type WalletRecentSwapsInsert = typeof walletRecentSwaps.$inferInsert;

export const enumTransferDirection = pgEnum("transfer_direction", [
  "send",
  "receive",
]);

export const walletRecentTransfers = pgTable(
  "wallet_recent_transfers",
  {
    transactionHash: varchar("transaction_hash", { length: 88 }).notNull(),
    actId: varchar("act_id", { length: 10 }).notNull(),
    address: varchar("address", { length: 44 }).notNull(),
    blockTimestampMs: bigint("block_timestamp_ms", {
      mode: "number",
    }).notNull(),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    priceUsd: decimal("price_usd"),
    amount: decimal("amount").notNull(),
    valueUsd: decimal("value_usd").notNull(),
    direction: enumTransferDirection().notNull(),
    counterpartyAddress: varchar("counterparty_address", {
      length: 44,
    }).notNull(),
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" })
      .notNull()
      .$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.transactionHash, t.actId] }),
    index("wallet_recent_transfers_address_fetched_at_idx").on(
      t.address,
      t.fetchedAtMs,
    ),
  ],
);

export type WalletRecentTransfersSelect =
  typeof walletRecentTransfers.$inferSelect;
export type WalletRecentTransfersInsert =
  typeof walletRecentTransfers.$inferInsert;


export const walletSwapHistory = pgTable(
  "wallet_swap_history",
  {
    transactionHash: varchar("transaction_hash", { length: 88 }).notNull(),
    actId: varchar("act_id", { length: 10 }).notNull(),
    address: varchar("address", { length: 44 }).notNull(),
    blockTimestampMs: bigint("block_timestamp_ms", {
      mode: "number",
    }).notNull(),
    tokenIn: varchar("token_in", { length: 44 }).notNull(), // token received (bought)
    tokenOut: varchar("token_out", { length: 44 }).notNull(), // token sent (sold)
    tokenInPriceUsd: decimal("token_in_price_usd"),
    tokenOutPriceUsd: decimal("token_out_price_usd"),
    amountIn: decimal("amount_in").notNull(),
    amountOut: decimal("amount_out").notNull(),
    valueUsd: decimal("value_usd").notNull(),
    // No direction field needed – it's implicit: "in" is received, "out" is sent
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" })
      .notNull()
      .$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.transactionHash, t.actId] }),
    index("wallet_swap_history_address_fetched_at_idx").on(
      t.address,
      t.fetchedAtMs,
    ),
  ],
);

export const walletSwapHistoryMeta = pgTable(
  "wallet_swap_history_meta",
  {
    address: varchar("address", { length: 44 }).notNull(),
    fromInclusiveMs: bigint("from_inclusive_ms", { mode: "number" }).notNull(),
    toExclusiveMs: bigint("to_exclusive_ms", { mode: "number" }).notNull(),
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" })
      .notNull()
      .$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.fromInclusiveMs] }),
  ],
);
