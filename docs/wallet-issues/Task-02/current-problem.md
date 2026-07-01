# Task-02 Current Problem

## What is broken

1. Transfer / swap history can still behave like open-ended history instead of a strict 7-day fetch window.
2. Cache metadata for transaction data only tracks freshness, not the available covered range, so the service cannot safely decide when cached data is enough.
3. Historical PnL path parses `period` and `aggregation`, but the current service path does not pass them through, so PnL output is not aligned with the requested window.
4. Current PnL math is not using the requested 7-day-only model:
   - `pnl(i) = change(i) - NetInflow(i)`
   - `change(i)` = balance at start of day `i+1` minus balance at start of day `i`
   - `NetInflow(i)` = transfers in minus transfers out for day `i`

## Services to inspect

- `server/src/services/wallet/walletTransfersSwaps.service.ts`
- `server/src/services/wallet/db/walletDataCacher.ts`
- `server/src/services/wallet/db/walletDataRetriever.ts`
- `server/src/services/charts/pnlChart.service.ts`
- `server/src/services/wallet/walletCharts.service.ts`

## Why this matters

The wallet history layer needs a hard 7-day boundary for fresh fetches, but still must reuse cached data when the cache already covers a wider usable range. Without range-aware metadata, the service cannot tell whether it can serve older data from cache or must refetch.

PnL also needs to stop relying on broader historical reconstruction for this task. It should compute only from the last 7 days, using day-by-day balance change minus net inflow.

## Fix target

- Add cache range metadata for transaction cache rows.
- Enforce 7-day provider fetch limit.
- Allow cached data beyond 7 days when the stored range already covers it.
- Make historical PnL use the 7-day transaction window and the day formula above.
- Thread `period` and `aggregation` through the PnL service path only if they still matter after the 7-day rule is applied.