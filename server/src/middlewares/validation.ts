import { setErr } from "@sv/config/errors.js";
import { statusCode } from "@sv/util/responses.js";
import type { ValidationTargets } from "hono";
import { validator } from "hono/validator";
import z from "zod";

export const solanaAddressSchema = z
  .string()
  .trim()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana address format");

export const solanaTxHashSchema = z
  .string()
  .trim()
  .min(87)
  .max(88)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana transaction hash format");

export const paginationSchema = z.object({
  limit: z.coerce.number(),
  offset: z.coerce.number(),
});

export const daysQuerySchema = z.object({
  days: z.coerce.number().positive().optional(),
});

export const addressSchema = z.object({
  address: solanaAddressSchema,
});

export const addressListSchema = z.object({
  addresses: z
    .string()
    .transform((v) => v.split(","))
    .pipe(solanaAddressSchema.array()),
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
  pubKey: solanaAddressSchema,
});

export const solanaVerificationRequestSchema = z.object({
  pubKey: solanaAddressSchema,
  signature: z.base64(),
});

export const userPayloadSchema = z.object({
  id: z.string(),
  exp: z.number(),
  displayName: z.string().nullable(),
});

export const searchQuerySchema = z.object({
  q: z.string().optional(),
});

export const transactionListSchema = z.object({
  transactions: z
    .string()
    .transform((v) => v.split(","))
    .pipe(solanaTxHashSchema.array()),
});

// Notes: All schema fields of Hono's "query" must be optional for the
// type inferrence to work correct (for some reason)
export const recentTradesQuerySchema = z.object({
  timeWindow: z.enum(["6h", "12h", "24h"]).default("24h").optional(),
  usdThreshold: z.coerce.number().min(0).default(0).optional(),
  sortBy: z.enum(["volume", "time"]).default("volume").optional(),
});

export const walletTokenTradesSchema = z.object({
  walletAddress: solanaAddressSchema,
  tokenAddress: solanaAddressSchema,
});

// Helper to validate using Zod schema and return if errors happen before the routes even run
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
