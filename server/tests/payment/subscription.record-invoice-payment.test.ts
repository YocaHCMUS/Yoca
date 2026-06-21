import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  insertValuesMock,
  conflictUpdateMock,
  selectLimitMock,
  invoiceRetrieveMock,
} = vi.hoisted(
  () => ({
    insertValuesMock: vi.fn(),
    conflictUpdateMock: vi.fn(),
    selectLimitMock: vi.fn(),
    invoiceRetrieveMock: vi.fn(),
  }),
);

vi.mock("@sv/db/schema.js", () => ({
  subscriptions: {},
  paymentHistory: { stripeInvoiceId: "stripeInvoiceId" },
  users: {},
}));

vi.mock("@sv/db/index.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: selectLimitMock })),
      })),
    })),
    insert: vi.fn(() => ({
      values: insertValuesMock,
    })),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
  isNotNull: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@sv/services/stripe.service.js", () => ({
  getStripe: () => ({
    invoices: { retrieve: invoiceRetrieveMock },
    products: { retrieve: vi.fn() },
  }),
}));

import {
  enrichPaymentHistoryWithStripeProduct,
  recordInvoicePayment,
  refreshPendingPaymentHistory,
} from "@sv/services/subscription.service.js";

describe("recordInvoicePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_LITE = "price_lite";
    process.env.STRIPE_PRICE_PLUS = "price_plus";
    selectLimitMock.mockResolvedValue([
      { id: "local-sub-123", userId: "user-id-123" },
    ]);
    insertValuesMock.mockReturnValue({
      onConflictDoUpdate: conflictUpdateMock.mockResolvedValue(undefined),
    });
  });

  it("stores bank invoices as pending and updates the same row after success", async () => {
    const invoice = {
      id: "inv_bank",
      customer: "cus_123",
      parent: { subscription_details: { subscription: "sub_123" } },
      amount_paid: 0,
      amount_due: 19900,
      currency: "usd",
      status: "open",
      payments: {
        data: [{
          is_default: true,
          status: "open",
          payment: { payment_intent: { id: "pi_bank", status: "processing" } },
        }],
      },
    };

    await recordInvoicePayment(invoice);
    expect(insertValuesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stripeInvoiceId: "inv_bank",
        stripePaymentIntentId: "pi_bank",
        amountCents: 19900,
        status: "pending",
      }),
    );

    await recordInvoicePayment(
      { ...invoice, amount_paid: 19900, status: "paid" },
      "succeeded",
    );
    expect(conflictUpdateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ amountCents: 19900, status: "succeeded" }),
      }),
    );
  });

  it("uses each invoice price instead of the subscription's current tier", async () => {
    invoiceRetrieveMock
      .mockResolvedValueOnce({
        lines: {
          data: [{
            amount: 3900,
            pricing: {
              price_details: { price: "price_lite", product: "prod_lite" },
            },
          }],
        },
      })
      .mockResolvedValueOnce({
        lines: {
          data: [
            {
              amount: -3900,
              pricing: {
                price_details: { price: "price_lite", product: "prod_lite" },
              },
            },
            {
              amount: 19900,
              pricing: {
                price_details: { price: "price_plus", product: "prod_plus" },
              },
            },
          ],
        },
      });

    const rows = await enrichPaymentHistoryWithStripeProduct([
      { stripeInvoiceId: "inv_lite", planTier: "Plus" },
      { stripeInvoiceId: "inv_upgrade", planTier: "Plus" },
    ]);

    expect(rows.map((row) => row.planName)).toEqual(["Lite", "Plus"]);
    expect(rows.map((row) => row.planTier)).toEqual(["Lite", "Plus"]);
  });

  it("refreshes pending invoices from Stripe", async () => {
    invoiceRetrieveMock.mockResolvedValueOnce({
      id: "inv_pending",
      customer: "cus_123",
      parent: { subscription_details: { subscription: "sub_123" } },
      amount_paid: 19900,
      currency: "usd",
      status: "paid",
    });

    await refreshPendingPaymentHistory([
      { status: "pending", stripeInvoiceId: "inv_pending" },
      { status: "succeeded", stripeInvoiceId: "inv_done" },
    ]);

    expect(invoiceRetrieveMock).toHaveBeenCalledTimes(1);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeInvoiceId: "inv_pending",
        status: "succeeded",
      }),
    );
  });
});
