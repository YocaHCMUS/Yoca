import type { SupportedChain } from "@sv/services/wallet/dtos/walletDataObjects.js";
import type {
    HeliusWalletIdentityBatchRaw,
    HeliusWalletIdentityRaw,
    WalletIdentityBatchResponse,
    WalletIdentityNormalized,
    WalletIdentityResponse,
} from "@sv/services/wallet/dtos/walletIdentityObjects.js";
import {
    getCachedWalletIdentity,
    getIdentityCacheTtlMs,
    saveWalletIdentityCache,
} from "@sv/services/wallet/db/walletIdentityCache.js";
import {
    getEndpoint,
    getRequiredHeaders,
    heliusFetch,
    resolveChainForAddress,
} from "@sv/util/util-helius.js";

export const WALLET_IDENTITY_MAX_BATCH_SIZE = 100;

const SOLANA_BASE58_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type WalletIdentityErrorCode =
    | "invalid_address"
    | "invalid_batch"
    | "unsupported_chain"
    | "provider_bad_request"
    | "provider_unauthorized"
    | "provider_rate_limited"
    | "provider_unavailable"
    | "provider_bad_payload"
    | "provider_unknown";

type WalletIdentityRawResult = {
    statusCode: number;
    data: HeliusWalletIdentityRaw | null;
};

type WalletIdentityBatchRawResult = {
    statusCode: number;
    data: HeliusWalletIdentityBatchRaw;
};

type WalletIdentityResponseOptions = {
    cacheHit?: boolean;
    cacheStale?: boolean;
    cacheTtlSec?: number;
    providerStatusCode?: number;
    providerErrorCode?: string;
};

export class WalletIdentityServiceError extends Error {
    readonly code: WalletIdentityErrorCode;
    readonly statusCode: number;
    readonly providerStatusCode?: number;

    constructor(
        message: string,
        code: WalletIdentityErrorCode,
        statusCode: number,
        providerStatusCode?: number,
    ) {
        super(message);
        this.name = "WalletIdentityServiceError";
        this.code = code;
        this.statusCode = statusCode;
        this.providerStatusCode = providerStatusCode;
    }
}

function mapProviderStatusToError(status: number): WalletIdentityServiceError {
    if (status === 400) {
        return new WalletIdentityServiceError(
            "Invalid wallet identity request",
            "provider_bad_request",
            400,
            status,
        );
    }

    if (status === 401) {
        return new WalletIdentityServiceError(
            "Wallet identity provider authorization failed",
            "provider_unauthorized",
            401,
            status,
        );
    }

    if (status === 429) {
        return new WalletIdentityServiceError(
            "Wallet identity provider rate limited the request",
            "provider_rate_limited",
            503,
            status,
        );
    }

    if (status >= 500) {
        return new WalletIdentityServiceError(
            "Wallet identity provider is currently unavailable",
            "provider_unavailable",
            503,
            status,
        );
    }

    return new WalletIdentityServiceError(
        "Unexpected wallet identity provider response",
        "provider_unknown",
        502,
        status,
    );
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value != null && !Array.isArray(value);
}

function normalizeAddress(address: string): string {
    return address.trim();
}

export function isValidSolanaAddress(address: string): boolean {
    return SOLANA_BASE58_ADDRESS_REGEX.test(address);
}

function assertValidIdentityAddress(address: string): string {
    const normalized = normalizeAddress(address);
    if (!normalized || !isValidSolanaAddress(normalized)) {
        throw new WalletIdentityServiceError(
            "Invalid Solana wallet address",
            "invalid_address",
            400,
        );
    }

    return normalized;
}

function assertSupportedIdentityChain(address: string, chain: SupportedChain): SupportedChain {
    const resolvedChain = resolveChainForAddress(address, chain);
    if (resolvedChain !== "solana") {
        throw new WalletIdentityServiceError(
            `Wallet identity is currently supported only for Solana (resolved chain: ${resolvedChain})`,
            "unsupported_chain",
            400,
        );
    }

    return resolvedChain;
}

function asStringOrNull(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const uniqueValues = new Set<string>();
    for (const entry of value) {
        if (typeof entry !== "string") {
            continue;
        }

        const trimmed = entry.trim();
        if (trimmed.length > 0) {
            uniqueValues.add(trimmed);
        }
    }

    return Array.from(uniqueValues);
}

