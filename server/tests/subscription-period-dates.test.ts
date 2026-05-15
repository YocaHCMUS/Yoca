import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockSelectLimit = vi.fn().mockResolvedValue([]);
  const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  return {
    mockReturning,
    mockValues,
    mockInsert,
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectLimit,
  };
});

vi.mock("@sv/db/index.js", () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
  },
}));

import { upsertSubscription } from "@sv/services/subscription.service.js";

describe("upsertSubscription date mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockReturning.mockResolvedValue([
      {
        id: "sub-db-1",
      },
    ]);
  });

  it("maps Stripe unix timestamps to Date objects", async () => {
    await upsertSubscription({
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      current_period_start: 1715750400,
      current_period_end: 1718428800,
      cancel_at_period_end: false,
      metadata: {
        yocaUserId: "user_123",
        tier: "Plus",
      },
    });

    const insertedValues = mocks.mockValues.mock.calls[0][0];
    const expectedStartIso = new Date(1715750400 * 1000).toISOString();
    const expectedEndIso = new Date(1718428800 * 1000).toISOString();

    expect(insertedValues.currentPeriodStart).toBeInstanceOf(Date);
    expect(insertedValues.currentPeriodEnd).toBeInstanceOf(Date);
    expect(insertedValues.currentPeriodStart.toISOString()).toBe(expectedStartIso);
    expect(insertedValues.currentPeriodEnd.toISOString()).toBe(expectedEndIso);
  });

  it("stores null dates when Stripe period fields are missing", async () => {
    await upsertSubscription({
      id: "sub_456",
      customer: "cus_456",
      status: "active",
      current_period_start: null,
      current_period_end: undefined,
      cancel_at_period_end: false,
      metadata: {
        yocaUserId: "user_456",
        tier: "Lite",
      },
    });

    const insertedValues = mocks.mockValues.mock.calls[0][0];

    expect(insertedValues.currentPeriodStart).toBeNull();
    expect(insertedValues.currentPeriodEnd).toBeNull();
  });
});
