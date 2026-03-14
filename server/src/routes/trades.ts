import { setErr } from "@sv/config/errors.js";
import { getRecentTrades } from "@sv/services/trades.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";

const app = new Hono().get("/recent", async (c) => {
  try {
    const trades = await getRecentTrades();

    if (trades && trades.length > 0) {
      return c.json(trades, statusCode.Ok);
    }

    return c.json(
      setErr("FAILED_TO_FETCH_REQUESTED_DATA"),
      statusCode.BadGateway,
    );
  } catch (err) {
    // console.error(err );
    return c.json(
      setErr("INTERNAL_SERVER_ERR"),
      statusCode.InternalServerError,
    );
  }
});

export default app;
