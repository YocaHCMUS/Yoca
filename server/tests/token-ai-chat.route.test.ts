import type { Context, Next } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestContext = Context<{
  Variables: {
    jwtPayload: { id: string };
    userPayload: { id: string };
  };
}>;

const mocks = vi.hoisted(() => ({
  askTokenAiChat: vi.fn(),
  reserveAiUsage: vi.fn(),
  releaseAiUsage: vi.fn(),
}));

vi.mock("@sv/middlewares/validation.js", () => ({
  honoJwt: async (c: TestContext, next: Next) => {
    if (!c.req.header("x-test-user")) {
      return c.json({ errorCode: "UNAUTHORIZED" }, 401);
    }
    c.set("jwtPayload", { id: c.req.header("x-test-user") });
    await next();
  },
}));

vi.mock("@sv/middlewares/user-extract.js", () => ({
  default: async (c: TestContext, next: Next) => {
    c.set("userPayload", c.get("jwtPayload"));
    await next();
  },
}));

vi.mock("@sv/services/ai-usage.service.js", () => ({
  AI_FEATURES: { AskYocaAi: "ask_yoca_ai" },
  reserveAiUsage: mocks.reserveAiUsage,
  releaseAiUsage: mocks.releaseAiUsage,
}));

vi.mock("@sv/services/tokens/token-ai-chat.service.js", () => ({
  askTokenAiChat: mocks.askTokenAiChat,
  inferTokenAiLanguage: vi.fn(() => "en"),
}));

import app from "@sv/routes/token-ai-chat.js";

const usage = {
  feature: "ask_yoca_ai",
  tier: "Free",
  limit: 5,
  used: 1,
  remaining: 4,
  resetsAt: "2026-06-24T00:00:00.000Z",
} as const;

function request(userId?: string) {
  return app.request("/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `${Math.random()}`,
      ...(userId ? { "x-test-user": userId } : {}),
    },
    body: JSON.stringify({
      address: "So11111111111111111111111111111111111111112",
      question: "What is happening?",
      timeframe: "24h",
      includeNews: true,
      includeVolatility: true,
    }),
  });
}

describe("POST /api/token-ai-chat", () => {
  beforeEach(() => {
    mocks.askTokenAiChat.mockResolvedValue({ token: { address: "token" } });
    mocks.reserveAiUsage.mockResolvedValue({
      allowed: true,
      usage,
      userId: "user-1",
      usageDate: "2026-06-23",
    });
    mocks.releaseAiUsage.mockResolvedValue(undefined);
  });

  it("requires authentication", async () => {
    const response = await request();

    expect(response.status).toBe(401);
    expect(mocks.reserveAiUsage).not.toHaveBeenCalled();
  });

  it("returns usage metadata after a successful answer", async () => {
    const response = await request("user-1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, usage });
    expect(mocks.askTokenAiChat).toHaveBeenCalledOnce();
  });

  it("returns 429 without invoking AI when the daily quota is exhausted", async () => {
    mocks.reserveAiUsage.mockResolvedValue({
      allowed: false,
      usage: { ...usage, used: 5, remaining: 0 },
      userId: "user-1",
      usageDate: "2026-06-23",
    });

    const response = await request("user-1");
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({
      errorCode: "AI_DAILY_LIMIT_EXCEEDED",
      limit: 5,
      used: 5,
      remaining: 0,
      upgradePath: "/pricing",
    });
    expect(mocks.askTokenAiChat).not.toHaveBeenCalled();
  });

  it("releases the reserved usage when AI processing fails", async () => {
    mocks.askTokenAiChat.mockRejectedValue(new Error("provider unavailable"));

    const response = await request("user-1");

    expect(response.status).toBe(500);
    expect(mocks.releaseAiUsage).toHaveBeenCalledOnce();
  });
});
