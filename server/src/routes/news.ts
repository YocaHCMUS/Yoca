import { validate } from "@sv/middlewares/validation.js";
import newsWebhookSchema from "@sv/types/news.schema.js";
import * as newsService from "@sv/services/news.service.js";
import { statusCode } from "@sv/util/responses.js";
import { setErr } from "@sv/config/errors.js";
import { Hono } from "hono";

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // per address per window
const rateMap = new Map<string, { count: number; windowStart: number }>();

const app = new Hono()
    .post("/webhook", validate("json", newsWebhookSchema), async (c) => {
        try {
            const body = c.req.valid("json");
            const key = body.address;

            // rate limiting per address
            const now = Date.now();
            const entry = rateMap.get(key) || { count: 0, windowStart: now };
            if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
                entry.count = 0;
                entry.windowStart = now;
            }
            entry.count += 1;
            rateMap.set(key, entry);

            if (entry.count > RATE_LIMIT_MAX) {
                return c.json(setErr("RATE_LIMIT_EXCEEDED"), statusCode.TooManyRequests);
            }

            const { address, symbol, name } = body;

            const resp = await newsService.getOrFetchNews(address, symbol, name);
            return c.json(
                { status: "ok", cached: resp.cached, entries: resp.entries },
                statusCode.Ok,
            );
        } catch (err) {
            console.error('[news webhook] error:', err);
            return c.json(setErr('INTERNAL_SERVER_ERR'), statusCode.InternalServerError);
        }
    });

export default app;
