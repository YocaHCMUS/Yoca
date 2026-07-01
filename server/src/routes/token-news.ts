import { solanaBase58Schema } from "@sv/middlewares/validation.js";
import { getRssTokenNews } from "@sv/services/rss-news.service.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import z from "zod";

const tokenNewsQuerySchema = z.object({
  address: solanaBase58Schema,
  symbol: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(128),
});

const app = new Hono().get("/", async (c) => {
  const parsed = tokenNewsQuerySchema.safeParse(c.req.query());

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
    const data = await getRssTokenNews(parsed.data);

    return c.json(
      {
        success: true,
        data,
      },
      statusCode.Ok,
    );
  } catch (err) {
    console.error("[token-news] error:", err);
    return c.json(
      {
        ...setErr("INTERNAL_SERVER_ERR"),
        success: false,
      },
      statusCode.InternalServerError,
    );
  }
});

export type TokenNewsAppType = typeof app;
export default app;
