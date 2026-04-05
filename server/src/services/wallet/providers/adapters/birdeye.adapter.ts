import { callViaAcms } from "./index.js";

export async function callBirdeye<T>(
  endpoint: string | URL,
  params: any,
  fetcher: () => Promise<T>,
  opts?: { requestSchema?: any; responseSchema?: any },
): Promise<T> {
  return callViaAcms("birdeye", endpoint, params, fetcher, opts);
}
