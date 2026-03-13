import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const rowsByTable = new Map<unknown, unknown[]>();

    const getRows = (table: unknown) => rowsByTable.get(table) ?? [];

    const makeOrderByResult = (table: unknown) => ({
        limit: async (n: number) => getRows(table).slice(0, n),
        then: (resolve: (value: unknown[]) => void) => resolve(getRows(table)),
    });

    const db = {
        select: vi.fn(() => ({
            from: vi.fn((table: unknown) => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async (n: number) => getRows(table).slice(0, n)),
                    orderBy: vi.fn(() => makeOrderByResult(table)),
                })),
                orderBy: vi.fn(() => makeOrderByResult(table)),
            })),
        })),
    };

    const schema = {
        tokenTransfers: {
            name: "tokenTransfers",
            fromOwner: "tokenTransfers.fromOwner",
            toOwner: "tokenTransfers.toOwner",
            chain: "tokenTransfers.chain",
            blockTime: "tokenTransfers.blockTime",
        },
        walletHeliusTransactions: {
            name: "walletHeliusTransactions",
            address: "walletHeliusTransactions.address",
            chain: "walletHeliusTransactions.chain",
            timestamp: "walletHeliusTransactions.timestamp",
        },
        walletSwap: {
            name: "walletSwap",
            address: "walletSwap.address",
            chain: "walletSwap.chain",
            blockTimestamp: "walletSwap.blockTimestamp",
        },
        walletSwapMeta: {
            name: "walletSwapMeta",
            address: "walletSwapMeta.address",
            chain: "walletSwapMeta.chain",
        },
        walletTransactions: {
            name: "walletTransactions",
            address: "walletTransactions.address",
            chain: "walletTransactions.chain",
            blockTimestamp: "walletTransactions.blockTimestamp",
        },
        walletTransactionsMeta: {
            name: "walletTransactionsMeta",
            address: "walletTransactionsMeta.address",
            chain: "walletTransactionsMeta.chain",
        },
        walletTransferMeta: {
            name: "walletTransferMeta",
            address: "walletTransferMeta.address",
            chain: "walletTransferMeta.chain",
        },
    };

    return { db, rowsByTable, schema };
});

vi.mock("@sv/config/constants.js", () => ({
    WALLET_SWAPS_TTL_MS: 60 * 60 * 1000,
    WALLET_TRANSACTIONS_TTL_MS: 60 * 60 * 1000,
    WALLET_TRANSFERS_TTL_MS: 60 * 60 * 1000,
}));

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/db/schema.js", () => hoisted.schema);

vi.mock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ op: "and", args }),
    or: (...args: unknown[]) => ({ op: "or", args }),
    eq: (...args: unknown[]) => ({ op: "eq", args }),
    desc: (arg: unknown) => ({ op: "desc", arg }),
}));

import {
    getCachedWalletTransactions,
    getCachedWalletTransactionsHelius,
    getCachedWalletTransfers,
} from "../../../src/services/wallet/db/walletDataRetriever.ts";

