import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { heliusFetchMock, moralisFetchMock } = vi.hoisted(() => ({
    heliusFetchMock: vi.fn(),
    moralisFetchMock: vi.fn(),
}));

vi.mock("@sv/util/util-helius.js", () => ({
    getEndpoint: (path: string) => new URL(`https://api.helius.xyz${path}`),
    getRequiredHeaders: () => ({ "X-Api-Key": "test-api-key" }),
    heliusFetch: heliusFetchMock,
}));

vi.mock("@sv/util/util-moralis.js", () => ({
    getEndpoint: (path: string, provider: "evm" | "solana-gateway" = "evm") => {
        const host = provider === "solana-gateway"
            ? "https://solana-gateway.moralis.io"
            : "https://deep-index.moralis.io/api/v2.2";
        return new URL(`${host}${path}`);
    },
    getRequiredHeaders: () => ({ "X-API-Key": "test-moralis-key" }),
    moralisFetch: moralisFetchMock,
}));

vi.mock("@sv/util/api-key-manager.js", () => ({
    apiKeyManager: {},
}));

import {
    fetchAllTransactionHistory,
    fetchHeliusSolanaPortfolio,
    fetchMoralisSolanaSwap,
    fetchHeliusSolanaSwap,
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
        moralisFetchMock.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("maps logoUri and keeps showZeroBalance=false in balances requests", async () => {
        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                balances: [
                    {
                        mint: "mint-1",
                        symbol: "USDC",
                        name: "USD Coin",
                        logoURI: "https://cdn.example/usdc.png",
                        balance: 2,
                        pricePerToken: 1,
                        usdValue: 2,
                    },
                ],
                pagination: { hasMore: false, page: 1 },
            }),
        );

        const result = await fetchHeliusSolanaPortfolio("wallet-address");

        expect(result).toEqual([
            {
                tokenAddress: "mint-1",
                symbol: "USDC",
                name: "USD Coin",
                logoUri: "https://cdn.example/usdc.png",
                amount: 2,
                priceUsd: 1,
                valueUsd: 2,
            },
        ]);

        expect(heliusFetchMock).toHaveBeenCalledTimes(1);
        const balancesUrl = heliusFetchMock.mock.calls[0][0] as URL;
        expect(balancesUrl.pathname).toContain("/v1/wallet/wallet-address/balances");
        expect(balancesUrl.searchParams.get("showZeroBalance")).toBe("false");
        expect(balancesUrl.searchParams.get("showNative")).toBe("true");
        expect(balancesUrl.searchParams.get("showNfts")).toBe("false");
    });

    it("preserves portfolio mapping when Helius price fields are null", async () => {
        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                balances: [
                    {
                        mint: "mint-no-price",
                        symbol: "NOP",
                        balance: 3,
                        pricePerToken: null,
                        usdValue: null,
                    },
                    {
                        mint: "mint-derived",
                        symbol: "DRV",
                        balance: 2,
                        pricePerToken: "4",
                        usdValue: null,
                    },
                ],
                pagination: { hasMore: false, page: 1 },
            }),
        );

        const result = await fetchHeliusSolanaPortfolio("wallet-address");

        expect(result).toHaveLength(2);
        expect(result[0].priceUsd).toBeUndefined();
        expect(result[0].valueUsd).toBe(0);
        expect(result[1].priceUsd).toBe(4);
        expect(result[1].valueUsd).toBe(8);
    });

    it("stops balances pagination when repeated pages add no new tokens", async () => {
        heliusFetchMock.mockResolvedValue(
            okJson({
                balances: [
                    {
                        mint: "mint-stuck",
                        symbol: "STK",
                        name: "Stuck Token",
                        balance: 1,
                        pricePerToken: 2,
                        usdValue: 2,
                    },
                ],
                pagination: { hasMore: true, page: 1 },
            }),
        );

        const result = await fetchHeliusSolanaPortfolio("wallet-address");

        expect(result).toEqual([
            expect.objectContaining({
                tokenAddress: "mint-stuck",
                amount: 1,
                valueUsd: 2,
            }),
        ]);

        // Guard should stop repeated no-progress pages before runaway growth.
        expect(heliusFetchMock).toHaveBeenCalledTimes(4);
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

    it("uses a provided beforeCursor seed on the first history request", async () => {
        const nowSec = Math.floor(Date.now() / 1000);

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "sig-1",
                        timestamp: nowSec - 15,
                        slot: 1,
                        fee: 0.000005,
                        feePayer: "payer-1",
                        balanceChanges: [{ mint: "SOL", amount: -0.1, decimals: 9 }],
                    },
                ],
                pagination: { hasMore: false, nextCursor: null },
            }),
        );

        await fetchAllTransactionHistory("wallet-address", "7d", {
            beforeCursor: "sig-seed",
        });

        expect(heliusFetchMock).toHaveBeenCalledTimes(1);
        const firstUrl = heliusFetchMock.mock.calls[0][0] as URL;
        expect(firstUrl.pathname).toContain("/v1/wallet/wallet-address/history");
        expect(firstUrl.searchParams.get("before")).toBe("sig-seed");
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

    it("paginates swap history with before=nextCursor", async () => {
        const nowSec = Math.floor(Date.now() / 1000);

        heliusFetchMock
            .mockResolvedValueOnce(
                okJson({
                    data: [
                        {
                            signature: "swap-1",
                            timestamp: nowSec - 20,
                            slot: 1,
                            fee: 10,
                            feePayer: "payer-1",
                            balanceChanges: [
                                { mint: "mint-a", amount: -100, decimals: 2 },
                                { mint: "mint-b", amount: 200, decimals: 2 },
                            ],
                        },
                    ],
                    pagination: { hasMore: true, nextCursor: "swap-cursor-1" },
                }),
            )
            .mockResolvedValueOnce(
                okJson({
                    data: [
                        {
                            signature: "swap-2",
                            timestamp: nowSec - 40,
                            slot: 2,
                            fee: 11,
                            feePayer: "payer-2",
                            balanceChanges: [
                                { mint: "mint-c", amount: -300, decimals: 2 },
                                { mint: "mint-d", amount: 500, decimals: 2 },
                            ],
                        },
                    ],
                    pagination: { hasMore: false, nextCursor: "swap-cursor-2" },
                }),
            );

        const result = await fetchHeliusSolanaSwap("wallet-address", "7d");

        expect(result).toHaveLength(2);
        expect(heliusFetchMock).toHaveBeenCalledTimes(2);

        const secondUrl = heliusFetchMock.mock.calls[1][0] as URL;
        expect(secondUrl.pathname).toContain("/v1/wallet/wallet-address/history");
        expect(secondUrl.searchParams.get("before")).toBe("swap-cursor-1");
        expect(secondUrl.searchParams.get("type")).toBe("SWAP");
    });

    it("stops swap history pagination when page crosses requested time window", async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const olderThanSevenDays = nowSec - (8 * 24 * 60 * 60);

        heliusFetchMock.mockResolvedValueOnce(
            okJson({
                data: [
                    {
                        signature: "swap-old",
                        timestamp: olderThanSevenDays,
                        slot: 99,
                        fee: 10,
                        feePayer: "payer-old",
                        balanceChanges: [
                            { mint: "mint-a", amount: -100, decimals: 2 },
                            { mint: "mint-b", amount: 200, decimals: 2 },
                        ],
                    },
                ],
                pagination: { hasMore: true, nextCursor: "swap-cursor-old" },
            }),
        );

        const result = await fetchHeliusSolanaSwap("wallet-address", "7d");

        expect(result).toHaveLength(0);
        expect(heliusFetchMock).toHaveBeenCalledTimes(1);
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

    it("maps Moralis wallet-swaps and paginates with cursor", async () => {
        const nowSec = Math.floor(Date.now() / 1000);
        const nowIso = new Date(nowSec * 1000).toISOString();

        moralisFetchMock
            .mockResolvedValueOnce(
                okJson({
                    result: [
                        {
                            transaction_hash: "moralis-sig-1",
                            block_timestamp: nowIso,
                            block_number: 321,
                            fee: "0.00001",
                            fee_payer: "payer-1",
                            transaction_type: "swap",
                            exchange: { name: "Jupiter" },
                            pair: {
                                pairAddress: "pair-1",
                                baseTokenAddress: "mint-sold",
                                quoteTokenAddress: "mint-bought",
                            },
                            sold: {
                                address: "mint-sold",
                                amount: "1.5",
                                decimals: 6,
                                symbol: "SOLD",
                            },
                            bought: {
                                address: "mint-bought",
                                amount: "2.25",
                                decimals: 6,
                                symbol: "BOUGHT",
                            },
                            total_value_usd: "13.4",
                            base_quote_price: "0.77",
                        },
                    ],
                    cursor: "next-cursor-1",
                }),
            )
            .mockResolvedValueOnce(
                okJson({
                    result: [
                        {
                            transaction_hash: "moralis-sig-2",
                            block_timestamp: nowIso,
                            fee: "0",
                            sold: { address: "mint-a", amount: "2", decimals: 6 },
                            bought: { address: "mint-b", amount: "4", decimals: 6 },
                        },
                    ],
                    cursor: null,
                }),
            );

        const swaps = await fetchMoralisSolanaSwap("wallet-address", "7d", {
            limit: 50,
        });

        expect(swaps).toHaveLength(2);
        expect(swaps[0]).toEqual(
            expect.objectContaining({
                signature: "moralis-sig-1",
                transactionType: "swap",
                blockNumber: 321,
                source: "moralis",
                sold: expect.objectContaining({ mint: "mint-sold", amount: 1.5 }),
                bought: expect.objectContaining({ mint: "mint-bought", amount: 2.25 }),
                totalValueUsd: 13.4,
                baseQuotePrice: 0.77,
            }),
        );

        expect(swaps[0].balanceChanges).toEqual([
            expect.objectContaining({ mint: "mint-sold", amount: -1.5 }),
            expect.objectContaining({ mint: "mint-bought", amount: 2.25 }),
        ]);

        expect(moralisFetchMock).toHaveBeenCalledTimes(2);

        const firstUrl = moralisFetchMock.mock.calls[0][0] as URL;
        expect(firstUrl.pathname).toContain("/account/mainnet/wallet-address/swaps");
        expect(firstUrl.searchParams.get("limit")).toBeNull();
        expect(firstUrl.searchParams.get("fromDate")).toBeTruthy();
        expect(firstUrl.searchParams.get("toDate")).toBeTruthy();

        const secondUrl = moralisFetchMock.mock.calls[1][0] as URL;
        expect(secondUrl.searchParams.get("cursor")).toBe("next-cursor-1");
    });
});
