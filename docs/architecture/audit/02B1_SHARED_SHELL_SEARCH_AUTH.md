# Yoca Shared Shell, Search, and Authentication Frontend Audit

## 1. Scope

This Phase 2B1 audit covers only currently used frontend shared shell, search, authentication, session, route guard, and global user-control flows.

In scope:

- Landing shell and main application shell
- Global navigation controls in shared shells
- Global search overlay opened from the app shell
- Authentication modals and active authentication methods
- Session context lifecycle
- Route access guards
- Account menu, logout, theme, language, notification, toast, and modal hosts when actively rendered

Out of scope:

- Market, token, wallet, alert, wash-trading, payment, and backend business logic
- Backend service internals, database tables, deployment, and provider success verification
- Mermaid architecture

The starting point was `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`, then findings were checked against current source files.

## 2. Classification rules

Statuses in this document describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered or lifecycle-triggered, has a connected frontend interaction, and performs its intended local action or issues the intended frontend API request.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected, but with confirmed limitations such as broken destinations, mock data, provider dependency, incomplete error display, or partial validation.
- `FRONTEND_BROKEN`: visible control exists, but the primary interaction cannot reach the intended destination or complete its basic frontend role.
- `FRONTEND_UNUSED`: implementation exists, but no active render, call, or lifecycle chain exists. This is reserved for excluded code artifacts unless a user-facing capability is genuinely disconnected.
- `UNCERTAIN`: available source evidence is insufficient.

Capability totals are derived only from the canonical capability ledger in Section 2A. Code artifacts, out-of-scope components, implementation wrappers, and repeated evidence in later sections are not included in capability totals.

## 2A. Canonical capability ledger

Each row below is one counted capability. A counted capability represents one distinct user-facing behavior or one distinct frontend lifecycle behavior.

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation or exclusion reason |
|---|---|---|---|---|---|---|
| `SHELL-01` | Landing navigation | Public landing navbar, hero primary CTA, footer product/company anchors and valid route links | `LandingNavbar`, `LandingHero`, `LandingFooter` | Local anchors and route links to `/`, `/market`, `/pricing`, `#products`, `#stories`, `#cta` | `FRONTEND_ACTIVE` | Broken `/auth` and `/tokens` landing controls are split into `SHELL-03` and `SHELL-04`. |
| `SHELL-02` | Main app navigation | App-shell brand, header nav, side nav | `PageWrapper`, `NavHeaderItems`, Carbon header/side nav | Links to `/market` and `/alerts`; side nav toggles locally | `FRONTEND_ACTIVE` | `/alerts` is intentionally guarded and is counted in `ACCESS-01`. |
| `SHELL-03` | Landing authentication CTA links | Hero secondary CTA, footer support/contact/contact-sales links, final CTA | `LandingHero`, `LandingFooter`, `LandingFinalCTA` | Links to `/auth` | `FRONTEND_BROKEN` | `/auth` is not registered; active auth implementation is modal-based; clicks fall into catch-all handling. |
| `SHELL-04` | Landing token-explorer links | Footer token explorer/chains links | `LandingFooter` | Links to `/tokens` | `FRONTEND_BROKEN` | `/tokens` is registered but cannot perform its intended role because `TokenPage` requires missing route parameters. |
| `SEARCH-01` | Global search | App-shell search icon or `Ctrl/Cmd+K` | `PageWrapper`, `SearchBar`, search result item components, `TokenStatsPanel` | `client.api.search.$get` with query param `q`; local navigation to token, pool, or wallet routes | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Failed search requests do not render a distinct user-facing error state. |
| `AUTH-01` | Email/password login | Login modal submit | `SignInModal` | `client.api.users.auth.password.login.$post`; refresh session; close modal; redirect | `FRONTEND_ACTIVE` | Frontend request/response handling is connected; backend success is outside this phase. |
| `AUTH-02` | Email/password registration | Registration modal submit | `SignInModal`, `SignUpModal` export | `client.api.users.auth.password.register.$post`; refresh session; close modal; redirect | `FRONTEND_ACTIVE` | Frontend request/response handling is connected; backend success is outside this phase. |
| `AUTH-03` | Google authentication frontend flow | Google button inside login/register modal | `GoogleAuthButton`, `GoogleOAuthProvider`, `SignInModal` | `client.api.users.auth.google.$post`; parent success callback refreshes session | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Depends on valid Google OAuth provider configuration and runtime provider behavior. |
| `AUTH-04` | Solana wallet authentication frontend flow | Wallet button inside login/register modal | `WalletAuthButton`, `WalletActionButton`, `SolanaProvider`, `SignInModal` | `client.api.users.auth.solana.nounce.$post`, wallet signature, `client.api.users.auth.solana.verify.$post` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Depends on wallet adapter/provider runtime behavior; API path is spelled `nounce` in the typed client. |
| `AUTH-05` | Forgot/reset password | Forgot-password link and reset form inside login modal | `SignInModal` | `client.api.auth["forgot-password"].$post`, then `client.api.auth["reset-password"].$post` | `FRONTEND_ACTIVE` | Frontend form state, validation, and request handling are connected. |
| `SESSION-01` | Session initialization and current-user lookup | `AuthProvider` mount and auth-success callbacks | `AuthContext` | `client.api.users.auth.me.$get`; updates `user` and loading state | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Lookup failure is logged only and does not render user-facing failure feedback. |
| `ACCESS-01` | Protected-route handling | Guest or authenticated user navigates to guarded route | `AuthGuard`, `UnauthorizedPage`, `PageWrapper` auth popup | Loading state, redirect to `/unauthorized`, preserve `state.from`, login popup return flow | `FRONTEND_ACTIVE` | Applies only to `/alerts`, `/alerts-token-demo`, and `/profile`. |
| `ACCOUNT-01` | Guest authentication entry | Landing login/signup controls, app-shell guest account icon, unauthorized login, pricing auth reminder | `LandingNavbar`, `PageWrapper`, `UnauthorizedPage`, `AuthReminderModal` | Opens modal auth UI without immediate route change | `FRONTEND_ACTIVE` | Individual modal transitions are evidence for this capability, not separate capabilities. |
| `ACCOUNT-02` | Authenticated profile navigation | Landing and app-shell authenticated account menus | `LandingNavbar`, `PageWrapper` | `Link` or `navigate("/profile")` | `FRONTEND_ACTIVE` | Route access itself is guarded by `ACCESS-01`. |
| `ACCOUNT-03` | Logout | Landing and app-shell authenticated account menus | `AuthContext.signOut`, shell account handlers | `client.api.users.auth.logout.$delete`; clears `user` after awaited request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Logout failure has no user-facing error feedback. |
| `PREF-01` | Theme preference | Landing and app-shell theme controls | `ThemeProvider`, `LandingNavbar`, `PageWrapper` | Toggle light/dark theme and persist to `THEME_LOCAL_STORAGE_KEY` | `FRONTEND_ACTIVE` | No significant frontend limitation found. |
| `PREF-02` | Language preference | Landing and app-shell language controls | `LocalizationProvider`, `LandingNavbar`, `PageWrapper` | Set English/Vietnamese and persist to `yoca_language` | `FRONTEND_ACTIVE` | No significant frontend limitation found. |
| `GLOBAL-01` | Header notification panel | App-shell notification icon | `PageWrapper`, `headerNotificationsMockData` | Toggle notification panel and render entries | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Entries are static mock data, not API-backed notification data. |
| `GLOBAL-02` | Global toast delivery | Active wallet route actions can enqueue toasts | `ToastProvider`, `useToast`, `WalletTopbar` | `useToast().toast(...)` renders through root `ToastContainer` | `FRONTEND_ACTIVE` | Active caller confirmed at `/wallets/:address` -> `WalletPage` -> `WalletTopbar`; this audit does not inspect wallet business logic. |