function getRawIdentityType(raw: HeliusWalletIdentityRaw | null): string | null {
    return asStringOrNull(raw?.type);
}

export function normalizeWalletIdentity(
    raw: HeliusWalletIdentityRaw | null,
    options?: { statusOverride?: "known" | "unknown" | "unavailable" },
): WalletIdentityNormalized {
    const resolvedAt = new Date().toISOString();
    const rawType = getRawIdentityType(raw);

    const inferredStatus =
        raw == null
            ? "unknown"
            : rawType == null || rawType.toLowerCase() === "unknown"
                ? "unknown"
                : "known";

    const status = options?.statusOverride ?? inferredStatus;
    const type = status === "known" ? rawType : null;
    const name = status === "known" ? asStringOrNull(raw?.name) : null;
    const category = status === "known" ? asStringOrNull(raw?.category) : null;

    return {
        status,
        type,
        name,
        category,
        tags: status === "known" ? asStringArray(raw?.tags) : [],
        domainNames:
            status === "known"
                ? asStringArray(raw?.domainNames ?? raw?.domains)
                : [],
        provider: "helius",
        providerVersion: "wallet-api-beta",
        resolvedAt,
    };
}

export function buildUnavailableIdentity(): WalletIdentityNormalized {
    return normalizeWalletIdentity(null, { statusOverride: "unavailable" });
}

function buildWalletIdentityResponse(
    address: string,
    chain: SupportedChain,
    identity: WalletIdentityNormalized,
    options?: WalletIdentityResponseOptions,
): WalletIdentityResponse {
    const fallbackTtlSec = Math.floor(getIdentityCacheTtlMs(identity.status) / 1000);

    return {
        address,
        chain,
        identity,
        metadata: {
            cache: {
                hit: options?.cacheHit ?? false,
                stale: options?.cacheStale ?? false,
                ttlSec: options?.cacheTtlSec ?? fallbackTtlSec,
            },
            provider: {
                statusCode: options?.providerStatusCode,
                errorCode: options?.providerErrorCode,
            },
        },
    };
}

function normalizeBatchRequestAddresses(addresses: string[]): string[] {
    if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new WalletIdentityServiceError(
            "Identity batch request requires at least one address",
            "invalid_batch",
            400,
        );
    }

    const deduped = new Set<string>();
    const normalized: string[] = [];

    for (const address of addresses) {
        const validated = assertValidIdentityAddress(address);
        if (!deduped.has(validated)) {
            deduped.add(validated);
            normalized.push(validated);
        }
    }

    return normalized;
}

function chunkAddresses(addresses: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < addresses.length; i += chunkSize) {
        chunks.push(addresses.slice(i, i + chunkSize));
    }
    return chunks;
}

