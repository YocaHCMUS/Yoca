Below is the **final cleaned-up schema**, reflecting everything discussed:

- Clear separation: shared / token / trading
- Minimal but correct alert history
- Proper `onDelete` behavior

---

# Shared Layer

```ts
import {
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  decimal as dec,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

function decimal(name: string) {
  return dec(name, { mode: "number" });
}
```

---

## Enums

```ts
export const enumAlertType = pgEnum("alert_type", ["token", "trading"]);

export const enumAlertStatus = pgEnum("alert_status", ["running", "stopped"]);

export const enumAlertTriggerMode = pgEnum("alert_trigger_mode", [
  "once",
  "always",
]);

export const enumConditionOp = pgEnum("condition_op", [
  "gt",
  "gte",
  "eq",
  "lt",
  "lte",
]);

export const enumAlertPeriod = pgEnum("alert_period", [
  "30m",
  "1h",
  "6h",
  "24h",
]);
```

---

## `alerts`

```ts
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  alertType: enumAlertType("alert_type").notNull(),

  name: varchar("name", { length: 255 }).notNull(),

  triggerMode: enumAlertTriggerMode("trigger_mode").notNull().default("once"),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

---

## `alert_delivery`

```ts
export const alertDelivery = pgTable("alert_delivery", {
  id: uuid("id").primaryKey().defaultRandom(),

  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),

  email: varchar("email", { length: 255 }).notNull(),
});
```

---

## `alert_state`

```ts
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
```

---

# Token Alert Subsystem

## Enums

```ts
export const enumTokenMetric = pgEnum("token_metric", [
  "price_usd",
  "price_change_pct",
]);
```

---

## `token_alert_targets`

```ts
export const tokenAlertTargets = pgTable("token_alert_targets", {
  alertId: uuid("alert_id")
    .primaryKey()
    .references(() => alerts.id, { onDelete: "cascade" }),

  tokenAddress: varchar("token_address", { length: 44 }).notNull(),
});
```

---

## `token_alert_conditions`

```ts
export const tokenAlertConditions = pgTable("token_alert_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),

  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),

  metric: enumTokenMetric("metric").notNull(),

  period: enumAlertPeriod("period").notNull().default("1h"),

  conditionOp: enumConditionOp("condition_op").notNull(),

  value: decimal("value").notNull(),
});
```

---

# Trading Alert Subsystem

## Enums

```ts
export const enumTradeDirection = pgEnum("trade_direction", [
  "buy",
  "sell",
  "both",
]);

export const enumTradingAggregation = pgEnum("trading_aggregation", [
  "volume_usd",
  "trade_count",
]);
```

---

## `trading_alert_scopes`

```ts
export const tradingAlertScopes = pgTable("trading_alert_scopes", {
  id: uuid("id").primaryKey().defaultRandom(),

  alertId: uuid("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),

  walletAddress: varchar("wallet_address", { length: 44 }),

  tokenAddress: varchar("token_address", { length: 44 }),

  poolAddress: varchar("pool_address", { length: 44 }),

  counterpartyAddress: varchar("counterparty_address", {
    length: 44,
  }),

  direction: enumTradeDirection("direction").notNull().default("both"),
});
```

---

## `trading_alert_conditions`

```ts
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
```

---

# Alert History (minimal, safe)

```ts
export const alertHistory = pgTable("alert_history", {
  id: uuid("id").primaryKey().defaultRandom(),

  alertId: uuid("alert_id").references(() => alerts.id, {
    onDelete: "set null", // IMPORTANT
  }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  alertName: varchar("alert_name", { length: 255 }).notNull(),

  message: varchar("message", { length: 1000 }).notNull(),

  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),

  readAt: timestamp("read_at"),
});
```

---

# Final structure (mental model)

- **alerts** → core definition
- **token\_\* tables** → token logic
- **trading\_\* tables** → trading logic
- **alert_history** → immutable user-facing log

---

This version is:

- Strictly separated
- Safe against accidental data loss
- Flexible for future trading complexity
- Still simple enough to operate without over-engineering