### Capability count validation

| Status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 11 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 6 |
| `FRONTEND_BROKEN` | 2 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical capabilities** | 19 |

Validation: `11 + 6 + 2 + 0 + 0 = 19`, which matches the 19 rows in the canonical capability ledger.

### Excluded code-artifact count

| Artifact classification | Count |
|---|---:|
| `FRONTEND_UNUSED` code artifacts | 3 |
| Out-of-scope components | 2 |

Capability totals come only from the canonical ledger. Code artifacts are not included. Out-of-scope components are not included. Repeated evidence in later sections does not create additional counts.

## 3. Active shared UI shells

This section preserves architecture evidence. It does not create additional counted capabilities beyond the IDs in Section 2A.

| Shared UI block | Main file/component | Where rendered | User purpose | Connected interactions | Status |
|---|---|---|---|---|---|
| Root provider tree | `client/src/main.tsx` `Root` | Whole SPA before `App` | Supplies observable theme, auth/session, Google OAuth, Solana wallet modal, localization, toast, chart/watchlist context | Mounts `ThemeProvider`, `AuthProvider`, `GoogleOAuthProvider`, `SolanaProvider`, `LocalizationProvider`, `ToastProvider` | Implementation evidence for `SESSION-01`, `AUTH-03`, `AUTH-04`, `PREF-01`, `PREF-02`, and `GLOBAL-02`; not counted separately |
| Router loading shell | `client/src/App.tsx` `RootLayout` | Parent layout for all routes | Shows global loading overlay during route navigation/submission | `useNavigation()` drives Carbon `Loading`; `Outlet` renders matched page | `FRONTEND_ACTIVE` |
| Landing shell | `client/src/pages/index.tsx`, `client/src/components/landing/Navbar.tsx`, `Footer.tsx`, `Hero.tsx`, `FinalCTA.tsx` | `/` landing route | Public navigation, account entry, language/theme controls, CTA links | Links to `/`, `/market`, `/pricing`, anchors; opens auth modals; toggles theme/language; some CTAs link to missing `/auth` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Main application shell | `client/src/components/wrapper/PageWrapper.tsx` | Used by app pages such as market, alerts, profile, token, wallet, comparison, error pages | Shared header, side nav, search, account menu, language/theme/notification controls, content wrapper | Header nav, side nav, account modal/menu, search overlay, language menu, theme toggle, notification panel, optional auth popup | `FRONTEND_ACTIVE` |
| App side navigation | `PageWrapper` `SideNav`, `NavHeaderItems` | App shell | Mobile/narrow app navigation to Market and Alerts | Header menu button toggles side nav; side nav reuses `/market` and `/alerts` entries | `FRONTEND_ACTIVE` |
| Search overlay host | `PageWrapper`, `client/src/components/search/SearchBar.tsx` | App shell only | Global entity lookup | Header search button and `Ctrl/Cmd+K` open overlay; result selection navigates to token, pool, or wallet routes | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Auth modal hosts | `PageWrapper`, `LandingNavbar`, `AuthReminderModal`, `UnauthorizedPage` | Landing shell, app shell, pricing auth reminder, unauthorized page | Login/register/social/wallet/forgot-password entry | Modal state opens `SignInModal`/`SignUpModal`; successful auth refreshes session and redirects | `FRONTEND_ACTIVE` |
| Toast host | `client/src/components/common/Toast/ToastContext.tsx` | Root provider tree | Global toast display | `ToastProvider` renders `ToastContainer`; active wallet route actions enqueue toasts through `useToast` | Evidence for `GLOBAL-02` |
| Solana wallet modal host | `client/src/contexts/SolanaWalletContext.tsx` | Root provider tree | Wallet connection modal support for wallet auth/actions | Hidden `WalletMultiButton`, `WalletModalProvider`, and Carbon modal container are wired | Evidence for `AUTH-04` |

## 4. Global navigation controls

