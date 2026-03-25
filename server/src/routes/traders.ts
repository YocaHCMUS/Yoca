import { setErr } from "@sv/config/errors.js";
import { getTopGainers, getTopLosers } from "@sv/services/traders.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono()
  .get("/gainers", async (c) => {
    try {
      const traders = await getTopGainers();

      if (traders) {
        return c.json(traders, statusCode.Ok);
      }

      return c.json(
        setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
        statusCode.BadGateway,
      );
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  })
  .get("/losers", async (c) => {
    try {
      const losers = await getTopLosers();

      if (losers) {
        return c.json(losers, statusCode.Ok);
      }

      return c.json(
        setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
        statusCode.BadGateway,
      );
    } catch (err) {
      console.error(err);
      return c.json(
        setErr("INTERNAL_SERVER_ERR"),
        statusCode.InternalServerError,
      );
    }
  });

export default app;
