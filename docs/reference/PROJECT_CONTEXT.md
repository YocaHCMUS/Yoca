# Project Context: Yoca

Verified repository snapshot:

- verification date: 2026-06-20
- branch: development/0.4.0
- commit: fc64374f
- latest verified commit date: 2026-06-19

## Project Identity

Yoca is a full-stack TypeScript monorepo for crypto analytics and wallet intelligence. The product combines token analytics, market views, and wallet-level charting for both Solana and EVM wallets.

The repository is organized as npm workspaces with two applications:

- client: React + Vite frontend
- server: Hono API backend + PostgreSQL via Drizzle ORM

The project addresses the difficulty of turning fragmented on-chain transactions, token market data, wallet activity, and external news into information that users can inspect and compare in one interface.

Primary project objectives:

- provide token and market analytics through searchable views and interactive charts
- aggregate wallet balances, portfolios, transfers, swaps, counterparties, and historical performance
- support wallet comparison, wallet audit reports, and AI-assisted wallet analysis
- notify authenticated users about configured token or wallet activity conditions
- support account, watchlist, subscription, and payment workflows around the analytics product
- preserve type safety between the frontend and backend while reducing repeated external API calls through database caching

Target users include crypto traders, token researchers, wallet analysts, and users who need a consolidated view of Solana on-chain activity. EVM wallet support exists in selected data paths, but the current product and wallet tooling are primarily Solana-focused.

## Technology Stack

Frontend stack:

- React 19.1
- TypeScript
- Vite 7.1
- React Router 7
- ECharts via echarts-for-react
- Carbon Design System
- i18next localization
- Solana wallet adapter libraries
- Vitest and Testing Library
- Stripe.js for Stripe checkout
- html2canvas, jsPDF, and xlsx for report/data export

Backend stack:

- Hono 4.10
- Node.js (ESM)
- TypeScript
- PostgreSQL
- Drizzle ORM + drizzle-kit
- Zod 4 validation
- JWT auth through Hono middleware
- Vitest
- Redis client support
- Stripe and Solana payment integrations
- Google Gemini integration for AI-assisted analysis and chat
- Resend and Nodemailer support for email delivery

External data providers:

- Helius for Solana wallet portfolio, history, transfers, and swaps
- Moralis for EVM wallet history and token pricing fallbacks
- CoinGecko for token market data and historical chart data
- Birdeye remains in code as fallback/legacy path for selected flows
- Google Gemini for wallet analysis, summaries, chat, and selected wash-trading analysis
- Stripe for card and bank-based subscription payments
- Solana RPC/Helius RPC for on-chain SOL payment verification
- RSS and configured news sources for news ingestion and wallet/token context

## Monorepo Layout

Top-level layout:

- client: frontend app
- server: backend app
- docs: engineering plans, style guide, AI notes
- specs: spec-driven feature plans and task breakdowns

Client focus directories:

- client/src/pages: route-level pages such as dashboard, market, token, wallet, wallet comparison
- client/src/components/charts: chart components and shared chart UI infrastructure
- client/src/services/chart: typed chart API callers
- client/src/contexts: auth, chart, localization, theme, and wallet providers
- client/src/types: chart and domain response type definitions
- client/src/components/wallet: wallet reports, wallet chat, wallet navigation, and wallet-specific presentation
- client/src/components/payment: Stripe and Solana subscription payment interfaces
- client/src/services/profile and client/src/services/payment: profile, subscription, and payment API access
- client/src/tests and feature-local test files: frontend unit and component tests

Server focus directories:

- server/src/main.ts: app bootstrap, middleware, and route mounting
- server/src/routes: API routes including charts, wallets, users, tokens, balances, transfers
- server/src/services: business logic grouped by domain (wallet, tokens, charts, users, etc.)
- server/src/db: schema, connection, and migration integration
- server/src/util: API adapters (Helius, Moralis, CoinGecko, Birdeye), key rotation, helpers
- server/src/modules/wallet-analysis: normalization, behavioral analysis, persona/risk enrichment, and wallet-analysis routes
- server/src/scripts: operational scripts for alert replay and Helius webhook synchronization/cutover
- server/tests and server/src/tests: backend route and service tests

## Runtime Architecture

The client uses a typed Hono RPC client from client/src/api/main.ts, with AppType imported from server/src/main.ts. This gives compile-time alignment between frontend API calls and backend route contracts.

