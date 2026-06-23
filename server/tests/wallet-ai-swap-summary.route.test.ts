import type { Context, Next } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestContext = Context<{
  Variables: {
    jwtPayload: { id: string };
    userPayload: { id: string };
  };
}>;

const mocks = vi.hoisted(() => ({
  cached: false,
  getSummary: vi.fn(),
  getTokenAnalysis: vi.fn(),
  provider: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  getUsage: vi.fn(),
}));

vi.mock("@sv/middlewares/validation.js", async () => {
  const { z } = await import("zod");
  return {
    envSchema: z.object({}).passthrough(),
    addressSchema: {},
    walletTokenTradesSchema: {},
    validate: () => async (_c: TestContext, next: Next) => next(),
    honoJwt: async (c: TestContext, next: Next) => {
      const userId = c.req.header("x-test-user");
      if (!userId) return c.json({ errorCode: "UNAUTHORIZED" }, 401);
      c.set("jwtPayload", { id: userId });
      await next();
    },
  };
});

vi.mock("@sv/middlewares/user-extract.js", () => ({
  default: async (c: TestContext, next: Next) => {
    c.set("userPayload", c.get("jwtPayload"));
    await next();
  },
}));

vi.mock("@sv/services/ai-usage.service.js", () => ({
  AI_FEATURES: { WalletAiSwapSummary: "wallet_ai_swap_summary" },
  reserveAiUsage: mocks.reserve,
  releaseAiUsage: mocks.release,
  getAiUsage: mocks.getUsage,
}));

vi.mock("@sv/services/wallet/walletAiSwapSummary.service.js", () => ({
  WalletAiSwapSummaryServiceError: class extends Error {},
  getWalletAiSwapSummary: mocks.getSummary,
}));

vi.mock("@sv/services/wallet/walletTokenAnalysis.service.js", () => ({
  WalletTokenAnalysisServiceError: class extends Error {},
  getTokenDeepAnalysis: mocks.getTokenAnalysis,
}));

import app from "@sv/routes/wallets.route.js";

const usage = {
  feature: "wallet_ai_swap_summary",
  tier: "Free",
  limit: 10,
  used: 1,
  remaining: 9,
  resetsAt: "2026-06-24T00:00:00.000Z",
} as const;

function request(path: "/ai-swap-summary" | "/ai-swap-summary/token", userId?: string) {
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-test-user": userId } : {}),
    },
    body: JSON.stringify({
      address: "So11111111111111111111111111111111111111112",
      ...(path.endsWith("/token")
        ? { tokenAddress: "So11111111111111111111111111111111111111112" }
        : {}),
    }),
  });
}

describe("Wallet AI Swap Summary quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cached = false;
    mocks.provider.mockResolvedValue(undefined);
    mocks.getSummary.mockImplementation(
      async (_address, _language, beforeGenerate?: () => Promise<void>) => {
        if (!mocks.cached) {
          await beforeGenerate?.();
          await mocks.provider();
        }
        return { address: "wallet", cached: mocks.cached };
      },
    );
    mocks.getTokenAnalysis.mockImplementation(
      async (
        _address,
        _tokenAddress,
        _language,
        beforeGenerate?: () => Promise<void>,
      ) => {
        if (!mocks.cached) {
          await beforeGenerate?.();
          await mocks.provider();
        }
        return { address: "wallet", tokenAddress: "token", cached: mocks.cached };
      },
    );
    mocks.reserve.mockResolvedValue({
      allowed: true,
      usage,
      userId: "user-1",
      usageDate: "2026-06-23",
    });
    mocks.release.mockResolvedValue(undefined);
    mocks.getUsage.mockResolvedValue({ ...usage, used: 0, remaining: 10 });
  });

  it.each(["/ai-swap-summary", "/ai-swap-summary/token"] as const)(
    "requires authentication for %s",
    async (path) => {
      const response = await request(path);

      expect(response.status).toBe(401);
      expect(mocks.reserve).not.toHaveBeenCalled();
    },
  );

  it.each(["/ai-swap-summary", "/ai-swap-summary/token"] as const)(
    "does not consume quota for cached responses from %s",
    async (path) => {
      mocks.cached = true;

      const response = await request(path, "user-1");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ counted: false });
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.getUsage).toHaveBeenCalledWith(
        "user-1",
        "wallet_ai_swap_summary",
      );
    },
  );

  it("uses one shared feature key for wallet and token generations", async () => {
    await request("/ai-swap-summary", "user-1");
    await request("/ai-swap-summary/token", "user-1");

    expect(mocks.reserve).toHaveBeenNthCalledWith(
      1,
      "user-1",
      "wallet_ai_swap_summary",
    );
    expect(mocks.reserve).toHaveBeenNthCalledWith(
      2,
      "user-1",
      "wallet_ai_swap_summary",
    );
  });

  it("returns 429 before provider work when quota is exhausted", async () => {
    mocks.reserve.mockResolvedValue({
      allowed: false,
      usage: { ...usage, used: 10, remaining: 0 },
      userId: "user-1",
      usageDate: "2026-06-23",
    });

    const response = await request("/ai-swap-summary", "user-1");
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toMatchObject({
      errorCode: "AI_DAILY_LIMIT_EXCEEDED",
      used: 10,
      remaining: 0,
      upgradePath: "/pricing",
    });
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("releases reserved usage when provider work fails", async () => {
    mocks.provider.mockRejectedValueOnce(new Error("provider unavailable"));

    const response = await request("/ai-swap-summary/token", "user-1");

    expect(response.status).toBe(500);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
