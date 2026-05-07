import { db } from "@sv/db";
import { userTokenWatchlist, userWalletWatchlist } from "@sv/db/schema";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";


export async function getTokenWatchlist(userId: string) {
    const rows = await db
        .select({
            tokenId: userTokenWatchlist.tokenAddress,
        })
        .from(userTokenWatchlist)
        .where(eq(userTokenWatchlist.userId, userId));

    return {
        userId,
        rows,
    };
}

export async function getAddressWatchlist(userId: string) {
    const rows = await db
        .select({
            address: userWalletWatchlist.walletAddress,
        })
        .from(userWalletWatchlist)
        .where(
            eq(userWalletWatchlist.userId, userId)
        );
    return {
        userId,
        rows,
    };
}

export async function isTokenInWatchlist(userId: string, tokenAddress: string) {
    const rows = await db
        .select()
        .from(userTokenWatchlist)
        .where(
            and(
                eq(userTokenWatchlist.userId, userId),
                eq(userTokenWatchlist.tokenAddress, tokenAddress),
            )
        );
    return rows.length > 0;
}

export async function isAddressInWatchlist(userId: string, walletAddress: string) {
    const rows = await db
        .select()
        .from(userWalletWatchlist)
        .where(
            and(
                eq(userWalletWatchlist.userId, userId),
                eq(userWalletWatchlist.walletAddress, walletAddress),
            )
        );
    return rows.length > 0;
}


export async function addTokenToWatchlist(userId: string, tokenAddress: string) {
    if (await isTokenInWatchlist(userId, tokenAddress)) {
        return;
    }

    return await db.insert(userTokenWatchlist).values({
        userId,
        tokenAddress,
    });
}

export async function removeTokenFromWatchlist(userId: string, tokenAddress: string) {
    if (!await isTokenInWatchlist(userId, tokenAddress)) {
        return;
    }

    return await db.delete(userTokenWatchlist)
        .where(
            and(
                eq(userTokenWatchlist.userId, userId),
                eq(userTokenWatchlist.tokenAddress, tokenAddress),
            ),
        );
}

export async function addAddressToWatchlist(userId: string, walletAddress: string) {
    if (await isAddressInWatchlist(userId, walletAddress)) {
        return;
    }

    return await db.insert(userWalletWatchlist).values({
        userId,
        walletAddress,
    });
}

export async function removeAddressFromWatchlist(userId: string, walletAddress: string) {
    if (!await isAddressInWatchlist(userId, walletAddress)) {
        return;
    }

    return await db.delete(userWalletWatchlist)
        .where(
            and(
                eq(userWalletWatchlist.userId, userId),
                eq(userWalletWatchlist.walletAddress, walletAddress),
            ),
        );
}