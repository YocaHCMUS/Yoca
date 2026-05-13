// server/src/routes/payment.route.ts
import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { setErr } from "@sv/config/errors.js";
import { db } from "@sv/db/index.js";
import { users } from "@sv/db/schema.js";
import { validate } from "@sv/middlewares/validation.js";
import {
  createPaymentIntent,
  findOrCreateStripeCustomer,
} from "@sv/services/stripe.service.js";
import { getUserById } from "@sv/services/users.js";
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

const createIntentSchema = z.object({
  tier: z.enum(["Lite", "Plus", "Pro"]),
  saveCard: z.boolean().default(false),
});

const app = new Hono()
  /**
   * POST /api/payment/create-intent
   * Creates a Stripe PaymentIntent for the authenticated user.
   * Returns { clientSecret, publishableKey }
   */
  .post(
    "/create-intent",
    honoJwt,
    validate("json", createIntentSchema),
    async (c) => {
      try {
        const payload = c.get("jwtPayload") as { id?: string } | undefined;
        const userId = payload?.id;

        if (!userId) {
          return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
        }

        const user = await getUserById(userId);
        if (!user) {
          return c.json(setErr("INVALID_TOKEN_PAYLOAD"), statusCode.Unauthorized);
        }

        const { tier, saveCard } = c.req.valid("json");

        // Find or create Stripe Customer, then persist the ID back to our DB.
        const stripeCustomerId = await findOrCreateStripeCustomer(
          userId,
          user.stripeCustomerId,
          user.email,
        );

        // If a new customer was created, persist the ID.
        if (!user.stripeCustomerId) {
          await db
            .update(users)
            .set({ stripeCustomerId })
            .where(eq(users.id, userId));
        }

        const clientSecret = await createPaymentIntent({
          userId,
          stripeCustomerId,
          tier,
          saveCard,
        });

        const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? "";

        return c.json({ clientSecret, publishableKey }, statusCode.Ok);
      } catch (err: any) {
        console.error("[payment/create-intent]", err);

        // Handle Stripe card errors (e.g. declined, incorrect CVC)
        if (err.type === "StripeCardError") {
          return c.json(
            { errorCode: "PAYMENT_FAILED", message: err.message },
            statusCode.BadRequest,
          );
        }

        const isConfigError =
          err instanceof Error &&
          err.message === "STRIPE_SECRET_KEY is not configured";
        if (isConfigError) {
          return c.json(
            { errorCode: "INTERNAL_SERVER_ERR", message: "Stripe is not configured" },
            statusCode.InternalServerError,
          );
        }
        return c.json(setErr("INTERNAL_SERVER_ERR"), statusCode.InternalServerError);
      }
    },
  );

export default app;
