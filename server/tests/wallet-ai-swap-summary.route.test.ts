import type { Context, Next } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestContext = Context<{
  Variables: {
    jwtPayload: { id: string };
    userPayload: { id: string };
  };
}>;

const mocks = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getTokenAnalysis: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  getUsage: vi.fn(),
  isLocked: vi.fn(),
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
  AI_FEATURES: { WalletAiAnalysis: "wallet_ai_analysis" },
  reserveAiUsage: mocks.reserve,
  releaseAiUsage: mocks.release,
  getAiUsage: mocks.getUsage,
  isAiFeatureLocked: mocks.isLocked,
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

describe("Wallet AI Swap Summary routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSummary.mockResolvedValue({ address: "wallet", cached: false });
    mocks.getTokenAnalysis.mockResolvedValue({
      address: "wallet",
      tokenAddress: "token",
      cached: false,
    });
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
    "does not reserve AI usage for %s",
    async (path) => {
      const response = await request(path, "user-1");
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject(
        path.endsWith("/token")
          ? { address: "wallet", tokenAddress: "token" }
          : { address: "wallet" },
      );
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.getUsage).not.toHaveBeenCalled();
      expect(mocks.release).not.toHaveBeenCalled();
    },
  );
});
