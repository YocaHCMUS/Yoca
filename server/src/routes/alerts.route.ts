import { solanaBase58Schema, validate } from "@sv/middlewares/validation.js";
import {
  addFollowedWallet,
  isUniqueViolation,
  listFollowedWallets,
  removeFollowedWallet,
  syncHeliusWebhookAccountAddresses,
} from "@sv/services/followedWallets.service.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { z } from "zod";

const followWalletBodySchema = z.object({
  address: solanaBase58Schema,
  label: z.string().trim().max(120).optional().nullable(),
});

const app = new Hono()
  .get("/", async (c) => {
    try {
      const rows = await listFollowedWallets();
      return c.json(rows, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] GET failed:", err);
      return c.json({ error: "Failed to load followed wallets" }, 500);
    }
  })
  .post("/", validate("json", followWalletBodySchema), async (c) => {
    const { address, label } = c.req.valid("json");
    try {
      const wallet = await addFollowedWallet(address, label ?? undefined);
      const heliusSync = await syncHeliusWebhookAccountAddresses();
      return c.json(
        {
          wallet,
          heliusSync,
        },
        statusCode.Created,
      );
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
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Invalid wallet ID" }, 400);
    }
    try {
      const deleted = await removeFollowedWallet(id);
      if (!deleted) {
        return c.json({ error: "Wallet not found" }, 404);
      }
      const heliusSync = await syncHeliusWebhookAccountAddresses();
      return c.json({ deleted: true, heliusSync }, statusCode.Ok);
    } catch (err) {
      console.error("[alerts] DELETE failed:", err);
      return c.json({ error: "Failed to remove wallet" }, 500);
    }
  });

export default app;
