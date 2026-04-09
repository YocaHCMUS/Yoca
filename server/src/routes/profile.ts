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
});

const linkedWalletParamSchema = z.object({
    walletAddress: solanaBase58Schema,
});

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

                const { walletAddress } = c.req.valid("json");

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
