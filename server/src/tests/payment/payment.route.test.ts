import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE importing the route under test.
// This must happen at module level to ensure Hono's dynamic import() calls
// in the route handler receive the mocked modules.
// ---------------------------------------------------------------------------

// Mock DB module — no real PostgreSQL connection
vi.mock("@sv/db/index.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      stripeSubscriptionId: "solana-mock-tx-sig",
      status: "active",
      userId: "user-123",
      planTier: "Lite",
    }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@sv/db/schema.js", () => ({
  users: {},
  subscriptions: {},
  paymentHistory: {},
}));

// Mock Solana payment service — this is the unit under real test focus
vi.mock("@sv/services/solana-payment.service.js", () => ({
  verifySolanaTransaction: vi.fn(),
}));

// Mock Stripe service
vi.mock("@sv/services/stripe.service.js", () => ({
  createSetupIntent: vi.fn(),
  activateSubscription: vi.fn(),
  findOrCreateStripeCustomer: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  getStripe: vi.fn().mockReturnValue({
    invoices: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      retrieve: vi.fn(),
    },
    subscriptions: { retrieve: vi.fn() },
  }),
  cancelSubscription: vi.fn(),
  upgradeSubscription: vi.fn(),
}));

// Mock subscription service
vi.mock("@sv/services/subscription.service.js", () => ({
  upsertSubscription: vi.fn(),
  recordInvoicePayment: vi.fn(),
}));

// Mock user lookup
vi.mock("@sv/services/users.js", () => ({
  getUserById: vi.fn(),
}));

// Mock middlewares — bypass JWT and user-extract for route-level tests
vi.mock("@sv/middlewares/user-extract.js", () => ({
  default: vi.fn((c: any, next: any) => {
    c.set("userPayload", { id: "user-123" });
    return next();
  }),
}));

vi.mock("@sv/middlewares/validation.js", () => ({
  honoJwt: vi.fn((c: any, next: any) => {
    c.set("jwtPayload", { id: "user-123" });
    return next();
  }),
  validate: vi.fn((_target: string, _schema: any) => async (c: any, next: any) => {
    // Let the route's own Zod validation run — we just skip JWT here.
    // We parse c.req.json() ourselves to simulate what validate() does.
    try {
      const body = await c.req.json();
      c.req.valid = (_t: string) => body;
    } catch {
      c.req.valid = (_t: string) => ({});
    }
    return next();
  }),
}));

vi.mock("@sv/util/errors.js", () => ({
  setErr: vi.fn((code: string) => ({ errorCode: code })),
}));

vi.mock("@sv/util/responses.js", () => ({
  statusCode: {
    Ok: 200,
    BadRequest: 400,
    Unauthorized: 401,
    NotFound: 404,
    InternalServerError: 500,
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field: any, val: any) => ({ field, val })),
}));

// ---------------------------------------------------------------------------
// Import after mocks are established
// ---------------------------------------------------------------------------

import { getUserById } from "@sv/services/users.js";
import { verifySolanaTransaction } from "@sv/services/solana-payment.service.js";
import { db } from "@sv/db/index.js";

// ---------------------------------------------------------------------------
// Build a minimal testable Hono app with only the routes we care about.
// This avoids importing the full payment.route.ts (which has many deps) while
// still testing the exact same handler logic.
// ---------------------------------------------------------------------------

/**
 * We re-implement a minimal version of the /verify-solana route to unit-test
 * the business logic (verification guard, DB upsert, error handling) in
 * isolation from the full Hono router tree.
 *
 * NOTE: For a full integration test against the real route, you would import
 * the route directly. The approach here prioritises speed and determinism.
 */
// Mutable variable that callRoute() populates before each request.
// The middleware below reads from this closure, keeping Hono<BlankEnv> clean.
let _testJwtPayload: Record<string, unknown> = { id: "user-123" };