| Control | Visible purpose | Source component | Trigger/handler | Destination or action | Required user state | Status |
|---|---|---|---|---|---|---|
| Landing logo | Home | `LandingNavbar` `BrandLink` | `Link` | `/` | Any | `FRONTEND_ACTIVE` |
| Landing desktop/mobile Products | Landing section anchor | `LandingNavbar` | Anchor link | `#products` | Any | `FRONTEND_ACTIVE` |
| Landing desktop/mobile Use Cases | Landing section anchor | `LandingNavbar` | Anchor link | `#stories` | Any | `FRONTEND_ACTIVE` |
| Landing desktop/mobile Docs | App entry | `LandingNavbar` | `Link` | `/market` | Any | `FRONTEND_ACTIVE` |
| Landing desktop/mobile Pricing | Pricing page | `LandingNavbar` | `Link` | `/pricing` | Any | `FRONTEND_ACTIVE` |
| Landing login | Open login modal | `LandingNavbar`, `LogInLink`, mobile menu | `setIsSignInOpen(true)` | `SignInModal` | Guest | `FRONTEND_ACTIVE` |
| Landing sign up | Open registration modal | `LandingNavbar`, mobile menu | `setIsSignUpOpen(true)` | `SignUpModal` | Guest | `FRONTEND_ACTIVE` |
| Landing account menu | Profile/logout menu | `LandingNavbar` | Account button toggles local menu | Shows profile link and logout button | Authenticated user | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Landing hero primary CTA | Enter market | `LandingHero` | `Link` | `/market` | Any | `FRONTEND_ACTIVE` |
| Landing hero secondary CTA | Auth/sign-up destination | `LandingHero` | `Link` | `/auth` | Any | `FRONTEND_BROKEN` |
| Landing footer product token links | Token explorer/chains | `LandingFooter` | `Link` | `/tokens` | Any | `FRONTEND_BROKEN` |
| Landing footer support/contact/contact-sales | Auth/contact destination | `LandingFooter` | `Link` | `/auth` | Any | `FRONTEND_BROKEN` |
| Landing final CTA | Auth/sign-up destination | `LandingFinalCTA` | `Link` | `/auth` | Any | `FRONTEND_BROKEN` |
| App-shell logo | Main app home | `PageWrapper` `HeaderName` | `href` | `/market` | Any | `FRONTEND_ACTIVE` |
| App-shell Market nav | Market page | `PageWrapper` `NavHeaderItems` | `HeaderMenuItem href` | `/market` | Any | `FRONTEND_ACTIVE` |
| App-shell Alerts nav | Alerts page | `PageWrapper` `NavHeaderItems` | `HeaderMenuItem href` | `/alerts` | Auth guard applies | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| App-shell side nav | Market and Alerts | `PageWrapper` `SideNav` | Header menu button toggles side nav; side nav items use same hrefs | `/market`, `/alerts` | Any; `/alerts` guard applies | `FRONTEND_ACTIVE` |
| App-shell search icon | Open global search | `PageWrapper` | `setIsSearchOpen(true)` | `SearchBar` overlay | Any | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| App-shell account icon as guest | Open login modal | `PageWrapper` | `openAuthModal("login")` | `SignInModal` | Guest | `FRONTEND_ACTIVE` |
| App-shell account menu as user | Profile/logout menu | `PageWrapper` | Toggle account panel | Profile navigation and logout | Authenticated user | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Known navigation defects:

- `/auth` has no registered route in `client/src/App.tsx`.
- Landing hero, footer, and final CTA still link to `/auth`.
- Those interactions fall into catch-all not-found handling.
- Modal-based auth is the active authentication UI.

## 5. Global search

Global search is opened from `PageWrapper`, not from the landing shell. The active entry points are the app-shell search icon and the `Ctrl+K` / `Cmd+K` keyboard shortcut.

### Search components

| Responsibility | File/component | Important function/hook | Behavior |
|---|---|---|---|
| Search opener | `client/src/components/wrapper/PageWrapper.tsx` | `setIsSearchOpen(true)`, keyboard `useEffect` | Header icon or `Ctrl/Cmd+K` opens `SearchBar`; overlay is mounted while `isSearchOpen` is true. |
| Overlay and query state | `client/src/components/search/SearchBar.tsx` | `SearchBar`, `handleInput`, `debounceRef` | Focuses input on mount, tracks `query`, debounces to `debouncedQuery` after 320ms, resets keyboard/hover state on input. |
| Search API call | `SearchBar` | `useGet(client.api.search, 200, ...)` | Calls typed Hono search endpoint when debounced query is non-empty. |
| Result transformation | `SearchBar` `select` callback | Token, pool, wallet mapping | Normalizes API results into `TokenResult`, `PoolResult`, and `WalletResult`. |
| Synthetic wallet result | `SearchBar` `extractSolanaWalletAddress` | Base58 regex | Adds a wallet result for address-like input if the API did not return it. |
| Keyboard navigation | `SearchBar` `handleKeyDown` | Arrow keys, Enter | Moves focus through combined result list and selects focused result on Enter. |
| Result rendering | `TokenResultItem`, `PoolResultItem`, `WalletResultItem` | `onSelect` callbacks | Renders clickable result rows for tokens, pools, and wallets. |
| Token preview panel | `TokenStatsPanel` | `activeToken`, `lastFocusedToken` | Shows token stats and sparkline for hovered/focused token. |
| Closing behavior | `SearchBar` | Overlay click, Escape key, result selection | Overlay click and Escape call `onClose`; successful result navigation also closes the overlay. |

### Search API calls

| User trigger | Frontend API method or request | Request input | Response usage | Error handling | Status |
|---|---|---|---|---|---|
| User types in global search | `client.api.search.$get` through `useGet` | Query param `{ q: debouncedQuery }` | Maps `tokens`, `pools`, and `wallets` into result groups | `useGet` exposes `error`, but `SearchBar` does not render a distinct error state | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

