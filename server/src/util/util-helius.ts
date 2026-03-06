const DEFAULT_HELIUS_API_BASE_URL = "https://api.helius.xyz";
import { apiKeyManager } from "./api-key-manager.js";

const HELIUS_SERVICE_NAME = "helius";
let heliusKeysInitialized = false;

export function getEndpoint(path: string): URL {
  const base =
    process.env.HELIUS_API_BASE_URL && process.env.HELIUS_API_BASE_URL.length > 0
      ? process.env.HELIUS_API_BASE_URL
      : DEFAULT_HELIUS_API_BASE_URL;

  return new URL(`${base}${path}`);
}

export function getRequiredHeaders(): HeadersInit {
  if (!heliusKeysInitialized) {
    apiKeyManager.initializeKeys(HELIUS_SERVICE_NAME, process.env.HELIUS_API_KEY);
    heliusKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(HELIUS_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is not set");
  }

  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": apiKey,
  };
}
