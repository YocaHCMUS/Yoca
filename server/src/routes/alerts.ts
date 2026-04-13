import { setErr } from "@sv/config/errors";
import {
  createAlertSchema,
  honoJwt,
  updateAlertSchema,
  userPayloadSchema,
  validate,
} from "@sv/middlewares/validation.js";
import * as alertsService from "@sv/services/alerts.js";
import { statusCode } from "@sv/util/responses.js";
import type { Context } from "hono";
import { Hono } from "hono";

async function getAuthPayload(c: Context) {
  const rawPayload = c.get("jwtPayload");
  const parsedPayload = userPayloadSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return null;
  }
  return parsedPayload.data;
}

const app = new Hono()
  .get("/", honoJwt, async (c) => {
    try {
      const payload = await getAuthPayload(c);
      if (!payload) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }

      const address = c.req.query("tokenAddress");
      const alerts = await alertsService.getAlertsByUser(payload.id);
      const result = address
        ? alerts.filter((a) => a.tokenAddress === address)
        : alerts;
      return c.json(result, statusCode.Ok);
    } catch (err) {
      console.log(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })

  .post("/", honoJwt, validate("json", createAlertSchema), async (c) => {
    try {
      const rawPayload = c.get("jwtPayload");
      const parsedPayload = userPayloadSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }
      const body = c.req.valid("json");
      const row = await alertsService.createAlert({
        userId: parsedPayload.data.id,
        tokenAddress: body.tokenAddress,
        alertType: body.alertType,
        period: body.period,
        conditions: body.conditions,
      });
      if (!row) {
        return c.json(
          setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
          statusCode.BadGateway,
        );
      }
      return c.json(row, statusCode.Created);
    } catch (err) {
      console.log(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })

  .get("/:id", honoJwt, async (c) => {
    try {
      const rawPayload = c.get("jwtPayload");
      const parsedPayload = userPayloadSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }
      const payload = parsedPayload.data;
      const id = c.req.param("id");
      const row = await alertsService.getAlertById(id);
      if (!row || row.userId !== payload.id)
        return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
      return c.json(row, statusCode.Ok);
    } catch (err) {
      console.log(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })

  .put("/:id", honoJwt, validate("json", updateAlertSchema), async (c) => {
    try {
      const rawPayload = c.get("jwtPayload");
      const parsedPayload = userPayloadSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }
      const payload = parsedPayload.data;
      const id = c.req.param("id");
      const existing = await alertsService.getAlertById(id);
      if (!existing || existing.userId !== payload.id)
        return c.json(setErr("NOT_FOUND"), statusCode.NotFound);
      const body = c.req.valid("json");
      const updated = await alertsService.updateAlert(id, body);
      return c.json(updated, statusCode.Ok);
    } catch (err) {
      console.log(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })

  .delete("/:id", honoJwt, async (c) => {
    try {
      const rawPayload = c.get("jwtPayload");
      const parsedPayload = userPayloadSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
      }
      const payload = parsedPayload.data;
      const id = c.req.param("id");
      const existing = await alertsService.getAlertById(id);
      if (!existing || existing.userId != payload.id)
        return c.json({ error: "Not found" }, 404);
      await alertsService.deleteAlert(id);
      return c.json({ message: "Deleted" }, statusCode.Ok);
    } catch (err) {
      console.log(err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

export default app;
