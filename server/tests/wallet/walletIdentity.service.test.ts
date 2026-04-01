import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_SOLANA_ADDRESS = "HXsKP7wrBWaQ8T2Vtjry3Nj3oUgwYcqq9vrHDM12G664";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const hoisted = vi.hoisted(() => {
    const heliusFetchMock = vi.fn();
    const getCachedWalletIdentityMock = vi.fn();
    const saveWalletIdentityCacheMock = vi.fn();

    return {
        heliusFetchMock,
        getCachedWalletIdentityMock,
        saveWalletIdentityCacheMock,
    };
});

vi.mock("@sv/util/util-helius.js", () => ({
    getEndpoint: (path: string) => new URL(`https://helius.local${path}`),
    getRequiredHeaders: () => ({ "X-API-Key": "test" }),
    heliusFetch: hoisted.heliusFetchMock,
    resolveChainForAddress: (_address: string, requestedChain: string) => requestedChain || "solana",
}));

vi.mock("@sv/services/wallet/db/walletIdentityCache.js", () => ({
    getCachedWalletIdentity: hoisted.getCachedWalletIdentityMock,
    saveWalletIdentityCache: hoisted.saveWalletIdentityCacheMock,
    getIdentityCacheTtlMs: (status: string) => {
        if (status === "known") {
            return 6 * 60 * 60 * 1000;
        }

        if (status === "unknown") {
            return 2 * 60 * 60 * 1000;
        }

        return 0;
    },
}));

import {
    WalletIdentityServiceError,
    getWalletIdentity,
    getWalletIdentityBatchRaw,
} from "../../src/services/wallet/walletIdentity.service.ts";

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

function makeAddress(index: number): string {
    const first = BASE58_ALPHABET[index % BASE58_ALPHABET.length];
    const second = BASE58_ALPHABET[Math.floor(index / BASE58_ALPHABET.length) % BASE58_ALPHABET.length];
    return `${first}${second}${"1".repeat(30)}`;
}

describe("walletIdentity.service", () => {
    beforeEach(() => {
        hoisted.heliusFetchMock.mockReset();
        hoisted.getCachedWalletIdentityMock.mockReset();
        hoisted.saveWalletIdentityCacheMock.mockReset();

        hoisted.getCachedWalletIdentityMock.mockResolvedValue(null);
        hoisted.saveWalletIdentityCacheMock.mockResolvedValue(undefined);
    });

    it("maps 200 known payload to status known", async () => {
        hoisted.heliusFetchMock.mockResolvedValueOnce(
            jsonResponse(200, {
                address: VALID_SOLANA_ADDRESS,
                name: "Binance 1",
                category: "Centralized Exchange",
                type: "exchange",
                tags: ["Centralized Exchange"],
                domainNames: ["binance.sol"],
            }),
        );

        const result = await getWalletIdentity(VALID_SOLANA_ADDRESS, "solana");

        expect(result.identity.status).toBe("known");
        expect(result.identity.name).toBe("Binance 1");
        expect(result.metadata.provider.statusCode).toBe(200);
        expect(hoisted.saveWalletIdentityCacheMock).toHaveBeenCalledTimes(1);
    });

    it("maps provider 404 to status unknown with 200 route-safe response", async () => {
        hoisted.heliusFetchMock.mockResolvedValueOnce(jsonResponse(404, { error: "not found" }));

        const result = await getWalletIdentity(VALID_SOLANA_ADDRESS, "solana");

        expect(result.identity.status).toBe("unknown");
        expect(result.identity.name).toBeNull();
        expect(result.metadata.provider.statusCode).toBe(404);
        expect(hoisted.saveWalletIdentityCacheMock).toHaveBeenCalledTimes(1);
    });

    it("maps type=unknown payload to status unknown", async () => {
        hoisted.heliusFetchMock.mockResolvedValueOnce(
            jsonResponse(200, {
                address: VALID_SOLANA_ADDRESS,
                name: "Unknown Label",
                category: "Unknown",
                type: "unknown",
            }),
        );

        const result = await getWalletIdentity(VALID_SOLANA_ADDRESS, "solana");

        expect(result.identity.status).toBe("unknown");
        expect(result.identity.type).toBeNull();
        expect(result.identity.name).toBeNull();
    });

    it("throws status unavailable for provider 429 without cache fallback", async () => {
        hoisted.heliusFetchMock.mockResolvedValueOnce(jsonResponse(429, { error: "rate limited" }));

        await expect(getWalletIdentity(VALID_SOLANA_ADDRESS, "solana")).rejects.toMatchObject({
            code: "provider_rate_limited",
            statusCode: 503,
        });
    });

    it("throws status unavailable for provider 5xx without cache fallback", async () => {
        hoisted.heliusFetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "internal" }));

        await expect(getWalletIdentity(VALID_SOLANA_ADDRESS, "solana")).rejects.toMatchObject({
            code: "provider_unavailable",
            statusCode: 503,
        });
    });

    it("uses stale cache when provider request fails", async () => {
        hoisted.getCachedWalletIdentityMock.mockResolvedValueOnce({
            address: VALID_SOLANA_ADDRESS,
            chain: "solana",
            identity: {
                status: "known",
                type: "exchange",
                name: "Cached Exchange",
                category: "Centralized Exchange",
                tags: ["Centralized Exchange"],
                domainNames: [],
                provider: "helius",
                providerVersion: "wallet-api-beta",
                resolvedAt: "2026-03-14T00:00:00.000Z",
            },
            raw: null,
            fetchedAt: new Date("2026-03-14T00:00:00.000Z"),
            ttlSec: 21600,
            isFresh: false,
        });

        hoisted.heliusFetchMock.mockResolvedValueOnce(jsonResponse(503, { error: "upstream error" }));

        const result = await getWalletIdentity(VALID_SOLANA_ADDRESS, "solana");

        expect(result.identity.status).toBe("known");
        expect(result.identity.name).toBe("Cached Exchange");
        expect(result.metadata.cache.stale).toBe(true);
        expect(result.metadata.provider.errorCode).toBe("provider_unavailable");
    });

    it("batch identity raw lookup dedupes and chunks requests", async () => {
        hoisted.heliusFetchMock.mockImplementation(async (_url: URL, init: RequestInit) => {
            const body = JSON.parse(String(init.body ?? "{}")) as { addresses?: string[] };
            const addresses = Array.isArray(body.addresses) ? body.addresses : [];

            return jsonResponse(
                200,
                addresses.map((address) => ({
                    address,
                    type: "unknown",
                })),
            );
        });

        const addresses = Array.from({ length: 101 }, (_, index) => makeAddress(index));
        const withDuplicate = [...addresses, addresses[0]];

        const result = await getWalletIdentityBatchRaw(withDuplicate);

        expect(hoisted.heliusFetchMock).toHaveBeenCalledTimes(2);
        expect(result.data).toHaveLength(101);
    });

    it("rejects invalid address format", async () => {
        await expect(getWalletIdentity("not-a-valid-address", "solana")).rejects.toBeInstanceOf(
            WalletIdentityServiceError,
        );
    });
});
