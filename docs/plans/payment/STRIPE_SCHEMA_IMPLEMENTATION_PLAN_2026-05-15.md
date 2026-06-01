# Stripe Database Schema Implementation Plan

Date: 2026-05-15
Last Updated: 2026-05-15

## Summary
Add database schema definitions for Stripe subscriptions and payment history using Drizzle ORM. This will enable tracking user subscription states, plan tiers, and a ledger of all payment transactions.

---

## Proposed Changes

### 1. Database Schema Updates (`server/src/db/schema.ts`)

#### Enums
- **`enumPlanTier`**: Defines the available subscription levels (`Lite`, `Plus`, `Pro`).
- **`enumSubscriptionStatus`**: Tracks Stripe subscription states (`active`, `past_due`, `canceled`, `incomplete`, `trialing`, `unpaid`).
- **`enumPaymentStatus`**: Tracks the outcome of a payment attempt (`succeeded`, `failed`, `pending`).

#### Tables
- **`subscriptions`**:
    - Stores the active subscription details for a user.
    - Linked to `users` via `userId`.
    - Includes Stripe-specific IDs (`stripeSubscriptionId`, `stripeCustomerId`) for API synchronization.
    - Tracks period boundaries (`currentPeriodStart`, `currentPeriodEnd`) and cancellation flags.
- **`paymentHistory`**:
    - A ledger of all payment attempts and successes.
    - Linked to `users` and optionally `subscriptions`.
    - Stores amount in cents and currency.
    - Stores `paymentMethodDetails` as JSONB for UI display (e.g., card brand, last 4 digits).

---

## Step-by-step Execution Order

### Phase 1: Schema Definition
1. Define new enums in `server/src/db/schema.ts`.
2. Define the `subscriptions` table.
3. Define the `paymentHistory` table.
4. Export the new tables and enums.

### Phase 2: Migration (Manual Step)
1. Run `npx drizzle-kit generate` to create the migration file.
2. Run `npx drizzle-kit migrate` (or the project's equivalent command) to apply changes to the database.

---

## Verification Plan

### Automated Verification
- Verify that the Hono server starts correctly with the new schema.
- Run existing tests to ensure no regressions in the `users` table or other related entities.

### Manual Verification
- Inspect the generated SQL migration to ensure foreign keys and unique constraints are correctly defined.
- (In a follow-up task) Verify data insertion via the Stripe webhook or service logic.
