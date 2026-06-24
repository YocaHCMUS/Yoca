import {
  evaluateTradingEventAlert,
  evaluateTradingEventTransaction,
  extractTradingTokenMints,
  type TradingEventAlertRuntime,
  type TradingEventEvaluatorDependencies,
} from "@sv/services/alerts/trading-event-evaluator.js";
import type { HeliusEnhancedTransaction } from "@sv/services/walletAlerts.service.js";
import { describe, expect, it, vi } from "vitest";

const TOKEN = "So11111111111111111111111111111111111111112";
const WALLET = "3nMNd89AxwHUa1AFvQGqohRkxFEQsTsgiEyEyqXFHyyH";
const OTHER = "ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn";
const UNRELATED = "8hF8yfsx2eYpJj5k4D7qPaYyxUuYXHfQW5B1thZf1B2u";

function alert(overrides: Partial<TradingEventAlertRuntime> = {}): TradingEventAlertRuntime {
  return {
    id: "alert-1",
    userId: "user-1",
    name: "SOL trade",
    triggerMode: "always",
    target: { tokenAddress: TOKEN, walletAddress: null },
    condition: { eventType: "any_trade", minSolAmount: null },
    delivery: { email: "alerts@example.com", discordEnabled: true },
    discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
    ...overrides,
  };
}

function swapTx(signature = "trade-signature"): HeliusEnhancedTransaction {
  return {
    signature,
    type: "SWAP",
    source: "JUPITER",
    timestamp: 1777958632,
    feePayer: WALLET,
    tokenTransfers: [{ mint: TOKEN, tokenAmount: 2, fromUserAccount: OTHER, toUserAccount: WALLET }],
    nativeTransfers: [{ amount: 2_000_000_000, fromUserAccount: WALLET, toUserAccount: OTHER }],
  };
}

function deps(active: TradingEventAlertRuntime[], delivered = new Set<string>()): TradingEventEvaluatorDependencies {
  return {
    stopExpiredAlerts: vi.fn().mockResolvedValue(0),
    loadActiveAlerts: vi.fn().mockResolvedValue(active),
    wasDelivered: vi.fn(async (alertId, signature) => delivered.has(`${alertId}:${signature}`)),
    recordDelivery: vi.fn(async ({ alert: row, signature }) => { delivered.add(`${row.id}:${signature}`); }),
    stopAlert: vi.fn().mockResolvedValue(undefined),
    sendDiscord: vi.fn().mockResolvedValue({ ok: true, status: 204 }),
    sendEmail: vi.fn().mockResolvedValue(true),
  };
}

describe("trading event webhook evaluator", () => {
  it("finds the selected mint in tokenTransfers", () => {
    expect(extractTradingTokenMints(swapTx())).toContain(TOKEN);
    expect(evaluateTradingEventAlert(alert(), swapTx()).matched).toBe(true);
  });

  it("matches an optional wallet from fee payer and transfers", () => {
    expect(evaluateTradingEventAlert(alert({ target: { tokenAddress: TOKEN, walletAddress: WALLET } }), swapTx()).matched).toBe(true);
  });

  it("does not match a different token or wallet", () => {
    expect(evaluateTradingEventAlert(alert({ target: { tokenAddress: OTHER, walletAddress: null } }), swapTx()).matched).toBe(false);
    expect(evaluateTradingEventAlert(alert({ target: { tokenAddress: TOKEN, walletAddress: UNRELATED } }), { ...swapTx(), feePayer: WALLET, tokenTransfers: [{ mint: TOKEN, toUserAccount: WALLET }] }).matched).toBe(false);
  });

  it("matches any_trade and swap conditions for swap-like payloads", () => {
    expect(evaluateTradingEventAlert(alert({ condition: { eventType: "any_trade", minSolAmount: 1 } }), swapTx()).matched).toBe(true);
    expect(evaluateTradingEventAlert(alert({ condition: { eventType: "swap", minSolAmount: 2 } }), swapTx()).matched).toBe(true);
  });

  it("sends delivery once and skips a duplicate signature", async () => {
    const sent = new Set<string>();
    const mockDeps = deps([alert()], sent);
    const first = await evaluateTradingEventTransaction(swapTx("dup"), { dependencies: mockDeps });
    const second = await evaluateTradingEventTransaction(swapTx("dup"), { dependencies: mockDeps });
    expect(first.delivered).toBe(1);
    expect(second.duplicateSkipped).toBe(1);
    expect(mockDeps.sendDiscord).toHaveBeenCalledTimes(1);
    expect(mockDeps.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("stops a once alert after a successful notification", async () => {
    const once = alert({ triggerMode: "once" });
    const mockDeps = deps([once]);
    const summary = await evaluateTradingEventTransaction(swapTx(), { dependencies: mockDeps });
    expect(summary.delivered).toBe(1);
    expect(mockDeps.stopAlert).toHaveBeenCalledWith(once.id);
  });
});
