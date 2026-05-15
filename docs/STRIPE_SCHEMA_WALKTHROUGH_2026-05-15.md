# Stripe Database Schema Walkthrough

Date: 2026-05-15

## Summary of Changes
I have added the database schema definitions for Stripe integration using Drizzle ORM. This includes new enums for plan tiers and statuses, as well as the `subscriptions` and `payment_history` tables.

### 1. New Enums
- **`enumPlanTier`**: `['Lite', 'Plus', 'Pro']`
- **`enumSubscriptionStatus`**: `['active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid', 'paused']`
- **`enumPaymentStatus`**: `['succeeded', 'failed', 'pending', 'refunded']`

### 2. `subscriptions` Table
This table tracks the active/inactive plan of a user.
- **Fields**: `id`, `user_id` (FK to `users`), `stripe_customer_id`, `stripe_subscription_id` (unique), `plan_tier`, `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `created_at`, `updated_at`.

### 3. `payment_history` Table
This table acts as a ledger for every individual charge/invoice.
- **Fields**: `id`, `user_id` (FK to `users`), `subscription_id` (FK to `subscriptions`, nullable), `stripe_payment_intent_id` (unique), `amount` (cents), `currency` (default 'usd'), `status`, `payment_method_details` (JSONB), `created_at`.

## Files Modified
- [schema.ts](file:///d:/DH/DATN/Yoca/server/src/db/schema.ts)

## Verification
- [x] Schema syntax verified against Drizzle documentation.
- [x] Foreign key constraints correctly reference the `users` and `subscriptions` tables.
- [x] Unique constraints applied to Stripe-specific IDs to prevent duplicate records.

---
**Next Steps**:
1. Run Drizzle Kit to generate and apply migrations.
2. Implement the Stripe webhook listener to populate these tables.
