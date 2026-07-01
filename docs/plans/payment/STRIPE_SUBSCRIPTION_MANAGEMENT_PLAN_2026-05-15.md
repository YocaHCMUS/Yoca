# Stripe Subscription Management Implementation Plan

Date: 2026-05-15
Last Updated: 2026-05-15

## Goal
Implement "Cancel Subscription" and "Upgrade Plan (Prorated)" features using Stripe's native Subscriptions API and integrate them into the React frontend and Hono backend.

## ⚠️ Critical Architecture Notice & Prerequisite
Currently, the application processes payments using **one-off `PaymentIntents`** (e.g., creating a `pi_...` and manually granting 30 days of access). 

To support Stripe's native `cancel_at_period_end` and automatic proration calculations, **we must migrate from one-off PaymentIntents to Stripe Billing (Subscriptions)**. 

### What this migration entails:
1. **Stripe Dashboard Setup:** You will need to create "Products" and "Prices" in your Stripe Dashboard for 'Lite', 'Plus', and 'Pro' tiers, generating `price_...` IDs.
2. **Checkout Flow Update:** Change `/api/payment/create-intent` to create a `stripe.subscriptions.create()` instead of a `paymentIntent`. 
3. **Webhook Updates:** Listen for `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_succeeded` instead of `payment_intent.succeeded`.

---

## Proposed Changes (Assuming Subscription Migration)

### 1. Backend API Updates

#### [NEW] `POST /api/stripe/cancel`
- **Payload:** `{ subscriptionId: string }`
- **Logic:**
  1. Call `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })`.
  2. Update Drizzle `subscriptions` table: `set { cancelAtPeriodEnd: true }`.
- **Response:** Success message and updated subscription state.

#### [NEW] `POST /api/stripe/upgrade`
- **Payload:** `{ subscriptionId: string, newPriceId: string }`
- **Logic:**
  1. Call `stripe.subscriptions.retrieve(subscriptionId)` to get the current `subscription_item` ID.
  2. Call `stripe.subscriptions.update(subscriptionId, { ... })`:
     - Provide the `items` array with the old item ID and the new `price` ID.
     - Set `proration_behavior: 'create_prorations'`.
     - Stripe will automatically calculate the difference and generate an invoice. 
     - **Important:** We will set `payment_behavior: 'pending_if_incomplete'` or `'default_incomplete'` depending on whether we want to charge the default card on file immediately or require 3D secure.
  3. Update Drizzle `subscriptions` table: `set { planTier: newTier }`.

### 2. Frontend UI Updates

#### `SubscriptionsPage` (Cancel UI)
- Add a "Cancel Subscription" button next to the active plan details in `ProfileSubscriptionsTab.tsx`.
- Clicking the button opens a `<ConfirmationModal>` (e.g., "Are you sure you want to cancel? You will keep access until the end of your billing period.").
- On confirm, call `POST /api/stripe/cancel`.
- Update the UI to show a "Cancels on [Date]" badge instead of "Active".

#### Upgrade UI Flow (Proration Handling)
**How to handle the upgrade trigger:**
Because prorated upgrades might require the user to pay an immediate difference, you have two options. **We recommend Option A for the smoothest UX, but it requires a saved card:**

- **Option A (Immediate Charge - Recommended):** If the user already has a saved card attached to their Stripe Customer, the backend can immediately attempt to charge the prorated amount when `stripe.subscriptions.update` is called. If successful, the plan upgrades instantly. If it fails (e.g., requires 3D Secure), the backend returns a `client_secret` of the resulting invoice's PaymentIntent, and the frontend redirects the user to the `CheckoutForm` to complete authentication.
- **Option B (Preview & Checkout):** Use Stripe's "Upcoming Invoice" endpoint (`stripe.invoices.retrieveUpcoming`) to show the user the exact prorated amount *before* upgrading. Once they click "Confirm Upgrade", route them to the `CheckoutForm` to pay.

*For this plan, we will assume Option A, as it is standard for SaaS.*

---

## User Review Required
1. **Migration to Subscriptions:** Do you approve migrating the current PaymentIntent flow to Stripe Subscriptions? (This requires you to create Price IDs in your Stripe Dashboard).
2. **Upgrade UX:** Do you prefer Option A (immediate charge on saved card, fallback to checkout) or Option B (preview proration first, then checkout)?

Please let me know how you'd like to proceed!
