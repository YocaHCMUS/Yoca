import {
  address,
  getPublicKeyFromAddress,
  getUtf8Encoder,
  verifySignature,
  type SignatureBytes,
} from "@solana/kit";
import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import {
  passwordUpdateSchema,
  profileIdentityUpdateSchema,
  solanaBase58Schema,
  validate,
} from "@sv/middlewares/validation.js";
import { removeAddressFromWatchlist } from "@sv/services/profile/watchlist.service.js";
import {
  addPasswordAuthMethod,
  changePassword,
  getUserSettingsSnapshot,
  updateUserIdentity,
} from "@sv/services/users.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { jwt, sign } from "hono/jwt";
import { z } from "zod";
import {
  backfillUserPaymentHistory,
  enrichPaymentHistoryWithStripeProduct,
  getUserSubscription,
  getUserPaymentHistory,
  getUserSubscriptions,
  repairPaymentHistorySubscriptionLinks,
  syncUserSubscriptionsFromStripe,
} from "@sv/services/subscription.service.js";

const jwtSecret = process.env.JWT_SECRET!;
const authCookieTtlMs = 7 * 24 * 60 * 60 * 1000;

const honoJwt = jwt({
  alg: "HS256",
  secret: process.env.JWT_SECRET!,
  cookie: AUTH_COOKIE_NAME,
});

const linkedWalletSchema = z.object({
  walletAddress: solanaBase58Schema,
  nonce: z.string().min(1),
  signature: z.base64(),
});

// const linkedWalletChallengeSchema = z.object({
//     walletAddress: solanaBase58Schema,
// });

// const linkedWalletParamSchema = z.object({
//     walletAddress: solanaBase58Schema,
// });

const solanaWalletAddressParamSchema = z.object({
  walletAddress: solanaBase58Schema,
});

const solanaTokenAddressParamSchema = z.object({
  tokenAddress: solanaBase58Schema,
});

const LINK_WALLET_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const linkWalletChallenges = new Map<
  string,
  { nonce: string; expiresAt: number }
>();
const ACCOUNT_DELETE_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const accountDeleteChallenges = new Map<
  string,
  { token: string; expiresAt: number }
>();

const PASSWORD_UPDATE_STATE = {
  changed: "PASSWORD_CHANGED",
  added: "PASSWORD_ADDED",
} as const;

function getUserIdFromPayload(
  payload: { id?: string } | undefined,
): string | null {
  return payload?.id ?? null;
}

function challengeKey(userId: string, walletAddress: string): string {
  return `${userId}:${walletAddress}`;
}

