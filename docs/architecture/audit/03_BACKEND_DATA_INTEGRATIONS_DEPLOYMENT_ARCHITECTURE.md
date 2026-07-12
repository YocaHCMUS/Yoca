# Yoca Backend, Data, Integration, Asynchronous-Flow, and Deployment Architecture Audit

## 1. Scope

This audit covers the backend and integration architecture as one system, including runtime structure, major data stores, external integrations, async workflows, and deployment boundaries.

In scope:

- Backend route registration and process shape
- Auth, profile, billing, token, wallet, alerts, news, chat, token-AI, wash-trading, and webhook domains
- Primary data stores and cache layers
- External provider and outbound integration boundaries
- Asynchronous flows such as AI usage, caching, webhook sync, and payment processing
- Deployment/runtime entry points and environment-driven configuration
- Route-inactive or legacy backend implementations that still exist in source

Out of scope:

- Frontend UI details already audited elsewhere
- Backend scoring formulas, detection algorithms, and prompt/model internals
- Database schema details beyond architecture-level store classification
- Detailed request/response field inventories
- Payment processor internals, provider internals, detailed CSS, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`, `02C_WALLET_FRONTEND_ARCHITECTURE.md`, `02D_ALERTS_FRONTEND_ARCHITECTURE.md`, `02E_WASH_TRADING_FRONTEND_ARCHITECTURE.md`, `02F_POOL_HISTORICAL_FRONTEND_ARCHITECTURE.md`, and `02G_ACCOUNT_BILLING_FRONTEND_ARCHITECTURE.md`.

## 2. Architecture summary

The backend is a single Node/Hono application with direct route aggregation in `server/src/main.ts`. It is not split into separate backend services in the current source. The application exposes a wide set of API domains for auth, account/profile management, billing, token data, wallet analytics, alerts, news ingestion and summarization, chat, token AI, wash-trading, and webhook handling.

PostgreSQL is the primary persistence layer through Drizzle ORM. The backend also uses in-memory maps for some short-lived flows, an optional Redis-backed cache wrapper for API management helpers, and several provider-facing caches in service code.

The main architectural pattern is:

- route layer in Hono
- domain service layer per feature area
- shared DB and cache layer
- outbound provider integrations for Stripe, Helius, Google AI, RSS/news search, Solana, and email transport

The highest-risk boundaries are the ones that mix backend policy with third-party or configured external systems: Stripe billing, Helius webhook management, news aggregation, AI usage metering, password-reset email transport, and direct provider-backed analytics.

## 3. Active routes and backend entry points

`server/src/main.ts` mounts one application and serves it with `@hono/node-server`. All backend functionality fans in from that process.

| Route prefix or route | Main component | Reachability | Status |
|---|---|---|---|
| `/api/auth` | `server/src/routes/auth.ts` | Active and directly reachable | Active auth/account recovery surface |
| `/api/users` | `server/src/routes/users.ts` | Active and directly reachable | Active user identity / auth-provider surface |
| `/api/profile` | `server/src/routes/profile.ts` | Active and directly reachable | Active account, wallet-link, watchlist, and subscription profile surface |
| `/api/payment` | `server/src/routes/payment.route.ts` | Active and directly reachable | Active Stripe and Solana billing surface |
| `/api/tokens` | `server/src/routes/tokens.ts` | Active and directly reachable | Active token, market, holder, pool, and trade surface |
| `/api/balances` | `server/src/routes/balances.ts` | Active and directly reachable | Active balance domain |
| `/api/transfers` | `server/src/routes/transfers.ts` | Active and directly reachable | Active transfer domain |
| `/api/transactions` | `server/src/routes/transactions.ts` | Active and directly reachable | Active transaction domain |
| `/api/charts` | `server/src/routes/chart.route.ts` | Active and directly reachable | Active chart data surface |
| `/api/wallets` | `server/src/routes/wallets.ts` | Active and directly reachable | Active wallet analytics and AI surface |
| `/api/wallet-analysis` | `server/src/modules/wallet-analysis/routes/walletAnalysis.routes.ts` | Active and directly reachable | Active wallet comparison / analysis module |
| `/api/alerts` | `server/src/routes/alerts.route.ts` | Active and directly reachable | Active alert management and followed-wallet surface |
| `/api/alertsHp` | `server/src/routes/alerts.ts` | Active and directly reachable | Active legacy/alternate alert API surface |
| `/api/news` | `server/src/routes/news.ts` | Active and directly reachable | Active news ingestion/expansion surface |
| `/api/token-news` | `server/src/routes/token-news.ts` | Active and directly reachable | Active token news surface |
| `/api/token-chart-news-events` | `server/src/routes/token-chart-news-events.ts` | Active and directly reachable | Active chart-news surface |
| `/api/token-volatility` | `server/src/routes/token-volatility.ts` | Active and directly reachable | Active volatility signal surface |
| `/api/token-volatility-news` | `server/src/routes/token-volatility-news.ts` | Active and directly reachable | Active volatility-plus-news surface |
| `/api/token-ai-chat` | `server/src/routes/token-ai-chat.ts` | Active and directly reachable | Active token AI chat surface |
| `/api/chat` | `server/src/routes/chat.route.ts` | Active and directly reachable | Active general chat surface |
| `/api/v1/wash-trading` | `server/src/routes/wash-trading.route.ts` | Active and directly reachable | Active wash-trading analysis surface |
| `/webhook` | `server/src/routes/webhook.ts` | Active and directly reachable | Active webhook ingestion surface |

`/` redirects to `/api`, and `/api` returns a small health response. Global middleware includes request logging, request context injection, CORS on `/api/*`, and development-only CSRF.

## 4. Main render architecture

### Backend application shape

```text
Node process
└─ Hono app
   ├─ global middleware
   │  ├─ logger
   │  ├─ request context
   │  ├─ CORS for /api/*
   │  └─ dev-only CSRF
   ├─ route aggregation in main.ts
   │  ├─ auth / users / profile / payment
   │  ├─ token / wallet / transactions / charts / balances / transfers
   │  ├─ alerts / news / token news / volatility / chat
   │  └─ wash-trading / webhook
   └─ server bootstrap via @hono/node-server
```

### Major backend blocks

- Runtime bootstrap and middleware
- Auth and account recovery
- Profile, watchlist, wallet linking, and subscription management
- Payment and billing
- Token, pool, market, holder, and chart data
- Wallet analytics and wallet AI
- Alerts and followed-wallet management
- News ingestion, expansion, chart-news, and volatility-news synthesis
- Chat and token AI chat
- Wash-trading analysis and wash-trading chat
- Webhook ingestion and Helius webhook management

## 5. Major backend capabilities

| ID | Capability | Main components | Classification | Major limitation |
|---|---|---|---|---|
| `BACK-01` | Backend route shell and process bootstrap | `main.ts`, `@hono/node-server` | `ACTIVE` | Single-process backend with route fan-in rather than separated backend services. |
| `BACK-02` | Auth and account recovery | `auth.ts`, `users.ts`, password-reset email service | `ACTIVE_WITH_LIMITATIONS` | Password reset is active, but email delivery depends on environment-configured SMTP. |
| `BACK-03` | Profile, wallet-link, watchlist, and subscription profile domain | `profile.ts`, watchlist services, linked-wallet services, subscription service | `ACTIVE` | Multiple account concerns share one profile domain and are coupled through the authenticated user record. |
| `BACK-04` | Billing and payment processing | `payment.route.ts`, Stripe service, subscription service, payment tables | `ACTIVE_WITH_LIMITATIONS` | Billing is active but depends on Stripe configuration and post-payment sync/backfill flows. |
| `BACK-05` | Token, pool, market, holder, and chart data | `tokens.ts`, token services, chart routes | `ACTIVE` | Data is pulled through several provider-backed service paths and DB caches. |
| `BACK-06` | Wallet analytics and wallet AI | `wallets.ts`, wallet-analysis module, wallet AI services | `ACTIVE` | Wallet analysis spans several request types and caches, with request-time provider fallbacks. |
| `BACK-07` | Alerts and followed-wallet management | `alerts.route.ts`, alert rules, followed-wallet services, webhook sync | `ACTIVE_WITH_LIMITATIONS` | Alerts are active, but webhook sync and delivery settings are coupled to external webhook state. |
| `BACK-08` | News ingestion and expansion | `news.ts`, `token-news.ts`, RSS/news services | `ACTIVE` | News availability depends on configured feed/search sources and cached fetch pipelines. |
| `BACK-09` | Chart-news and volatility-news synthesis | `token-chart-news-events.ts`, `token-volatility-news.ts`, summarization services | `ACTIVE_WITH_LIMITATIONS` | These flows mix cache, provider search, and optional AI summarization. |
| `BACK-10` | Chat and token AI chat | `chat.route.ts`, `token-ai-chat.ts`, chat/token AI services | `ACTIVE_WITH_LIMITATIONS` | Chat is active, but it is quota-gated, rate-limited, and context-dependent. |
| `BACK-11` | Wash-trading analysis and wash chat | `wash-trading.route.ts`, wash-trading services | `ACTIVE_WITH_LIMITATIONS` | Wash-trading is active, but the route mixes legacy static endpoints, AI analysis, and chat in one domain. |
| `BACK-12` | Webhook ingestion and Helius webhook management | `webhook.ts`, `heliusWebhooks.service.ts` | `ACTIVE_WITH_LIMITATIONS` | The webhook system is active but requires managed shard state and environment-backed cutover checks. |
| `BACK-13` | Shared cache and API management helper layer | `api-manager.service.ts`, cache wrappers | `ACTIVE_WITH_LIMITATIONS` | Present in source, but not confirmed as the primary wiring for every public route. |
| `BACK-14` | Legacy or alternate alert API surface | `routes/alerts.ts` | `ACTIVE_WITH_LIMITATIONS` | This is active backend code, but it sits alongside the primary alerts route and suggests a split API surface. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `ACTIVE` | 4 |
| `ACTIVE_WITH_LIMITATIONS` | 10 |
| `BROKEN` | 0 |
| `ROUTE_INACTIVE` | 0 |
| `NOT_IMPLEMENTED` | 0 |
| `UNCERTAIN` | 0 |
| **Total major backend capabilities** | 14 |

## 6. Data stores and persistence boundaries

### Primary persistence

PostgreSQL is the primary database, accessed through Drizzle ORM.

Major store groups visible in source include:

- user and auth tables
- profile, linked-wallet, watchlist, and wallet-label tables
- subscriptions and payment history tables
- token metadata, token market, pool, holder, volatility, and news-cache tables
- wallet overview, wallet history, wallet analysis, and wallet cache tables
- alert rules, followed wallets, and Helius webhook registry tables
- chat/session/cache tables for AI and general chat

### Secondary and transient stores

- In-memory maps exist for short-lived challenge tokens, password-reset codes, and temporary caches.
- Redis is available through the API-manager cache wrapper when configured, with in-memory fallback when not.
- File storage helpers exist for local text/JSON persistence, but they are supporting utilities rather than the primary backend store.

### Persistence boundary summary

| Store type | Role | Status |
|---|---|---|
| PostgreSQL via Drizzle | System-of-record for users, billing, wallet, token, alert, and cache tables | Active |
| In-memory maps | Short-lived challenge, rate-limit, and cache-like state | Active with limitations |
| Redis | Optional cache backend for API management helpers | Active with limitations |
| Local filesystem helper | Supporting text/JSON persistence | Active with limitations |

## 7. External integrations and outbound boundaries

| Integration boundary | Main server components | Purpose | Status |
|---|---|---|---|
| Stripe | `payment.route.ts`, `stripe.service.ts`, `subscription.service.ts`, `stripe-webhook.ts` | Billing, setup intents, subscription activation, upgrade/cancel, webhook reconciliation | Active |
| Helius | `wallet` services, `transactions.ts`, `heliusWebhooks.service.ts`, `wash-trading` services, `webhook.ts` | Wallet analytics, transaction fetches, webhook management, wash-trading analysis, and webhook ingestion | Active |
| Google AI / Gemini | Token AI, wallet AI, wash-trading AI, chart-news summaries, volatility summaries, chat orchestrator | AI summary and analysis generation | Active |
| RSS/news sources and Brave-backed search fallbacks | `rss-news.service.ts`, news/token-news/volatility routes | News ingestion, matching, and expansion | Active |
| Nodemailer over SMTP | `password-reset-email.service.ts` | Password reset email delivery | Active |
| Discord webhook delivery | alert services | Alert delivery configuration and dispatch | Active |
| Solana kit / Solana signing | auth/profile wallet-link flows and Solana payment verification | Wallet linking and Solana payment verification | Active |
| Solana payment verification flow | payment route and Solana payment service | Non-Stripe payment verification path | Active with limitations |

The backend also contains provider-adapter code for broader API management, but the active public route surface directly confirms the integrations above more strongly than any unused adapter scaffolding.

## 8. Asynchronous-flow architecture

### AI usage and quota reservation

The token AI, wallet AI, wash-trading AI, chart-news summaries, volatility summaries, and general chat flows reserve AI usage before computing a result. When a request fails after reservation, the service layer attempts to release usage. This creates a consistent quota boundary across AI features.

### Caching and stale-data control

The backend uses a mix of DB-backed caches, in-memory caches, and optional Redis-backed caching. Cached flows include token AI chat, wallet analysis and identity, wallet history/portfolio helpers, token chart-news, token volatility-news, and multiple wallet/provider history services. Several of these flows explicitly allow stale-cache fallback instead of hard failure.

### Webhook and sync flows

Alert mutations trigger Helius webhook shard synchronization. The webhook system also exposes verification and diagnostics helpers so the backend can check whether managed webhooks match watched addresses.

### Payment lifecycle

Stripe subscription creation and upgrades are multi-step. The flow includes setup intent creation, payment-method confirmation, subscription activation, invoice recording, webhook reconciliation, and payment-history backfill/repair.

### News and summarization

News routes combine RSS ingestion, search fallback, event grouping, and optional AI summarization. Some routes cache the raw grouped data first and add summaries only when requested.

### Password recovery

Password reset is a backend email workflow: the auth route creates a reset request, the password-reset service sends a code email via SMTP if configured, and the reset route validates the code.

## 9. Navigation and action boundaries

The backend itself does not perform browser navigation, but it establishes the route and API boundaries that the frontend uses for destination handoff.

| Source boundary | Destination boundary | Trigger | Status |
|---|---|---|---|
| Profile watchlist APIs | Token and wallet pages | Watchlist add/remove and hydration | Active |
| Wallet-link and wallet-label APIs | Wallet/profile pages | Wallet linking and labeling actions | Active |
| Billing APIs | Pricing and subscription pages | Setup intent, confirm, upgrade, cancel | Active |
| Alerts APIs | Alerts management routes | Followed-wallet and alert-rule management | Active |
| Token AI chat | Token overview AI panel | User submits a token question | Active |
| Wallet AI and chat | Wallet and comparison surfaces | User opens AI analysis or chat | Active |
| Wash-trading routes | Wash-trading analysis page | Token Overview entry or direct route access | Active |
| Webhook routes | Helius and Stripe provider callbacks | Provider push events | Active |

## 10. Active, inactive, and incomplete implementations

| Candidate | Classification | Why it is not or not fully active in the current backend architecture |
|---|---|---|
| Legacy Helius webhook configuration | `ACTIVE_WITH_LIMITATIONS` | The backend still warns about a legacy webhook env path and supports a managed-shard cutover path. |
| Alternate alerts API surface | `ACTIVE_WITH_LIMITATIONS` | `alertsHp` exists alongside the primary alerts route, indicating a split implementation surface. |
| API-manager provider layer | `ACTIVE_WITH_LIMITATIONS` | The helper exists, but the current public routes also use direct service-level provider integrations. |
| File-based storage helper | `ACTIVE_WITH_LIMITATIONS` | Present as supporting infrastructure rather than primary application persistence. |
| Route-inactive backend capability | `ROUTE_INACTIVE` | No separate route-inactive major backend capability was confirmed as the canonical state. |
| Not-implemented backend capability | `NOT_IMPLEMENTED` | No major backend capability in the active route tree was confirmed as wholly absent. |

## 11. Major architectural limitations

- The backend is broad but still monolithic: one Node/Hono process owns many domains, which keeps routing simple but raises coordination and release-coupling risk.
- Several feature areas rely on direct provider integrations with local fallback logic instead of a stronger internal mediation layer.
- AI flows are split across multiple domains with shared quota logic but separate request handlers and caches.
- Billing depends on Stripe state synchronization, invoice backfill, and webhook reconciliation rather than a single synchronous source of truth.
- Alerts depend on Helius webhook shard health and environment-driven cutover settings, so webhook configuration is a real operational dependency.
- News and market-related features blend live provider fetches, cache reuse, and optional AI summarization, which improves resilience but complicates failure semantics.
- Password reset depends on SMTP configuration; if SMTP is absent, the backend can accept the request but skip email delivery.

## 12. Backend verification requirements

Later backend or integration verification should focus on:

1. Whether the monolithic Hono backend should remain a single process or be split by domain.
2. Whether Redis should become a mandatory cache dependency for the API-manager path or remain optional.
3. Whether the alternate alerts API surface should remain alongside the primary alerts route.
4. Whether billing should keep its current Stripe sync, webhook, and backfill model or move to a tighter activation contract.
5. Whether AI quota reservation and release should be unified further across token, wallet, wash-trading, news, and chat domains.
6. Whether password reset should surface a clearer frontend/API distinction when SMTP is not configured.
7. Whether Helius webhook shard cutover should be automated more aggressively or continue as a controlled operational step.

## 13. Files inspected

- `server/src/main.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/users.ts`
- `server/src/routes/profile.ts`
- `server/src/routes/payment.route.ts`
- `server/src/routes/stripe-webhook.ts`
- `server/src/routes/tokens.ts`
- `server/src/routes/wallets.ts`
- `server/src/modules/wallet-analysis/routes/walletAnalysis.routes.ts`
- `server/src/routes/alerts.route.ts`
- `server/src/routes/alerts.ts`
- `server/src/routes/news.ts`
- `server/src/routes/token-news.ts`
- `server/src/routes/token-chart-news-events.ts`
- `server/src/routes/token-volatility.ts`
- `server/src/routes/token-volatility-news.ts`
- `server/src/routes/chat.route.ts`
- `server/src/routes/token-ai-chat.ts`
- `server/src/routes/wash-trading.route.ts`
- `server/src/routes/webhook.ts`
- `server/src/services/password-reset-email.service.ts`
- `server/src/services/stripe.service.ts`
- `server/src/services/subscription.service.ts`
- `server/src/services/heliusWebhooks.service.ts`
- `server/src/services/api-manager/api-manager.service.ts`
- `server/src/services/api-manager/internal/cache.ts`
- `server/src/services/api-manager/internal/redis.ts`
- `server/src/db/index.ts`
- `server/src/db/schema.ts`
- `server/src/db/users.ts`
- `server/src/db/payment.ts`
- `server/src/db/wallets.ts`
- `server/src/services/rss-news.service.ts`
- `server/src/services/wallet/walletAiSummary.service.ts`
- `server/src/services/wallet/walletAiSwapSummary.service.ts`
- `server/src/services/wallet/walletAnalysis.service.ts`
- `server/src/services/tokens/token-ai-chat.service.ts`
- `server/src/services/tokens/token-chart-news-summary.ts`
- `server/src/services/tokens/token-volatility-summary.ts`
- `server/src/services/wash-trading-ai.service.ts`
- `server/src/services/wash-trading-chat.service.ts`
- `server/src/util/util-helius.ts`
- `server/src/util/api-key-manager.ts`
- `server/package.json`
