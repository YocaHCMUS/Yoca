import { setErr } from "@sv/config/errors.js";
import { statusCode } from "@sv/util/responses.js";
import type { ValidationTargets } from "hono";
import { validator } from "hono/validator";
import { console } from "inspector";
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

export const searchQuerySchema = z.object({
  q: z.string().optional(),
});

export const recentTradesQuerySchema = z.object({
  timeWindow: z.enum(["6h", "12h", "24h"]).default("24h").optional(),
  usdThreshold: z.coerce.number().min(0).default(0).optional(),
  sortBy: z.enum(["volume", "time"]).default("volume").optional(),
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

export async function getApiResult<T extends z.ZodType>(
  schema: T,
  resp: Response,
) {
  try {
    const rawRes = await resp.json();
    const parseRes = schema.safeParse(rawRes);
    if (!parseRes.success) {
      console.log("Unexpected Response:");
      console.log("Zod Errors:", parseRes.error);
      console.log("Actual reponse:", rawRes);
      return;
    }
    return parseRes.data;
  } catch (err) {
    console.log(err);
    return undefined;
  }
}
