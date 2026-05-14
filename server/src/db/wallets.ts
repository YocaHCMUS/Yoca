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
