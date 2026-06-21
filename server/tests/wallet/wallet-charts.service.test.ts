import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rlFetch: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@sv/util/rate-limit.js", () => ({
  rlFetch: mocks.rlFetch,
}));

vi.mock("@sv/util/util-zerion.js", () => ({
  getEndpoint: (path: string) => new URL(`https://api.zerion.io/v1${path}`),
  getRequiredHeaders: () => ({}),
  limiter: {},
}));

vi.mock("@sv/db/index.js", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
  },
}));

import "@sv/util/date.js";
import { zrn_WalletBalanceChartSchema } from "@sv/services/_types/wallet-raw-responses.js";
import {
  getWalletBalanceHistory,
  ZerionUpstreamError,
} from "@sv/services/wallet/walletCharts.service.js";

const safeParseSpy = vi.spyOn(zrn_WalletBalanceChartSchema, "safeParse");

function configureCacheRows(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  mocks.select.mockReturnValue({ from });
}

describe("getWalletBalanceHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureCacheRows([]);
  });

  it("does not validate a Zerion error envelope with the success schema", async () => {
    mocks.rlFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ title: "Internal Server Error", detail: "" }],
        }),
        { status: 500, statusText: "Internal Server Error" },
      ),
    );

    await expect(
      getWalletBalanceHistory("SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF", "30D"),
    ).rejects.toMatchObject({
      provider: "zerion",
      upstreamStatus: 500,
      endpointPath: "/v1/wallets/SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF/charts/month",
      errorTitle: "Internal Server Error",
    } satisfies Partial<ZerionUpstreamError>);

    expect(safeParseSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["malformed", "{"],
  ])("turns a %s successful response into a typed upstream failure", async (_kind, body) => {
    mocks.rlFetch.mockResolvedValue(new Response(body, { status: 200 }));

    await expect(
      getWalletBalanceHistory("SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF", "30D"),
    ).rejects.toMatchObject({
      provider: "zerion",
      upstreamStatus: 200,
      reason: "invalid_response",
    } satisfies Partial<ZerionUpstreamError>);
  });

  it("uses valid fresh cached data without calling Zerion", async () => {
    const now = Date.now();
    configureCacheRows([
      {
        timestampMs: now - 1_000,
        usdValue: 123.45,
      },
    ]);

    const result = await getWalletBalanceHistory(
      "SupRAxJybdbv68r1PDXDq9LWKgdzLsmPwiyj41RM5SF",
      "30D",
    );

    expect(result).toEqual([{ timestampMs: now - 1_000, usdValue: 123.45 }]);
    expect(mocks.rlFetch).not.toHaveBeenCalled();
  });
});
