// server/src/services/subscription.service.ts
import { db } from "@sv/db/index.js";
import { subscriptions, paymentHistory, users } from "@sv/db/schema.js";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type Stripe from "stripe";

type SubscriptionPlanTier = typeof subscriptions.$inferInsert.planTier;

type StripeInvoicePaymentLike = {
  is_default?: boolean;
  status?: string | null;
  payment?: {
    payment_intent?: string | Stripe.PaymentIntent | null;
  } | null;
};

type StripeInvoiceLike = Stripe.Invoice & {
  payments?: { data?: StripeInvoicePaymentLike[] } | null;
};

type StripeSubscriptionLike = Stripe.Subscription;

type StripeInvoiceRecordLike = StripeInvoiceLike;

function normalizePlanTier(value: unknown): SubscriptionPlanTier | undefined {
  return value === "Lite" || value === "Plus" || value === "Pro" ? value : undefined;
}

function normalizeSubscriptionStatus(value: unknown): typeof subscriptions.$inferInsert.status {
  switch (value) {
    case "active":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "trialing":
    case "unpaid":
    case "paused":
      return value;
    default:
      return "incomplete";
  }
}

function getObjectProp(value: unknown, key: string): unknown {
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}
type PaymentHistoryRowForStripe = {
  status?: string | null;
  stripeInvoiceId?: string | null;
  planTier?: string | null;
  [key: string]: unknown;
};

function getInvoiceLinePrice(line: Stripe.InvoiceLineItem | undefined): unknown {
  return getObjectProp(line, "price") ?? line?.pricing?.price_details?.price ?? null;
}

function getInvoicePriceId(line: Stripe.InvoiceLineItem | undefined): string | undefined {
  const price = getInvoiceLinePrice(line);
  return typeof price === "string" ? price : typeof getObjectProp(price, "id") === "string" ? getObjectProp(price, "id") as string : undefined;
}

function getInvoiceLineProduct(line: Stripe.InvoiceLineItem | undefined): unknown {
  const price = getInvoiceLinePrice(line);
  const pricingProduct = line?.pricing?.price_details?.product;
  return pricingProduct ?? (typeof price === "string" ? undefined : getObjectProp(price, "product"));
}
export async function getUserSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(
      sql<number>`case
        when ${subscriptions.status} = 'active' then 0
        when ${subscriptions.status} = 'trialing' then 1
        when ${subscriptions.status} = 'past_due' then 2
        when ${subscriptions.status} = 'incomplete' then 3
        when ${subscriptions.status} = 'unpaid' then 4
        when ${subscriptions.status} = 'paused' then 5
        when ${subscriptions.status} = 'canceled' then 6
        else 7
      end`,
      asc(subscriptions.cancelAtPeriodEnd),
      desc(subscriptions.currentPeriodEnd),
      desc(subscriptions.updatedAt),
      desc(subscriptions.createdAt),
    )
    .limit(1);
  return sub || null;
}

export async function getUserPaymentHistory(userId: string) {
  return await db
    .select({
      id: paymentHistory.id,
      userId: paymentHistory.userId,
      subscriptionId: paymentHistory.subscriptionId,
      stripePaymentIntentId: paymentHistory.stripePaymentIntentId,
      stripeInvoiceId: paymentHistory.stripeInvoiceId,
      amountCents: paymentHistory.amountCents,
      currency: paymentHistory.currency,
      status: paymentHistory.status,
      paymentMethodDetails: paymentHistory.paymentMethodDetails,
      createdAt: paymentHistory.createdAt,
      planTier: subscriptions.planTier,
    })
    .from(paymentHistory)
    .leftJoin(
      subscriptions,
      eq(paymentHistory.subscriptionId, subscriptions.id),
    )
    .where(eq(paymentHistory.userId, userId))
    .orderBy(desc(paymentHistory.createdAt));
}

export async function refreshPendingPaymentHistory(historyRows: PaymentHistoryRowForStripe[]) {
  const pendingInvoiceIds = historyRows
    .filter((row) => row.status === "pending" && row.stripeInvoiceId)
    .map((row) => row.stripeInvoiceId as string);
  if (pendingInvoiceIds.length === 0) return;

  const { getStripe } = await import("@sv/services/stripe.service.js");
  const stripe = getStripe();
  for (const invoiceId of pendingInvoiceIds) {
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ["payments.data.payment.payment_intent"],
    });
    await recordInvoicePayment(invoice);
  }
}

