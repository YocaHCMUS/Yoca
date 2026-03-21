import { apiKeyManager } from "./api-key-manager.js";
const BIRDEYE_SERVICE_NAME = "birdeye";
let birdeyeKeysInitialized = false;

export function getEndpoint(path: string): URL {
  if (!process.env.BDS_API_BASE_URL) {
    throw new Error("Birdey API base url was not set");
  }
  return new URL(`${process.env.BDS_API_BASE_URL}${path}`);
}


export function getRequiredHeaders(): HeadersInit {
  if (!birdeyeKeysInitialized) {
    apiKeyManager.initializeKeys(BIRDEYE_SERVICE_NAME, process.env.BIRDEYE_API_KEY);
    birdeyeKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(BIRDEYE_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("BIRDEYE_API_KEY is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": apiKey,
    "x-chain": "solana",
  };

  return headers;
}