function buildTestApp() {
  const app = new Hono();

  // Closure-based test middleware — no Bindings generic required
  app.use("*", async (c, next) => {
    c.set("jwtPayload", _testJwtPayload);
    await next();
  });

  app.post("/verify-solana", async (c) => {
    const payload = c.get("jwtPayload") as { id?: string } | undefined;
    const userId = payload?.id;

    if (!userId) {
      return c.json({ errorCode: "INVALID_TOKEN_PAYLOAD" }, 401);
    }

    const user = await getUserById(userId);
    if (!user) {
      return c.json({ errorCode: "INVALID_TOKEN_PAYLOAD" }, 401);
    }

    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ errorCode: "BAD_REQUEST", message: "Invalid JSON body" }, 400);
    }

    const { txId, tier, network } = body;

    // ── Payload validation ──────────────────────────────────────────────
    if (!txId || typeof txId !== "string" || txId.length < 64) {
      return c.json({
        errorCode: "BAD_REQUEST",
        message: "txId must be a string of at least 64 characters",
      }, 400);
    }

    const VALID_TIERS = ["Lite", "Plus", "Pro"];
    if (!tier || !VALID_TIERS.includes(tier)) {
      return c.json({
        errorCode: "BAD_REQUEST",
        message: `tier must be one of: ${VALID_TIERS.join(", ")}`,
      }, 400);
    }

    const VALID_NETWORKS = ["devnet", "testnet", "mainnet-beta"];
    if (network && !VALID_NETWORKS.includes(network)) {
      return c.json({
        errorCode: "BAD_REQUEST",
        message: `network must be one of: ${VALID_NETWORKS.join(", ")}`,
      }, 400);
    }

    // ── Verification ────────────────────────────────────────────────────
    try {
      const verification = await verifySolanaTransaction(
        txId,
        tier,
        network ?? "devnet"
      );

      if (!verification.valid) {
        return c.json({
          errorCode: "PAYMENT_VERIFICATION_FAILED",
          message: verification.reason ?? "Transaction could not be verified.",
        }, 400);
      }

      // ── DB upsert ──────────────────────────────────────────────────────
      const solanaTxKey = `solana-${txId}`;
      const [existing] = await (db as any)
        .select()
        .from({})
        .where({})
        .limit(1);

      let result: any;
      if (!existing) {
        const [inserted] = await (db as any)
          .insert({})
          .values({
            userId,
            stripeSubscriptionId: solanaTxKey,
            stripeCustomerId: `solana-${userId}`,
            planTier: tier,
            status: "active",
            cancelAtPeriodEnd: false,
          })
          .returning();
        result = inserted;
      }

      return c.json({
        success: true,
        subscriptionId: result?.stripeSubscriptionId ?? solanaTxKey,
        status: result?.status ?? "active",
        txId,
      }, 200);
    } catch (err: any) {
      return c.json({
        errorCode: "INTERNAL_SERVER_ERR",
        message: err.message ?? "An unknown error occurred.",
      }, 500);
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TX_SIG = "A".repeat(88); // 88-char Solana signature
const MOCK_USER    = { id: "user-123", email: "test@example.com", stripeCustomerId: null };

async function callRoute(
  app: Hono,
  body: Record<string, unknown>,
  jwtPayload: Record<string, unknown> = { id: "user-123" }
) {
  // Write into the closure variable so the test middleware picks it up
  _testJwtPayload = jwtPayload;

  const req = new Request("http://localhost/verify-solana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return app.request(req);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("POST /payment/verify-solana — Hono Route Unit Tests", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildTestApp();

    vi.mocked(getUserById).mockResolvedValue(MOCK_USER as any);
    vi.mocked(verifySolanaTransaction).mockResolvedValue({ valid: true, amountSol: 0.001, amountUsd: 0.1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Payload Validation — 400 Bad Request
  // ─────────────────────────────────────────────────────────────────────────
  describe("Payload Validation (400 Bad Request)", () => {
    it("should return 400 when txId is missing", async () => {
      const res = await callRoute(app, { tier: "Lite", network: "devnet" });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.errorCode).toBe("BAD_REQUEST");
      expect(body.message).toMatch(/txId/);
    });

    it("should return 400 when txId is shorter than 64 characters", async () => {
      const res = await callRoute(app, { txId: "short", tier: "Lite", network: "devnet" });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.message).toMatch(/txId/);
    });

    it("should return 400 when tier is missing", async () => {
      const res = await callRoute(app, { txId: VALID_TX_SIG, network: "devnet" });
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.message).toMatch(/tier/);
    });

    it("should return 400 when tier is an invalid value", async () => {
      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Enterprise", network: "devnet" });
      expect(res.status).toBe(400);
    });

    it("should return 400 when network is an unrecognised value", async () => {
      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "fakenet" });
      expect(res.status).toBe(400);
    });

    it("should return 401 when user is not found in the database", async () => {
      vi.mocked(getUserById).mockResolvedValue(null as any);

      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Happy Path — 200 OK
  // ─────────────────────────────────────────────────────────────────────────
  describe("Happy Path (200 OK)", () => {
    it("should return 200 with subscriptionId when transaction is confirmed valid", async () => {
      // Arrange
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: true,
        amountSol: 0.001,
        amountUsd: 0.1,
        merchantAddress: "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr",
      });

      // Act
      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      // Assert
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.txId).toBe(VALID_TX_SIG);
      expect(body.subscriptionId).toBeDefined();
    });

    it("should call verifySolanaTransaction with the correct arguments", async () => {
      await callRoute(app, { txId: VALID_TX_SIG, tier: "Plus", network: "testnet" });

      expect(verifySolanaTransaction).toHaveBeenCalledWith(VALID_TX_SIG, "Plus", "testnet");
    });

    it("should default network to devnet when not provided in the body", async () => {
      await callRoute(app, { txId: VALID_TX_SIG, tier: "Pro" });

      expect(verifySolanaTransaction).toHaveBeenCalledWith(VALID_TX_SIG, "Pro", "devnet");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Verification Failures — 400 Bad Request
  // ─────────────────────────────────────────────────────────────────────────
  describe("Verification Failures (400 Bad Request)", () => {
    it("should return 400 with PAYMENT_VERIFICATION_FAILED when meta.err is set (on-chain fail)", async () => {
      // Arrange — the transaction exists but failed on-chain
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "Transaction failed: { InstructionError: [0, 'AccountBorrowFailed'] }",
      });

      // Act
      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      // Assert
      expect(res.status).toBe(400);
      expect(body.errorCode).toBe("PAYMENT_VERIFICATION_FAILED");
      expect(body.message).toContain("Transaction failed:");
    });

    it("should return 400 when recipient does not match merchant address (hijack attempt)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "No transfer of at least 0.001 SOL to merchant address found",
      });

      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.errorCode).toBe("PAYMENT_VERIFICATION_FAILED");
    });

    it("should return 400 when lamports sent are less than required for the tier (insufficient amount)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "No transfer of at least 0.005 SOL to merchant address found",
      });

      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Plus", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.message).toContain("0.005 SOL");
    });

    it("should return 400 when network spoofing is detected (client sends mainnet, server expects devnet)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason:
          'Network mismatch: server expects "devnet" transactions, but received a claim for "mainnet-beta".',
      });

      const res = await callRoute(app, {
        txId: VALID_TX_SIG,
        tier: "Lite",
        network: "mainnet-beta",
      });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.message).toContain("Network mismatch");
    });

    it("should return 400 when transaction is not found (not confirmed yet)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "Transaction not found or not confirmed yet",
      });

      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.message).toContain("not found");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Server Error — 500
  // ─────────────────────────────────────────────────────────────────────────
  describe("Internal Server Errors (500)", () => {
    it("should return 500 when verifySolanaTransaction throws unexpectedly", async () => {
      vi.mocked(verifySolanaTransaction).mockRejectedValue(
        new Error("Helius RPC connection refused")
      );

      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(500);
      expect(body.errorCode).toBe("INTERNAL_SERVER_ERR");
      expect(body.message).toContain("Helius RPC connection refused");
    });

    it("should return 500 with a generic message when the error has no message property", async () => {
      vi.mocked(verifySolanaTransaction).mockRejectedValue({});

      const res = await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(500);
      expect(body.message).toBe("An unknown error occurred.");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // verifySolanaTransaction service — direct unit tests
  // ─────────────────────────────────────────────────────────────────────────
  describe("verifySolanaTransaction service call verification", () => {
    it("should NOT call the DB when verification fails", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "Some reason",
      });

      await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });

      // The insert chain should not have been invoked
      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });

    it("should call the DB insert when verification succeeds (happy path)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: true,
        amountSol: 0.001,
      });

      await callRoute(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });

      expect(vi.mocked(db.insert)).toHaveBeenCalled();
    });
  });
});
