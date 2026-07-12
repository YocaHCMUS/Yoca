# Yoca Account, Profile, Watchlist, Pricing, Subscription, and Payment Frontend Architecture Audit

## 1. Scope

This high-level audit covers the account and billing frontend as one subsystem, centered on the active profile and pricing routes and the connected payment and password-recovery boundaries.

In scope:

- Profile and account routes
- Profile overview, tabs, settings, and subscription presentation
- Token and wallet watchlists shown in Profile
- Pricing page and upgrade entry
- Checkout and payment modal boundaries
- Payment success, cancellation, and return behavior
- Forgot-password and reset-password route boundaries when actively connected
- Authentication guards relevant to these pages
- Major frontend API boundaries used by the subsystem
- Route-inactive, duplicate, or incomplete account/billing implementations

Out of scope:

- Authentication internals, password hashing or token generation, payment-provider backend implementation, webhook processing, database schemas, email-delivery implementation, detailed form validation, every profile or pricing field, detailed CSS, deployment, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02C_WALLET_FRONTEND_ARCHITECTURE.md`, `02D_ALERTS_FRONTEND_ARCHITECTURE.md`, `02E_WASH_TRADING_FRONTEND_ARCHITECTURE.md`, and `02F_POOL_HISTORICAL_FRONTEND_ARCHITECTURE.md`.

## 2. Architecture summary

The subsystem is split across two active top-level pages and several embedded modal/workspace boundaries:

- `/profile` is the authenticated account hub with tabs for overview, dashboard, alerts, wallets, watchlist, activity, subscriptions, and settings.
- `/pricing` is the public upgrade page. It presents plan choices and opens payment or reminder flows.
- Payment is handled through modal overlays rather than dedicated checkout routes.
- Account settings own profile identity updates, password management, and account deletion actions.
- Watchlists are shared across profile and wallet surfaces through the shared watchlist context.

There are no confirmed active forgot-password or reset-password routes in the inspected source. Payment success is handled as a pricing-page query-return flow, not as a standalone route.

## 3. Active routes

| Route | Main component | Auth requirement | Status |
|---|---|---|---|
| `/profile` | `ProfilePage` | `AuthGuard` | Active and directly reachable for signed-in users. |
| `/pricing` | `PricingPage` | None confirmed | Active and directly reachable. |
| `/unauthorized` | `UnauthorizedPage` | None confirmed | Active fallback route used by guards. |
| Payment return via `/pricing?success=true&tier=...` | `PricingPage` / `PaymentSuccessModal` | Auth depends on chosen flow | Active return boundary, not a separate route. |

No dedicated checkout route, forgot-password route, or reset-password route was confirmed in the active router tree.

## 4. Main render architecture

### `/profile`

```text
/profile
└─ AuthGuard
   └─ ProfilePage
      ├─ Account overview tab
      ├─ Dashboard tab
      ├─ Alerts tab
      ├─ Wallets tab
      ├─ Watchlist tab
      ├─ Activity tab
      ├─ Subscriptions tab
      └─ Settings tab
```

### `/pricing`

```text
/pricing
└─ PricingPage
   ├─ Plan cards
   ├─ Auth reminder modal
   ├─ Payment modal wrapper
   │  └─ Checkout form
   └─ Payment success modal
