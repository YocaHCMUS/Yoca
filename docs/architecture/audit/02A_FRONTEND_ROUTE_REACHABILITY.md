# Yoca Frontend Route Reachability Audit

## 1. Scope and classification rules

This audit covers only the active frontend router and route reachability in the current repository state. It answers:

- Which frontend routes are registered
- Which registered routes are reachable from active UI navigation
- Which registered routes are reached only through programmatic navigation or direct URLs
- Which registered routes are broken or incomplete
- Which page-like components exist without active router registration

This phase does not audit backend behavior, full end-to-end data delivery, or production deployment behavior.

Reachability statuses used in this document:

- `UI_REACHABLE`: reached through a visible current UI element such as header nav, footer link, button, card, row, tab, or visible account control
- `PROGRAMMATICALLY_REACHABLE`: reached through active app logic without a visible user interaction that directly targets the route, such as an authentication guard redirect or automatic post-operation redirect
- `DIRECT_URL_ONLY`: registered and implemented enough to render, but no active caller was found
- `REGISTERED_BUT_BROKEN_OR_INCOMPLETE`: route is registered but immediately fails, renders placeholder-only output, or cannot complete its intended interaction
- `NOT_REGISTERED`: page-like component exists but is not in the active router
- `LEGACY_OR_UNUSED`: commented, superseded, duplicated, or otherwise disconnected code
- `CATCH_ALL_ERROR_HANDLER`: unmatched-route handling; documented in router structure but excluded from concrete product-route counts
- `EMBEDDED_COMPONENT`: page-like or demo-like component intentionally rendered inside another page, with no independent route expected from current usage
- `UNCERTAIN`: evidence is insufficient

Counting note: the active router contains 1 layout-only route, 21 concrete registered addressable routes, and 1 catch-all error-handler route.

## 2. Active router structure

The application renders `App` from `client/src/main.tsx`, and `App` renders a `RouterProvider` backed by `createBrowserRouter(...)` in `client/src/App.tsx`. The only confirmed active layout route is `RootLayout`, which shows a Carbon loading overlay during navigation and renders an `Outlet`.

No lazy-loaded routes were confirmed.

| Route pattern | Route component | Parent layout | Dynamic parameters | Registered | Initial notes |
|---|---|---|---|---|---|
| `/` (layout route) | `RootLayout` | None | None | Yes | Top-level layout route; renders loading overlay and `Outlet`. |
| `/` | `Index` | `RootLayout` | None | Yes | Landing page index route. |
| `/pricing` | `PricingPage` | `RootLayout` | None | Yes | Public pricing page. |
| `/unauthorized` | `UnauthorizedPage` | `RootLayout` | None | Yes | Redirect target for `AuthGuard`. |
| `/market` | `MarketPage` | `RootLayout` | None | Yes | Main app market page. |
| `/alerts` | `AuthGuard(AlertsPage)` | `RootLayout` | None | Yes | Protected page. |
| `/alerts-token-demo` | `AuthGuard(AlertsDemo)` | `RootLayout` | None | Yes | Protected demo route. |
| `/profile` | `AuthGuard(ProfilePage)` | `RootLayout` | None | Yes | Protected profile route. |
| `/tokens` | `TokenPage` | `RootLayout` | None | Yes | Registered, but component expects both `address` and `poolAddress`. |
| `/tokens/:address` | `TokenOverviewPage` | `RootLayout` | `address` | Yes | Token overview route. |
| `/tokens/:address/:poolAddress` | `TokenPage` | `RootLayout` | `address`, `poolAddress` | Yes | Token pool detail route. |
| `/wash-trading` | `WashTradingPage` | `RootLayout` | None | Yes | Base wash-trading page with manual mint input. |
| `/wash-trading/:mint` | `WashTradingPage` | `RootLayout` | `mint` | Yes | Parametric wash-trading page. |
| `/historical-data/:address` | `HistoricalDataPage` | `RootLayout` | `address` | Yes | Token history page. |
| `/transactions` | `TransactionGraphPage` | `RootLayout` | None | Yes | Registered, but component expects `txHash`. |
| `/transactions/:txHash` | `TransactionGraphPage` | `RootLayout` | `txHash` | Yes | Transaction graph detail route. |
| `/comparison/wallets` | `WalletsComparisonPage` | `RootLayout` | Query param `wallets` | Yes | Comparison page fed by query string rather than path params. |
| `/wallets/:address` | `WalletPage` | `RootLayout` | `address` | Yes | Wallet detail route. |
| `/secret-admin-dashboard` | `UnauthorizedPage` | `RootLayout` | None | Yes | Registered path currently renders the unauthorized screen. |
| `/not-found` | `NotFoundPage` | `RootLayout` | None | Yes | Explicit not-found path. |
| `/balance` | `BalanceChartV2` | `RootLayout` | None | Yes | Standalone debug/demo chart route with hardcoded address prop. |
| `/wallet-act` | `WalletTransactionActivity` | `RootLayout` | None | Yes | Standalone debug/demo activity route with hardcoded address prop. |
| `*` | `NotFoundPage` | `RootLayout` | Unmatched URL | Yes | Catch-all error route; excluded from concrete addressable route counts. |

