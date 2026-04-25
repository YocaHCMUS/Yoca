import { AUTH_COOKIE_NAME } from "@sv/config/constants";
import { setErr } from "@sv/config/errors.js";
import {
  userAlertConditionOps,
  userAlertPeriods,
  userAlertTokenMetric,
  userAlertTriggerModes,
  userAlertTypes,
  userTradeDirections,
  userTradingAggregations,
} from "@sv/db/alerts.js";
import env from "@sv/util/load-env";
import { statusCode } from "@sv/util/responses.js";
import type { Context, Next, ValidationTargets } from "hono";
import { jwt } from "hono/jwt";
import { validator } from "hono/validator";
import z from "zod";

export const solanaBase58Schema = z
  .string()
  .trim()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/);

export const paginationSchema = z.object({
  limit: z.coerce.number(),
  offset: z.coerce.number(),
});

export const daysQuerySchema = z.object({
  days: z.coerce.number().positive().optional(),
});

export const addressSchema = z.object({
  address: solanaBase58Schema,
});

export const addressListSchema = z.object({
  addresses: z
    .string()
    .transform((v) => v.split(","))
    .pipe(solanaBase58Schema.array()),
});

export const tokenIdSchema = z.object({
  id: z.string().trim().min(1),
});

export const userCreationSchema = z.object({
  email: z.email("Invalid email format"),
  displayName: z.string().min(1).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const userVerificationSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const authProviderSchema = z.enum([
  "password",
  "google",
  "github",
  "solana",
  "other",
]);

export const providerQuerySchema = z.object({
  provider: authProviderSchema.optional(),
});

export const profileIdentityUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Display name cannot be empty")
      .max(128)
      .nullable()
      .optional(),
    email: z
      .email("Invalid email format")
      .transform((value) => value.trim().toLowerCase())
      .nullable()
      .optional(),
  })
  .refine(
    (value) => value.displayName !== undefined || value.email !== undefined,
    "At least one field must be provided",
  );

export const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: strongPasswordSchema,
  email: z
    .email("Invalid email format")
    .transform((value) => value.trim().toLowerCase())
    .nullable()
    .optional(),
});

export const deleteAccountSchema = z.object({
  confirmText: z
    .string()
    .trim()
    .refine(
      (value) => value === "DELETE MY ACCOUNT",
      "Confirm text must exactly match DELETE MY ACCOUNT",
    ),
  challengeToken: z.string().uuid().optional(),
});

export const googleTokenSchema = z.object({
  token: z.string().min(1),
});

export const solanaNounceRequestSchema = z.object({
  pubKey: solanaBase58Schema,
});

export const solanaVerificationRequestSchema = z.object({
  pubKey: solanaBase58Schema,
  signature: z.base64(),
});

export const userPayloadSchema = z.object({
  id: z.string(),
  exp: z.number(),
  displayName: z.string().nullable(),
});

export type UserPayload = z.infer<typeof userPayloadSchema>;

export const searchQuerySchema = z.object({
  q: z.string().optional(),
});

// Notes: All schema fields of Hono's "query" must be optional for the
// type inferrence to work correct (for some reasons)
export const recentTradesQuerySchema = z.object({
  timeWindow: z.enum(["6h", "12h", "24h"]).default("24h").optional(),
  usdThreshold: z.coerce.number().min(0).default(0).optional(),
  sortBy: z.enum(["volume", "time"]).default("volume").optional(),
});

export const walletTokenTradesSchema = z.object({
  walletAddress: solanaBase58Schema,
  tokenAddress: solanaBase58Schema,
});

const tokenAlertConditionSchema = z.object({
  period: z.enum(userAlertPeriods),
  metric: z.enum(userAlertTokenMetric),
  conditionOp: z.enum(userAlertConditionOps),
  value: z.coerce.number(),
});

const tradingAlertScopeSchema = z.object({
  walletAddress: solanaBase58Schema.optional().nullable(),
  tokenAddress: solanaBase58Schema.optional().nullable(),
  poolAddress: solanaBase58Schema.optional().nullable(),
  counterpartyAddress: solanaBase58Schema.optional().nullable(),
  direction: z.enum(userTradeDirections).default("both"),
});

