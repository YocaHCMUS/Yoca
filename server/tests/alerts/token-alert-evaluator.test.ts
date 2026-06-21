import {
  compareAlertValues,
  evaluateRunningTokenAlerts,
  evaluateTokenAlert,
  type TokenAlertEvaluatorDependencies,
  type TokenAlertRuntime,
} from "@sv/services/alerts/token-alert-evaluator.js";
import { describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-02T12:00:00.000Z");

function makeAlert(overrides: Partial<TokenAlertRuntime> = {}): TokenAlertRuntime {
  return {
    id: "alert-1",
    userId: "user-1",
    name: "SOL test",
    triggerMode: "once",
    expiresAt: new Date("2030-01-03T00:00:00.000Z"),
    tokenAddress: "So11111111111111111111111111111111111111112",
    tokenName: "Wrapped SOL",
    tokenSymbol: "SOL",
    conditions: [{ id: "condition-1", metric: "price_usd", period: "1h", conditionOp: "gt", value: 100 }],
    delivery: { email: "alerts@example.com", discordEnabled: true },
    discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
    ...overrides,
  };
}

function points() {
  return [
    { timestamp: NOW.getTime() - 2 * 60 * 60 * 1000, price: 90 },
    { timestamp: NOW.getTime() - 60 * 60 * 1000, price: 100 },
    { timestamp: NOW.getTime(), price: 110 },
  ];
}

function deps(alerts: TokenAlertRuntime[], overrides: Partial<TokenAlertEvaluatorDependencies> = {}) {
  return {
    stopExpiredAlerts: vi.fn().mockResolvedValue(0),
    loadRunningAlerts: vi.fn().mockResolvedValue(alerts),
    getChart: vi.fn().mockResolvedValue(points()),
    getLastDeliveredAt: vi.fn().mockResolvedValue(null),
    sendDiscord: vi.fn().mockResolvedValue({ ok: true, status: 204 }),
    sendEmail: vi.fn().mockResolvedValue(true),
    recordDelivery: vi.fn().mockResolvedValue(undefined),
    stopAlert: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies TokenAlertEvaluatorDependencies;
}

describe("token stats alert evaluator", () => {
  it.each([
    ["gt", false], ["gte", true], ["eq", true], ["lt", false], ["lte", true],
  ] as const)("evaluates %s operators", (operator, expected) => {
    expect(compareAlertValues(10, 10, operator)).toBe(expected);
  });

  it("evaluates current USD price", () => {
    const result = evaluateTokenAlert(makeAlert(), points(), NOW);
    expect(result.currentPriceUsd).toBe(110);
    expect(result.matched).toBe(true);
  });

  it("evaluates percentage change over the selected period", () => {
    const alert = makeAlert({
      conditions: [{ id: "condition-1", metric: "price_percentage", period: "1h", conditionOp: "gte", value: 10 }],
    });
    const result = evaluateTokenAlert(alert, points(), NOW);
    expect(result.conditions[0]?.actualValue).toBe(10);
    expect(result.matched).toBe(true);
  });

  it("requires every condition to match", () => {
    const alert = makeAlert({
      conditions: [
        { id: "price", metric: "price_usd", period: "1h", conditionOp: "gt", value: 100 },
        { id: "change", metric: "price_percentage", period: "1h", conditionOp: "gt", value: 20 },
      ],
    });
    expect(evaluateTokenAlert(alert, points(), NOW).matched).toBe(false);
  });

  it("reports unavailable percentage history instead of firing", () => {
    const alert = makeAlert({
      conditions: [{ id: "condition-1", metric: "price_percentage", period: "24h", conditionOp: "gt", value: 1 }],
    });
    const result = evaluateTokenAlert(alert, points(), NOW);
    expect(result.matched).toBe(false);
    expect(result.conditions[0]?.unavailableReason).toContain("insufficient");
  });

  it("stops expired alerts before loading running alerts", async () => {
    const d = deps([], { stopExpiredAlerts: vi.fn().mockResolvedValue(2) });
    const summary = await evaluateRunningTokenAlerts({ now: NOW, dependencies: d });
    expect(summary.expiredStopped).toBe(2);
    expect(d.loadRunningAlerts).toHaveBeenCalledWith(NOW);
  });

  it("delivers a matching once alert, records history, and stops it", async () => {
    const d = deps([makeAlert()]);
    const summary = await evaluateRunningTokenAlerts({ now: NOW, dependencies: d });
    expect(summary.delivered).toBe(1);
    expect(d.sendDiscord).toHaveBeenCalledTimes(1);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.recordDelivery).toHaveBeenCalledTimes(1);
    expect(d.stopAlert).toHaveBeenCalledWith("alert-1");
  });

  it("does not deliver when a condition fails", async () => {
    const d = deps([makeAlert({ conditions: [{ id: "condition-1", metric: "price_usd", period: "1h", conditionOp: "gt", value: 1000 }] })]);
    const summary = await evaluateRunningTokenAlerts({ now: NOW, dependencies: d });
    expect(summary.delivered).toBe(0);
    expect(d.sendDiscord).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
  });

  it("does not deliver an always alert again during cooldown", async () => {
    vi.stubEnv("TOKEN_ALERT_NOTIFICATION_COOLDOWN_MS", "900000");
    const d = deps([makeAlert({ triggerMode: "always" })], {
      getLastDeliveredAt: vi.fn().mockResolvedValue(new Date(NOW.getTime() - 60_000)),
    });
    const summary = await evaluateRunningTokenAlerts({ now: NOW, dependencies: d });
    expect(summary.cooldownSkipped).toBe(1);
    expect(d.sendDiscord).not.toHaveBeenCalled();
    expect(d.sendEmail).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
