import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletSwap } from "@sv/services/wallet/dtos/walletDataObjects.js";

const mocks = vi.hoisted(() => ({
  getWalletSwaps: vi.fn<(
    address: string,
    from?: number,
    to?: number,
    tokenAddress?: string,
    type?: "buy" | "sell",
    minAmountUsd?: number,
    maxAmountUsd?: number,
    limit?: number,
  ) => Promise<{ swaps: WalletSwap[] }>>(),
}));

vi.mock("@sv/services/wallet/walletTransfersSwaps.service.js", () => ({
  getWalletSwaps: mocks.getWalletSwaps,
}));

import { getWalletPnLComputed } from "@sv/services/wallet/walletAiSwapSummary.service.js";

const WALLET = "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4";
const TOKEN = "token-abc";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function swap(hash: string, boughtToken: string, soldToken: string, boughtValue: number, soldValue: number): WalletSwap {
  const boughtIsToken = boughtToken === TOKEN;
  const soldIsToken = soldToken === TOKEN;
  return {
    transactionHash: hash,
    transactionType: "trade",
    blockTimestampIso: "2026-06-22T00:00:00.000Z",
    subcategory: null,
    walletAddress: WALLET,
    pairAddress: "",
    tokensInvolved: `${boughtToken}/${soldToken}`,
    bought: {
      address: boughtToken,
      amount: boughtIsToken ? 10 : boughtValue,
      symbol: boughtIsToken ? "ABC" : "USDC",
      name: boughtIsToken ? "ABC Token" : "USD Coin",
      logoUri: null,
      priceUsd: boughtIsToken ? boughtValue / 10 : 1,
      valueUsd: boughtValue,
    },
    sold: {
      address: soldToken,
      amount: soldIsToken ? 10 : soldValue,
      symbol: soldIsToken ? "ABC" : "USDC",
      name: soldIsToken ? "ABC Token" : "USD Coin",
      logoUri: null,
      priceUsd: soldIsToken ? soldValue / 10 : 1,
      valueUsd: soldValue,
    },
    totalValueUsd: Math.max(boughtValue, soldValue),
    baseQuotePrice: null,
  };
}

const TWO_SWAPS = [
  swap("tx1", TOKEN, USDC, 100, 100),
  swap("tx2", USDC, TOKEN, 120, 120),
];

describe("getWalletPnLComputed coverage", () => {
  beforeEach(() => {
    mocks.getWalletSwaps.mockReset();
  });

  it("marks PnL coverage capped when returned swaps hit the limit", async () => {
    mocks.getWalletSwaps.mockResolvedValue({ swaps: TWO_SWAPS });

    const result = await getWalletPnLComputed(WALLET, { limit: 2 });

    expect(result.coverage).toMatchObject({
      limit: 2,
      availableCount: 2,
      analyzedCount: 2,
      returnedCount: 2,
      isCapped: true,
      scope: "limited_filtered_sample",
      coverageKind: "known_result_rows",
      source: "wallet_service_result",
    });
  });

  it("marks PnL coverage complete for the known bounded result below limit", async () => {
    mocks.getWalletSwaps.mockResolvedValue({ swaps: TWO_SWAPS });

    const result = await getWalletPnLComputed(WALLET, { limit: 5 });

    expect(result.coverage).toMatchObject({
      limit: 5,
      availableCount: 2,
      analyzedCount: 2,
      returnedCount: 2,
      isCapped: false,
      scope: "complete_filtered_result",
    });
  });

  it("includes coverage when there is not enough PnL data", async () => {
    mocks.getWalletSwaps.mockResolvedValue({ swaps: TWO_SWAPS.slice(0, 1) });

    const result = await getWalletPnLComputed(WALLET, { limit: 5 });

    expect(result.tradeCount).toBe(0);
    expect(result.coverage).toMatchObject({ availableCount: 1, analyzedCount: 1, isCapped: false });
  });

  it("includes coverage in token-filtered PnL branches", async () => {
    mocks.getWalletSwaps.mockResolvedValue({ swaps: TWO_SWAPS });

    const result = await getWalletPnLComputed(WALLET, { limit: 5, tokenAddress: TOKEN });

    expect(result.allTokenBreakdowns).toHaveLength(1);
    expect(result.coverage).toMatchObject({ availableCount: 2, analyzedCount: 2, isCapped: false });
  });
});