## 3. Global navigation map

| UI source | Visible label or icon purpose | Source component | Navigation mechanism | Destination route | Required state |
|---|---|---|---|---|---|
| Landing brand logo | Home | `client/src/components/landing/Navbar.tsx` `BrandLink` | `Link` | `/` | No special state |
| Landing desktop/mobile nav | Docs | `LandingNavbar` | `Link` | `/market` | No special state |
| Landing desktop/mobile nav | Pricing | `LandingNavbar` | `Link` | `/pricing` | No special state |
| Landing authenticated account menu | Profile | `LandingNavbar` | `Link` | `/profile` | Authenticated user |
| Landing guest auth buttons | Login or sign up modal | `LandingNavbar` | State toggle opening `SignInModal` or `SignUpModal` | No route change | Guest |
| Landing hero primary CTA | Main market CTA | `client/src/components/landing/Hero.tsx` | `Link` | `/market` | No special state |
| Landing hero secondary CTA | Secondary CTA | `LandingHero` | `Link` | `/auth` | No special state; no registered `/auth` route |
| Landing footer | Market and docs-like links | `client/src/components/landing/Footer.tsx` | `Link` | `/market` | No special state |
| Landing footer | Token explorer/chains | `LandingFooter` | `Link` | `/tokens` | No special state; destination is broken |
| Landing footer | Company/legal placeholders | `LandingFooter` | `Link` | `/` | No special state |
| Landing footer | Support/contact/contact sales | `LandingFooter` | `Link` | `/auth` | No special state; no registered `/auth` route |
| Landing final CTA | Final sign-up CTA | `client/src/components/landing/FinalCTA.tsx` | `Link` | `/auth` | No special state; no registered `/auth` route |
| App-shell brand | Main app home brand | `client/src/components/wrapper/PageWrapper.tsx` `HeaderName` | `href` | `/market` | No special state |
| App-shell header nav | Market | `PageWrapper` `NavHeaderItems` | `href` | `/market` | No special state |
| App-shell header nav | Alerts | `PageWrapper` `NavHeaderItems` | `href` | `/alerts` | Route itself requires auth |
| App-shell side nav | Market and Alerts | `PageWrapper` side nav reuse of `NavHeaderItems` | `href` | `/market`, `/alerts` | No special state; `/alerts` guard applies |
| App-shell account button when guest | Sign-in modal | `PageWrapper` account `HeaderGlobalAction` | `openAuthModal("login")` | No route change | Guest |
| App-shell account menu when authenticated | Profile | `PageWrapper` account menu | `navigate(...)` | `/profile` | Authenticated user |
| App-shell search icon | Open search overlay | `PageWrapper` | State toggle | No route change | No special state |
| Search overlay token result | Open token overview | `client/src/components/search/SearchBar.tsx` | `navigate(...)` | `/tokens/:address` | Search result selected |
| Search overlay pool result | Open token pool page | `SearchBar` | `navigate(...)` | `/tokens/:address/:poolAddress` | Search result selected |
| Search overlay wallet result | Open wallet detail | `SearchBar` | `navigate(...)` | `/wallets/:address` | Search result selected |
| App-shell auth popup flow | Sign-in modal with redirect target | `PageWrapper` `authPopup` support | `SignInModal` with `redirectUrl` | Redirects to supplied route after auth | Modal open |

