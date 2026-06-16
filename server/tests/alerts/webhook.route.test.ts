import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  processHeliusWebhookTransactions: vi.fn(),
}));

vi.mock("@sv/services/walletAlerts.service.js", () => ({
  processHeliusWebhookTransactions: serviceMocks.processHeliusWebhookTransactions,
}));

import webhookRoute from "@sv/routes/webhook.js";

describe("Helius webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HELIUS_WEBHOOK_AUTH_KEY", "route-auth");
    serviceMocks.processHeliusWebhookTransactions.mockResolvedValue({
      processed: 1,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("processes payloads from any managed shard through the same /webhook route", async () => {
    const payload = [{ signature: "sig-a", type: "TRANSFER" }];

    const first = await webhookRoute.request("/", {
      method: "POST",
      headers: {
        authorization: "route-auth",
        "content-type": "application/json",
        "x-helius-webhook-id": "managed-shard-1",
      },
      body: JSON.stringify(payload),
    });
    const second = await webhookRoute.request("/", {
      method: "POST",
      headers: {
        authorization: "route-auth",
        "content-type": "application/json",
        "x-helius-webhook-id": "managed-shard-2",
      },
      body: JSON.stringify(payload),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(serviceMocks.processHeliusWebhookTransactions).toHaveBeenCalledTimes(2);
    expect(serviceMocks.processHeliusWebhookTransactions).toHaveBeenCalledWith(
      payload,
      { dryRun: false, dedupe: true, log: true },
    );
  });
});
