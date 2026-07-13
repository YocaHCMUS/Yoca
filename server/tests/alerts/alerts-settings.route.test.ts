import type { Context, Next } from "hono";
import type { ZodType } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestContext = Context<{
  Variables: {
    jwtPayload: { id: string; exp: number; displayName: string };
    userPayload: { id: string; exp: number; displayName: string };
  };
}>;

const serviceMocks = vi.hoisted(() => ({
  createAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  listActiveAlertRules: vi.fn(),
  addFollowedWallet: vi.fn(),
  getUserAlertSettings: vi.fn(),
  isUniqueViolation: vi.fn(),
  listFollowedWallets: vi.fn(),
  removeFollowedWallet: vi.fn(),
  setUserDiscordUrl: vi.fn(),
  setUserEmailAlertSettings: vi.fn(),
  syncHeliusWebhookAccountAddresses: vi.fn(),
  getHeliusWebhookDiagnostics: vi.fn(),
  listAlertHistory: vi.fn(),
  markAllAlertHistoryRead: vi.fn(),
  setAlertHistoryReadState: vi.fn(),
}));

vi.mock("@sv/middlewares/validation.js", async () => {
  const { validator } = await import("hono/validator");
  const { z } = await import("zod");
  return {
    honoJwt: async (c: TestContext, next: Next) => {
      c.set("jwtPayload", {
        id: "user-1",
        exp: Math.floor(Date.now() / 1000) + 60,
        displayName: "Test User",
      });
      await next();
    },
    solanaBase58Schema: z.string().trim().min(1),
    validate: (target: "json", schema: ZodType) =>
      validator(target, (value, c) => {
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
          return c.json({ error: "validation" }, 422);
        }
        return parsed.data;
      }),
  };
});

vi.mock("@sv/middlewares/user-extract.js", () => ({
  default: async (c: TestContext, next: Next) => {
    c.set("userPayload", {
      id: "user-1",
      exp: Math.floor(Date.now() / 1000) + 60,
      displayName: "Test User",
    });
    await next();
  },
}));

vi.mock("@sv/services/alertRules.service.js", () => ({
  createAlertRule: serviceMocks.createAlertRule,
  deleteAlertRule: serviceMocks.deleteAlertRule,
  listActiveAlertRules: serviceMocks.listActiveAlertRules,
}));

vi.mock("@sv/services/followedWallets.service.js", () => ({
  addFollowedWallet: serviceMocks.addFollowedWallet,
  getUserAlertSettings: serviceMocks.getUserAlertSettings,
  isUniqueViolation: serviceMocks.isUniqueViolation,
  listFollowedWallets: serviceMocks.listFollowedWallets,
  removeFollowedWallet: serviceMocks.removeFollowedWallet,
  setUserDiscordUrl: serviceMocks.setUserDiscordUrl,
  setUserEmailAlertSettings: serviceMocks.setUserEmailAlertSettings,
  syncHeliusWebhookAccountAddresses:
    serviceMocks.syncHeliusWebhookAccountAddresses,
}));

vi.mock("@sv/services/heliusWebhooks.service.js", () => ({
  getHeliusWebhookDiagnostics: serviceMocks.getHeliusWebhookDiagnostics,
}));

vi.mock("@sv/services/alertHistory.service.js", () => ({
  listAlertHistory: serviceMocks.listAlertHistory,
  markAllAlertHistoryRead: serviceMocks.markAllAlertHistoryRead,
  setAlertHistoryReadState: serviceMocks.setAlertHistoryReadState,
}));

import alertsRoute from "@sv/routes/alerts.route.js";

