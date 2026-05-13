import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock load-env to avoid circular dependency with validation.ts
vi.mock("@sv/util/load-env", () => ({
  default: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_PUBLISHABLE_KEY: "pk_test_mock",
    JWT_SECRET: "test_secret",
  }
}));

import { Hono } from "hono";
import paymentRoute from "@sv/routes/payment.route.js";

// --- Mocks ---

const mockCreateIntent = vi.fn();
const mockCreateCustomer = vi.fn().mockResolvedValue({ id: "cus_new" });

vi.mock("stripe", () => {
  return {
    default: class {
      customers = {
        create: mockCreateCustomer,
      };
      paymentIntents = {
        create: mockCreateIntent,
      };
    },
  };
});

vi.mock("@sv/services/users.js", () => ({
  getUserById: vi.fn(),
}));

vi.mock("@sv/db/index.js", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: "1" }]),
      })),
    })),
  },
}));

vi.mock("hono/jwt", () => ({
  jwt: vi.fn(() => (c: any, next: any) => {
    c.set("jwtPayload", { id: "user_123" });
    return next();
  }),
}));

// --- Tests ---

describe("Payment Route: POST /create-intent", () => {
  const app = new Hono().route("/", paymentRoute);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_mock";
    process.env.JWT_SECRET = "test_secret";
  });

  it("1. Successful Payment Intent: should return clientSecret and 200", async () => {
    const { getUserById } = await import("@sv/services/users.js");
    (getUserById as any).mockResolvedValue({
      id: "user_123",
      email: "test@example.com",
      stripeCustomerId: "cus_existing",
    });

    mockCreateIntent.mockResolvedValue({
      client_secret: "pi_test_secret",
    });

    const res = await app.request("/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "Lite", saveCard: true }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toEqual({
      clientSecret: "pi_test_secret",
      publishableKey: "pk_test_mock",
    });

    // Verify Stripe was called with correct amount for Lite ($39 = 3900 cents)
    expect(mockCreateIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3900,
        customer: "cus_existing",
        setup_future_usage: "off_session",
      })
    );
  });

  it("2. Payment Failure / Card Declined: should return 400 for Stripe card errors", async () => {
    const { getUserById } = await import("@sv/services/users.js");
    (getUserById as any).mockResolvedValue({
      id: "user_123",
      stripeCustomerId: "cus_existing",
    });

    // Simulate a Stripe card error
    const stripeError = new Error("Your card was declined.");
    (stripeError as any).type = "StripeCardError";
    (stripeError as any).code = "card_declined";
    mockCreateIntent.mockRejectedValue(stripeError);

    const res = await app.request("/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "Pro" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toContain("Your card was declined");
  });

  it("3. Validation Error: should return 422 for invalid payload", async () => {
    const res = await app.request("/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "InvalidTier" }), // Not in enum
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.errorCode).toBe("VALIDATION_ERR");
  });

  it("4. Config Error: should return 500 when secret key is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    
    const { getUserById } = await import("@sv/services/users.js");
    (getUserById as any).mockResolvedValue({ id: "user_123" });

    const res = await app.request("/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "Lite" }),
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Stripe is not configured");
  });
});
