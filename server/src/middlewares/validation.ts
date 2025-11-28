import z from "zod";
import { validator } from "hono/validator";
import type { ValidationTargets } from "hono";

export const paginationSchema = z.object({
  limit: z.number(),
  offset: z.number(),
});

export const addressSchema = z.object({
  address: z
    .string()
    .trim()
    .min(32)
    .max(44)
    .regex(/^[1-9A-HJ-NP-Za-km-z]$/),
});

export const addressListSchema = z.object({
  addresses: z
    .string()
    .transform((v) => v.split(","))
    .pipe(
      z
        .string()
        .trim()
        .min(32)
        .max(42)
        .regex(/^[1-9A-HJ-NP-Za-km-z]$/)
        .array(),
    ),
});

export const tokenIdSchema = z.object({
  id: z.string().trim().min(1),
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
          error: "ValidationError",
          message: `Invalid ${target} parameters`,
          details: parsed.error.issues,
        },
        400,
      );
    }
    return parsed.data;
  });
}