Confirmed global navigation components are `LandingNavbar`, `LandingFooter`, `LandingHero`, `LandingFinalCTA`, `PageWrapper`, and `SearchBar`.

## 4. Page-level navigation

| Source route | Interaction | Source file/component | Destination route | Evidence |
|---|---|---|---|---|
| `/market` | Market ticker token chip | `client/src/components/MarketTicker/index.tsx` | `/tokens/:address` | Each ticker item is a `Link` to `/tokens/${item.address}`. |
| `/market` | Pool row selection | `client/src/components/market/DexTable.tsx` | `/tokens/:address/:poolAddress` | Pool table navigation uses token address plus pool address. |
| `/tokens/:address` | Historical Data tab-link | `client/src/components/token/TokenTabs.tsx` | `/historical-data/:address` | External-style tab link opens token history route in new tab. |
| `/tokens/:address` | Market row/pool selection | `client/src/components/token/TokenMarketsTable.tsx` | `/tokens/:address/:poolAddress` | Pool row links to pool detail route. |
| `/tokens/:address` | AI wash trading action | `client/src/components/token/TokenHeader.tsx` | `/wash-trading/:mint` | Button computes `washTradingUrl` and navigates after plan check. |
| `/tokens/:address` | Recent transaction signer click | `client/src/components/token/RecentTransactions.tsx` | `/wallets/:address` | Signer links point to wallet detail routes. |
| `/tokens/:address` | Top holder selection | `client/src/components/token/TopHolders.tsx`, `TopHoldersTable.tsx` | `/wallets/:address` | Holder rows navigate or link to wallet detail routes. |
| `/tokens/:address/:poolAddress` | Pool selector change | `client/src/pages/token/index.tsx` | `/tokens/:address/:poolAddress` | `onPoolChange` imperatively navigates to a different pool route. |
| `/tokens/:address/:poolAddress` | Token logo/header link | `client/src/components/token/TokenHeader.tsx` | `/tokens/:address` | Header image links back to token overview. |
| `/wallets/:address` | Holdings row selection | `client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx` | `/tokens/:address` | Token rows navigate to token overview. |
| `/wallets/:address` | Wallet topbar compare action | `client/src/components/wallet/WalletTopbar/WalletTopbar.tsx` | `/comparison/wallets` | Compare action uses `window.location.assign(...)` with query string. |
| `/wallets/:address` | Wallet overview compare action | `client/src/components/wallet/WalletOverview/WalletOverview.tsx` | `/comparison/wallets` | Compare action uses `window.location.assign(...)`. |
| `/wallets/:address` | Related wallet actions | `WalletTopbar`, `WalletOverview`, `client/src/pages/wallet/RightSidebar.tsx` | `/wallets/:address` | Related addresses navigate to other wallet detail routes. |
| `/wallets/:address` | Token shortcuts | `RightSidebar` | `/tokens/:address` | Token chips navigate to token overview routes. |
| `/comparison/wallets` | Open selected wallet page | `client/src/pages/walletsComparison/index.tsx` | `/wallets/:address` | Launch button navigates to the chosen wallet route. |
| `/wash-trading/:mint` or `/wash-trading` | Breadcrumb token link | `client/src/pages/wash-trading/index.tsx` | `/tokens` and `/tokens/:address` | Breadcrumb links to token area and selected token. |
| `/wash-trading/:mint` or `/wash-trading` | Mint selection inside page | `client/src/pages/wash-trading/index.tsx` | `/wash-trading/:mint` | Selected mint updates the URL via `navigate(...)`. |
| `/profile` | Watchlist token and wallet entries | `client/src/components/profile/watchlist/ProfileWatchlistTab.tsx` | `/tokens/:address`, `/wallets/:address` | Both `href` and `navigate(...)` flows are present. |
| `/profile` | Portfolio wallet drilldown | `client/src/components/profile/portfolio/ProfilePortfolioTab.tsx` | `/wallets/:address` | Builds next wallet route from selected wallet address. |
| `/profile` | Subscription upgrade action | `client/src/components/profile/ProfileSubscriptionsTab.tsx` | `/pricing` | Uses `window.location.href = "/pricing"`. |
| `/profile` | Settings exit action | `client/src/components/profile/settings/index.tsx` | `/` | Settings tab uses `navigate("/")`. |
| `/transactions/:txHash` | Wallet node click | `client/src/pages/transactions/nodes/WalletNode.tsx` | `/wallets/:address` | Wallet nodes navigate to wallet routes. |
| `/transactions/:txHash` | Transfer list address links | `client/src/pages/transactions/components/TransactionActionsList.tsx` | `/wallets/:address` | Source and destination addresses are anchor links. |
| `/not-found` | Go to market | `client/src/pages/not-found/index.tsx` | `/market` | Primary button uses `navigate("/market")`. |
| `/not-found` | Back to home | `client/src/pages/not-found/index.tsx` | `/` | Secondary button uses `navigate("/")`. |
| `/unauthorized` | Return home | `client/src/pages/unauthorized/index.tsx` | `/` | Page exposes home/back action via navigation. |

