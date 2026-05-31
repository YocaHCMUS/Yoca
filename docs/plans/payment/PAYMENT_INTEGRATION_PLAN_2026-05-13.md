# Payment Integration Implementation Plan

Date: 2026-05-13
Last Updated: 2026-05-13

## Summary
Implement a Stripe payment integration triggered from the Pricing page, enabling users to purchase subscription tiers. The integration will verify authentication before proceeding, intercepting unauthenticated users with an Auth Reminder Modal. Authenticated users will proceed to a Stripe Elements payment modal using the test environment, with an option to save their card for future use, requiring backend mappings for Stripe Customer IDs.

---

## Frontend Architecture

### New Components
1. **`AuthReminderModal`**
   - **Location:** `client/src/components/auth/AuthReminderModal.tsx`
   - **Functionality:** Intercepts unauthenticated users attempting to purchase. It will reuse the UI patterns from `UnauthorizedPage` (dark theme, "Access Denied" messaging, "Go to Login" button) but adapted into a modal format. Clicking "Go to Login" will trigger the existing `SignInModal`.
2. **`PaymentModalWrapper`**
   - **Location:** `client/src/components/payment/PaymentModalWrapper.tsx`
   - **Functionality:** Wraps the Stripe `Elements` provider. Loads the Stripe promise using `@stripe/stripe-js` with the test publishable key. Fetches a PaymentIntent `clientSecret` from the backend upon mounting based on the selected tier.
3. **`CheckoutForm`**
   - **Location:** `client/src/components/payment/CheckoutForm.tsx`
   - **Functionality:** Renders the `PaymentElement` from Stripe. Includes a native React state for the `saveCardForFutureUse` checkbox. Handles form submission via `stripe.confirmPayment()`, mapping the save card preference to Stripe's `setup_future_usage` parameter.

### State Management & Navigation (`PricingPage`)
- **Location:** `client/src/pages/pricing/index.tsx`
- **Updates:**
  - Add state hooks: `isAuthReminderOpen`, `isPaymentModalOpen`, and `selectedTier`.
  - On "Buy Now" / "Try For Free" click:
    - Verify authentication state (e.g., via `useAuth` context).
    - If **NOT** logged in: `setIsAuthReminderOpen(true)`.
    - If logged in: `setSelectedTier(tier)`, then `setIsPaymentModalOpen(true)`.

---

## Backend Architecture

### Database Schema Updates (Drizzle)
- **Location:** `server/src/db/schema.ts`
- **Change:** Add a new `stripeCustomerId` column to the existing `users` table to persist the mapping between our DB users and Stripe customers.
  ```typescript
  export const users = pgTable("users", {
    // ... existing fields
    stripeCustomerId: varchar("stripe_customer_id"),
  });
  ```

### New API Routes (Hono)
- **Location:** `server/src/routes/payment.ts` (or similar new route file registered in `main.ts`)
- **Endpoint:** `POST /api/payment/create-intent`
- **Logic:**
  1. Validate user session (must be authenticated).
  2. Check if `user.stripeCustomerId` exists. If not, call `stripe.customers.create({ email: user.email })` and update the `users` table.
  3. Create a `PaymentIntent` using the `stripeCustomerId`, the requested tier's amount, and `setup_future_usage: 'off_session'` (if the save card flag is passed from the client, though often best handled client-side during confirmation to avoid duplicate intents).
  4. Return the `clientSecret` to the frontend.

### Stripe Node.js SDK Logic
- **Location:** `server/src/services/stripe.ts`
- **Logic:** Initialize the Stripe instance using the test secret key (`sk_test_...`). Export helper functions for customer creation and intent generation to keep the route handlers clean.

---

## Step-by-step Execution Order

### Phase 1: Database & Backend Setup
1. **Schema Change:** Add `stripeCustomerId` to the `users` table in `server/src/db/schema.ts`.
2. **Migration:** Generate and apply the Drizzle migration for the schema update.
3. **Stripe Service:** Create `server/src/services/stripe.ts` and initialize the Stripe SDK.
4. **API Routes:** Create the `POST /api/payment/create-intent` Hono route, implementing the logic to fetch/create Stripe Customers and generate the PaymentIntent `clientSecret`.

### Phase 2: Frontend Authentication Check
1. **UI Component:** Create the `AuthReminderModal` component, adapting the design from `UnauthorizedPage`.
2. **Pricing Page Logic:** Update the `PricingPage` buttons to check user authentication status.
3. **Integration:** Wire the "Buy Now" buttons to open `AuthReminderModal` when the user is logged out, ensuring smooth handoff to the `SignInModal` and back.

### Phase 3: Stripe React Integration (Test Environment)
1. **Dependencies:** Verify/install `@stripe/react-stripe-js` and `@stripe/stripe-js`.
2. **Payment UI:** Build `PaymentModalWrapper` and `CheckoutForm` components.
3. **Pricing Integration:** Mount `PaymentModalWrapper` conditionally in `PricingPage` when a logged-in user selects a tier.
4. **Save Card Logic:** Ensure the "Save this card for future payments" checkbox correctly appends the setup parameters to the `stripe.confirmPayment` call.
5. **Testing:** Perform end-to-end testing using Stripe test cards (e.g., `4242 4242 4242 4242`) in the devnet environment.
