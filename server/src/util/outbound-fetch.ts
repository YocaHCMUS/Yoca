import { OUTBOUND_FETCH_TIMEOUT_MS } from "@sv/config/constants.js";

function combineWithTimeout(
  existing: AbortSignal | null | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!existing) {
    return timeoutSignal;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([existing, timeoutSignal]);
  }
  const controller = new AbortController();
  const forward = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  if (existing.aborted || timeoutSignal.aborted) {
    forward();
    return controller.signal;
  }
  existing.addEventListener("abort", forward, { once: true });
  timeoutSignal.addEventListener("abort", forward, { once: true });
  return controller.signal;
}

/** Merges `AbortSignal.timeout` with any caller `signal` so requests fail fast instead of hanging. */
export function mergeOutboundFetchTimeout(init: RequestInit | undefined): RequestInit {
  const base = init ?? {};
  return {
    ...base,
    signal: combineWithTimeout(base.signal, OUTBOUND_FETCH_TIMEOUT_MS),
  };
}
