# Yoca Token Actions Frontend Audit

## 1. Scope

This Phase 2B2B4C audit covers only the active frontend behavior originating from the Token Overview route `/tokens/:address`, specifically token follow/watchlist and token alert-entry behavior from `TokenOverviewPage` and `TokenHeader`.

In scope:

- Active `/tokens/:address` route registration and render chain
- `TokenOverviewPage` and `TokenHeader` action ownership
- Token follow/watchlist controls, if actively rendered from `/tokens/:address`
- Token alert-entry controls, if actively rendered from `/tokens/:address`
- Directly connected auth, watchlist, modal, navigation, and service boundaries needed to classify these actions at a high level

Out of scope:

- Alert form internals
- Alert creation, update, delete, or delivery logic
- Helius webhooks, backend services, databases, providers, deployment, and Mermaid architecture
- Other Token Overview features already audited in earlier phases
- Destination route internals after handoff to login, pricing, alert modals, or `/alerts`

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`, `02B2B3_TOKEN_AI_CHAT_FRONTEND.md`, `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`, and `02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`.

## 2. High-level architecture summary

The active `/tokens/:address` route is public and renders `TokenOverviewPage`, which mounts `TokenHeader` in the left rail. In the current source, that active header owns token identity, external links, and wash-trading entry, but no active token follow/watchlist control and no active token alert-entry control were confirmed from the Token Overview route.

A shared token watchlist system does exist in the frontend through `WatchlistProvider`, `WatchlistContext`, and profile watchlist API helpers. That system is active on other routes such as wallet holdings and profile watchlist, but there is no active render or handler chain from `TokenOverviewPage` or `TokenHeader` into `useWatchlist`.

Token alert-related UIs also exist elsewhere, primarily on guarded alert routes and the token-alert demo flow. Those alert modals and route-level builders are not connected to the current Token Overview page, and no token-address handoff from `/tokens/:address` into an alert modal or `/alerts` route was confirmed.

## 3. Active render chain

`client/src/App.tsx` registers `/tokens/:address` with `TokenOverviewPage`.

```text
/tokens/:address
`- RootLayout
   `- TokenOverviewPage
      `- PageWrapper
         `- tokenOverviewGrid
            |- leftColumn
            |  `- TokenHeader
            `- rightColumn
               |- TokenTabs
               |- TokenOverviewChart
               |- TokenInsightTabs
               |- TokenAIChat
               |- TokenMarketsTable
               |- GlobalPrices
               `- NewsTab
```

Within this active render chain, the only action-oriented control owned by `TokenHeader` is the previously audited wash-trading entry. No follow/watchlist button, no alert button, no alert launcher, no `useWatchlist` caller, and no alert route navigation were confirmed in the active `/tokens/:address` tree.

## 4. Token follow/watchlist flow

No active token follow/watchlist control is rendered by `TokenOverviewPage` or `TokenHeader`. `TokenOverviewPage` passes token identity props into `TokenHeader`, but the header imports auth and subscription access for wash-trading only and does not import `useWatchlist` or call `toggleToken`.[client/src/pages/token-overview/index.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/pages/token-overview/index.tsx:147) [client/src/components/token/TokenHeader.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/components/token/TokenHeader.tsx:47)

The shared watchlist layer is still important architectural context because it distinguishes token watchlist from wallet watchlist. `WatchlistContext` maintains separate `tokenWatchlist` and `walletWatchlist` state, hydrates both from profile endpoints when a user session exists, clears both when there is no authenticated user, and implements optimistic token add/remove with rollback on request failure.[client/src/contexts/WatchlistContext.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/contexts/WatchlistContext.tsx:48) [client/src/contexts/WatchlistContext.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/contexts/WatchlistContext.tsx:83)

At a high level, the current watchlist conclusions are:

- The watchlist type relevant to token follow is a token-address watchlist, not the wallet-address watchlist.
- Add/remove contracts exist through `profile.watchlist.tokens` and `profile.watchlist["tokens-update"]`.
- Optimistic update and rollback behavior exists in the shared context.
- Guest sessions are not allowed to persist a token watchlist because the shared provider clears watchlist state when `user` is absent.
- No active `/tokens/:address` control invokes this token watchlist flow, so there is no token-page-specific loading, error, or guest prompt behavior to audit.
- When the token route changes, the page rerenders with the new token identity, but no route-local follow state exists because no active follow control is mounted.

