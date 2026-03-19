# Wallet Exchange Leaderboard Real Data Plan

## Goal
Replace wallet-page exchange leaderboard mock data with real wallet-specific exchange and DEX activity derived from Moralis-backed swap data, while preserving existing dashboard chart behavior when no wallet context is provided.

## Current State
`/api/charts/exchanges` is currently backed by mock generator output.

`getWalletExchangeCounts` currently returns an empty series placeholder.

Wallet page renders `ExchangeComparison` without wallet-scoped query inputs, so it cannot retrieve wallet-specific exchange activity.

## Target Outcome
Wallet page exchange leaderboard displays real ranked exchange or DEX activity for the selected wallet.

The same chart endpoint supports wallet-aware mode when wallet context is present, and keeps mock fallback for generic dashboard scenarios without wallet context.

## Scope
In scope includes wallet exchange aggregation service implementation, chart route wallet-aware mode, query contract updates, client query wiring, and tests.

Out of scope includes redesign of chart visual style and historical backfill beyond existing supported periods.

## Data Source Strategy
Primary source is swap activity from wallet swap service with Moralis provider preferred when configured.

Fallback source remains Helius when Moralis fails and fallback is enabled by environment flags.

Aggregation key priority per swap event:

`exchange.name` with `exchange.address`.

Fallback to `pair.label` with `pair.address`.

Final fallback to deterministic `Unknown` bucket.

## Exchange Aggregation Rules
Each swap contributes one interaction to its resolved exchange bucket.

Count metrics:

`deposits` maps to buy-side interactions when `bought` leg exists.

`withdrawals` maps to sell-side interactions when `sold` leg exists.

Volume metrics:

`depositsVolume` uses `bought.valueUsd` when available.

`withdrawalsVolume` uses `sold.valueUsd` when available.

If side-level USD values are unavailable, use `totalValueUsd` with a deterministic split policy.

Deduplicate by wallet plus signature plus exchange key to prevent multi-row duplicates from inflating counts.

## Backend Work Plan

### Phase 1: Implement Real Exchange Aggregator
Replace placeholder logic in wallet service exchange endpoint.

Target function:

`getWalletExchangeCounts(address, chain, options)` in wallet data service.

Input options should include period and limit with sensible bounds.

Aggregation should read from cached swaps when fresh and fetch provider gaps when needed.

### Phase 2: Extend Wallet Exchange Endpoint Contract
`GET /api/wallets/exchanges` should return non-empty real data when swap activity exists.

Add metadata fields for source visibility and period normalization.

Keep existing response shape for compatibility with existing consumers.

### Phase 3: Add Wallet-Aware Mode To Charts Exchanges Route
Update `GET /api/charts/exchanges` route contract to support optional wallet context fields.

Add optional query inputs:

`wallets` as comma-separated list.

`address` as single wallet override.

`chain` and `period` for wallet-aware requests.

Behavior:

When wallet context is present, call wallet exchange service and return real data.

When absent, keep current mock data path for backward compatibility.

### Phase 4: OpenAPI And Type Contract Alignment
Update OpenAPI for `/api/charts/exchanges` to include wallet-aware query parameters.

Align client request type `ExchangesRequestParams` with actual route params including `timePeriod`, `wallets`, `address`, and `chain`.

## Frontend Work Plan

### Phase 1: Wallet-Aware Query Inputs In ExchangeComparison
Extend `ExchangeComparison` props to accept wallet context.

Preferred props:

`walletAddress?: string`.

`chain?: string` defaulting to `solana`.

If wallet address exists, send wallet-aware query params to chart exchanges endpoint.

### Phase 2: Wallet Page Integration
On wallet page, pass current wallet address into `ExchangeComparison` so leaderboard is wallet-scoped.

Maintain existing behavior in dashboard page by not passing wallet context.

### Phase 3: Empty And Error States
If no exchange activity exists, show chart empty state instead of mock fallback in wallet-scoped mode.

Errors should preserve page stability and allow retry.

## Testing Plan

### Wallet Service Tests
Add tests for exchange aggregation from swap rows with Moralis fields.

Cover bucket resolution priority and dedupe behavior.

Cover volume fallback logic when side-level USD values are absent.

### Route Tests
Add chart route tests validating wallet-aware and mock fallback branches.

Validate wallet query parsing from `address` and `wallets` inputs.

### Client Tests
Validate wallet page passes wallet context to exchange chart fetch query.

Validate dashboard exchange chart remains unchanged.

## Rollout Sequence
Implement and validate backend exchange aggregation first.

Enable chart route wallet-aware mode with fallback.

Wire wallet page chart with wallet context.

Run regression for dashboard charts and wallet intelligence service that consumes exchange counts.

## Acceptance Criteria
Wallet page exchange leaderboard renders real exchange and DEX activity for selected wallet.

`/api/wallets/exchanges` returns populated data for wallets with swap history.

`/api/charts/exchanges` supports wallet-aware mode and still supports mock fallback for non-wallet usage.

No regression in wallet intelligence analysis inputs that rely on exchange counts.

## Dependencies With Pagination And Counterparty Refactor
This plan depends on stable swap retrieval and cache behavior from the pagination and counterparty plan.

Counterparty inclusion of swaps and exchange leaderboard aggregation should share normalized swap parsing utilities to prevent divergence.
