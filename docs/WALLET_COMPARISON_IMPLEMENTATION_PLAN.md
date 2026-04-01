# Wallet Comparison Charts — Implementation Plan

Date: 2026-03-26

Goal: Provide backend services and API routes required by the client-side wallet comparison charts. This plan lists excluded charts (not viable now), the charts we will implement using existing providers and cached DB data, implementation details, and required schema/route changes.

## Excluded / Deferred Charts
- Daily trading volume (`DailyTradingVolume`): no provider historical data; extracting from tx history is expensive — defer.
- Holding durations (`HoldingDurations`): no provider data; defer.
- Average rolling annual returns (median option): requires tx-level work; defer the median option.

## Charts to Implement (viable now)

1) Total Trading Volume (`TotalTradingVolumeChart`)
   - Data source: `wallet_overview_cache` table.
   - Fields: `tradingVolumeUsd24h`, `tradingVolumeUsd7d`, `...` (use windowed fields).
   - Endpoint: `/api/wallets/comparison/total-trading-volume?wallets=...&window=24h`

2) Trading Volume Distribution (`TradingVolumeDistribution`)
   - Data source: `wallet_overview_cache`.
   - Fields: `buyVolumeUsd24h`, `buyTxCount24h`, `sellVolumeUsd24h`, `sellTxCount24h`.
   - Metric switch: support `metric=volume|count` query param (switch between volume and tx count).
   - Endpoint: `/api/wallets/comparison/volume-distribution?wallets=...&metric=volume`

3) Trading Volume Per Transaction (`TradingVolumePerTransaction`)
   - Data source: `wallet_overview_cache`.
   - Compute: `buyVolumeUsd24h / buyTxCount24h` and `sellVolumeUsd24h / sellTxCount24h` per wallet (no median).
   - Endpoint: `/api/wallets/comparison/volume-per-tx?wallets=...&window=24h`

4) Stablecoin Ratio (`StablecoinRatioChart`)
   - Data source: `getWalletTokenBalanceHistory(address, tokenSelector)` (reuse `getWalletTokenBalanceHistory`).
   - Approach: Fetch balance series for `30D` (or requested range); identify stable coins (USDT, USDC, DAI, etc.) and compute per-timestamp stable vs non-stable totals and percentages + raw USD values.
   - Endpoint: `/api/wallets/comparison/stablecoin-ratio?wallet=...&timePeriod=30D`

5) Rolling Annual Return (`RollingAnnualReturn`)
   - Data source: `wallet_overview_cache` fields: `pnlRealizedUsd24h`, `pnlUnrealizedUsd24h`, `pnlTotalUsd24h` and windowed equivalents.
   - Output: time-series or windowed summaries as chart expects (compute rolling annualization using cached daily pnl where available).
   - Endpoint: `/api/wallets/comparison/rolling-annual-return?wallets=...&period=1Y`

6) Winrate (`WinrateChart`)
   - Data source: add `winrate` column to `wallet_overview_cache` (decimal) and populate from provider response (`fetchBirdeyeOverallPnL`) when missing.
   - Endpoint: `/api/wallets/comparison/winrate?wallets=...`

7) Drawdown (`DrawdownChart`)
   - Data source: reuse `getWalletBalanceHistory(address)` which uses `fetchBirdeyeNetworthHistory`.
   - Endpoint: `/api/wallets/comparison/drawdown?wallet=...&timePeriod=30D`

## Service Layer
- Create `server/src/services/wallet/walletComparison.service.ts` implementing:
  - `getTotalTradingVolume(wallets, window)` 
  - `getTradingVolumeDistribution(wallets, metric, window)` 
  - `getTradingVolumePerTransaction(wallets, window)` 
  - `getStablecoinRatio(address, timePeriod)` (calls existing `getWalletTokenBalanceHistory` and process for appropriate ratio data)
  - `getRollingAnnualReturn(wallets, period)` (mapper using cached PnL fields)
  - `getWinrate(wallets)` (reads `winrate` or fetches via `fetchBirdeyeOverallPnL` then upserts)
  - `getDrawdownSeries(address, timeRange)` (calls existing `getWalletBalanceHistory` and process for appropriate drawdown data)