```

## 5. Major frontend capabilities

| Capability | Main components | Responsibility | Classification | Major limitation |
|---|---|---|---|---|
| Profile route and shell | `ProfilePage`, `AuthGuard`, `TabContainer` | Hosts the authenticated account hub and its tabbed workspace | `ACTIVE` | The page is tab-driven and relies on local state for tab selection. |
| Profile overview and account settings | `ProfilePortfolioTab`, `ProfileDashboardTab`, `ProfileSettingsTab` | Presents account summary, editable identity, password actions, and account deletion controls | `ACTIVE_WITH_LIMITATIONS` | Settings use local form state and request-driven save/update flows. |
| Profile watchlists | `ProfileWatchlistTab`, `WatchlistContext` | Surfaces token and wallet watchlists inside Profile | `ACTIVE_WITH_LIMITATIONS` | Watchlist state is shared and optimistic, so errors can roll back locally. |
| Subscription summary | `ProfileSubscriptionsTab` | Presents current plan, subscription history, and payment history | `ACTIVE_WITH_LIMITATIONS` | Billing state is loaded on demand and can fall back to empty or partial views. |
| Pricing page | `PricingPage` | Presents plan options and purchase entry points | `ACTIVE` | The pricing page mixes static plan presentation with modal payment entry. |
| Checkout and payment entry | `PaymentModalWrapper`, `CheckoutForm`, `PaymentSuccessModal`, `AuthReminderModal` | Opens the purchase flow and completes subscription activation | `ACTIVE_WITH_LIMITATIONS` | Checkout is modal-based, not a dedicated route, and depends on payment-provider state. |
| Billing management | `ProfileSubscriptionsTab` | Cancels or upgrades supported subscriptions | `ACTIVE_WITH_LIMITATIONS` | Management is limited to Stripe-managed subscriptions and local confirmation flows. |
| Password recovery boundary | Route tree and settings tab | Exposes password update in settings; no recovery routes confirmed | `NOT_IMPLEMENTED` | No active forgot-password or reset-password route was confirmed. |
| Loading and error boundary | `ProfilePage`, `ProfileSubscriptionsTab`, `ProfileSettingsTab`, `PricingPage` | Surfaces page-local loading, empty, and inline failure states | `ACTIVE_WITH_LIMITATIONS` | Errors are mostly local and not unified at the route level. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `ACTIVE` | 2 |
| `ACTIVE_WITH_LIMITATIONS` | 6 |
| `BROKEN` | 0 |
| `ROUTE_INACTIVE` | 0 |
| `NOT_IMPLEMENTED` | 1 |
| `UNCERTAIN` | 0 |
| **Total major account/billing capabilities** | 9 |

## 6. Profile and account architecture

`ProfilePage` is the authenticated account hub. It loads page data and shared wallet data separately, then feeds those results into tab content.

- `useProfilePageData({ period })` provides the main profile data payload for the current period.
- `useProfileSharedData({ setLoading })` loads linked wallet data and wallet addresses for profile tabs.
- `ProfileSettingsTab` loads a snapshot, allows identity updates, password updates, and account deletion flows, and refreshes the authenticated user after identity changes.
- `AuthGuard` protects the route; `ProfilePage` itself is not responsible for authentication.
- The profile page uses local tab state and resets to the first tab if the selected tab becomes invalid.

The settings tab is the main account-security boundary. It supports identity updates, password updates, and account deletion requests, but no password-recovery route was confirmed in the active router tree.

## 7. Watchlist architecture

Watchlists are shared across the profile and wallet subsystems through `WatchlistContext`.

- `ProfileWatchlistTab` displays token and wallet watchlists inside Profile.
- Token watchlist rows navigate to `/tokens/:address`.
- Wallet watchlist rows navigate to `/wallets/:address`.
- The context exposes token and wallet add/remove operations with optimistic local updates.
- The profile tab also uses linked-wallet data and profile overview helpers to enrich watchlist rows.

The watchlist story is active and useful, but it is split across shared context, profile tabs, and wallet pages. The main limitation is that updates are locally optimistic and can roll back if the underlying request fails.

## 8. Pricing and subscription architecture

`PricingPage` is the public upgrade surface.

- It presents Lite, Standard, Plus, and Pro tier presentations through a static plan layout.
- It supports a local toggle between Lite and Standard presentation for the first card.
- It uses modal boundaries for reminder and payment actions.
- It reflects payment success from `?success=true&tier=...` on the pricing route.

`ProfileSubscriptionsTab` is the authenticated subscription-management surface.

- It loads current subscription, subscription history, and payment history.
- It shows the current plan and prior billing records.
- It can cancel or upgrade Stripe-managed subscriptions.
- Upgrade/cancel actions are gated by the subscription type and current status.

The current-plan presentation is active in both places, but the pricing page is a marketing/entry surface while the profile subscriptions tab is the management surface.

## 9. Checkout and payment boundaries

Checkout is modal-based, not route-based.

- `PricingPage` opens `PaymentModalWrapper` for authenticated users after a purchase CTA.
- Guests are sent to `AuthReminderModal` instead of checkout.
- `PaymentModalWrapper` loads Stripe elements lazily when a paid tier is selected.
- `CheckoutForm` creates the setup intent, confirms the payment method, and activates the subscription through the payment API boundary.
- `PaymentSuccessModal` confirms successful return-state handling and clears the return query from the URL.

The main limitation is that checkout is not a durable route. The payment flow depends on modal state and a pricing-page return contract rather than a separate checkout page.

## 10. Frontend API boundaries

| Frontend block | API category | Trigger | Purpose | Major limitation |
|---|---|---|---|---|
| Profile page data | Profile data | `ProfilePage` mount and period changes | Load profile overview data for the current account | Data loading is split across multiple hooks and providers. |
| Profile shared data | Linked wallets | `ProfilePage` mount | Load wallets shared across profile tabs | Failure is handled locally and can leave tabs partially populated. |
| Account settings snapshot | Profile update / settings | `ProfileSettingsTab` mount and save actions | Load and mutate account identity and password state | No active forgot/reset recovery API boundary was confirmed. |
| Watchlists | Watchlist APIs | `WatchlistContext` mount and row actions | Hydrate and mutate token and wallet watchlists | Updates are optimistic and rollback locally on failure. |
| Current subscription | Subscription APIs | `ProfileSubscriptionsTab` mount and refresh actions | Load current subscription, subscriptions list, and payment history | Billing data is loaded in-tab and can degrade to empty views. |
| Billing management | Subscription cancellation / upgrade | `ProfileSubscriptionsTab` actions | Cancel or upgrade Stripe-managed subscriptions | Only Stripe-managed subscriptions are managed directly. |
| Checkout creation | Payment setup / activation | `CheckoutForm` submit | Create setup intent and activate the selected tier | Checkout is modal-local and depends on payment-provider state. |

## 11. Navigation boundaries

| Source block | Destination | Context passed |
|---|---|---|
| Profile watchlist token row | `/tokens/:address` | Token address |
| Profile watchlist wallet row | `/wallets/:address` | Wallet address |
| Pricing purchase CTA | Payment modal | Selected tier |
| Auth reminder modal | Login flow | No preserved checkout destination confirmed |
| Payment success return | `/pricing` with cleaned URL | Tier name and return-state query handling |
| Subscription management actions | Same page | Current subscription and billing state |
| Logout / account actions | Auth/session flow | Auth state only |

No active navigation to forgot-password or reset-password routes was confirmed. No dedicated checkout route was confirmed either.

## 12. Active, inactive, and incomplete implementations

| Candidate | Classification | Why |
|---|---|---|
| Profile route | `ACTIVE` | `/profile` is registered and protected by `AuthGuard`. |
| Pricing route | `ACTIVE` | `/pricing` is registered and directly reachable. |
| Payment return handling | `ACTIVE_WITH_LIMITATIONS` | Success-state return is handled through pricing-page query cleanup rather than a dedicated route. |
| Profile settings | `ACTIVE_WITH_LIMITATIONS` | Account identity and password actions are active, but recovery routes are absent. |
| Profile watchlists | `ACTIVE_WITH_LIMITATIONS` | Watchlists are active and shared, but updates are optimistic and context-driven. |
| Subscription management | `ACTIVE_WITH_LIMITATIONS` | Upgrade and cancel flows are active but limited to supported billing states. |
| Checkout modal flow | `ACTIVE_WITH_LIMITATIONS` | Checkout is active but modal-local and dependent on payment-provider interactions. |
| Forgot/reset password routes | `NOT_IMPLEMENTED` | No active route-bound recovery flow was confirmed. |
| Legacy or duplicate billing page | `ROUTE_INACTIVE` | No separate legacy billing page tree was confirmed in the active router. |

## 13. Major architectural limitations

- Profile data is split across multiple hooks and sub-tabs, so the account hub is functional but not singularly centralized.
- Watchlist state is shared through context and updated optimistically, which is good for responsiveness but requires backend verification for failure handling.
- Pricing is partly static presentation and partly modal payment orchestration, which keeps entry friction low but makes the flow harder to reason about as a route.
- Subscription management is real, but it is concentrated in the profile tab and only clearly supports Stripe-managed subscriptions.
- Password recovery is not confirmed as an active frontend route boundary, so account security flows are incomplete from the route perspective.
- Payment success is handled by a query-return contract on `/pricing`, not by a dedicated success or cancel route.

## 14. Backend verification requirements

Later backend or integration verification should focus on:

1. Whether `/profile` should expose a route-driven tab state or continue using local tab state only.
2. Whether watchlist rollback and optimistic updates need stronger conflict or retry handling.
3. Whether billing management should support non-Stripe subscriptions or additional plan states.
4. Whether checkout should remain modal-based or become a dedicated route.
5. Whether payment return handling should move from query cleanup to explicit return routes.
6. Whether forgot-password and reset-password routes are intended to exist in the current frontend.

## 15. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02C_WALLET_FRONTEND_ARCHITECTURE.md`
- `docs/architecture/audit/02D_ALERTS_FRONTEND_ARCHITECTURE.md`
- `docs/architecture/audit/02E_WASH_TRADING_FRONTEND_ARCHITECTURE.md`
- `docs/architecture/audit/02F_POOL_HISTORICAL_FRONTEND_ARCHITECTURE.md`
- `client/src/App.tsx`
- `client/src/pages/profile/index.tsx`
- `client/src/pages/pricing/index.tsx`
- `client/src/components/profile/ProfileSubscriptionsTab.tsx`
- `client/src/components/profile/watchlist/ProfileWatchlistTab.tsx`
- `client/src/components/profile/settings/index.tsx`
- `client/src/components/payment/PaymentModalWrapper.tsx`
- `client/src/components/payment/CheckoutForm.tsx`
- `client/src/components/payment/PaymentSuccessModal.tsx`
- `client/src/components/payment/AuthReminderModal.tsx`
- `client/src/hooks/profile/useProfilePageData.ts`
- `client/src/hooks/profile/useProfileSharedData.ts`
- `client/src/services/profile/profileApi.ts`
- `client/src/services/profile/subscriptionApi.ts`
- `client/src/contexts/WatchlistContext.tsx`
