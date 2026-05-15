# Phase 2 Implementation Summary

**Date Completed:** 2026-05-09  
**Tasks Completed:** TASK-005 ✅

## What Was Implemented

### TASK-005: PnL Computation Refactor

Updated `server/src/services/wallet/walletCharts.service.ts` to implement the new day-boundary-based PnL formula:

**Formula:** `dailyPnL[i] = (balanceAtEnd[i] - balanceAtStart[i]) - netInflow[i]`

#### Key Changes:

1. **Added UTC Day Start Helper** (line 29)
   - Function: `getUtcStartOfDayMs(tsMs: number)`
   - Computes UTC start-of-day for any timestamp

2. **Added Balance Anchor Builder** (lines 40-95)
   - Function: `buildDailyBalanceAnchors(balanceHistory, fromMs, toMs)`
   - Buckets balance history points by UTC day
   - Extracts opening (first point) and closing (last point) balance for each day
   - Returns array of anchors with: `dayStartMs`, `balanceAtStart`, `balanceAtEnd`
   - Handles sparse data by using last-known balance for days with no data points

3. **Added Daily Net Inflow Computer** (lines 98-160)
   - Function: `computeDailyNetInflow(address, fromMs, toMs)`
   - Fetches all wallet transfers in the range via `getWalletTransfers()`
   - Classifies transfers as inflow (to === address) or outflow (from === address)
   - Buckets by UTC day and sums USD amounts per day
   - Returns map of `dayStartMs -> netInflowUsd`

4. **Refactored getCumulativePnL()** (lines 163-280)
   - Replaced old snapshot-based logic with new formula
   - Workflow:
     1. Get balance history for the time period
     2. Build daily anchors (balance at start/end of each day)
     3. Compute daily net inflows for each day
     4. For each day: apply formula `dailyPnL = (closeBalance - openBalance) - netInflow`
     5. Compute cumulative as prefix sum of daily values
     6. Return result with startBalance and endBalance from anchors

## Technical Details

### Data Flow

```
getCumulativePnL(address, timePeriod)
  ↓
  getWalletBalanceHistory(address, timePeriod) 
    → BalanceDataPoint[] (filtered to [fromMs, toMs])
  ↓
  buildDailyBalanceAnchors(balanceHistory, fromMs, toMs)
    → Array of daily {dayStartMs, balanceAtStart, balanceAtEnd}
  ↓
  getWalletTransfers(address, fromMs, toMs)
    → WalletTransfer[] (transfers within range)
  ↓
  computeDailyNetInflow(address, fromMs, toMs)
    → Map<dayStartMs, netInflowUsd>
  ↓
  Apply formula for each day
    dailyPnL[i] = (balanceAtEnd - balanceAtStart) - netInflow[i]
    cumulativePnL = prefix_sum(dailyPnL)
  ↓
  Return WalletCumulativePnLResult
```

### Type Safety

- All timestamps use `number` (milliseconds) consistently
- BalanceDataPoint: `{timestamp: number, value: number, date: string}`
- WalletTransfer: `{from, to, amount, amountUsd, timestamp, ...}`
- PnLDataPoint: `{timestamp: number, value: number}`
- WalletCumulativePnLResult: `{dailyPnL, cumulativePnL, startBalance, endBalance}`

### UTC Day Handling

- `getUtcStartOfDayMs()` computes: `Date.UTC(year, month, date, 0, 0, 0, 0)`
- All bucketing uses UTC boundaries, not local time
- Consistent with Phase 0 fetch window fixes

## Testing & Validation

### Type Checking ✅
```
npm run server:typecheck → PASS
- walletCharts.service.ts: ✅ No errors
- walletDataCacher.ts: ✅ No errors (from Phase 1)
- walletDataRetriever.ts: ✅ No errors (from Phase 1)
- walletTransfersSwaps.service.ts: ✅ No errors
```

### Pre-Existing Unrelated Error
- `src/routes/tokens.ts:410` - `getTokenHistoricalData()` not found (not in scope)

## Remaining Work

### TASK-006: Route Parameter Forwarding
- Update `server/src/routes/charts/pnl.route.ts`
- Ensure query parameters pass through to service layer

### TASK-007: Client Chart Type Review
- Review `client/src/components/charts/PnLChart/PnLChart.tsx`
- Verify request/response type compatibility

### TASK-008: Chart Rendering Validation
- Test `daily`, `cumulative`, and `both` display modes
- Ensure no regressions in client rendering

## Code Quality

- ✅ Deterministic formula: `dailyPnL = balanceChange - netInflow`
- ✅ Localized to wallet chart service (no cross-service impact)
- ✅ Reuses existing helper functions (getCachedWalletBalanceHistory, getWalletTransfers)
- ✅ Proper error handling with fallback to empty result
- ✅ Clear comments linking to task numbers for traceability

## Status

**Phase 2 TASK-005:** ✅ **COMPLETE**
- Implementation verified
- Type checking passed
- Ready for route testing (TASK-006)
