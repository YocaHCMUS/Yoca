import Bottleneck from "bottleneck";
import env from "./load-env";

export const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2500,
});

export function getEndpoint(path: string): URL {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(`${env.COINMARKETCAP_API_BASE_URL}/${normalizedPath}`);
}

export function getRequiredHeaders(): Record<string, string> {
  const apiKey = env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    throw new Error("COINMARKETCAP_API_KEY is not set");
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(env.COINMARKETCAP_API_KEY
      ? { "X-CMC_PRO_API_KEY": env.COINMARKETCAP_API_KEY }
      : {}),
  };
}
