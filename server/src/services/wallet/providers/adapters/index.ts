import { WALLET_USE_ACMS } from "@sv/config/constants.js";
import { ApiManagerService } from "@sv/services/api-manager/api-manager.service.js";
import type { ZodSchema } from "zod";

const apiManager = new ApiManagerService();

type Provider = "birdeye" | "helius" | "n8n";

export async function callViaAcms<T>(
  provider: Provider,
  endpoint: string | URL,
  params: unknown,
  fetcher: () => Promise<T>,
  opts?: { requestSchema?: ZodSchema<unknown>; responseSchema?: ZodSchema<T>; useAcms?: boolean },
): Promise<T> {
  const endpointStr =
    typeof endpoint === "string" ? endpoint : endpoint.toString();
  const shouldUseAcms = opts?.useAcms ?? WALLET_USE_ACMS;

  if (shouldUseAcms) {
    return apiManager.call(provider, endpointStr, params, fetcher, opts);
  }

  return fetcher();
}
