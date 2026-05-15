import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  return {
    mockReturning,
    mockOnConflictDoUpdate,
    mockValues,
    mockInsert,
  };
});

vi.mock("@sv/db/index.js", () => ({
  db: {
    insert: mocks.mockInsert,
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
    const updateSet = mocks.mockOnConflictDoUpdate.mock.calls[0][0].set;
    const expectedStartIso = new Date(1715750400 * 1000).toISOString();
    const expectedEndIso = new Date(1718428800 * 1000).toISOString();

    expect(insertedValues.currentPeriodStart).toBeInstanceOf(Date);
    expect(insertedValues.currentPeriodEnd).toBeInstanceOf(Date);
    expect(insertedValues.currentPeriodStart.toISOString()).toBe(expectedStartIso);
    expect(insertedValues.currentPeriodEnd.toISOString()).toBe(expectedEndIso);

    expect(updateSet.currentPeriodStart).toBeInstanceOf(Date);
    expect(updateSet.currentPeriodEnd).toBeInstanceOf(Date);
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
    const updateSet = mocks.mockOnConflictDoUpdate.mock.calls[0][0].set;

    expect(insertedValues.currentPeriodStart).toBeNull();
    expect(insertedValues.currentPeriodEnd).toBeNull();
    expect(updateSet.currentPeriodStart).toBeNull();
    expect(updateSet.currentPeriodEnd).toBeNull();
  });
});
