import Coingecko from "@coingecko/coingecko-typescript";

export function getEndpoint(path: string): URL {
  return new URL(`${process.env.COINGECKO_API_BASE_URL}${path}`);
}

export function getOnchainEndpoint(path: string): URL {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(`${process.env.COINGECKO_API_BASE_URL}/onchain/${normalizedPath}`);
}

export function getRequiredHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-cg-demo-api-key": process.env.COINGECKO_API_KEY!,
  };

  return headers;
}

export const client = new Coingecko({
  demoAPIKey: process.env.COINGECKO_API_KEY,
  environment: "demo",
});