### Search result navigation

| Result type | Required fields | Destination | Validation before navigation | Status |
|---|---|---|---|---|
| Token | `token.address` | `/tokens/:address` | API result mapping assumes address is present; no additional route-level validation in search | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Pool | `pool.baseTokenAddress`, `pool.address` | `/tokens/:address/:poolAddress` | `selectPool` checks both token address and pool address before navigating | `FRONTEND_ACTIVE` |
| Wallet | `wallet.address` | `/wallets/:address` | API wallets are mapped directly; synthetic wallets require base58-like 32-44 char input | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Malformed or partial result handling:

- Pool navigation is guarded by `if (tokenAddress && pool.address)`.
- Synthetic wallet results are only added when input matches `SOLANA_BASE58_ADDRESS_REGEX` or an extracted base58-like substring.
- Token and API wallet result navigation assumes returned addresses are usable.
- Empty, loading, and initial hint states are rendered.
- A distinct user-facing error state is not rendered for failed search requests.

## 6. Session lifecycle

| Session concern | File/component | API/action | State affected | User-visible behavior | Status |
|---|---|---|---|---|---|
| Session initialization | `client/src/contexts/AuthContext.tsx` `AuthProvider` | `refreshUser()` in `useEffect` | Starts with `user=null`, `isUserLoading=true`; then calls current-user API | Guarded routes show loading while session is resolving | `FRONTEND_ACTIVE` |
| Current-user lookup | `AuthProvider.refreshUser` | `client.api.users.auth.me.$get()` | Sets `user` from `{ id, displayName, avatarUrl }` or clears user on non-ok/null response | Guest/authenticated UI branches update through context | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Lookup failure | `AuthProvider.refreshUser` | Catch block logs error | Does not explicitly clear user in catch; `isUserLoading` still becomes false | Failure is only logged to console; no user-facing error | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Authentication-success refresh | `SignInModal`, `GoogleAuthButton`, `WalletAuthButton` callbacks | `await refreshUser()` | Re-queries session after login/register/social/wallet success | Modal closes and UI rerenders as authenticated | `FRONTEND_ACTIVE` |
| Logout | `AuthProvider.signOut` | `client.api.users.auth.logout.$delete()` | Sets `user=null` after awaited API call | Account menus disappear and guest controls return | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Auth modal state | `AuthProvider.openAuthModal`, `closeAuthModal` | Local state only | `isSignInOpen`, `isSignUpOpen` | App shell can open shared sign-in/register modal | `FRONTEND_ACTIVE` |

Frontend-visible cookie/token assumption:

- `client/src/api/main.ts` creates the Hono client with `credentials: "include"`, so frontend auth/session calls assume cookie-based session transport.
- The frontend does not inspect JWTs or cookie contents.

## 7. Authentication methods

### Authentication method: Email/password login

**Status:**  
`FRONTEND_ACTIVE`

**Visible entry points**  
Landing login button, app-shell guest account icon, unauthorized page login button, auth reminder modal, and feature-specific `openAuthModal("login")` callers.

**Main frontend files**  
`client/src/components/auth/SignInModal.tsx`, `client/src/contexts/AuthContext.tsx`, `client/src/components/wrapper/PageWrapper.tsx`, `client/src/components/landing/Navbar.tsx`.

**User input and validation**  
Email and password fields use React Hook Form with Zod validation. Email must be valid; password must be at least 8 characters.

**Frontend API call**  
`client.api.users.auth.password.login.$post({ json: { email, password } })`.

**Success behavior**  
On HTTP 200, the modal calls `refreshUser()`, closes, and navigates to `redirectUrl` or the current path with `replace: true`.

**Failure behavior**  
401 and 422 parse `errorCode` and render translated error text; other statuses render generic error; catch renders network error.

**Known limitations**  
This audit confirms frontend request/response handling only.

**Evidence**  
`AuthModalBase.onLogin` in `client/src/components/auth/SignInModal.tsx`.

### Authentication method: Email/password registration

**Status:**  
`FRONTEND_ACTIVE`

**Visible entry points**  
Landing sign-up button and login/register modal toggle.

**Main frontend files**  
`client/src/components/auth/SignInModal.tsx`, `client/src/components/landing/Navbar.tsx`.

**User input and validation**  
Email, optional display name, password, and confirm password fields. Zod validates email, password length, and password confirmation match.

**Frontend API call**  
`client.api.users.auth.password.register.$post({ json: { email, displayName, password } })`.

**Success behavior**  
On HTTP 201, the modal calls `refreshUser()`, closes, and navigates to `redirectUrl` or current path.

**Failure behavior**  
400/422 parse translated `errorCode`; 500 renders internal-server translation; catch renders network error.

**Known limitations**  
No production provider/session behavior is inferred.

**Evidence**  
`AuthModalBase.onSignup` in `client/src/components/auth/SignInModal.tsx`.

### Authentication method: Google authentication

**Status:**  
`FRONTEND_ACTIVE_WITH_LIMITATIONS`

**Visible entry points**  
Google button inside both login and registration modal panels.

**Main frontend files**  
`client/src/components/auth/GoogleAuthButton.tsx`, `client/src/components/auth/SignInModal.tsx`, `client/src/main.tsx`.

**User input and validation**  
The hidden `GoogleLogin` widget supplies a credential. The frontend checks that `credentialResponse.credential` exists.

**Frontend API call**  
`client.api.users.auth.google.$post({ json: { token } })`.

**Success behavior**  
On HTTP 200, `GoogleAuthButton` calls parent `onSuccess`; parent refreshes session, closes modal, and redirects.

**Failure behavior**  
Missing credential, non-200 response, Google error, or network exception set translated errors.

**Known limitations**  
Requires `GoogleOAuthProvider` and a configured Google client ID. This audit does not verify provider configuration or Google production behavior.

