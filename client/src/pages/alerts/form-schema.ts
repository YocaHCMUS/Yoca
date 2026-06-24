import type {
  UserAlertConditionOp,
  UserAlertPeriod,
  UserAlertTokenMetric,
  UserAlertTriggerMode,
} from "@/api/alerts";
import {
  emptyStringAsUndefinedSchema,
  solanaBase58Schema,
} from "@/util/validation";
import { z } from "zod";

export const alertTypes = [
  "technical-indicators",
  "token-stats",
  "trading-events",
  "market-movements",
] as const;

export type AlertType = (typeof alertTypes)[number];

export type AlertStep = "type-selection" | "configuration";

export const alertPeriods: UserAlertPeriod[] = ["30m", "1h", "6h", "24h"];
export const triggerModes: UserAlertTriggerMode[] = ["once", "always"];

const conditionOps: UserAlertConditionOp[] = ["gt", "gte", "eq", "lt", "lte"];

export const conditionOptions: {
  id: UserAlertConditionOp;
  text: string;
}[] = [
  { id: "gt", text: ">" },
  { id: "gte", text: "≥" },
  { id: "eq", text: "=" },
  { id: "lt", text: "<" },
  { id: "lte", text: "≤" },
];

export const periodOptions: { id: UserAlertPeriod; text: string }[] = [
  { id: "30m", text: "30 Minutes" },
  { id: "1h", text: "1 Hour" },
  { id: "6h", text: "6 Hours" },
  { id: "24h", text: "24 Hours" },
];

export const tokenAlertMetrics: UserAlertTokenMetric[] = [
  "price_percentage",
  "price_usd",
];

export const tradingEventTypes = ["any_trade", "buy", "sell", "swap"] as const;
export type TradingEventType = (typeof tradingEventTypes)[number];

export const tradingEventTypeOptions: { id: TradingEventType; text: string }[] = [
  { id: "any_trade", text: "Any trade" },
  { id: "buy", text: "Buy (best effort)" },
  { id: "sell", text: "Sell (best effort)" },
  { id: "swap", text: "Swap" },
];

const selectedTokenSchema = z.object({
  address: solanaBase58Schema,
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  imgUrl: z.string().nullable(),
});

export const tokenConditionSchema = z.object({
  period: z.enum(alertPeriods),
  metric: z.enum(tokenAlertMetrics),
  op: z.enum(conditionOps),
  value: z.coerce.number(),
});

export const tradingEventTargetSchema = z.object({
  token: selectedTokenSchema,
  walletAddress: z
    .union([emptyStringAsUndefinedSchema, solanaBase58Schema])
    .optional(),
});

const timeHHmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm format");

const baseAlertSchema = z
  .object({
    triggerMode: z.enum(triggerModes),
    expiresAtDate: z.date(),
    expiresAtTime: timeHHmm,
    alertName: z.string().trim().min(1),
    emailEnabled: z.boolean(),
    email: z.string().optional(),
    discordEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const email = data.email?.trim();

    if (!data.emailEnabled && !data.discordEnabled) {
      ctx.addIssue({
        path: ["emailEnabled"],
        code: "custom",
        message: "Select email and/or Discord delivery",
      });
      return;
    }

    if (!data.emailEnabled) return;

    if (!email) {
      ctx.addIssue({
        path: ["email"],
        code: "custom",
        message: "Email is required when email is enabled",
      });
      return;
    }

    if (!z.email().safeParse(email).success) {
      ctx.addIssue({
        path: ["email"],
        code: "custom",
        message: "Invalid email format",
      });
    }
  });

export const tokenStatsSchema = baseAlertSchema.extend({
  type: z.literal("token-stats"),
  token: selectedTokenSchema,
  tokenConditions: z.array(tokenConditionSchema).min(1).max(3),
});

export const tradingEventsSchema = baseAlertSchema.extend({
  type: z.literal("trading-events"),
  tradingTarget: tradingEventTargetSchema,
  eventType: z.enum(tradingEventTypes),
  minSolAmount: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a positive SOL amount",
        });
        return z.NEVER;
      }
      return amount;
    }),
});

export const alertFormSchema = z.discriminatedUnion("type", [
  tokenStatsSchema,
  tradingEventsSchema,
]);

export type BaseAlertForm = z.output<typeof baseAlertSchema>;
export type TokenAlertForm = z.output<typeof tokenStatsSchema>;
export type TradingAlertForm = z.output<typeof tradingEventsSchema>;
export type TradingAlertFormInput = z.input<typeof tradingEventsSchema>;
export type TokenAlertCondition = z.output<typeof tokenConditionSchema>;
export type TokenAlertMetric = (typeof tokenAlertMetrics)[number];
export type AlertConfig = z.output<typeof alertFormSchema>;

export function combineLocalDateAndTime(
  validatedDate: Date,
  validatedTimeHHmm: string,
): string {
  const [hoursStr, minutesStr] = validatedTimeHHmm.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  const localDate = new Date(validatedDate);
  localDate.setHours(hours, minutes, 0, 0);
  return localDate.toISOString();
}
