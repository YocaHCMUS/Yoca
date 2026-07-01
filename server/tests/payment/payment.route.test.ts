import "@sv/util/load-env.js";
import { describe, expect, it, vi, beforeEach } from "vitest";
import app from "@sv/routes/payment.route.js";
import { sign } from "hono/jwt";
import env from "@sv/util/load-env.js";

// Mock honoJwt to inject mock userPayload and pass validation checks
vi.mock("@sv/middlewares/validation.js", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    honoJwt: async (c: any, next: any) => {
      const cookie = c.req.header("Cookie");
      if (!cookie || !cookie.includes("token=")) {
        return c.json({ error: "UNAUTHORIZED" }, 401);
      }
      c.set("jwtPayload", {
        id: "user-id-123",
        displayName: "Test User",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      await next();
    },
  };
});

// Mock Database
const mockSelectResult = {
  stripeSubscriptionId: "solana-tx-123",
  userId: "user-id-123",
  stripeCustomerId: "solana-user-id-123",
  planTier: "Lite",
  status: "active",
};

const selectWhereMock = vi.fn().mockResolvedValue([]);
const selectLimitMock = vi.fn().mockResolvedValue([]);

vi.mock("@sv/db/index.js", () => {
  const fromMock = vi.fn(() => ({
    where: vi.fn((...args) => {
      // Return limit mock or promise directly depending on use case
      return {
        limit: selectLimitMock,
        then: (onfulfilled: any) => selectWhereMock().then(onfulfilled),
      };
    }),
  }));
  
  const setMock = vi.fn(() => ({
    where: vi.fn().mockResolvedValue([{ id: "updated-id" }]),
  }));

  const valuesMock = vi.fn(() => ({
    returning: vi.fn().mockResolvedValue([mockSelectResult]),
  }));

  return {
    db: {
      select: vi.fn(() => ({
        from: fromMock,
      })),
      update: vi.fn(() => ({
        set: setMock,
      })),
      insert: vi.fn(() => ({
        values: valuesMock,
      })),
    },
  };
});

// Mock Stripe Service
vi.mock("@sv/services/stripe.service.js", () => {
  const mockStripeClient = {
    invoices: {
      list: vi.fn().mockResolvedValue({ data: [{ id: "inv_123" }] }),
      retrieve: vi.fn().mockResolvedValue({ id: "inv_123", subscription: "sub_123" }),
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({ id: "sub_123", status: "active" }),
    },
  };
  return {
    findOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_123"),
    createSetupIntent: vi.fn().mockResolvedValue({ id: "seti_123", client_secret: "seti_secret_123" }),
    activateSubscription: vi.fn().mockResolvedValue({ id: "sub_123", status: "active" }),
    retrievePaymentIntent: vi.fn().mockResolvedValue({ status: "succeeded" }),
    cancelSubscription: vi.fn().mockResolvedValue({ status: "canceled", cancel_at_period_end: true }),
    upgradeSubscription: vi.fn().mockResolvedValue({ subscription: { id: "sub_123", status: "active" }, clientSecret: null }),
    getStripe: () => mockStripeClient,
  };
});

// Mock UserService
vi.mock("@sv/services/users.js", () => ({
  getUserById: vi.fn().mockResolvedValue({
    id: "user-id-123",
    email: "test@example.com",
    stripeCustomerId: "cus_123",
  }),
}));

// Mock Subscription Service
vi.mock("@sv/services/subscription.service.js", () => ({
  upsertSubscription: vi.fn().mockResolvedValue({ id: "sub_123", status: "active" }),
  recordInvoicePayment: vi.fn().mockResolvedValue(true),
}));

// Mock Solana Payment Service
vi.mock("@sv/services/solana-payment.service.js", () => ({
  verifySolanaTransaction: vi.fn().mockResolvedValue({
    valid: true,
    amountUsd: 10,
    amountSol: 0.1,
    merchantAddress: "merchant-pubkey",
  }),
}));

