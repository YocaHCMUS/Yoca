import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { setErr } from "@sv/config/errors.js";
import {
    solanaBase58Schema,
    validate,
} from "@sv/middlewares/validation.js";
import {
    getUserLinkedWallets,
    linkWalletToUser,
    unlinkWalletFromUser,
} from "@sv/services/profile/linkedWallet.service.js";
import { statusCode } from "@sv/util/responses.js";
import {
    address,
    getPublicKeyFromAddress,
    getUtf8Encoder,
    verifySignature,
    type SignatureBytes,
} from "@solana/kit";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { z } from "zod";
import type { HonoJsonWebKey } from "hono/utils/jwt/jws";

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

const linkedWalletChallengeSchema = z.object({
    walletAddress: solanaBase58Schema,
});

const linkedWalletParamSchema = z.object({
    walletAddress: solanaBase58Schema,
});

const LINK_WALLET_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const linkWalletChallenges = new Map<string, { nonce: string; expiresAt: number }>();

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
    .get("/linked-wallets", honoJwt, async (c) => {
        try {
            const payload = c.get("jwtPayload") as { id?: string } | undefined;
            const userId = payload?.id;

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
        validate("json", linkedWalletChallengeSchema),
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
                const userId = payload?.id;

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
        validate("json", linkedWalletParamSchema),
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

                await unlinkWalletFromUser(userId, walletAddress);

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
    );

export default app;
