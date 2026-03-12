import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
    const insertCalls: Array<{
        table: unknown;
        values: unknown;
        conflict: "nothing" | "update" | null;
        conflictArgs: unknown;
    }> = [];
    const deleteCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    const db = {
        insert: vi.fn((table: unknown) => {
            const call = {
                table,
                values: undefined as unknown,
                conflict: null as "nothing" | "update" | null,
                conflictArgs: undefined as unknown,
            };
            insertCalls.push(call);

            return {
                values: vi.fn((values: unknown) => {
                    call.values = values;
                    return {
                        onConflictDoNothing: vi.fn(async () => {
                            call.conflict = "nothing";
                        }),
                        onConflictDoUpdate: vi.fn(async (args: unknown) => {
                            call.conflict = "update";
                            call.conflictArgs = args;
                        }),
                    };
                }),
            };
        }),
        delete: vi.fn((table: unknown) => {
            const call = { table, whereArg: undefined as unknown };
            deleteCalls.push(call);
            return {
                where: vi.fn(async (whereArg: unknown) => {
                    call.whereArg = whereArg;
                }),
            };
        }),
    };

    const schema = {
        walletSwap: { name: "walletSwap", address: "walletSwap.address", chain: "walletSwap.chain" },
        walletTransactionsMeta: {
            name: "walletTransactionsMeta",
            address: "walletTransactionsMeta.address",
            chain: "walletTransactionsMeta.chain",
        },
        walletOverviewCache: {
            name: "walletOverviewCache",
            address: "walletOverviewCache.address",
            chain: "walletOverviewCache.chain",
        },
        walletTransactions: {
            name: "walletTransactions",
            address: "walletTransactions.address",
            chain: "walletTransactions.chain",
        },
        tokenTransfers: {
            name: "tokenTransfers",
            fromOwner: "tokenTransfers.fromOwner",
            toOwner: "tokenTransfers.toOwner",
            chain: "tokenTransfers.chain",
        },
        walletHeliusTransactions: {
            name: "walletHeliusTransactions",
            address: "walletHeliusTransactions.address",
            chain: "walletHeliusTransactions.chain",
        },
        walletSwapMeta: {
            name: "walletSwapMeta",
            address: "walletSwapMeta.address",
            chain: "walletSwapMeta.chain",
        },
        walletTransferMeta: {
            name: "walletTransferMeta",
            address: "walletTransferMeta.address",
            chain: "walletTransferMeta.chain",
        },
    };

    return { db, schema, insertCalls, deleteCalls };
});

vi.mock("@sv/db/index.js", () => ({
    db: hoisted.db,
}));

vi.mock("@sv/db/schema.js", () => hoisted.schema);

vi.mock("drizzle-orm", () => ({
    and: (...args: unknown[]) => ({ op: "and", args }),
    eq: (...args: unknown[]) => ({ op: "eq", args }),
}));

import {
    saveTransactionsCache,
    saveTransfersCache,
    saveTransactionsHeliusCache,
} from "../../../src/services/wallet/db/walletDataCacher.ts";

describe("walletDataCacher", () => {
    beforeEach(() => {
        hoisted.insertCalls.length = 0;
        hoisted.deleteCalls.length = 0;
        hoisted.db.insert.mockClear();
        hoisted.db.delete.mockClear();
    });

    it("deduplicates transaction hashes before insert", async () => {
        await saveTransactionsCache("addr-1", "solana", [
            {
                hash: "hash-1",
                timestamp: "2026-03-12T00:00:00.000Z",
                from: "from-1",
                to: "to-1",
                status: true,
                fee: 0.1,
                mainAction: "transfer",
                direction: "out",
                tokens: ["mint-1"],
                primaryTokenSymbol: "SOL",
                primaryTokenAmount: 1,
                primaryTokenAddress: "mint-1",
            },
            {
                hash: "hash-1",
                timestamp: "2026-03-12T00:05:00.000Z",
                from: "from-1",
                to: "to-1",
                status: true,
                fee: 0.2,
                mainAction: "transfer",
                direction: "out",
                tokens: ["mint-1"],
                primaryTokenSymbol: "SOL",
                primaryTokenAmount: 2,
                primaryTokenAddress: "mint-1",
            },
        ]);

        const txInsert = hoisted.insertCalls.find(
            (c) => c.table === hoisted.schema.walletTransactions,
        );
        const txRows = txInsert?.values as Array<{ hash: string }>;

        expect(hoisted.deleteCalls.some((c) => c.table === hoisted.schema.walletTransactions)).toBe(true);
        expect(txRows).toHaveLength(1);
        expect(txRows[0].hash).toBe("hash-1");

        const metaInsert = hoisted.insertCalls.find(
            (c) => c.table === hoisted.schema.walletTransactionsMeta,
        );
        expect(metaInsert?.conflict).toBe("update");
    });

    it("deduplicates transfers by signature and instruction index", async () => {
        await saveTransfersCache("addr-1", "solana", [
            {
                from: "from-1",
                to: "to-1",
                amount: 1,
                timestamp: "2026-03-12T00:00:00.000Z",
                tokenAddress: "mint-1",
                tokenSymbol: "SOL",
                transactionSignature: "sig-1",
                instructionIndex: 0,
            },
            {
                from: "from-1",
                to: "to-1",
                amount: 2,
                timestamp: "2026-03-12T00:00:05.000Z",
                tokenAddress: "mint-1",
                tokenSymbol: "SOL",
                transactionSignature: "sig-1",
                instructionIndex: 0,
            },
            {
                from: "from-1",
                to: "to-2",
                amount: 3,
                timestamp: "2026-03-12T00:01:00.000Z",
                tokenAddress: "mint-2",
                tokenSymbol: "USDC",
                transactionSignature: "sig-2",
                instructionIndex: 1,
            },
        ]);

        const transferInsert = hoisted.insertCalls.find(
            (c) => c.table === hoisted.schema.tokenTransfers,
        );
        const transferRows = transferInsert?.values as Array<{ amountUsd: number }>;

        expect(transferRows).toHaveLength(2);
        expect(transferRows.every((r) => r.amountUsd === 0)).toBe(true);

        const metaInsert = hoisted.insertCalls.find(
            (c) => c.table === hoisted.schema.walletTransferMeta,
        );
        expect(metaInsert?.conflict).toBe("update");
    });

    it("deduplicates helius transactions by signature and persists Solana chain rows", async () => {
        await saveTransactionsHeliusCache("addr-1", "solana", [
            {
                walletAddress: "addr-1",
                signature: "helius-sig-1",
                timestamp: "2026-03-12T00:00:00.000Z",
                slot: 1,
                fee: 0.000005,
                feePayer: "payer-1",
                balanceChanges: [{ mint: "SOL", amount: -1, decimals: 9 }],
            },
            {
                walletAddress: "addr-1",
                signature: "helius-sig-1",
                timestamp: "2026-03-12T00:00:01.000Z",
                slot: 2,
                fee: 0.000006,
                feePayer: "payer-2",
                balanceChanges: [{ mint: "SOL", amount: 1, decimals: 9 }],
            },
        ]);

        const heliusInsert = hoisted.insertCalls.find(
            (c) => c.table === hoisted.schema.walletHeliusTransactions,
        );
        const heliusRows = heliusInsert?.values as Array<{ signature: string; chain: string }>;

        expect(heliusRows).toHaveLength(1);
        expect(heliusRows[0].signature).toBe("helius-sig-1");
        expect(heliusRows[0].chain).toBe("Solana");
    });
});
