import { db } from "@sv/db/index.js";
import { walletTokenBalanceHistoryCache } from "@sv/db/schema.js";
import type { BalanceDataPoint } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { and, eq, gte } from "drizzle-orm";

const TOKEN_BALANCE_HISTORY_CACHE_TTL_MS = 15 * 60 * 1000;

export type CachedWalletTokenBalanceHistory = {
    tokenSymbol: string;
    tokenSeries: BalanceDataPoint[];
    usdSeries: BalanceDataPoint[];
    coveredFromMs: number;
    coveredToMs: number;
};

export async function getCachedWalletTokenBalanceHistory(
    address: string,
    tokenAddress: string,
): Promise<CachedWalletTokenBalanceHistory | null> {
    const threshold = new Date(Date.now() - TOKEN_BALANCE_HISTORY_CACHE_TTL_MS);
    const rows = await db
        .select()
        .from(walletTokenBalanceHistoryCache)
        .where(
            and(
                eq(walletTokenBalanceHistoryCache.address, address),
                eq(walletTokenBalanceHistoryCache.tokenAddress, tokenAddress),
                gte(walletTokenBalanceHistoryCache.fetchedAt, threshold),
            ),
        )
        .limit(1);

    if (rows.length === 0) {
        return null;
    }

    return {
        tokenSymbol: rows[0].tokenSymbol,
        tokenSeries: rows[0].tokenSeries,
        usdSeries: rows[0].usdSeries,
        coveredFromMs: Number(rows[0].coveredFromMs),
        coveredToMs: Number(rows[0].coveredToMs),
    };
}

export async function saveWalletTokenBalanceHistoryCache(input: {
    address: string;
    tokenAddress: string;
    tokenSymbol: string;
    tokenSeries: BalanceDataPoint[];
    usdSeries: BalanceDataPoint[];
    coveredFromMs: number;
    coveredToMs: number;
}): Promise<void> {
    try {
        await db
            .insert(walletTokenBalanceHistoryCache)
            .values({
                address: input.address,
                tokenAddress: input.tokenAddress,
                tokenSymbol: input.tokenSymbol,
                tokenSeries: input.tokenSeries as any,
                usdSeries: input.usdSeries as any,
                coveredFromMs: input.coveredFromMs,
                coveredToMs: input.coveredToMs,
            })
            .onConflictDoUpdate({
                target: [walletTokenBalanceHistoryCache.address, walletTokenBalanceHistoryCache.tokenAddress],
                set: {
                    tokenSymbol: input.tokenSymbol,
                    tokenSeries: input.tokenSeries as any,
                    usdSeries: input.usdSeries as any,
                    fetchedAt: new Date(),
                    coveredFromMs: input.coveredFromMs,
                    coveredToMs: input.coveredToMs,
                },
            });
    } catch (err) {
        console.error("Failed to save wallet token balance history cache", err);
    }
}
