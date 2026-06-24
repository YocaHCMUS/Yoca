import userExtract from "@sv/middlewares/user-extract.js";
import {
  alertIdSchema,
  alertStatusUpdateSchema,
  createTradingEventAlertSchema,
  honoJwt,
  validate,
  type CreateTradingEventAlertSchema,
} from "@sv/middlewares/validation.js";
import * as tradingEventAlerts from "@sv/services/alerts/trading-event-alerts.js";
import { syncHeliusWebhookAccountAddresses } from "@sv/services/heliusWebhooks.service.js";
import { serverErr, setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

function toInput(body: CreateTradingEventAlertSchema, userId: string) {
  return {
    userId,
    triggerMode: body.triggerMode,
    expiresAt: body.expiresAt,
    name: body.name,
    delivery: { email: body.delivery.email ?? null, discordEnabled: body.delivery.discord },
    target: { tokenAddress: body.target.tokenAddress, walletAddress: body.target.walletAddress ?? null },
    condition: { eventType: body.condition.eventType, minSolAmount: body.condition.minSolAmount ?? null },
  } as const;
}

async function syncAfterMutation() {
  try {
    return await syncHeliusWebhookAccountAddresses();
  } catch (error) {
    console.error("[trading-alerts] Helius sync failed after alert mutation", error);
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

const app = new Hono()
  .get("/", honoJwt, userExtract, async (c) => {
    try {
      return c.json(await tradingEventAlerts.getTradingEventAlertsByUser(c.get("userPayload").id), statusCode.Ok);
    } catch (error) { return serverErr(c, error); }
  })
  .post("/", honoJwt, userExtract, validate("json", createTradingEventAlertSchema), async (c) => {
    try {
      const userId = c.get("userPayload").id;
      const alertId = await tradingEventAlerts.createTradingEventAlert(toInput(c.req.valid("json"), userId));
      const [alert, heliusSync] = await Promise.all([
        tradingEventAlerts.getTradingEventAlertDetails(alertId, userId),
        syncAfterMutation(),
      ]);
      return c.json({ alert, heliusSync }, statusCode.Created);
    } catch (error) { return serverErr(c, error); }
  })
  .get("/:id", honoJwt, userExtract, validate("param", alertIdSchema), async (c) => {
    try {
      const alert = await tradingEventAlerts.getTradingEventAlertDetails(c.req.valid("param").id, c.get("userPayload").id);
      return alert ? c.json(alert, statusCode.Ok) : c.json(setErr("NOT_FOUND"), statusCode.NotFound);
    } catch (error) { return serverErr(c, error); }
  })
  .put("/:id", honoJwt, userExtract, validate("param", alertIdSchema), validate("json", createTradingEventAlertSchema), async (c) => {
    try {
      const userId = c.get("userPayload").id;
      const id = c.req.valid("param").id;
      if (!await tradingEventAlerts.getTradingEventAlertDetails(id, userId)) return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
      await tradingEventAlerts.updateTradingEventAlert(id, toInput(c.req.valid("json"), userId));
      const [alert, heliusSync] = await Promise.all([tradingEventAlerts.getTradingEventAlertDetails(id, userId), syncAfterMutation()]);
      return c.json({ alert, heliusSync }, statusCode.Ok);
    } catch (error) { return serverErr(c, error); }
  })
  .patch("/:id/state", honoJwt, userExtract, validate("param", alertIdSchema), validate("json", alertStatusUpdateSchema), async (c) => {
    try {
      const userId = c.get("userPayload").id;
      const id = c.req.valid("param").id;
      if (!await tradingEventAlerts.getTradingEventAlertDetails(id, userId)) return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
      await tradingEventAlerts.setTradingEventAlertState(id, c.req.valid("json").status);
      const [alert, heliusSync] = await Promise.all([tradingEventAlerts.getTradingEventAlertDetails(id, userId), syncAfterMutation()]);
      return c.json({ alert, heliusSync }, statusCode.Ok);
    } catch (error) { return serverErr(c, error); }
  })
  .delete("/:id", honoJwt, userExtract, validate("param", alertIdSchema), async (c) => {
    try {
      const userId = c.get("userPayload").id;
      const id = c.req.valid("param").id;
      if (!await tradingEventAlerts.getTradingEventAlertDetails(id, userId)) return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
      await tradingEventAlerts.deleteTradingEventAlert(id);
      return c.json({ deleted: true, heliusSync: await syncAfterMutation() }, statusCode.Ok);
    } catch (error) { return serverErr(c, error); }
  });

export default app;
export type TradingEventsAppType = typeof app;
