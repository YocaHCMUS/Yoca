---
goal: Refactor wallet chart PnL services with range-aware caching and daily net-flow formula
version: 1.0
date_created: 2026-05-09
last_updated: 2026-05-09
owner: Backend Team
status: 'Planned'
tags: [refactor, wallet, pnl, cache, charts, backend]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan refactors wallet PnL chart services to add a dedicated PnL caching layer and replace the daily PnL algorithm with a deterministic day-boundary formula. The implementation introduces two new schema tables for cached PnL series and cache metadata, and updates server-side services so daily PnL is computed from balance-history day deltas minus same-day transfer net inflow.

## 1. Requirements & Constraints

- **REQ-001**: Add two new database tables in `server/src/db/schema.ts` named `walletPnlDataCache` and `walletPnlDataMeta` for wallet PnL cache storage and metadata storage.
- **REQ-002**: Persist wallet-level PnL series rows in `walletPnlDataCache` with fields: `address`, `timePeriod`, `aggregation`, `dailyPnlSeries`, `cumulativePnlSeries`, `startBalance`, `endBalance`, `computedAt`, `coveredFromMs`, and `coveredToMs`.
- **REQ-003**: Persist cache metadata in `walletPnlDataMeta` with fields: `address`, `timePeriod`, `aggregation`, `coverageFromMs`, `coverageToMs`, `sourceBalanceRangeFromMs`, `sourceBalanceRangeToMs`, `sourceTransferRangeFromMs`, `sourceTransferRangeToMs`, and `updatedAt`.
- **REQ-004**: Replace current PnL computation in `getCumulativePnL` in `server/src/services/wallet/walletCharts.service.ts` so each day uses `pnl(i) = change(i) - netInflow(i)`.
- **REQ-005**: Define `change(i)` as `balance(startOfDay(i+1)) - balance(startOfDay(i))`, and for the newest day use current balance as `balance(startOfDay(i+1))`.
- **REQ-006**: Define `netInflow(i)` as `sum(transfer-in valueUsd) - sum(transfer-out valueUsd)` for transfers whose timestamps fall within day `i` UTC boundaries.
- **REQ-007**: PnL source balances must come from `getWalletBalanceHistory` in `server/src/services/wallet/walletCharts.service.ts`; portfolio reconstruction via `getHistoricalPortfolioValueSeries` must not be used for the new daily PnL path.
- **REQ-008**: PnL source transfers must come from transfer history service functions in `server/src/services/wallet/walletTransfersSwaps.service.ts` and associated retriever helpers in `server/src/services/wallet/db/walletDataRetriever.ts`.
- **REQ-009**: Update `getHistoricalPnLData` in `server/src/services/charts/pnlChart.service.ts` to pass through validated `period` and `aggregation` parameters to `getCumulativePnL`, and normalize any period wider than 7 days to the 7-day cap.
- **REQ-010**: Maintain existing API response shape for `HistoricalPnLResponse` unless a strictly additive metadata field is required.
- **REQ-011**: Before implementation begins, run a sanity-check pass on transfer and swap fetch functions to verify the fetch window starts at the true UTC start timestamp of exactly 7 days ago.
- **REQ-012**: Wallet chart PnL support is capped at 7 days; requests wider than 7 days must be clamped or rejected deterministically by service-layer policy.
- **SEC-001**: Cache key dimensions must include `address + timePeriod + aggregation` to prevent cross-wallet and cross-period data leakage.
- **SEC-002**: Cache reads must validate that requested coverage is fully contained within `coverageFromMs..coverageToMs` before returning cached PnL.
- **CON-001**: Daily boundaries are UTC-only; all day slicing and bucketing must use UTC start-of-day semantics.
- **CON-002**: Query-time cache fallback must be deterministic: use cache when fully covered, otherwise recompute and overwrite cache atomically.
- **CON-003**: Effective PnL computation range must never exceed 7 days, regardless of incoming route period values.
- **GUD-001**: Preserve existing route contract in `server/src/routes/charts/pnl.route.ts` and keep changes localized to schema, wallet services, and chart services.
- **PAT-001**: Follow existing wallet cache patterns already used by `walletBalanceHistoryCache`, `walletSwapMeta`, and `walletTransferMeta`.

## 2. Implementation Steps

### Implementation Phase 0

- GOAL-000: Verify and enforce true 7-day UTC fetch boundaries for transfer/swap providers before PnL refactor work starts.
- Completion criteria: transfer/swap fetch path computes `from` as UTC start-of-day for now-7-days and no implementation phase starts until this pre-check is complete and adjusted.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Audit and adjust fetch range construction in `server/src/services/wallet/walletTransfersSwaps.service.ts` and dependent fetch helpers so provider calls use the true UTC start of 7 days ago as the lower bound. | Yes | 2026-05-09 |

### Implementation Phase 1

