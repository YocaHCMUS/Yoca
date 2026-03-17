# Balance History and PnL Historical Price Alignment Plan

## Purpose
Align `getWalletBalanceHistory` with the same historical token pricing and enrichment model already used by cumulative PnL computation.

## Scope
- In scope:
  - `server/src/services/wallet/walletData.service.ts`
  - `server/tests/wallet/walletData.tokenBalance.test.ts`
- Out of scope:
  - API contract changes for `GET /api/charts/balance`
  - Frontend chart rendering changes

## Current State Comparison

### What `pnlChart.service.ts` does
`server/src/services/charts/pnlChart.service.ts` is an orchestrator only. It delegates to `getCumulativePnL` and does not perform historical price fetching itself.

### What `getCumulativePnL` does today (reference behavior)
In `walletData.service.ts`, `getCumulativePnL`:
1. Computes explicit request range (`fromSec`, `toSec`).
2. Fetches current portfolio and Helius tx history for that exact range.
3. Collects all token addresses from portfolio plus tx balance changes.
4. Fetches historical chart points per token using:
   - `getHourlyTokenMarketChart` for shorter windows
   - `getDailyTokenMarketChart` for longer windows
5. Builds timestamp-aware timelines and values each snapshot using:
   - nearest prior historical price
   - fallback to current market price
   - fallback to zero
6. Produces deterministic time-series output.

### What `getWalletBalanceHistory` does today
`getWalletBalanceHistory` currently reconstructs history by applying transaction USD deltas valued mostly by current/spot price lookups (`tokenPriceMap` + `getTokenMarketData`).

Resulting mismatch:
- PnL is historical-price aware per timestamp.
- Balance history is predominantly spot-price based and can flatten or distort past values.

## Target Behavior
`getWalletBalanceHistory` should use the same valuation semantics as `getCumulativePnL`:
- Historical price at or before timestamp.
- Fallback to current market price when historical point is missing.
- Fallback to zero when neither exists.
- Range-aware transaction fetching with explicit `fromSec`/`toSec`.

## Implementation Plan

### Phase 1: Consolidate valuation logic in wallet service
Refactor shared internals in `walletData.service.ts` so balance history and PnL can reuse the same pipeline.

Planned internal helper responsibilities:
1. Build snapshot timestamps for requested range.
2. Reconstruct token balances backward from current portfolio using tx `balanceChanges`.
3. Fetch historical token timelines (hourly/daily) and current market fallbacks.
4. Compute total portfolio USD value at each snapshot timestamp.

Expected outcome:
- Single source of truth for historical valuation.
- Reduced drift between balance and PnL logic.

### Phase 2: Refactor `getWalletBalanceHistory`
Replace current spot-priced delta path with snapshot valuation path.

Detailed changes:
1. Use explicit `startMs` and `nowMs` -> `fromSec`/`toSec` transaction fetch range.
2. Remove dependence on per-tx USD delta from spot `tokenPriceMap`.
3. Reuse historical timeline pricing (nearest prior chart point).
4. Return `BalanceDataPoint[]` with unchanged shape:
   - `timestamp`
   - `value`
   - `date`

Expected outcome:
- Historical balance values reflect historical token prices, matching PnL method.

### Phase 3: Preserve route contract and compatibility
Ensure `server/src/routes/charts/balance.route.ts` behavior remains unchanged:
- no response schema change
- no metadata shape change
- same daily-like series returned to route consumer

Expected outcome:
- No API breaking changes while improving valuation correctness.

### Phase 4: Test expansion and parity checks
Add/extend tests in `server/tests/wallet/walletData.tokenBalance.test.ts` for `getWalletBalanceHistory`.

Required scenarios:
1. Historical price variation changes balance history values over time.
2. Nearest-prior price selection is applied correctly.
3. Fallback to current price works when chart history is missing/partial.
4. All-missing price path returns deterministic safe output (no crashes, stable series).
5. Timestamp alignment and point count remain correct for selected periods.

Parity assertions:
- Shared helper output used by both paths for identical input fixtures should be internally consistent.

### Phase 5: Validation and rollout checks
Run:
- wallet service tests
- targeted chart route tests

Manual verification checklist:
1. For the same wallet/timePeriod, balance chart values now react to historical price swings.
2. No regression in cumulative PnL outputs.
3. No contract break in balance route JSON shape.

## Risks and Mitigations
1. Risk: Increased compute due to chart timeline reads per token.
   - Mitigation: continue using cached `token-chart` services and existing staleness thresholds.

2. Risk: Divergence reintroduced by future edits.
   - Mitigation: keep shared valuation helper internal and covered by tests.

3. Risk: Sparse or missing history.
   - Mitigation: preserve fallback chain (historical -> current -> zero) and log priced vs fallback points.

## Acceptance Criteria
1. `getWalletBalanceHistory` is historical-price aware per timestamp.
2. Balance-history valuation strategy matches cumulative PnL strategy.
3. Existing balance route contract is unchanged.
4. New tests cover pricing behavior and fallback semantics.
5. Existing cumulative PnL tests remain green.

## Suggested File Touch List
- `server/src/services/wallet/walletData.service.ts`
- `server/tests/wallet/walletData.tokenBalance.test.ts`
- optional notes update: `docs/WALLET_TOKEN_BALANCE_HISTORY_IMPLEMENTATION_PLAN.md`