const tradingAlertConditionSchema = z.object({
  aggregation: z.enum(userTradingAggregations),
  period: z.enum(userAlertPeriods),
  conditionOp: z.enum(userAlertConditionOps),
  value: z.coerce.number(),
});

export const createAlertSchema = z.discriminatedUnion("alertType", [
  z.object({
    alertType: z.literal(userAlertTypes[0]),
    name: z.string().trim().min(1),
    triggerMode: z.enum(userAlertTriggerModes).default("once"),
    expiresAt: z.iso.datetime({ offset: true }),
    delivery: z
      .object({
        email: z.email(),
      })
      .optional(),
    tokenTarget: z.object({
      tokenAddress: solanaBase58Schema,
    }),
    conditions: z
      .array(tokenAlertConditionSchema)
      .min(1, "At least one condition is required"),
  }),
  z.object({
    alertType: z.literal(userAlertTypes[1]),
    name: z.string().trim().min(1),
    triggerMode: z.enum(userAlertTriggerModes).default("once"),
    expiresAt: z.iso.datetime({ offset: true }),
    delivery: z
      .object({
        email: z.email(),
      })
      .optional(),
    scopes: z.array(tradingAlertScopeSchema).default([]),
    conditions: z
      .array(tradingAlertConditionSchema)
      .min(1, "At least one condition is required"),
  }),
]);

export const alertIdSchema = z.object({
  id: z.uuid(),
});

export function validate<
  T extends keyof ValidationTargets,
  U extends z.ZodType,
>(target: T, schema: U) {
  return validator(target, (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      return c.json(
        {
          ...setErr("VALIDATION_ERR"),
          message: `Invalid ${target} parameters`,
          details: parsed.error.issues,
        },
        statusCode.UnprocessableEntity,
      );
    }
    return parsed.data;
  });
}

export const honoJwt = (c: Context, next: Next) => {
  const jwtMiddleware = jwt({
    secret: env.JWT_SECRET,
    alg: "HS256",
    cookie: AUTH_COOKIE_NAME,
  });
  return jwtMiddleware(c, next);
};

// Check if result schema was like expected. Useful for debugging
export async function getTrackedApiResult<T extends z.ZodType>(
  schema: T,
  resp: Response,
) {
  try {
    const rawRes = await resp.json();
    const parseRes = schema.safeParse(rawRes);
    if (!parseRes.success) {
      console.log("Unexpected response!");
      console.log("Zod errors:", parseRes.error.issues);
      console.log(`Actual response (${resp.status}):`);
      const safeStr = (() => {
        try {
          return JSON.stringify(rawRes, null, 2);
        } catch {
          return String(rawRes);
        }
      })();
      const maxLog = 1000;
      if (safeStr.length > maxLog) {
        console.log(
          safeStr.slice(0, maxLog) +
            `\n... (truncated ${safeStr.length - maxLog} chars)`,
        );
      } else {
        console.log(safeStr);
      }
      return;
    }
    return parseRes.data;
  } catch (err) {
    console.log("Unexpected Error:", err);
    return;
  }
}

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  POSTGRES_DB_URL: z.url("Invalid database URL"),
  JWT_SECRET: z.string().min(1, "Jwt is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "Google client id is required"),
  SERVER_PORT: z.coerce.number().default(4000),

  // API Keys and URLs
  COINGECKO_API_BASE_URL: z.url().default("https://api.coingecko.com/api/v3"),
  COINGECKO_API_KEY: z.string(),
  BIRDEYE_API_BASE_URL: z.url().default("https://public-api.birdeye.so"),
  BIRDEYE_API_KEY: z.string(),
  HELIUS_API_KEY: z.string(),
  HELIUS_WEBHOOK_AUTH_KEY: z.string(),
  HELIUS_WEBHOOK_ID: z.string(),
  MORALIS_API_BASE_URL: z.url().default("https://solana-gateway.moralis.io"),
  MORALIS_API_KEY: z.string(),

  // Client domains
  CLIENT_LOCAL_DOMAIN: z.url().default("http://localhost:3000"),
  CLIENT_DEV_DOMAIN: z.url().default("http://localhost:3000"),
  CLIENT_DEV_PREVIEW_DOMAIN: z.url().default("http://localhost:4173"),
  CLIENT_PROD_DOMAIN: z.url(),
});

export type Env = z.infer<typeof envSchema>;
