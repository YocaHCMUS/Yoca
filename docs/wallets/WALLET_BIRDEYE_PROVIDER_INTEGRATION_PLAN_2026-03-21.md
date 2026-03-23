# Wallet Birdeye Provider Integration Plan (2026-03-21)

## Goal
Integrate Birdeye fetchers into existing wallet services to reduce redundant computation, simplify balance pipelines, and keep provider behavior consistent across overview, portfolio, and chart endpoints.

## Provider Default Decision
- Birdeye is the default provider for the proposed service changes in this plan.
- Helius remains as fallback where needed and as a shadow/parity comparison source during rollout.
- Existing response contracts remain unchanged while provider internals shift to Birdeye-first behavior.

## Scope Summary
- Use `fetchBirdeyePortfolio` in:
  - `getWalletOverview`
  - `getWalletPortfolio`
- Use `fetchBirdeyeOverallPnL` in:
  - `getWalletOverview`
- Update PnL DTOs for stronger typing and clearer implementation context:
  - replace `any` PnL summary/details with explicit Birdeye summary/counts/cashflow/pnl typed objects
- Use `fetchBirdeyeNetworthHistory` to implement streamlined:
  - `getWalletBalanceHistory` (remove transaction-based reconstruction path)
- Use `fetchBirdeyePortfolioSnapshot` for:
  - `getWalletTokenBalanceHistory` by building daily points via repeated snapshot requests with caching
- Remove redundant:
  - `fetchBirdeyeBalanceHistory`
- Update client chart to consume balance-history data produced by the streamlined backend response

## Service-Level Changes

### 1) `getWalletOverview`
File: `server/src/services/wallet/walletData.service.ts`

Plan:
- Update function signature to enum-based options:
  - move from period-seconds input to `timePeriod` enum options (`24H`, `7D`, `30D`, `60D`, `90D`, `1Y`, `All`)
  - normalize legacy query values in route layer to enum values before service call
- Keep current cache check flow (`getLatestOverviewCacheRow` and `getOverviewFromFreshCache`).
- For holdings snapshot:
  - Primary holdings source is `fetchBirdeyePortfolio` by default.
  - Helius is only used as fallback when Birdeye fetch fails or returns unusable data.
  - Continue using existing shape (`totalAssetValueUsd`, `tokensHoldingCount`) for compatibility.
- For PnL:
  - Pull `pnlUsdTotal` from `fetchBirdeyeOverallPnL` by default.
  - Preserve fallback behavior when Birdeye summary is unavailable.
- For activity metrics:
  - Remove transaction-derived overview activity path.
  - Derive activity fields from Birdeye summary payload (`counts`, `cashflow_usd`, `pnl`) for the selected enum period.
  - Keep cache/null fallback behavior when provider data is unavailable.
- Keep logging and persistence behavior (`saveOverviewCache`) unchanged in phase 1.

Acceptance:
- `getWalletOverview` response schema remains unchanged.
- Holdings, PnL, and overview activity are Birdeye-first and source selection is visible in logs.
- No transaction-history fetch path remains in `getWalletOverview`.

### 2) `getWalletPortfolio`
File: `server/src/services/wallet/walletData.service.ts`

Plan:
- Replace implicit helius-first fetch with birdeye-first default source selection:
  - Default path: call `fetchBirdeyePortfolio`.
  - Fallback path: call Helius when Birdeye fails or data is unusable.
  - Optional override path: allow explicit policy/env override for emergency rollback.
- Keep existing DB cache usage and metadata enrichment (`enrichWalletPortfolioMetadata`).
- Keep shadow-mode logging for parity checks during rollout.

Acceptance:
- Portfolio endpoint returns stable response shape.
- Cache writeback still occurs with enriched data.
- Birdeye-first routing and any fallback usage are reflected in logs.

### 3) `getWalletBalanceHistory` and `getWalletBalanceHistoryChunk`
File: `server/src/services/wallet/walletData.service.ts`

Context:
- Both endpoints use a chunk-based fetching pattern to handle computational load.
- `getWalletBalanceHistory` is a convenience wrapper around `getWalletBalanceHistoryChunk`.
- Charts consume chunk requests incrementally to avoid loading entire histories at once.

Plan:
- Replace transaction reconstruction path with `fetchBirdeyeNetworthHistory` as the default data source.
- For `getWalletBalanceHistoryChunk`:
  - Map requested time window (`chunkToSec`, `requestedFromSec`, `requestedToSec`) to Birdeye query params.
  - Query Birdeye for net-worth history covering the requested chunk window.
  - Map Birdeye history rows into existing `BalanceDataPoint[]` contract:
    - `timestamp` (ms)
    - `date` (ISO)
    - `value` (USD net worth)
  - Return chunked series with `ChartChunkInfo` and `ChartChunkState` metadata for cursor/pagination tracking.
- For `getWalletBalanceHistory`:
  - Maintain simplicity: call `getWalletBalanceHistoryChunk` once with full period (or aggregate if needed).
  - Preserve existing response contract.
- Normalize ordering for charting (ascending timeline).
- Handle sparse/no-history by preserving existing fallback semantics.
- With fallback to transaction-based path only when Birdeye is unavailable or returns insufficient coverage.

