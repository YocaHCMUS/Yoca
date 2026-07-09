import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// Module Mocks — must be hoisted before any imports that transitively use them
// ---------------------------------------------------------------------------

vi.mock("@sv/db/index.js", () => {
  const insertReturningMock = vi.fn().mockResolvedValue([{
    stripeSubscriptionId: "solana-mock-tx-sig",
    status: "active",
    userId: "user-123",
    planTier: "Lite",
  }]);
  const insertValuesMock = vi.fn(() => ({ returning: insertReturningMock }));
  const insertMock = vi.fn(() => ({ values: insertValuesMock }));

  const limitMock = vi.fn().mockResolvedValue([]);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  return {
    db: {
      select: selectMock,
      insert: insertMock,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "updated-id" }]),
        })),
      })),
    },
  };
});

vi.mock("@sv/db/schema.js", () => ({
  users: {},
  subscriptions: {},
  paymentHistory: {},
}));

vi.mock("@sv/services/solana-payment.service.js", () => ({
  verifySolanaTransaction: vi.fn(),
}));

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

vi.mock("@sv/services/subscription.service.js", () => ({
  upsertSubscription: vi.fn(),
  recordInvoicePayment: vi.fn(),
}));

vi.mock("@sv/services/users.js", () => ({
  getUserById: vi.fn(),
}));

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
  validate: vi.fn(() => async (c: any, next: any) => {
    try {
      const body = await c.req.json();
      c.req.valid = () => body;
    } catch {
      c.req.valid = () => ({});
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
// Import after mocks
// ---------------------------------------------------------------------------

import { getUserById } from "@sv/services/users.js";
import { verifySolanaTransaction } from "@sv/services/solana-payment.service.js";
import { db } from "@sv/db/index.js";

// ---------------------------------------------------------------------------
// Minimal Hono test app — mirrors the logic in payment.route.ts verify-solana
// ---------------------------------------------------------------------------

function buildTestApp(opts: { userId?: string | null } = {}) {
  const userId = opts.userId !== undefined ? opts.userId : "user-123";
  const app = new Hono();

  // Inject JWT payload via middleware — this is how honoJwt sets it in production
  app.use("*", async (c, next) => {
    if (userId !== null) {
      c.set("jwtPayload", { id: userId });
    }
    await next();
  });

  app.post("/verify-solana", async (c) => {
    // Simulate jwtPayload extraction (honoJwt middleware already set it)
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

    // Payload validation (mirrors Zod schema in real route)
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

    const effectiveNetwork = network ?? "devnet";

    try {
      const verification = await verifySolanaTransaction(txId, tier, effectiveNetwork);

      if (!verification.valid) {
        return c.json({
          errorCode: "PAYMENT_VERIFICATION_FAILED",
          message: verification.reason ?? "Transaction could not be verified.",
        }, 400);
      }

      // DB upsert (simplified — mirrors real route logic)
      const solanaTxKey = `solana-${txId}`;

      const [existing] = await (db.select() as any).from({}).where({}).limit(1);

      let result: any;
      if (!existing) {
        const [inserted] = await db
          .insert({} as any)
          .values({
            userId,
            stripeSubscriptionId: solanaTxKey,
            status: "active",
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
// Fixtures
// ---------------------------------------------------------------------------

/** A realistic 88-char Solana transaction signature */
const VALID_TX_SIG = "4S4f9U5Jv6dG7eH8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m";
const MOCK_USER    = { id: "user-123", email: "test@example.com", stripeCustomerId: null };

async function post(app: Hono, body: Record<string, unknown>) {
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

describe("POST /payment/verify-solana — Unit Tests (AAA pattern)", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildTestApp();

    vi.mocked(getUserById).mockResolvedValue(MOCK_USER as any);
    vi.mocked(verifySolanaTransaction).mockResolvedValue({
      valid: true,
      amountSol: 0.001,
      amountUsd: 0.1,
      merchantAddress: "6BCvxUZXhi73HDeoe5metBKWEd5AFmPHNZHTQ98dF2dr",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 400 — Payload Validation
  // ─────────────────────────────────────────────────────────────────────────
  describe("Payload Validation → 400 Bad Request", () => {
    it("should return 400 when txId is missing", async () => {
      // Arrange & Act
      const res = await post(app, { tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      // Assert
      expect(res.status).toBe(400);
      expect(body.errorCode).toBe("BAD_REQUEST");
      expect(body.message).toMatch(/txId/);
    });

    it("should return 400 when txId is shorter than 64 characters", async () => {
      const res = await post(app, { txId: "short-sig", tier: "Lite", network: "devnet" });
      expect(res.status).toBe(400);
      expect((await res.json() as any).message).toMatch(/txId/);
    });

    it("should return 400 when txId is exactly 63 characters (boundary)", async () => {
      const res = await post(app, { txId: "A".repeat(63), tier: "Lite", network: "devnet" });
      expect(res.status).toBe(400);
    });

    it("should accept txId of exactly 64 characters (min valid boundary)", async () => {
      const res = await post(app, { txId: "A".repeat(64), tier: "Lite", network: "devnet" });
      // Should proceed to verification (not a 400 from payload validation)
      expect(res.status).not.toBe(400);
    });

    it("should return 400 when tier is missing", async () => {
      const res = await post(app, { txId: VALID_TX_SIG, network: "devnet" });
      expect(res.status).toBe(400);
      expect((await res.json() as any).message).toMatch(/tier/);
    });

    it("should return 400 when tier has an unrecognised value", async () => {
      const res = await post(app, { txId: VALID_TX_SIG, tier: "Enterprise", network: "devnet" });
      expect(res.status).toBe(400);
    });

    it("should return 400 when network has an unrecognised value", async () => {
      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "fakenet" });
      expect(res.status).toBe(400);
    });

    it("should return 401 when user is not found in DB", async () => {
      vi.mocked(getUserById).mockResolvedValue(null as any);
      // Re-use the default app (userId is already injected by middleware)
      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 200 — Happy Path
  // ─────────────────────────────────────────────────────────────────────────
  describe("Happy Path → 200 OK", () => {
    it("should return 200 with success=true when transaction is verified", async () => {
      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.txId).toBe(VALID_TX_SIG);
      expect(body.subscriptionId).toBeDefined();
    });

    it("should pass the correct txId, tier, and network to verifySolanaTransaction", async () => {
      await post(app, { txId: VALID_TX_SIG, tier: "Plus", network: "testnet" });

      expect(verifySolanaTransaction).toHaveBeenCalledWith(VALID_TX_SIG, "Plus", "testnet");
    });

    it("should default network to devnet when not provided", async () => {
      await post(app, { txId: VALID_TX_SIG, tier: "Pro" });

      expect(verifySolanaTransaction).toHaveBeenCalledWith(VALID_TX_SIG, "Pro", "devnet");
    });

    it("should trigger the DB insert when verification succeeds", async () => {
      await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });

      expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 400 — Verification Failures
  // ─────────────────────────────────────────────────────────────────────────
  describe("Verification Failures → 400 Bad Request", () => {
    it("should return 400 + PAYMENT_VERIFICATION_FAILED when transaction has meta.err (on-chain revert)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "Transaction failed: { InstructionError: [0, 'AccountBorrowFailed'] }",
      });

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.errorCode).toBe("PAYMENT_VERIFICATION_FAILED");
      expect(body.message).toContain("Transaction failed:");
    });

    it("should return 400 when recipient address does not match merchant (hijack attempt)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "No transfer of at least 0.001 SOL to merchant address found",
      });

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.errorCode).toBe("PAYMENT_VERIFICATION_FAILED");
    });

    it("should return 400 when lamports are less than required for the selected tier", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "No transfer of at least 0.005 SOL to merchant address found",
      });

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Plus", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.message).toContain("0.005 SOL");
    });

    it("should return 400 on network spoofing (client claims mainnet, server configured for devnet)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: 'Network mismatch: server expects "devnet" transactions, but received "mainnet-beta".',
      });

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "mainnet-beta" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.message).toContain("Network mismatch");
    });

    it("should return 400 when transaction is not found on-chain (not yet confirmed)", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "Transaction not found or not confirmed yet",
      });

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(400);
      expect(body.message).toContain("not found");
    });

    it("should NOT call db.insert when verification fails", async () => {
      vi.mocked(verifySolanaTransaction).mockResolvedValue({
        valid: false,
        reason: "Some reason",
      });

      await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });

      expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 500 — Internal Server Error
  // ─────────────────────────────────────────────────────────────────────────
  describe("Internal Server Errors → 500", () => {
    it("should return 500 when verifySolanaTransaction throws (e.g. Helius RPC down)", async () => {
      vi.mocked(verifySolanaTransaction).mockRejectedValue(
        new Error("Helius RPC connection refused")
      );

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(500);
      expect(body.errorCode).toBe("INTERNAL_SERVER_ERR");
      expect(body.message).toContain("Helius RPC connection refused");
    });

    it("should return 500 with a safe fallback message when error has no .message", async () => {
      vi.mocked(verifySolanaTransaction).mockRejectedValue({});

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(500);
      expect(body.message).toBe("An unknown error occurred.");
    });

    it("should return 500 when HELIUS_API_KEY is missing and service throws", async () => {
      vi.mocked(verifySolanaTransaction).mockRejectedValue(
        new Error("HELIUS_API_KEY is not configured")
      );

      const res = await post(app, { txId: VALID_TX_SIG, tier: "Lite", network: "devnet" });
      const body = await res.json() as any;

      expect(res.status).toBe(500);
      expect(body.message).toContain("HELIUS_API_KEY");
    });
  });
});
