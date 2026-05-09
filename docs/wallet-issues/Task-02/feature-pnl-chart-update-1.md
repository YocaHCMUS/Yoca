---
goal: Update PnL chart and backing data path for 7-day wallet history
version: 1.0
date_created: 2026-05-08
last_updated: 2026-05-08
owner: unassigned
status: Planned
tags: [feature, bugfix, chart, pnl, wallet]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Implement 7-day constrained wallet PnL data flow end-to-end. The plan updates server-side PnL calculation, transaction cache coverage metadata, and client chart consumption so the chart reflects the corrected data model.

## 1. Requirements & Constraints

- **REQ-001**: Historical wallet PnL must use a hard 7-day window for provider fetches.
- **REQ-002**: Cached transaction data may be reused beyond 7 days only when cache metadata proves the requested range is covered.
- **REQ-003**: Transaction cache metadata must persist available data range for transfers and swaps.
- **REQ-004**: Historical PnL calculation must use `pnl(i) = change(i) - NetInflow(i)` for each day in the 7-day window.
- **REQ-005**: `change(i)` must equal balance at start of day `i+1` minus balance at start of day `i`, using current balance for the newest day.
- **REQ-006**: Net inflow must be computed from wallet-directed transfers minus wallet-outgoing transfers for the same day.
- **REQ-007**: PnL route must forward request query parameters consistently so the client chart and service contract remain aligned.
- **REQ-008**: Client chart must continue to render `dailyPnL` and `cumulativePnL` series without changing existing chart mode controls.
- **CON-001**: Keep changes localized to wallet chart and wallet history services unless a dependency requires a shared type update.
- **CON-002**: Preserve existing API response shape unless the PnL service requires an explicit range field for correctness.
- **GUD-001**: Prefer deterministic 7-day truncation over heuristic range expansion.
- **PAT-001**: Reuse existing cache helpers and chart fetcher patterns instead of adding a parallel data path.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Fix server-side wallet PnL source data and cache range semantics.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update `server/src/services/wallet/db/walletDataCacher.ts` so transfer and swap cache writes persist available data range metadata for each wallet cache record. |  |  |
| TASK-002 | Update `server/src/services/wallet/db/walletDataRetriever.ts` so cache reads can decide between cache reuse and provider fetch based on stored covered range plus requested 7-day window. |  |  |
| TASK-003 | Update `server/src/services/wallet/walletTransfersSwaps.service.ts` so fresh provider fetches are hard-limited to 7 days and cached wider data is reused when covered. |  |  |
| TASK-004 | Update `server/src/services/charts/pnlChart.service.ts` so `getHistoricalPnLData` passes request period and aggregation into wallet PnL computation, or explicitly normalizes to the 7-day rule if those parameters become irrelevant. |  |  |

### Implementation Phase 2

- GOAL-002: Rework PnL computation and chart contract to match the corrected 7-day model.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Update `server/src/services/wallet/walletCharts.service.ts` so `getCumulativePnL` computes daily PnL from day-over-day balance change minus same-day net inflow. |  |  |
| TASK-006 | Update `server/src/routes/charts/pnl.route.ts` so the route forwards validated query parameters to `getHistoricalPnLData` and no parameter is silently dropped. |  |  |
| TASK-007 | Review `client/src/components/charts/PnLChart/PnLChart.tsx` and the chart API types so the client request matches the server contract after the PnL service update. |  |  |
| TASK-008 | Validate chart rendering behavior for `daily`, `cumulative`, and `both` modes after the server response shape is stabilized. |  |  |

## 3. Alternatives

- **ALT-001**: Leave current PnL route and only change client chart. Rejected because the wrong data would still be returned by the server.
- **ALT-002**: Introduce a new PnL endpoint for 7-day data. Rejected because this duplicates the existing chart contract and adds unnecessary routing complexity.
- **ALT-003**: Keep provider fetches open-ended and clip only at display time. Rejected because cache reuse and PnL correctness both depend on bounded source data.

## 4. Dependencies

- **DEP-001**: Existing wallet transaction cache schema and metadata columns in `server/src/services/wallet/db/walletDataCacher.ts` and related schema definitions.
- **DEP-002**: Existing wallet balance and price history helpers used by `server/src/services/wallet/walletCharts.service.ts`.
- **DEP-003**: Client chart fetch contract in `client/src/components/charts/PnLChart/PnLChart.tsx` and `client/src/services/chart/chartApi`.
- **DEP-004**: PnL route request schema in `server/src/routes/charts/pnl.route.ts`.

## 5. Files

- **FILE-001**: `server/src/services/wallet/db/walletDataCacher.ts` - persist transaction cache coverage metadata.
- **FILE-002**: `server/src/services/wallet/db/walletDataRetriever.ts` - use coverage metadata when deciding cache eligibility.
- **FILE-003**: `server/src/services/wallet/walletTransfersSwaps.service.ts` - enforce 7-day provider fetch behavior.
- **FILE-004**: `server/src/services/wallet/walletCharts.service.ts` - implement corrected historical PnL math.
- **FILE-005**: `server/src/services/charts/pnlChart.service.ts` - forward request parameters into the wallet PnL computation path.
- **FILE-006**: `server/src/routes/charts/pnl.route.ts` - pass parsed query parameters to the service layer.
- **FILE-007**: `client/src/components/charts/PnLChart/PnLChart.tsx` - keep chart request and display behavior aligned with updated PnL response.
- **FILE-008**: `client/src/services/chart/chartApi` and related request types - update types if the server contract changes.

## 6. Testing

- **TEST-001**: Add or update server unit tests for cache decision logic to verify 7-day provider limits and cache-range reuse.
- **TEST-002**: Add or update wallet PnL tests to verify daily PnL equals balance change minus net inflow for each day in a 7-day window.
- **TEST-003**: Add or update route-level tests for `server/src/routes/charts/pnl.route.ts` to verify query parameters reach `getHistoricalPnLData`.
- **TEST-004**: Add or update client chart tests or snapshot checks to verify `PnLChart` still renders daily and cumulative series correctly.
- **TEST-005**: Run project typecheck or build validation for server and client slices after each service update.

## 7. Risks & Assumptions

- **RISK-001**: Existing cache tables may not yet store enough range metadata for all transaction types, requiring a schema migration.
- **RISK-002**: Day-boundary handling may differ between UTC and wallet-local interpretation if the balance series helper does not already normalize timestamps.
- **RISK-003**: Net inflow classification may require counterparty heuristics for known CEX addresses, which can affect daily PnL values.
- **ASSUMPTION-001**: The PnL chart should keep the current visualization modes and only change underlying data correctness.
- **ASSUMPTION-002**: The 7-day rule applies to fresh provider fetches, not to cache reads when range metadata already proves coverage.

## 8. Related Specifications / Further Reading

- [Task-02 current problem](current-problem.md)
- [Task-02 todo](todo)
- `server/src/services/wallet/walletTransfersSwaps.service.ts`
- `server/src/services/wallet/walletCharts.service.ts`
- `client/src/components/charts/PnLChart/PnLChart.tsx`