Acceptance:
- Chunk-based fetching pattern and cursor state management remain intact.
- Charts continue to work with incremental chunk requests.
- Transaction-heavy historical reconstruction is replaced for Birdeye-first path.
- Returned series is chart-ready and chronologically stable.

### 4) `getWalletTokenBalanceHistory`
File: `server/src/services/wallet/walletData.service.ts`

Plan:
- Use `fetchBirdeyePortfolioSnapshot` across daily timestamps in requested period as the default data path.
- For each day:
  - Request snapshot at that day.
  - Resolve selected token by address/symbol rules (preserve SOL aliases).
  - Build both token and USD points.
- Add snapshot caching to reduce excessive provider usage:
  - Key: wallet + day + snapshot type/options.
  - TTL tuned for historical snapshots (longer) vs recent day (shorter).
  - Fetch only missing days.
- Add bounded concurrency to avoid provider throttling.
- Use Helius-based reconstruction only as fail-soft fallback when snapshot coverage is insufficient.

Acceptance:
- Endpoint returns complete day-level series for requested period.
- Repeated requests hit cache and reduce external calls.

### 5) Remove `fetchBirdeyeBalanceHistory`
File: `server/src/services/wallet/fetchers/walletDataFetcher.service.ts`

Plan:
- Remove function implementation and references.
- Replace any usage with direct `fetchBirdeyeNetworthHistory` mapping in service layer.

Acceptance:
- No remaining callsites/imports for `fetchBirdeyeBalanceHistory`.
- Build passes without dead-code references.

## Client Changes

### Wallet Balance Chart Integration
Likely locations:
- `client/src/components/charts/*`
- wallet page data hooks/selectors under `client/src/hooks` or `client/src/pages`

Plan:
- Ensure chart consumes server-provided `BalanceDataPoint[]` directly.
- Remove assumptions tied to transaction-reconstructed cadence.
- Preserve UX for:
  - sparse data
  - single-point fallback
  - loading/error states
- Validate axis formatting and tooltip behavior with Birdeye-produced timestamps.

Acceptance:
- Chart renders correctly for all supported time periods.
- No regression in chart interaction and labels.

## Rollout Strategy

### Phase 1: Service Wiring
- Set Birdeye-first provider behavior for overview/portfolio.
- Introduce Birdeye PnL in overview.
- Keep Helius fallback and shadow logs enabled.

### Phase 2: Balance History Simplification
- Switch `getWalletBalanceHistory` and `getWalletBalanceHistoryChunk` to Birdeye net-worth history path.
- Verify chunk window mapping and time-based query translation to Birdeye params.
- Validate chunk cursor state and pagination metadata remain stable.
- Keep old transaction-based path as fallback for contingency rollback.

### Phase 3: Token Snapshot History + Cache
- Implement daily snapshot assembly with cache + bounded concurrency.

### Phase 4: Cleanup
- Remove `fetchBirdeyeBalanceHistory` and stale code paths.

### Phase 5: Client Alignment
- Update wallet chart consumption and verify timeline rendering.

## Testing Plan

Backend tests:
- Overview:
  - Birdeye holdings + Birdeye PnL mapped correctly.
  - Enum period option mapping and route normalization to service options.
  - Overview no longer depends on transaction-history fetch path.
  - Fallback behavior when Birdeye summary unavailable.
- Portfolio:
  - Birdeye-first routing, fallback behavior, and optional override behavior.
  - Cache + metadata enrichment retained.
- Balance history:
  - Chunk window mapping and Birdeye time-based query translation.
  - Chunk cursor state and pagination metadata stability.
  - Net-worth mapping, ordering, and fallback behavior.
  - Full-period wrapper behavior with chunked calls.
- Token balance history:
  - Daily snapshot assembly.
  - Cache hit/miss behavior and reduced provider calls.
- Cleanup:
  - No references to removed fetcher.

Frontend tests:
- Balance chart renders with new backend timeline data.
- Tooltip/axis format stability across periods.

## Risks and Mitigations
- Risk: Provider data shape drift.
  - Mitigation: Strict mapping guards and null-safe parsing.
- Risk: Snapshot fan-out for token history increases API load.
  - Mitigation: cache + bounded concurrency + fail-soft points.
- Risk: Value parity differences between providers.
  - Mitigation: retain shadow logging during rollout and compare end values.

## Execution Checklist
- [x] Set provider defaults for affected wallet endpoints to Birdeye-first (with explicit rollback override).
- [x] Wire `fetchBirdeyePortfolio` into overview and portfolio provider paths.
- [x] Wire `fetchBirdeyeOverallPnL` into overview mapping.
- [x] Replace PnL `any` DTOs with explicit typed summary/details contracts.
- [x] Move overview period inputs to enum-based `timePeriod` options end-to-end (route + service).
- [x] Refactor `getWalletBalanceHistory` to `fetchBirdeyeNetworthHistory` mapping.
- [x] Update chart data flow in client for streamlined balance series.
- [x] Implement daily `fetchBirdeyePortfolioSnapshot` assembly for token balance history.
- [x] Add snapshot caching and bounded concurrency.
- [x] Remove `fetchBirdeyeBalanceHistory` and all references.
- [x] Add/adjust tests and run full server + client validation.
