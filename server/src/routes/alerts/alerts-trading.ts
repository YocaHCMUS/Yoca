import userExtract from "@sv/middlewares/user-extract.js";
import {
  alertIdSchema,
  alertStatusUpdateSchema,
  CreateTradingAlertSchema,
  createTradingAlertSchema,
  honoJwt,
  validate,
} from "@sv/middlewares/validation.js";
import type { TradingAlertInput } from "@sv/services/alerts/alerts-trading.js";
import * as tradingAlerts from "@sv/services/alerts/alerts-trading.js";
import { serverErr, setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

function createUpdatePayload(
  body: CreateTradingAlertSchema,
  userId: string,
): TradingAlertInput {
  return {
    alertType: "trading",
    userId,
    triggerMode: body.triggerMode,
    expiresAt: body.expiresAt,
    alertName: body.name,
    email: body.delivery?.email ?? null,
    scopes: body.scopes.map((scope) => ({
      walletAddress: scope.walletAddress,
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
  .get("/", honoJwt, userExtract, async (c) => {
    try {
      const user = c.get("userPayload");
      const alerts = await tradingAlerts.getTradingAlertsByUser(user.id);
      return c.json(alerts, statusCode.Ok);
    } catch (e) {
      return serverErr(c, e);
    }
  })

  .post(
    "/",
    honoJwt,
    userExtract,
    validate("json", createTradingAlertSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const body = c.req.valid("json");
        const row = await tradingAlerts.createTradingAlert(
          createUpdatePayload(body, user.id),
        );

        if (!row) {
          return c.json(
            setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
            statusCode.BadGateway,
          );
        }

        const alert = await tradingAlerts.getTradingAlertDetails(row, user.id);
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
        const alert = await tradingAlerts.getTradingAlertDetails(id, user.id);
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
    validate("json", createTradingAlertSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const existing = await tradingAlerts.getTradingAlertDetails(
          id,
          user.id,
        );
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }

        const body = c.req.valid("json");
        await tradingAlerts.updateTradingAlert(
          id,
          createUpdatePayload(body, user.id),
        );

        const updated = await tradingAlerts.getTradingAlertDetails(id, user.id);
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
    validate("json", alertStatusUpdateSchema),
    validate("param", alertIdSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");

        const { id } = c.req.valid("param");
        const { status } = c.req.valid("json");
        const existing = await tradingAlerts.getTradingAlertDetails(
          id,
          user.id,
        );
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }

        await tradingAlerts.setTradingAlertState(id, status);
        const updated = await tradingAlerts.getTradingAlertDetails(id, user.id);
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
        const existing = await tradingAlerts.getTradingAlertDetails(
          id,
          user.id,
        );
        if (!existing) {
          return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
        }
        await tradingAlerts.deleteTradingAlert(id);
        return c.json({ message: "Deleted" }, statusCode.Ok);
      } catch (e) {
        return serverErr(c, e);
      }
    },
  );

export default app;