- GOAL-001: Add schema and persistence primitives for wallet PnL cache data and metadata.
- Completion criteria: schema exports compile, migration SQL exists, and cache writer/reader helpers can persist and retrieve PnL cache rows by wallet, period, and aggregation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `walletPnlDataCache` and `walletPnlDataMeta` table definitions to `server/src/db/schema.ts` with explicit column types and primary keys on `(address, timePeriod, aggregation)`. | Yes | 2026-05-09 |
| TASK-002 | ~~Create a migration file in `server/postgresdb/migrations` to create the two new tables and indexes for `(address, timePeriod, aggregation)` and coverage range filtering columns.~~ Use `npm run db:push` instead. | N/A | N/A |
| TASK-003 | Extend `server/src/services/wallet/db/walletDataCacher.ts` with `saveWalletPnlCache(...)` that upserts both `walletPnlDataCache` and `walletPnlDataMeta` in a single transaction. | Yes | 2026-05-09 |
| TASK-004 | Extend `server/src/services/wallet/db/walletDataRetriever.ts` with `getCachedWalletPnl(...)` and `getWalletPnlMeta(...)` that return cache payload plus explicit coverage metadata. | Yes | 2026-05-09 |

### Implementation Phase 2

- GOAL-002: Refactor daily PnL computation to use day-boundary balance delta minus same-day transfer net inflow.
- Completion criteria: `getCumulativePnL` no longer depends on `getHistoricalPortfolioValueSeries`; output series is generated from UTC day buckets using balance history and transfer net flow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Refactor `getCumulativePnL(address, timePeriod, aggregation)` in `server/src/services/wallet/walletCharts.service.ts` to call `getWalletBalanceHistory(address, timePeriod)` and day-bucket the returned points by UTC day start. |  |  |
| TASK-006 | Add internal helper `buildDailyBalanceAnchors(...)` in `server/src/services/wallet/walletCharts.service.ts` to compute `balance(startOfDay(i))` and `balance(startOfDay(i+1))` for each day in the effective range. |  |  |
| TASK-007 | Add internal helper `computeDailyNetInflow(...)` in `server/src/services/wallet/walletCharts.service.ts` that reads transfer history and computes `inflow - outflow` per UTC day using transfer `valueUsd` and wallet direction. |  |  |
| TASK-008 | Implement formula application in `getCumulativePnL`: `dailyPnL[i] = roundUsd((balanceNext - balanceCurrent) - netInflow[i])` and derive `cumulativePnL` as prefix sum of `dailyPnL`. |  |  |
| TASK-009 | Keep `startBalance` and `endBalance` populated from day-anchor balances used by the same calculation path. |  |  |

### Implementation Phase 3

- GOAL-003: Integrate cache read/write flow into PnL service and thread chart request parameters through service layers.
- Completion criteria: `getCumulativePnL` serves from cache when coverage is sufficient, otherwise recomputes and stores cache; route query parameters are fully threaded into service calls.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add cache-first logic in `getCumulativePnL` in `server/src/services/wallet/walletCharts.service.ts` that checks `getWalletPnlMeta(...)` coverage and returns cached data when request range is fully covered. |  |  |
| TASK-011 | Add recompute-and-write path in `getCumulativePnL` that computes series and calls `saveWalletPnlCache(...)` with computed coverage and source range metadata. |  |  |
| TASK-012 | Update `getHistoricalPnLData(...)` in `server/src/services/charts/pnlChart.service.ts` signature to accept `(wallets, period, aggregation)`, normalize to a maximum 7-day period, and pass normalized values into `getCumulativePnL(walletAddress, period, aggregation)`. |  |  |
| TASK-013 | Update `server/src/routes/charts/pnl.route.ts` to forward parsed `params.period` and `params.aggregation` to `getHistoricalPnLData(...)` for both single-wallet and multi-wallet requests. |  |  |

### Implementation Phase 4

- GOAL-004: Add deterministic validation coverage for formula correctness, cache behavior, and route parameter propagation.
- Completion criteria: tests verify formula outputs and cache decision branches; route tests verify query passthrough and response shape stability.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Add unit tests for `getCumulativePnL` in `server/tests` validating `dailyPnL = dayDelta - netInflow` over a 7-day fixture with explicit UTC boundaries. |  |  |
| TASK-015 | Add unit tests for PnL cache retrieval and recompute branches in `server/tests` using mocked retriever/cacher functions and coverage metadata permutations. |  |  |
| TASK-016 | Add route/service integration tests for `server/src/routes/charts/pnl.route.ts` and `server/src/services/charts/pnlChart.service.ts` verifying `period` and `aggregation` passthrough to wallet PnL service. |  |  |
| TASK-017 | Run server typecheck and test commands (`npm run typecheck`, `npm run test`) and capture failures as blocking defects before merge. |  |  |

## 3. Alternatives

- **ALT-001**: Keep portfolio-snapshot-based PnL from `getHistoricalPortfolioValueSeries`. Rejected because it does not enforce the required day-boundary formula tied to transfer net flow.
- **ALT-002**: Cache only metadata and recompute PnL on every request. Rejected because repeated recomputation increases latency and load for repeated chart queries.
- **ALT-003**: Store only cumulative PnL and derive daily by differencing on read. Rejected because it obscures direct validation of the required day formula and complicates debugging.

