# Yoca Token Wash-Trading Entry Frontend Audit

## 1. Scope

This Phase 2B2B4A audit covers only the active wash-trading entry flow originating from the Token Overview page `/tokens/:address`, specifically the `TokenHeader` wash-trading control and the direct frontend behavior it triggers.

In scope:

- Wash-trading action rendering and placement on `/tokens/:address`
- Token context passed into the action
- Guest-user behavior, authenticated-user behavior, and access-check behavior
- Plan or subscription eligibility checks performed by the frontend
- Login-modal behavior, pricing or upgrade behavior, and navigation to `/wash-trading/:mint`
- Loading, disabled, pending, error, and fallback states directly related to the entry flow
- Wash-trading-entry-specific code that exists but is not active in the current Token Overview flow

Out of scope:

- The internal `/wash-trading/:mint` page implementation
- Wash-trading scoring, calculations, AI analysis, charts, tables, wallets, and transactions after the destination page loads
- Backend wash-trading routes, backend services, databases, external providers, deployment, and Mermaid architecture
- Token AI Chat, Token News, Chart News markers, token markets, token holders, token statistics, token charts, alerts, watchlist persistence, shared authentication internals, pricing page internals, and payment processing

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2A_MARKET_FRONTEND.md`, `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`, `02B2B2A_TOKEN_NEWS_FRONTEND.md`, `02B2B2B_TOKEN_CHART_NEWS_MARKERS_FRONTEND.md`, and `02B2B3_TOKEN_AI_CHAT_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered from the active wash-trading entry flow, has a visible or lifecycle entry point, has connected frontend behavior, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected but has a confirmed limitation such as missing validation, missing request cancellation, missing stale-response protection, authentication dependency, plan dependency, missing loading feedback, missing destination preservation, local-only access assumptions, raw upgrade-path handling, or incomplete responsive behavior.
- `FRONTEND_BROKEN`: visible wash-trading entry capability exists but cannot complete its intended basic frontend role.
- `FRONTEND_UNUSED`: wash-trading entry-flow implementation exists but has no active render, call, or interaction chain from `/tokens/:address`.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `WASH-ENTRY-01` through `WASH-ENTRY-13`. Repeated evidence, CSS rows, frontend-flow descriptions, architecture blocks, and unused artifacts do not create additional capability counts.

## 3. Active render and call chain

`client/src/App.tsx` registers `/tokens/:address` with `TokenOverviewPage`. In `client/src/pages/token-overview/index.tsx`, `TokenHeader` is rendered once token details exist. The wash-trading button lives inside `TokenHeader`, and the Token Overview page passes `compact` without `sidebar`, so the button is visible in the compact Token Overview header rather than the sidebar-specific variant.

```text
/tokens/:address
`- TokenOverviewPage
   `- TokenHeader
      `- Wash-trading action
         |- Auth loading / click lockout
         |- Guest gate or subscription check
         |- Eligible route navigation
         `- Ineligible or failed-access gate
```

| Rendered or lifecycle block | File/component/function | Parent or caller | Activation condition | User purpose |
|---|---|---|---|---|
| Token header mount | `client/src/pages/token-overview/index.tsx` -> `TokenHeader` | `TokenOverviewPage` | `address && details` | Hosts the visible wash-trading entry point. |
| Wash-trading button | `TokenHeader` `aiWashButton` | `TokenHeader` root | Always rendered when the header renders | Opens the wash-trading access flow. |
| Auth loading lockout | `TokenHeader` button `disabled` state | `TokenHeader` root | `isUserLoading || isCheckingWashAccess` | Prevents duplicate or premature clicks. |
| Guest gate | `TokenHeader` wash gate overlay | `TokenHeader` root | No signed-in user clicks the action | Prompts login or upgrade. |
| Subscription check | `handleAiWashClick` -> `getUserSubscription` | `TokenHeader` event handler | Signed-in user clicks the action | Checks access before navigation. |
| Eligible route navigation | `navigate(washTradingUrl)` | `TokenHeader` event handler | Subscription is current and tier is Plus/Pro | Sends the user to the wash-trading route. |
| Ineligible fallback gate | `setIsWashGateOpen(true)` | `TokenHeader` event handler | User is signed in but not eligible | Shows upgrade/login style access gate. |
| Access-check failure fallback | `catch` branch in `handleAiWashClick` | `TokenHeader` event handler | Subscription request throws | Falls back to the same gate and logs the error. |

