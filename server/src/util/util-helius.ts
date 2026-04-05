const DEFAULT_HELIUS_API_BASE_URL = "https://api.helius.xyz";
import { createHelius } from "helius-sdk";
import { trackApiCallResponse } from "@sv/services/tracking/apiCallTracker.service.js";
import { mergeOutboundFetchTimeout } from "@sv/util/outbound-fetch.js";
import type { ApiKeyMetadata } from "@sv/services/tracking/apiCallTracker.types.js";
import { apiKeyManager, buildApiKeyMetadata } from "./api-key-manager.js";

const HELIUS_SERVICE_NAME = "helius";
let heliusKeysInitialized = false;

const DEFAULT_429_WAIT_MS = 65_000; // ~1 min for Helius rate limit reset
const MAX_429_RETRIES = 2;

/**
 * Fetch with retry on 429. No pre-emptive rate limiting – fast by default.
 * When 429 occurs, waits (Retry-After or 65s) and retries up to MAX_429_RETRIES times.
 */
export async function heliusFetch(
  url: URL,
  init: RequestInit,
): Promise<Response> {
  const keyMeta = getApiKeyMetadataFromHeaders(init.headers);
  let lastResponse: Response | null = null;
  let attempts = 0;

  while (attempts <= MAX_429_RETRIES) {
    const fetchInit = mergeOutboundFetchTimeout(init);
    const resp = await trackApiCallResponse(
      {
        provider: "helius",
        url: url.toString(),
        method: fetchInit.method ?? "GET",
        requestHeaders: fetchInit.headers,
        requestBody: fetchInit.body,
        apiKey: keyMeta,
        serviceFile: "server/src/util/util-helius.ts",
        functionName: "heliusFetch",
      },
      () => fetch(url, fetchInit),
    );
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
      console.warn(
        `[Helius] 429 Too Many Requests – waiting ${Math.round(waitMs / 1000)}s before retry (${attempts}/${MAX_429_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  return lastResponse!;
}

export function getEndpoint(path: string): URL {
  const base =
    process.env.HELIUS_API_BASE_URL &&
      process.env.HELIUS_API_BASE_URL.length > 0
      ? process.env.HELIUS_API_BASE_URL
      : DEFAULT_HELIUS_API_BASE_URL;

  return new URL(`${base}${path}`);
}

export function getRequiredHeaders() {
  if (!heliusKeysInitialized) {
    apiKeyManager.initializeKeys(
      HELIUS_SERVICE_NAME,
      process.env.HELIUS_API_KEY,
    );
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

export function getRequiredHeadersWithMetadata(): {
  headers: Record<string, string>;
  apiKey: ApiKeyMetadata | null;
} {
  if (!heliusKeysInitialized) {
    apiKeyManager.initializeKeys(
      HELIUS_SERVICE_NAME,
      process.env.HELIUS_API_KEY,
    );
    heliusKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(HELIUS_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is not set");
  }

  return {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    apiKey: buildApiKeyMetadata(apiKey, "HELIUS_API_KEY"),
  };
}

function getApiKeyMetadataFromHeaders(headers: RequestInit["headers"] | undefined): ApiKeyMetadata | null {
  if (!headers) {
    return null;
  }

  const apiKey = new Headers(headers).get("X-API-Key");
  return buildApiKeyMetadata(apiKey, "HELIUS_API_KEY");
}

const client = createHelius({
  apiKey: process.env.HELIUS_API_KEY!,
});

export { client };
