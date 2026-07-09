import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getWalletBalanceHistory: vi.fn(),
}));

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
}));

vi.mock("@sv/services/wallet/walletTokenBalance.service", () => ({
  getWalletTokenBalanceHistory: vi.fn(),
}));

import { UpstreamError } from "@sv/util/errors.js";
import balanceRoute from "@sv/routes/charts/balance.route.js";

describe("GET /api/charts/balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 502 after an upstream balance-history failure", async () => {
    mocks.getWalletBalanceHistory.mockRejectedValue(
      new UpstreamError("mobula", 500),
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
