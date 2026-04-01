import { describe, expect, it, vi } from "vitest";
import { getWalletExchangeCountsWithFetcher } from "../../src/services/wallet/walletExchangeAggregation.service.js";
import type { WalletSwap } from "../../src/services/wallet/dtos/walletDataObjects.js";
import type { WalletExchangeCountsResponse } from "../../src/services/wallet/dtos/walletDataObjects.js";

function buildSwap(overrides: Partial<WalletSwap> = {}): WalletSwap {
    return {
        walletAddress: "wallet-1",
        signature: "sig-default",
        timestamp: "2026-03-18T10:00:00.000Z",
        slot: 123,
        fee: 0,
        feePayer: "wallet-1",
        balanceChanges: [],
        feeChanges: [],
        exchange: null,
        pair: null,
        sold: {
            mint: "mint-sold",
            amount: -1,
            decimals: 6,
            valueUsd: 50,
        },
        bought: {
            mint: "mint-bought",
            amount: 1,
            decimals: 6,
            valueUsd: 50,
        },
        totalValueUsd: 50,
        ...overrides,
    };
}

describe("walletExchangeAggregation.service", () => {
    it("aggregates and dedupes by signature plus exchange bucket", async () => {
        const fetchSwapsPage = vi.fn()
            .mockResolvedValueOnce({
                address: "wallet-1",
                swaps: [
                    buildSwap({
                        signature: "sig-1",
                        exchange: { name: "Jupiter", address: "dex-1" },
                        bought: { mint: "mint-a", amount: 1, decimals: 6, valueUsd: 120 },
                        sold: { mint: "mint-b", amount: -1, decimals: 6, valueUsd: 100 },
                        totalValueUsd: 120,
                    }),
                    buildSwap({
                        signature: "sig-1",
                        exchange: { name: "Jupiter", address: "dex-1" },
                        bought: { mint: "mint-a", amount: 1, decimals: 6, valueUsd: 999 },
                        sold: { mint: "mint-b", amount: -1, decimals: 6, valueUsd: 999 },
                        totalValueUsd: 999,
                    }),
                ],
                pageInfo: {
                    pageSize: 100,
                    hasMore: true,
                    nextCursor: "cursor-2",
                    source: "cache" as const,
                },
            })
            .mockResolvedValueOnce({
                address: "wallet-1",
                swaps: [
                    buildSwap({
                        signature: "sig-2",
                        exchange: null,
                        pair: { label: "Raydium CLMM", address: "pair-1" },
                        bought: null,
                        sold: { mint: "mint-c", amount: -1, decimals: 6, valueUsd: 50 },
                        totalValueUsd: 50,
                        transactionType: "sell",
                    }),
                    buildSwap({
                        signature: "sig-3",
                        exchange: null,
                        pair: null,
                        bought: { mint: "mint-d", amount: 1, decimals: 6, valueUsd: null },
                        sold: { mint: "mint-e", amount: -1, decimals: 6, valueUsd: null },
                        totalValueUsd: 80,
                    }),
                ],
                pageInfo: {
                    pageSize: 100,
                    hasMore: false,
                    nextCursor: null,
                    source: "provider" as const,
                },
            });

        const result: WalletExchangeCountsResponse = await getWalletExchangeCountsWithFetcher(
            "wallet-1",
            { period: "30D", limit: 10 },
            fetchSwapsPage,
        );

        expect(result.metadata).toMatchObject({
            period: "30D",
            source: "mixed",
            limit: 10,
            truncated: false,
        });

        const jupiter = result.exchanges.find((row) => row.name === "Jupiter");
        const raydium = result.exchanges.find((row) => row.name === "Raydium CLMM");
        const unknown = result.exchanges.find((row) => row.name === "Unknown");

        expect(jupiter).toMatchObject({
            deposits: 1,
            withdrawals: 1,
            depositsVolume: 120,
            withdrawalsVolume: 100,
        });

        expect(raydium).toMatchObject({
            deposits: 0,
            withdrawals: 1,
            depositsVolume: 0,
            withdrawalsVolume: 50,
        });

        expect(unknown).toMatchObject({
            deposits: 1,
            withdrawals: 1,
            depositsVolume: 40,
            withdrawalsVolume: 40,
        });
    });

    it("marks response truncated when more pages remain beyond transaction limit", async () => {
        const fetchSwapsPage = vi.fn().mockResolvedValue({
            address: "wallet-1",
            swaps: [
                buildSwap({ signature: "sig-1" }),
                buildSwap({ signature: "sig-2" }),
            ],
            pageInfo: {
                pageSize: 100,
                hasMore: true,
                nextCursor: "cursor-next",
                source: "provider" as const,
            },
        });

        const result = await getWalletExchangeCountsWithFetcher(
            "wallet-1",
            { period: "7D", limit: 1 },
            fetchSwapsPage,
        );

        expect(result.metadata.truncated).toBe(true);
        expect(fetchSwapsPage).toHaveBeenCalledTimes(1);
    });
});
