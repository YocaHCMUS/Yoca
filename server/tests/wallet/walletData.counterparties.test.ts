import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    getWalletTransfersMock: vi.fn(),
    getTokenMarketDataMock: vi.fn(),
    getWalletIdentityBatchMock: vi.fn(),
    resolveChainForAddressMock: vi.fn(),
}));

vi.mock("@sv/services/wallet/walletData.service.js", () => ({
    getWalletTransfers: hoisted.getWalletTransfersMock,
}));

vi.mock("@sv/services/tokens/token-market-data.js", () => ({
    getTokenMarketData: hoisted.getTokenMarketDataMock,
}));

vi.mock("@sv/services/wallet/walletIdentity.service.js", () => ({
    getWalletIdentityBatch: hoisted.getWalletIdentityBatchMock,
}));

vi.mock("@sv/util/util-helius.js", () => ({
    resolveChainForAddress: hoisted.resolveChainForAddressMock,
}));

import { getWalletCounterparties } from "../../src/services/wallet/counterparties.service.ts";

function buildTransfer(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        from: "wallet-1",
        to: "counterparty-a",
        amount: 1,
        timestamp: "2026-03-14T11:00:00.000Z",
        tokenAddress: "mint-a",
        tokenSymbol: "SOL",
        transactionSignature: "sig-a",
        instructionIndex: 0,
        ...overrides,
    };
}

