// rate-limited-fetch.ts

import Bottleneck from "bottleneck";

type FetchRetryOptions = {
  rlRetries?: number;
  rlRetryDelayMs?: number;
  rlTimeoutMs?: number;
};

export type RateLimitedFetchOptions = RequestInit &
  FetchRetryOptions & {
    rlLimiter: Bottleneck;
  };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function computeBackoff(attempt: number, baseDelay: number) {
  // exponential backoff + jitter
  return baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
}

export async function rlFetch(
  url: URL,
  options: RateLimitedFetchOptions,
): Promise<Response> {
  const {
    rlLimiter,
    rlRetries = 3,
    rlRetryDelayMs = 500,
    rlTimeoutMs = 30_000,
    ...fetchInit
  } = options;

  return rlLimiter.schedule(async () => {
    let lastErr: unknown;

    for (let attempt = 0; attempt <= rlRetries; attempt++) {
      try {
        const resp = await fetchWithTimeout(url, fetchInit, rlTimeoutMs);

        if (resp.status == 429) {
          if (attempt == rlRetries) {
            return resp;
          }

          const waitMs = computeBackoff(attempt, rlRetryDelayMs);

          console.warn(`Rate Limit Fetch: 429 retry in ${waitMs}ms`);

          await sleep(waitMs);
          continue;
        }

        if (resp.status >= 500 && resp.status <= 599) {
          if (attempt == rlRetries) {
            return resp;
          }

          const waitMs = computeBackoff(attempt, rlRetryDelayMs);

          console.warn(`Rate Limit Fetch: ${resp.status} retry in ${waitMs}ms`);

          await sleep(waitMs);
          continue;
        }

        return resp;
      } catch (e) {
        lastErr = e;

        if (attempt == rlRetries) {
          break;
        }

        const waitMs = computeBackoff(attempt, rlRetryDelayMs);

        console.warn(`Rate Limit Fetch: network error retry in ${waitMs}ms`, e);

        await sleep(waitMs);
      }
    }

    console.error("Rate Limit Fetch: failed after retries", lastErr);

    throw lastErr;
  });
}
