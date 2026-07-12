# Yoca Repository and Runtime Map

## 1. Audit scope

This audit maps repository structure and runtime entry points only. It does not inventory end-user features or enumerate every backend endpoint. All findings below are derived from inspected source files, package manifests, and workflow/config files in the current repository state.

## 2. Repository structure

### Concise tree

```text
.
|- client/
|  |- public/
|  |- src/
|  |  |- api/
|  |  |- components/
|  |  |- config/
|  |  |- contexts/
|  |  |- pages/
|  |  |- services/
|  |  |- styles/
|  |  |- tests/
|  |  `- util/
|  |- package.json
|  |- tsconfig.json
|  `- vite.config.ts
|- docs/
|- n8n/
|- plan/
|- server/
|  |- migrations/manual/
|  |- postgresdb/migrations/
|  |- scripts/
|  |- src/
|  |  |- config/
|  |  |- db/
|  |  |- middlewares/
|  |  |- modules/
|  |  |- routes/
|  |  |- scripts/
|  |  |- services/
|  |  |- tests/
|  |  `- util/
|  |- tests/
|  |- drizzle.config.ts
|  |- package.json
|  `- tsconfig.json
|- package.json
`- package-lock.json
```

| Directory/package | Type | Purpose | Runtime or development-only | Evidence |
|---|---|---|---|---|
| `client` | npm workspace application | React/Vite frontend SPA. Runtime bootstrap lives in `client/src/main.tsx`; routing lives in `client/src/App.tsx`. | Runtime | `client/package.json`, `client/src/main.tsx`, `client/src/App.tsx` |
| `server` | npm workspace application | Hono/Node backend API. Runtime bootstrap lives in `server/src/main.ts`; route groups, services, and DB access live under `server/src`. | Runtime | `server/package.json`, `server/src/main.ts` |
| `client/src` | frontend source root | Contains frontend bootstrap, routes, providers, API clients, services, components, styles, and tests. | Runtime + test/dev | `client/src/main.tsx`, `client/src/App.tsx`, `client/src/api/main.ts`, `client/src/tests/...` |
| `server/src` | backend source root | Contains backend bootstrap, config, middleware, route registration, DB access, services, async helpers, and scripts invoked by package commands. | Runtime + script/test support | `server/src/main.ts`, `server/src/routes/...`, `server/src/db/index.ts`, `server/src/scripts/...` |
| `server/src/db` | shared backend data layer | Defines Drizzle schema and database client used by active services and routes. | Runtime | `server/src/db/index.ts`, `server/src/db/schema.ts` |
| `server/postgresdb/migrations` | generated DB migration output | Drizzle-managed migration output configured by `drizzle.config.ts`. | Development/deployment support | `server/drizzle.config.ts` |
| `server/migrations/manual` | manual SQL migrations | Additional hand-authored SQL migration files outside generated Drizzle output. | Development/deployment support | `server/migrations/manual/*.sql` |
| `server/tests` and `server/src/tests` | backend tests | Vitest test suites for routes and services. | Development-only | `server/package.json`, `server/tests/...`, `server/src/tests/...` |
| `client/src/tests` and `client/src/util/__tests__` | frontend tests | Vitest/browser-style test coverage for client utilities and components. | Development-only | `client/package.json`, `client/src/tests/...`, `client/src/util/__tests__/...` |
| `docs` | repository documentation | Planning, troubleshooting, references, and design notes. Not treated as authoritative runtime evidence in this audit. | Development-only | `docs/...` |
| `plan` | planning notes | Task/refactor plans; not connected to runtime entry points. | Development-only | `plan/...` |
| `n8n` | automation workflow exports | Exported n8n workflow JSON files for wallet analysis and news workflows. Presence alone does not prove active deployment. | Deployment/manual support | `n8n/wallet-activity-analysis.json`, `n8n/news-search-and-filter.json` |
| Root `package.json` | workspace root | Defines npm workspaces, combined scripts, and shared dependencies. | Development + orchestration | `package.json` |

No `.github/workflows`, Docker, Compose, reverse-proxy, or hosting manifest files were found in the repository search performed during this audit. Evidence: repository file search returned `NO_INFRA_FILES_FOUND`.

## 3. Applications and packages

Package manager and workspace structure are defined at the root as npm workspaces containing `client` and `server`. The root also defines combined scripts for both workspaces. Evidence: `package.json`.

Applications can be started independently via workspace-specific scripts (`client:dev`, `server:dev`) or through root scripts that invoke both workspace commands from the root manifest. Evidence: `package.json`, `client/package.json`, `server/package.json`.

| Application/package | Framework/runtime | Development command | Build command | Production command | Evidence |
|---|---|---|---|---|---|
| Root workspace | npm workspaces orchestrator | `npm run dev` | `npm run build` | `npm run preview` | `package.json` |
| `client` | React 19 + Vite 7 | `npm run dev -w=client` | `npm run build -w=client` | `npm run preview -w=client` | `client/package.json` |
| `server` | Node.js + Hono + `tsx` | `npm run dev -w=server` | `npm run build -w=server` | `npm run start -w=server` | `server/package.json` |

Production build output is separate per workspace: the client builds to `client/build` via Vite and the server builds to `server/build` via TypeScript plus `tsc-alias`. Evidence: `client/vite.config.ts`, `server/package.json`, `server/tsconfig.json`.

The client is compile-time coupled to the server route types: `client/src/api/main.ts` imports `AppType` from `@sv/main.js`, and `client/tsconfig.json` maps `@sv/*` to `../server/src/*`. Evidence: `client/src/api/main.ts`, `client/tsconfig.json`, `server/src/main.ts`.

## 4. Frontend runtime entry point

The confirmed frontend bootstrap is `client/src/main.tsx`, which renders `Root` with `createRoot(...)` and wraps the app in theme, auth, Google OAuth, Solana wallet, localization, watchlist, chart, and toast providers before rendering `App`. Evidence: `client/src/main.tsx`.

Frontend routing is configured in `client/src/App.tsx` using `createBrowserRouter(...)` and rendered through `RouterProvider`. Evidence: `client/src/App.tsx`.

| Frontend responsibility | File | Important symbol/component | Notes |
|---|---|---|---|
| Main bootstrap | `client/src/main.tsx` | `Root`, `createRoot` | Entry point mounted into `#root`; imports global CSS/SCSS files and renders the provider tree. |
| Root application component | `client/src/App.tsx` | `App` | Returns `<RouterProvider router={router} />`. |
| Router configuration | `client/src/App.tsx` | `router`, `createBrowserRouter` | This is the confirmed location of frontend route registration. |
| Root route layout | `client/src/App.tsx` | `RootLayout` | Wraps route outlet and shows Carbon `Loading` during navigation state changes. |
| Reusable page layout | `client/src/components/wrapper/PageWrapper.tsx` | `PageWrapper` | Shared authenticated/app-shell style layout used by multiple routed pages such as wallet, market, profile, alerts, token pages, and wash trading pages. Evidence also from imports in `client/src/pages/...`. |
| API client configuration | `client/src/api/main.ts` | `client`, `hc<AppType>` | Hono RPC client uses `VITE_CLIENT_API_DOMAIN` and sets `credentials: "include"` globally. |
| Authentication provider/context | `client/src/contexts/AuthContext.tsx` | `AuthProvider`, `useAuth`, `refreshUser`, `signOut` | Reads current session from `client.api.users.auth.me` and logs out via `client.api.users.auth.logout`. |
| Solana wallet provider | `client/src/contexts/SolanaWalletContext.tsx` | `SolanaProvider` | Configures `ConnectionProvider`, `WalletProvider`, and `WalletModalProvider` using validated Solana env values. |
| Localization provider | `client/src/contexts/LocalizationContext.tsx` | `LocalizationProvider` | Added in the root provider tree. Evidence: `client/src/main.tsx`. |
| Theme provider | `client/src/contexts/ThemeContext.tsx` | `ThemeProvider` | Added in the root provider tree. Evidence: `client/src/main.tsx`. |
| Additional global state/providers | `client/src/main.tsx` | `WatchlistProvider`, `ChartProvider`, `ToastProvider`, `GoogleOAuthProvider` | These are active global providers in the runtime bootstrap. |
| Global styling entry points | `client/src/main.tsx` | CSS/SCSS imports | Imports `App.css`, `index.scss`, `styles/carbon.scss`, and `styles/theme.scss`; landing page also imports `styles/landing-tailwind.css` from `client/src/pages/index.tsx`. |

## 5. Backend runtime entry point

The confirmed backend bootstrap is `server/src/main.ts`. It loads validated environment variables through `@sv/util/load-env.js`, creates a Hono app, attaches logging and request-context middleware globally, applies CORS and development-only CSRF protection to `/api/*`, registers route groups, and starts the Node server with `serve(...)` on `env.SERVER_PORT`. Evidence: `server/src/main.ts`, `server/src/util/load-env.ts`, `server/src/middlewares/validation.ts`.

There is no global `app.onError(...)` or equivalent top-level error middleware in `server/src/main.ts`; error handling is performed per route/service chain via helpers such as `serverErr(...)` inside route modules. Evidence: `server/src/main.ts`, route files such as `server/src/routes/users.ts`, `server/src/routes/wallets.ts`, `server/src/routes/payment.route.ts`.

| Backend responsibility | File | Important function/symbol | Notes |
|---|---|---|---|
| Environment bootstrap and validation | `server/src/util/load-env.ts` | `env`, `config(...)`, `envSchema.safeParse(...)` | Loads `.env` from server root, workspace root, or current directory, validates, and exits on failure. |
| Main server bootstrap | `server/src/main.ts` | `app`, `serve(...)` | Creates the Hono app and binds `app.fetch` to the Node server. |
| Request logging | `server/src/main.ts` | `logger()` | Applied to `"*"` before route registration. |
| Request context middleware | `server/src/main.ts`, `server/src/middlewares/request-context.ts` | `requestContextMiddleware` | Injects/stores `x-request-id`, route, method, and caller metadata via `AsyncLocalStorage`. |
| API CORS/CSRF middleware | `server/src/main.ts`, `server/src/config/security.ts` | `cors(...)`, `csrf(...)`, `clientDomains` | Applied to `/api/*`; CSRF is only added when `NODE_ENV == "development"`. |
| Health-check route | `server/src/main.ts` | `.get("/api", ...)` | Returns `{ status: "ok" }`. |
| Root redirect | `server/src/main.ts` | `.get("/", ...)` | Redirects `/` to `/api`. |
| Route-group registration | `server/src/main.ts` | `.route(...)` chain | Mounts all API routers and webhook handlers. |
| Authentication middleware | `server/src/middlewares/validation.ts`, `server/src/middlewares/user-extract.ts` | `honoJwt`, `userExtract` | Applied per protected route, not globally. |
| Chart route aggregation | `server/src/routes/chart.route.ts` | `app.route("/balance", ...)` etc. | Confirms `/api/charts/*` hierarchy. |
| Wallet route aggregation | `server/src/routes/wallets.ts` | `app.route("/analysis", ...)`, `app.route("/tags", ...)` | Confirms `/api/wallets/*` hierarchy plus protected AI and identity endpoints. |
| Chat route aggregation | `server/src/routes/chat.route.ts` | `chatRoute`, `toolDataRoutes`, `sessionRoutes`, `promptRoutes` | Confirms `/api/chat`, `/api/chat/tool-data`, `/api/chat/sessions`, and `/api/chat/prompts`. |
| Payment route registration | `server/src/main.ts`, `server/src/routes/payment.route.ts` | `.route("/api/payment", payment)` | Payment routes are active under `/api/payment/*`. |
| Helius webhook registration | `server/src/main.ts`, `server/src/routes/webhook.ts` | `.route("/webhook", webhook)` | Registers live webhook ingestion and development replay endpoints. |
| Startup-time logic | `server/src/main.ts`, `server/src/services/heliusWebhooks.service.ts` | `warnIfLegacyHeliusWebhookConfigured()` | Confirmed startup warning/check runs before app creation. |
| Static file handling | `server/src/main.ts` | None found | No static middleware or frontend asset serving was confirmed in the backend bootstrap. |
| Server port configuration | `server/src/main.ts`, `server/src/middlewares/validation.ts` | `env.SERVER_PORT`, `SERVER_PORT` | Server port is validated in env schema and passed to `serve(...)`. |

### Confirmed route-prefix hierarchy

- Server
  - `/`
    - redirect to `/api`
  - `/api`
    - health check returning `{ status: "ok" }`
  - `/api/users`
    - `/auth/password/register`
    - `/auth/password/login`
    - `/auth/google`
    - `/auth/solana/nounce`
    - `/auth/solana/verify`
    - `/auth/logout`
    - `/auth/me`
  - `/api/auth`
    - `/forgot-password`
    - `/reset-password`
  - `/api/balances`
  - `/api/charts`
    - `/balance`
    - `/distribution`
    - `/pnl`
    - `/transactions`
    - `/dailyTradingVolume`
    - `/tradingVolumeDistribution`
    - `/tradingVolumePerTransaction`
    - `/rollingAnnualReturn`
    - `/drawdown`
    - `/totalTradingVolume`
    - `/stablecoinRatio`
  - `/api/wallets`
    - `/analysis`
    - `/tags`
    - `/overview`
    - `/portfolio`
    - `/swap`
    - `/swaps/history/:address`
    - `/transfers/history/:address`
    - `/transfers`
    - `/distribution`
    - `/identity`
    - `/identity/batch`
    - `/ai-analysis`
    - `/ai-swap-summary`
    - `/ai-swap-summary/token`
    - `/intelligence`
    - `/first-funds/:address`
    - `/:address/tokens`
    - `/:address/audit`
    - `/day-activity`
    - `/tx-instructions`
    - `/token-price-chart`
  - `/api/wallet-analysis`
    - `/analyze`
  - `/api/alerts`
    - `/rules`
    - `/diagnostics`
    - `/settings`
    - `/`
  - `/api/chat`
    - `/`
    - `/usage`
    - `/tool-data/resolve`
    - `/sessions`
    - `/prompts`
  - `/api/news`
    - `/articles/:contentHash/expand`
    - `/webhook`
  - `/api/payment`
    - `/setup-intent`
    - `/activate-subscription`
    - `/confirm`
    - `/cancel`
    - `/upgrade-preview`
    - `/upgrade`
    - `/verify-solana`
  - `/api/v1/wash-trading`
  - `/webhook`
    - `/`
    - `/replay`

Evidence: `server/src/main.ts`, `server/src/routes/chart.route.ts`, `server/src/routes/users.ts`, `server/src/routes/auth.ts`, `server/src/routes/wallets.ts`, `server/src/routes/alerts.route.ts`, `server/src/routes/chat.route.ts`, `server/src/routes/payment.route.ts`, `server/src/routes/news.ts`, `server/src/routes/webhook.ts`, `server/src/modules/wallet-analysis/routes/walletAnalysis.routes.ts`.

## 6. Frontend-to-backend communication

The primary frontend/backend contract uses Hono RPC typing. The client imports the backend `AppType` directly from the server source tree and initializes a typed Hono client with credentials enabled. Evidence: `client/src/api/main.ts`, `client/tsconfig.json`, `server/src/main.ts`.

There is no active Vite development proxy configuration; the proxy block is present but commented out. Evidence: `client/vite.config.ts`.

| Communication concern | Implementation file | Behavior | Environment variable |
|---|---|---|---|
| Typed API base URL | `client/src/api/main.ts` | Builds the Hono client with `import.meta.env.VITE_CLIENT_API_DOMAIN || ""`. Empty string means relative-origin calls in the browser. | `VITE_CLIENT_API_DOMAIN` |
| Shared frontend/backend route typing | `client/src/api/main.ts`, `client/tsconfig.json` | Imports `AppType` from server source via `@sv/*` alias so frontend Hono RPC paths are compiled against backend route types. | None |
| Cookie-based auth on typed client | `client/src/api/main.ts` | Sets `init: { credentials: "include" }` for all Hono client requests. | None |
| Session discovery and logout | `client/src/contexts/AuthContext.tsx` | Calls `client.api.users.auth.me.$get()` to load session state and `client.api.users.auth.logout.$delete()` to clear it. | None |
| Server-side auth cookie issuance | `server/src/routes/users.ts`, `server/src/config/constants.ts` | `setAuthToken(...)` writes the `auth_token` cookie as `secure`, `httpOnly`, and `sameSite: "None"`. | None |
| Generic API error handling | `client/src/services/chart/chartApi.ts`, `client/src/services/wallet/walletApi.ts` | Parses JSON error bodies and converts non-OK responses into thrown errors; wallet AI calls preserve server error codes and usage metadata. | None |
| Payment verification calls | `client/src/services/payment/solanaPaymentApi.ts` | Uses raw `fetch` to `.../api/payment/verify-solana`, includes credentials, parses non-JSON responses safely, and falls back to `window.location.origin` if API env vars are absent. | `VITE_CLIENT_API_DOMAIN`, `VITE_API_DOMAIN` |
| Wallet-analysis proxy calls | `client/src/services/api/walletAnalysis.tsx` | Uses raw `fetch` to `.../api/wallet-analysis/analyze`. | `VITE_CLIENT_API_DOMAIN` |
| Dev proxy behavior | `client/vite.config.ts` | `server.proxy` block exists but is commented out, so no active proxy is confirmed. | None |

## 7. Data-layer entry points

The confirmed primary data layer is PostgreSQL accessed through Drizzle ORM. The live database client is created in `server/src/db/index.ts` using `postgres(process.env.POSTGRES_DB_URL!)`, and the runtime schema is imported from `server/src/db/schema.ts`. Evidence: `server/src/db/index.ts`, `server/src/db/schema.ts`, `server/src/middlewares/validation.ts`.

| Data component | Technology | Configuration/entry file | Schema location | Confirmed runtime usage |
|---|---|---|---|---|
| Primary application database | PostgreSQL + Drizzle ORM + `postgres` | `server/src/db/index.ts` | `server/src/db/schema.ts` plus re-exported modules `server/src/db/alerts.ts`, `server/src/db/users.ts`, `server/src/db/payment.ts`, `server/src/db/wallets.ts`, `server/src/db/meta.ts` | CONFIRMED: imported by active routes/services such as `server/src/routes/payment.route.ts`, `server/src/routes/wallets.ts`, `server/src/services/ai-usage.service.ts`, `server/src/services/heliusWebhooks.service.ts` |
| Migration tooling | Drizzle Kit | `server/drizzle.config.ts`, `server/drizzle-empty.config.ts` | `server/src/db/schema.ts`, `server/src/db/empty-schema.ts` | Development-only: used by package scripts `db:generate`, `db:migrate`, `db:push`, `db:clear`, `db:reset` in `server/package.json` |
| Generated migrations | SQL migrations | `server/postgresdb/migrations` | N/A | Development/deployment support only; no direct runtime import from `server/src/main.ts` |
| Manual migrations | SQL migrations | `server/migrations/manual` | N/A | Development/deployment support only; no direct runtime import from `server/src/main.ts` |
| Cache wrapper | Redis client wrapper with in-memory fallback | `server/src/services/api-manager/internal/redis.ts`, `server/src/services/api-manager/internal/cache.ts` | N/A | UNCERTAIN: Redis wrapper exists and defaults to `REDIS_URL`, but no active import chain from the inspected runtime entry files was confirmed during this audit |
| Local file storage helper | Node filesystem helper | `server/src/services/storage.ts` | N/A | Not confirmed in runtime: only a commented import reference was found in `server/src/db/index.ts` |

## 8. Background and event entry points

| Candidate asynchronous component | Entry file | Trigger type | Started by main runtime? | Needs deeper audit |
|---|---|---|---|---|
| Helius webhook ingestion | `server/src/routes/webhook.ts` | Inbound HTTP webhook `POST /webhook` | Yes | Yes |
| Helius webhook replay endpoint | `server/src/routes/webhook.ts` | Inbound HTTP endpoint `POST /webhook/replay` gated to non-production | Yes | Yes |
| Managed Helius shard synchronization | `server/src/services/heliusWebhooks.service.ts`, `server/src/routes/alerts.route.ts`, `server/src/scripts/sync-helius-webhook-shards.ts` | Triggered by alert mutations and standalone script commands | Yes, but only on route/script trigger | Yes |
| Wallet AI analysis external workflow call | `server/src/services/wallet/walletAnalysis.service.ts` | Outbound HTTP request triggered by `/api/wallets/ai-analysis` or ACMS wrapper | Yes | Yes |
| News-fetch pipeline to n8n | `server/src/routes/news.ts`, `server/src/services/news.service.ts` | Outbound HTTP request to `N8N_LATEST_NEWS_URL` triggered by `/api/news/webhook` | Yes | Yes |
| API call tracker flush loop | `server/src/services/tracking/apiCallTracker.exporter.ts`, imported by `server/src/services/tracking/apiCallTracker.service.ts` | Process timer via `setInterval(...).unref()` every 2 seconds | Yes, via active import chain from runtime services/routes | Yes |
| Token alert polling loop | `server/src/services/tokens/token-data-polling.ts` | Process timer via `startTokenPolling()` and `setInterval(...)` | No confirmed start; `server/src/main.ts` shows `// startTokenPolling();` commented out | Yes |
| Stripe webhook handler | `server/src/routes/stripe-webhook.ts` | Inbound HTTP webhook | No confirmed mount in `server/src/main.ts` | Yes |
| Wallet alert webhook replay script | `server/src/scripts/replay-wallet-alert-webhook.ts` | Standalone script command | No, manual/script only | Yes |
| Helius cutover verify/disable scripts | `server/src/scripts/verify-helius-cutover.ts`, `server/src/scripts/disable-legacy-helius.ts` | Standalone script commands | No, manual/script only | Yes |
| n8n workflow exports | `n8n/wallet-activity-analysis.json`, `n8n/news-search-and-filter.json` | External automation runtime/manual import | No confirmed start from this repository | Yes |

## 9. Deployment and infrastructure evidence

| Infrastructure concern | File | Confirmed technology/service | What can be proven |
|---|---|---|---|
| Environment validation | `server/src/util/load-env.ts`, `server/src/middlewares/validation.ts` | `dotenv` + `zod` | Server boot validates required env like `POSTGRES_DB_URL`, `SERVER_PORT`, `CLIENT_PROD_DOMAIN`, `HELIUS_*`, `STRIPE_SECRET_KEY`, and AI flags before startup continues. |
| Health checks | `server/src/main.ts` | Hono JSON endpoint | `/api` returns `{ status: "ok" }`, which is a confirmed health-check route. |
| Request logging and request IDs | `server/src/main.ts`, `server/src/middlewares/request-context.ts` | Hono logger + custom request context | Every request passes through logger middleware and receives/propagates an `x-request-id`. |
| Outbound API call tracking/export | `server/src/config/constants.ts`, `server/src/services/tracking/apiCallTracker.service.ts`, `server/src/services/tracking/apiCallTracker.exporter.ts` | File-based API call log export | A feature-flagged exporter exists and writes JSONL logs under `server/src/logs/api-tracker` when enabled. |
| Database migration management | `server/drizzle.config.ts`, `server/drizzle-empty.config.ts`, `server/postgresdb/migrations`, `server/migrations/manual` | Drizzle Kit + SQL migrations | Repository contains migration tooling and both generated and manual SQL migration directories. |
| Public webhook deployment expectation | `server/src/services/heliusWebhooks.service.ts` | Public HTTP webhook URL for Helius | Managed Helius shard sync requires `WEBHOOK_PUBLIC_URL` or `PUBLIC_WEBHOOK_URL`; the code explicitly rejects missing or localhost-like values for live delivery. |
| External automation workflows | `n8n/wallet-activity-analysis.json`, `n8n/news-search-and-filter.json` | n8n | Workflow export files exist for wallet analysis and news filtering, but deployment/activation is not proven here. |
| Containerization / CI / hosting manifests | Repository search | None found | No Dockerfile, Compose file, `.github/workflows`, Vercel, Netlify, Fly, Railway, Render, Nginx, or Caddy config was found in this audit. |

## 10. Provisional runtime components

| Runtime component | Technology | Entry point | Responsibility | Confidence |
|---|---|---|---|---|
| Frontend SPA | React 19 + Vite | `client/src/main.tsx` -> `client/src/App.tsx` | Browser UI, routing, provider setup, and API client usage | CONFIRMED |
| Backend API server | Hono + Node | `server/src/main.ts` | HTTP API, route registration, middleware, and webhook exposure | CONFIRMED |
| Application database | PostgreSQL + Drizzle ORM | `server/src/db/index.ts` | Persistent storage for users, payments, wallets, alerts, caches, chat, and news data | CONFIRMED |
| Helius webhook ingestion path | Hono route + alert-processing services | `server/src/routes/webhook.ts` | Receives and processes enhanced transaction webhook payloads | CONFIRMED |
| Wallet AI analysis integration | Backend service + outbound webhook/ACMS | `server/src/services/wallet/walletAnalysis.service.ts` | Calls external wallet-analysis workflow and caches normalized results | CONFIRMED |
| News workflow integration | Backend service + outbound HTTP | `server/src/routes/news.ts`, `server/src/services/news.service.ts` | Fetches or refreshes token news through configured external workflow URL | CONFIRMED |
| Managed Helius shard sync service | Backend service + Helius webhook API | `server/src/services/heliusWebhooks.service.ts` | Creates/updates/deletes managed webhook shards for watched addresses | CONFIRMED |
| API call tracker exporter | File-backed periodic exporter | `server/src/services/tracking/apiCallTracker.exporter.ts` | Periodically flushes outbound API call records when enabled | CONFIRMED |
| Redis-backed cache layer | `redis` client wrapper | `server/src/services/api-manager/internal/redis.ts` | Optional cache backend for API manager cache wrapper | UNCERTAIN |
| Token polling loop | Timer-based background poller | `server/src/services/tokens/token-data-polling.ts` | Token alert polling and expiry handling | UNCERTAIN |
| Stripe inbound webhook runtime | Hono route | `server/src/routes/stripe-webhook.ts` | Stripe event ingestion and subscription/payment sync | UNCERTAIN |

## 11. Open questions

| Question | Why it is unresolved | Recommended audit phase |
|---|---|---|
| Does the root `npm run dev` script reliably run client and server concurrently on the target shell/platform? | The root manifest uses `npm run dev -w=server & npm run dev -w=client` in `package.json`, but this audit did not execute it across shells. | Runtime verification / infrastructure audit |
| Which frontend routes are actively reachable and used in production? | Routing is configured in `client/src/App.tsx`, but page-level reachability and auth behavior were not exhaustively exercised in this phase. | Frontend feature/routing audit |
| In deployed environments, does wallet AI analysis use direct webhook mode or ACMS mode? | `server/src/services/wallet/walletAnalysis.service.ts` supports both paths and defers behavior to env/feature flags. | AI integration audit |
| Is the Redis cache wrapper intentionally unused or is it dead/incomplete infrastructure code? | `server/src/services/api-manager/internal/redis.ts` and `cache.ts` exist, but no active import chain was confirmed from inspected runtime entry files. | Data/infrastructure audit |
| Is `server/src/routes/stripe-webhook.ts` mounted by another deployment entry point outside this repository, or is it currently inactive? | The file exists, but `server/src/main.ts` does not mount it. | Payment/infrastructure audit |
| Is token polling intentionally disabled, or should `startTokenPolling()` be re-enabled in the server bootstrap? | `server/src/services/tokens/token-data-polling.ts` defines the loop, but `server/src/main.ts` leaves `startTokenPolling()` commented out. | Alerts/background-jobs audit |
| Do the committed `n8n/*.json` workflow exports exactly match the external workflows pointed to by runtime env vars? | The repository contains workflow exports and code references to n8n-style URLs, but deployment parity was not verified. | External workflow audit |
| Is API call tracking enabled in deployed environments, and if so where are exported logs collected? | The periodic exporter is wired into runtime imports but gated by env flags in `server/src/config/constants.ts`. | Observability/infrastructure audit |

## 12. Files inspected

- `package.json`
- `client/package.json`
- `server/package.json`
- `client/vite.config.ts`
- `client/tsconfig.json`
- `server/tsconfig.json`
- `client/src/main.tsx`
- `client/src/App.tsx`
- `client/src/pages/index.tsx`
- `client/src/api/main.ts`
- `client/src/contexts/AuthContext.tsx`
- `client/src/contexts/SolanaWalletContext.tsx`
- `client/src/util/solanaNetwork.ts`
- `client/src/components/wrapper/PageWrapper.tsx`
- `client/src/services/wallet/walletApi.ts`
- `client/src/services/chart/chartApi.ts`
- `client/src/services/payment/solanaPaymentApi.ts`
- `client/src/services/api/walletAnalysis.tsx`
- `server/src/main.ts`
- `server/src/util/load-env.ts`
- `server/src/middlewares/validation.ts`
- `server/src/middlewares/request-context.ts`
- `server/src/middlewares/user-extract.ts`
- `server/src/config/security.ts`
- `server/src/config/constants.ts`
- `server/src/db/index.ts`
- `server/src/db/schema.ts`
- `server/drizzle.config.ts`
- `server/drizzle-empty.config.ts`
- `server/src/routes/chart.route.ts`
- `server/src/routes/users.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/wallets.ts`
- `server/src/routes/alerts.route.ts`
- `server/src/routes/chat.route.ts`
- `server/src/routes/payment.route.ts`
- `server/src/routes/news.ts`
- `server/src/routes/webhook.ts`
- `server/src/routes/stripe-webhook.ts`
- `server/src/modules/wallet-analysis/routes/walletAnalysis.routes.ts`
- `server/src/services/heliusWebhooks.service.ts`
- `server/src/services/news.service.ts`
- `server/src/services/wallet/walletAnalysis.service.ts`
- `server/src/services/tokens/token-data-polling.ts`
- `server/src/services/api-manager/internal/redis.ts`
- `server/src/services/api-manager/internal/cache.ts`
- `server/src/services/tracking/apiCallTracker.service.ts`
- `server/src/services/tracking/apiCallTracker.exporter.ts`
- `server/src/services/storage.ts`
- `server/src/scripts/sync-helius-webhook-shards.ts`
- `server/src/scripts/replay-wallet-alert-webhook.ts`
- `server/src/scripts/verify-helius-cutover.ts`
- `server/src/scripts/disable-legacy-helius.ts`
- `n8n/wallet-activity-analysis.json`
- `n8n/news-search-and-filter.json`
