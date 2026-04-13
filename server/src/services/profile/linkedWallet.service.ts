import { db } from "@sv/db";
import { userLinkedWallets } from "@sv/db/schema";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";

export async function getUserLinkedWallets(userId: string) {
    const rows = await db
        .select({
            walletAddress: userLinkedWallets.walletAddress,
            isAuthWallet: userLinkedWallets.isAuthWallet,
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
    const [linkedWallet] = await db
        .select({
            isAuthWallet: userLinkedWallets.isAuthWallet,
        })
        .from(userLinkedWallets)
        .where(
            and(
                eq(userLinkedWallets.userId, userId),
                eq(userLinkedWallets.walletAddress, walletAddress),
            ),
        )
        .limit(1);

    if (!linkedWallet) {
        throw new Error("Link does not exist");
    }

    if (linkedWallet.isAuthWallet) {
        throw new Error("Cannot unlink authentication wallet");
    }

    return await db.delete(userLinkedWallets)
        .where(
            and(
                eq(userLinkedWallets.userId, userId),
                eq(userLinkedWallets.walletAddress, walletAddress)
            )
        );
}