import {
  recentTradesQuerySchema,
  traderTypeQuerySchema,
  validate,
} from "@sv/middlewares/validation.js";
import {
  getRecentTrades,
  getTopGainers,
  getTopLosers,
} from "@sv/services/trades.js";
import { setErr } from "@sv/util/errors.js";
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
  .get("/traders/gainers", validate("query", traderTypeQuerySchema), async (c) => {
    try {
      const { type = "1W" } = c.req.valid("query");
      const traders = await getTopGainers(type);

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
  .get("/traders/losers", validate("query", traderTypeQuerySchema), async (c) => {
    try {
      const { type = "1W" } = c.req.valid("query");
      const losers = await getTopLosers(type);

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
