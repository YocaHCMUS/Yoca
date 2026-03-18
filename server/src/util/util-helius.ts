const DEFAULT_HELIUS_API_BASE_URL = "https://api.helius.xyz";
import type { SupportedChain } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { apiKeyManager } from "./api-key-manager.js";

const HELIUS_SERVICE_NAME = "helius";
let heliusKeysInitialized = false;

const DEFAULT_429_WAIT_MS = 65_000; // ~1 min for Helius rate limit reset
const MAX_429_RETRIES = 2;

/**
 * Fetch with retry on 429. No pre-emptive rate limiting – fast by default.
 * When 429 occurs, waits (Retry-After or 65s) and retries up to MAX_429_RETRIES times.
 */
export async function heliusFetch(url: URL, init: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null;
  let attempts = 0;

  while (attempts <= MAX_429_RETRIES) {
    const resp = await fetch(url, init);
    lastResponse = resp;

    if (resp.status !== 429) {
      return resp;
    }

    attempts++;
    const retryAfterHeader = resp.headers.get("Retry-After");
    const waitMs =
      retryAfterHeader != null && /^\d+$/.test(retryAfterHeader)
        ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 120_000)
        : DEFAULT_429_WAIT_MS;

    if (attempts <= MAX_429_RETRIES) {
      console.warn(`[Helius] 429 Too Many Requests – waiting ${Math.round(waitMs / 1000)}s before retry (${attempts}/${MAX_429_RETRIES})`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  return lastResponse!;
}

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

export function resolveChainForAddress(
  _address: string,
  _requestedChain: SupportedChain,
): SupportedChain {
  return "solana";
}
