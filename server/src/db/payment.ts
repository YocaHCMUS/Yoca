import {
  boolean,
  decimal as dec,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

function decimal(name: string) {
  return dec(name, { mode: "number" });
}

export const enumPlanTier = pgEnum("plan_tier", ["Lite", "Plus", "Pro"]);

export const enumSubscriptionStatus = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "trialing",
  "unpaid",
  "paused",
]);

export const enumPaymentStatus = pgEnum("payment_status", [
  "succeeded",
  "failed",
  "pending",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id").notNull().unique(),
  stripeCustomerId: varchar("stripe_customer_id").notNull(),
  planTier: enumPlanTier("plan_tier").notNull(),
  status: enumSubscriptionStatus("status").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date()),
});

export const paymentHistory = pgTable("payment_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
    onDelete: "set null",
  }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").unique(),
  stripeInvoiceId: varchar("stripe_invoice_id").unique(),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  status: enumPaymentStatus("status").notNull(),
  paymentMethodDetails: jsonb("payment_method_details"), // e.g. { brand: 'visa', last4: '4242' }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// #region Types
export type SubscriptionInsert = typeof subscriptions.$inferInsert;
export type SubscriptionSelect = typeof subscriptions.$inferSelect;
export type PaymentHistoryInsert = typeof paymentHistory.$inferInsert;
export type PaymentHistorySelect = typeof paymentHistory.$inferSelect;
// #endregion
