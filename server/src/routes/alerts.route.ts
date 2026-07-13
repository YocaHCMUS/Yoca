import userExtract from "@sv/middlewares/user-extract.js";
import {
  honoJwt,
  solanaBase58Schema,
  validate,
} from "@sv/middlewares/validation.js";
import {
  createAlertRule,
  deleteAlertRule,
  listActiveAlertRules,
} from "@sv/services/alertRules.service.js";
import {
  listAlertHistory,
  markAllAlertHistoryRead,
  setAlertHistoryReadState,
} from "@sv/services/alertHistory.service.js";
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
import { getHeliusWebhookDiagnostics } from "@sv/services/heliusWebhooks.service.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { z } from "zod";

const followWalletBodySchema = z.object({
  address: solanaBase58Schema,
  label: z.string().trim().max(120).optional().nullable(),
});

const alertHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const alertHistoryReadSchema = z.object({
  read: z.boolean(),
});

const settingsPatchSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const input = raw as Record<string, unknown>;
    return {
      ...input,
      discordWebhookUrl:
        input.discordWebhookUrl ?? input.discord_webhook_url,
      emailAlertsEnabled:
        input.emailAlertsEnabled ?? input.email_alerts_enabled,
      emailAlertsAddress:
        input.emailAlertsAddress ?? input.email_alerts_address,
    };
  },
  z
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
      emailAlertsAddress: z.string().trim().email().nullable().optional(),
    })
    .refine(
      (v) =>
        v.discordWebhookUrl !== undefined ||
        v.emailAlertsEnabled !== undefined ||
        v.emailAlertsAddress !== undefined,
      { message: "At least one field must be provided" },
    ),
);

const alertRuleBodySchema = z
  .object({
    name: z.string().trim().max(200).optional().nullable(),
    walletAddress: solanaBase58Schema,
    actionType: z.enum(["SWAP", "TRANSFER", "ALL"]),
    minVolume: z.number().positive(),
    maxVolume: z.number().positive().optional().nullable(),
    volumeUnit: z.enum(["USD", "SOL"]),
    triggerType: z.enum(["ONCE", "ALWAYS"]),
    expiryDate: z.string(),
    useDefaultDelivery: z.boolean(),
    discordWebhookOverride: z.string().trim().optional().nullable(),
    emailOverride: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const exp = new Date(data.expiryDate);
    if (Number.isNaN(+exp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid expiryDate",
        path: ["expiryDate"],
      });
      return;
    }
    if (exp <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiryDate must be in the future",
        path: ["expiryDate"],
      });
    }
    if (data.maxVolume != null && data.maxVolume < data.minVolume) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxVolume must be >= minVolume",
        path: ["maxVolume"],
      });
    }
    if (!data.useDefaultDelivery) {
      const discordOk = !!data.discordWebhookOverride?.includes(
        "discord.com/api/webhooks/",
      );
      const emailOk =
        !!data.emailOverride?.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailOverride.trim());
      if (!discordOk && !emailOk) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "When not using default delivery, set a Discord webhook URL and/or email override",
          path: ["useDefaultDelivery"],
        });
      }
    }
    if (
      data.discordWebhookOverride &&
      !data.discordWebhookOverride.includes("discord.com/api/webhooks/")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a Discord webhook URL",
        path: ["discordWebhookOverride"],
      });
    }
    if (
      data.emailOverride?.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailOverride.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid email",
        path: ["emailOverride"],
      });
    }
  });

async function runHeliusAlertSync() {
  try {
    return await syncHeliusWebhookAccountAddresses();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[alerts] Helius sync failed after alert mutation:", err);
    return { ok: false as const, error };
  }
}

