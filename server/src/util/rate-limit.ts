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
    const requestStartedAtMs = Date.now();
    const requestUrl = url.toString();
    const requestMethod = fetchInit.method ?? "GET";

    for (let attempt = 0; attempt <= rlRetries; attempt++) {
      const attemptStartedAtMs = Date.now();

      try {
        const resp = await fetchWithTimeout(url, fetchInit, rlTimeoutMs);

        if (resp.status == 429 || (resp.status >= 500 && resp.status <= 599)) {
          const retryAfter = resp.headers.get("Retry-After");

          if (attempt == rlRetries) {
            console.error(
              "Outbound request returned retryable status after retries",
              {
                url: requestUrl,
                method: requestMethod,
                status: resp.status,
                attempt: attempt + 1,
                retriesRemaining: 0,
                retryAfter,
                attemptDurationMs: Date.now() - attemptStartedAtMs,
                totalDurationMs: Date.now() - requestStartedAtMs,
              },
            );
            return resp;
          }

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
                  url: requestUrl,
                  method: requestMethod,
                  status: resp.status,
                  retryAfter: normalizedRetryAfter,
                });
              }
            }
          }

          console.warn("Outbound request retry", {
            url: requestUrl,
            method: requestMethod,
            status: resp.status,
            attempt: attempt + 1,
            retriesRemaining: rlRetries - attempt,
            retryAfter,
            retryInMs: waitMs,
            delaySource,
            attemptDurationMs: Date.now() - attemptStartedAtMs,
            totalDurationMs: Date.now() - requestStartedAtMs,
          });

          await sleep(waitMs);
          continue;
        }

        console.info("Outbound request completed", {
          url: requestUrl,
          method: requestMethod,
          status: resp.status,
          attempt: attempt + 1,
          attemptDurationMs: Date.now() - attemptStartedAtMs,
          totalDurationMs: Date.now() - requestStartedAtMs,
        });
        return resp;
      } catch (e) {
        lastErr = e;

        if (attempt == rlRetries) {
          break;
        }

        const waitMs = computeBackoff(attempt, rlRetryDelayMs);

        console.warn("Outbound request network-error retry", {
          url: requestUrl,
          method: requestMethod,
          status: null,
          attempt: attempt + 1,
          retriesRemaining: rlRetries - attempt,
          retryInMs: waitMs,
          errorName: e instanceof Error ? e.name : "UnknownError",
          errorMessage: e instanceof Error ? e.message : String(e),
          error: e,
          attemptDurationMs: Date.now() - attemptStartedAtMs,
          totalDurationMs: Date.now() - requestStartedAtMs,
        });

        await sleep(waitMs);
      }
    }

    console.error("Outbound request failed after retries", {
      url: requestUrl,
      method: requestMethod,
      status: null,
      attempts: rlRetries + 1,
      errorName: lastErr instanceof Error ? lastErr.name : "UnknownError",
      errorMessage:
        lastErr instanceof Error ? lastErr.message : String(lastErr),
      error: lastErr,
      totalDurationMs: Date.now() - requestStartedAtMs,
    });

    throw lastErr;
  });
}
