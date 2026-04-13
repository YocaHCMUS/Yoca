import {
  address,
  getBase64Encoder,
  getPublicKeyFromAddress,
  getUtf8Encoder,
  verifySignature,
  type SignatureBytes,
} from "@solana/kit";

import { SOLANA_LOGIN_NOUNCE_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { authAccounts, userLinkedWallets, users } from "@sv/db/schema.js";
import { doesWalletLinked } from "@sv/services/profile/linkedWallet.service.js";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({
      user: users,
      account: authAccounts,
    })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .where(
      and(
        eq(authAccounts.provider, "password"),
        eq(authAccounts.providerUserId, email),
      ),
    )
    .limit(1);
  return user;
}

export async function createUserWithPassword(
  email: string,
  displayName: string | null,
  password: string,
) {
  let userId = "";
  await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        email,
        displayName,
      })
      .returning();
    const hashedPassword = await bcrypt.hash(password, 10);
    await tx
      .insert(authAccounts)
      .values({
        userId: newUser.id,
        provider: "password",
        providerUserId: email,
        hashedPassword,
      })
      .returning();
    userId = newUser.id;
  });
  return userId;
}

export async function verifyUserPassword(email: string, password: string) {
  const [user] = await db
    .select()
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, "password"),
        eq(authAccounts.providerUserId, email),
      ),
    )
    .limit(1);
  if (!user) return null;
  const passwordMatched = await bcrypt.compare(password, user.hashedPassword!);
  if (!passwordMatched) return null;
  return user;
}

export async function findUserByGoogleId(googleId: string) {
  const [user] = await db
    .select({
      user: users,
      account: authAccounts,
    })
    .from(authAccounts)
    .innerJoin(users, eq(authAccounts.userId, users.id))
    .where(
      and(
        eq(authAccounts.provider, "google"),
        eq(authAccounts.providerUserId, googleId),
      ),
    )
    .limit(1);
  return user;
}

export async function createUserWithGoogle(googleId: string) {
  let userId = "";
  await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({}).returning();
    await tx.insert(authAccounts).values({
      provider: "google",
      userId: newUser.id,
      providerUserId: googleId,
    });
    userId = newUser.id;
  });
  return userId;
}

export async function findUserByWalletAddress(pubKey: string) {
  const [user] = await db
    .select({
      user: users,
      account: authAccounts,
    })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .where(
      and(
        eq(authAccounts.provider, "solana"),
        eq(authAccounts.providerUserId, pubKey),
      ),
    )
    .limit(1);
  return user;
}

export async function createUserWithWallet(pubKey: string) {
  const linked = await doesWalletLinked(pubKey);
  if (linked) {
    throw new Error("WALLET_ALREADY_LINKED");
  }

  let userId = "";
  const nounce = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({}).returning();
    await tx.insert(authAccounts).values({
      provider: "solana",
      userId: newUser.id,
      providerUserId: pubKey,
      loginNounce: nounce,
      nounceExpiredAt: new Date(Date.now() + SOLANA_LOGIN_NOUNCE_TTL_MS),
    });
    userId = newUser.id;

    await tx.insert(userLinkedWallets).values({
      userId: newUser.id,
      walletAddress: pubKey,
      isAuthWallet: true,
    });
  });


  return { userId, nounce };
}

export async function updateWalletLoginNounce(userId: string) {
  const nounce = crypto.randomUUID();
  await db
    .update(authAccounts)
    .set({
      loginNounce: nounce,
      nounceExpiredAt: new Date(Date.now() + SOLANA_LOGIN_NOUNCE_TTL_MS),
    })
    .where(
      and(eq(authAccounts.provider, "solana"), eq(authAccounts.userId, userId)),
    );
  return nounce;
}

export async function verifyWalletLoginNounce(
  pubKey: string,
  signature: string,
) {
  const [user] = await db
    .select({
      user: users,
      account: authAccounts,
    })
    .from(authAccounts)
    .innerJoin(users, eq(users.id, authAccounts.userId))
    .where(
      and(
        eq(authAccounts.provider, "solana"),
        eq(authAccounts.providerUserId, pubKey),
      ),
    )
    .limit(1);

  if (!user || !user.account.loginNounce || !user.account.nounceExpiredAt) {
    return null;
  }

  const now = new Date();
  if (user.account.nounceExpiredAt < now) {
    return null;
  }

  const messageBytes = getUtf8Encoder().encode(
    getSolanaLoginMessage(user.account.loginNounce, pubKey),
  );

  const pubCryptoKey = await getPublicKeyFromAddress(address(pubKey));
  const sigBytes = getBase64Encoder().encode(signature) as SignatureBytes;
  const verified = await verifySignature(pubCryptoKey, sigBytes, messageBytes);

  if (!verified) {
    return null;
  }

  // Clear nounce
  await db
    .update(authAccounts)
    .set({
      loginNounce: null,
      nounceExpiredAt: null,
    })
    .where(
      and(
        eq(authAccounts.provider, "solana"),
        eq(authAccounts.providerUserId, pubKey),
      ),
    );

  return user;
}

