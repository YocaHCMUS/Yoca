// Utility for CoinGecko API calls

export function getEndpoint(path: string): URL {
  return new URL(path, process.env.COINGECKO_API_BASE_URL);
}

export function getRequiredHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-cg-pro-api-key": process.env.COINGECKO_API_KEY!,
  };

  return headers;
}