## 4. Token and access inputs

| Input | Source | Destination | Usage | Missing-input behavior | Status |
|---|---|---|---|---|---|
| Token address | `TokenOverviewPage` route param | `TokenHeader`, `washTradingUrl` | Becomes the path segment for `/wash-trading/:mint` | If missing, `TokenOverviewPage` does not render the header flow | `FRONTEND_ACTIVE` |
| Token symbol | `details.symbol` | `washTradingUrl` query string | Used as the `symbol` query fallback | Falls back to token name, then `TOKEN` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token name | `details.name` | `washTradingUrl` query string | Used only when symbol is absent | Falls back to `TOKEN` if both symbol and name are absent | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Signed-in user state | `useAuth()` | Click handler | Controls guest-vs-authenticated branching | Guests do not reach the subscription lookup | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| User-loading state | `useAuth()` | Button `disabled` prop | Prevents clicks while session is still resolving | Button is disabled with no inline explanation | `FRONTEND_ACTIVE` |
| Subscription state | `getUserSubscription()` result | Local eligibility logic and gate | Determines whether navigation or fallback gate occurs | Errors fall back to gate behavior | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Plan tier | `subscription.planTier` | `hasWashTradingTier(...)` | Checks whether the plan is Plus or Pro | Lite or missing tiers are treated as ineligible | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Current period end | `subscription.currentPeriodEnd` | Local eligibility logic | Must still be in the future for access to count as current | Missing or expired end date makes the user ineligible | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Gate open state | `isWashGateOpen` | Portal-rendered overlay | Controls visible login/upgrade gate | Closed by backdrop click, close button, or sign-in action | `FRONTEND_ACTIVE` |

## 5. Canonical wash-trading entry capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation |
|---|---|---|---|---|---|---|
| `WASH-ENTRY-01` | Wash-trading action rendering and placement | `TokenOverviewPage` renders the header | `TokenHeader` | Renders the visible AI wash-trading button in the Token Overview header | `FRONTEND_ACTIVE` | None beyond the page-level mount condition. |
| `WASH-ENTRY-02` | Compact header presentation behavior | Token Overview header render | `TokenHeader` `compact` styling | Keeps the action visible while changing size and layout | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Compact mode changes placement and label styling, but not the action itself. |
| `WASH-ENTRY-03` | Token context handoff and wash URL construction | Header render and click handler | `TokenHeader` | Builds `/wash-trading/${address}?symbol=...&timeframe=24h` | `FRONTEND_ACTIVE` | Query fallback uses symbol, then name, then `TOKEN`. |
| `WASH-ENTRY-04` | Loading and disabled pending state | Session loading or access check in flight | `TokenHeader` button state | Disables the button while user data or access check is pending | `FRONTEND_ACTIVE` | No spinner or disabled-state explanation is rendered. |
| `WASH-ENTRY-05` | Guest click and sign-in gate entry | Guest clicks the wash action | `TokenHeader` guest branch | Opens the local gate overlay instead of navigating | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No destination preservation or queued redirect is confirmed. |
| `WASH-ENTRY-06` | Authenticated access-check request | Signed-in user clicks the action | `getUserSubscription()` | Fetches the current subscription before deciding whether to navigate | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | The check is performed on click, not preloaded or cached in this flow. |
| `WASH-ENTRY-07` | Plan eligibility evaluation | Subscription response resolves | `hasWashTradingTier` and local status check | Requires active/trialing status, current period, and Plus/Pro tier | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Eligibility is evaluated locally from the returned subscription payload. |
| `WASH-ENTRY-08` | Eligible route navigation | Eligible signed-in user completes the check | `navigate(washTradingUrl)` | Navigates to `/wash-trading/:mint` | `FRONTEND_ACTIVE` | Destination page behavior is out of scope. |
| `WASH-ENTRY-09` | Ineligible fallback gate and upgrade prompt | Ineligible signed-in user or missing current subscription | `setIsWashGateOpen(true)` and gate overlay | Shows the access gate with sign-in, close, and pricing controls | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | The gate does not preserve the requested wash route. |
| `WASH-ENTRY-10` | Access-check failure fallback | Subscription lookup throws | `catch` branch in `handleAiWashClick` | Logs the error and opens the same gate overlay | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No visible error message or retry guidance is shown. |
| `WASH-ENTRY-11` | Gate modal dismissal and sign-in action | Gate overlay is open | Backdrop click, close button, and `openAuthModal("login")` | Closes the gate or opens the login modal | `FRONTEND_ACTIVE` | The sign-in action does not supply a redirect target. |
| `WASH-ENTRY-12` | Pricing or upgrade behavior | User clicks the upgrade CTA in the gate | `Link to="/pricing"` | Opens the pricing page | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | The upgrade destination is a raw route link with no preservation of the original wash target. |
| `WASH-ENTRY-13` | Route preservation and local fallback behavior | Guest or ineligible branch opens | Local gate state and auth modal state | Keeps the user on the current page while the gate or modal is open | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | The originally intended wash-trading destination is not confirmed as preserved. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 5 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 8 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical wash-trading entry capabilities** | 13 |

