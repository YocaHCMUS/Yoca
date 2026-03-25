import {
    getEndpoint,
    getRequiredHeaders,
    heliusFetch,
} from "@sv/util/util-helius.js";
import { requestProviderJson } from "./providerRequest.js";
import { callHelius } from "@sv/services/wallet/providers/adapters/helius.adapter.js";

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

export async function heliusGetJson<T>(
    path: string,
    searchParams?: Record<string, SearchParamValue>,
): Promise<T> {
    const url = getEndpoint(path);
    applySearchParams(url, searchParams);

    const fetcher = async () => {
        return requestProviderJson<T>({
            provider: "helius",
            url,
            method: "GET",
            headers: getRequiredHeaders(),
            fetchImpl: heliusFetch,
        });
    };

    return callHelius(path, searchParams ?? {}, fetcher);
}
