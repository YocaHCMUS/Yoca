import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockZerionUpstreamError extends Error {
    readonly provider = "zerion";
    readonly upstreamStatus?: number;

    constructor(status?: number) {
      super("Zerion balance chart request failed");
      this.name = "ZerionUpstreamError";
      this.upstreamStatus = status;
    }
  }

  return {
    getWalletBalanceHistory: vi.fn(),
    MockZerionUpstreamError,
  };
});

vi.mock("@sv/middlewares/validation", async () => {
  const { validator } = await import("hono/validator");
  const { z } = await import("zod");
  return {
    solanaBase58Schema: z.string().trim().min(1),
    validate: (target: "query", schema: any) =>
      validator(target, (value, c) => {
        const parsed = schema.safeParse(value);
        return parsed.success
          ? parsed.data
          : c.json({ errorCode: "VALIDATION_ERR" }, 422);
      }),
  };
});

vi.mock("@sv/services/wallet/walletCharts.service", () => ({
  getWalletBalanceHistory: mocks.getWalletBalanceHistory,
  ZerionUpstreamError: mocks.MockZerionUpstreamError,
}));

vi.mock("@sv/services/wallet/walletTokenBalance.service", () => ({
  getWalletTokenBalanceHistory: vi.fn(),
}));

import balanceRoute from "@sv/routes/charts/balance.route.js";

describe("GET /api/charts/balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 502 after a Zerion balance-history failure", async () => {
    mocks.getWalletBalanceHistory.mockRejectedValue(
      new mocks.MockZerionUpstreamError(500),
    );

    const response = await balanceRoute.request(
      "/?timePeriod=30D&wallets=SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF",
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      errorCode: "BAD_GATEWAY",
    });
  });
});
