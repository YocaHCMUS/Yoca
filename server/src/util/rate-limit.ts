// rate-limited-fetch.ts

import Bottleneck from "bottleneck";

type FetchRetryOptions = {
  rlRetries?: number;
  rlRetryDelayMs?: number;
  rlTimeoutMs?: number;
  rlLogContext?: {
    provider: string;
    endpointPath: string;
  };
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
    rlLogContext,
    ...fetchInit
  } = options;

  return rlLimiter.schedule(async () => {
    let lastErr: unknown;

    for (let attempt = 0; attempt <= rlRetries; attempt++) {
      try {
        const resp = await fetchWithTimeout(url, fetchInit, rlTimeoutMs);

        if (resp.status == 429 || (resp.status >= 500 && resp.status <= 599)) {
          if (attempt == rlRetries) {
            return resp;
          }

          const retryAfter = resp.headers.get("Retry-After");
          let waitMs = computeBackoff(attempt, rlRetryDelayMs);
          let delaySource = "exponential backoff";

          if (retryAfter !== null) {
            const normalizedRetryAfter = retryAfter.trim();
            const retryAfterSeconds = Number(normalizedRetryAfter);

            if (/^\d+$/.test(normalizedRetryAfter)) {
              waitMs = retryAfterSeconds * 1_000;
              delaySource = "Retry-After seconds";
            } else {
              const retryAfterDate = Date.parse(normalizedRetryAfter);

              if (!Number.isNaN(retryAfterDate)) {
                waitMs = Math.max(0, retryAfterDate - Date.now());
                delaySource = "Retry-After date";
              } else {
                console.warn("Outbound request received invalid Retry-After", {
                  provider: rlLogContext?.provider,
                  endpointPath: rlLogContext?.endpointPath,
                  upstreamStatus: resp.status,
                  retryAfter: normalizedRetryAfter,
                });
              }
            }
          }

          console.warn("Outbound request retry", {
            provider: rlLogContext?.provider,
            endpointPath: rlLogContext?.endpointPath,
            upstreamStatus: resp.status,
            attempt: attempt + 1,
            retryInMs: waitMs,
            delaySource,
          });

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

        console.warn("Outbound request network-error retry", {
          provider: rlLogContext?.provider,
          endpointPath: rlLogContext?.endpointPath,
          attempt: attempt + 1,
          retryInMs: waitMs,
          errorName: e instanceof Error ? e.name : "UnknownError",
        });

        await sleep(waitMs);
      }
    }

    console.error("Outbound request failed after retries", {
      provider: rlLogContext?.provider,
      endpointPath: rlLogContext?.endpointPath,
      errorName: lastErr instanceof Error ? lastErr.name : "UnknownError",
    });

    throw lastErr;
  });
}