export async function enrichPaymentHistoryWithStripeProduct<T extends PaymentHistoryRowForStripe>(
  historyRows: T[],
) {
  if (historyRows.length === 0) return historyRows;

  const { getStripe } = await import("@sv/services/stripe.service.js");
  const stripe = getStripe();

  const resolvePlanFromInvoice = async (invoice: StripeInvoiceLike) => {
    const lines = invoice?.lines?.data ?? [];
    const selectedLine =
      lines.find(
        (line: Stripe.InvoiceLineItem) =>
          (line.amount ?? 0) > 0 &&
          mapTierFromPriceId(getInvoicePriceId(line)),
      ) ?? lines.find((line: Stripe.InvoiceLineItem) => (line.amount ?? 0) > 0);
    const linePriceId = getInvoicePriceId(selectedLine);
    const planTier = mapTierFromPriceId(linePriceId);
    if (planTier) return { planName: planTier, planTier };

    const lineProduct = getInvoiceLineProduct(selectedLine);
    const lineProductName = getObjectProp(lineProduct, "name");
    if (typeof lineProductName === "string") {
      return { planName: lineProductName, planTier: undefined };
    }
    if (typeof lineProduct === "string") {
      try {
        const product = await stripe.products.retrieve(lineProduct);
        return {
          planName: product?.name ? String(product.name) : null,
          planTier: undefined,
        };
      } catch {
        // Product lookup is optional; the invoice amount fallback remains available.
      }
    }

    return {
      planName: null,
      planTier: undefined,
    };
  };

  const enrichedRows = await Promise.all(
    historyRows.map(async (row) => {
      if (!row?.stripeInvoiceId) {
        return {
          ...row,
          planName: row?.planTier ?? null,
        };
      }

      try {
        const invoice = await stripe.invoices.retrieve(row.stripeInvoiceId);

        const { planName, planTier } = await resolvePlanFromInvoice(
          invoice as StripeInvoiceLike,
        );

        return {
          ...row,
          planTier: planTier ?? null,
          planName: planName ?? planTier ?? null,
        };
      } catch {
        return {
          ...row,
          planTier: null,
          planName: null,
        };
      }
    }),
  );

  return enrichedRows;
}

export async function getUserSubscriptions(userId: string) {
  return await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt));
}

async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.stripeCustomerId ?? null;
}

function mapTierFromPriceId(
  priceId: string | undefined,
): "Lite" | "Plus" | "Pro" | undefined {
  if (!priceId) return undefined;
  if (priceId === process.env.STRIPE_PRICE_LITE || priceId === process.env.STRIPE_PRICE_LITE_YEARLY) return "Lite";
  if (priceId === process.env.STRIPE_PRICE_PLUS || priceId === process.env.STRIPE_PRICE_PLUS_YEARLY) return "Plus";
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) return "Pro";
  return undefined;
}

function getInvoiceSubscriptionId(invoice: StripeInvoiceRecordLike): string | undefined {
  const subscription =
    getObjectProp(invoice, "subscription") ??
    (getObjectProp(getObjectProp(invoice, "parent"), "subscription_details") && getObjectProp(getObjectProp(getObjectProp(invoice, "parent"), "subscription_details"), "subscription"));
  const subscriptionId = getObjectProp(subscription, "id");
  return typeof subscription === "string" ? subscription : typeof subscriptionId === "string" ? subscriptionId : undefined;
}

function resolveSubscriptionPeriodUnix(stripeSub: StripeSubscriptionLike): {
  start: number | null;
  end: number | null;
} {
  const topLevelStart = getObjectProp(stripeSub, "current_period_start");
  const topLevelEnd = getObjectProp(stripeSub, "current_period_end");

  const firstItem = stripeSub?.items?.data?.[0];
  const itemLevelStart = firstItem?.current_period_start;
  const itemLevelEnd = firstItem?.current_period_end;

  const latestInvoice = stripeSub.latest_invoice;
  const firstInvoiceLine = typeof latestInvoice === "object" && latestInvoice !== null ? latestInvoice.lines?.data?.[0] : undefined;
  const invoiceLineStart = firstInvoiceLine?.period?.start;
  const invoiceLineEnd = firstInvoiceLine?.period?.end;

  const start = topLevelStart ?? itemLevelStart ?? invoiceLineStart ?? null;
  const end = topLevelEnd ?? itemLevelEnd ?? invoiceLineEnd ?? null;

  return {
    start: typeof start === "number" ? start : null,
    end: typeof end === "number" ? end : null,
  };
}

export async function syncUserSubscriptionsFromStripe(userId: string) {
  const stripeCustomerId = await getUserStripeCustomerId(userId);
  if (!stripeCustomerId) return;

  const { getStripe } = await import("@sv/services/stripe.service.js");
  const stripe = getStripe();

  const stripeSubs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 20,
  });

  for (const stripeSub of stripeSubs.data) {
    await upsertSubscription(stripeSub);
  }
}

