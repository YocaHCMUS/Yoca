import { callViaAcms } from "./index.js";

export async function callHelius<T>(
  endpoint: string | URL,
  params: any,
  fetcher: () => Promise<T>,
  opts?: { requestSchema?: any; responseSchema?: any },
): Promise<T> {
  return callViaAcms("helius", endpoint, params, fetcher, opts);
}
