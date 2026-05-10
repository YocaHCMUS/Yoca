import { setErr } from "@sv/config/errors.js";
import {
  recentTradesQuerySchema,
  validate,
} from "@sv/middlewares/validation.js";
import {
  getRecentTrades,
  getTopGainers,
  getTopLosers,
} from "@sv/services/trades.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono()
  .get("/recent", validate("query", recentTradesQuerySchema), async (c) => {
    try {
      const { timeWindow, usdThreshold, sortBy } = c.req.valid("query");
      const trades = await getRecentTrades({
        timeWindow,
        usdThreshold: Number(usdThreshold),
        sortBy,
      });

      if (trades && trades.length > 0) {
        return c.json(trades, statusCode.Ok);
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
  .get("/traders/gainers", async (c) => {
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
  .get("/traders/losers", async (c) => {
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

export type TradesAppType = typeof app;
