# Wallet Birdeye Redundancy Refactor Plan

Date: 2026-03-21
Owner: Wallet Backend
Scope: Reduce duplication across wallet provider fetchers, chart pipelines, and route request handling while preserving existing API behavior.

## Objectives
- Remove repeated provider request/pagination logic.
- Centralize shared mapping/normalization helpers.
- Reduce chunk/non-chunk logic duplication for balance and PnL series.
- Introduce provider strategy controls (Helius/Birdeye) without risky behavior changes.

## Current Redundancy Map
- Provider request handling duplicated in wallet fetchers (status checks, json parsing, error logging).
- Normalization helpers duplicated across wallet fetchers and wallet service (number/date/token normalization).
- Chart logic duplicated between chunk and non-chunk paths (balance and cumulative PnL).
- Route-level query/cursor parsing duplicated between chart route handlers.

## Refactor Workstreams

### 1. Provider Client Consolidation
- Add provider client modules:
  - `server/src/services/wallet/providers/helius.client.ts`
  - `server/src/services/wallet/providers/birdeye.client.ts`
- Extract common request wrapper:
  - Standardized method/url/headers/body execution.
  - Unified non-2xx handling and telemetry payload.
  - Typed `ProviderRequestError` for upstream error decisions.

Deliverables:
- Shared request helper and provider-specific wrappers.
- Existing fetchers migrated with no response-shape changes.

### 2. Mapper/Normalizer Consolidation
- Add mapper utility module:
  - `server/src/services/wallet/fetchers/walletProviderMappers.ts`
- Move helpers:
  - numeric conversion (`toFiniteNumber`, `toOptionalNumber`)
  - timestamp conversion (`toIsoTimestamp`)
  - token amount normalization (`toTokenAmount`)
  - token logo field normalization.

Deliverables:
- Single import point for common mapping helpers.
- Existing fetcher implementations slimmed to provider-specific mapping only.

### 3. Pagination Strategy Unification
- Add reusable paginator utilities:
  - `runOffsetPagination` for Birdeye offset+limit.
  - `runCursorPagination` for Helius/Moralis cursor-style pages.
- Keep stop conditions configurable:
  - max pages/items
  - stagnant pages
  - empty page stop
  - known-signature stop

Deliverables:
- Pagination behavior parity with existing production behavior.
- Reduced per-function pagination boilerplate.

### 4. Chart Pipeline De-duplication
- Refactor wallet balance and PnL generation paths:
  - Make non-chunk APIs delegate to chunk core with full-window options.
  - Keep public function signatures unchanged.
- Candidate targets:
  - `getWalletBalanceHistory` + `getWalletBalanceHistoryChunk`
  - `getCumulativePnL` + `getCumulativePnLChunk`

Deliverables:
- Single authoritative path per chart family.
- Lower divergence risk between chunk and non-chunk behavior.

### 5. Provider Strategy Wiring (Feature-Flagged)
- Add provider policy env controls:
  - `WALLET_PORTFOLIO_PROVIDER=helius|birdeye|fallback`
  - `WALLET_BALANCE_PROVIDER=helius|birdeye|fallback`
  - `WALLET_PNL_PROVIDER=helius|birdeye|fallback`
- Start with shadow mode:
  - Keep current response source unchanged.
  - Log side-by-side provider deltas for confidence building.

Deliverables:
- Safe progressive rollout path.
- Comparable telemetry for provider quality and drift.

## Rollout Plan

### Phase 1: Internal Refactor (No Behavior Change)
- Implement client/mapper/paginator shared modules.
- Migrate existing functions with identical response shapes.
- Validate with unit tests and route smoke tests.

### Phase 2: Chart Logic Unification
- Consolidate chunk/non-chunk implementation paths.
- Add parity tests to verify same output across old/new paths.

### Phase 3: Provider Strategy Flags
- Introduce provider toggles with default current behavior.
- Add shadow-comparison logging.

### Phase 4: Controlled Enablement
- Enable Birdeye per endpoint class in non-prod.
- Promote to production after error/latency/data parity thresholds pass.

## Testing Plan
- Unit tests:
  - mapper edge cases (nulls, malformed timestamps, raw balances)
  - pagination termination behavior.
- Integration tests:
  - provider wrapper non-2xx handling
  - route output contract stability.
- Regression tests:
  - balance/pnl chart parity for chunk and non-chunk calls.

## Success Criteria
- 30-40% reduction in duplicate lines in fetcher/service chart paths.
- No response contract drift in existing public routes.
- No increase in 5xx rate for wallet APIs during rollout.
- Verified provider parity for selected wallet fixtures.

## Risks and Mitigations
- Risk: subtle pagination behavior drift.
  - Mitigation: snapshot tests for stop conditions and cursors.
- Risk: provider data shape drift.
  - Mitigation: typed guard + defensive mapping + route-level fallback.
- Risk: rollout regressions.
  - Mitigation: feature flags + shadow mode + staged enablement.
