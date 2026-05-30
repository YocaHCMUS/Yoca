import { solanaBase58Schema } from "@sv/middlewares/validation.js";
import {
  getTokenPriceVolatilityEvents,
  type TokenVolatilityTimeframe,
  type TokenVolatilityWindow,
} from "@sv/services/tokens/token-volatility.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import z from "zod";

const supportedTimeframes = ["24h", "hourly", "daily"] as const;
const supportedWindows = ["auto", "adjacent", "15m", "1h", "6h", "24h"] as const;

const tokenVolatilityQuerySchema = z.object({
  address: solanaBase58Schema,
  symbol: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(128),
  threshold: z.coerce.number().positive().default(20),
  timeframe: z.enum(supportedTimeframes).default("24h"),
  window: z.enum(supportedWindows).default("auto"),
});

const app = new Hono().get("/", async (c) => {
  const parsed = tokenVolatilityQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ...setErr("VALIDATION_ERR"),
        message: "Invalid query parameters",
        details: parsed.error.issues,
      },
      statusCode.BadRequest,
    );
  }

  try {
    const { address, symbol, name, threshold, timeframe, window } = parsed.data;
    const data = await getTokenPriceVolatilityEvents({
      address,
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      thresholdPercent: threshold,
      timeframe: timeframe as TokenVolatilityTimeframe,
      window: window as TokenVolatilityWindow,
    });

    return c.json({ success: true, data }, statusCode.Ok);
  } catch (err) {
    console.error("[token-volatility] error:", err);
    return c.json(
      {
        ...setErr("INTERNAL_SERVER_ERR"),
        success: false,
      },
      statusCode.InternalServerError,
    );
  }
});

export type TokenVolatilityAppType = typeof app;
export default app;
