import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  createTokenAlert: vi.fn(),
  deleteTokenAlert: vi.fn(),
  getTokenAlertDetails: vi.fn(),
  getTokenAlertsByUser: vi.fn(),
  setTokenAlertState: vi.fn(),
  updateTokenAlert: vi.fn(),
}));

vi.mock("@sv/middlewares/validation.js", async () => {
  const { validator } = await import("hono/validator");
  const { z } = await import("zod");
  const create = z.object({
    alertType: z.literal("token"),
    name: z.string().min(1),
    triggerMode: z.enum(["once", "always"]).default("once"),
    expiresAt: z.string(),
    delivery: z.object({ email: z.email().optional(), discord: z.boolean().optional().default(false) }),
    tokenTarget: z.object({ tokenAddress: z.string().min(1) }),
    conditions: z.array(z.object({ period: z.enum(["30m", "1h", "6h", "24h"]), metric: z.enum(["price_percentage", "price_usd"]), conditionOp: z.enum(["gt", "gte", "eq", "lt", "lte"]), value: z.number() })).min(1),
  });
  return {
    honoJwt: async (c: any, next: any) => { c.set("jwtPayload", { id: "user-1" }); await next(); },
    validate: (target: "json" | "param", schema: any) => validator(target, (value, c) => {
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : c.json({ error: "validation" }, 422);
    }),
    createTokenAlertSchema: create,
    alertIdSchema: z.object({ id: z.string().uuid() }),
    alertStatusUpdateSchema: z.object({ status: z.enum(["running", "stopped"]) }),
  };
});

vi.mock("@sv/middlewares/user-extract.js", () => ({
  default: async (c: any, next: any) => { c.set("userPayload", { id: "user-1" }); await next(); },
}));

vi.mock("@sv/services/alerts/alerts-token.js", () => serviceMocks);

import alertsTokenRoute from "@sv/routes/alerts/alerts-token.js";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const payload = {
  alertType: "token",
  name: "SOL test",
  triggerMode: "once",
  expiresAt: "2030-01-01T00:00:00.000Z",
  delivery: { email: "alerts@example.com", discord: true },
  tokenTarget: { tokenAddress: "So11111111111111111111111111111111111111112" },
  conditions: [{ period: "1h", metric: "price_usd", conditionOp: "gt", value: 100 }],
};

describe("token alert route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getTokenAlertDetails.mockResolvedValue({ alertId: ID });
  });

  it("creates an owned token alert with email and Discord settings", async () => {
    serviceMocks.createTokenAlert.mockResolvedValue(ID);
    const response = await alertsTokenRoute.request("/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    expect(response.status).toBe(201);
    expect(serviceMocks.createTokenAlert).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", email: "alerts@example.com", discord: true }));
  });

  it("lists only the current user's alerts", async () => {
    serviceMocks.getTokenAlertsByUser.mockResolvedValue([{ alertId: ID }]);
    const response = await alertsTokenRoute.request("/");
    expect(response.status).toBe(200);
    expect(serviceMocks.getTokenAlertsByUser).toHaveBeenCalledWith("user-1");
  });

  it("updates only an alert returned for the current user", async () => {
    const response = await alertsTokenRoute.request(`/${ID}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    expect(response.status).toBe(200);
    expect(serviceMocks.updateTokenAlert).toHaveBeenCalledWith(ID, expect.objectContaining({ userId: "user-1", discord: true }));
  });
});
