import {
  bigint,
  decimal as dec,
  index,
  integer,
  pgEnum,
  pgTable,
  varchar,
} from "drizzle-orm/pg-core";

function decimal(name: string) {
  return dec(name, { mode: "number" });
}

export const enumActionType = pgEnum("action_type", [
  "TRANSFER",
  "SWAP",
  "ADD_LIQUIDITY",
  "REMOVE_LIQUIDITY",
  "STAKE",
  "UNSTAKE",
  "BORROW",
  "REPAY",
  "NFT_MINT",
  "NFT_TRADE",
  "DEPOSIT",
  "WITHDRAW",
  "CLAIM_REWARD",
  "CREATE_ACCOUNT",
  "CLOSE_ACCOUNT",
  "OTHER",
]);

export const txInfo = pgTable(
  "tx_info",
  {
    txHash: varchar("tx_hash", { length: 88 }).primaryKey(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    slot: bigint("slot", { mode: "number" }),
    fee: bigint("fee", { mode: "number" }),
    feePayer: varchar("fee_payer", { length: 44 }),
  },
  (table) => [
    index("idx_tx_info_timestamp").on(table.timestamp),
    index("idx_tx_info_fee_payer").on(table.feePayer),
  ],
);

export const txTokenTransfers = pgTable(
  "tx_token_transfers",
  {
    _txId: integer("_tx_id")
      .generatedAlwaysAsIdentity({ startWith: 1 })
      .primaryKey(),
    txHash: varchar("tx_hash", { length: 88 })
      .notNull()
      .references(() => txInfo.txHash, { onDelete: "cascade" }),
    fromWallet: varchar("from_wallet", { length: 44 }),
    toWallet: varchar("to_wallet", { length: 44 }),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
    amount: decimal("amount").notNull(),
  },
  (table) => [
    index("idx_tx_token_transfers_tx_hash").on(table.txHash),
    index("idx_tx_token_transfers_from_wallet").on(table.fromWallet),
    index("idx_tx_token_transfers_to_wallet").on(table.toWallet),
    index("idx_tx_token_transfers_mint").on(table.tokenAddress),
  ],
);

export const txNativeTransfers = pgTable(
  "tx_native_transfers",
  {
    _txId: integer("_tx_id")
      .generatedAlwaysAsIdentity({ startWith: 1 })
      .primaryKey(),
    txHash: varchar("tx_hash", { length: 88 })
      .notNull()
      .references(() => txInfo.txHash, { onDelete: "cascade" }),
    fromWallet: varchar("from_wallet", { length: 44 }),
    toWallet: varchar("to_wallet", { length: 44 }),
    amount: decimal("amount").notNull(),
  },
  (table) => [
    index("idx_tx_native_transfers_tx_hash").on(table.txHash),
    index("idx_tx_native_transfers_from_wallet").on(table.fromWallet),
    index("idx_tx_native_transfers_to_wallet").on(table.toWallet),
  ],
);

export type TxInfoInsert = typeof txInfo.$inferInsert;
export type TxTokenTransfersInsert = typeof txTokenTransfers.$inferInsert;
export type TxNativeTransfersInsert = typeof txNativeTransfers.$inferInsert;
export type TxInfoSelect = typeof txInfo.$inferSelect;
export type TxTokenTransfersSelect = typeof txTokenTransfers.$inferSelect;
export type TxNativeTransfersSelect = typeof txNativeTransfers.$inferSelect;
