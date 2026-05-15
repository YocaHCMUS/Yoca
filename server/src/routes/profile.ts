import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { setErr } from "@sv/config/errors.js";
import {
    deleteAccountSchema,
    passwordUpdateSchema,
    profileIdentityUpdateSchema,
    solanaBase58Schema,
    validate,
} from "@sv/middlewares/validation.js";
import {
    getUserLinkedWallets,
    linkWalletToUser,
    unlinkWalletFromUser,
} from "@sv/services/profile/linkedWallet.service.js";
import {
    addPasswordAuthMethod,
    changePassword,
    deleteUserAccount,
    getUserSettingsSnapshot,
    updateUserIdentity,
} from "@sv/services/users.js";
import { statusCode } from "@sv/util/responses.js";
import {
    address,
    getPublicKeyFromAddress,
    getUtf8Encoder,
    verifySignature,
    type SignatureBytes,
} from "@solana/kit";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { jwt, sign } from "hono/jwt";
import { z } from "zod";
import { addAddressToWatchlist, addTokenToWatchlist, getAddressWatchlist, getTokenWatchlist, isAddressInWatchlist, isTokenInWatchlist, removeAddressFromWatchlist, removeTokenFromWatchlist } from "@sv/services/profile/watchlist.service.js";
import { backfillUserPaymentHistory, enrichPaymentHistoryWithStripeProduct, getUserSubscription, getUserPaymentHistory, getUserSubscriptions, repairPaymentHistorySubscriptionLinks, syncUserSubscriptionsFromStripe } from "@sv/services/subscription.service.js";

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
const linkWalletChallenges = new Map<string, { nonce: string; expiresAt: number }>();
const ACCOUNT_DELETE_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const accountDeleteChallenges = new Map<string, { token: string; expiresAt: number }>();

const PASSWORD_UPDATE_STATE = {
    changed: "PASSWORD_CHANGED",
    added: "PASSWORD_ADDED",
} as const;

function getUserIdFromPayload(payload: { id?: string } | undefined): string | null {
    return payload?.id ?? null;
}

function challengeKey(userId: string, walletAddress: string): string {
    return `${userId}:${walletAddress}`;
}