**Evidence**  
`GoogleOAuthProvider` in `main.tsx`; `GoogleAuthButton` and its parent callbacks in `SignInModal.tsx`.

### Authentication method: Solana wallet authentication

**Status:**  
`FRONTEND_ACTIVE_WITH_LIMITATIONS`

**Visible entry points**  
Wallet button inside login and registration modal panels.

**Main frontend files**  
`client/src/components/auth/WalletAuthButton.tsx`, `client/src/components/auth/WalletActionButton.tsx`, `client/src/contexts/SolanaWalletContext.tsx`, `client/src/components/auth/SignInModal.tsx`.

**User input and validation**  
User connects a supported wallet and signs a message. `WalletActionButton` requires `publicKey`, `signMessage`, and `wallet` before action execution.

**Frontend API call**  
First `client.api.users.auth.solana.nounce.$post({ json: { pubKey } })`, then `client.api.users.auth.solana.verify.$post({ json: { pubKey, signature } })`.

**Success behavior**  
On verify success, wallet modal closes, parent success callback refreshes session, closes auth modal, and redirects.

**Failure behavior**  
Nonce or verify failures parse `errorCode` where available; unexpected action failures render wallet verification error.

**Known limitations**  
Provider and wallet extension behavior are not runtime-verified. The API path spelling is `nounce` in the typed client.

**Evidence**  
`WalletAuthButton` and `WalletActionButton`; `SolanaProvider` wraps the app in `main.tsx`.

### Authentication method: Forgot password and reset password

**Status:**  
`FRONTEND_ACTIVE`

**Visible entry points**  
Forgot-password link inside the login modal.

**Main frontend files**  
`client/src/components/auth/SignInModal.tsx`.

**User input and validation**  
Forgot step validates email. Reset step validates email, 6-digit code, strong password, and confirm password match.

**Frontend API call**  
`client.api.auth["forgot-password"].$post({ json: { email } })` and `client.api.auth["reset-password"].$post({ json: { email, code, newPassword } })`.

**Success behavior**  
Forgot success moves to reset step and preserves email. Reset success shows success panel with a button back to sign-in.

**Failure behavior**  
422/400/429 parse translated error codes; catch renders network error.

**Known limitations**  
This audit verifies only that frontend forms and requests are wired.

**Evidence**  
`openForgotPassword`, `sendPasswordResetCode`, and `onResetPassword` in `SignInModal.tsx`.

## 8. Authentication modal transitions

| Starting UI state | User action | Next state/component | Route change | Data preserved | Status |
|---|---|---|---|---|---|
| Landing guest navbar | Click Login | `SignInModal` | No immediate route change | Current path used as default redirect | `FRONTEND_ACTIVE` |
| Landing guest navbar | Click Sign Up | `SignUpModal` | No immediate route change | Current path used as default redirect | `FRONTEND_ACTIVE` |
| App-shell guest account icon | Click account icon | Shared `SignInModal` from `PageWrapper` | No immediate route change | Optional `authPopup.redirectUrl` if provided | `FRONTEND_ACTIVE` |
| Login modal | Click Register toggle | Registration panel in `AuthModalBase` | No route change | Existing modal remains open; error/forgot state cleared | `FRONTEND_ACTIVE` |
| Registration modal | Click Login toggle | Login panel in `AuthModalBase` | No route change | Existing modal remains open; errors cleared | `FRONTEND_ACTIVE` |
| Login modal | Click Forgot Password | Forgot email form | No route change | Current login email is copied into forgot email field | `FRONTEND_ACTIVE` |
| Forgot email form | Submit valid email | Reset-code form | No route change | Email stored in state and reset form | `FRONTEND_ACTIVE` |
| Reset-code form | Submit accepted reset | Success panel | No route change | No auth session change | `FRONTEND_ACTIVE` |
| Unauthorized page | Click Login | `PageWrapper` auth popup opens | No immediate route change | `location.state.from` becomes `redirectUrl` | `FRONTEND_ACTIVE` |
| Auth modal | Successful login/register/social/wallet auth | Modal closes; session refreshes | Navigates to `redirectUrl` or current path | Redirect target is preserved if explicitly supplied | `FRONTEND_ACTIVE` |
| Auth modal | Close/backdrop click | Modal closes | No route change | Pending intent is lost unless caller can reopen with same prop | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Pricing auth reminder | Click Sign In | Embedded `SignInModal` | No immediate route change | Hardcoded `redirectUrl="/pricing"` | `FRONTEND_ACTIVE` |

## 9. Route access control

`AuthGuard` is applied only in `client/src/App.tsx` to `/alerts`, `/alerts-token-demo`, and `/profile`.

| Protected route | Guard location | Guest result | Authenticated result | Original destination preserved | Return flow confirmed | Status |
|---|---|---|---|---|---|---|
| `/alerts` | `App.tsx` route element wraps `AlertsPage` with `AuthGuard` | Loading while session resolves, then redirect to `/unauthorized` | Renders `AlertsPage` | Yes, via `Navigate state={{ from: attemptedPath }}` | Yes, `UnauthorizedPage` passes `requestedPath` to `PageWrapper.authPopup.redirectUrl` | `FRONTEND_ACTIVE` |
| `/alerts-token-demo` | `App.tsx` route element wraps `AlertsDemo` with `AuthGuard` | Loading then redirect to `/unauthorized` | Renders `AlertsDemo` | Yes | Yes through unauthorized login popup | `FRONTEND_ACTIVE` |
| `/profile` | `App.tsx` route element wraps `ProfilePage` with `AuthGuard` | Loading then redirect to `/unauthorized` | Renders `ProfilePage` | Yes | Yes through unauthorized login popup | `FRONTEND_ACTIVE` |

Guard nuances:

- `AuthGuard` preserves the attempted path, including pathname, search, and hash.
- `AuthGuard` does not automatically open a login modal.
- `UnauthorizedPage` is the component that consumes the preserved `from` value and opens a `PageWrapper` auth popup when the user clicks Login.

