// server/src/routes/payment.route.ts
import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { setErr } from "@sv/util/errors.js";
import { db } from "@sv/db/index.js";
import { users, subscriptions } from "@sv/db/schema.js";
import { validate } from "@sv/middlewares/validation.js";
import {
  createSetupIntent,
  activateSubscription,
  findOrCreateStripeCustomer,
  retrievePaymentIntent,
} from "@sv/services/stripe.service.js";
import { getUserById } from "@sv/services/users.js";
import {
  upsertSubscription,
  recordInvoicePayment,
} from "@sv/services/subscription.service.js";
import { statusCode } from "@sv/util/responses.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import z from "zod";

const honoJwt = jwt({
  alg: "HS256",
  secret: process.env.JWT_SECRET!,
  cookie: AUTH_COOKIE_NAME,
});

const app = new Hono()
  /**
   * POST /api/payment/setup-intent
   *
   * Step 1 of the SetupIntent flow.
   * Creates a Stripe SetupIntent so the frontend can collect a card via
   * Stripe Elements and confirmSetup(). Returns the client_secret.
   */
  .post(
    "/setup-intent",
    honoJwt,
    validate("json", z.object({ tier: z.enum(["Lite", "Plus", "Pro"]) })),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        const userId = payload?.id;
        if (!userId)
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );

        const user = await getUserById(userId);
        if (!user)
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );

        const { tier } = c.req.valid("json");

        const stripeCustomerId = await findOrCreateStripeCustomer(
          userId,
          user.stripeCustomerId,
          user.email,
        );

        // Persist the customer ID if it was just created
        if (!user.stripeCustomerId) {
          await db
            .update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, userId));
        }

        const setupIntent = await createSetupIntent(stripeCustomerId);
        const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";

        console.log(
          "[setup-intent] Created SetupIntent:",
          setupIntent.id,
          "for tier:",
          tier,
        );

        return c.json(
          {
            clientSecret: setupIntent.client_secret,
            setupIntentId: setupIntent.id,
            publishableKey,
            tier,
          },
          statusCode.Ok,
        );
      } catch (err: any) {
        console.error("[payment/setup-intent]", err);
        return c.json(
          {
            errorCode: "INTERNAL_SERVER_ERR",
            message: err.message || "An unknown error occurred.",
          },
          statusCode.InternalServerError,
        );
      }
    },
  )

  /**
   * POST /api/payment/activate-subscription
   *
   * Step 2 of the SetupIntent flow.
   * Called after the frontend successfully calls confirmSetup() and receives
   * the confirmed paymentMethodId (pm_xxx). This endpoint:
   *  1. Attaches the PM to the customer
   *  2. Sets it as default
   *  3. Creates the subscription → subscription goes "active" immediately
   *  4. Upserts the subscription record in our DB
   */
  .post(
    "/activate-subscription",
    honoJwt,
    validate(
      "json",
      z.object({
        paymentMethodId: z.string().startsWith("pm_"),
        tier: z.enum(["Lite", "Plus", "Pro"]),
      }),
    ),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        const userId = payload?.id;
        if (!userId)
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );

        const user = await getUserById(userId);
        if (!user)
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );

        const { paymentMethodId, tier } = c.req.valid("json");

        // stripeCustomerId must already exist at this point (created in setup-intent step)
        const stripeCustomerId = user.stripeCustomerId;
        if (!stripeCustomerId) {
          return c.json(
            {
              errorCode: "BAD_REQUEST",
              message:
                "No Stripe customer found. Please restart the payment flow.",
            },
            statusCode.BadRequest,
          );
        }

        const subscription = await activateSubscription({
          userId,
          stripeCustomerId,
          paymentMethodId,
          tier,
        });

        // Persist to our DB immediately (webhook will also fire, that's fine — upsert is idempotent)
        await upsertSubscription(subscription);

        // Record the initial payment/invoice
        try {
          const { getStripe } = await import("@sv/services/stripe.service.js");
          const stripeClient = getStripe();

          // Fetch invoices for this subscription to capture the initial payment
          const invoices = await stripeClient.invoices.list({
            subscription: subscription.id,
            limit: 1,
          });

          if (invoices.data.length > 0) {
            const invoice = await stripeClient.invoices.retrieve(
              invoices.data[0].id,
              {
                expand: ["payment_intent"],
              },
            );
            await recordInvoicePayment(invoice);
            console.log(
              "[payment/activate-subscription] Recorded initial payment for invoice:",
              invoice.id,
            );
          }
        } catch (invoiceErr: any) {
          console.warn(
            "[payment/activate-subscription] Could not record initial payment:",
            invoiceErr.message,
          );
          // Don't fail the response if we can't record the invoice — the subscription was created successfully
        }

        return c.json(
          {
            success: true,
            subscriptionId: subscription.id,
            status: subscription.status,
          },
          statusCode.Ok,
        );
      } catch (err: any) {
        console.error("[payment/activate-subscription]", err);

        if (err.type === "StripeCardError") {
          return c.json(
            { errorCode: "PAYMENT_FAILED", message: err.message },
            statusCode.BadRequest,
          );
        }

        return c.json(
          {
            errorCode: "INTERNAL_SERVER_ERR",
            message: err.message || "An unknown error occurred.",
          },
          statusCode.InternalServerError,
        );
      }
    },
  )

  /**
   * POST /api/payment/confirm
   * Manually verify a PaymentIntent status (used by upgrade flow).
   */
  .post(
    "/confirm",
    honoJwt,
    validate("json", z.object({ paymentIntentId: z.string() })),
    async (c) => {
      try {
        const { paymentIntentId } = c.req.valid("json");
        const intent = await retrievePaymentIntent(paymentIntentId);

        if (intent.status === "succeeded") {
          const { getStripe } = await import("@sv/services/stripe.service.js");
          const stripeClient = getStripe();

          const intentAny = intent as any;
          if (intentAny.invoice) {
            const invoiceId =
              typeof intentAny.invoice === "string"
                ? intentAny.invoice
                : intentAny.invoice.id;
            const invoice = await stripeClient.invoices.retrieve(invoiceId, {
              expand: ["payment_intent"],
            });

            const invoiceAny = invoice as any;
            if (invoiceAny.subscription) {
              const subId =
                typeof invoiceAny.subscription === "string"
                  ? invoiceAny.subscription
                  : invoiceAny.subscription.id;
              const subscription =
                await stripeClient.subscriptions.retrieve(subId);

              const sub = await upsertSubscription(subscription);
              await recordInvoicePayment(invoice);

              return c.json(
                { success: true, subscription: sub },
                statusCode.Ok,
              );
            }
          }
          return c.json(
            { success: true, message: "No subscription attached." },
            statusCode.Ok,
          );
        }

        return c.json(
          { success: false, status: intent.status },
          statusCode.BadRequest,
        );
      } catch (err: any) {
        console.error("[payment/confirm]", err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )

  /**
   * POST /api/payment/cancel
   */
  .post(
    "/cancel",
    honoJwt,
    validate("json", z.object({ subscriptionId: z.string() })),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        if (!payload?.id)
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );

        const { subscriptionId } = c.req.valid("json");

        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        if (!sub || sub.userId !== payload.id) {
          return c.json(
            { errorCode: "NOT_FOUND", message: "Subscription not found" },
            statusCode.NotFound,
          );
        }

        const { cancelSubscription } = await import(
          "@sv/services/stripe.service.js"
        );
        const updatedSub = await cancelSubscription(subscriptionId);

        await db
          .update(subscriptions)
          .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

        return c.json(
          {
            success: true,
            status: updatedSub.status,
            cancel_at_period_end: updatedSub.cancel_at_period_end,
          },
          statusCode.Ok,
        );
      } catch (err: any) {
        console.error("[payment/cancel]", err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  )

  /**
   * POST /api/payment/upgrade
   */
  .post(
    "/upgrade",
    honoJwt,
    validate(
      "json",
      z.object({
        subscriptionId: z.string(),
        newTier: z.enum(["Lite", "Plus", "Pro"]),
      }),
    ),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        if (!payload?.id)
          return c.json(
            setErr("INVALID_TOKEN_PAYLOAD"),
            statusCode.Unauthorized,
          );

        const { subscriptionId, newTier } = c.req.valid("json");

        const [sub] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        if (!sub || sub.userId !== payload.id) {
          return c.json(
            { errorCode: "NOT_FOUND", message: "Subscription not found" },
            statusCode.NotFound,
          );
        }

        const { upgradeSubscription } = await import(
          "@sv/services/stripe.service.js"
        );
        const { subscription, clientSecret } = await upgradeSubscription(
          subscriptionId,
          newTier,
        );

        if (!clientSecret) {
          await db
            .update(subscriptions)
            .set({ planTier: newTier as any, updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
        }

        return c.json(
          {
            success: true,
            subscriptionId: subscription.id,
            clientSecret,
            status: subscription.status,
          },
          statusCode.Ok,
        );
      } catch (err: any) {
        console.error("[payment/upgrade]", err);
        return c.json(
          setErr("INTERNAL_SERVER_ERR"),
          statusCode.InternalServerError,
        );
      }
    },
  );

export default app;