## Existing services to reuse (avoid redundancy)
- `server/src/services/wallet/db/walletDataCacher.ts`: `saveOverviewCache`, `saveBalanceHistoryCache`, and other cache upsert helpers — already persist `wallet_overview_cache` and balance history.
- `server/src/services/wallet/walletData.core.ts`: `getLatestOverviewCacheRow`, `getOverviewFromFreshCache`, `getOverviewPeriodStatsFromCache`, `buildActivitySnapshotFromProviders`, `buildHoldingsSnapshotFromProviders`, and mapping helpers — use these to read/interpret `wallet_overview_cache` and to fallback to provider fetches following existing patterns.
- `server/src/services/wallet/walletOverview.service.ts`: `getWalletOverview` demonstrates the cache-check → provider → save flow and should be used as the model for comparison endpoints.
- `server/src/services/wallet/walletCharts.service.ts`: `getWalletBalanceHistory`, `getCumulativePnL` — reuse for drawdown and PnL series.
- `server/src/services/wallet/walletTokenBalance.service.ts`: `getWalletTokenBalanceHistory` — reuse for `StablecoinRatio` time-series.

Adjustment: Do NOT add a new upsert helper table-level function unless some very small wrapper is needed; prefer calling `saveOverviewCache` or other existing cacher methods to persist derived metrics.

## Required code updates (cache, retrieval services, DTOs)
- Schema migration: add `winrate` (decimal) to `wallet_overview_cache` and include it in the SQL migrations folder.
- DTOs/types: update `WalletOverviewCacheRow` and any derived DTOs to include `winrate` and appropriate typing. Ensure `server/build` artifacts are regenerated if applicable.
- Cache writer: update `server/src/services/wallet/db/walletDataCacher.ts::saveOverviewCache` to accept and persist `winrate` when present in the upstream `WalletOverview` payload.
- Cache reader/mappers: update `server/src/services/wallet/walletData.core.ts` mapping functions (`getOverviewPeriodStatsFromCache`, `mapOverviewCacheRowToDto`, `getLatestOverviewCacheRow`) to read and expose `winrate` where relevant.
- Comparison services: ensure `walletComparison.service.ts` reads `winrate` from the cache via the existing helper functions and falls back to `fetchBirdeyeOverallPnL` only when necessary, then persists the value using `saveOverviewCache`.
- Tests: add unit tests asserting `winrate` propagates from provider -> cache writer -> cache reader -> comparison service output.

Note: follow existing patterns used by `getWalletOverview`/`saveOverviewCache` to ensure cache miss/fallback/upsert behavior remains consistent across the codebase.

## Routes
- Add endpoints under `/api/wallets/comparison/*` (GET); responses should be JSON with simple shapes the client charts expect.
- Routes should accept `wallets` (comma list) or `wallet` (single), plus `timePeriod`, `window`, and `metric` query params.

## Schema & DB
- Add `winrate` column (decimal) to `wallet_overview_cache`. If migrations are used, add a migration to alter the table.
- Provide a small DB helper `upsertWalletOverviewMetrics(address, fields)` to persist derived fields (winrate or missing PnL fields).

**Important constraint:** These charts are derivative of existing cached data — do not create new tables. All derived metrics must be stored in or derived from existing schema tables (for example `wallet_overview_cache`, token balance history tables, or other authoritative tables in the schema).

## Caching & Consistency
- On cache miss, services MUST first attempt to read the appropriate authoritative table in the schema (for example `wallet_overview_cache`, token balance history tables, etc.).
- Only if the authoritative tables lack the requested derived metric should the service call an external provider (for example `fetchBirdeyeOverallPnL`) to obtain the value.
- After retrieving a value from the provider due to a cache miss, persist (upsert) the derived metric back into the existing authoritative table — do not create new tables or ad-hoc storage.
- All fetches triggered by cache misses must follow this ordering: authoritative-table -> provider -> upsert-into-authoritative-table -> return.

## Tests
- Unit-tests for service mappers and small integration tests for routes using mocked DB/provider responses.

## Client
- Update chart connectors to call the new endpoints. Return shapes should match the chart components' expectations.

## Work Plan (short tasks)
1. Add `winrate` column + migration.
2. Reuse existing DB helpers: call `getLatestOverviewCacheRow`/`getOverviewFromFreshCache` for reads and `saveOverviewCache` for writes; create only small wrapper helpers if needed.
3. Scaffold `walletComparison.service.ts` using existing helpers and the functions listed above.
4. Add routes under `/api/wallets/comparison` and wire to the service.
5. Implement `StablecoinRatio` endpoint using `getWalletTokenBalanceHistory`.
6. Implement remaining endpoints using `wallet_overview_cache` fields and `walletCharts.service` helpers for PnL/drawdown.
7. Write tests and update client connectors and docs.