export function getSolanaLoginMessage(nonce: string, address: string) {
  return `Login to Yoca\nWallet: ${address}\nNonce: ${nonce}`;
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

export async function getUserAuthMethods(userId: string) {
  const rows = await db
    .select({
      provider: authAccounts.provider,
    })
    .from(authAccounts)
    .where(eq(authAccounts.userId, userId));

  return [...new Set(rows.map((row) => row.provider))];
}

export async function getUserSettingsSnapshot(userId: string) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("ACCOUNT_DELETE_FORBIDDEN");
  }

  const authMethods = await getUserAuthMethods(userId);
  const linkedWallets = await db
    .select({
      walletAddress: userLinkedWallets.walletAddress,
      isAuthWallet: userLinkedWallets.isAuthWallet,
    })
    .from(userLinkedWallets)
    .where(eq(userLinkedWallets.userId, userId));

  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    authMethods,
    hasPassword: authMethods.includes("password"),
    linkedWallets,
  };
}

export async function updateUserIdentity(
  userId: string,
  input: { displayName?: string | null; email?: string | null },
) {
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw new Error("ACCOUNT_DELETE_FORBIDDEN");
  }

  const nextDisplayName = input.displayName;
  const nextEmail = input.email;

  if (nextEmail !== undefined && nextEmail !== null) {
    const [emailOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, nextEmail), ne(users.id, userId)))
      .limit(1);

    if (emailOwner) {
      throw new Error("EMAIL_ALREADY_IN_USE");
    }
  }

  await db.transaction(async (tx) => {
    const updateData: Partial<typeof users.$inferInsert> = {};
    if (nextDisplayName !== undefined) {
      updateData.displayName = nextDisplayName;
    }
    if (nextEmail !== undefined) {
      updateData.email = nextEmail;
    }

    if (Object.keys(updateData).length > 0) {
      await tx.update(users).set(updateData).where(eq(users.id, userId));
    }

    const emailChanged =
      nextEmail !== undefined &&
      nextEmail !== null &&
      nextEmail !== existingUser.email;

    if (!emailChanged) {
      return;
    }

    const [passwordAuth] = await tx
      .select({ providerUserId: authAccounts.providerUserId })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, userId),
          eq(authAccounts.provider, "password"),
        ),
      )
      .limit(1);

    if (!passwordAuth) {
      return;
    }

    await tx
      .update(authAccounts)
      .set({ providerUserId: nextEmail })
      .where(
        and(
          eq(authAccounts.userId, userId),
          eq(authAccounts.provider, "password"),
        ),
      );
  });

  return getUserSettingsSnapshot(userId);
}

export async function addPasswordAuthMethod(
  userId: string,
  email: string,
  newPassword: string,
) {
  const [existingPassword] = await db
    .select({ provider: authAccounts.provider })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.provider, "password")),
    )
    .limit(1);

  if (existingPassword) {
    throw new Error("PASSWORD_ALREADY_SET");
  }

  const [emailOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, userId)))
    .limit(1);

  if (emailOwner) {
    throw new Error("EMAIL_ALREADY_IN_USE");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ email })
      .where(eq(users.id, userId));

    await tx.insert(authAccounts).values({
      userId,
      provider: "password",
      providerUserId: email,
      hashedPassword,
    });
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const [passwordAuth] = await db
    .select({
      hashedPassword: authAccounts.hashedPassword,
    })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.provider, "password")),
    )
    .limit(1);

  if (!passwordAuth || !passwordAuth.hashedPassword) {
    throw new Error("PASSWORD_AUTH_NOT_FOUND");
  }

  const matched = await bcrypt.compare(currentPassword, passwordAuth.hashedPassword);
  if (!matched) {
    throw new Error("CURRENT_PASSWORD_INVALID");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db
    .update(authAccounts)
    .set({ hashedPassword })
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.provider, "password")),
    );
}

export async function deleteUserAccount(userId: string) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("ACCOUNT_DELETE_FORBIDDEN");
  }

  await db.delete(users).where(eq(users.id, userId));
}