describe("walletDataRetriever", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-12T12:00:00.000Z"));
        hoisted.rowsByTable.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns null when transaction metadata is stale", async () => {
        hoisted.rowsByTable.set(hoisted.schema.walletTransactionsMeta, [
            { fetchedAt: new Date("2026-03-12T09:30:00.000Z") },
        ]);

        const res = await getCachedWalletTransactions("wallet-1", "solana" as any, 100);

        expect(res).toBeNull();
    });

    it("returns mapped transactions when metadata is fresh", async () => {
        hoisted.rowsByTable.set(hoisted.schema.walletTransactionsMeta, [
            { fetchedAt: new Date("2026-03-12T11:45:00.000Z") },
        ]);

        hoisted.rowsByTable.set(hoisted.schema.walletTransactions, [
            {
                hash: "hash-1",
                blockTimestamp: "2026-03-12 11:00:00",
                fromAddress: "from-1",
                toAddress: "to-1",
                receiptStatus: 1,
                fee: "0.0005",
                mainAction: "swap",
                direction: "out",
                tokens: ["mint-1"],
                primaryTokenSymbol: "SOL",
                primaryTokenAmount: "2",
                primaryTokenAddress: "mint-1",
            },
        ]);

        const res = await getCachedWalletTransactions("wallet-1", "solana" as any, 100);

        expect(res).not.toBeNull();
        expect(res).toHaveLength(1);
        expect(res?.[0].hash).toBe("hash-1");
        expect(res?.[0].status).toBe(true);
        expect(res?.[0].primaryTokenAmount).toBe(2);
        expect(res?.[0].timestamp).toContain("T");
    });

    it("filters transfer rows by requested from-window", async () => {
        hoisted.rowsByTable.set(hoisted.schema.walletTransferMeta, [
            { fetchedAt: new Date("2026-03-12T11:59:00.000Z") },
        ]);

        hoisted.rowsByTable.set(hoisted.schema.tokenTransfers, [
            {
                fromOwner: "from-recent",
                toOwner: "to-recent",
                amount: 10,
                blockTime: new Date("2026-03-12T10:00:00.000Z"),
                tokenAddress: "mint-recent",
                tokenSymbol: "REC",
                transactionSignature: "sig-recent",
                instructionIndex: 0,
            },
            {
                fromOwner: "from-old",
                toOwner: "to-old",
                amount: 20,
                blockTime: new Date("2026-03-02T10:00:00.000Z"),
                tokenAddress: "mint-old",
                tokenSymbol: "OLD",
                transactionSignature: "sig-old",
                instructionIndex: 1,
            },
        ]);

        const res = await getCachedWalletTransfers("wallet-1", "solana" as any, "7d");

        expect(res).not.toBeNull();
        expect(res).toHaveLength(1);
        expect(res?.[0].transactionSignature).toBe("sig-recent");
    });

    it("filters helius transactions by requested range and reports coverage from meta bounds", async () => {
        // When the meta row has no coverage bounds, isFullyCovered should be false
        // and coveredRange should reflect null (no bounds persisted yet).
        hoisted.rowsByTable.set(hoisted.schema.walletTransactionsMeta, [
            { fetchedAt: new Date("2026-03-12T11:55:00.000Z"), coveredFromSec: null, coveredToSec: null },
        ]);

        hoisted.rowsByTable.set(hoisted.schema.walletHeliusTransactions, [
            {
                address: "wallet-1",
                signature: "helius-recent",
                timestamp: new Date("2026-03-12T11:30:00.000Z"),
                slot: 1,
                fee: 0.000005,
                feePayer: "payer-1",
                balanceChanges: [{ mint: "SOL", amount: 1, decimals: 9 }],
            },
            {
                address: "wallet-1",
                signature: "helius-old",
                timestamp: new Date("2026-03-10T11:30:00.000Z"),
                slot: 2,
                fee: 0.000007,
                feePayer: "payer-2",
                balanceChanges: [{ mint: "SOL", amount: -1, decimals: 9 }],
            },
        ]);

        const res = await getCachedWalletTransactionsHelius(
            "wallet-1",
            "solana" as any,
            { fromSec: Math.floor(new Date("2026-03-11T12:00:00.000Z").getTime() / 1000) },
        );

        expect(res.transactions).toHaveLength(1);
        expect(res.transactions[0].signature).toBe("helius-recent");
        // No persisted bounds yet — meta-based coverage is null
        expect(res.coveredRange.earliestSec).toBeNull();
        expect(res.coveredRange.latestSec).toBeNull();
        expect(res.isFullyCovered).toBe(false);
    });

    it("reports isFullyCovered when persisted meta bounds contain the requested range", async () => {
        const requestedFrom = Math.floor(new Date("2026-03-11T12:00:00.000Z").getTime() / 1000);
        const requestedTo = Math.floor(new Date("2026-03-12T12:00:00.000Z").getTime() / 1000);

        // Meta bounds cover the full requested window.
        hoisted.rowsByTable.set(hoisted.schema.walletTransactionsMeta, [
            {
                fetchedAt: new Date("2026-03-12T11:55:00.000Z"),
                coveredFromSec: requestedFrom - 100,
                coveredToSec: requestedTo + 100,
            },
        ]);

        hoisted.rowsByTable.set(hoisted.schema.walletHeliusTransactions, [
            {
                address: "wallet-1",
                signature: "helius-recent",
                timestamp: new Date("2026-03-12T11:30:00.000Z"),
                slot: 1,
                fee: 0.000005,
                feePayer: "payer-1",
                balanceChanges: [{ mint: "SOL", amount: 1, decimals: 9 }],
            },
        ]);

        const res = await getCachedWalletTransactionsHelius(
            "wallet-1",
            "solana" as any,
            { fromSec: requestedFrom, toSec: requestedTo },
        );

        expect(res.isFullyCovered).toBe(true);
        expect(res.coveredRange.earliestSec).toBe(requestedFrom - 100);
        expect(res.coveredRange.latestSec).toBe(requestedTo + 100);
    });

    it("reports isFullyCovered false when meta bounds only partially overlap requested range", async () => {
        const requestedFrom = Math.floor(new Date("2026-03-05T00:00:00.000Z").getTime() / 1000);
        const requestedTo = Math.floor(new Date("2026-03-12T12:00:00.000Z").getTime() / 1000);

        // Meta covers only the last 2 days, not the full 7-day window.
        hoisted.rowsByTable.set(hoisted.schema.walletTransactionsMeta, [
            {
                fetchedAt: new Date("2026-03-12T11:55:00.000Z"),
                coveredFromSec: Math.floor(new Date("2026-03-10T00:00:00.000Z").getTime() / 1000),
                coveredToSec: requestedTo,
            },
        ]);

        hoisted.rowsByTable.set(hoisted.schema.walletHeliusTransactions, []);

        const res = await getCachedWalletTransactionsHelius(
            "wallet-1",
            "solana" as any,
            { fromSec: requestedFrom, toSec: requestedTo },
        );

        expect(res.isFullyCovered).toBe(false);
    });

    it("returns cached range rows even if metadata is stale", async () => {
        hoisted.rowsByTable.set(hoisted.schema.walletTransactionsMeta, [
            { fetchedAt: new Date("2026-03-12T09:00:00.000Z") },
        ]);

        hoisted.rowsByTable.set(hoisted.schema.walletHeliusTransactions, [
            {
                address: "wallet-1",
                chain: "Solana",
                signature: "legacy-sig",
                timestamp: new Date("2026-03-12T11:30:00.000Z"),
                slot: 10,
                fee: 0.000004,
                feePayer: "payer-legacy",
                balanceChanges: [{ mint: "SOL", amount: 1, decimals: 9 }],
            },
        ]);

        const res = await getCachedWalletTransactionsHelius(
            "wallet-1",
            "solana" as any,
            { fromSec: Math.floor(new Date("2026-03-12T00:00:00.000Z").getTime() / 1000) },
        );

        expect(res.transactions).toHaveLength(1);
        expect(res.transactions[0].signature).toBe("legacy-sig");
    });
});