## 10. Account menu and logout

| Account control | User state | Available action | Handler/API | Result | Status |
|---|---|---|---|---|---|
| Landing desktop account button | Guest | Login and sign-up buttons | Local `setIsSignInOpen`, `setIsSignUpOpen` | Opens modal auth UI | `FRONTEND_ACTIVE` |
| Landing desktop account menu | Authenticated | Profile link and sign out | `Link` to `/profile`; `handleSignOut` calls `signOut()` | Navigates to profile or clears session after logout | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Landing mobile menu account area | Guest | Login and sign-up buttons | Local modal state | Closes mobile menu and opens modal | `FRONTEND_ACTIVE` |
| Landing mobile menu account area | Authenticated | Profile and sign out | `Link` to `/profile`; `handleSignOut` | Closes mobile menu and logs out | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| App-shell account icon | Guest | Open sign-in modal | `openAuthModal("login")` | Opens shared `SignInModal` | `FRONTEND_ACTIVE` |
| App-shell account menu | Authenticated | Profile and sign out | `navigate("/profile")`; `signOut()` | Closes menu, navigates or clears user state | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Logout API call | Authenticated | Sign out | `client.api.users.auth.logout.$delete()` | `AuthContext` sets `user=null` after awaited call | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Logout limitation:

- Landing and app-shell logout handlers await `signOut()` but do not show a user-facing error if the logout request fails.

## 11. Other global controls

| Global control | Rendered location | User action | State/API affected | Persistence | Status | Evidence |
|---|---|---|---|---|---|---|
| Theme toggle | Landing navbar and app shell | Click theme icon | `ThemeContext.toggleTheme` flips `light`/`dark` | Persists to `THEME_LOCAL_STORAGE_KEY` | `FRONTEND_ACTIVE` | `ThemeProvider`, `LandingNavbar`, `PageWrapper` |
| Language selector | Landing navbar desktop/mobile and app shell | Select English or Vietnamese | `LocalizationContext.setLang` updates `lang` and formatters | Persists to `yoca_language` localStorage key | `FRONTEND_ACTIVE` | `LocalizationProvider`, `LandingNavbar`, `PageWrapper` |
| Notification panel | App shell | Click notification icon | Local `openPanel="notifications"`; renders `headerNotificationsMockData` | No persistence; mock data only | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | `PageWrapper`, `headerNotificationsMock.ts` |
| Toast system | Root provider plus active wallet route caller | `WalletTopbar` actions call `useToast().toast(...)` | Local toast state in `ToastProvider` | Auto-dismiss after 6 seconds | `FRONTEND_ACTIVE` | `/wallets/:address` renders `WalletPage`, which renders `WalletTopbar`; `WalletTopbar` calls `toast(...)` for label/follow outcomes |
| Solana wallet modal | Auth wallet flow and wallet action buttons | Click wallet auth/action button | Wallet adapter state and Solana context modal state | Wallet adapter only; `SolanaProvider` removes `walletName` from localStorage on render | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | `SolanaProvider`, `WalletActionButton` |
| App-shell hidden language/account `HeaderPanel` blocks | `PageWrapper` | No active expansion path found; custom menus are used instead | None confirmed | None | `FRONTEND_UNUSED` | `HeaderPanel expanded={false}` blocks in `PageWrapper` |

## 12. Frontend API inventory

| Capability | User trigger or lifecycle trigger | Frontend caller | API method/URL | Request data | Response usage | Frontend error handling | Status |
|---|---|---|---|---|---|---|---|
| Global search | User types in app-shell search overlay | `SearchBar` | `client.api.search.$get` | Query param `q` | Maps tokens, pools, wallets into result groups | Failed `useGet` response is not rendered as distinct error UI | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Current session lookup | `AuthProvider` mount and auth success callbacks | `AuthContext.refreshUser` | `client.api.users.auth.me.$get` | None | Sets `user` or clears to null | Catch logs only; no user-facing error | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Logout | Account menu sign-out | `AuthContext.signOut` | `client.api.users.auth.logout.$delete` | None | Sets `user=null` after awaited request | No local catch/user-facing error in `signOut` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Email login | Login form submit | `SignInModal.onLogin` | `client.api.users.auth.password.login.$post` | `{ email, password }` | Refreshes user, closes modal, redirects | Translated status/network errors | `FRONTEND_ACTIVE` |
| Email registration | Registration form submit | `SignInModal.onSignup` | `client.api.users.auth.password.register.$post` | `{ email, displayName, password }` | Refreshes user, closes modal, redirects | Translated status/network errors | `FRONTEND_ACTIVE` |
| Google auth | Google credential success | `GoogleAuthButton` | `client.api.users.auth.google.$post` | `{ token }` | Parent refreshes user, closes modal, redirects | Missing credential, provider error, non-200, and network error handling | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Solana wallet nonce | Wallet auth action | `WalletAuthButton` | `client.api.users.auth.solana.nounce.$post` | `{ pubKey }` | Provides signable message | Parses error code where available | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Solana wallet verify | Wallet signature produced | `WalletAuthButton` | `client.api.users.auth.solana.verify.$post` | `{ pubKey, signature }` | Parent refreshes user, closes modal, redirects | Parses error code where available | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Forgot password | Forgot email form submit | `SignInModal.sendPasswordResetCode` | `client.api.auth["forgot-password"].$post` | `{ email }` | Moves to reset step and stores email | Translated status/network errors | `FRONTEND_ACTIVE` |
| Reset password | Reset form submit | `SignInModal.onResetPassword` | `client.api.auth["reset-password"].$post` | `{ email, code, newPassword }` | Shows reset success panel | Translated status/network errors | `FRONTEND_ACTIVE` |

## 13. Frontend-only data flows