Related token watchlist implementations are active only on other routes. `WalletHoldingsPanel` renders a token watch button that disables for guests and calls `toggleToken(tokenAddress)`, and `ProfileWatchlistTab` renders token watchlist rows that also call `toggleToken(tokenAddress)`.[client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx:53) [client/src/components/profile/watchlist/ProfileWatchlistTab.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/components/profile/watchlist/ProfileWatchlistTab.tsx:36)

## 5. Token alert entry flow

No active token alert-entry control was confirmed on `/tokens/:address`. `TokenOverviewPage` renders `TokenHeader` and the other core overview blocks, but none of those active components launch a token alert modal, navigate to `/alerts`, navigate to `/alerts-token-demo`, or hand token context into an alert builder from the Token Overview route.[client/src/pages/token-overview/index.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/pages/token-overview/index.tsx:126)

The active alert-related implementations that do exist are route-inactive for this phase:

- `/alerts` is an authenticated alert center route behind `AuthGuard`.[client/src/App.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/App.tsx:82)
- `/alerts-token-demo` is another authenticated alert route that opens a trigger-type modal and then alert configuration modals, including `TokenStatsConfig`, but it is not launched from the active Token Overview page.[client/src/App.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/App.tsx:91) [client/src/pages/alerts/demo.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/pages/alerts/demo.tsx:308)

Because no Token Overview alert-entry control is active, the following were not confirmed from `/tokens/:address`:

- A token alert button or launcher
- A token-address, token-symbol, or token-name handoff into an alert flow
- A token-page guest prompt for alerts
- A token-page plan or subscription gate for alerts
- A token-page modal boundary into alert creation

## 6. Authentication and plan dependencies

The active Token Overview route itself is public. The token-action-specific auth and plan findings are:

- Token follow/watchlist on `/tokens/:address`: no active control, so no active token-page auth gate exists.
- Token alert entry on `/tokens/:address`: no active control, so no active token-page auth or plan gate exists.
- Shared watchlist infrastructure is session-aware because `WatchlistProvider` depends on `AuthProvider` and clears watchlist state when `user` is absent.[client/src/main.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/main.tsx:25) [client/src/contexts/WatchlistContext.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/contexts/WatchlistContext.tsx:56)
- The shared auth modal helper `openAuthModal("login")` has no redirect or destination payload. If token follow or token alert entry is later wired into `/tokens/:address`, intent preservation would need to be added explicitly rather than assumed.[client/src/contexts/AuthContext.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/contexts/AuthContext.tsx:77)
- The guarded alert routes `/alerts` and `/alerts-token-demo` require authentication through `AuthGuard`, but that route-level protection is not currently reached from the Token Overview page.[client/src/App.tsx](/D:/Useful%20software/Yoca/Yoca/client/src/App.tsx:82)

No active token follow or token alert subscription check was confirmed from `/tokens/:address`.

## 7. Frontend API boundaries

| Frontend block | API contract | Trigger | Purpose | Main limitation |
|---|---|---|---|---|
| Shared token watchlist hydration | `client.api.profile.watchlist.tokens.$get` via `getTokenWatchlist()` | Shared `WatchlistProvider` refetch when a user session exists | Hydrate the global token watchlist state | No active `/tokens/:address` caller consumes this state for a follow control. |
| Shared token follow | `client.api.profile.watchlist["tokens-update"].$post` via `addTokenToWatchlist(tokenAddress)` | Route-inactive token watchlist controls on other pages call `toggleToken()` | Add a token address to the shared token watchlist | No active follow button on `TokenOverviewPage` or `TokenHeader` invokes it. |
| Shared token unfollow | `client.api.profile.watchlist["tokens-update"].$delete` via `removeTokenFromWatchlist(tokenAddress)` | Route-inactive token watchlist controls on other pages call `toggleToken()` | Remove a token address from the shared token watchlist | No active unfollow button on `TokenOverviewPage` or `TokenHeader` invokes it. |
| Token alert entry access check | None confirmed from `/tokens/:address` | None confirmed | None confirmed | No alert-entry control or handoff exists on the active Token Overview route. |

## 8. Route and modal boundaries