Validation: `5 + 8 + 0 + 0 + 0 = 13`, matching the 13 rows in the canonical wash-trading entry capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Unused wash-trading entry artifacts | 1 |
| Out-of-scope components encountered | 5 |

The out-of-scope components encountered are the surrounding Token Overview blocks audited in earlier phases: `TokenAIChat`, `TokenOverviewStats`, `TokenOverviewChart`, `TokenInsightTabs`, and `NewsTab`.

## 6. Frontend API calls

| Capability ID | Trigger | Frontend caller | API method or URL | Request input | Response usage | Error handling | Refresh/cache behavior | Status |
|---|---|---|---|---|---|---|---|---|
| `WASH-ENTRY-06` | Signed-in user clicks the wash action | `handleAiWashClick` -> `getUserSubscription` | `client.api.profile.subscriptions.$get` | No request body; authenticated session cookies are used | Supplies `subscription` for local eligibility logic | Non-OK response throws an error and falls back to the gate | No caching in this flow; request happens on click only | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Request behavior summary:

- Initial trigger: only when the user clicks the wash-trading action
- Address dependency: yes, the route token address is embedded in the final destination URL
- Symbol or name dependency: yes, used only to build the query string
- User auth dependency: yes, guests never reach the subscription lookup
- Subscription/plan dependency: yes, navigation is allowed only for current Plus/Pro subscriptions
- Manual refresh or retry: no dedicated control exists
- Polling: none found
- Request cancellation: none found
- Stale-response handling: none found
- Deduplication: none found
- Behavior when the token route changes: no explicit state preservation or reset beyond rerendering the header

## 7. Access gating and eligibility

| Access concern | Current behavior | Dependency | User-visible effect | Status |
|---|---|---|---|---|
| Mount access | The button renders with the Token Overview header once token details exist | `TokenOverviewPage` data flow | The wash entry point is visible on the token page | `FRONTEND_ACTIVE` |
| Guest access | Guests do not reach the subscription lookup | `useAuth().user` | The gate overlay opens instead of navigation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Access check | Signed-in clicks fetch the current subscription | `getUserSubscription()` | The UI waits for the result before deciding the next step | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Eligibility rule | Subscription must be active or trialing, current, and Plus/Pro | `hasWashTradingTier` plus local date check | Eligible users navigate; others see the gate | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Ineligible result | Ineligible users are not routed onward | Local branch after subscription lookup | The same gate overlay appears with pricing and sign-in actions | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Failure result | Access-check exceptions are treated like failed access | Catch block in the click handler | The gate opens and the console receives the error | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

The frontend makes the eligibility decision locally after the subscription request returns. No backend authority is assumed here beyond the returned payload.

## 8. Loading, pending, error, and fallback states