export async function upsertSubscription(stripeSub: StripeSubscriptionLike) {
  const stripeCustomerId = typeof stripeSub.customer === "string" ? stripeSub.customer : (stripeSub.customer?.id ?? "");
  const yocaUserIdFromMetadata = stripeSub.metadata?.yocaUserId as
    | string
    | undefined;
  const tierFromMetadata = normalizePlanTier(stripeSub.metadata?.tier);

  let yocaUserId = yocaUserIdFromMetadata;
  if (!yocaUserId && stripeCustomerId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId))
      .limit(1);
    yocaUserId = user?.id;
  }

  const priceId = stripeSub.items?.data?.[0]?.price?.id as string | undefined;
  const tierFromPrice = mapTierFromPriceId(priceId);

  const [existingSub] = await db
    .select({ planTier: subscriptions.planTier })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id))
    .limit(1);

  const tier = tierFromMetadata ?? tierFromPrice ?? existingSub?.planTier;
  const periodUnix = resolveSubscriptionPeriodUnix(stripeSub);

  if (!yocaUserId || !tier) return null;

  const mappedCurrentPeriodStart =
    periodUnix.start != null ? new Date(periodUnix.start * 1000) : null;
  const mappedCurrentPeriodEnd =
    periodUnix.end != null ? new Date(periodUnix.end * 1000) : null;

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id))
    .limit(1);

  if (!existing) {
    const [inserted] = await db
      .insert(subscriptions)
      .values({
        userId: yocaUserId,
        stripeCustomerId,
        stripeSubscriptionId: stripeSub.id,
        planTier: tier,
        status: normalizeSubscriptionStatus(stripeSub.status),
        currentPeriodStart: mappedCurrentPeriodStart,
        currentPeriodEnd: mappedCurrentPeriodEnd,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      })
      .returning();

    return inserted;
  }

  const hasStatusChanged = existing.status !== stripeSub.status;
  const hasTierChanged = existing.planTier !== tier;
  const hasCancelFlagChanged =
    existing.cancelAtPeriodEnd !== stripeSub.cancel_at_period_end;
  const hasPeriodStartChanged =
    (existing.currentPeriodStart?.getTime() ?? null) !==
    (mappedCurrentPeriodStart?.getTime() ?? null);
  const hasPeriodEndChanged =
    (existing.currentPeriodEnd?.getTime() ?? null) !==
    (mappedCurrentPeriodEnd?.getTime() ?? null);

  const shouldUpdate =
    hasStatusChanged ||
    hasTierChanged ||
    hasCancelFlagChanged ||
    hasPeriodStartChanged ||
    hasPeriodEndChanged;

  if (!shouldUpdate) {
    return existing;
  }

  const [updated] = await db
    .update(subscriptions)
    .set({
      status: normalizeSubscriptionStatus(stripeSub.status),
      currentPeriodStart: mappedCurrentPeriodStart,
      currentPeriodEnd: mappedCurrentPeriodEnd,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      planTier: tier,
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id))
    .returning();

  return updated;
}

export async function recordInvoicePayment(
  invoice: StripeInvoiceRecordLike,
  statusOverride?: "succeeded" | "failed" | "pending",
) {
  if (!invoice.customer) return null;

  // We need to find the user id from the subscription
  const subId = getInvoiceSubscriptionId(invoice);
  const [sub] = subId
    ? await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subId))
        .limit(1)
    : [null];

  let userId = sub?.userId;
  const subscriptionId: string | null = sub?.id ?? null;

  if (!userId && invoice.customer) {
    const stripeCustomerId =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer.id;
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, stripeCustomerId))
      .limit(1);
    userId = user?.id;
  }

  if (!userId) return null;

  const invoicePayment =
    invoice.payments?.data?.find((payment) => payment.is_default) ??
    invoice.payments?.data?.[0];
  const paymentIntent =
    getObjectProp(invoice, "payment_intent") ?? invoicePayment?.payment?.payment_intent;
  const paymentIntentId =
    typeof paymentIntent === "string"
      ? paymentIntent
      : typeof getObjectProp(paymentIntent, "id") === "string"
        ? getObjectProp(paymentIntent, "id") as string
        : null;

  const paymentMethodDetails = getObjectProp(paymentIntent, "payment_method_details");
  const cardDetails = getObjectProp(paymentMethodDetails, "card");
  const rawBrand = getObjectProp(cardDetails, "brand");
  const rawLast4 = getObjectProp(cardDetails, "last4");
  const brand = typeof rawBrand === "string" ? rawBrand : undefined;
  const last4 = typeof rawLast4 === "string" ? rawLast4 : undefined;

  const paymentStatus =
    statusOverride ??
    (invoice.status === "paid" || invoicePayment?.status === "paid"
      ? "succeeded"
      : invoice.status === "void" ||
          invoice.status === "uncollectible" ||
          invoicePayment?.status === "canceled"
        ? "failed"
        : "pending");

  await db
    .insert(paymentHistory)
    .values({
      userId,
      subscriptionId,
      stripePaymentIntentId: paymentIntentId,
      stripeInvoiceId: invoice.id,
      amountCents: invoice.amount_paid || invoice.amount_due || invoice.total || 0,
      currency: invoice.currency,
      status: paymentStatus,
      paymentMethodDetails: brand || last4 ? { brand, last4 } : null,
    })
    .onConflictDoUpdate({
      target: paymentHistory.stripeInvoiceId,
      set: {
        amountCents: invoice.amount_paid || invoice.amount_due || invoice.total || 0,
        currency: invoice.currency,
        status: paymentStatus,
        ...(subscriptionId ? { subscriptionId } : {}),
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        ...(brand || last4 ? { paymentMethodDetails: { brand, last4 } } : {}),
      },
    });
}