async function parseResponseJson(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function normalizeBatchPayload(
    payload: unknown,
    requestedChunk: string[],
): HeliusWalletIdentityBatchRaw {
    let rawItems: unknown[] = [];

    if (Array.isArray(payload)) {
        rawItems = payload;
    } else if (isObject(payload)) {
        if (Array.isArray(payload.data)) {
            rawItems = payload.data;
        } else if (Array.isArray(payload.identities)) {
            rawItems = payload.identities;
        }
    }

    if (!Array.isArray(rawItems)) {
        throw new WalletIdentityServiceError(
            "Wallet identity provider returned an invalid batch payload",
            "provider_bad_payload",
            502,
            200,
        );
    }

    return rawItems
        .map((item, index) => {
            if (!isObject(item)) {
                return null;
            }

            const address = asStringOrNull(item.address) ?? requestedChunk[index] ?? null;
            if (!address) {
                return null;
            }

            return {
                ...item,
                address,
            } as HeliusWalletIdentityRaw;
        })
        .filter((item): item is HeliusWalletIdentityRaw => item != null);
}

function ensureProviderOk(response: Response): void {
    if (response.ok) {
        return;
    }

    if (response.status === 404) {
        return;
    }

    throw mapProviderStatusToError(response.status);
}

export async function getWalletIdentityRaw(address: string): Promise<WalletIdentityRawResult> {
    const validatedAddress = assertValidIdentityAddress(address);
    const endpoint = getEndpoint(`/v1/wallet/${validatedAddress}/identity`);

    let response: Response;
    try {
        response = await heliusFetch(endpoint, {
            method: "GET",
            headers: getRequiredHeaders(),
        });
    } catch {
        throw new WalletIdentityServiceError(
            "Wallet identity provider request failed",
            "provider_unavailable",
            503,
        );
    }

    ensureProviderOk(response);

    if (response.status === 404) {
        return {
            statusCode: 404,
            data: null,
        };
    }

    const payload = await parseResponseJson(response);
    if (!isObject(payload)) {
        throw new WalletIdentityServiceError(
            "Wallet identity provider returned an invalid payload",
            "provider_bad_payload",
            502,
            response.status,
        );
    }

    return {
        statusCode: response.status,
        data: payload as HeliusWalletIdentityRaw,
    };
}

export async function getWalletIdentityBatchRaw(
    addresses: string[],
): Promise<WalletIdentityBatchRawResult> {
    const normalizedAddresses = normalizeBatchRequestAddresses(addresses);
    const chunks = chunkAddresses(normalizedAddresses, WALLET_IDENTITY_MAX_BATCH_SIZE);
    const merged: HeliusWalletIdentityBatchRaw = [];

    for (const chunk of chunks) {
        const endpoint = getEndpoint("/v1/wallet/batch-identity");

        let response: Response;
        try {
            response = await heliusFetch(endpoint, {
                method: "POST",
                headers: getRequiredHeaders(),
                body: JSON.stringify({ addresses: chunk }),
            });
        } catch {
            throw new WalletIdentityServiceError(
                "Wallet identity provider request failed",
                "provider_unavailable",
                503,
            );
        }

        ensureProviderOk(response);

        if (response.status === 404) {
            continue;
        }

        const payload = await parseResponseJson(response);
        const normalizedPayload = normalizeBatchPayload(payload, chunk);
        merged.push(...normalizedPayload);
    }

    return {
        statusCode: 200,
        data: merged,
    };
}

function buildRawBatchMap(
    rawItems: HeliusWalletIdentityBatchRaw,
): Map<string, HeliusWalletIdentityRaw> {
    const mapped = new Map<string, HeliusWalletIdentityRaw>();

    for (const item of rawItems) {
        const address = asStringOrNull(item.address);
        if (!address) {
            continue;
        }

        mapped.set(address, item);
    }

    return mapped;
}

export async function getWalletIdentity(
    address: string,
    chain: SupportedChain = "solana",
): Promise<WalletIdentityResponse> {
    const validatedAddress = assertValidIdentityAddress(address);
    const resolvedChain = assertSupportedIdentityChain(validatedAddress, chain);
    const cachedIdentity = await getCachedWalletIdentity(validatedAddress, resolvedChain);

    if (cachedIdentity?.isFresh) {
        return buildWalletIdentityResponse(
            validatedAddress,
            resolvedChain,
            cachedIdentity.identity,
            {
                cacheHit: true,
                cacheStale: false,
                cacheTtlSec: cachedIdentity.ttlSec,
            },
        );
    }

    try {
        const rawResult = await getWalletIdentityRaw(validatedAddress);

        if (rawResult.statusCode === 404 || rawResult.data == null) {
            const unknownIdentity = normalizeWalletIdentity(null);
            await saveWalletIdentityCache({
                address: validatedAddress,
                chain: resolvedChain,
                identity: unknownIdentity,
                raw: null,
            });

            return buildWalletIdentityResponse(
                validatedAddress,
                resolvedChain,
                unknownIdentity,
                {
                    cacheHit: false,
                    cacheStale: false,
                    providerStatusCode: 404,
                },
            );
        }

        const normalizedIdentity = normalizeWalletIdentity(rawResult.data);
        const rawPayload =
            rawResult.data != null && typeof rawResult.data === "object"
                ? (rawResult.data as Record<string, unknown>)
                : null;

        await saveWalletIdentityCache({
            address: validatedAddress,
            chain: resolvedChain,
            identity: normalizedIdentity,
            raw: rawPayload,
        });

        return buildWalletIdentityResponse(
            validatedAddress,
            resolvedChain,
            normalizedIdentity,
            {
                cacheHit: false,
                cacheStale: false,
                providerStatusCode: rawResult.statusCode,
            },
        );
    } catch (err) {
        if (cachedIdentity) {
            const providerError = err instanceof WalletIdentityServiceError ? err : null;
            return buildWalletIdentityResponse(
                validatedAddress,
                resolvedChain,
                cachedIdentity.identity,
                {
                    cacheHit: true,
                    cacheStale: true,
                    cacheTtlSec: cachedIdentity.ttlSec,
                    providerStatusCode: providerError?.providerStatusCode,
                    providerErrorCode: providerError?.code,
                },
            );
        }

        throw err;
    }
}

export async function getWalletIdentityBatch(
    addresses: string[],
    chain: SupportedChain = "solana",
): Promise<WalletIdentityBatchResponse> {
    const normalizedInputAddresses = Array.isArray(addresses)
        ? addresses.map((address) => assertValidIdentityAddress(address))
        : [];

    if (normalizedInputAddresses.length === 0) {
        throw new WalletIdentityServiceError(
            "Identity batch request requires at least one address",
            "invalid_batch",
            400,
        );
    }

    const resolvedChain = assertSupportedIdentityChain(normalizedInputAddresses[0], chain);

    const uniqueAddresses = normalizeBatchRequestAddresses(normalizedInputAddresses);
    const cacheEntries = await Promise.all(
        uniqueAddresses.map(async (address) => {
            const cached = await getCachedWalletIdentity(address, resolvedChain);
            return [address, cached] as const;
        }),
    );

    const cacheMap = new Map(cacheEntries);
    const resultByAddress = new Map<string, WalletIdentityResponse>();
    const addressesNeedingProviderFetch: string[] = [];

    for (const address of uniqueAddresses) {
        const cached = cacheMap.get(address) ?? null;

        if (cached?.isFresh) {
            resultByAddress.set(
                address,
                buildWalletIdentityResponse(address, resolvedChain, cached.identity, {
                    cacheHit: true,
                    cacheStale: false,
                    cacheTtlSec: cached.ttlSec,
                }),
            );
            continue;
        }

        addressesNeedingProviderFetch.push(address);
    }

    if (addressesNeedingProviderFetch.length > 0) {
        try {
            const batchRawResult = await getWalletIdentityBatchRaw(addressesNeedingProviderFetch);
            const rawMap = buildRawBatchMap(batchRawResult.data);

            for (const address of addressesNeedingProviderFetch) {
                const raw = rawMap.get(address) ?? null;
                const normalizedIdentity = normalizeWalletIdentity(raw);
                const rawPayload =
                    raw != null && typeof raw === "object"
                        ? (raw as Record<string, unknown>)
                        : null;

                await saveWalletIdentityCache({
                    address,
                    chain: resolvedChain,
                    identity: normalizedIdentity,
                    raw: rawPayload,
                });

                resultByAddress.set(
                    address,
                    buildWalletIdentityResponse(address, resolvedChain, normalizedIdentity, {
                        cacheHit: false,
                        cacheStale: false,
                        providerStatusCode: batchRawResult.statusCode,
                    }),
                );
            }
        } catch (err) {
            const providerError = err instanceof WalletIdentityServiceError ? err : null;

            for (const address of addressesNeedingProviderFetch) {
                const cached = cacheMap.get(address) ?? null;
                if (cached) {
                    resultByAddress.set(
                        address,
                        buildWalletIdentityResponse(address, resolvedChain, cached.identity, {
                            cacheHit: true,
                            cacheStale: true,
                            cacheTtlSec: cached.ttlSec,
                            providerStatusCode: providerError?.providerStatusCode,
                            providerErrorCode: providerError?.code,
                        }),
                    );
                    continue;
                }

                resultByAddress.set(
                    address,
                    buildWalletIdentityResponse(address, resolvedChain, buildUnavailableIdentity(), {
                        cacheHit: false,
                        cacheStale: false,
                        providerStatusCode: providerError?.providerStatusCode,
                        providerErrorCode: providerError?.code ?? "provider_unavailable",
                    }),
                );
            }
        }
    }

    const byAddress = new Map(resultByAddress.entries());

    return {
        chain: resolvedChain,
        results: normalizedInputAddresses.map(
            (address) => byAddress.get(address) ?? buildWalletIdentityResponse(
                address,
                resolvedChain,
                normalizeWalletIdentity(null),
                { providerStatusCode: 404 },
            ),
        ),
    };
}

