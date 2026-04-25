import userExact from "@sv/middlewares/user-extract.js";
import {
  alertIdSchema,
  createAlertSchema,
  honoJwt,
  validate,
} from "@sv/middlewares/validation.js";
import * as alertsService from "@sv/services/alerts.js";
import { CreateAlertInput } from "@sv/services/alerts.js";
import { serverErr, setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import z from "zod";

type CreateAlertBody = z.infer<typeof createAlertSchema>;

function normalizeCreatePayload(
  body: CreateAlertBody,
  userId: string,
): CreateAlertInput {
  if (body.alertType == "token") {
    return {
      alertType: "token",
      userId,
      tokenAddress: body.tokenTarget.tokenAddress,
      triggerMode: body.triggerMode,
      expiresAt: body.expiresAt,
      alertName: body.name,
      email: body.delivery?.email,
      conditions: body.conditions.map((condition) => ({
        period: condition.period,
        metric: condition.metric,
        conditionOp: condition.conditionOp,
        value: condition.value,
      })),
    };
  }

  return {
    alertType: "trading",
    userId,
    triggerMode: body.triggerMode,
    expiresAt: body.expiresAt,
    alertName: body.name,
    email: body.delivery?.email,
    scopes: body.scopes.map((scope) => ({
      walletAddress: scope.walletAddress ?? null,
      tokenAddress: scope.tokenAddress ?? null,
      poolAddress: scope.poolAddress ?? null,
      counterpartyAddress: scope.counterpartyAddress ?? null,
      direction: scope.direction,
    })),
    conditions: body.conditions.map((condition) => ({
      aggregation: condition.aggregation,
      period: condition.period,
      conditionOp: condition.conditionOp,
      value: condition.value,
    })),
  };
}

const app = new Hono()
  .get("/", honoJwt, userExact, async (c) => {
    try {
      const user = c.get("userPayload");

      const address = c.req.query("tokenAddress");
      const alertType = c.req.query("alertType");
      const alerts = await alertsService.getAlertsByUser(user.id);

      const result = alerts.filter((alert) => {
        if (alertType && alert.alert.alertType != alertType) {
          return false;
        }
        if (!address) {
          return true;
        }
        return alert.tokenTarget?.tokenAddress == address;
      });

      return c.json(result, statusCode.Ok);
    } catch (e) {
      return serverErr(c, e);
    }
  })

  .post(
    "/",
    honoJwt,
    userExact,
    validate("json", createAlertSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const body = c.req.valid("json");
        const row = await alertsService.createAlert(
          normalizeCreatePayload(body, user.id),
        );

        if (!row) {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }
        return c.json(row, statusCode.Created);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .get(
    "/:id",
    honoJwt,
    userExact,
    validate("param", alertIdSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");
        const { id } = c.req.valid("param");
        const alert = await alertsService.getAlertById(id, user.id);
        if (!alert) return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        return c.json(alert, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .put(
    "/:id",
    honoJwt,
    userExact,
    validate("param", alertIdSchema),
    validate("json", createAlertSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const existing = await alertsService.getAlertById(id, user.id);
        if (!existing) return c.json(setErr("NOT_FOUND"), statusCode.NotFound);

        const body = c.req.valid("json");
        const updated = await alertsService.updateAlert(
          id,
          normalizeCreatePayload(body, user.id),
        );

        return c.json(updated, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .post(
    "/:id/stop",
    honoJwt,
    userExact,
    validate("param", alertIdSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const existing = await alertsService.getAlertById(id, user.id);
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }

        const updated = await alertsService.stopAlert(id);
        return c.json(updated, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .delete(
    "/:id",
    honoJwt,
    userExact,
    validate("param", alertIdSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const existing = await alertsService.getAlertById(id, user.id);
        if (!existing) return c.json({ error: "Not found" }, 404);
        await alertsService.deleteAlert(id);
        return c.json({ message: "Deleted" }, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  );

export default app;