## 5. Authentication and access behavior

Route protection is not global. The only confirmed route-level guard is `AuthGuard`, applied to `/alerts`, `/alerts-token-demo`, and `/profile`.

`AuthGuard` behavior:

- While user state is loading, it renders a Carbon `Loading` overlay
- If no user is present, it redirects to `/unauthorized`
- It preserves the attempted path in router state as `from`

Many other pages are publicly reachable but gate specific actions by authentication or plan checks. Examples include account buttons opening auth modals, pricing purchase flows opening auth reminders, and wash-trading AI actions checking subscription tier before navigation.

| Route | Guest behavior | Authenticated behavior | Guard or check location | Classification |
|---|---|---|---|---|
| `/alerts` | Redirected to `/unauthorized` | Full page renders | `client/src/components/auth/AuthGuard.tsx` via `client/src/App.tsx` | Authenticated-only page |
| `/alerts-token-demo` | Redirected to `/unauthorized` | Demo page renders | `AuthGuard` via `App.tsx` | Authenticated-only page |
| `/profile` | Redirected to `/unauthorized` | Full profile route renders | `AuthGuard` via `App.tsx` | Authenticated-only page |
| `/unauthorized` | Public error-style screen | Same screen | No guard on route itself | Redirect target |
| `/market` | Public page renders; guest account action opens sign-in modal | Public page plus authenticated account/profile actions | `PageWrapper` account action logic | Public route with auth-gated controls |
| `/tokens/:address` | Public page renders; wash-trading CTA can open auth gate | Public page renders; wash-trading CTA may navigate if plan allows | `TokenHeader` action logic | Public route with auth and plan gated action |
| `/tokens/:address/:poolAddress` | Public page renders | Public page renders | No route guard found | Public route |
| `/pricing` | Public page renders; buy flow opens auth reminder instead of direct checkout | Public page renders; payment modal opens | `client/src/pages/pricing/index.tsx` | Public route with auth-gated purchase flow |
| `/wash-trading/:mint` | Public page renders; AI analyze button behavior depends on page logic and plan state | Public page renders; Plus/Pro gating applies to AI analysis | `client/src/pages/wash-trading/index.tsx` | Public route with plan-gated action |
| `/wallets/:address` | Public page renders | Public page renders; extra account/watchlist behaviors become available | No route guard found | Public route |

Additional auth observations:

- `client/src/contexts/AuthContext.tsx` loads the current session with `client.api.users.auth.me.$get()`
- `PageWrapper` and `LandingNavbar` both open modal auth flows instead of routing to a dedicated `/auth` page
- `client/src/components/auth/SignInModal.tsx` and `SignUpModal` redirect to `redirectUrl` if supplied, otherwise back to the current `location.pathname`

## 6. Search and dynamic-route flows

