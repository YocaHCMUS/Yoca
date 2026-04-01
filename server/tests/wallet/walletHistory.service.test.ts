import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    fetchAllTransactionHistoryMock: vi.fn(async () => [] as any[]),
    fetchAllTransactionHistoryChunkMock: vi.fn(async () => ({
        transactions: [],
        nextCursor: null,
        hasMore: false,
        pagesFetched: 1,
        stopReason: "provider-end",
    }) as any),
    getCachedWalletTransactionsHeliusMock: vi.fn(async () => ({
        transactions: [],
        isFullyCovered: true,
        coveredRange: {
            earliestSec: null,
            latestSec: null,
        },
    }) as any),
    saveTransactionsHeliusCacheMock: vi.fn(async () => undefined),
}));

vi.mock("@sv/services/wallet/fetchers/walletDataFetcher.service.js", () => ({
    fetchAllTransactionHistory: hoisted.fetchAllTransactionHistoryMock,
    fetchAllTransactionHistoryChunk: hoisted.fetchAllTransactionHistoryChunkMock,
}));

vi.mock("@sv/services/wallet/db/walletDataRetriever.js", () => ({
    getCachedWalletTransactionsHelius: hoisted.getCachedWalletTransactionsHeliusMock,
}));

vi.mock("@sv/services/wallet/db/walletDataCacher.js", () => ({
    saveTransactionsHeliusCache: hoisted.saveTransactionsHeliusCacheMock,
}));

import { getWalletTransactionHeliusFromSources } from "../../src/services/wallet/walletHistory.service.ts";

describe("walletHistory.service", () => {
    it("uses bounded provider path for cursor requests", async () => {
        hoisted.fetchAllTransactionHistoryChunkMock.mockResolvedValueOnce({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-1",
                    timestamp: "2026-03-20T00:00:00.000Z",
                    slot: 1,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [],
                },
            ],
            nextCursor: "next",
            hasMore: true,
            pagesFetched: 2,
            stopReason: "max-pages",
        } as any);

        const result = await getWalletTransactionHeliusFromSources("wallet-1", {
            before: "cursor-1",
            limit: 5,
            fromSec: 0,
            toSec: 2_000_000_000,
        });

        expect(result.transactions).toHaveLength(1);
        expect(hoisted.fetchAllTransactionHistoryChunkMock).toHaveBeenCalledTimes(1);
        expect(hoisted.saveTransactionsHeliusCacheMock).toHaveBeenCalledTimes(1);
    });

    it("returns fully covered cache without provider fetch", async () => {
        hoisted.getCachedWalletTransactionsHeliusMock.mockResolvedValueOnce({
            transactions: [
                {
                    walletAddress: "wallet-1",
                    signature: "sig-cache",
                    timestamp: "2026-03-20T00:00:00.000Z",
                    slot: 1,
                    fee: 0,
                    feePayer: "wallet-1",
                    balanceChanges: [],
                },
            ],
            isFullyCovered: true,
            coveredRange: {
                earliestSec: 100,
                latestSec: 200,
            },
        } as any);

        const result = await getWalletTransactionHeliusFromSources("wallet-1", {
            fromSec: 100,
            toSec: 200,
        });

        expect(result.transactions).toHaveLength(1);
        expect(hoisted.fetchAllTransactionHistoryChunkMock).toHaveBeenCalledTimes(0);
        expect(hoisted.fetchAllTransactionHistoryMock).toHaveBeenCalledTimes(0);
    });
});