const app = new Hono()
  .get(
    "/history",
    honoJwt,
    userExtract,
    validate("query", alertHistoryQuerySchema),
    async (c) => {
      const { id: userId } = c.get("userPayload");
      const { page, limit } = c.req.valid("query");
      try {
        return c.json(
          await listAlertHistory(userId, page, limit),
          statusCode.Ok,
        );
      } catch (err) {
        console.error("[alerts] GET /history failed:", err);
        return c.json({ error: "Failed to load alert history" }, 500);
      }
    },
  )
  .patch(
    "/history/:historyId/read",
    honoJwt,
    userExtract,
    validate("json", alertHistoryReadSchema),
    async (c) => {
      const { id: userId } = c.get("userPayload");
      const historyId = c.req.param("historyId");
      if (!z.string().uuid().safeParse(historyId).success) {
        return c.json({ error: "Invalid history id" }, 400);
      }
      try {
        const updated = await setAlertHistoryReadState(
          userId,
          historyId,
          c.req.valid("json").read,
        );
        if (!updated) {
          return c.json({ error: "Alert history not found" }, 404);
        }
        return c.json(updated, statusCode.Ok);
      } catch (err) {
        console.error("[alerts] PATCH /history/:historyId/read failed:", err);
        return c.json({ error: "Failed to update alert history" }, 500);
      }
    },
  )
  .patch("/history/read-all", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload");
    try {
      const updated = await markAllAlertHistoryRead(userId);
      return c.json({ updatedCount: updated.length }, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] PATCH /history/read-all failed:", err);
      return c.json({ error: "Failed to update alert history" }, 500);
    }
  })
  // ── Advanced alert rules (predicate filtering on webhook) ──────
  .get("/rules", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload");
    try {
      const rules = await listActiveAlertRules(userId);
      return c.json(rules, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET /rules failed:", err);
      return c.json({ error: "Failed to load alert rules" }, 500);
    }
  })
  .post(
    "/rules",
    honoJwt,
    userExtract,
    validate("json", alertRuleBodySchema),
    async (c) => {
      const { id: userId } = c.get("userPayload");
      const body = c.req.valid("json");
      try {
        const rule = await createAlertRule(userId, {
          name: body.name ?? null,
          walletAddress: body.walletAddress,
          actionType: body.actionType,
          minVolume: body.minVolume,
          maxVolume: body.maxVolume ?? null,
          volumeUnit: body.volumeUnit,
          triggerType: body.triggerType,
          expiryDate: new Date(body.expiryDate),
          useDefaultDelivery: body.useDefaultDelivery,
          discordWebhookOverride: body.discordWebhookOverride ?? null,
          emailOverride: body.emailOverride ?? null,
        });
        const heliusSync = await runHeliusAlertSync();
        return c.json({ rule, heliusSync }, statusCode.Created);
      } catch (err) {
        console.error("[alerts] POST /rules failed:", err);
        return c.json({ error: "Failed to create alert rule" }, 500);
      }
    },
  )
  .delete("/rules/:ruleId", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload");
    const ruleId = Number(c.req.param("ruleId"));
    if (!Number.isFinite(ruleId) || ruleId <= 0) {
      return c.json({ error: "Invalid rule id" }, 400);
    }
    try {
      const deleted = await deleteAlertRule(ruleId, userId);
      if (!deleted) {
        return c.json({ error: "Rule not found" }, 404);
      }
      const heliusSync = await runHeliusAlertSync();
      return c.json({ deleted: true, heliusSync }, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] DELETE /rules/:ruleId failed:", err);
      return c.json({ error: "Failed to delete alert rule" }, 500);
    }
  })
  // ── Wallet CRUD (auth-guarded) ───────────────────────────────
  .get("/diagnostics", honoJwt, userExtract, async (c) => {
    if (process.env.NODE_ENV === "production") {
      return c.text("Not found", 404);
    }
    try {
      return c.json(await getHeliusWebhookDiagnostics(), statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET /diagnostics failed:", err);
      return c.json({ error: "Failed to load diagnostics" }, 500);
    }
  })
  .get("/", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload");
    try {
      const rows = await listFollowedWallets(userId);
      return c.json(rows, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET failed:", err);
      return c.json({ error: "Failed to load followed wallets" }, 500);
    }
  })
  .post(
    "/",
    honoJwt,
    userExtract,
    validate("json", followWalletBodySchema),
    async (c) => {
      const { id: userId } = c.get("userPayload");
      const { address, label } = c.req.valid("json");
      try {
        const wallet = await addFollowedWallet(
          userId,
          address,
          label ?? undefined,
        );
        const heliusSync = await runHeliusAlertSync();
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
    },
  )
  .delete("/:id", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Invalid wallet ID" }, 400);
    }
    try {
      const deleted = await removeFollowedWallet(id, userId);
      if (!deleted) {
        return c.json({ error: "Wallet not found" }, 404);
      }
      const heliusSync = await runHeliusAlertSync();
      return c.json({ deleted: true, heliusSync }, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] DELETE failed:", err);
      return c.json({ error: "Failed to remove wallet" }, 500);
    }
  })
  // ── User notification settings (auth-guarded) ────────────────
  .get("/settings", honoJwt, userExtract, async (c) => {
    const { id: userId } = c.get("userPayload");
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
    userExtract,
    validate("json", settingsPatchSchema),
    async (c) => {
      const { id: userId } = c.get("userPayload");
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
              body.emailAlertsEnabled ?? current?.emailAlertsEnabled ?? false,
            emailAlertsAddress:
              body.emailAlertsAddress !== undefined
                ? body.emailAlertsAddress
                : (current?.emailAlertsAddress ?? null),
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

export type AlertsRouteAppType = typeof app;
