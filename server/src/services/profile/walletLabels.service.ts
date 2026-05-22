import { db } from "@sv/db";
import { userWalletLabels } from "@sv/db/schema";
import { and, eq } from "drizzle-orm/sql/expressions/conditions";

export async function getUserWalletLabels(userId: string) {
  const rows = await db
    .select({
      walletAddress: userWalletLabels.walletAddress,
      label: userWalletLabels.label,
    })
    .from(userWalletLabels)
    .where(eq(userWalletLabels.userId, userId));

  return rows.reduce(
    (acc, row) => {
      acc[row.walletAddress] = row.label;
      return acc;
    },
    {} as Record<string, string>,
  );
}

export async function setUserWalletLabel(
  userId: string,
  walletAddress: string,
  label: string,
) {
  const trimmed = label.trim();
  if (!trimmed) {
    return await deleteUserWalletLabel(userId, walletAddress);
  }

  await db
    .insert(userWalletLabels)
    .values({
      userId,
      walletAddress,
      label: trimmed,
    })
    .onConflictDoUpdate({
      target: [userWalletLabels.userId, userWalletLabels.walletAddress],
      set: { label: trimmed },
    });
}

export async function deleteUserWalletLabel(
  userId: string,
  walletAddress: string,
) {
  await db
    .delete(userWalletLabels)
    .where(
      and(
        eq(userWalletLabels.userId, userId),
        eq(userWalletLabels.walletAddress, walletAddress),
      ),
    );
}
