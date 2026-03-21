export function getEndpoint(path: string): URL {
  if (!process.env.BIRDEYE_API_BASE_URL) {
    throw new Error("Birdey API base url was not set");
  }
  return new URL(`${process.env.BIRDEYE_API_BASE_URL}${path}`);
}

export function getRequiredHeaders() {
  if (!process.env.BIRDEYE_API_KEY) {
    throw new Error("Birdey API key was not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": process.env.BIRDEYE_API_KEY,
    "x-chain": "solana",
  };

  return headers;
}
