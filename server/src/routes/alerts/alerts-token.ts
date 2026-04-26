import userExtract from "@sv/middlewares/user-extract.js";
import {
  alertIdSchema,
  alertStatusUpdateSchema,
  CreateTokenAlertSchema,
  createTokenAlertSchema,
  honoJwt,
  validate,
} from "@sv/middlewares/validation.js";
import type { TokenAlertInput } from "@sv/services/alerts/alerts-token.js";
import * as tokenAlerts from "@sv/services/alerts/alerts-token.js";
import { serverErr, setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

function normalizeCreatePayload(
  body: CreateTokenAlertSchema,
  userId: string,
): TokenAlertInput {
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

const app = new Hono()
  .get("/", honoJwt, userExtract, async (c) => {
    try {
      const user = c.get("userPayload");

      const address = c.req.query("tokenAddress");
      const alerts = await tokenAlerts.getTokenAlertsByUser(user.id);

      const result = alerts.filter((alert) => {
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
    userExtract,
    validate("json", createTokenAlertSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const body = c.req.valid("json");
        const row = await tokenAlerts.createTokenAlert(
          normalizeCreatePayload(body, user.id),
        );

        if (!row) {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }

        const alert = await tokenAlerts.getTokenAlertDetails(row, user.id);
        if (!alert) {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }

        return c.json(alert, statusCode.Created);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .get(
    "/:id",
    honoJwt,
    userExtract,
    validate("param", alertIdSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");
        const { id } = c.req.valid("param");
        const alert = await tokenAlerts.getTokenAlertDetails(id, user.id);
        if (!alert) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }
        return c.json(alert, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .put(
    "/:id",
    honoJwt,
    userExtract,
    validate("param", alertIdSchema),
    validate("json", createTokenAlertSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const existing = await tokenAlerts.getTokenAlertDetails(id, user.id);
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }

        const body = c.req.valid("json");
        await tokenAlerts.updateTokenAlert(
          id,
          normalizeCreatePayload(body, user.id),
        );

        const updated = await tokenAlerts.getTokenAlertDetails(id, user.id);
        if (!updated) {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }

        return c.json(updated, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .patch(
    "/:id/state",
    honoJwt,
    userExtract,
    validate("param", alertIdSchema),
    validate("json", alertStatusUpdateSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const { status } = c.req.valid("json");
        const existing = await tokenAlerts.getTokenAlertDetails(id, user.id);
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }

        await tokenAlerts.setTokenAlertState(id, status);
        const updated = await tokenAlerts.getTokenAlertDetails(id, user.id);
        if (!updated) {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }

        return c.json(updated, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  )

  .delete(
    "/:id",
    honoJwt,
    userExtract,
    validate("param", alertIdSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const existing = await tokenAlerts.getTokenAlertDetails(id, user.id);
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }
        await tokenAlerts.deleteTokenAlert(id);
        return c.json({ message: "Deleted" }, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  );

export default app;