describe("alerts settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getUserAlertSettings.mockResolvedValue({
      discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
      registeredEmail: "alerts@example.com",
      emailAlertsEnabled: false,
      emailAlertsAddress: null,
    });
    serviceMocks.getHeliusWebhookDiagnostics.mockResolvedValue({
      totalWatchedAddressCount: 26,
      maxAddressesPerWebhook: 25,
      requiredHeliusWebhookCount: 2,
      managedHeliusWebhookCount: 2,
      shardAddressCounts: [],
      oldEnvWebhookConfigured: false,
      oldEnvWebhookIdPresent: false,
      legacyCutoverRequired: false,
      publicWebhookUrlConfigured: true,
      publicWebhookUrlLooksLocalhost: false,
      lastShardSyncStatus: "ok",
      lastShardSyncError: null,
      lastSuccessfulShardSyncAt: "2026-06-11T00:00:00.000Z",
      warnings: [],
      lastSyncStatus: "ok",
      lastSyncError: null,
      configured: {
        publicWebhookUrl: true,
        heliusApiKey: true,
        heliusWebhookAuthKey: true,
      },
    });
    serviceMocks.listAlertHistory.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      unreadCount: 0,
    });
    serviceMocks.markAllAlertHistoryRead.mockResolvedValue([]);
  });

  it("lists alert history for the authenticated user", async () => {
    const response = await alertsRoute.request("/history?page=2&limit=10");

    expect(response.status).toBe(200);
    expect(serviceMocks.listAlertHistory).toHaveBeenCalledWith("user-1", 2, 10);
  });

  it("does not expose another user's alert history read state", async () => {
    serviceMocks.setAlertHistoryReadState.mockResolvedValue(null);
    const response = await alertsRoute.request(
      "/history/11111111-1111-4111-8111-111111111111/read",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ read: true }),
      },
    );

    expect(response.status).toBe(404);
    expect(serviceMocks.setAlertHistoryReadState).toHaveBeenCalledWith(
      "user-1",
      "11111111-1111-4111-8111-111111111111",
      true,
    );
  });

  it("marks all alert history as read for the authenticated user", async () => {
    serviceMocks.markAllAlertHistoryRead.mockResolvedValue([
      { id: "history-1" },
      { id: "history-2" },
    ]);
    const response = await alertsRoute.request("/history/read-all", {
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ updatedCount: 2 });
    expect(serviceMocks.markAllAlertHistoryRead).toHaveBeenCalledWith("user-1");
  });

  it("persists emailAlertsEnabled=true from the UI payload", async () => {
    serviceMocks.getUserAlertSettings
      .mockResolvedValueOnce({
        discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
        registeredEmail: "alerts@example.com",
        emailAlertsEnabled: false,
        emailAlertsAddress: null,
      })
      .mockResolvedValueOnce({
        discordWebhookUrl: "https://discord.com/api/webhooks/test/token",
        registeredEmail: "alerts@example.com",
        emailAlertsEnabled: true,
        emailAlertsAddress: null,
      });

    const response = await alertsRoute.request("/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        emailAlertsEnabled: true,
        emailAlertsAddress: null,
      }),
    });

    expect(response.status).toBe(200);
    expect(serviceMocks.setUserEmailAlertSettings).toHaveBeenCalledWith(
      "user-1",
      {
        emailAlertsEnabled: true,
        emailAlertsAddress: null,
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      emailAlertsEnabled: true,
    });
  });

  it("accepts snake_case email setting aliases", async () => {
    await alertsRoute.request("/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email_alerts_enabled: true,
        email_alerts_address: "override@example.com",
      }),
    });

    expect(serviceMocks.setUserEmailAlertSettings).toHaveBeenCalledWith(
      "user-1",
      {
        emailAlertsEnabled: true,
        emailAlertsAddress: "override@example.com",
      },
    );
  });

  it("returns dev-only Helius shard diagnostics without exposing env values", async () => {
    const response = await alertsRoute.request("/diagnostics");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalWatchedAddressCount: 26,
      maxAddressesPerWebhook: 25,
      requiredHeliusWebhookCount: 2,
      oldEnvWebhookConfigured: false,
      legacyCutoverRequired: false,
      publicWebhookUrlConfigured: true,
      configured: {
        publicWebhookUrl: true,
        heliusApiKey: true,
      },
    });
  });

  it("returns the saved wallet when Helius sync throws after insert", async () => {
    serviceMocks.addFollowedWallet.mockResolvedValue({
      id: 1,
      userId: "user-1",
      address: "Wallet0001",
      label: null,
    });
    serviceMocks.syncHeliusWebhookAccountAddresses.mockRejectedValue(
      new Error('relation "helius_webhooks" does not exist'),
    );

    const response = await alertsRoute.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "Wallet0001", label: null }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      wallet: { address: "Wallet0001" },
      heliusSync: {
        ok: false,
        error: expect.stringContaining("helius_webhooks"),
      },
    });
  });
});
