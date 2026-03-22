import * as birdeye from "@sv/util/util-birdeye.js";
import { ProviderRequestError, requestProviderJson } from "./providerRequest.js";

type SearchParamValue = string | number | boolean | null | undefined;

const BIRDEYE_MAX_ATTEMPTS = 4;
const BIRDEYE_BASE_DELAY_MS = 300;
const BIRDEYE_MAX_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDelayMsFromRetryAfter(value: unknown): number | null {
    if (typeof value !== "string" || value.trim().length === 0) {
        return null;
    }

    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
        return Math.floor(asNumber * 1000);
    }

    const asDateMs = Date.parse(value);
    if (!Number.isNaN(asDateMs)) {
        const delta = asDateMs - Date.now();
        return delta > 0 ? delta : 0;
    }

    return null;
}

function getRetryAfterMs(error: unknown): number | null {
    const payload =
        error instanceof ProviderRequestError && typeof error.payload === "string"
            ? error.payload
            : null;

    if (!payload) {
        return null;
    }

    const retryAfterMatch = payload.match(/retry-after\s*[:=]\s*([\w\-:, ]+)/i);
    if (!retryAfterMatch) {
        return null;
    }

    return toDelayMsFromRetryAfter(retryAfterMatch[1]?.trim());
}

function isRetriableBirdeyeError(error: unknown): boolean {
    if (!(error instanceof ProviderRequestError)) {
        return true;
    }

    return (
        error.provider === "birdeye" &&
        [408, 425, 429, 500, 502, 503, 504].includes(error.status)
    );
}

function getBackoffDelayMs(attempt: number, error: unknown): number {
    const retryAfter = getRetryAfterMs(error);
    if (retryAfter != null) {
        return Math.min(Math.max(retryAfter, BIRDEYE_BASE_DELAY_MS), BIRDEYE_MAX_DELAY_MS);
    }

    const exp = Math.min(BIRDEYE_BASE_DELAY_MS * (2 ** (attempt - 1)), BIRDEYE_MAX_DELAY_MS);
    const jitter = Math.floor(Math.random() * 200);
    return exp + jitter;
}

async function birdeyeRequestJsonWithRetry<T>(input: {
    url: URL;
    method: "GET" | "POST";
    headers: HeadersInit;
    body?: unknown;
}): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= BIRDEYE_MAX_ATTEMPTS; attempt += 1) {
        try {
            return await requestProviderJson<T>({
                provider: "birdeye",
                url: input.url,
                method: input.method,
                headers: input.headers,
                body: input.body,
            });
        } catch (error) {
            lastError = error;

            const retriable = isRetriableBirdeyeError(error);
            const isLastAttempt = attempt >= BIRDEYE_MAX_ATTEMPTS;

            if (!retriable || isLastAttempt) {
                throw error;
            }

            const delayMs = getBackoffDelayMs(attempt, error);
            await sleep(delayMs);
        }
    }

    throw lastError ?? new Error("Birdeye request failed without error details");
}

function applySearchParams(
    url: URL,
    searchParams?: Record<string, SearchParamValue>,
): void {
    if (!searchParams) {
        return;
    }

    for (const [key, value] of Object.entries(searchParams)) {
        if (value == null) {
            continue;
        }

        url.searchParams.set(key, String(value));
    }
}

export async function birdeyeGetJson<T>(
    path: string,
    searchParams?: Record<string, SearchParamValue>,
): Promise<T> {
    const url = birdeye.getEndpoint(path);
    applySearchParams(url, searchParams);

    return birdeyeRequestJsonWithRetry<T>({
        url,
        method: "GET",
        headers: birdeye.getRequiredHeaders(),
    });
}

export async function birdeyePostJson<T>(
    path: string,
    body?: unknown,
): Promise<T> {
    const url = birdeye.getEndpoint(path);

    return birdeyeRequestJsonWithRetry<T>({
        url,
        method: "POST",
        headers: birdeye.getRequiredHeaders(),
        body,
    });
}
