# Wallet Overview Refactor Plan

## Goal
Refactor wallet overview computation so it is correct across chains, consistent with metric semantics, and maintainable through shared helpers.

## Scope
- In scope:
  - server/src/services/wallet/walletData.service.ts
  - server/src/services/wallet/db/walletDataCacher.ts
  - server/src/routes/wallets.route.ts
  - client/src/services/wallet/walletApi.ts
  - client/src/components/wallet/WalletOverview/WalletOverview.tsx
  - server tests for wallet overview service and route
- Out of scope (initial pass):
  - Redesigning WalletOverview UI layout
  - Historical all-time realized PnL computation

## Current Findings

1. Incorrect dependency usage in service layer
- walletData.service imports a route module and calls .get(address) as if it were a balances service.
- This should call the real balances service function directly.

2. EVM overview activity metrics are functionally empty
- EVM branch calls getWalletTransactionHelius, which returns empty for non-Solana chains.
- As a result, transactionCount24h, tokensTradedCount, tradingVolumeUsd24h, and pnlUsdTotal are often null/zeroed by behavior, not by real data.

3. Metric semantics mismatch
- Field name pnlUsdTotal is used, but value is currently computed from a short recent window.
- UI label says Total PnL, which implies lifetime or selected-range aggregation. 

4. Duplicated metric logic
- Solana and EVM paths duplicate token-set and USD delta logic with slight differences.
- Duplication increases regression risk and drifts behavior over time.

5. Partial data quality in DB-first fast path
- When balances are available quickly, overview is returned with all activity fields null, even when recent activity could be fetched.

6. Frontend filter controls are currently not wired to overview API behavior
- WalletOverview has 24H/7D/30D/custom controls, but overview API call does not pass period.

7. Unbounded period windows increase operational risk
- Allowing 30D/custom windows for overview activity can cause heavy provider fetches for high-transaction wallets.
- Persisting large activity windows also increases DB pressure for cache writes and storage.

8. Testing coverage gap
- No dedicated overview service tests currently validate chain behavior, cache behavior, or metric correctness.

## Refactor Principles

1. Separate holdings metrics from activity metrics.
2. Use one shared metrics reducer for transaction-derived stats.
3. Keep DB cache behavior deterministic and resilient to partial provider failures.
4. Preserve backward compatibility in response shape first, then extend safely.
5. Keep chain-specific fetching isolated behind small adapters.
6. Constrain overview activity windows to operationally safe bounds (24h to 7d).

## Target Architecture

### A. Overview assembly pipeline
Build overview via composable internal steps:
1. Resolve chain and load fresh cache if valid.
2. Build holdings snapshot:
- totalAssetValueUsd
- tokensHoldingCount
3. Build activity snapshot for a period window:
- transactionCount
- tokensTradedCount
- tradingVolumeUsd
- pnlUsd
4. Merge snapshots into WalletOverview response and cache.

### B. Chain-specific activity providers
- Solana provider:
  - Use getWalletTransactionHelius with explicit fromSec/toSec window.
- EVM provider:
  - Use EVM transaction source (Moralis-backed path), not Helius-only function.
  - Normalize into common internal transaction-change format.

### C. Shared transaction metrics reducer
Extract one helper that accepts normalized balance changes and returns:
- transactionCount
- tokensTradedCount
- tradingVolumeUsd
- pnlUsd
with consistent pricing fallback rules.

### D. Period guardrails
- Support only overview activity periods within 24h to 7d.
- Default to 24h when period is omitted.
- For unsupported values outside bounds (for example <24h or >7d, including 30d), normalize to 24h and log a warning for observability.

## Phased Plan

### Phase 1: Correct dependency boundaries
1. Replace route import usage with service import for wallet balances.
2. Update calls to await proper getWalletBalances service function.
3. Ensure no service directly depends on route modules.

Expected outcome:
- Type-safe and reliable balances retrieval in overview and portfolio paths.

### Phase 2: Extract shared internal helpers
Add private helpers in walletData.service:
1. mapOverviewCacheRowToDto
2. getOverviewFromFreshCache
3. buildHoldingsSnapshotFromBalancesOrProviders
4. reduceActivityMetricsFromTransactions
5. buildOverviewResponse

Expected outcome:
- Less duplication and clearer data flow.

### Phase 3: Fix chain-specific activity sources
1. Solana:
- Keep Helius tx path with explicit period boundaries.
2. EVM:
- Replace getWalletTransactionHelius call with EVM-appropriate transaction source.
- Normalize inputs before passing to shared reducer.

Expected outcome:
- Non-empty, chain-correct activity metrics for EVM wallets.

### Phase 4: Standardize metric semantics and naming path
1. Keep existing API fields for backward compatibility.
2. Internally rename to explicit windowed semantics (for clarity).
3. Add additive fields in a second step if needed:
- pnlUsdWindow
- tradingVolumeUsdWindow
- metricsPeriod
4. Decide whether pnlUsdTotal remains alias or is deprecated later.

Expected outcome:
- Contract clarity without immediate frontend breakage.

### Phase 5: Wire and bound overview period controls
1. Extend wallet overview endpoint query with period parameter bounded to 24h-7d (default 24h).
2. Parse/validate period in route/service and normalize unsupported values to 24h.
3. Update client WalletOverview filter options to remove 30D and constrain custom selection to min 24h/max 7d.
4. Keep default behavior unchanged when period is omitted.

Expected outcome:
- UI filters produce actual backend metric-window changes without unsafe long-range fetches.

### Phase 6: Cache and resilience hardening
1. Cache merged overview output with current TTL.
2. On activity fetch failure:
- retain holdings data
- avoid destructive overwrite of previously available activity metrics
3. Add structured logs for:
- source used
- provider failures
- priced changes count
- cache hit/miss
4. Store only aggregated overview metrics in cache rows for this endpoint (not expanded raw transaction payloads).

Expected outcome:
- Stable overview response under transient provider failures and bounded DB/storage pressure.

## Test Plan

### Unit/service tests
Create/extend tests for getWalletOverview:
1. Fresh cache returns cached DTO and skips providers.
2. Balances fast path computes holdings correctly.
3. Solana activity metrics computed from Helius tx data.
4. EVM activity metrics computed from EVM tx source (not empty due to Helius path).
5. Missing token prices do not crash reducer.
6. Partial provider failure still returns holdings.

### Route tests
Add route-level tests for /api/wallets/overview:
1. Valid request returns 200 with expected fields.
2. Chain parsing/default behavior works.
3. Period parsing/default behavior works after Phase 5.
4. Unsupported periods outside bounds (for example 12h or 30d) are normalized to 24h.
5. Supported periods (24h, 7d) produce expected activity-window behavior.

### Regression tests
1. Ensure no break in wallet overview consumer component.
2. Ensure cache writes still upsert the same schema columns.

## Rollout Steps

1. Implement Phase 1-3 in service layer.
2. Add service and route tests.
3. Run server test suite.
4. Implement Phase 5 period bounds (24h/7d) in route and client filter controls.
5. Validate UI values for Solana and one EVM chain wallet manually.

## Acceptance Criteria

1. Overview no longer imports route modules in service layer.
2. EVM overview activity metrics are computed from non-empty relevant data sources.
3. Shared reducer is used for both Solana and EVM activity metrics.
4. Metric semantics are documented and internally consistent.
5. New tests cover cache, chain behavior, and failure paths.
6. Overview period handling is bounded to 24h-7d and safe for high-activity wallets.
7. Existing wallet overview API remains backward compatible in initial rollout.