| State or action | Loading UI | Empty UI | Error UI | Partial-data behavior | Retry/fallback | Status |
|---|---|---|---|---|---|---|
| Session loading | Button is disabled while auth state resolves | N/A | No inline message | The action remains visible but inert | Wait for session resolution | `FRONTEND_ACTIVE` |
| Access check pending | Button is disabled while the subscription lookup is in flight | N/A | No spinner or text change is rendered | The click handler is locked until the check resolves | Wait for the request to settle | `FRONTEND_ACTIVE` |
| Guest click | Gate overlay opens immediately | N/A | No access error is shown | The user stays on the token page | Sign in or close the gate | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Ineligible signed-in user | Gate overlay opens | N/A | No explicit plan-denied message beyond the gate copy | The page remains on the token route | Use pricing or close the gate | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Access-check failure | Gate overlay opens after a logged error | N/A | Console error only; no visible error text | The user cannot tell whether the failure was auth, plan, or network related | Close the gate, sign in, or retry manually | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Eligible user | No intermediate loading UI beyond the disabled button | N/A | No error | The page transitions to `/wash-trading/:mint` | Navigation is the success path | `FRONTEND_ACTIVE` |

## 9. Navigation and external links

| Source UI | Required data | Destination | Internal/external | Validation | Status |
|---|---|---|---|---|---|
| Eligible wash-trading action | Current token address plus current subscription eligibility | `/wash-trading/:mint?symbol=...&timeframe=24h` | Internal React Router navigation | Address is used directly; symbol/name are only URL query fallbacks | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Gate sign-in button | Open gate overlay | Login modal | Internal auth modal | No redirect target is provided from this flow | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Gate pricing button | Open gate overlay | `/pricing` | Internal route link | Raw route link, no extra preservation of the wash target | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Gate close button or backdrop | Open gate overlay | Current token page remains visible | Local state only | No route change | `FRONTEND_ACTIVE` |

No active navigation to a token-specific purchase step, a queued redirect target, or a post-login preserved wash route was confirmed in this flow.

## 10. Responsive behavior

The wash-trading entry behavior is CSS-driven. No separate mobile request path or mobile-only access model was found.

| Entry block | Desktop behavior | Narrow/mobile behavior | Same data flow used | Confirmed limitation |
|---|---|---|---|---|
| TokenHeader action | The wash button sits in the compact Token Overview header | At `max-width: 768px`, the button becomes full width and the header wraps | Yes | No separate mobile interaction model. |
| Sidebar-specific variant | `sidebar` styling exists for the pool-detail page | Not used by the Token Overview page because `sidebar` is not passed here | No for this flow | This branch is inactive in the `/tokens/:address` entry flow. |
| Gate overlay | Fixed overlay centered over the page | Same overlay appears on narrow screens with a smaller card | Yes | The gate is modal-like, not a full-screen mobile sheet. |
| Gate actions | Buttons and link sit in one row | Actions wrap on smaller widths | Yes | No dedicated mobile-only copy or flow. |

## 11. Unused or disconnected wash-entry code

| Candidate | File/component/function | Active caller found from `/tokens/:address` | Reason excluded | Classification |
|---|---|---|---|---|
| Sidebar-specific wash button branch | `client/src/components/token/TokenHeader.tsx` `sidebar` / `aiWashButtonSidebar` / `aiWashLabelShort` | No | The Token Overview page does not pass `sidebar`, so this variant is not exercised in the active entry flow | `FRONTEND_UNUSED` |

No other wash-trading-entry-specific implementation was confirmed as disconnected from the active Token Overview flow.

## 12. Frontend-only flows

### Flow A - Open the Token Overview page

1. User navigates to `/tokens/:address`.
2. `TokenOverviewPage` loads token details.
3. `TokenHeader` renders once details exist.
4. The wash-trading button is visible in the compact header.

### Flow B - Guest clicks the wash action

1. Guest clicks the wash-trading button.
2. `TokenHeader` sees that `user` is null.
3. The wash gate overlay opens.
4. The user can choose login, close, or pricing.

### Flow C - Signed-in user clicks the wash action

1. Signed-in user clicks the wash-trading button.
2. The button disables while the access check is pending.
3. `TokenHeader` requests the current subscription.
4. If the subscription is current and Plus/Pro, the flow navigates to `/wash-trading/:mint`.
5. If not, the gate overlay opens.

### Flow D - Access check fails

1. The subscription request throws.
2. `TokenHeader` logs the failure.
3. The same gate overlay opens.
4. The user stays on the token page.

### Flow E - Close or leave the gate

1. User clicks the backdrop or close button to dismiss the gate.
2. The overlay closes and the user remains on the token page.
3. User can also open the login modal or pricing page from the gate.

### Flow F - Change token route

