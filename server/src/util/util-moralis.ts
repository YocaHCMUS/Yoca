import { trackApiCallResponse } from "@sv/services/tracking/apiCallTracker.service.js";
import type { ApiKeyMetadata } from "@sv/services/tracking/apiCallTracker.types.js";
import { apiKeyManager, buildApiKeyMetadata } from "./api-key-manager.js";

const DEFAULT_MORALIS_SOLANA_GATEWAY_BASE_URL =
  "https://solana-gateway.moralis.io";

const MORALIS_SERVICE_NAME = "moralis";
let moralisKeysInitialized = false;

const DEFAULT_429_WAIT_MS = 65_000; // ~1 min for Moralis rate limit reset
const MAX_429_RETRIES = 2;
const MAX_RETRY_WAIT_MS = 120_000;

function parseRetryAfterMs(retryAfterHeader: string | null): number {
  if (retryAfterHeader != null && /^\d+$/.test(retryAfterHeader)) {
    return Math.min(parseInt(retryAfterHeader, 10) * 1000, MAX_RETRY_WAIT_MS);
  }

  return DEFAULT_429_WAIT_MS;
}

function buildEndpoint(base: string, path: string): URL {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${normalizedBase}${normalizedPath}`);
}

function resolveBaseUrl(): string {
  if (
    process.env.MORALIS_SOLANA_GATEWAY_BASE_URL &&
    process.env.MORALIS_SOLANA_GATEWAY_BASE_URL.length > 0
  ) {
    return process.env.MORALIS_SOLANA_GATEWAY_BASE_URL;
  }

  return DEFAULT_MORALIS_SOLANA_GATEWAY_BASE_URL;
}

export async function moralisFetch(
  url: URL,
  init: RequestInit,
): Promise<Response> {
  const keyMeta = getApiKeyMetadataFromHeaders(init.headers);
  let lastResponse: Response | null = null;
  let attempts = 0;

  while (attempts <= MAX_429_RETRIES) {
    const resp = await trackApiCallResponse(
      {
        provider: "moralis",
        url: url.toString(),
        method: init.method ?? "GET",
        requestHeaders: init.headers,
        requestBody: init.body,
        apiKey: keyMeta,
        serviceFile: "server/src/util/util-moralis.ts",
        functionName: "moralisFetch",
      },
      () => fetch(url, init),
    );
    lastResponse = resp;
    if (resp.status !== 429) {
      return resp;
    }
    attempts++;
    const retryAfterHeader = resp.headers.get("Retry-After");
    const waitMs = parseRetryAfterMs(retryAfterHeader);

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw new Error("Failed to fetch from Moralis after retries");
}

export function getEndpoint(path: string): URL {
  return buildEndpoint(resolveBaseUrl(), path);
}

export function getRequiredHeaders() {
  if (!moralisKeysInitialized) {
    apiKeyManager.initializeKeys(
      MORALIS_SERVICE_NAME,
      process.env.MORALIS_API_KEY,
    );
    moralisKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(MORALIS_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("MORALIS_API_KEY is not set");
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
  if (!moralisKeysInitialized) {
    apiKeyManager.initializeKeys(
      MORALIS_SERVICE_NAME,
      process.env.MORALIS_API_KEY,
    );
    moralisKeysInitialized = true;
  }

  const apiKey = apiKeyManager.getNextKey(MORALIS_SERVICE_NAME);
  if (!apiKey) {
    throw new Error("MORALIS_API_KEY is not set");
  }

  return {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    apiKey: buildApiKeyMetadata(apiKey, "MORALIS_API_KEY"),
  };
}

function getApiKeyMetadataFromHeaders(headers: RequestInit["headers"] | undefined): ApiKeyMetadata | null {
  if (!headers) {
    return null;
  }

  const apiKey = new Headers(headers).get("X-API-Key");
  return buildApiKeyMetadata(apiKey, "MORALIS_API_KEY");
}
