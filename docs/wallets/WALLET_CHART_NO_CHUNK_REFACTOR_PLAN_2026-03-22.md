# Wallet Chart No-Chunk Refactor Plan

## Goal
Remove chart chunking from wallet chart flows and move all chart reads back to normal single-request fetching for both backend routes and client chart components.

## Why This Refactor
- Chunking adds additional API contract complexity (`cursor`, `limit`, `pageInfo`, `chunkInfo`) that is no longer desired.
- Chart routes and client components currently contain chunk orchestration code and cursor state that should be removed.
- The current codebase already shows partial rollback/commented chunk sections, so this plan standardizes a clean non-chunk architecture.

## Scope
In scope:
- server/src/routes/charts/balance.route.ts
- server/src/routes/charts/pnl.route.ts
- server/src/services/charts/pnlChart.service.ts
- server/src/services/wallet/walletCharts.service.ts
- server/src/services/wallet/walletTokenBalance.service.ts
- server/src/util/chartChunkParams.ts
- server/src/util/chartCursor.ts
- client/src/components/charts/BalanceChart/BalanceChart.tsx
- client/src/components/charts/PnLChart/PnLChart.tsx
- client/src/types/chart-api.types.ts
- client/src/types/chart-api.chunking.test.ts
- Any route/unit tests asserting cursor pagination behavior for balance/pnl charts

Out of scope:
- Reworking non-balance/non-pnl chart endpoints
- Changing visual chart design and chart theme behavior
- Provider-level API changes

## Current State Findings
1. Server chart routes still include chunking primitives
- `pnl.route.ts` parses `cursor`, `limit`, `parseChartChunkInput`, and emits encoded cursors.
- `balance.route.ts` contains significant chunking-era code paths (currently heavily commented), indicating in-progress rollback.

2. Chart service contracts still expose chunk DTOs
- `walletCharts.service.ts` still imports/uses chunk-oriented types and options in several places.
- `walletTokenBalance.service.ts` still includes chunk-oriented commented sections and imports.

3. Client chart components still orchestrate chunk pagination
- `BalanceChart.tsx` keeps `pageInfo`, `isFetchingMore`, `handleLoadOlder`, and merge logic.
- `PnLChart.tsx` keeps the same cursor paging/merge model.

4. Client type contracts still model chunking metadata
- `chart-api.types.ts` includes `ChartPageInfo`, `ChartChunkInfo`, and request `limit`/`cursor` fields.
- `chart-api.chunking.test.ts` explicitly validates chunking request/response types.

## Target Architecture
1. Backend routes
- `GET /api/charts/balance` accepts normal chart query only (period/tokens/wallets/timezone) and returns full payload.
- `GET /api/charts/pnl` accepts normal chart query only (period/wallets/aggregation/timezone) and returns full payload.
- No `cursor`, no `limit` chunk controls, no encoded cursor generation.

2. Service layer
- Wallet chart services expose only non-chunk methods:
  - `getWalletBalanceHistory`
  - `getWalletTokenBalanceHistory`
  - `getCumulativePnL`
- Remove chunk-specific options/return metadata from public chart-service contracts.

3. Client
- `fetchBalanceTrend` and `fetchPnLChart` use single request without pagination loop.
- Chart components render latest server result directly.
- Remove "Load older" controls and merging logic.

4. Shared contracts
- Remove chunking-specific API response metadata from client chart type models.
- Remove chunk request params from public client request type interfaces.

## Refactor Principles
1. Keep endpoint URLs unchanged.
2. Keep payload shape stable where possible, only removing chunking fields.
3. Prefer deleting dead chunk code over retaining commented branches.
4. Keep route validation strict for core filters; only remove chunk-specific validation.
5. Update tests in lockstep with contract changes.

## Detailed Plan

### Phase A: Contract Cleanup (Types First)
1. Update client chart request interfaces:
- In `client/src/types/chart-api.types.ts`:
  - Remove `limit` and `cursor` from:
    - `BalanceRequestParams`
    - `PnLRequestParams`

2. Update client chart response interfaces:
- In `client/src/types/chart-api.types.ts`:
  - Remove `ChartPageInfo` and `ChartChunkInfo` interfaces.
  - Remove `pageInfo?` and `chunkInfo?` fields from:
    - `BalanceTrendResponse`
    - `PnLChartResponse`

3. Replace chunking type test:
- Replace `client/src/types/chart-api.chunking.test.ts` with a non-chunk contract test that validates the simplified request/response typings.

