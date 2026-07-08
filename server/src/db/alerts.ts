import {
  decimal as dec,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

function decimal(name: string) {
  return dec(name, { mode: "number" });
}

export const enumAlertType = pgEnum("alert_type", ["token", "trading"]);

export const enumConditionOp = pgEnum("condition_op", [
  "gt",
  "gte",
  "eq",
  "lt",
  "lte",
]);

export const enumTokenMetric = pgEnum("token_metric", [
  "price_percentage",
  "price_usd",
]);

export const enumAlertStatus = pgEnum("alert_status", ["running", "stopped"]);

export const enumAlertPeriod = pgEnum("alert_period", [
  "30m",
  "1h",
  "6h",
  "24h",
]);

export const enumAlertTriggerMode = pgEnum("alert_trigger_mode", [
  "once",
  "always",
]);

export const enumTradeDirection = pgEnum("trade_direction", [
  "buy",
  "sell",
  "both",
]);

export const enumTradingAggregation = pgEnum("trading_aggregation", [
  "volume_usd",
  "trade_count",
]);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  alertType: enumAlertType("alert_type").notNull(),
  triggerMode: enumAlertTriggerMode("trigger_mode").notNull().default("once"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const alertDelivery = pgTable("alert_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
});

export const alertState = pgTable("alert_state", {
  alertId: uuid("alert_id")
    .primaryKey()
    .references(() => alerts.id, { onDelete: "cascade" }),
  status: enumAlertStatus("status").notNull().default("running"),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const tokenAlertTargets = pgTable(
  "token_alert_targets",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, {
        onDelete: "cascade",
      }),
    tokenAddress: varchar("token_address", { length: 44 }).notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.alertId, t.tokenAddress],
    }),
  ],
);

export const tokenAlertConditions = pgTable("token_alert_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),
  period: enumAlertPeriod("period").notNull().default("1h"),
  metric: enumTokenMetric("metric").notNull(),
  conditionOp: enumConditionOp("condition_op").notNull(),
  value: decimal("value").notNull(),
});

export const tradingAlertScopes = pgTable(
  "trading_alert_scopes",
  {
    alertId: uuid("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 44 }).notNull(),
    tokenAddress: varchar("token_address", { length: 44 }),
    poolAddress: varchar("pool_address", { length: 44 }),
    counterpartyAddress: varchar("counterparty_address", { length: 44 }),
    direction: enumTradeDirection("direction").notNull().default("both"),
  },
  (t) => [
    primaryKey({
      columns: [t.alertId, t.walletAddress],
    }),
  ],
);

export const tradingAlertConditions = pgTable("trading_alert_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),
  aggregation: enumTradingAggregation("aggregation").notNull(),
  period: enumAlertPeriod("period").notNull().default("1h"),
  conditionOp: enumConditionOp("condition_op").notNull(),
  value: decimal("value").notNull(),
});

export const walletMetrics1m = pgTable(
  "wallet_metrics_1m",
  {
    wallet: varchar("wallet", { length: 44 }).notNull(),
    bucketTs: timestamp("bucket_ts").notNull(),
    volumeUsd: decimal("volume_usd").notNull().default(0),
    tradeCount: integer("trade_count").notNull().default(0),
  },
  (t) => [
    primaryKey({
      columns: [t.wallet, t.bucketTs],
    }),
  ],
);

export const userAlerts = alerts;
export const userAlertState = alertState;
export const userAlertConditions = tokenAlertConditions;

export type AlertInsert = typeof alerts.$inferInsert;
export type AlertSelect = typeof alerts.$inferSelect;
export type AlertStateSelect = typeof alertState.$inferSelect;
export type AlertDeliveryInsert = typeof alertDelivery.$inferInsert;
export type TokenAlertConditionInsert =
  typeof tokenAlertConditions.$inferInsert;
export type TokenAlertConditionSelect =
  typeof tokenAlertConditions.$inferSelect;
export type TradingAlertScopeInsert = typeof tradingAlertScopes.$inferInsert;
export type TradingAlertConditionInsert =
  typeof tradingAlertConditions.$inferInsert;

export type UserAlertInsert = AlertInsert;
export type UserAlertSelect = AlertSelect;
export type UserAlertConditionSelect = TokenAlertConditionSelect;
export type UserAlertTokenMetric = (typeof enumTokenMetric.enumValues)[number];
export type UserAlertStatus = (typeof enumAlertStatus.enumValues)[number];
export type UserAlertConditionOp = (typeof enumConditionOp.enumValues)[number];
export type UserAlertPeriod = (typeof enumAlertPeriod.enumValues)[number];
export type UserAlertTriggerMode =
  (typeof enumAlertTriggerMode.enumValues)[number];
export type UserAlertType = (typeof enumAlertType.enumValues)[number];
export type UserTradeDirection = (typeof enumTradeDirection.enumValues)[number];
export type UserTradingScopeSelect = typeof tradingAlertScopes.$inferSelect;
export type UserTradingAggregation =
  (typeof enumTradingAggregation.enumValues)[number];
export const WalletMetrics1mInsert = typeof walletMetrics1m.$inferInsert;

export const userAlertConditionOps = enumConditionOp.enumValues;
export const userAlertTokenMetric = enumTokenMetric.enumValues;
export const userAlertPeriods = enumAlertPeriod.enumValues;
export const userAlertTriggerModes = enumAlertTriggerMode.enumValues;
export const userAlertStatus = enumAlertStatus.enumValues;
export const userAlertTypes = enumAlertType.enumValues;
export const userTradeDirections = enumTradeDirection.enumValues;
export const userTradingAggregations = enumTradingAggregation.enumValues;
