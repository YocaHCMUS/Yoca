// server/src/routes/stripe-webhook.ts
import { constructEvent, getStripe } from "@sv/services/stripe.service.js";
import { upsertSubscription, recordInvoicePayment } from "@sv/services/subscription.service.js";
import { Hono } from "hono";
import type Stripe from "stripe";

const app = new Hono();

app.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    console.warn("[stripe-webhook] Missing stripe-signature header");
    return c.text("Webhook Error: Missing signature", 400);
  }

  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set in environment variables.");
    return c.text("Webhook Error: Server configuration issue", 500);
  }

  let event: Stripe.Event;

  try {
    const body = await c.req.text();
    event = constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] Error verifying webhook: ${errMsg}`);
    return c.text(`Webhook Error: ${errMsg}`, 400);
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await upsertSubscription(subscription);
      console.log(`[stripe-webhook] Successfully processed subscription ${subscription.id}`);
    }

    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_succeeded" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoicePayment(
        invoice,
        event.type === "invoice.payment_failed" ? "failed" : "succeeded",
      );
      console.log(`[stripe-webhook] Successfully processed invoice payment ${invoice.id}`);
    }

    if (event.type === "invoice_payment.paid") {
      const invoicePayment = event.data.object as Stripe.InvoicePayment;
      const invoiceId =
        typeof invoicePayment.invoice === "string"
          ? invoicePayment.invoice
          : invoicePayment.invoice.id;
      const invoice = await getStripe().invoices.retrieve(invoiceId, {
        expand: ["payments.data.payment.payment_intent"],
      });
      await recordInvoicePayment(invoice, "succeeded");
    }

    return c.text("OK", 200);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] Error processing event: ${errMsg}`);
    return c.text("Internal Server Error", 500);
  }
});

export default app;