describe("Hono Payment Route", () => {
  let mockToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    selectWhereMock.mockResolvedValue([]);
    selectLimitMock.mockResolvedValue([]);

    // Generate a valid JWT token for Hono JWT middleware
    mockToken = await sign(
      {
        id: "user-id-123",
        displayName: "Test User",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      env.JWT_SECRET
    );
  });

  describe("POST /setup-intent", () => {
    it("should return clientSecret and publishableKey when authenticated", async () => {
      const response = await app.request("/setup-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({
          tier: "Lite",
          paymentMethod: "card",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty("clientSecret", "seti_secret_123");
      expect(data).toHaveProperty("publishableKey");
    });

    it("should return 401 Unauthorized if token cookie is missing", async () => {
      const response = await app.request("/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "Lite",
          paymentMethod: "card",
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /activate-subscription", () => {
    it("should activate subscription successfully", async () => {
      const subscriptionService = await import("@sv/services/subscription.service.js");
      const response = await app.request("/activate-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({
          paymentMethodId: "pm_123",
          tier: "Lite",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.subscriptionId).toBe("sub_123");
      expect(subscriptionService.recordInvoicePayment).toHaveBeenCalledWith(
        expect.objectContaining({ id: "inv_123" }),
      );
    });
  });

  describe("POST /cancel", () => {
    it("should cancel a Stripe-managed subscription and sync the updated subscription", async () => {
      const stripeService = await import("@sv/services/stripe.service.js");
      const subscriptionService = await import("@sv/services/subscription.service.js");
      const stripeSub = {
        ...mockSelectResult,
        stripeSubscriptionId: "sub_123",
      };
      const updatedStripeSub = {
        id: "sub_123",
        status: "active",
        cancel_at_period_end: true,
      };

      selectWhereMock.mockResolvedValueOnce([stripeSub]);
      vi.mocked(stripeService.cancelSubscription).mockResolvedValueOnce(
        updatedStripeSub as any,
      );

      const response = await app.request("/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({ subscriptionId: "sub_123" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.cancel_at_period_end).toBe(true);
      expect(stripeService.cancelSubscription).toHaveBeenCalledWith("sub_123");
      expect(subscriptionService.upsertSubscription).toHaveBeenCalledWith(
        updatedStripeSub,
      );
    });

    it("should reject Solana subscriptions before calling Stripe", async () => {
      const stripeService = await import("@sv/services/stripe.service.js");
      selectWhereMock.mockResolvedValueOnce([mockSelectResult]);

      const response = await app.request("/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({ subscriptionId: "solana-tx-123" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.errorCode).toBe("UNSUPPORTED_SUBSCRIPTION_PROVIDER");
      expect(stripeService.cancelSubscription).not.toHaveBeenCalled();
    });

    it("should return 404 when the subscription belongs to another user", async () => {
      const stripeService = await import("@sv/services/stripe.service.js");
      selectWhereMock.mockResolvedValueOnce([
        {
          ...mockSelectResult,
          stripeSubscriptionId: "sub_123",
          userId: "other-user-id",
        },
      ]);

      const response = await app.request("/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({ subscriptionId: "sub_123" }),
      });

      expect(response.status).toBe(404);
      expect(stripeService.cancelSubscription).not.toHaveBeenCalled();
    });
  });

  describe("POST /upgrade", () => {
    it("should reject Solana subscriptions before calling Stripe", async () => {
      const stripeService = await import("@sv/services/stripe.service.js");
      selectWhereMock.mockResolvedValueOnce([mockSelectResult]);

      const response = await app.request("/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({
          subscriptionId: "solana-tx-123",
          newTier: "Plus",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.errorCode).toBe("UNSUPPORTED_SUBSCRIPTION_PROVIDER");
      expect(stripeService.upgradeSubscription).not.toHaveBeenCalled();
    });
  });

  describe("POST /verify-solana", () => {
    it("should verify solana transaction and insert subscription", async () => {
      const response = await app.request("/verify-solana", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({
          txId: "4S4f9U5Jv6dG7eH8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m", // valid signature size
          tier: "Lite",
          network: "testnet",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.subscriptionId).toBe("solana-tx-123");
    });

    it("should fail verification and return 400 if service rejects transaction", async () => {
      const solanaPaymentService = await import("@sv/services/solana-payment.service.js");
      vi.mocked(solanaPaymentService.verifySolanaTransaction).mockResolvedValueOnce({
        valid: false,
        reason: "Amount mismatch",
      });

      const response = await app.request("/verify-solana", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${mockToken}`,
        },
        body: JSON.stringify({
          txId: "4S4f9U5Jv6dG7eH8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m",
          tier: "Lite",
          network: "testnet",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.errorCode).toBe("PAYMENT_VERIFICATION_FAILED");
      expect(data.message).toBe("Amount mismatch");
    });
  });
});
