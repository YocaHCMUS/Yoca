// server/src/services/subscription.service.ts
import { db } from "@sv/db/index.js";
import { subscriptions, paymentHistory } from "@sv/db/schema.js";
import { desc, eq } from "drizzle-orm";

export async function getUserSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return sub || null;
}

export async function getUserPaymentHistory(userId: string) {
  return await db
    .select()
    .from(paymentHistory)
    .where(eq(paymentHistory.userId, userId))
    .orderBy(desc(paymentHistory.createdAt));
}
export async function upsertSubscription(stripeSub: any) {
  const { yocaUserId, tier } = stripeSub.metadata;
  if (!yocaUserId || !tier) return null;

  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: yocaUserId,
      stripeCustomerId: stripeSub.customer as string,
      stripeSubscriptionId: stripeSub.id,
      planTier: tier as any,
      status: stripeSub.status,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeCustomerId,
      set: {
        status: stripeSub.status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        planTier: tier as any,
        stripeSubscriptionId: stripeSub.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  return sub;
}

export async function recordInvoicePayment(invoice: any) {
  if (!invoice.subscription || !invoice.payment_intent) return null;

  // We need to find the user id from the subscription
  const subId = invoice.subscription as string;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId));
  if (!sub) return null;

  const paymentIntentId = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id;
  const brand = typeof invoice.payment_intent === 'object' ? invoice.payment_intent.payment_method_details?.card?.brand : undefined;
  const last4 = typeof invoice.payment_intent === 'object' ? invoice.payment_intent.payment_method_details?.card?.last4 : undefined;

  await db.insert(paymentHistory).values({
    userId: sub.userId,
    subscriptionId: sub.id,
    stripePaymentIntentId: paymentIntentId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status === 'paid' ? 'succeeded' : 'failed',
    paymentMethodDetails: {
      brand,
      last4,
    },
  });
}
