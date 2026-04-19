import {
  decimal as dec,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// Decimal with number mode to accept numbers directly
function decimal(name: string) {
  return dec(name, { mode: "number" });
}

export const enumConditionOp = pgEnum("condition_op", [
  "gt",
  "gte",
  "eq",
  "lt",
  "lte",
]);

export const enumAlertTokenMetric = pgEnum("alert_token_metric", [
  "price_percentage",
  "price_usd",
  "volume_usd",
  "buying_volume_usd",
  "buying_volume_percentage",
  "selling_volume_usd",
  "selling_volume_percentage",
  "trades",
  "trades_percentage",
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

export const userAlerts = pgTable("user_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenAddress: varchar("token_address", { length: 44 }).notNull(),
  triggerMode: enumAlertTriggerMode("trigger_mode").notNull().default("once"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  alertName: varchar("alert_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userAlertConditions = pgTable("user_alert_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id")
    .notNull()
    .references(() => userAlerts.id, { onDelete: "cascade" }),
  period: enumAlertPeriod("period").notNull().default("1h"),
  alertType: enumAlertTokenMetric("metric").notNull(),
  conditionOp: enumConditionOp("condition_op").notNull(),
  value: decimal("value").notNull(),
});

export const userAlertState = pgTable("user_alert_state", {
  alertId: uuid("alert_id")
    .primaryKey()
    .references(() => userAlerts.id, { onDelete: "cascade" }),
  status: enumAlertStatus("status").notNull().default("running"),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Export types for inserting and selecting data
export type UserAlertInsert = typeof userAlerts.$inferInsert;
export type UserAlertSelect = typeof userAlerts.$inferSelect;
export type UserAlertConditionSelect = typeof userAlertConditions.$inferSelect;
export type UserAlertTokenMetric =
  (typeof enumAlertTokenMetric.enumValues)[number];
export type UserAlertStatus = (typeof enumAlertStatus.enumValues)[number];
export type UserAlertConditionOp = (typeof enumConditionOp.enumValues)[number];
export type UserAlertPeriod = (typeof enumAlertPeriod.enumValues)[number];
export type UserAlertTriggerMode =
  (typeof enumAlertTriggerMode.enumValues)[number];
export type UserAlertConditionInsert = typeof userAlertConditions.$inferInsert;
export const userAlertConditionOps = enumConditionOp.enumValues;
export const userAlertTokenMetric = enumAlertTokenMetric.enumValues;
export const userAlertPeriods = enumAlertPeriod.enumValues;
export const userAlertTriggerModes = enumAlertTriggerMode.enumValues;
export const userAlertStatus = enumAlertStatus.enumValues;