export async function backfillUserPaymentHistory(userId: string) {
  const { getStripe } = await import("@sv/services/stripe.service.js");
  const stripe = getStripe();

  const stripeCustomerId = await getUserStripeCustomerId(userId);

  const seenInvoiceIds = new Set<string>();

  if (stripeCustomerId) {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    });

    for (const invoice of invoices.data) {
      const stripeInvoice = invoice as StripeInvoiceLike;
      if (!stripeInvoice.id) continue;
      seenInvoiceIds.add(stripeInvoice.id);

      // Ensure corresponding subscription exists/updated in our DB first.
      const stripeSubId = getInvoiceSubscriptionId(stripeInvoice);
      if (stripeSubId) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
          await upsertSubscription(stripeSub);
        } catch (subErr) {
          console.warn("Failed to sync subscription during history backfill", {
            stripeSubId,
            subErr,
          });
        }
      }

      const fullInvoice = await stripe.invoices.retrieve(stripeInvoice.id, {
        expand: ["payments.data.payment.payment_intent"],
      });
      await recordInvoicePayment(fullInvoice);
    }
  }

  // Fallback path: backfill by known subscription IDs in DB.
  const localSubs = await db
    .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));

  for (const localSub of localSubs) {
    const subInvoices = await stripe.invoices.list({
      subscription: localSub.stripeSubscriptionId,
      limit: 20,
    });

    for (const invoice of subInvoices.data) {
      const stripeInvoice = invoice as StripeInvoiceLike;
      if (!stripeInvoice.id) continue;
      if (seenInvoiceIds.has(stripeInvoice.id)) continue;

      const fullInvoice = await stripe.invoices.retrieve(stripeInvoice.id, {
        expand: ["payments.data.payment.payment_intent"],
      });
      await recordInvoicePayment(fullInvoice);
    }
  }
}

export async function repairPaymentHistorySubscriptionLinks(userId: string) {
  const rows = await db
    .select({
      id: paymentHistory.id,
      stripeInvoiceId: paymentHistory.stripeInvoiceId,
    })
    .from(paymentHistory)
    .where(
      and(
        eq(paymentHistory.userId, userId),
        isNull(paymentHistory.subscriptionId),
        isNotNull(paymentHistory.stripeInvoiceId),
      ),
    )
    .orderBy(desc(paymentHistory.createdAt));

  if (rows.length === 0) return;

  const { getStripe } = await import("@sv/services/stripe.service.js");
  const stripe = getStripe();

  for (const row of rows) {
    if (!row.stripeInvoiceId) continue;

    try {
      const invoice = await stripe.invoices.retrieve(row.stripeInvoiceId, {
        expand: ["subscription"],
      });

      const stripeSubId = getInvoiceSubscriptionId(invoice);

      if (!stripeSubId) continue;

      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      const localSub = await upsertSubscription(stripeSub);
      if (!localSub?.id) continue;

      await db
        .update(paymentHistory)
        .set({ subscriptionId: localSub.id })
        .where(eq(paymentHistory.id, row.id));
    } catch (err) {
      console.warn("Failed to repair payment history row", {
        paymentHistoryId: row.id,
        stripeInvoiceId: row.stripeInvoiceId,
        err,
      });
    }
  }
}
