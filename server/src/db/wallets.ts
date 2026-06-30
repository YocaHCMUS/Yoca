import dayjs from "dayjs";
import {
    bigint,
    decimal as dec,
    index,
    integer,
    jsonb,
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

export type WalletAnalysisPeriodTimeframe = {
  date: string;
  realized: number;
};

export type WalletAnalysisCalendarDay = {
  date: string;
  volumeBuy: number;
  volumeSell: number;
  totalVolume: number;
  buys: number;
  sells: number;
  realizedPnlUSD: number;
};

export const walletAnalyses = pgTable(
  "wallet_analyses",
  {
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    period: varchar("period", { length: 3 }).notNull(),
    winrate: decimal("winrate").notNull(),
    totalTrades: integer("total_trades").notNull(),
    winningTrades: integer("winning_trades").notNull(),
    losingTrades: integer("losing_trades").notNull(),
    avgWinUsd: decimal("avg_win_usd").notNull(),
    avgLossUsd: decimal("avg_loss_usd").notNull(),
    win0To50Count: integer("win_0_to_50_count").notNull(),
    win50To200Count: integer("win_50_to_200_count").notNull(),
    win200To500Count: integer("win_200_to_500_count").notNull(),
    winOver500Count: integer("win_over_500_count").notNull(),
    loss0To50Count: integer("loss_0_to_50_count").notNull(),
    lossOver50Count: integer("loss_over_50_count").notNull(),
    buyVolumeUsd: decimal("buy_volume_usd").notNull(),
    sellVolumeUsd: decimal("sell_volume_usd").notNull(),
    buyTransactionCount: integer("buy_transaction_count").notNull(),
    sellTransactionCount: integer("sell_transaction_count").notNull(),
    transactionCount: integer("transaction_count").notNull(),
    tokensTradedCount: integer("tokens_traded_count").notNull(),
    pnlTotalUsd: decimal("pnl_total_usd").notNull(),
    pnlRealizedUsd: decimal("pnl_realized_usd").notNull(),
    pnlUnrealizedUsd: decimal("pnl_unrealized_usd").notNull(),
    periodTimeframes: jsonb("period_timeframes")
      .$type<WalletAnalysisPeriodTimeframe[]>()
      .notNull()
      .default([]),
    calendarBreakdown: jsonb("calendar_breakdown")
      .$type<WalletAnalysisCalendarDay[]>()
      .notNull()
      .default([]),
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.walletAddress, t.period] })],
);

export type WalletAnalysisSelect = typeof walletAnalyses.$inferSelect;
export type WalletAnalysisInsert = typeof walletAnalyses.$inferInsert;

export const walletTransferHistory = pgTable(
  "wallet_transfer_history",
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
    index("wallet_transfer_history_address_block_timestamp_idx").on(
      t.address,
      t.blockTimestampMs,
    ),
  ],
);

export type WalletTransferHistoryInsert =
  typeof walletTransferHistory.$inferInsert;

export const walletTransferHistoryMeta = pgTable(
  "wallet_transfer_history_meta",
  {
    address: varchar("address", { length: 44 }).notNull(),
    fromExclusiveMs: bigint("from_exclusive_ms", { mode: "number" }).notNull(),
    toInclusiveMs: bigint("to_inclusive_ms", { mode: "number" }).notNull(),
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" })
      .notNull()
      .$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.toInclusiveMs] }),
  ],
);


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
    index("wallet_swap_history_address_block_timestamp_idx").on(
      t.address,
      t.blockTimestampMs,
    ),
  ],
);

export const walletSwapHistoryMeta = pgTable(
  "wallet_swap_history_meta",
  {
    address: varchar("address", { length: 44 }).notNull(),
    fromExclusiveMs: bigint("from_exclusive_ms", { mode: "number" }).notNull(),
    toInclusiveMs: bigint("to_inclusive_ms", { mode: "number" }).notNull(),
    fetchedAtMs: bigint("fetched_at_ms", { mode: "number" })
      .notNull()
      .$onUpdate(() => dayjs.utc().valueOf()),
  },
  (t) => [
    primaryKey({ columns: [t.address, t.toInclusiveMs] }),
  ],
);
