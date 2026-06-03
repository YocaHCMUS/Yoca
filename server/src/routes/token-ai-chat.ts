import {
  askTokenAiChat,
  inferTokenAiLanguage,
  type TokenAiLanguage,
  type TokenAiTimeframe,
} from "@sv/services/tokens/token-ai-chat.service.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono, type Context } from "hono";
import z from "zod";

const supportedTimeframes = ["24h", "7d", "1m", "3m", "1y"] as const;
const supportedLanguages = ["en", "vi"] as const;

const tokenAiChatRequestSchema = z.object({
  address: z.string().trim().min(1),
  symbol: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1).max(128).optional(),
  question: z.string().trim().min(1).max(500),
  timeframe: z.enum(supportedTimeframes).default("24h"),
  language: z.enum(supportedLanguages).optional(),
  includeNews: z.boolean().default(true),
  includeVolatility: z.boolean().default(true),
});

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const throttle = new Map<string, { count: number; resetAt: number }>();

function getIp(c: Context) {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "global"
  );
}

function isAllowed(ip: string) {
  const now = Date.now();
  const existing = throttle.get(ip);
  if (!existing || existing.resetAt <= now) {
    throttle.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  existing.count += 1;
  return true;
}

const app = new Hono().post("/", async (c) => {
  const ip = getIp(c);
  if (!isAllowed(ip)) {
    return c.json(
      {
        ...setErr("VALIDATION_ERR"),
        success: false,
        message: "Too many token AI chat requests. Please wait and try again.",
      },
      statusCode.TooManyRequests,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        ...setErr("VALIDATION_ERR"),
        success: false,
        message: "Invalid JSON body",
      },
      statusCode.BadRequest,
    );
  }

  const parsed = tokenAiChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ...setErr("VALIDATION_ERR"),
        success: false,
        message: "Invalid request body",
        details: parsed.error.issues,
      },
      statusCode.BadRequest,
    );
  }

  try {
    const language = inferTokenAiLanguage(
      parsed.data.question,
      parsed.data.language,
    );
    const data = await askTokenAiChat({
      address: parsed.data.address,
      symbol: parsed.data.symbol,
      name: parsed.data.name,
      question: parsed.data.question,
      timeframe: parsed.data.timeframe as TokenAiTimeframe,
      language: language as TokenAiLanguage,
      includeNews: parsed.data.includeNews,
      includeVolatility: parsed.data.includeVolatility,
    });

    return c.json({ success: true, data }, statusCode.Ok);
  } catch (err) {
    console.error("[token-ai-chat] error:", err);
    return c.json(
      {
        ...setErr("INTERNAL_SERVER_ERR"),
        success: false,
        message: "Token AI chat failed.",
      },
      statusCode.InternalServerError,
    );
  }
});

export type TokenAiChatAppType = typeof app;
export default app;
