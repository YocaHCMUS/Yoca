import { z } from "zod";

export const solanaBase58Schema = z
  .string()
  .trim()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/);

export const emptyStringAsUndefinedSchema = z
  .string()
  .trim()
  .max(0)
  .transform(() => undefined);
