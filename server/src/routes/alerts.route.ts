import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { solanaBase58Schema, validate } from "@sv/middlewares/validation.js";
import {
  addFollowedWallet,
  getUserAlertSettings,
  isUniqueViolation,
  listFollowedWallets,
  removeFollowedWallet,
  setUserDiscordUrl,
  setUserEmailAlertSettings,
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

const settingsPatchSchema = z
  .object({
    discordWebhookUrl: z
      .string()
      .trim()
      .url()
      .refine((v) => v.includes("discord.com/api/webhooks/"), {
        message: "Must be a Discord webhook URL",
      })
      .nullable()
      .optional(),
    emailAlertsEnabled: z.boolean().optional(),
    emailAlertsAddress: z
      .string()
      .trim()
      .email()
      .nullable()
      .optional(),
  })
  .refine(
    (v) =>
      v.discordWebhookUrl !== undefined ||
      v.emailAlertsEnabled !== undefined ||
      v.emailAlertsAddress !== undefined,
    { message: "At least one field must be provided" },
  );

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
  // ── User notification settings (auth-guarded) ────────────────
  .get("/settings", honoJwt, async (c) => {
    const { id: userId } = c.get("jwtPayload") as { id: string };
    try {
      const settings = await getUserAlertSettings(userId);
      if (!settings) {
        return c.json({ error: "User not found" }, 404);
      }
      return c.json(settings, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET settings failed:", err);
      return c.json({ error: "Failed to load settings" }, 500);
    }
  })
  .patch(
    "/settings",
    honoJwt,
    validate("json", settingsPatchSchema),
    async (c) => {
      const { id: userId } = c.get("jwtPayload") as { id: string };
      const body = c.req.valid("json");
      try {
        if (body.discordWebhookUrl !== undefined) {
          await setUserDiscordUrl(userId, body.discordWebhookUrl);
        }
        if (
          body.emailAlertsEnabled !== undefined ||
          body.emailAlertsAddress !== undefined
        ) {
          const current = await getUserAlertSettings(userId);
          await setUserEmailAlertSettings(userId, {
            emailAlertsEnabled:
              body.emailAlertsEnabled ??
              current?.emailAlertsEnabled ??
              false,
            emailAlertsAddress:
              body.emailAlertsAddress !== undefined
                ? body.emailAlertsAddress
                : current?.emailAlertsAddress ?? null,
          });
        }
        const updated = await getUserAlertSettings(userId);
        return c.json(updated, statusCode.Ok);
      } catch (err) {
        console.error("[alerts] PATCH settings failed:", err);
        return c.json({ error: "Failed to save settings" }, 500);
      }
    },
  );

export default app;
