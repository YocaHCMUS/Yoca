import { callViaAcms } from "./index.js";
import type { ZodSchema } from "zod";

export async function callBirdeye<T>(
  endpoint: string | URL,
  params: unknown,
  fetcher: () => Promise<T>,
  opts?: { requestSchema?: ZodSchema<unknown>; responseSchema?: ZodSchema<T> },
): Promise<T> {
  return callViaAcms("birdeye", endpoint, params, fetcher, opts);
}
