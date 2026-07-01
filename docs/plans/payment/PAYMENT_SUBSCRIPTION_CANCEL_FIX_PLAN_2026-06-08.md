# Payment Subscription Cancel Fix Plan

Date: 2026-06-08
Last Updated: 2026-06-08

## Summary

Fix the subscription management bug where the profile page shows a Cancel Subscription action for every active subscription, including Solana prepaid access records stored with `stripeSubscriptionId = solana-...`. The backend currently sends that ID to Stripe's subscriptions API, which only accepts real Stripe subscription IDs such as `sub_...`.

## Audit Findings

| Area | Finding | Action |
|------|---------|--------|
| `ProfileSubscriptionsTab.tsx` | Cancel and Upgrade actions are shown for active Solana records | Hide management actions unless `stripeSubscriptionId` starts with `sub_` |
| `POST /api/payment/cancel` | Calls Stripe after ownership check for every subscription ID | Reject non-Stripe IDs with `400 UNSUPPORTED_SUBSCRIPTION_PROVIDER` |
| `POST /api/payment/upgrade` | Same provider mismatch risk as cancel | Apply the same non-Stripe guard before calling Stripe |
| Cancel DB sync | Route manually sets `cancelAtPeriodEnd` after Stripe update | Use `upsertSubscription(updatedSub)` so local state follows Stripe |

## Proposed Changes

### 1. Backend Route Guards

- In `server/src/routes/payment.route.ts`, keep the existing subscription ownership lookup.
- After ownership is confirmed, allow Stripe management only when `subscriptionId.startsWith("sub_")`.
- Return:
  `{ errorCode: "UNSUPPORTED_SUBSCRIPTION_PROVIDER", message: "This subscription is not managed by Stripe." }`
  with `400 Bad Request` for Solana/non-Stripe IDs.
- On successful Stripe cancel, call `upsertSubscription(updatedSub)` and include the normalized subscription in the response.

### 2. Frontend Subscription Actions

- In `client/src/components/profile/ProfileSubscriptionsTab.tsx`, derive `isStripeManagedSubscription` from `subscription.stripeSubscriptionId.startsWith("sub_")`.
- Render Cancel and Upgrade actions only for Stripe-managed active subscriptions.
- For Solana/non-Stripe subscriptions, keep showing the current period end as the access expiry date.

### 3. Tests

- Add server route coverage for Stripe cancel success, Solana cancel rejection, ownership rejection, and Solana upgrade rejection.
- Add client coverage for rendering Stripe management actions, hiding Solana management actions, displaying access expiry, and ensuring cancel submit only fires for Stripe-managed subscriptions.

## Verification

- `npm run test -w=server -- payment.route`
- `npm run test -w=client -- ProfileSubscriptionsTab`
- `npm run typecheck -w=server`
- `npm run typecheck -w=client`

## Assumptions

- Solana/non-Stripe subscription rows represent prepaid access, not recurring billing.
- Non-Stripe records should not be locally canceled from the subscription management UI.
- No schema or request payload changes are required.