### Phase B: Backend Route Simplification
1. Simplify `server/src/routes/charts/pnl.route.ts`:
- Remove `limit` and `cursor` from zod schema.
- Remove `isChartChunkingEnabled` gating for chunk branch behavior.
- Remove `parseChartChunkInput` usage.
- Remove `encodeChartCursor` usage and `pageInfo` response construction.
- Call `getHistoricalPnLData(wallets, period, aggregation)` with no chunk options.
- Keep max-wallet validation.

2. Simplify `server/src/routes/charts/balance.route.ts`:
- Ensure file is restored to active code (not commented scaffold) and remove chunk branches completely.
- Remove `limit` and `cursor` from schema.
- Remove `parseChartChunkInput` and cursor payload handling.
- Remove chunk-specific multi-wallet guard for `All` that depends on chunk params.
- Use only non-chunk data calls:
  - `getWalletBalanceHistory`
  - `getWalletTokenBalanceHistory`
- Return full normal `series + metadata` response.

3. Remove chunk utility dependencies from routes:
- Remove imports of:
  - `@sv/util/chartChunkParams`
  - `@sv/util/chartCursor`

### Phase C: Service Layer Cleanup
1. Simplify `server/src/services/charts/pnlChart.service.ts`:
- Remove chunk option input and chunk metadata from return types.
- Keep only non-chunk aggregation logic for single/multi-wallet.

2. Simplify `server/src/services/wallet/walletCharts.service.ts`:
- Remove chunk variants from public surface and internal helpers that only exist for chunking.
- Keep/restore pure non-chunk methods used by routes.

3. Simplify `server/src/services/wallet/walletTokenBalance.service.ts`:
- Remove chunk-specific function definitions and dead commented code.
- Keep only `getWalletTokenBalanceHistory` for route usage.

4. Optional cleanup:
- If no references remain, remove:
  - `server/src/util/chartChunkParams.ts`
  - `server/src/util/chartCursor.ts`
- If kept for future reuse, mark clearly as unused and remove all imports.

### Phase D: Client Rewire
1. Update `client/src/components/charts/BalanceChart/BalanceChart.tsx`:
- Remove chunk constants (`CHART_CHUNK_LIMIT`) if no longer needed.
- Remove `pageInfo`, `isFetchingMore`, `handleLoadOlder`, and merge-by-cursor logic.
- Remove "Load older" UI button.
- Fetch once per filter change and render the result.

2. Update `client/src/components/charts/PnLChart/PnLChart.tsx`:
- Remove chunk constants (`CHART_CHUNK_LIMIT`) if no longer needed.
- Remove `pageInfo`, `isFetchingMore`, `handleLoadOlder`, and merge logic.
- Remove "Load older" UI button.
- Render directly from single API response.

3. Keep API service signatures simple:
- `client/src/services/chart/chartApi.ts` remains generic Hono query wrapper, but callers should no longer pass `limit/cursor`.

### Phase E: Tests and Validation
1. Route tests:
- Update/remove cursor-specific tests in:
  - `server/tests/routes/charts/balance.route.test.ts`
  - `server/tests/routes/charts/pnl.route.test.ts`
- Add tests that verify no cursor fields are expected in successful responses.

2. Client/unit tests:
- Replace chunk typing tests with non-chunk contract assertions.
- Update component tests/snapshots (if present) to remove "Load older" expectations.

3. Regression checks:
- Ensure chart endpoints still return valid data for:
  - single wallet
  - multi-wallet
  - token mode and total mode (balance)

## Suggested Execution Order
1. Contract and types (Phase A).
2. Backend routes and services (Phases B + C).
3. Client components (Phase D).
4. Tests and cleanups (Phase E).

## Risk and Mitigation
1. Risk: payload consumers still expect `pageInfo/chunkInfo`.
- Mitigation: remove fields in type layer first and compile to identify all dependencies.

2. Risk: large `All` queries can be heavy without chunking.
- Mitigation: maintain existing wallet/token caps and consider returning 400 for extreme multi-wallet ranges if needed.

3. Risk: partially commented files can hide dead paths.
- Mitigation: explicitly remove dead/commented chunk code instead of leaving mixed commented logic.

## Acceptance Criteria
1. No chart route accepts `cursor` or `limit` for chunk backfill.
2. No chart response returns chunking metadata (`pageInfo`, `chunkInfo`).
3. No client chart component maintains cursor paging or "Load older" action.
4. `chartChunkParams.ts` and `chartCursor.ts` are either removed or fully unused.
5. Balance and PnL route tests pass with non-chunk contracts.

## Deliverables
1. Simplified non-chunk balance and pnl routes.
2. Simplified chart/wallet service contracts without chunk DTOs.
3. Rewired client chart components using normal fetch-only flow.
4. Updated client/server tests aligned to non-chunk API contracts.
