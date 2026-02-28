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
import { authAccounts, users } from "@sv/db/schema.js";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { verifyMessage } from "ethers";

const toEthereumProviderUserId = (address: string) =>
  `ethereum:${address.toLowerCase()}`;

export async function findUserByEmail(email: string) {
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
    .select()
    .from(authAccounts)
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
    .select()
    .from(authAccounts)
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
  let userId = "";
  let nounce = crypto.randomUUID();
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
  });
  return { userId, nounce };
}

export async function updateWalletLoginNounce(userId: string) {
  let nounce = crypto.randomUUID();
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

export async function findUserByEthereumAddress(address: string) {
  const [user] = await db
    .select()
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, "other"),
        eq(authAccounts.providerUserId, toEthereumProviderUserId(address)),
      ),
    )
    .limit(1);
  return user;
}

export async function createUserWithEthereumWallet(address: string) {
  let userId = "";
  const nounce = crypto.randomUUID();
  await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({}).returning();
    await tx.insert(authAccounts).values({
      provider: "other",
      userId: newUser.id,
      providerUserId: toEthereumProviderUserId(address),
      loginNounce: nounce,
      nounceExpiredAt: new Date(Date.now() + SOLANA_LOGIN_NOUNCE_TTL_MS),
    });
    userId = newUser.id;
  });
  return { userId, nounce };
}

export async function updateEthereumWalletLoginNounce(userId: string) {
  const nounce = crypto.randomUUID();
  await db
    .update(authAccounts)
    .set({
      loginNounce: nounce,
      nounceExpiredAt: new Date(Date.now() + SOLANA_LOGIN_NOUNCE_TTL_MS),
    })
    .where(
      and(eq(authAccounts.provider, "other"), eq(authAccounts.userId, userId)),
    );
  return nounce;
}

export async function verifyWalletLoginNounce(
  pubKey: string,
  signature: string,
) {
  const [account] = await db
    .select()
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, "solana"),
        eq(authAccounts.providerUserId, pubKey),
      ),
    )
    .limit(1);

  if (!account || !account.loginNounce || !account.nounceExpiredAt) {
    return null;
  }

  const now = new Date();
  if (account.nounceExpiredAt < now) {
    return null;
  }

  const messageBytes = getUtf8Encoder().encode(
    getSolanaLoginMessage(account.loginNounce, pubKey),
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

  return account;
}

export async function verifyEthereumWalletLoginNounce(
  address: string,
  signature: string,
) {
  const providerUserId = toEthereumProviderUserId(address);
  const [account] = await db
    .select()
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.provider, "other"),
        eq(authAccounts.providerUserId, providerUserId),
      ),
    )
    .limit(1);

  if (!account || !account.loginNounce || !account.nounceExpiredAt) {
    return null;
  }

  const now = new Date();
  if (account.nounceExpiredAt < now) {
    return null;
  }

  const message = getEthereumLoginMessage(
    account.loginNounce,
    address.toLowerCase(),
  );
  const recoveredAddress = verifyMessage(message, signature);

  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    return null;
  }

  await db
    .update(authAccounts)
    .set({
      loginNounce: null,
      nounceExpiredAt: null,
    })
    .where(
      and(
        eq(authAccounts.provider, "other"),
        eq(authAccounts.providerUserId, providerUserId),
      ),
    );

  return account;
}

export function getSolanaLoginMessage(nonce: string, address: string) {
  return `Login to Yoca\nWallet: ${address}\nNonce: ${nonce}`;
}

export function getEthereumLoginMessage(nonce: string, address: string) {
  return `Login to Yoca\nWallet: ${address}\nNonce: ${nonce}`;
}