| Source action | Destination | Token context passed | Access condition |
|---|---|---|---|
| No active token follow/watchlist action on `/tokens/:address` | None confirmed | None confirmed | Not applicable because the control is not rendered. |
| No active token alert-entry action on `/tokens/:address` | None confirmed | None confirmed | Not applicable because the control is not rendered. |
| Route-inactive `WalletHoldingsPanel` token star | Shared `WatchlistContext.toggleToken` then token watchlist API boundary | `tokenAddress` | Button disables for guests and pending state. |
| Route-inactive `ProfileWatchlistTab` token row star | Shared `WatchlistContext.toggleToken` then token watchlist API boundary | `tokenAddress` | `/profile` route is guarded by `AuthGuard`. |
| Route-inactive `AlertsDemo` create-alert launcher | Alert type selection modal, then alert configuration modal boundary | No token context from `/tokens/:address` is passed | `/alerts-token-demo` route is guarded by `AuthGuard`. |
| Route-inactive alerts route | `/alerts` | No token context from `/tokens/:address` is passed | Route is guarded by `AuthGuard`. |

## 9. Active, inactive, and missing capabilities

| Capability | Classification | High-level finding |
|---|---|---|
| Token action container | `ACTIVE_WITH_LIMITATIONS` | `TokenHeader` is actively rendered on `/tokens/:address`, but in this phase it only exposes wash-trading and external-link actions, not token follow or alert entry. |
| Token follow/watchlist | `ROUTE_INACTIVE` | Shared token watchlist infrastructure exists, but no follow/watchlist control is actively rendered from `TokenOverviewPage` or `TokenHeader`. |
| Follow/unfollow API flow | `ROUTE_INACTIVE` | Token watchlist GET/POST/DELETE contracts exist in shared services and context, but the active Token Overview route does not invoke them. |
| Authentication gate | `ROUTE_INACTIVE` | Shared auth state and login modal exist, but no active token follow or alert action on `/tokens/:address` reaches them. |
| Token alert entry | `ROUTE_INACTIVE` | Token alert flows exist on guarded alert routes and modals elsewhere, but no active entry point exists on the Token Overview page. |
| Alert route/modal handoff | `ROUTE_INACTIVE` | No token-page control currently opens an alert modal or navigates to an alert route with token context. |
| Plan/access gate | `ROUTE_INACTIVE` | No active token-page alert entry or follow control reaches a plan gate. |
| User feedback and error handling | `ROUTE_INACTIVE` | Because the route does not render follow or alert entry controls, there is no token-page-specific success, error, or retry surface for these actions. |

## 10. Major architectural limitations

- The active Token Overview header is already the natural owner for token actions, but token follow/watchlist is not wired there even though shared token watchlist infrastructure already exists elsewhere.
- Token alert creation exists elsewhere in the product, but there is no token-page handoff that passes `address`, `symbol`, or `name` into an alert flow from `/tokens/:address`.
- Shared auth modal helpers do not carry redirect context. If token follow or token alerts are later added to the page, login intent preservation will need explicit design.
- Shared watchlist hydration clears token and wallet watchlists on fetch failure or missing session, which is acceptable for a provider boundary but would be a weak user-feedback story if a token-page follow control were later added without additional error UI.
- The current token overview action surface is asymmetric: wash-trading is integrated and gated, while follow/watchlist and alert entry remain disconnected from the page.

## 11. Backend verification requirements

Later backend or integration verification should focus on:

1. Token watchlist GET, follow, and unfollow contracts for token-address identity and failure semantics.
2. Whether optimistic token watchlist updates should return richer error states or conflict handling.
3. Whether guest and authenticated watchlist behavior should preserve follow intent after login.
4. Whether token alert entry is intended to open a modal or navigate to `/alerts`, and which token context fields the destination should require.
5. Whether token alert entry should be auth-gated only or also plan-gated once wired into `/tokens/:address`.
6. Whether alert-route builders already support a token-prefill contract that the Token Overview page could hand off into later.

## 12. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `docs/architecture/audit/02B2B3_TOKEN_AI_CHAT_FRONTEND.md`
- `docs/architecture/audit/02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`
- `docs/architecture/audit/02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/TokenHeader.tsx`
- `client/src/contexts/AuthContext.tsx`
- `client/src/contexts/WatchlistContext.tsx`
- `client/src/services/profile/profileApi.ts`
- `client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx`
- `client/src/components/profile/watchlist/ProfileWatchlistTab.tsx`
- `client/src/pages/alerts/demo.tsx`
