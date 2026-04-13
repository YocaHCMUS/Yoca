import { AUTH_COOKIE_NAME } from "@sv/config/constants";
import { setErr } from "@sv/config/errors.js";
import {
  userAlertConditionOps,
  userAlertPeriods,
  userAlertTypes,
} from "@sv/db/alert.js";
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

export const createAlertSchema = z.object({
  tokenAddress: z.string().min(1),
  alertType: z.enum(userAlertTypes),
  period: z.enum(userAlertPeriods),
  conditions: z
    .array(
      z.object({
        condition: z.enum(userAlertConditionOps),
        value: z.coerce.number(),
      }),
    )
    .min(1, "At least one condition is required"),
});

export const updateAlertSchema = z.object({
  alertType: z.enum(userAlertTypes),
  period: z.enum(userAlertPeriods),
  conditions: z
    .array(
      z.object({
        condition: z.enum(userAlertConditionOps),
        value: z.coerce.number(),
      }),
    )
    .min(1, "At least one condition is required"),
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