| Dynamic route | Parameter | Active source of parameter | Navigation source | Invalid-input behavior | Reachability |
|---|---|---|---|---|---|
| `/tokens/:address` | `address` | Search token result, market ticker item, watchlist row, wallet holdings row, token header link | `SearchBar`, `MarketTicker`, profile/watchlist, wallet components, `Link` or `navigate(...)` | No route-level param validation found; invalid direct URL falls to downstream loading or data-unavailable behavior | `UI_REACHABLE` |
| `/tokens/:address/:poolAddress` | `address`, `poolAddress` | Search pool result, market pool row, token markets row, pool selector | `SearchBar`, `DexTable`, `TokenMarketsTable`, `TokenPage` `onPoolChange` | Invalid direct URL can reach `Data Unavailable` or loading states; no explicit route guard found | `UI_REACHABLE` |
| `/wallets/:address` | `address` | Search wallet result, typed wallet address promoted to synthetic result, wallet-related table rows and nodes | `SearchBar`, wallet components, profile tabs, transaction graph, market tables | Search UI only synthesizes wallet results for address-like input; invalid direct URL behavior was not runtime-verified in this phase | `UI_REACHABLE` |
| `/wash-trading/:mint` | `mint` | Token header AI wash-trading CTA, wash-trading page mint selection | `TokenHeader`, `WashTradingPage` `navigate(...)` | Base route `/wash-trading` exists for manual entry; no dedicated router validation for malformed `mint` was confirmed | `UI_REACHABLE` |
| `/historical-data/:address` | `address` | Token overview historical-data tab-link | `TokenTabs` `Link` | Missing param cannot occur from the active UI; invalid direct URL would defer to API-driven error state | `UI_REACHABLE` |
| `/transactions/:txHash` | `txHash` | No active caller found | None found | Invalid or missing transaction hash produces inline error or missing-hash output in the component | `DIRECT_URL_ONLY` |

Search-specific findings:

- `SearchBar` can navigate to token overview, token pool detail, and wallet detail routes
- Wallet search extracts address-like input with a regex and can inject a synthetic wallet result when the typed address matches the expected format but no API result is returned
- No active search flow to market, alerts, profile, or pricing routes was confirmed

## 7. Redirect-based route flows

| Trigger | Source file | Condition | Destination | User-visible flow |
|---|---|---|---|---|
| `AuthGuard` redirect | `client/src/components/auth/AuthGuard.tsx` | Guest opens `/alerts`, `/alerts-token-demo`, or `/profile` | `/unauthorized` | Protected page attempt redirects to unauthorized page |
| Login success | `client/src/components/auth/SignInModal.tsx` | Password login succeeds | `redirectUrl` or current path | User returns to attempted/current page after sign-in |
| Signup success | `client/src/components/auth/SignInModal.tsx` | Registration succeeds | `redirectUrl` or current path | User returns to attempted/current page after sign-up |
| Google auth success | `SignInModal.tsx` | Google auth succeeds | `redirectUrl` or current path | Same modal redirect behavior |
| Wallet auth success | `SignInModal.tsx` | Wallet auth succeeds | `redirectUrl` or current path | Same modal redirect behavior |
| Pricing success modal close | `client/src/components/payment/PaymentSuccessModal.tsx` | User closes payment success modal | `/profile` | Post-payment profile redirect |
| Wallet compare action | `client/src/components/wallet/WalletTopbar/WalletTopbar.tsx`, `WalletOverview.tsx` | User triggers compare action | `/comparison/wallets?wallets=...` | Imperative navigation from wallet pages |
| Search result selection | `client/src/components/search/SearchBar.tsx` | User selects token, pool, or wallet result | `/tokens/:address`, `/tokens/:address/:poolAddress`, `/wallets/:address` | Dynamic route transition from search overlay |
| Wash-trading token selection | `client/src/pages/wash-trading/index.tsx` | User chooses a mint inside wash-trading page | `/wash-trading/:mint?...` | In-page URL update |
| Broken landing `/auth` links | `client/src/components/landing/Hero.tsx`, `Footer.tsx`, `FinalCTA.tsx` | User clicks CTA/support/contact sales links | No registered `/auth` route; falls into catch-all error handling | Broken navigation defect, not valid product-route reachability |

## 8. Registered route reachability matrix

This matrix covers every concrete registered addressable child route in the active router. The top-level `RootLayout` wrapper route is excluded because it is layout-only. The `*` route is also excluded from this matrix and from product-route counts because it is unmatched-route handling, not an addressable product route.