function getLinkWalletSignMessage(
  userId: string,
  walletAddress: string,
  nonce: string,
): string {
  return `Link wallet to Yoca\nUser: ${userId}\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

async function verifySolanaMessageSignature(
  walletAddress: string,
  signatureBase64: string,
  message: string,
): Promise<boolean> {
  const messageBytes = getUtf8Encoder().encode(message);
  const publicKey = await getPublicKeyFromAddress(address(walletAddress));
  const signatureBytes = new Uint8Array(
    Buffer.from(signatureBase64, "base64"),
  ) as SignatureBytes;

  return verifySignature(publicKey, signatureBytes, messageBytes);
}

const app = new Hono()
  .get("/settings", honoJwt, async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id?: string } | undefined;
      const userId = getUserIdFromPayload(payload);

      if (!userId) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }

      const snapshot = await getUserSettingsSnapshot(userId);
      return c.json(snapshot, statusCode.Ok);
    } catch (err) {
      console.error("Failed to get profile settings", err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .patch(
    "/settings/identity",
    honoJwt,
    validate("json", profileIdentityUpdateSchema),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        const userId = getUserIdFromPayload(payload);

        if (!userId) {
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );
        }

        const body = c.req.valid("json");
        const snapshot = await updateUserIdentity(userId, body);
        const token = await sign(
          {
            id: userId,
            displayName: snapshot.displayName || null,
            exp: Math.floor(Date.now() + authCookieTtlMs) / 1000,
          },
          jwtSecret,
        );
        setCookie(c, AUTH_COOKIE_NAME, token, {
          secure: true,
          httpOnly: true,
          sameSite: "None",
          maxAge: authCookieTtlMs / 1000,
        });
        return c.json(snapshot, statusCode.Ok);
      } catch (err) {
        if (err instanceof Error && err.message === "EMAIL_ALREADY_IN_USE") {
          return c.json(setErr("EMAIL_ALREADY_IN_USE"), 409);
        }

        console.error("Failed to update profile identity", err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .patch(
    "/settings/password",
    honoJwt,
    validate("json", passwordUpdateSchema),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        const userId = getUserIdFromPayload(payload);

        if (!userId) {
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );
        }

        const { currentPassword, newPassword, email } = c.req.valid("json");
        const snapshot = await getUserSettingsSnapshot(userId);
        const nextEmail = email?.trim().toLowerCase();

        if (nextEmail) {
          await updateUserIdentity(userId, { email: nextEmail });
        }

        if (snapshot.hasPassword) {
          if (!currentPassword) {
            return c.json(
              setErr("PASSWORD_AUTH_NOT_FOUND"),
              statusCode.BadRequest,
            );
          }

          await changePassword(userId, currentPassword, newPassword);
          return c.json(
            { state: PASSWORD_UPDATE_STATE.changed },
            statusCode.Ok,
          );
        } else {
          const passwordEmail =
            nextEmail ?? snapshot.email?.trim().toLowerCase();
          if (!passwordEmail) {
            return c.json(
              setErr("ACCOUNT_DELETE_FORBIDDEN"),
              statusCode.BadRequest,
            );
          }

          await addPasswordAuthMethod(userId, passwordEmail, newPassword);
          return c.json({ state: PASSWORD_UPDATE_STATE.added }, statusCode.Ok);
        }
      } catch (err) {
        if (err instanceof Error && err.message === "PASSWORD_AUTH_NOT_FOUND") {
          return c.json(
            setErr("PASSWORD_AUTH_NOT_FOUND"),
            statusCode.BadRequest,
          );
        }

        if (err instanceof Error && err.message === "PASSWORD_ALREADY_SET") {
          return c.json(setErr("PASSWORD_ALREADY_SET"), 409);
        }

        if (
          err instanceof Error &&
          err.message === "CURRENT_PASSWORD_INVALID"
        ) {
          return c.json(
            setErr("CURRENT_PASSWORD_INVALID"),
            statusCode.Unauthorized,
          );
        }

        if (err instanceof Error && err.message === "EMAIL_ALREADY_IN_USE") {
          return c.json(setErr("EMAIL_ALREADY_IN_USE"), 409);
        }

        console.error("Failed to update password", err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .get("/settings/auth-methods", honoJwt, async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id?: string } | undefined;
      const userId = getUserIdFromPayload(payload);

      if (!userId) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }

      const snapshot = await getUserSettingsSnapshot(userId);
      return c.json({ authMethods: snapshot.authMethods }, statusCode.Ok);
    } catch (err) {
      console.error("Failed to get auth methods", err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .post(
    "/settings/account/challenge",
    honoJwt,
    validate(
      "json",
      z.object({
        walletAddress: solanaBase58Schema,
      }),
    ),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        const userId = getUserIdFromPayload(payload);

        if (!userId) {
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );
        }
        const { walletAddress } = c.req.valid("json");
        await removeAddressFromWatchlist(userId, walletAddress);
        return c.json(
          { message: "Address removed from watchlist" },
          statusCode.Ok,
        );
      } catch (err) {
        console.error("Failed to remove address from watchlist", err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )
  .get("/subscriptions", honoJwt, async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id?: string } | undefined;
      const userId = getUserIdFromPayload(payload);
      if (!userId)
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);

      try {
        await syncUserSubscriptionsFromStripe(userId);
      } catch (syncErr) {
        console.warn("Failed to sync subscriptions from Stripe", syncErr);
      }

      const sub = await getUserSubscription(userId);
      return c.json(sub, statusCode.Ok);
    } catch (err) {
      console.error("Failed to get subscription", err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/subscriptions/all", honoJwt, async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id?: string } | undefined;
      const userId = getUserIdFromPayload(payload);
      if (!userId)
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);

      try {
        await syncUserSubscriptionsFromStripe(userId);
      } catch (syncErr) {
        console.warn("Failed to sync subscriptions from Stripe", syncErr);
      }

      const subs = await getUserSubscriptions(userId);
      return c.json(subs, statusCode.Ok);
    } catch (err) {
      console.error("Failed to get subscriptions", err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/payment-history", honoJwt, async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id?: string } | undefined;
      const userId = getUserIdFromPayload(payload);
      if (!userId)
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);

      try {
        await syncUserSubscriptionsFromStripe(userId);
      } catch (syncErr) {
        console.warn("Failed to sync subscriptions from Stripe", syncErr);
      }

      let history = await getUserPaymentHistory(userId);

      if (history.length === 0) {
        try {
          await backfillUserPaymentHistory(userId);
          await repairPaymentHistorySubscriptionLinks(userId);
          history = await getUserPaymentHistory(userId);
        } catch (syncErr) {
          console.warn("Failed to backfill payment history", syncErr);
        }
      } else {
        try {
          await repairPaymentHistorySubscriptionLinks(userId);
          history = await getUserPaymentHistory(userId);
        } catch (repairErr) {
          console.warn("Failed to repair payment history links", repairErr);
        }
      }

      const enrichedHistory = await enrichPaymentHistoryWithStripeProduct(
        history as any[],
      );
      return c.json(enrichedHistory, statusCode.Ok);
    } catch (err) {
      console.error("Failed to get payment history", err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  });
export default app;