## 4. Dependencies

- **DEP-001**: `server/src/db/schema.ts` for new table definitions.
- **DEP-002**: `server/postgresdb/migrations` for schema migration SQL.
- **DEP-003**: `server/src/services/wallet/db/walletDataCacher.ts` for cache write APIs.
- **DEP-004**: `server/src/services/wallet/db/walletDataRetriever.ts` for cache read APIs and coverage checks.
- **DEP-005**: `server/src/services/wallet/walletCharts.service.ts` for PnL computation and cache orchestration.
- **DEP-006**: `server/src/services/wallet/walletTransfersSwaps.service.ts` for transfer history source data.
- **DEP-007**: `server/src/services/charts/pnlChart.service.ts` for chart aggregation service signatures.
- **DEP-008**: `server/src/routes/charts/pnl.route.ts` for query validation and forwarding.

## 5. Files

- **FILE-001**: `server/src/db/schema.ts` - add `walletPnlDataCache` and `walletPnlDataMeta` table definitions and exports.
- **FILE-002**: `server/postgresdb/migrations/00xx_wallet_pnl_cache.sql` - create tables and indexes for PnL cache and metadata.
- **FILE-003**: `server/src/services/wallet/db/walletDataCacher.ts` - add `saveWalletPnlCache(...)` and metadata upsert logic.
- **FILE-004**: `server/src/services/wallet/db/walletDataRetriever.ts` - add `getCachedWalletPnl(...)` and `getWalletPnlMeta(...)` retrieval logic.
- **FILE-005**: `server/src/services/wallet/walletCharts.service.ts` - replace PnL algorithm and integrate cache read/write flow.
- **FILE-006**: `server/src/services/charts/pnlChart.service.ts` - pass `period` and `aggregation` through to wallet PnL computation.
- **FILE-007**: `server/src/routes/charts/pnl.route.ts` - forward parsed request query parameters to chart service.
- **FILE-008**: `server/tests/walletCharts.pnl.test.ts` - validate day-level PnL formula and cumulative output.
- **FILE-009**: `server/tests/pnlCache.behavior.test.ts` - validate cache coverage decisions and recomputation behavior.
- **FILE-010**: `server/tests/pnlRoute.params.test.ts` - validate route parameter passthrough behavior.

## 6. Testing

- **TEST-001**: Formula correctness test where known day anchors and transfer flows produce expected `dailyPnL` values for each day.
- **TEST-002**: UTC boundary test where transfers at `00:00:00.000Z` and `23:59:59.999Z` are assigned to correct day buckets.
- **TEST-003**: Cache hit test where coverage fully contains requested range and no recomputation function is invoked.
- **TEST-004**: Cache miss test where partial coverage triggers recomputation and cache upsert.
- **TEST-005**: Route passthrough test ensuring `period` and `aggregation` parsed in `pnl.route.ts` are passed into `getHistoricalPnLData(...)` and then `getCumulativePnL(...)`.
- **TEST-006**: Response-shape regression test ensuring existing `HistoricalPnLResponse` fields remain stable.
- **TEST-007**: Typecheck validation for new schema types and service signatures.
- **TEST-008**: Range-policy test ensuring PnL requests wider than 7 days are deterministically clamped or rejected according to service policy.
- **TEST-009**: Pre-check test ensuring transfer/swap fetch lower-bound timestamp is exactly UTC start-of-day for now-7-days.

## 7. Risks & Assumptions

- **RISK-001**: Sparse balance history points can cause ambiguous start-of-day anchor selection.
- **RISK-002**: Transfer direction classification errors can bias `netInflow` and therefore daily PnL.
- **RISK-003**: Cache key mismatch across `timePeriod` and `aggregation` can return stale or wrong granularity data.
- **RISK-004**: Migration rollout order can break server startup if code expects tables before migration is applied.
- **ASSUMPTION-001**: Transfer records include reliable `valueUsd` for inflow/outflow summation.
- **ASSUMPTION-002**: Existing `getWalletBalanceHistory` provides sufficient day-level points for the supported 7-day PnL window.
- **ASSUMPTION-003**: Existing route schema enums for `period` and `aggregation` remain unchanged during this refactor.

## 8. Related Specifications / Further Reading

- `docs/wallet-issues/Task-02/current-problem.md`
- `docs/wallet-issues/Task-02/todo`
- `docs/wallet-issues/Task-02/feature-pnl-chart-update-1.md`
- `server/src/services/wallet/walletCharts.service.ts`
- `server/src/services/charts/pnlChart.service.ts`
- `server/src/routes/charts/pnl.route.ts`
- `server/src/services/wallet/walletTransfersSwaps.service.ts`
- `server/src/services/wallet/db/walletDataCacher.ts`
- `server/src/services/wallet/db/walletDataRetriever.ts`
- `server/src/db/schema.ts`
