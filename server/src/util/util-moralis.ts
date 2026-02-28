const DEFAULT_MORALIS_BASE_URL = "https://deep-index.moralis.io/api/v2.2";

export function getEndpoint(path: string): URL {
  const base =
    process.env.MORALIS_API_BASE_URL && process.env.MORALIS_API_BASE_URL.length > 0
      ? process.env.MORALIS_API_BASE_URL
      : DEFAULT_MORALIS_BASE_URL;

  return new URL(`${base}${path}`);
}

export function getRequiredHeaders(): HeadersInit {
  if (!process.env.MORALIS_API_KEY) {
    throw new Error("MORALIS_API_KEY is not set");
  }

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": process.env.MORALIS_API_KEY,
  };
}

