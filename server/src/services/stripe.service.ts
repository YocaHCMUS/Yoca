// server/src/services/stripe.service.ts
import Stripe from "stripe";

// Lazily initialised so the server boots even without a key in dev.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function constructEvent(
  payload: string | Buffer,
  header: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, header, secret);
}

/**
 * Find or create a Stripe Customer for the given user.
 * Returns the Stripe Customer ID.
 */
export async function findOrCreateStripeCustomer(
  userId: string,
  existingCustomerId: string | null | undefined,
  email?: string | null,
): Promise<string> {
  const stripe = getStripe();

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripe.customers.create({
    metadata: { yocaUserId: userId },
    ...(email ? { email } : {}),
  });

  return customer.id;
}

function getPriceIdForTier(tier: string): string {
  switch (tier) {
    case "Lite":
      return process.env.STRIPE_PRICE_LITE || "price_lite_test";
    case "Plus":
      return process.env.STRIPE_PRICE_PLUS || "price_plus_test";
    case "Pro":
      return process.env.STRIPE_PRICE_PRO || "price_pro_test";
    default:
      throw new Error(`Unknown pricing tier: ${tier}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SetupIntent flow (replaces the broken PaymentIntent-on-invoice approach)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1 of the new flow.
 * Creates a SetupIntent so the frontend can securely collect a payment method.
 * The client_secret is passed to Stripe Elements → confirmSetup().
 * 
 * @param stripeCustomerId - Stripe customer ID
 * @param paymentMethod - Optional specific payment method to include ('card' or 'us_bank_account').
 *                        If omitted, both are included.
 */
export async function createSetupIntent(
  stripeCustomerId: string,
  paymentMethod?: "card" | "us_bank_account"
): Promise<Stripe.SetupIntent> {
  const stripe = getStripe();
  const paymentMethodTypes = paymentMethod
    ? [paymentMethod]
    : ["card", "us_bank_account"];

  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: "off_session",           // will be reused for recurring charges
    payment_method_types: paymentMethodTypes,
  });
}

export type ActivateSubscriptionOptions = {
  userId: string;
  stripeCustomerId: string;
  paymentMethodId: string;         // confirmed pm_xxx from frontend
  tier: string;
};

/**
 * Step 2 of the new flow.
 * Attaches the confirmed PaymentMethod to the customer, sets it as the default,
 * then creates the subscription. Because a valid PM is already attached,
 * Stripe charges immediately and the subscription status goes to "active".
 */
export async function activateSubscription(
  opts: ActivateSubscriptionOptions,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const priceId = getPriceIdForTier(opts.tier);

  // 1. Attach the payment method to the customer (idempotent if already attached)
  await stripe.paymentMethods.attach(opts.paymentMethodId, {
    customer: opts.stripeCustomerId,
  });

  // 2. Set it as the customer's default invoice payment method
  await stripe.customers.update(opts.stripeCustomerId, {
    invoice_settings: { default_payment_method: opts.paymentMethodId },
  });

  // 3. Create the subscription — it will charge immediately and become "active"
  const subscription = await stripe.subscriptions.create({
    customer: opts.stripeCustomerId,
    items: [{ price: priceId }],
    default_payment_method: opts.paymentMethodId,
    metadata: {
      yocaUserId: opts.userId,
      tier: opts.tier,
    },
    // Expand to ensure we get all fields
    expand: ["latest_invoice", "latest_invoice.payment_intent"],
  });

  console.log("[activateSubscription] Subscription created:", subscription.id, "Status:", subscription.status);
  
  return subscription;
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export async function retrievePaymentIntent(id: string) {
  const stripe = getStripe();
  return await stripe.paymentIntents.retrieve(id);
}

export async function cancelSubscription(subscriptionId: string) {
  const stripe = getStripe();
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function previewSubscriptionUpgrade(subscriptionId: string, newTier: string) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const prorationDate = Math.floor(Date.now() / 1000);
  const preview = await stripe.invoices.createPreview({
    subscription: subscriptionId,
    subscription_details: {
      items: [{
        id: subscription.items.data[0].id,
        price: getPriceIdForTier(newTier),
      }],
      proration_behavior: "always_invoice",
      proration_date: prorationDate,
    },
  });
  const prorations = preview.lines.data.filter(
    (line) => line.parent?.subscription_item_details?.proration,
  );

  return {
    amountDue: preview.amount_due,
    creditAmount: Math.abs(prorations.filter((line) => line.amount < 0).reduce((sum, line) => sum + line.amount, 0)),
    chargeAmount: prorations.filter((line) => line.amount > 0).reduce((sum, line) => sum + line.amount, 0),
    currency: preview.currency,
    prorationDate,
  };
}

export async function upgradeSubscription(
  subscriptionId: string,
  newTier: string,
  prorationDate?: number,
) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const newPriceId = getPriceIdForTier(newTier);
  const defaultPaymentMethod = subscription.default_payment_method;
  const paymentMethod = typeof defaultPaymentMethod === "string"
    ? await stripe.paymentMethods.retrieve(defaultPaymentMethod)
    : defaultPaymentMethod;
  const isBankPayment = paymentMethod?.type === "us_bank_account";

  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: "always_invoice",
    ...(prorationDate ? { proration_date: prorationDate } : {}),
    // Stripe pending updates don't support US bank accounts.
    payment_behavior: isBankPayment ? "error_if_incomplete" : "pending_if_incomplete",
    metadata: {
      ...subscription.metadata,
      tier: newTier,
    },
    expand: ["latest_invoice.payment_intent"],
  });

  const invoice = updatedSubscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice ? (invoice as any).payment_intent as Stripe.PaymentIntent : undefined;

  return {
    subscription: updatedSubscription,
    clientSecret: paymentIntent?.client_secret,
    applied: !updatedSubscription.pending_update,
    processing: isBankPayment && paymentIntent?.status === "processing",
  };
}
