// server/src/services/stripe.service.ts
import Stripe from "stripe";

// Lazily initialised so the server boots even without a key in dev.
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
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

/** Price amounts (in cents) keyed by tier name. */
const TIER_AMOUNTS: Record<string, number> = {
  Lite: 3900,   // $39
  Plus: 19900,  // $199
  Pro: 49900,   // $499
};

export type CreatePaymentIntentOptions = {
  userId: string;
  stripeCustomerId: string;
  tier: string;
  /** If true, the PaymentMethod will be saved for future off-session use. */
  saveCard: boolean;
};

/**
 * Creates a Stripe PaymentIntent and returns its client_secret.
 */
export async function createPaymentIntent(
  opts: CreatePaymentIntentOptions,
): Promise<string> {
  const stripe = getStripe();

  const amount = TIER_AMOUNTS[opts.tier];
  if (!amount) {
    throw new Error(`Unknown pricing tier: ${opts.tier}`);
  }

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    customer: opts.saveCard ? opts.stripeCustomerId : undefined,
    // Temporarily limit to 'card' only. Other methods like 'link' or 'sepa_debit' can be added here later.
    payment_method_types: ["card"],
    ...(opts.saveCard
      ? { setup_future_usage: "off_session" }
      : {}),
    metadata: {
      yocaUserId: opts.userId,
      tier: opts.tier,
    },
  });

  if (!intent.client_secret) {
    throw new Error("Stripe did not return a client_secret");
  }

  return intent.client_secret;
}
