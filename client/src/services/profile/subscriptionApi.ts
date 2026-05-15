import client from "@/api/main";
import type { Subscription, PaymentHistory } from "./profileApi";

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

export async function getUserPaymentHistory(): Promise<PaymentHistory[]> {
    const resp = await client.api.profile["payment-history"].$get();
    if (!resp.ok) {
        throw new Error(`Failed to fetch payment history: ${resp.status}`);
    }
    return resp.json();
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

export async function upgradeSubscription(subscriptionId: string, newTier: "Lite" | "Plus" | "Pro") {
    const resp = await client.api.payment.upgrade.$post({
        json: { subscriptionId, newTier },
    });
    if (!resp.ok) {
        throw new Error(`Failed to upgrade subscription: ${resp.status}`);
    }
    return resp.json();
}
