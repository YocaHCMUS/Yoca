import * as birdeye from "@sv/util/util-birdeye.js";
import { requestProviderJson } from "./providerRequest.js";

type SearchParamValue = string | number | boolean | null | undefined;

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

    return requestProviderJson<T>({
        provider: "birdeye",
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

    return requestProviderJson<T>({
        provider: "birdeye",
        url,
        method: "POST",
        headers: birdeye.getRequiredHeaders(),
        body,
    });
}
