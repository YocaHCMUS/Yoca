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
      currentPeriodStart:
        stripeSub.current_period_start != null
          ? new Date(stripeSub.current_period_start * 1000)
          : null,
      currentPeriodEnd:
        stripeSub.current_period_end != null
          ? new Date(stripeSub.current_period_end * 1000)
          : null,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status: stripeSub.status,
        currentPeriodStart:
          stripeSub.current_period_start != null
            ? new Date(stripeSub.current_period_start * 1000)
            : null,
        currentPeriodEnd:
          stripeSub.current_period_end != null
            ? new Date(stripeSub.current_period_end * 1000)
            : null,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        planTier: tier as any,
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
  
  let brand, last4;
  if (typeof invoice.payment_intent === 'object' && invoice.payment_intent.payment_method_details) {
    brand = invoice.payment_intent.payment_method_details?.card?.brand;
    last4 = invoice.payment_intent.payment_method_details?.card?.last4;
  }

  await db.insert(paymentHistory).values({
    userId: sub.userId,
    subscriptionId: sub.id,
    stripePaymentIntentId: paymentIntentId,
    stripeInvoiceId: invoice.id,
    amountCents: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status === 'paid' ? 'succeeded' : 'failed',
    paymentMethodDetails: brand || last4 ? { brand, last4 } : null,
  });
}

