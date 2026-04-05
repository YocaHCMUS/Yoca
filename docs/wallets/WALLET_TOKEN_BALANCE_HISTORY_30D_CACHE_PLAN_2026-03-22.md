# Wallet Token Balance History 30D Cache Plan (2026-03-22)

## Scope
Update `getWalletTokenBalanceHistory` to a strict snapshot-only architecture with fixed 30-day behavior and deterministic output shape.

Goals:
- Always use a 30-day period (no time-period variability).
- Always return exactly 31 points per series:
  - 30 historical day-start points (`00:00:00` UTC)
  - 1 current-time live point (`now`)
- Apply cache semantics consistent with prior balance-history plan:
  - Historical points persisted in DB
  - Current-time point cached in memory only
- Remove all remaining transaction-based reconstruction artifacts from token balance history flow.

## Required Behavior Contract

### 1) Fixed Window
`getWalletTokenBalanceHistory(address, tokenSelector)` must always compute for 30 days.

Window semantics:
- Historical coverage: `D-30` through `D-1` at UTC day start.
- Live coverage: one point at current wall-clock time (`now`).

### 2) Exact Point Count
For both `tokenSeries` and `usdSeries`:
- Exactly 31 points.
- First 30 points are daily day-start timestamps.
- Last point is a live intraday timestamp (`now`).
- Series sorted ascending by timestamp.

### 3) Cache Semantics
Historical points:
- Stored in database.
- Day-start points only.
- Coverage metadata tracks day-start window only.

Live point:
- Never persisted to DB.
- Cached in memory with short TTL.

## Architecture

## A) Data Sources
- Portfolio token resolution: `getWalletPortfolio` (mint/symbol matching).
- Snapshot fetch: `getBirdeyePortfolioSnapshotCached` / `fetchBirdeyePortfolioSnapshot`.

No transaction-history dependency in this service path.

## B) Caching Layers

### DB cache (historical)
Create token-specific cache table (recommended):
- `wallet_token_balance_history_cache`

Suggested columns:
- `address` (PK part)
- `token_address` (PK part)
- `token_symbol`
- `token_series` (jsonb)
- `usd_series` (jsonb)
- `fetched_at`
- `covered_from_ms` (UTC day-start)
- `covered_to_ms` (UTC day-start, never today-now)

Rationale:
- Existing `wallet_balance_history_cache` is wallet-total and keyed by `(address, timePeriod)`.
- Token balance history requires per-token storage with dual series payload.

### Memory cache (live point)
In-memory map keyed by `address + resolvedMint`:
- stores one live token point and one live USD point
- TTL: short (for example 60 seconds)
- invalidates naturally by TTL

## C) Deterministic Timeline Builder
Implement helpers to guarantee fixed shape:
- Build exact 30 day-start timestamps for historical segment.
- Build exactly one `now` timestamp for live segment.
- Assemble final output as historical(30) + live(1).

## D) Series Construction Rules
Per historical snapshot day:
1. Locate resolved token asset in snapshot.
2. If present:
   - token amount from `balanceRaw / 10^decimals`
   - USD from snapshot `valueUsd` (fallback: `tokenAmount * priceUsd`)
3. If absent or snapshot missing:
   - token = `0`
   - USD = `0`

Per live point:
- Same mapping logic against current-time snapshot.
- Cache in memory only.

## E) No Transaction-Based Artifacts
Remove from token balance history service:
- Unused transaction imports/calls
- Unused historical reconstruction code/comments
- Fallback messages implying transaction reconstruction

Ensure no token-balance path references:
- `getWalletTransactionHelius`
- transaction paging/reconstruction helpers
- token historical chart reconstruction used by old approach

## Implementation Plan

1. Service Contract Cleanup
- Keep function signature as `(address, tokenSelector)`.
- Remove all timePeriod remnants and dead comments.

2. DB Schema + Migration
- Add `wallet_token_balance_history_cache` table.
- Add indexes for `fetched_at` and `(address, token_address)`.

3. DB Retriever/Cacher
- Add retriever helper for fresh cache read.
- Add cacher helper for upsert writes of historical 30 points.
- Store `coveredFromMs` and `coveredToMs` as historical day-start boundaries.

4. Memory Live Cache
- Add in-memory cache for the now point.
- TTL-based reuse for repeated requests.

5. Main Service Flow Refactor
- Resolve token/mint.
- Load historical 30 points from DB if fresh and covering.
- Fetch only missing historical days from snapshot provider.
- Save merged historical points to DB.
- Fetch/reuse live now point from memory cache.
- Return exactly 31 points in both series.

6. Artifact Removal Pass
- Remove stale imports and transaction-era references.
- Remove misleading fallback language.
- Keep logs snapshot-specific.

7. Tests Update
- Update route tests expecting old 3-arg call.
- Add deterministic 31-point assertions.
- Add DB historical cache + memory live cache tests.
- Ensure zero transaction-mock dependency for this service path.

## Testing Checklist

Functional:
- returns exactly 31 points for token and USD series
- first 30 timestamps are UTC day-start points
- final timestamp is current-time point
- ascending order, no duplicates

Cache:
- historical segment read from DB when fresh
- missing historical segment fetched and persisted
- live point never written to DB
- live point reused from memory cache within TTL

Robustness:
- missing token in snapshot => zero point
- snapshot failure on a day => deterministic zero point
- SOL normalization still works (`SOL` and wrapped/native aliases)

## Rollout Order
1. Add DB schema migration.
2. Implement retriever/cacher helpers.
3. Refactor `getWalletTokenBalanceHistory` flow.
4. Remove transaction artifacts.
5. Update and run tests.
6. Enable logging/monitoring and verify in staging.

## Acceptance Criteria
- `getWalletTokenBalanceHistory` is permanently 30-day mode.
- Response series length is always 31 (30 historical + 1 live).
- Historical points are DB-cached at UTC day-start only.
- Current-time point is memory-cached only.
- No transaction-based reconstruction code remains in token balance history path.
