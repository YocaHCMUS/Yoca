import { InferInsertModel, InferSelectModel } from "drizzle-orm";
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
export const enumAlertType = pgEnum("alert_type", [
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
  period: enumAlertPeriod("period").notNull().default("1h"),
  triggerMode: enumAlertTriggerMode("trigger_mode").notNull().default("once"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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
  alertType: enumAlertType("alert_type").notNull(),
  conditionOp: enumConditionOp("condition_op").notNull(),
  value: decimal("value").notNull(),
});

// Export types for inserting and selecting data
export type UserAlertInsert = typeof userAlerts.$inferInsert;
export type UserAlertSelect = typeof userAlerts.$inferSelect;

export type UserAlertConditionInsert = InferInsertModel<
  typeof userAlertConditions
>;
export type UserAlertConditionSelect = InferSelectModel<
  typeof userAlertConditions
>;

export type UserAlertType = (typeof enumAlertType.enumValues)[number];
export type UserAlertConditionOp = (typeof enumConditionOp.enumValues)[number];
export type UserAlertPeriod = (typeof enumAlertPeriod.enumValues)[number];
export type UserAlertTriggerMode =
  (typeof enumAlertTriggerMode.enumValues)[number];
export const userAlertConditionOps = enumConditionOp.enumValues;
export const userAlertTypes = enumAlertType.enumValues;
export const userAlertPeriods = enumAlertPeriod.enumValues;
export const userAlertTriggerModes = enumAlertTriggerMode.enumValues;
