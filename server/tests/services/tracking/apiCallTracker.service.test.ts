import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const queueApiTrackerRecord = vi.fn();
    return {
        queueApiTrackerRecord,
    };
});

vi.mock("@sv/config/constants.js", () => ({
    API_CALL_TRACKER_ENABLED: true,
    API_CALL_TRACKER_PROVIDER_ALLOWLIST: [],
    API_CALL_TRACKER_MAX_RESPONSE_BYTES: 64,
    API_CALL_TRACKER_REDACT_FIELDS: ["token", "authorization", "secret", "apikey"],
}));

vi.mock("@sv/middlewares/request-context.js", () => ({
    getRequestContext: () => ({
        requestId: "req-123",
        route: "/api/wallets/overview",
        method: "GET",
    }),
    setFirstCallerIfUnset: () => "server/src/routes/wallets.route.ts:getOverview",
}));

vi.mock("@sv/services/tracking/apiCallTracker.exporter.js", () => ({
    queueApiTrackerRecord: hoisted.queueApiTrackerRecord,
}));

describe("apiCallTracker.service", () => {
    beforeEach(() => {
        vi.resetModules();
        hoisted.queueApiTrackerRecord.mockReset();
    });

    it("records response metadata and redacts sensitive payload fields", async () => {
        const { trackApiCallResponse } = await import("../../../src/services/tracking/apiCallTracker.service.ts");

        const response = await trackApiCallResponse(
            {
                provider: "helius",
                url: "https://api.helius.xyz/v0/test",
                method: "POST",
                requestHeaders: { Authorization: "Bearer secret-value" },
                requestBody: { token: "raw-secret", foo: 1 },
                apiKey: {
                    source: "HELIUS_API_KEY",
                    masked: "abcd...wxyz",
                    fingerprint: "f00dbabe00000000",
                },
                serviceFile: "server/src/services/wallet/fetchers/walletDataFetcher.service.ts",
                functionName: "fetchHeliusData",
            },
            async () =>
                new Response(JSON.stringify({ token: "top-secret", ok: true }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
        );

        expect(response.ok).toBe(true);
        expect(hoisted.queueApiTrackerRecord).toHaveBeenCalledTimes(1);

        const record = hoisted.queueApiTrackerRecord.mock.calls[0][0];
        expect(record.provider).toBe("helius");
        expect(record.origin.requestId).toBe("req-123");
        expect(record.origin.route).toBe("/api/wallets/overview");
        expect(record.request.headers.authorization).toBe("[REDACTED]");
        expect((record.response.data as Record<string, unknown>).token).toBe("[REDACTED]");
    });

    it("tracks thrown errors as failed records", async () => {
        const { trackApiCallResponse } = await import("../../../src/services/tracking/apiCallTracker.service.ts");

        await expect(
            trackApiCallResponse(
                {
                    provider: "moralis",
                    url: "https://solana-gateway.moralis.io/account",
                    method: "GET",
                    serviceFile: "server/src/services/tokens/token-holders.ts",
                    functionName: "fetchTopHoldersForToken",
                },
                async () => {
                    throw new Error("network exploded");
                },
            ),
        ).rejects.toThrow("network exploded");

        expect(hoisted.queueApiTrackerRecord).toHaveBeenCalledTimes(1);
        const record = hoisted.queueApiTrackerRecord.mock.calls[0][0];
        expect(record.response.ok).toBe(false);
        expect(record.response.status).toBe(0);
        expect(record.error.message).toContain("network exploded");
    });
});
