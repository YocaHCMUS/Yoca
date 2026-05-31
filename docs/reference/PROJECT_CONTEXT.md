# Project Context: Yoca

## Project Identity

Yoca is a full-stack TypeScript monorepo for crypto analytics and wallet intelligence. The product combines token analytics, market views, and wallet-level charting for both Solana and EVM wallets.

The repository is organized as npm workspaces with two applications:

- client: React + Vite frontend
- server: Hono API backend + PostgreSQL via Drizzle ORM

## Technology Stack

Frontend stack:

- React 19
- TypeScript
- Vite 7
- React Router
- ECharts via echarts-for-react
- Carbon Design System
- i18next localization
- Solana wallet adapter libraries

Backend stack:

- Hono 4
- Node.js (ESM)
- TypeScript
- PostgreSQL
- Drizzle ORM + drizzle-kit
- Zod validation
- JWT auth through Hono middleware

External data providers:

- Helius for Solana wallet portfolio, history, transfers, and swaps
- Moralis for EVM wallet history and token pricing fallbacks
- CoinGecko for token market data and historical chart data
- Birdeye remains in code as fallback/legacy path for selected flows

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

Server focus directories:

- server/src/main.ts: app bootstrap, middleware, and route mounting
- server/src/routes: API routes including charts, wallets, users, tokens, balances, transfers
- server/src/services: business logic grouped by domain (wallet, tokens, charts, users, etc.)
- server/src/db: schema, connection, and migration integration
- server/src/util: API adapters (Helius, Moralis, CoinGecko, Birdeye), key rotation, helpers

## Runtime Architecture

The client uses a typed Hono RPC client from client/src/api/main.ts, with AppType imported from server/src/main.ts. This gives compile-time alignment between frontend API calls and backend route contracts.

Client chart requests flow through client/src/services/chart/chartApi.ts. The backend exposes chart routes under /api/charts/* and wallet routes under /api/wallets.

Server middleware stack in server/src/main.ts applies logger globally, and applies CORS plus CSRF protection for /api/* routes. Origins are configured from environment variables in server/src/config/security.ts.

## Core Backend Domains

Wallet domain:

- server/src/services/wallet/walletData.service.ts is the central orchestration layer for overview, portfolio, transactions, transfers, swaps, exchange counts, and balance history
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

## Data and Persistence Model

Drizzle schema and migrations are under server/src/db and server/postgresdb/migrations.

The server uses Postgres through drizzle-orm/postgres-js with SQL logging persisted to server/src/logs/sql via the Storage service.

Wallet analytics rely heavily on cached tables and meta tables for freshness tracking. This DB-first pattern is used to reduce external API calls and improve response stability.

Token market/chart caches use TTL + update thresholds and on-conflict upserts to maintain rolling datasets.

## Provider Integration Behavior

Helius integration includes retry behavior for HTTP 429 with wait-and-retry policy in server/src/util/util-helius.ts.

Moralis and CoinGecko integrations rely on required API keys from environment variables.

Birdeye integration includes a hard in-process one-request-per-minute rate limiter to stay within free-tier constraints.

API key rotation exists in server/src/util/api-key-manager.ts and supports comma-separated multi-key configuration per provider.

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

Frontend requires at least:

- VITE_CLIENT_API_DOMAIN
- VITE_GOOGLE_CLIENT_ID

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

Current automated tests are concentrated in server/tests with focus on wallet fetchers, wallet cache reader/writer behavior, token market data service behavior, and selected chart route behavior.

## TypeScript and Import Conventions

Path aliases:

- server uses @sv/* -> server/src/*
- client uses @/* -> client/src/* and @sv/* -> server/src/*

This enables direct shared typing between client and server, especially for Hono AppType.

## Engineering Conventions

The repository follows a spec-driven style documented in docs/style-guide.md.

Key expectations include category-first organization, single responsibility files, avoidance of magic values, and mandatory matching test coverage for service-level logic.

## Current Project Focus Areas

The active wallet refactor and bug-fix effort is documented in docs/WALLET_CACHE_AND_USD_REFACTOR_PLAN.md.

Current high-priority issues include:

- partial-range cache reuse for wallet history fetches
- reliable detection of already cached transaction windows
- accurate historical USD valuation for token balance history at each time point

Related implementation and testing strategy documents already exist under docs for wallet token balance history and wallet service tests.

## Known Documentation Drift to Keep in Mind

README still contains legacy startup notes that mention a different backend port in some sections. The runtime fallback in server/src/main.ts is currently port 4000 when SERVER_PORT is not set.

When onboarding new contributors, source-of-truth behavior should be confirmed in code paths rather than relying only on README text.

## Suggested Use of This Document

Use this file as the onboarding map before editing feature code, then use the targeted docs in docs and specs for detailed implementation plans and acceptance criteria.