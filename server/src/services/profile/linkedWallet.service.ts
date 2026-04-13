import { db } from "@sv/db";
import { userLinkedWallets } from "@sv/db/schema";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";

export async function getUserLinkedWallets(userId: string) {
    const rows = await db
        .select({
            walletAddress: userLinkedWallets.walletAddress,
        })
        .from(userLinkedWallets)
        .where(eq(userLinkedWallets.userId, userId));

    return {
        userId,
        rows,
    };
}

export async function doesWalletLinked(walletAddress: string) {
    const rows = await db.select()
        .from(userLinkedWallets)
        .where(eq(userLinkedWallets.walletAddress, walletAddress));

    return rows.length > 0;
}

export async function linkWalletToUser(userId: string, walletAddress: string) {
    if (await doesWalletLinked(walletAddress)) {
        throw new Error("Wallet is already linked to a user");
    }

    return await db.insert(userLinkedWallets).values({
        userId,
        walletAddress,
    });
}

export async function unlinkWalletFromUser(userId: string, walletAddress: string) {
    if (!await doesWalletLinked(walletAddress)) {
        throw new Error("Link does not exist");
    }

    return await db.delete(userLinkedWallets)
        .where(
            and(
                eq(userLinkedWallets.userId, userId),
                eq(userLinkedWallets.walletAddress, walletAddress)
            )
        );
}