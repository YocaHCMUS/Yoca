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
    fetchHeliusSolanaTransactions,
    fetchHeliusSolanaTransfers,
} from "../../../src/services/wallet/fetchers/walletDataFetcher.service.ts";

function okJson(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => body,
    } as Response;
}

describe("walletDataFetcher.service", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-12T00:00:00.000Z"));
        heliusFetchMock.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("paginates history with before=nextCursor", async () => {
        const nowSec = Math.floor(Date.now() / 1000);

        heliusFetchMock
            .mockResolvedValueOnce(
                okJson({
                    data: [
                        {
                            signature: "sig-1",
                            timestamp: nowSec - 10,
                            slot: 1,
                            fee: 0.000005,
                            feePayer: "payer-1",
                            balanceChanges: [{ mint: "SOL", amount: -0.1, decimals: 9 }],
                        },
                    ],
                    pagination: { hasMore: true, nextCursor: "cursor-1" },
                }),
            )
            .mockResolvedValueOnce(
                okJson({
                    data: [
                        {
                            signature: "sig-2",
                            timestamp: nowSec - 20,
                            slot: 2,
                            fee: 0.000005,
                            feePayer: "payer-2",
                            balanceChanges: [{ mint: "SOL", amount: 0.2, decimals: 9 }],
                        },
                    ],
                    pagination: { hasMore: false, nextCursor: "cursor-2" },
                }),
            );

        const res = await fetchAllTransactionHistory("wallet-address", "7d");

        expect(res).toHaveLength(2);
        expect(heliusFetchMock).toHaveBeenCalledTimes(2);

        const secondUrl = heliusFetchMock.mock.calls[1][0] as URL;
        expect(secondUrl.pathname).toContain("/v1/wallet/wallet-address/history");
        expect(secondUrl.searchParams.get("before")).toBe("cursor-1");
    });

    it("paginates transfers with cursor=nextCursor", async () => {
        const nowSec = Math.floor(Date.now() / 1000);

        heliusFetchMock
            .mockResolvedValueOnce(
                okJson({
                    data: [
                        {
                            signature: "tx-1",
                            timestamp: nowSec - 30,
                            direction: "in",
                            counterparty: "counterparty-1",
                            mint: "mint-1",
                            amountRaw: 2000000,
                            decimal: 6,
                            symbol: "USDC",
                        },
                    ],
                    pagination: { hasMore: true, nextCursor: "transfer-cursor-1" },
                }),
            )
            .mockResolvedValueOnce(
                okJson({
                    data: [
                        {
                            signature: "tx-2",
                            timestamp: nowSec - 60,
                            direction: "out",
                            counterparty: "counterparty-2",
                            mint: "mint-2",
                            amountRaw: 1000000000,
                            decimal: 9,
                            symbol: "SOL",
                        },
                    ],
                    pagination: { hasMore: false, nextCursor: "transfer-cursor-2" },
                }),
            );

        const res = await fetchHeliusSolanaTransfers("wallet-address", "7d");

        expect(res).toHaveLength(2);
        expect(heliusFetchMock).toHaveBeenCalledTimes(2);

        const secondUrl = heliusFetchMock.mock.calls[1][0] as URL;
        expect(secondUrl.pathname).toContain("/v1/wallet/wallet-address/transfers");
        expect(secondUrl.searchParams.get("cursor")).toBe("transfer-cursor-1");
        expect(secondUrl.searchParams.get("before")).toBeNull();
    });

    it("skips null timestamps and continues collecting transactions", async () => {
        const nowSec = Math.floor(Date.now() / 1000);

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "tx-null-ts",
                        timestamp: null,
                        direction: "in",
                        counterparty: "counterparty-null",
                        mint: "mint-null",
                        amount: 5,
                        symbol: "TKN",
                    },
                    {
                        signature: "tx-valid",
                        timestamp: nowSec - 10,
                        direction: "out",
                        counterparty: "counterparty-valid",
                        mint: "mint-valid",
                        amountRaw: 1500,
                        decimal: 2,
                        symbol: "TOK",
                    },
                ],
                pagination: { hasMore: false, nextCursor: null },
            }),
        );

        const res = await fetchHeliusSolanaTransactions("wallet-address", 10);

        expect(res).toHaveLength(1);
        expect(res[0].hash).toBe("tx-valid");
        expect(res[0].primaryTokenAmount).toBe(15);
    });
});
