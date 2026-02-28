const DEFAULT_BIRDEYE_BASE_URL = "https://public-api.birdeye.so";

// Simple in-process rate limiter: at most one Birdeye request per 60 seconds.
const BIRDEYE_MIN_INTERVAL_MS = 60_000;
let lastBirdeyeRequestAt = 0;
let rateLimitPromise: Promise<void> | null = null;

async function waitForRateLimitWindow(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastBirdeyeRequestAt;
  const remaining = BIRDEYE_MIN_INTERVAL_MS - elapsed;

  if (remaining <= 0) {
    // No need to wait.
    lastBirdeyeRequestAt = Date.now();
    return;
  }

  // Chain waits so concurrent callers queue behind the same timer.
  if (!rateLimitPromise) {
    rateLimitPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        lastBirdeyeRequestAt = Date.now();
        rateLimitPromise = null;
        resolve();
      }, remaining);
    });
  }

  await rateLimitPromise;
}

export function getEndpoint(path: string): URL {
  const base =
    process.env.BIRDEYE_API_BASE_URL && process.env.BIRDEYE_API_BASE_URL.length > 0
      ? process.env.BIRDEYE_API_BASE_URL
      : DEFAULT_BIRDEYE_BASE_URL;

  return new URL(`${base}${path}`);
}

export function getRequiredHeaders(chain?: string): HeadersInit {
  if (!process.env.BIRDEYE_API_KEY) {
    throw new Error("BIRDEYE_API_KEY is not set");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": process.env.BIRDEYE_API_KEY,
  };

  if (chain) {
    headers["x-chain"] = chain;
  }

  return headers;
}

/**
 * Rate-limited wrapper around fetch for Birdeye calls.
 * Ensures we stay within the free-tier limit (1 request per minute).
 */
export async function birdeyeFetch(
  url: URL,
  init: RequestInit,
): Promise<Response> {
  await waitForRateLimitWindow();
  return fetch(url, init);
}

