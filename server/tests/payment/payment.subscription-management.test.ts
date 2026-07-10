import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Context, Next } from "hono";
type JsonObject = Record<string, unknown>;
import app from "@sv/routes/payment.route.js";

const { selectWhereMock } = vi.hoisted(() => ({
  selectWhereMock: vi.fn(),
}));

vi.mock("@sv/middlewares/user-extract.js", () => ({
  default: async (c: Context, next: Next) => {
    c.set("userPayload", { id: "user-id-123" });
    await next();
  },
}));

vi.mock("@sv/middlewares/validation.js", () => ({
  honoJwt: async (c: Context, next: Next) => {
    const cookie = c.req.header("Cookie");
    if (!cookie || !cookie.includes("token=")) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    c.set("jwtPayload", { id: "user-id-123" });
    await next();
  },
  validate: () => async (c: Context, next: Next) => {
    const body = await c.req.json();
    c.req.valid = () => body;
    await next();
  },
}));

vi.mock("@sv/db/schema.js", () => ({
  users: {},
  subscriptions: {},
  paymentHistory: {},
}));

vi.mock("@sv/db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          then: (onfulfilled: (value: unknown[]) => unknown) => selectWhereMock().then(onfulfilled),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

vi.mock("@sv/services/stripe.service.js", () => ({
  createSetupIntent: vi.fn(),
  activateSubscription: vi.fn(),
  findOrCreateStripeCustomer: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  cancelSubscription: vi.fn().mockResolvedValue({
    id: "sub_123",
    status: "active",
    cancel_at_period_end: true,
  }),
  upgradeSubscription: vi.fn(),
}));

vi.mock("@sv/services/subscription.service.js", () => ({
  upsertSubscription: vi.fn().mockResolvedValue({
    id: "local-sub-123",
    stripeSubscriptionId: "sub_123",
    cancelAtPeriodEnd: true,
  }),
  recordInvoicePayment: vi.fn(),
}));

vi.mock("@sv/services/users.js", () => ({
  getUserById: vi.fn(),
}));

vi.mock("@sv/services/solana-payment.service.js", () => ({
  verifySolanaTransaction: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
}));

const stripeSubscription = {
  id: "local-sub-123",
  userId: "user-id-123",
  stripeSubscriptionId: "sub_123",
  stripeCustomerId: "cus_123",
  planTier: "Lite",
  status: "active",
};

const solanaSubscription = {
  ...stripeSubscription,
  id: "local-solana-sub-123",
  stripeSubscriptionId: "solana-tx-123",
  stripeCustomerId: "solana-user-id-123",
};

const requestHeaders = {
  "Content-Type": "application/json",
  Cookie: "token=test-token",
};

describe("Payment subscription management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectWhereMock.mockResolvedValue([]);
  });

  it("cancels a Stripe subscription and upserts the Stripe response", async () => {
    const stripeService = await import("@sv/services/stripe.service.js");
    const subscriptionService = await import("@sv/services/subscription.service.js");
    selectWhereMock.mockResolvedValueOnce([stripeSubscription]);

    const response = await app.request("/cancel", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ subscriptionId: "sub_123" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as JsonObject;
    expect(body.success).toBe(true);
    expect(body.cancel_at_period_end).toBe(true);
    expect(stripeService.cancelSubscription).toHaveBeenCalledWith("sub_123");
    expect(subscriptionService.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sub_123", cancel_at_period_end: true }),
    );
  });

  it("rejects Solana cancel requests before calling Stripe", async () => {
    const stripeService = await import("@sv/services/stripe.service.js");
    selectWhereMock.mockResolvedValueOnce([solanaSubscription]);

    const response = await app.request("/cancel", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ subscriptionId: "solana-tx-123" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as JsonObject;
    expect(body.errorCode).toBe("UNSUPPORTED_SUBSCRIPTION_PROVIDER");
    expect(stripeService.cancelSubscription).not.toHaveBeenCalled();
  });

  it("returns 404 before Stripe when the subscription belongs to another user", async () => {
    const stripeService = await import("@sv/services/stripe.service.js");
    selectWhereMock.mockResolvedValueOnce([
      { ...stripeSubscription, userId: "other-user-id" },
    ]);

    const response = await app.request("/cancel", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ subscriptionId: "sub_123" }),
    });

    expect(response.status).toBe(404);
    expect(stripeService.cancelSubscription).not.toHaveBeenCalled();
  });

  it("rejects Solana upgrade requests before calling Stripe", async () => {
    const stripeService = await import("@sv/services/stripe.service.js");
    selectWhereMock.mockResolvedValueOnce([solanaSubscription]);

    const response = await app.request("/upgrade", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ subscriptionId: "solana-tx-123", newTier: "Plus" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as JsonObject;
    expect(body.errorCode).toBe("UNSUPPORTED_SUBSCRIPTION_PROVIDER");
    expect(stripeService.upgradeSubscription).not.toHaveBeenCalled();
  });

  it("records the upgrade invoice in payment history", async () => {
    const stripeService = await import("@sv/services/stripe.service.js");
    const subscriptionService = await import("@sv/services/subscription.service.js");
    const invoice = { id: "inv_upgrade", status: "open" };
    selectWhereMock.mockResolvedValueOnce([stripeSubscription]);
    vi.mocked(stripeService.upgradeSubscription).mockResolvedValueOnce({
      subscription: { id: "sub_123", status: "active" },
      invoice,
      clientSecret: null,
      applied: true,
      processing: true,
    } as never);

    const response = await app.request("/upgrade", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ subscriptionId: "sub_123", newTier: "Plus" }),
    });

    expect(response.status).toBe(200);
    expect(subscriptionService.recordInvoicePayment).toHaveBeenCalledWith(invoice);
  });
});

