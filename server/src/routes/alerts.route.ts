import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { solanaBase58Schema, validate } from "@sv/middlewares/validation.js";
import {
  addFollowedWallet,
  getUserDiscordUrl,
  isUniqueViolation,
  listFollowedWallets,
  removeFollowedWallet,
  setUserDiscordUrl,
  syncHeliusWebhookAccountAddresses,
} from "@sv/services/followedWallets.service.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { z } from "zod";

const honoJwt = jwt({
  alg: "HS256",
  secret: process.env.JWT_SECRET!,
  cookie: AUTH_COOKIE_NAME,
});

const followWalletBodySchema = z.object({
  address: solanaBase58Schema,
  label: z.string().trim().max(120).optional().nullable(),
});

const discordSettingsSchema = z.object({
  discordWebhookUrl: z
    .string()
    .trim()
    .url()
    .refine((v) => v.includes("discord.com/api/webhooks/"), {
      message: "Must be a Discord webhook URL",
    })
    .nullable(),
});

const app = new Hono()
  // ── Wallet CRUD (auth-guarded) ───────────────────────────────
  .get("/", honoJwt, async (c) => {
    const { id: userId } = c.get("jwtPayload") as { id: string };
    try {
      const rows = await listFollowedWallets(userId);
      return c.json(rows, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET failed:", err);
      return c.json({ error: "Failed to load followed wallets" }, 500);
    }
  })
  .post("/", honoJwt, validate("json", followWalletBodySchema), async (c) => {
    const { id: userId } = c.get("jwtPayload") as { id: string };
    const { address, label } = c.req.valid("json");
    try {
      const wallet = await addFollowedWallet(userId, address, label ?? undefined);
      const heliusSync = await syncHeliusWebhookAccountAddresses();
      return c.json({ wallet, heliusSync }, statusCode.Created);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json(
          { error: "This wallet address is already being followed" },
          409,
        );
      }
      console.error("[alerts] POST failed:", err);
      return c.json({ error: "Failed to follow wallet" }, 500);
    }
  })
  .delete("/:id", honoJwt, async (c) => {
    const { id: userId } = c.get("jwtPayload") as { id: string };
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Invalid wallet ID" }, 400);
    }
    try {
      const deleted = await removeFollowedWallet(id, userId);
      if (!deleted) {
        return c.json({ error: "Wallet not found" }, 404);
      }
      const heliusSync = await syncHeliusWebhookAccountAddresses();
      return c.json({ deleted: true, heliusSync }, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] DELETE failed:", err);
      return c.json({ error: "Failed to remove wallet" }, 500);
    }
  })
  // ── User Discord settings (auth-guarded) ─────────────────────
  .get("/settings", honoJwt, async (c) => {
    const { id: userId } = c.get("jwtPayload") as { id: string };
    try {
      const discordWebhookUrl = await getUserDiscordUrl(userId);
      return c.json({ discordWebhookUrl }, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET settings failed:", err);
      return c.json({ error: "Failed to load settings" }, 500);
    }
  })
  .patch(
    "/settings",
    honoJwt,
    validate("json", discordSettingsSchema),
    async (c) => {
      const { id: userId } = c.get("jwtPayload") as { id: string };
      const { discordWebhookUrl } = c.req.valid("json");
      try {
        await setUserDiscordUrl(userId, discordWebhookUrl);
        return c.json({ discordWebhookUrl }, statusCode.Ok);
      } catch (err) {
        console.error("[alerts] PATCH settings failed:", err);
        return c.json({ error: "Failed to save settings" }, 500);
      }
    },
  );

export default app;