| Route | Page purpose | Main entry point | Guest access | Authenticated access | Reachability status | Evidence |
|---|---|---|---|---|---|---|
| `/` | Landing page | Landing brand links, not-found back button | Public | Public | `UI_REACHABLE` | `LandingNavbar` and `LandingFooter` brand links route to `/`. |
| `/pricing` | Pricing and upgrade page | Landing navbar pricing link; upgrade links from token/profile/wash pages | Public; purchase flow opens auth reminder | Public; checkout modal can open | `UI_REACHABLE` | Active visible links/buttons point to `/pricing`. |
| `/unauthorized` | Unauthorized access screen | `AuthGuard` redirect | Reachable by redirect | Reachable by redirect or direct URL | `PROGRAMMATICALLY_REACHABLE` | Only confirmed automatic caller is `AuthGuard`. |
| `/market` | Market page | Landing navbar docs link, landing CTA, app-shell brand/nav | Public | Public | `UI_REACHABLE` | Multiple visible nav entries link to `/market`. |
| `/alerts` | Alerts page | App-shell header and side-nav Alerts item | Redirected to `/unauthorized` | Page renders | `UI_REACHABLE` | Persistent app-shell nav entry exists, but route is guarded. |
| `/alerts-token-demo` | Alerts demo page | No active caller found | Redirected to `/unauthorized` if guest direct-opens | Page renders if directly opened while authenticated | `DIRECT_URL_ONLY` | Registered in router, but no visible link or programmatic caller was found. |
| `/profile` | Profile/account page | App-shell account menu; landing authenticated account menu | Redirected to `/unauthorized` | Page renders | `UI_REACHABLE` | Visible account navigation exists in both shells. |
| `/tokens` | Intended token landing/explorer path | Landing footer token-explorer/chains links | Public but route immediately falls to placeholder output | Same | `REGISTERED_BUT_BROKEN_OR_INCOMPLETE` | `TokenPage` returns `Forgot to add address!` when `address` or `poolAddress` is missing. |
| `/tokens/:address` | Token overview page | Search selection, market ticker items, watchlist rows, wallet/token links | Public | Public; wash-trading action may gate | `UI_REACHABLE` | Visible search results, ticker items, watchlist rows, wallet holdings, and token links route here. |
| `/tokens/:address/:poolAddress` | Token pool detail page | Search pool selection, market rows, token markets rows, pool selector | Public | Public | `UI_REACHABLE` | Visible search pool results, market rows, token markets rows, and pool selector interactions route here. |
| `/wash-trading` | Wash-trading base page with manual mint entry | No active caller found | Public if directly opened | Public if directly opened | `DIRECT_URL_ONLY` | Route appears implemented, but no active link or caller to the base path was found. |
| `/wash-trading/:mint` | Wash-trading token analysis page | Token header AI wash-trading CTA; in-page mint selection | Public page render; analysis actions may gate | Public render with plan-gated AI actions | `UI_REACHABLE` | Visible token header action and in-page mint selection route here. |
| `/historical-data/:address` | Token historical data page | Token overview historical-data tab-link | Public | Public | `UI_REACHABLE` | Visible `TokenTabs` link points to the route. |
| `/transactions` | Transaction graph base route | No active caller found | Public but missing-param output | Same | `REGISTERED_BUT_BROKEN_OR_INCOMPLETE` | `TransactionGraphPage` returns `Missing transaction hash in URL.` when no `txHash` param exists. |
| `/transactions/:txHash` | Transaction graph detail page | No active caller found | Public by direct URL | Public by direct URL | `DIRECT_URL_ONLY` | Registered route exists, but no internal caller was found. |
| `/comparison/wallets` | Wallet comparison page | Wallet compare actions from wallet pages | Public if directly opened or called | Public if directly opened or called | `UI_REACHABLE` | Visible wallet comparison buttons route here. |
| `/wallets/:address` | Wallet detail page | Search wallet result, market tables, token holders, transaction nodes, comparison launch | Public | Public | `UI_REACHABLE` | Visible search results, market table rows, top-holder rows, transaction graph links, and profile/watchlist rows route here. |
| `/secret-admin-dashboard` | Admin-looking placeholder path | No active caller found | Public unauthorized screen on direct URL | Same | `DIRECT_URL_ONLY` | Route is registered but currently maps to `UnauthorizedPage` and has no caller. |
| `/not-found` | Explicit not-found page | No active caller found | Public by direct URL | Public by direct URL | `DIRECT_URL_ONLY` | Explicit `/not-found` path has no confirmed caller even though the same component is used by `*`. |
| `/balance` | Standalone chart/debug route | No active caller found | Public by direct URL | Public by direct URL | `DIRECT_URL_ONLY` | Router mounts `BalanceChartV2` directly with hardcoded address; no navigation source found. |
| `/wallet-act` | Standalone wallet-activity/debug route | No active caller found | Public by direct URL | Public by direct URL | `DIRECT_URL_ONLY` | Router mounts `WalletTransactionActivity` directly with hardcoded address; no navigation source found. |