1. Guest opens login and authenticates
2. User clicks landing login or app-shell account icon.
3. `SignInModal` opens.
4. User submits email/password or uses Google/wallet auth.
5. Frontend issues the relevant auth API request.
6. On success, `refreshUser()` calls current-user API.
7. `AuthContext` updates `user`.
8. Modal closes and frontend navigates to `redirectUrl` or current path.

1. Authenticated user opens account menu and navigates to profile
2. User clicks landing or app-shell account button.
3. Shell opens account menu.
4. User clicks Profile.
5. Landing shell uses `Link` to `/profile`; app shell uses `navigate("/profile")`.
6. Router renders `/profile` if `AuthGuard` sees a user.

1. Authenticated user logs out
2. User opens account menu.
3. User clicks sign out.
4. Shell calls `signOut()`.
5. `AuthContext.signOut` calls logout API.
6. After the awaited call, `user` is set to `null`.
7. Shell rerenders guest account controls.

1. User opens global search and selects a token
2. User clicks app-shell search icon or presses `Ctrl/Cmd+K`.
3. `SearchBar` opens and focuses input.
4. User types; query debounces for 320ms.
5. Frontend calls `client.api.search` with `q`.
6. Token results render.
7. User clicks a token or presses Enter while focused.
8. Frontend navigates to `/tokens/:address` and closes overlay.

1. User opens global search and selects a pool
2. Search opens from app shell.
3. User types; frontend calls `client.api.search`.
4. Pool results render when returned.
5. User selects a pool.
6. `selectPool` verifies base token address and pool address exist.
7. Frontend navigates to `/tokens/:address/:poolAddress` and closes overlay.

1. User opens global search and selects a wallet
2. Search opens from app shell.
3. User types; frontend calls `client.api.search`.
4. Wallet results render from API, or a synthetic wallet row is added for base58-like address input.
5. User selects a wallet.
6. Frontend navigates to `/wallets/:address` and closes overlay.

1. Guest attempts to access a protected route
2. Guest navigates to `/alerts`, `/alerts-token-demo`, or `/profile`.
3. `AuthGuard` waits while `isUserLoading` is true.
4. If `user` remains null, `AuthGuard` redirects to `/unauthorized` with `state.from`.
5. `UnauthorizedPage` displays the protected path.
6. User clicks Login.
7. `PageWrapper` opens sign-in modal with `redirectUrl` set to the preserved path.
8. On successful auth, modal refreshes session and navigates to the preserved path.

1. Forgot-password/reset-password flow
2. User opens login modal.
3. User clicks Forgot Password.
4. Modal switches to email form and copies current email if present.
5. Frontend calls forgot-password API.
6. On accepted response, modal switches to reset-code form and preserves email.
7. User submits email, code, new password, and confirmation.
8. Frontend calls reset-password API.
9. On success, modal shows success panel and offers return to sign-in.

## 14. Disconnected or unused code

The broken landing controls are counted as canonical capabilities `SHELL-03` and `SHELL-04`. The table below is only for implementation artifacts excluded from capability totals.

| Candidate | Type | Active caller found | Reason excluded | Classification |
|---|---|---|---|---|
| App-shell language `HeaderPanel` block | Dead UI block | No active expansion path found | Custom language dropdown is used instead; this `HeaderPanel` has `expanded={false}` | `FRONTEND_UNUSED` |
| App-shell account `HeaderPanel` block | Dead UI block | No active expansion path found | Custom account menu is used instead; this `HeaderPanel` has `expanded={false}` | `FRONTEND_UNUSED` |
| `client/src/components/auth/SignUpModal.tsx` re-export | Compatibility re-export | Imported by `LandingNavbar` through the re-export path | The active implementation lives in `SignInModal.tsx`; the re-export file is not a separate capability | `FRONTEND_UNUSED` |

### Out-of-scope components encountered

| Component | Why encountered | Why excluded from this audit | Future audit |
|---|---|---|---|
| `client/src/components/TokenSearch/TokenSearch.tsx` | It also calls the typed search API and appeared during search-related source inspection | It is a feature-specific token picker, not the global app-shell search overlay | Alerts or feature-form audit |
| `client/src/components/PoolSearch/PoolSearch.tsx` | It also calls the typed search API and appeared during search-related source inspection | It is a feature-specific pool picker, not the global app-shell search overlay | Alerts or feature-form audit |

## 15. Architecture-ready summary

### Confirmed frontend blocks

This table maps architecture containers to canonical capability IDs. It does not create additional capability counts.

| Proposed frontend block | Capability IDs | Components included | Responsibility |
|---|---|---|---|
| Landing shell | `SHELL-01`, `SHELL-03`, `SHELL-04`, `ACCOUNT-01`, `ACCOUNT-02`, `ACCOUNT-03`, `PREF-01`, `PREF-02` | `pages/index.tsx`, `LandingNavbar`, `LandingFooter`, `LandingHero`, `LandingFinalCTA` | Public navigation, auth entry, account controls, language/theme controls, public CTAs, and known broken landing destinations |
| Main application shell | `SHELL-02`, `SEARCH-01`, `ACCOUNT-01`, `ACCOUNT-02`, `ACCOUNT-03`, `GLOBAL-01`, `PREF-01`, `PREF-02` | `PageWrapper`, Carbon header/side nav/content | Shared app navigation, search entry, account menu, notification panel, preference controls, app content wrapper |
| Global search | `SEARCH-01` | `PageWrapper`, `SearchBar`, result item components, `TokenStatsPanel` | Search tokens, pools, wallets; navigate to selected entity routes |
| Authentication UI | `AUTH-01`, `AUTH-02`, `AUTH-03`, `AUTH-04`, `AUTH-05`, `ACCOUNT-01` | `SignInModal`, `GoogleAuthButton`, `WalletAuthButton`, `AuthReminderModal`, `GoogleOAuthProvider`, `SolanaProvider` | Login, registration, Google, wallet, forgot/reset password, auth entry/reminder UI |
| Session/auth context | `SESSION-01`, `ACCOUNT-03` | `AuthProvider`, `useAuth` | Session lookup, session refresh, logout, auth modal state |
| Route access control | `ACCESS-01` | `AuthGuard`, `UnauthorizedPage` | Protect selected routes and preserve/consume attempted destination |
| Account controls | `ACCOUNT-01`, `ACCOUNT-02`, `ACCOUNT-03` | `LandingNavbar`, `PageWrapper` | Guest auth entry; authenticated profile/logout controls |
| Global preference controls | `PREF-01`, `PREF-02` | `ThemeProvider`, `LocalizationProvider`, shell controls | Theme and language state/persistence |
| Global notification/toast hosts | `GLOBAL-01`, `GLOBAL-02` | `PageWrapper`, `ToastProvider`, `WalletTopbar` toast caller | Notification panel and app-wide toast rendering |

