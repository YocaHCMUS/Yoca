import Coingecko from "@coingecko/coingecko-typescript";

// Currently there is a bug with the sdk that makes all the returned fields optional:
// github.com/coingecko/coingecko-typescript/issues/31
// So we'd need to be using "!" alot

export const client = new Coingecko({
  demoAPIKey: process.env.COINGECKO_API_KEY!,
  environment: "demo",
});

export function getEndpoint(path: string): URL {
  return new URL(`${process.env.COINGECKO_API_BASE_URL}${path}`);
}

export function getRequiredHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-cg-demo-api-key": process.env.COINGECKO_API_KEY!,
  };

  return headers;
}
