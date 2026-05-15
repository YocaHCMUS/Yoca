// server/tests/routes/stripe-webhook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock load-env
vi.mock("@sv/util/load-env", () => ({
  default: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  }
}));

import { Hono } from "hono";
import stripeWebhook from "@sv/routes/stripe-webhook.js";

// --- Mocks ---

const { mockInsert, mockValues, mockOnConflict, mockReturning, mockConstructEvent } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockOnConflict: vi.fn(),
  mockReturning: vi.fn(),
  mockConstructEvent: vi.fn(),
}));

vi.mock("@sv/services/stripe.service.js", () => ({
  constructEvent: mockConstructEvent,
}));

vi.mock("@sv/db/index.js", () => ({
  db: {
    insert: mockInsert,
  },
}));

// Mock the schema objects to avoid import issues in tests
vi.mock("@sv/db/schema.js", () => ({
  subscriptions: { stripeCustomerId: "stripe_customer_id" },
  paymentHistory: {},
  enumPlanTier: {},
  enumSubscriptionStatus: {},
  enumPaymentStatus: {},
}));

describe("Stripe Webhook Route", () => {
  const app = new Hono().route("/", stripeWebhook);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    
    // Reset the mock chain
    mockReturning.mockResolvedValue([{ id: "sub_1" }]);
    mockOnConflict.mockReturnValue({ returning: mockReturning });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it("should process payment_intent.succeeded and save to DB", async () => {
    const mockEvent = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          customer: "cus_123",
          amount: 3900,
          currency: "usd",
          metadata: {
            yocaUserId: "user_123",
            tier: "Lite",
          },
          payment_method_details: {
            card: {
              brand: "visa",
              last4: "4242",
            },
          },
        },
      },
    };

    mockConstructEvent.mockReturnValue(mockEvent);

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
      body: "{}", // Body content doesn't matter much because of the mock
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    
    // Check if db.insert was called twice (once for subscriptions, once for history)
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("should return 400 if signature is missing", async () => {
    const res = await app.request("/", {
      method: "POST",
      body: "{}",
    });

    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Missing signature");
  });

  it("should return 500 if webhook secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    
    const res = await app.request("/", {
      method: "POST",
      headers: {
        "stripe-signature": "t=123,v1=abc",
      },
      body: "{}",
    });

    expect(res.status).toBe(500);
    expect(await res.text()).toContain("Server configuration issue");
  });
});