The registered `*` route remains documented in the router structure as `CATCH_ALL_ERROR_HANDLER`. Broken visible links to `/auth` fall into this handling because `/auth` has no registered route; those links are a navigation defect, not valid reachability for a product route.

Reachability count summary for concrete registered addressable routes:

- `UI_REACHABLE`: 11
- `PROGRAMMATICALLY_REACHABLE`: 1
- `DIRECT_URL_ONLY`: 7
- `REGISTERED_BUT_BROKEN_OR_INCOMPLETE`: 2
- `UNCERTAIN`: 0

### Route count validation

| Category | Count |
|---|---:|
| Layout-only routes | 1 |
| Concrete addressable routes | 21 |
| Catch-all handlers | 1 |
| UI_REACHABLE | 11 |
| PROGRAMMATICALLY_REACHABLE | 1 |
| DIRECT_URL_ONLY | 7 |
| REGISTERED_BUT_BROKEN_OR_INCOMPLETE | 2 |
| UNCERTAIN | 0 |

Validation: `11 + 1 + 7 + 2 + 0 = 21`, which equals the concrete registered addressable route count.

## 9. Unregistered page components

| Page/component | File | Registered route found | Active caller found | Classification | Evidence |
|---|---|---|---|---|---|
| `TokenDetailsDemo` | `client/src/pages/wallet/TokenDetailsDemo.tsx` | No | Yes, embedded in wallet page | `EMBEDDED_COMPONENT` | The component is imported and rendered inside `client/src/pages/wallet/index.tsx`; current evidence supports embedded usage rather than an intended standalone route. |

No independent page-like components were confirmed as `NOT_REGISTERED` during this phase.

## 10. Legacy or superseded frontend pages

| Candidate | Current replacement, if any | Why considered legacy/disconnected | Evidence | Confidence |
|---|---|---|---|---|
| Commented old `/alerts` route entry in `App.tsx` | Current guarded `/alerts` route | Unprotected router entry is commented out and replaced by guarded version | `client/src/App.tsx` contains commented route block above active `AuthGuard` route | `CONFIRMED` |
| `/auth` landing CTA destinations | Modal-based auth flows in `LandingNavbar`, `PageWrapper`, and `SignInModal` | Multiple active links still point to `/auth`, but no `/auth` route exists; actual auth UX is modal-driven, so these links fall into catch-all not-found handling | `Hero.tsx`, `Footer.tsx`, `FinalCTA.tsx`, plus modal auth components | `CONFIRMED` |
| `/secret-admin-dashboard` path | None confirmed | Admin-looking path currently just renders `UnauthorizedPage` and has no caller | `client/src/App.tsx` route entry and no matching route callers found in `client/src` search | `LIKELY` |
| Debug/demo standalone routes `/balance` and `/wallet-act` | None confirmed | Router mounts individual component demos with hardcoded addresses and no navigation callers | `client/src/App.tsx` plus repository route-string search | `LIKELY` |

## 11. Provisional user-facing areas

These groupings are based only on verified `UI_REACHABLE` routes and the meaningful programmatic `/unauthorized` guard flow. They do not prove backend completeness. They exclude catch-all handling, broken `/auth` destinations, direct-url-only debug routes, and broken routes.

| User-facing area | Included routes | UI entry point | Confidence |
|---|---|---|---|
| Landing and pricing | `/`, `/pricing` | `LandingNavbar`, `LandingHero`, `LandingFooter`, `LandingFinalCTA` | `CONFIRMED` |
| Market and token discovery | `/market`, `/tokens/:address`, `/tokens/:address/:poolAddress`, `/historical-data/:address` | App-shell nav, landing CTA, market ticker, search, token tables/tabs | `CONFIRMED` |
| Wallet exploration and comparison | `/wallets/:address`, `/comparison/wallets` | Search, market/token wallet links, wallet compare actions | `CONFIRMED` |
| Authenticated account surfaces | `/alerts`, `/profile`, `/unauthorized` | App-shell alerts nav, account menus, `AuthGuard` redirects | `CONFIRMED` |
| Wash-trading analysis surface | `/wash-trading/:mint` | Token header AI wash-trading action | `CONFIRMED` |