Client chart requests flow through client/src/services/chart/chartApi.ts. The backend exposes chart routes under /api/charts/* and wallet routes under /api/wallets.

Server middleware stack in server/src/main.ts applies logger globally, and applies CORS plus CSRF protection for /api/* routes. Origins are configured from environment variables in server/src/config/security.ts.

The verified client routes include landing, pricing, market, alerts, profile, token list/detail, wash-trading analysis, historical token data, transaction graph/detail, wallet comparison, and wallet detail pages. Alerts and profile pages are protected by the frontend AuthGuard.

The verified server mounts APIs for users, auth, tokens, search, transactions, balances, transfers, charts, profile, wallets, wallet tags, wallet analysis, alerts, trades, news, token news/volatility, token AI chat, payments, wallet chat, webhooks, and wash-trading analysis.

The architecture follows a request flow of:

1. React page or feature component calls a typed client service.
2. Hono route validates authentication and request data where required.
3. A domain service reads cached PostgreSQL data before requesting an external provider when the flow supports caching.
4. Provider responses are normalized into internal DTOs and persisted when applicable.
5. The route returns JSON consumed by charts, tables, reports, alerts, or AI presentation components.

## Core Backend Domains

Wallet domain:

- server/src/services/wallet/walletData.core.ts and the specialized wallet services coordinate overview, portfolio, transactions, transfers, swaps, analysis, and balance history
- server/src/services/wallet/fetchers/walletDataFetcher.service.ts handles provider pagination and mapping
- server/src/services/wallet/db/walletDataCacher.ts persists wallet cache rows and metadata
- server/src/services/wallet/db/walletDataRetriever.ts reads cache with TTL/window filtering

Chart domain:

- server/src/routes/charts contains all chart endpoints
- routes call chart services or wallet services depending on chart type
- balance route supports both total wallet mode and token-aware dual-series mode

Token domain:

- server/src/services/tokens/token-market-data.ts handles near-real-time market snapshots with TTL and shared in-flight refresh deduplication
- server/src/services/tokens/token-chart.ts and token-history.ts handle cached historical market data retrieval
- token list resolution maps token addresses to CoinGecko ids

Auth domain:

- server/src/routes/users.ts supports password login, Google login, Solana wallet nonce/verify, and Ethereum wallet nonce/verify
- auth token is stored in cookie using JWT (HS256)
- wallet tag APIs are protected through JWT middleware in server/src/routes/walletTags.route.ts

AI chat and wallet-analysis domain:

- /api/chat provides authenticated wallet chat and CRUD operations for saved chat sessions
- wallet chat transforms wallet data into structured context before calling Gemini and supports rich frontend rendering
- /api/wallet-analysis and wallet analysis routes normalize Helius transactions into wallet behavior signals
- wallet analysis combines deterministic metrics with AI-assisted persona, risk, audit, and summary output
- AI results and chat analysis can be cached in PostgreSQL to avoid repeating identical analysis work

Alert domain:

- authenticated users can create, list, update, and delete alerts and alert rules
- alert settings and delivery/history data are persisted in PostgreSQL
- wallet activity ingestion uses Helius webhooks, including managed webhook shard synchronization
- operational scripts support replay, synchronization, cutover verification, and legacy webhook removal

Payment and subscription domain:

- /api/payment supports Stripe subscription flows and on-chain Solana payment verification
- subscription and payment history records are stored in PostgreSQL
- the client provides pricing, checkout, payment status, subscription history, and cancellation interfaces
- Solana verification checks the configured network, recipient, transaction status, and transferred amount

Wash-trading domain:

- /api/v1/wash-trading exposes token analysis, circular-trade, star-topology, volume-anomaly, and AI-assisted analysis endpoints
- the frontend provides token input, analysis results, and visual exploration under /wash-trading
- this area contains both deterministic analysis logic and provider-dependent enrichment

Profile and personalization domain:

- authenticated profile functionality includes identity settings, token and wallet watchlists, labels, linked wallets, and subscription views
- profile data has both API-backed paths and a selectable mock data source; mock-backed screens must not be presented as fully production-backed without verification

News and token context domain:

- server routes provide general news, token-specific news, chart news events, volatility context, and token AI chat
- cached news batches, articles, user sources, and volatility/news results support reuse across requests

## Data and Persistence Model

Drizzle schema and migrations are under server/src/db and server/postgresdb/migrations.

The server uses Postgres through drizzle-orm/postgres-js with SQL logging persisted to server/src/logs/sql via the Storage service.

Wallet analytics rely heavily on cached tables and meta tables for freshness tracking. This DB-first pattern is used to reduce external API calls and improve response stability.

Token market/chart caches use TTL + update thresholds and on-conflict upserts to maintain rolling datasets.

The schema also includes:

- users, authentication accounts, linked wallets, password reset codes, watchlists, and wallet labels
- wallet overview, portfolio, transaction, transfer, swap, identity, balance, PnL, audit, and AI-analysis caches
- alert definitions, rule conditions, webhook mappings, delivery state, and alert history
- subscriptions and payment history
- news batches, articles, user sources, token volatility/news caches, chat sessions, and chat analysis caches

The project uses database metadata rows and time-window coverage fields in several wallet flows to distinguish fresh cached data from ranges that still require provider synchronization.

## Provider Integration Behavior

Helius integration includes retry behavior for HTTP 429 with wait-and-retry policy in server/src/util/util-helius.ts.

Moralis and CoinGecko integrations rely on required API keys from environment variables.

Birdeye integration includes a hard in-process one-request-per-minute rate limiter to stay within free-tier constraints.

API key rotation exists in server/src/util/api-key-manager.ts and supports comma-separated multi-key configuration per provider.

Helius webhooks are used for wallet alert ingestion. The code includes managed webhook shards and a guarded migration path from the legacy HELIUS_WEBHOOK_ID configuration to reduce duplicate events during cutover.

Gemini-dependent features use configured model names and degrade according to each service's error handling when an API key is unavailable. AI output is treated as assisted interpretation of computed/source data rather than an authoritative financial conclusion.

Stripe handles supported off-chain subscription checkout paths. Solana subscription payments use a separate transaction construction and server-side verification flow.

## Important Environment Dependencies

Backend requires environment variables for at least:

- POSTGRES_DB_URL
- JWT_SECRET
- GOOGLE_CLIENT_ID
- CLIENT_LOCAL_DOMAIN, CLIENT_DEV_DOMAIN, CLIENT_PROD_DOMAIN
- COINGECKO_API_BASE_URL, COINGECKO_API_KEY
- HELIUS_API_KEY (and optional HELIUS_API_BASE_URL)
- MORALIS_API_KEY (and optional MORALIS_API_BASE_URL)
- BIRDEYE_API_KEY (if Birdeye paths are used)
- SERVER_PORT (optional, default fallback in code is 4000)
- GEMINI_API_KEY and optional Gemini model overrides for AI-backed features
- STRIPE_SECRET_KEY and Stripe webhook/payment configuration for Stripe flows
- SOLANA_MERCHANT_ADDRESS and SOLANA_NETWORK for server-side Solana payment verification
- HELIUS_WEBHOOK_AUTH_KEY and WEBHOOK_PUBLIC_URL for wallet alert webhooks
- RESEND_API_KEY/RESEND_FROM or SMTP-related settings for configured email delivery
- Redis connection settings where Redis-backed behavior is enabled

Frontend requires at least:

- VITE_CLIENT_API_DOMAIN
- VITE_GOOGLE_CLIENT_ID
- VITE_STRIPE_PUBLISHABLE_KEY for Stripe checkout
- VITE_SOLANA_NETWORK
- VITE_SOLANA_RPC_URL when overriding the network's default RPC
- VITE_SOLANA_MERCHANT_ADDRESS for Solana payments
- VITE_PROFILE_DATA_SOURCE when selecting API-backed instead of mock profile data

## Build, Run, and Test Workflow

Workspace-level scripts from root package.json:

- npm run dev: starts server and client
- npm run build: builds all workspaces
- npm run preview: starts built server and client preview
- npm run db:generate, db:migrate, db:push, db:studio: delegated to server workspace

Server-specific scripts:

- npm run dev -w=server
- npm run build -w=server
- npm run test -w=server

Client-specific scripts:

- npm run dev -w=client
- npm run build -w=client
- npm run test -w=client
- npm run typecheck -w=client

Automated tests exist in client/src, server/src/tests, and server/tests. At the verified snapshot, 26 test/spec files are present and contain approximately 343 describe/it/test declarations. This is a source inventory, not a claim that every test currently passes.

Verified coverage areas include:

- authentication and password reset
- wallet AI analysis and summaries
- alerts, webhook ingestion, settings, and Helius webhook management
- Stripe and Solana payment validation, subscription management, and payment UI
- wallet chat data transformation
- profile subscription UI
- chart interaction and selected wallet/chart components
- Solana network and RPC configuration validation

Before reporting test results, run the current build, typecheck, lint, and test commands and record their exact date, command, pass/fail count, and environment. Do not convert the number of test declarations into a test pass-rate claim.

## TypeScript and Import Conventions

Path aliases:

- server uses @sv/* -> server/src/*
- client uses @/* -> client/src/* and @sv/* -> server/src/*

This enables direct shared typing between client and server, especially for Hono AppType.

## Engineering Conventions

The repository follows a spec-driven style documented in docs/reference/style-guide.md.

Key expectations include category-first organization, single responsibility files, avoidance of magic values, and mandatory matching test coverage for service-level logic.

## Current Project Focus Areas

The wallet cache and historical USD refactor remains documented in docs/wallets/WALLET_CACHE_AND_USD_REFACTOR_PLAN.md.

Current high-priority issues include:

- partial-range cache reuse for wallet history fetches
- reliable detection of already cached transaction windows
- accurate historical USD valuation for token balance history at each time point

Related implementation and testing strategy documents already exist under docs for wallet token balance history and wallet service tests.

The June 2026 repository snapshot also shows active work around:

- completing and refining authenticated wallet chatbot behavior and saved chat sessions
- wallet and token alerts backed by Helius webhooks
- Stripe and Solana subscription/payment flows
- payment and pricing UI polish
- profile/watchlist integration
- wash-trading analysis and AI-assisted interpretation
- test-suite health and QA automation planning

## Known Documentation Drift to Keep in Mind

README still contains legacy startup notes that mention a different backend port in some sections. The runtime fallback in server/src/main.ts is currently port 4000 when SERVER_PORT is not set.

When onboarding new contributors, source-of-truth behavior should be confirmed in code paths rather than relying only on README text.

Additional limitations and status boundaries:

- no production deployment configuration was found in the verified repository snapshot, so deployment topology, hosting provider, production URL, uptime, and operational metrics require manual confirmation
- profile functionality can default to mock data depending on VITE_PROFILE_DATA_SOURCE
- wallet mock mode is available for frontend development and produces deterministic synthetic data rather than provider results
- Birdeye and legacy Helius webhook paths remain in the codebase and should be described as fallback/migration paths, not the sole current architecture
- external-provider availability, API quotas, key configuration, and network selection affect live feature completeness
- AI-generated analysis can be incomplete or probabilistic and must be presented with its supporting wallet metrics and source data
- registered routes and implemented code prove feature presence, but do not by themselves prove production readiness or end-to-end acceptance

## Suggested Use of This Document

Use this file as the onboarding map before editing feature code, then use the targeted documents under docs for detailed implementation plans and acceptance criteria.

For the final report, map this document to common chapters as follows:

- introduction and problem statement: Project Identity
- objectives, users, and use cases: Project Identity and Core Backend Domains
- technology selection: Technology Stack
- system architecture and component design: Monorepo Layout and Runtime Architecture
- database design and data processing: Data and Persistence Model
- external services and integration: Provider Integration Behavior and Important Environment Dependencies
- implementation results: client routes, server APIs, Core Backend Domains, and Current Project Focus Areas
- verification and evaluation: Build, Run, and Test Workflow
- limitations and future work: Known Documentation Drift to Keep in Mind

Evidence still requiring manual collection before submission:

- screenshots of the landing, market, token, wallet, comparison, alerts, profile, wash-trading, pricing, payment, and chat flows
- an architecture diagram based on the verified runtime request flow
- an entity-relationship diagram generated from the current Drizzle schema
- successful build, typecheck, lint, and test output with exact execution dates
- sample API requests/responses with secrets, wallet identifiers, and personal data removed
- deployment environment, production URL, hosting diagram, and database topology if the project is deployed
- measured response-time or cache-effectiveness results if performance claims will appear in the report
- a feature ownership/contribution table if the report requires individual member contributions