function getLinkWalletSignMessage(userId: string, walletAddress: string, nonce: string): string {
    return `Link wallet to Yoca\nUser: ${userId}\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

async function verifySolanaMessageSignature(
    walletAddress: string,
    signatureBase64: string,
    message: string,
): Promise<boolean> {
    const messageBytes = getUtf8Encoder().encode(message);
    const publicKey = await getPublicKeyFromAddress(address(walletAddress));
    const signatureBytes = new Uint8Array(Buffer.from(signatureBase64, "base64")) as SignatureBytes;

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
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
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
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
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
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
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
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }

                const { currentPassword, newPassword, email } = c.req.valid("json");
                const snapshot = await getUserSettingsSnapshot(userId);
                const nextEmail = email?.trim().toLowerCase();

                if (nextEmail) {
                    await updateUserIdentity(userId, { email: nextEmail });
                }

                if (snapshot.hasPassword) {
                    if (!currentPassword) {
                        return c.json(setErr("PASSWORD_AUTH_NOT_FOUND"), statusCode.BadRequest);
                    }

                    await changePassword(userId, currentPassword, newPassword);
                    return c.json({ state: PASSWORD_UPDATE_STATE.changed }, statusCode.Ok);
                } else {
                    const passwordEmail = nextEmail ?? snapshot.email?.trim().toLowerCase();
                    if (!passwordEmail) {
                        return c.json(setErr("ACCOUNT_DELETE_FORBIDDEN"), statusCode.BadRequest);
                    }

                    await addPasswordAuthMethod(userId, passwordEmail, newPassword);
                    return c.json({ state: PASSWORD_UPDATE_STATE.added }, statusCode.Ok);
                }
            } catch (err) {
                if (err instanceof Error && err.message === "PASSWORD_AUTH_NOT_FOUND") {
                    return c.json(setErr("PASSWORD_AUTH_NOT_FOUND"), statusCode.BadRequest);
                }

                if (err instanceof Error && err.message === "PASSWORD_ALREADY_SET") {
                    return c.json(setErr("PASSWORD_ALREADY_SET"), 409);
                }

                if (err instanceof Error && err.message === "CURRENT_PASSWORD_INVALID") {
                    return c.json(setErr("CURRENT_PASSWORD_INVALID"), statusCode.Unauthorized);
                }

                if (err instanceof Error && err.message === "EMAIL_ALREADY_IN_USE") {
                    return c.json(setErr("EMAIL_ALREADY_IN_USE"), 409);
                }

                console.error("Failed to update password", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
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
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .post("/settings/account/challenge", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);

            if (!userId) {
                return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
            }

            const token = crypto.randomUUID();
            accountDeleteChallenges.set(userId, {
                token,
                expiresAt: Date.now() + ACCOUNT_DELETE_CHALLENGE_TTL_MS,
            });

            return c.json({ challengeToken: token }, statusCode.Ok);
        } catch (err) {
            console.error("Failed to create account deletion challenge", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .delete(
        "/settings/account",
        honoJwt,
        validate("json", deleteAccountSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }

                const { confirmText, challengeToken } = c.req.valid("json");
                const challenge = accountDeleteChallenges.get(userId);
                const challengeValid = Boolean(
                    challengeToken &&
                    challenge &&
                    challenge.token === challengeToken &&
                    challenge.expiresAt >= Date.now(),
                );

                if (!challengeValid) {
                    return c.json(setErr("ACCOUNT_DELETE_FORBIDDEN"), 403);
                }

                if (confirmText !== "DELETE MY ACCOUNT") {
                    return c.json(
                        setErr("ACCOUNT_DELETE_CONFIRM_MISMATCH"),
                        statusCode.BadRequest,
                    );
                }

                await deleteUserAccount(userId);
                accountDeleteChallenges.delete(userId);
                deleteCookie(c, AUTH_COOKIE_NAME);

                return c.json({ message: "Account deleted successfully" }, statusCode.Ok);
            } catch (err) {
                if (err instanceof Error && err.message === "ACCOUNT_DELETE_FORBIDDEN") {
                    return c.json(setErr("ACCOUNT_DELETE_FORBIDDEN"), 403);
                }

                console.error("Failed to delete account", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        },
    )
    .get("/linked-wallets", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);

            if (!userId) {
                return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
            }

            const linkedWallets = await getUserLinkedWallets(userId);
            return c.json(linkedWallets, statusCode.Ok);
        } catch (err) {
            console.error("Failed to get linked wallets", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .post(
        "/linked-wallets/challenge",
        honoJwt,
        validate("json", solanaWalletAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = payload?.id;

                if (!userId) {
                    return c.json(
                        setErr("INVALID_TOKEN_PAYLOAD"),
                        statusCode.Unauthorized,
                    );
                }

                const { walletAddress } = c.req.valid("json");
                const nonce = crypto.randomUUID();
                const expiresAt = Date.now() + LINK_WALLET_CHALLENGE_TTL_MS;

                linkWalletChallenges.set(challengeKey(userId, walletAddress), {
                    nonce,
                    expiresAt,
                });

                return c.json(
                    {
                        walletAddress,
                        nonce,
                        signMessage: getLinkWalletSignMessage(userId, walletAddress, nonce),
                        expiresAt,
                    },
                    statusCode.Ok,
                );
            } catch (err) {
                console.error("Failed to generate wallet link challenge", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        },
    )
    .post(
        "/linked-wallets",
        honoJwt,
        validate("json", linkedWalletSchema),
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

                const { walletAddress, nonce, signature } = c.req.valid("json");

                const key = challengeKey(userId, walletAddress);
                const challenge = linkWalletChallenges.get(key);

                if (!challenge || challenge.nonce !== nonce || Date.now() > challenge.expiresAt) {
                    linkWalletChallenges.delete(key);
                    return c.json(
                        { error: "Invalid or expired wallet link challenge" },
                        statusCode.Unauthorized,
                    );
                }

                const verified = await verifySolanaMessageSignature(
                    walletAddress,
                    signature,
                    getLinkWalletSignMessage(userId, walletAddress, nonce),
                );

                if (!verified) {
                    return c.json(
                        { error: "Wallet signature verification failed" },
                        statusCode.Unauthorized,
                    );
                }

                linkWalletChallenges.delete(key);

                try {
                    await linkWalletToUser(userId, walletAddress);
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message === "Wallet already linked to user"
                    ) {
                        return c.json(
                            { error: "Wallet already linked to user" },
                            409,
                        );
                    }

                    throw error;
                }

                return c.json(
                    {
                        message: "Wallet linked successfully",
                        walletAddress,
                    },
                    statusCode.Created,
                );
            } catch (err) {
                console.error("Failed to link wallet", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        },
    )
    .delete(
        "/linked-wallets",
        honoJwt,
        validate("json", solanaWalletAddressParamSchema),
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

                try {
                    await unlinkWalletFromUser(userId, walletAddress);
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message === "Cannot unlink authentication wallet"
                    ) {
                        return c.json(
                            { error: "Cannot unlink wallet used for authentication" },
                            409,
                        );
                    }

                    if (
                        error instanceof Error &&
                        error.message === "Link does not exist"
                    ) {
                        return c.json(
                            { error: "Wallet link does not exist" },
                            404,
                        );
                    }

                    throw error;
                }

                return c.json(
                    {
                        message: "Wallet unlinked successfully",
                        walletAddress,
                    },
                    statusCode.Ok,
                );
            } catch (err) {
                console.error("Failed to unlink wallet", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        },
    )
    .get("/watchlist/addresses", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);

            if (!userId) {
                return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
            }
            const watchlist = await getAddressWatchlist(userId);
            return c.json(watchlist, statusCode.Ok);
        } catch (err) {
            console.error("Failed to get address watchlist", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .get("/watchlist/tokens", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);

            if (!userId) {
                return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
            }
            const watchlist = await getTokenWatchlist(userId);
            return c.json(watchlist, statusCode.Ok);
        } catch (err) {
            console.error("Failed to get token watchlist", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .get(
        "/watchlist/addresses-check",
        honoJwt,
        validate("json", solanaWalletAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }

                const { walletAddress } = c.req.valid("json");
                const isInWatchlist = await isAddressInWatchlist(userId, walletAddress);
                return c.json({ isInWatchlist }, statusCode.Ok);
            } catch (err) {
                console.error("Failed to check address in watchlist", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        })
    .get(
        "/watchlist/tokens-check",
        honoJwt,
        validate("json", solanaTokenAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }
                const { tokenAddress } = c.req.valid("json");
                const isInWatchlist = await isTokenInWatchlist(userId, tokenAddress);
                return c.json({ isInWatchlist }, statusCode.Ok);
            }
            catch (err) {
                console.error("Failed to check token in watchlist", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        })
    .post(
        "/watchlist/tokens-update",
        honoJwt,
        validate("json", solanaTokenAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }
                const { tokenAddress } = c.req.valid("json");
                await addTokenToWatchlist(userId, tokenAddress);
                return c.json({ message: "Token added to watchlist" }, statusCode.Created);
            } catch (err) {
                console.error("Failed to add token to watchlist", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        })
    .delete(
        "/watchlist/tokens-update",
        honoJwt,
        validate("json", solanaTokenAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }
                const { tokenAddress } = c.req.valid("json");
                await removeTokenFromWatchlist(userId, tokenAddress);
                return c.json({ message: "Token removed from watchlist" }, statusCode.Ok);
            } catch (err) {
                console.error("Failed to remove token from watchlist", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        })
    .post(
        "/watchlist/addresses-update",
        honoJwt,
        validate("json", solanaWalletAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }
                const { walletAddress } = c.req.valid("json");
                await addAddressToWatchlist(userId, walletAddress);
                return c.json({ message: "Address added to watchlist" }, statusCode.Created);
            } catch (err) {
                console.error("Failed to add address to watchlist", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        })
    .delete(
        "/watchlist/addresses-update",
        honoJwt,
        validate("json", solanaWalletAddressParamSchema),
        async (c) => {
            try {
                const payload = c.get("jwtPayload") as { id?: string } | undefined;
                const userId = getUserIdFromPayload(payload);

                if (!userId) {
                    return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
                }
                const { walletAddress } = c.req.valid("json");
                await removeAddressFromWatchlist(userId, walletAddress);
                return c.json({ message: "Address removed from watchlist" }, statusCode.Ok);
            } catch (err) {
                console.error("Failed to remove address from watchlist", err);
                return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
            }
        })
    .get("/subscriptions", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);
            if (!userId) return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);

            try {
                await syncUserSubscriptionsFromStripe(userId);
            } catch (syncErr) {
                console.warn("Failed to sync subscriptions from Stripe", syncErr);
            }

            const sub = await getUserSubscription(userId);
            return c.json(sub, statusCode.Ok);
        } catch (err) {
            console.error("Failed to get subscription", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .get("/subscriptions/all", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);
            if (!userId) return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);

            try {
                await syncUserSubscriptionsFromStripe(userId);
            } catch (syncErr) {
                console.warn("Failed to sync subscriptions from Stripe", syncErr);
            }

            const subs = await getUserSubscriptions(userId);
            return c.json(subs, statusCode.Ok);
        } catch (err) {
            console.error("Failed to get subscriptions", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    .get("/payment-history", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = getUserIdFromPayload(payload);
            if (!userId) return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);

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

            const enrichedHistory = await enrichPaymentHistoryWithStripeProduct(history as any[]);
            return c.json(enrichedHistory, statusCode.Ok);
        } catch (err) {
            console.error("Failed to get payment history", err);
            return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
        }
    })
    ;
export default app;