## 12. Open questions for Phase 2B

| Question | Why unresolved in Phase 2A | Recommended next phase |
|---|---|---|
| Should `/tokens` be a real token explorer page instead of a broken `TokenPage` mount? | Route is actively linked from landing footer, but current component requires missing params | Frontend route repair or feature audit |
| Is there any intended in-app caller for `/transactions/:txHash`? | Registered detail route exists, but no internal caller was found | Transaction-flow audit |
| Are `/balance` and `/wallet-act` intentionally developer/demo routes or forgotten product pages? | Both render standalone components with hardcoded addresses and have no callers | Frontend cleanup audit |
| Is `/secret-admin-dashboard` a deliberate placeholder or vestigial path? | Route exists but only renders `UnauthorizedPage` | Access-control and admin-surface audit |
| Are the active `/auth` landing links accidental leftovers now that auth is modal-driven? | Multiple visible CTAs point to an unregistered route and currently fall into catch-all not-found handling | Landing/auth UX audit |
| How do wallet/token pages behave with malformed but syntactically valid params at runtime? | Phase 2A inspected source reachability, not full runtime data/error behavior | Dynamic-route runtime audit |

## 13. Files inspected

- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/pages/index.tsx`
- `client/src/pages/market/index.tsx`
- `client/src/pages/pricing/index.tsx`
- `client/src/pages/alerts/index.tsx`
- `client/src/pages/alerts/demo.tsx`
- `client/src/pages/profile/index.tsx`
- `client/src/pages/token/index.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/pages/historical-data/index.tsx`
- `client/src/pages/wallet/index.tsx`
- `client/src/pages/wallet/RightSidebar.tsx`
- `client/src/pages/wallet/TokenDetailsDemo.tsx`
- `client/src/pages/walletsComparison/index.tsx`
- `client/src/pages/wash-trading/index.tsx`
- `client/src/pages/transactions/index.tsx`
- `client/src/pages/transactions/components/TransactionActionsList.tsx`
- `client/src/pages/transactions/nodes/WalletNode.tsx`
- `client/src/pages/not-found/index.tsx`
- `client/src/pages/unauthorized/index.tsx`
- `client/src/components/auth/AuthGuard.tsx`
- `client/src/components/auth/SignInModal.tsx`
- `client/src/contexts/AuthContext.tsx`
- `client/src/components/wrapper/PageWrapper.tsx`
- `client/src/components/search/SearchBar.tsx`
- `client/src/components/landing/Navbar.tsx`
- `client/src/components/landing/Hero.tsx`
- `client/src/components/landing/Footer.tsx`
- `client/src/components/landing/FinalCTA.tsx`
- `client/src/components/landing/Products.tsx`
- `client/src/components/landing/CustomerStories.tsx`
- `client/src/components/landing/NewsSection.tsx`
- `client/src/components/MarketTicker/index.tsx`
- `client/src/components/token/TokenHeader.tsx`
- `client/src/components/token/TokenTabs.tsx`
- `client/src/components/token/TokenMarketsTable.tsx`
- `client/src/components/token/RecentTransactions.tsx`
- `client/src/components/token/TopHolders.tsx`
- `client/src/components/token/TopHoldersTable.tsx`
- `client/src/components/market/DexTable.tsx`
- `client/src/components/market/TraderTable.tsx`
- `client/src/components/wallet/WalletTopbar/WalletTopbar.tsx`
- `client/src/components/wallet/WalletOverview/WalletOverview.tsx`
- `client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx`
- `client/src/components/wallet/WalletChat/WalletChat.tsx`
- `client/src/components/profile/watchlist/ProfileWatchlistTab.tsx`
- `client/src/components/profile/portfolio/ProfilePortfolioTab.tsx`
- `client/src/components/profile/ProfileSubscriptionsTab.tsx`
- `client/src/components/profile/settings/index.tsx`
- `client/src/components/payment/PaymentSuccessModal.tsx`
- `client/src/components/payment/AuthReminderModal.tsx`
- `client/src/hooks/useTokenPageLogic.ts`