### Frontend-to-backend boundaries

| Frontend block | Backend-facing API category | Communication | Evidence |
|---|---|---|---|
| Global search | Search endpoint | Hono RPC `client.api.search.$get` with credentials included globally | `SearchBar.tsx`, `api/main.ts` |
| Session/auth context | Current session and logout | Hono RPC `users.auth.me.$get`, `users.auth.logout.$delete` | `AuthContext.tsx` |
| Email auth UI | Password login/register | Hono RPC `users.auth.password.login.$post`, `users.auth.password.register.$post` | `SignInModal.tsx` |
| Google auth UI | Google token verification | Hono RPC `users.auth.google.$post` | `GoogleAuthButton.tsx` |
| Solana wallet auth UI | Wallet nonce and verification | Hono RPC `users.auth.solana.nounce.$post`, `users.auth.solana.verify.$post` | `WalletAuthButton.tsx` |
| Password reset UI | Forgot/reset password | Hono RPC `auth["forgot-password"].$post`, `auth["reset-password"].$post` | `SignInModal.tsx` |

### Features eligible for later end-to-end verification

1. `SHELL-01` Landing navigation
2. `SHELL-02` Main app navigation
3. `SEARCH-01` Global search
4. `AUTH-01` Email/password login
5. `AUTH-02` Email/password registration
6. `AUTH-03` Google authentication frontend flow
7. `AUTH-04` Solana wallet authentication frontend flow
8. `AUTH-05` Forgot/reset password
9. `SESSION-01` Session initialization and current-user lookup
10. `ACCESS-01` Protected-route handling
11. `ACCOUNT-01` Guest authentication entry
12. `ACCOUNT-02` Authenticated profile navigation
13. `ACCOUNT-03` Logout
14. `PREF-01` Theme preference
15. `PREF-02` Language preference
16. `GLOBAL-01` Header notification panel
17. `GLOBAL-02` Global toast delivery

## 16. Open questions

| Question | Why unresolved in this phase | Suggested verification phase |
|---|---|---|
| Do all frontend auth API calls succeed against the deployed backend/session configuration? | This phase inspected frontend call wiring only | Auth end-to-end verification |
| Is Google OAuth correctly configured in every environment? | `GoogleOAuthProvider` uses an environment client ID, but provider behavior was not runtime-verified | Provider configuration audit |
| Do Solana wallet nonce/signature flows work with target wallets and networks? | Frontend wallet adapter flow is connected, but wallet/provider runtime behavior was not verified | Wallet-auth integration audit |
| Should visible landing `/auth` links be replaced with modal triggers or a real route? | `/auth` is unregistered and currently broken | Landing/auth UX repair |
| Should landing footer `/tokens` links route to a real token explorer page? | `/tokens` is registered but broken per Phase 2A | Route repair |
| Should header notifications use live data instead of `headerNotificationsMockData`? | Current app-shell panel renders mock notifications | Notifications/product audit |
| Should app-shell logout expose error feedback? | Logout awaits the API but lacks user-facing failure handling | Auth UX hardening |
| Should global search render a distinct request error state? | `SearchBar` receives `useGet.error` but only renders hint/loading/empty/results | Search UX hardening |

## 17. Files inspected

- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/pages/index.tsx`
- `client/src/pages/unauthorized/index.tsx`
- `client/src/components/wrapper/PageWrapper.tsx`
- `client/src/components/search/SearchBar.tsx`
- `client/src/components/search/TokenResultItem.tsx`
- `client/src/components/search/PoolResultItem.tsx`
- `client/src/components/search/WalletResultItem.tsx`
- `client/src/components/search/TokenStatsPanel.tsx`
- `client/src/api/main.ts`
- `client/src/hooks/useGet.ts`
- `client/src/contexts/AuthContext.tsx`
- `client/src/contexts/SolanaWalletContext.tsx`
- `client/src/contexts/ThemeContext.tsx`
- `client/src/contexts/LocalizationContext.tsx`
- `client/src/components/auth/AuthGuard.tsx`
- `client/src/components/auth/SignInModal.tsx`
- `client/src/components/auth/GoogleAuthButton.tsx`
- `client/src/components/auth/WalletAuthButton.tsx`
- `client/src/components/auth/WalletActionButton.tsx`
- `client/src/components/auth/SignUpModal.tsx`
- `client/src/components/landing/Navbar.tsx`
- `client/src/components/landing/Hero.tsx`
- `client/src/components/landing/Footer.tsx`
- `client/src/components/landing/FinalCTA.tsx`
- `client/src/components/payment/AuthReminderModal.tsx`
- `client/src/components/common/Toast/ToastContext.tsx`
- `client/src/components/common/Toast/index.ts`
- `client/src/components/ModelStateManager.tsx`
- `client/src/services/notifications/headerNotificationsMock.ts`
- `client/src/components/TokenSearch/TokenSearch.tsx`
- `client/src/components/PoolSearch/PoolSearch.tsx`
