import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { heliusFetchMock } = vi.hoisted(() => ({
    heliusFetchMock: vi.fn(),
}));

vi.mock("@sv/util/util-helius.js", () => ({
    getEndpoint: (path: string) => new URL(`https://api.helius.xyz${path}`),
    getRequiredHeaders: () => ({ "X-Api-Key": "test-api-key" }),
    heliusFetch: heliusFetchMock,
}));

vi.mock("@sv/util/api-key-manager.js", () => ({
    apiKeyManager: {},
}));

import {
    fetchAllTransactionHistory,
    timePeriodToFromSec,
} from "../../../src/services/wallet/fetchers/walletDataFetcher.service.ts";

function okJson(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
    } as Response;
}

const NOW_ISO = "2026-03-12T00:00:00.000Z";
const NOW_SEC = Math.floor(new Date(NOW_ISO).getTime() / 1000);
const DAY_SEC = 24 * 60 * 60;

describe("timePeriodToFromSec", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW_ISO));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ["7D", 7],
        ["30D", 30],
        ["60D", 60],
        ["90D", 90],
        ["1Y", 365],
    ] as const)("returns correct cutoff for %s", (period, days) => {
        const result = timePeriodToFromSec(period);
        expect(result).toBe(NOW_SEC - days * DAY_SEC);
    });

    it("returns 0 for 'All'", () => {
        expect(timePeriodToFromSec("All")).toBe(0);
    });
});

describe("fetchAllTransactionHistory - time-window cutoff", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW_ISO));
        heliusFetchMock.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("stops fetching when an entry's timestamp crosses the cutoff boundary", async () => {
        const cutoffSec = NOW_SEC - 7 * DAY_SEC;
        const withinWindow = NOW_SEC - 100;
        const beyondCutoff = cutoffSec - 1;

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "sig-in-window",
                        timestamp: withinWindow,
                        slot: 1,
                        fee: 5000,
                        feePayer: "payer",
                        balanceChanges: [{ mint: "SOL", amount: 1000000000, decimals: 9 }],
                    },
                ],
                pagination: { hasMore: true, nextCursor: "cursor-1" },
            }),
        );

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "sig-beyond-cutoff",
                        timestamp: beyondCutoff,
                        slot: 2,
                        fee: 5000,
                        feePayer: "payer",
                        balanceChanges: [],
                    },
                ],
                pagination: { hasMore: true, nextCursor: "cursor-2" },
            }),
        );

        const result = await fetchAllTransactionHistory("wallet-addr", "7d");

        expect(result).toHaveLength(1);
        expect(result[0].signature).toBe("sig-in-window");
        expect(heliusFetchMock).toHaveBeenCalledTimes(2);
    });

    it("stops fetching when an entry's timestamp crosses a numeric fromSec cutoff", async () => {
        const cutoffSec = NOW_SEC - 30 * DAY_SEC;
        const withinWindow = NOW_SEC - 100;
        const beyondCutoff = cutoffSec - 1;

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "sig-in",
                        timestamp: withinWindow,
                        slot: 1,
                        fee: 5000,
                        feePayer: "payer",
                        balanceChanges: [],
                    },
                ],
                pagination: { hasMore: true, nextCursor: "cursor-1" },
            }),
        );

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "sig-out",
                        timestamp: beyondCutoff,
                        slot: 2,
                        fee: 5000,
                        feePayer: "payer",
                        balanceChanges: [],
                    },
                ],
                pagination: { hasMore: false, nextCursor: null },
            }),
        );

        const result = await fetchAllTransactionHistory("wallet-addr", cutoffSec);

        expect(result).toHaveLength(1);
        expect(result[0].signature).toBe("sig-in");
    });

    it("terminates cleanly on empty data page", async () => {
        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [],
                pagination: { hasMore: true, nextCursor: "cursor-1" },
            }),
        );

        const result = await fetchAllTransactionHistory("wallet-addr", "7d");

        expect(result).toHaveLength(0);
        expect(heliusFetchMock).toHaveBeenCalledTimes(1);
    });

    it("skips entries with null timestamp and continues", async () => {
        const withinWindow = NOW_SEC - 50;

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "sig-null-ts",
                        timestamp: null,
                        slot: 1,
                        fee: 5000,
                        feePayer: "payer",
                        balanceChanges: [],
                    },
                    {
                        signature: "sig-valid",
                        timestamp: withinWindow,
                        slot: 2,
                        fee: 5000,
                        feePayer: "payer",
                        balanceChanges: [{ mint: "SOL", amount: 2000000000, decimals: 9 }],
                    },
                ],
                pagination: { hasMore: false, nextCursor: null },
            }),
        );

        const result = await fetchAllTransactionHistory("wallet-addr", "7d");

        expect(result).toHaveLength(1);
        expect(result[0].signature).toBe("sig-valid");
    });
});