describe("wallet counterparty service", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-14T12:00:00.000Z"));

        hoisted.getWalletTransfersMock.mockReset();
        hoisted.getTokenMarketDataMock.mockReset();
        hoisted.getWalletIdentityBatchMock.mockReset();
        hoisted.resolveChainForAddressMock.mockReset();

        hoisted.resolveChainForAddressMock.mockImplementation((_: string, chain: string) => chain || "solana");
        hoisted.getWalletTransfersMock.mockResolvedValue({ address: "wallet-1", chain: "solana", transfers: [] });
        hoisted.getTokenMarketDataMock.mockResolvedValue({});
        hoisted.getWalletIdentityBatchMock.mockResolvedValue({ chain: "solana", results: [] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("aggregates counterparties correctly in 7d window", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({
                    to: "counterparty-a",
                    amount: 1,
                    tokenAddress: "mint-a",
                    tokenSymbol: "SOL",
                    transactionSignature: "sig-a",
                }),
                buildTransfer({
                    from: "counterparty-b",
                    to: "wallet-1",
                    amount: 2,
                    tokenAddress: "mint-b",
                    tokenSymbol: "USDC",
                    transactionSignature: "sig-b",
                }),
                buildTransfer({
                    to: "counterparty-old",
                    amount: 1,
                    tokenAddress: "mint-old",
                    tokenSymbol: "OLD",
                    transactionSignature: "sig-old",
                    timestamp: "2026-03-01T00:00:00.000Z",
                }),
            ],
        });

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-a": { priceUsd: 100 },
            "mint-b": { priceUsd: 25 },
            "mint-old": { priceUsd: 500 },
        });

        hoisted.getWalletIdentityBatchMock.mockResolvedValueOnce({
            chain: "solana",
            results: [
                {
                    address: "counterparty-a",
                    chain: "solana",
                    identity: {
                        status: "known",
                        name: "Known Counterparty",
                        category: "Exchange",
                        type: "exchange",
                    },
                },
                {
                    address: "counterparty-b",
                    chain: "solana",
                    identity: {
                        status: "unknown",
                        name: null,
                        category: null,
                        type: null,
                    },
                },
            ],
        });

        const result = await getWalletCounterparties("wallet-1", "solana", {
            period: "7d",
            limit: 20,
            includeTokens: true,
        });

        expect(result.counterparties).toHaveLength(2);
        expect(result.metadata.period).toBe("7d");
        expect(result.metadata.totals.counterparties).toBe(2);
        expect(result.metadata.totals.transactions).toBe(2);
        expect(result.metadata.totals.volume).toBe(150);

        expect(result.counterparties[0]).toMatchObject({
            address: "counterparty-a",
            transactionCount: 1,
            totalVolumeUsd: 100,
            uniqueTokenCount: 1,
            tokens: ["SOL"],
        });

        expect(result.counterparties[1]).toMatchObject({
            address: "counterparty-b",
            transactionCount: 1,
            totalVolumeUsd: 50,
            uniqueTokenCount: 1,
            tokens: ["USDC"],
        });
    });

    it("deduplicates transaction count by signature", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({
                    to: "counterparty-a",
                    amount: 1,
                    tokenAddress: "mint-a",
                    tokenSymbol: "SOL",
                    transactionSignature: "sig-dup",
                    instructionIndex: 0,
                }),
                buildTransfer({
                    to: "counterparty-a",
                    amount: 2,
                    tokenAddress: "mint-b",
                    tokenSymbol: "USDC",
                    transactionSignature: "sig-dup",
                    instructionIndex: 1,
                }),
            ],
        });

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-a": { priceUsd: 100 },
            "mint-b": { priceUsd: 50 },
        });

        const result = await getWalletCounterparties("wallet-1", "solana", { period: "7d" });

        expect(result.counterparties).toHaveLength(1);
        expect(result.counterparties[0].transactionCount).toBe(1);
        expect(result.counterparties[0].uniqueTokenCount).toBe(2);
        expect(result.counterparties[0].totalVolumeUsd).toBe(200);
    });

    it("computes unique token count and token list", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({ to: "counterparty-a", tokenAddress: "mint-a", tokenSymbol: "SOL", transactionSignature: "sig-1" }),
                buildTransfer({ to: "counterparty-a", tokenAddress: "mint-b", tokenSymbol: "USDC", transactionSignature: "sig-2" }),
                buildTransfer({ to: "counterparty-a", tokenAddress: "mint-a", tokenSymbol: "SOL", transactionSignature: "sig-3" }),
            ],
        });

        const result = await getWalletCounterparties("wallet-1", "solana", { period: "7d" });

        expect(result.counterparties[0].uniqueTokenCount).toBe(2);
        expect(result.counterparties[0].tokens).toEqual(["SOL", "USDC"]);
    });

    it("sorts rankings by count and volume deterministically", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({ to: "counterparty-a", transactionSignature: "a-1", tokenAddress: "mint-a", tokenSymbol: "SOL", amount: 1 }),
                buildTransfer({ to: "counterparty-a", transactionSignature: "a-2", tokenAddress: "mint-b", tokenSymbol: "USDC", amount: 2 }),
                buildTransfer({ to: "counterparty-b", transactionSignature: "b-1", tokenAddress: "mint-c", tokenSymbol: "BONK", amount: 1 }),
                buildTransfer({ to: "counterparty-c", transactionSignature: "c-1", tokenAddress: "mint-a", tokenSymbol: "SOL", amount: 1 }),
                buildTransfer({ to: "counterparty-c", transactionSignature: "c-2", tokenAddress: "mint-b", tokenSymbol: "USDC", amount: 1 }),
                buildTransfer({ to: "counterparty-d", transactionSignature: "d-1", tokenAddress: "mint-a", tokenSymbol: "SOL", amount: 1 }),
                buildTransfer({ to: "counterparty-d", transactionSignature: "d-2", tokenAddress: "mint-b", tokenSymbol: "USDC", amount: 1 }),
            ],
        });

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-a": { priceUsd: 10 },
            "mint-b": { priceUsd: 20 },
            "mint-c": { priceUsd: 100 },
        });

        const result = await getWalletCounterparties("wallet-1", "solana", { period: "7d", limit: 10 });

        expect(result.rankings.byTransactionCount.map((item: { address: string }) => item.address)).toEqual([
            "counterparty-a",
            "counterparty-c",
            "counterparty-d",
            "counterparty-b",
        ]);

        expect(result.rankings.byVolume.map((item: { address: string }) => item.address)).toEqual([
            "counterparty-b",
            "counterparty-a",
            "counterparty-c",
            "counterparty-d",
        ]);
    });

    it("uses identity batch enrichment and maps known and unknown states", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({ to: "counterparty-a", tokenAddress: "mint-a", transactionSignature: "sig-a" }),
                buildTransfer({ to: "counterparty-b", tokenAddress: "mint-b", transactionSignature: "sig-b" }),
            ],
        });

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-a": { priceUsd: 20 },
            "mint-b": { priceUsd: 10 },
        });

        hoisted.getWalletIdentityBatchMock.mockResolvedValueOnce({
            chain: "solana",
            results: [
                {
                    address: "counterparty-a",
                    chain: "solana",
                    identity: {
                        status: "known",
                        name: "Known A",
                        category: "Exchange",
                        type: "exchange",
                    },
                },
                {
                    address: "counterparty-b",
                    chain: "solana",
                    identity: {
                        status: "unknown",
                        name: null,
                        category: null,
                        type: null,
                    },
                },
            ],
        });

        const result = await getWalletCounterparties("wallet-1", "solana", { period: "7d" });

        const rowA = result.counterparties.find((row: { address: string }) => row.address === "counterparty-a");
        const rowB = result.counterparties.find((row: { address: string }) => row.address === "counterparty-b");

        expect(rowA?.identity.status).toBe("known");
        expect(rowA?.identity.name).toBe("Known A");
        expect(rowB?.identity.status).toBe("unknown");

        expect(hoisted.getWalletIdentityBatchMock).toHaveBeenCalledTimes(1);
        expect(hoisted.getWalletIdentityBatchMock).toHaveBeenCalledWith(
            expect.arrayContaining(["counterparty-a", "counterparty-b"]),
            "solana",
        );
    });

    it("maps identity state to unavailable when identity provider fails", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({ to: "counterparty-a", tokenAddress: "mint-a", transactionSignature: "sig-a" }),
                buildTransfer({ to: "counterparty-b", tokenAddress: "mint-b", transactionSignature: "sig-b" }),
            ],
        });

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-a": { priceUsd: 20 },
            "mint-b": { priceUsd: 10 },
        });

        hoisted.getWalletIdentityBatchMock.mockRejectedValueOnce(new Error("provider down"));

        const result = await getWalletCounterparties("wallet-1", "solana", { period: "7d" });

        for (const row of result.counterparties) {
            expect(row.identity.status).toBe("unavailable");
        }
    });

    it("handles missing price and excludes records outside 7d", async () => {
        hoisted.getWalletTransfersMock.mockResolvedValueOnce({
            address: "wallet-1",
            chain: "solana",
            transfers: [
                buildTransfer({
                    to: "counterparty-a",
                    tokenAddress: "mint-unknown",
                    transactionSignature: "sig-a",
                    timestamp: "2026-03-14T10:00:00.000Z",
                }),
                buildTransfer({
                    to: "counterparty-b",
                    tokenAddress: "mint-old",
                    transactionSignature: "sig-old",
                    timestamp: "2026-03-01T00:00:00.000Z",
                }),
            ],
        });

        hoisted.getTokenMarketDataMock.mockResolvedValueOnce({
            "mint-old": { priceUsd: 999 },
        });

        const result = await getWalletCounterparties("wallet-1", "solana", { period: "7d" });

        expect(result.counterparties).toHaveLength(1);
        expect(result.counterparties[0].address).toBe("counterparty-a");
        expect(result.counterparties[0].totalVolumeUsd).toBe(0);
    });
});
