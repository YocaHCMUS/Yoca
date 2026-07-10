import client from "@/api/main";

// ── Types matching the server DB schema ───────────────────────────────────────

export type PlanTier = "Lite" | "Plus" | "Pro";

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "trialing"
  | "unpaid"
  | "paused";

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null; // ISO date string from JSON
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentHistory {
  id: string;
  userId: string;
  subscriptionId: string | null;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
    amount?: number;
  amountCents: number;
  currency: string;
  status: "succeeded" | "failed" | "pending";
    planTier?: PlanTier | null;
    planName?: string | null;
    // For card payments this will include `brand`/`last4`.
    // For Solana payments the backend stores a transfer object with `txId` and other fields.
    paymentMethodDetails:
        | { brand?: string; last4?: string }
        | {
                type: string;
                txId?: string;
                amount?: number;
                merchant?: string;
            }
        | null;
  createdAt: string;
}
function normalizePaymentMethodDetails(value: unknown): PaymentHistory["paymentMethodDetails"] {
    if (!value || typeof value !== "object") return null;

    const details = value as Record<string, unknown>;
    const brand = typeof details.brand === "string" ? details.brand : undefined;
    const last4 = typeof details.last4 === "string" ? details.last4 : undefined;
    if (brand || last4) return { brand, last4 };

    const type = typeof details.type === "string" ? details.type : undefined;
    if (!type) return null;

    return {
        type,
        txId: typeof details.txId === "string" ? details.txId : undefined,
        amount: typeof details.amount === "number" ? details.amount : undefined,
        merchant: typeof details.merchant === "string" ? details.merchant : undefined,
    };
}

export async function confirmPayment(paymentIntentId: string) {
    const resp = await client.api.payment.confirm.$post({
        json: { paymentIntentId },
    });
    if (!resp.ok) {
        throw new Error(`Failed to confirm payment: ${resp.status}`);
    }
    return resp.json();
}

export async function getUserSubscription(): Promise<Subscription | null> {
    const resp = await client.api.profile.subscriptions.$get();
    if (!resp.ok) {
        throw new Error(`Failed to fetch subscription: ${resp.status}`);
    }
    return resp.json();
}

export async function getUserSubscriptions(): Promise<Subscription[]> {
    const resp = await client.api.profile.subscriptions.all.$get();
    if (!resp.ok) {
        throw new Error(`Failed to fetch subscriptions: ${resp.status}`);
    }
    return resp.json();
}

export async function getUserPaymentHistory(): Promise<PaymentHistory[]> {
    const resp = await client.api.profile["payment-history"].$get();
    if (!resp.ok) {
        throw new Error(`Failed to fetch payment history: ${resp.status}`);
    }
    const rows = await resp.json();
    return rows.map((row) => ({
        ...row,
        paymentMethodDetails: normalizePaymentMethodDetails(row.paymentMethodDetails),
    }));
}

export async function cancelSubscription(subscriptionId: string) {
    const resp = await client.api.payment.cancel.$post({
        json: { subscriptionId },
    });
    if (!resp.ok) {
        throw new Error(`Failed to cancel subscription: ${resp.status}`);
    }
    return resp.json();
}

export async function previewSubscriptionUpgrade(subscriptionId: string, newTier: "Lite" | "Plus" | "Pro") {
    const resp = await client.api.payment["upgrade-preview"].$post({
        json: { subscriptionId, newTier },
    });
    if (!resp.ok) {
        throw new Error(`Failed to preview subscription upgrade: ${resp.status}`);
    }
    return resp.json();
}

export async function upgradeSubscription(
    subscriptionId: string,
    newTier: "Lite" | "Plus" | "Pro",
    prorationDate?: number,
) {
    const resp = await client.api.payment.upgrade.$post({
        json: { subscriptionId, newTier, prorationDate },
    });
    if (!resp.ok) {
        throw new Error(`Failed to upgrade subscription: ${resp.status}`);
    }
    return resp.json();
}
