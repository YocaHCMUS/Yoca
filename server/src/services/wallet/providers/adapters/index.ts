import { WALLET_USE_ACMS } from "@sv/config/constants.js";
import { ApiManagerService } from "@sv/services/api-manager/api-manager.service.js";

const apiManager = new ApiManagerService();

type Provider = "birdeye" | "helius";

export async function callViaAcms<T>(
  provider: Provider,
  endpoint: string | URL,
  params: any,
  fetcher: () => Promise<T>,
  opts?: { requestSchema?: any; responseSchema?: any },
): Promise<T> {
  const endpointStr =
    typeof endpoint === "string" ? endpoint : endpoint.toString();

  if (WALLET_USE_ACMS) {
    return apiManager.call(provider, endpointStr, params, fetcher, opts);
  }

  return fetcher();
}
