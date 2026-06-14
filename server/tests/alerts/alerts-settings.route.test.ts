import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("@sv/middlewares/validation.js", async () => {
  const { validator } = await import("hono/validator");
  const { z } = await import("zod");
  return {
    honoJwt: async (c: any, next: any) => {
      c.set("jwtPayload", {
        id: "user-1",
        exp: Math.floor(Date.now() / 1000) + 60,
        displayName: "Test User",
      });
      await next();
    },
    solanaBase58Schema: z.string().trim().min(1),
    validate: (target: "json", schema: any) =>
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
  default: async (c: any, next: any) => {
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
});