1. Route token changes.
2. `TokenOverviewPage` rerenders `TokenHeader` with the new token context.
3. No explicit redirect preservation is confirmed for the wash-flow click path.

## 13. Architecture-ready summary

### Confirmed wash-trading entry blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Wash-trading action shell | `WASH-ENTRY-01`, `WASH-ENTRY-02` | `TokenOverviewPage`, `TokenHeader` | Renders the visible entry point and keeps it usable in the compact header | High-level entry node. |
| Token context and destination construction | `WASH-ENTRY-03`, `WASH-ENTRY-13` | `TokenHeader` | Builds the wash route target from token context and keeps the user on the current page until a decision is made | Boundary between token context and wash entry. |
| Access lockout and gating | `WASH-ENTRY-04`, `WASH-ENTRY-05`, `WASH-ENTRY-09`, `WASH-ENTRY-10`, `WASH-ENTRY-11`, `WASH-ENTRY-12` | `TokenHeader`, gate overlay, auth modal, pricing link | Handles guest access, ineligible access, failure fallback, and upgrade/login actions | Core access-control block. |
| Subscription eligibility check | `WASH-ENTRY-06`, `WASH-ENTRY-07` | `TokenHeader`, `subscriptionApi` | Fetches subscription state and evaluates local Plus/Pro eligibility | Frontend-to-backend boundary and eligibility layer. |
| Successful navigation | `WASH-ENTRY-08` | `TokenHeader`, React Router | Sends eligible users to `/wash-trading/:mint` | Route boundary. |

### Wash-trading entry frontend-to-backend boundary

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| Access eligibility check | Current subscription lookup | Hono RPC `client.api.profile.subscriptions.$get` | Determine whether the signed-in user can enter wash-trading | Click on the wash-trading action | `client/src/components/token/TokenHeader.tsx`, `client/src/services/profile/subscriptionApi.ts` |

### Wash-trading entry route boundary

| Source block | Destination | Entity | Trigger |
|---|---|---|---|
| Wash-trading action | `/wash-trading/:mint?symbol=...&timeframe=24h` | Current token | Eligible user clicks the wash-trading button. |
| Gate sign-in button | Login modal | Current session/auth state | Guest user clicks sign in from the gate. |
| Gate pricing button | `/pricing` | Pricing page | User clicks upgrade from the gate. |

### Capabilities eligible for backend verification

Only canonical IDs that issue requests, depend on returned subscription data, or need failure-mode verification are listed:

1. `WASH-ENTRY-06` Authenticated access-check request
2. `WASH-ENTRY-07` Plan eligibility evaluation
3. `WASH-ENTRY-08` Eligible route navigation
4. `WASH-ENTRY-09` Ineligible fallback gate and upgrade prompt
5. `WASH-ENTRY-10` Access-check failure fallback

## 14. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should the gate preserve the intended wash-trading destination after login? | `openAuthModal("login")` is called without a redirect target in this flow | Wash-trading auth UX hardening |
| Should the subscription lookup be preloaded or cached instead of requested on click? | Access eligibility is checked only after user interaction | Wash-trading frontend performance review |
| Should failed access checks show a visible error instead of only logging to the console? | The catch branch opens the gate without status-specific UI | Wash-trading error-handling review |
| Should the gate explain why a user is ineligible beyond the generic access copy? | The current overlay does not distinguish plan, auth, or request failure causes | Wash-trading UX review |
| Should the compact header use a different label or affordance on very narrow screens? | The current mobile rule only widens the button and wraps the header | Wash-trading responsive UX review |
| Should the sidebar-specific wash button branch remain in the header component or move to the pool-detail implementation only? | The active Token Overview flow does not use the `sidebar` branch | Frontend cleanup audit |

## 15. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2A_MARKET_FRONTEND.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `docs/architecture/audit/02B2B2A_TOKEN_NEWS_FRONTEND.md`
- `docs/architecture/audit/02B2B2B_TOKEN_CHART_NEWS_MARKERS_FRONTEND.md`
- `docs/architecture/audit/02B2B3_TOKEN_AI_CHAT_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/TokenHeader.tsx`
- `client/src/components/token/TokenHeader.module.scss`
- `client/src/services/profile/subscriptionApi.ts`
- `client/src/contexts/AuthContext.tsx`
