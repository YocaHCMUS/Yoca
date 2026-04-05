export type ProviderName = "helius" | "birdeye" | "moralis" | "unknown";

import { trackApiCallResponse } from "@sv/services/tracking/apiCallTracker.service.js";
import type { ApiKeyMetadata } from "@sv/services/tracking/apiCallTracker.types.js";
import { mergeOutboundFetchTimeout } from "@sv/util/outbound-fetch.js";

export class ProviderRequestError extends Error {
    readonly provider: ProviderName;
    readonly status: number;
    readonly statusText: string;
    readonly url: string;
    readonly method: string;
    readonly payload?: unknown;

    constructor(input: {
        provider: ProviderName;
        status: number;
        statusText: string;
        url: string;
        method: string;
        payload?: unknown;
        message?: string;
    }) {
        super(
            input.message ??
            `${input.provider} request failed: ${input.status} ${input.statusText}`,
        );
        this.name = "ProviderRequestError";
        this.provider = input.provider;
        this.status = input.status;
        this.statusText = input.statusText;
        this.url = input.url;
        this.method = input.method;
        this.payload = input.payload;
    }
}

export async function requestProviderJson<T>(input: {
    provider: ProviderName;
    url: URL;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers: Record<string, string>;
    body?: unknown;
    apiKey?: ApiKeyMetadata | null;
    serviceFile?: string;
    functionName?: string;
    fetchImpl?: (url: URL, init: RequestInit) => Promise<Response>;
}): Promise<T> {
    const fetchImpl = input.fetchImpl ?? (async (url, init) => fetch(url.toString(), init));
    const requestInit = mergeOutboundFetchTimeout({
        method: input.method,
        headers: input.headers,
        body: input.body == null ? undefined : JSON.stringify(input.body),
    });

    const response = await trackApiCallResponse(
        {
            provider: input.provider,
            url: input.url.toString(),
            method: input.method,
            requestHeaders: input.headers,
            requestBody: requestInit.body,
            apiKey: input.apiKey,
            serviceFile: input.serviceFile ?? "server/src/services/wallet/providers/providerRequest.ts",
            functionName: input.functionName ?? "requestProviderJson",
        },
        () => fetchImpl(input.url, requestInit),
    );

    if (!response.ok) {
        let payload: unknown;
        try {
            payload = await response.text();
        } catch {
            payload = undefined;
        }

        throw new ProviderRequestError({
            provider: input.provider,
            status: response.status,
            statusText: response.statusText,
            url: input.url.toString(),
            method: input.method,
            payload,
        });
    }

    return (await response.json()) as T;
}
