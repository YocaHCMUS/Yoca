# Wallet PnL Chart Service – Snapshot-Based Refactor Plan
**Date:** March 22, 2026  
**Scope:** Update `getCumulativePnL` and supporting functions to use Birdeye daily portfolio snapshots instead of transaction-based reconstruction

---

## Current State Analysis

### ❌ Problems with Current Approach (`getHistoricalPortfolioValueSeries`)
1. **Transaction-based reconstruction**: Fetches all transactions, processes balance changes backwards
   - Complex state machine logic prone to edge cases
   - Must handle all balance change types correctly
   - High computational cost for long historical windows

2. **Redundant data fetching**: Calls both `getWalletPortfolio()` (current state) + transaction history
   - Current portfolio used only as initial balance seed
   - Then reconstructs backwards through transactions

3. **Duplicate work with token balance history**: `getWalletTokenBalanceHistory` already implemented Birdeye snapshot path
   - Two different implementations for similar problem
   - Opportunity to consolidate and improve both

4. **Limited data quality**: Relies on transaction accuracy and completeness
   - May miss some balance changes
   - Dependent on Helius API reliability

---

## Proposed Solution: Snapshot-Based Architecture

### ✅ Key Advantages
1. **Direct state snapshots**: Use Birdeye's daily portfolio snapshots as source of truth
   - Each day = complete asset list with balances
   - No backward reconstruction needed

2. **Simplified delta calculation**: 
   ```
   Day N+1 Portfolio Value (USD) - Day N Portfolio Value (USD) = Daily PnL
   ```
   - Direct, verifiable, no complex state machines

3. **Leverages existing infrastructure**: Reuse `getBirdeyePortfolioSnapshotCached`
   - Already used by `getWalletTokenBalanceHistory`
   - Proven concurrency patterns (mapWithConcurrency)
   - Built-in error handling and caching

4. **Unrealized PnL focus**: Better suited for daily snapshots
   - Snapshots include current price data for each asset
   - No need to reconstruct historical prices across transactions

5. **Code consolidation**: Reduces duplication between token balance and PnL logic

---

## Implementation Plan

### Phase 1: Create New Snapshot-Based Function

**New function: `getHistoricalPortfolioValueSeriesFromSnapshots`**

Location: `server/src/services/wallet/walletCharts.service.ts`

```typescript
async function getHistoricalPortfolioValueSeriesFromSnapshots(
    address: string,
    startMs: number,
    endMs: number,
): Promise<PnLDataPoint[]> {
    // 1. Get daily snapshot timestamps for the range
    const requestedFromSec = Math.floor(startMs / 1000);
    const requestedToSec = Math.floor(endMs / 1000);
    const daySecList = getDailySnapshotSecRange(requestedFromSec, requestedToSec);

    if (daySecList.length === 0) {
        return [];
    }

    // 2. Fetch all daily snapshots with concurrency
    const dailySnapshots = await mapWithConcurrency(
        daySecList,
        PORTFOLIO_SNAPSHOT_CONCURRENCY, // Consider: 3-4
        async (daySec) => {
            try {
                const snapshot = await getBirdeyePortfolioSnapshotCached(
                    address,
                    daySec,
                    requestedToSec,
                );
                return { daySec, snapshot, error: null };
            } catch (error) {
                return { daySec, snapshot: null, error };
            }
        },
    );

    // 3. Calculate portfolio value for each snapshot
    const portfolioValues = dailySnapshots
        .map((entry) => {
            const timestamp = entry.daySec * 1000;

            if (!entry.snapshot) {
                return {
                    timestamp,
                    value: 0,
                    error: entry.error,
                };
            }

            // Sum all asset values from snapshot
            const totalUsd = (entry.snapshot.assets ?? []).reduce(
                (sum, asset) => sum + Number(asset.valueUsd ?? 0),
                0,
            );

            return {
                timestamp,
                value: Math.max(0, totalUsd),
                error: null,
            };
        })
        .filter((point) => point.error === null)
        .map(({ timestamp, value }) => ({ timestamp, value }));

    // 4. Handle gaps (only if snapshot fetch failed)
    if (portfolioValues.length === 0) {
        return [];
    }

    // Fill gaps using carry-forward (last known value)
    return fillPortfolioValueGaps(portfolioValues, startMs, endMs);
}

/**
 * Fill gaps in portfolio value series (for days where snapshots failed)
 */
function fillPortfolioValueGaps(
    points: PnLDataPoint[],
    fromMs: number,
    toMs: number,
): PnLDataPoint[] {
    if (points.length === 0) {
        return [];
    }

    const result: PnLDataPoint[] = [];
    const startDay = getUtcDayStart(fromMs);
    const endDay = getUtcDayStart(toMs);

    const pointsByDay = new Map<string, PnLDataPoint>();
    for (const point of points) {
        const dayKey = getUtcDayStart(point.timestamp).toISOString().split("T")[0];
        pointsByDay.set(dayKey, point);
    }

    let current = startDay.getTime();
    let lastKnownValue = 0;

    while (current <= endDay.getTime()) {
        const dayKey = new Date(current).toISOString().split("T")[0];
        const point = pointsByDay.get(dayKey);

        if (point) {
            result.push(point);
            lastKnownValue = point.value;
        } else {
            // Gap: use carry-forward
            result.push({ timestamp: current, value: lastKnownValue });
        }

        current += 24 * 60 * 60 * 1000;
    }

    return result;
}
```

---

### Phase 2: Update `getCumulativePnL` Function

**Changes to existing function:**

```typescript
export async function getCumulativePnL(
    address: string,
    timePeriod: WalletTimePeriod = "30D",
    aggregation: PnLAggregation = "daily",
): Promise<WalletCumulativePnLResult> {
    const rangeSec = resolveWalletTimeRangeSec(timePeriod);
    const fromMs = rangeSec.fromSec * 1000;
    const toMs = rangeSec.toSec * 1000;

    try {
        // ✨ NEW: Use snapshot-based portfolio values
        const snapshots = await getHistoricalPortfolioValueSeriesFromSnapshots(
            address,
            fromMs,
            toMs,
        );

        if (snapshots.length === 0) {
            return emptyPnL();
        }

        const startingValue = snapshots[0]?.value ?? 0;
        let previousValue = startingValue;

        // Calculate daily PnL as delta between consecutive days
        const dailyPnL: PnLDataPoint[] = snapshots.map((point, index) => {
            const delta = index === 0 ? 0 : point.value - previousValue;
            previousValue = point.value;
            return {
                timestamp: point.timestamp,
                value: roundUsd(delta),
            };
        });

        // Calculate cumulative PnL
        const cumulativePnL: PnLDataPoint[] = snapshots.map((point) => ({
            timestamp: point.timestamp,
            value: roundUsd(point.value - startingValue),
        }));

        return {
            dailyPnL,
            cumulativePnL,
            startBalance: roundUsd(startingValue),
            endBalance: roundUsd(snapshots[snapshots.length - 1]?.value ?? 0),
        };
    } catch (error) {
        console.error("[WalletCumulativePnL] failed to compute series", {
            address,
            timePeriod,
            error,
        });
        return emptyPnL();
    }
}
```

**Key changes:**
- Replace `getHistoricalPortfolioValueSeries()` with `getHistoricalPortfolioValueSeriesFromSnapshots()`
- Remove `aggregation` parameter usage (snapshots are always daily; aggregation can be done in client)
- Simpler error handling (no transaction pagination)

---

### Phase 3: Deprecation & Migration Strategy

<!-- #### Option A: Direct Replacement (Recommended) -->
1. Rename `getHistoricalPortfolioValueSeries` → `getHistoricalPortfolioValueSeries_DEPRECATED`
2. Implement new snapshot-based functions
3. Update `getCumulativePnL` to use new path
4. Remove old function once tested

<!-- #### Option B: Parallel Implementation
1. Keep both implementations
2. Add feature flag: `USE_SNAPSHOT_BASED_PNL`
3. Route traffic gradually to new path
4. Monitor metrics before full cutover

**Recommendation:** Option A (direct replacement) due to:
- Cleaner codebase
- Snapshot approach is objectively better
- Can be tested in staging first
- Gradual rollout not critical for backend service -->

---

## Data Flow Comparison

### Current Flow (Transaction-Based)
```
getCumulativePnL
  ↓
getHistoricalPortfolioValueSeries
  ├─ getWalletPortfolio() [current state only]
  ├─ getWalletTransactionHelius() [all transactions]
  ├─ Reconstruct balance backwards through tx
  ├─ Fetch token market data for all tokens
  ├─ Fetch price timelines (hourly/daily)
  ├─ Calculate value at each snapshot
  └─ Return portfolio values

Calculate dailyPnL/cumulativePnL
```

**Problems:** Complex state machine, redundant data fetches, high computation

---

### New Flow (Snapshot-Based)
```
getCumulativePnL
  ↓
getHistoricalPortfolioValueSeriesFromSnapshots
  ├─ getDailySnapshotSecRange() [day list]
  ├─ mapWithConcurrency(getBirdeyePortfolioSnapshotCached)
  ├─ Extract valueUsd from each snapshot
  ├─ Sum assets per day
  ├─ Fill gaps with carry-forward
  └─ Return portfolio values

Calculate dailyPnL/cumulativePnL
```

**Advantages:** Simpler, fewer API calls, snapshot data already has pricing

---

## Unrealized PnL Considerations

### What We Calculate (Unrealized)
- **Definition**: Current portfolio value - starting portfolio value
- **Scope**: Within requested time window (e.g., 30D)
- **Data needed**: Daily portfolio snapshots + daily asset prices
- **Accuracy**: Limited by Birdeye snapshot daily frequency

### What We Don't Handle (Realized)
- **Definition**: Gains/losses on closed positions
- **Limitations in 30D window**:
  - Can't distinguish deposits vs. gains
  - Traded amounts not in current portfolio
  - Historical cost basis complex to reconstruct
  - Would need complete transaction history + market prices at execution
- **Status**: OUT OF SCOPE for this update (noted in docs)

### Edge Cases Handled
1. **Zero portfolio**: Empty snapshots → return 0
2. **Snapshot gaps**: Use carry-forward (last known value)
3. **Failed snapshots**: Skip those days, fill with previous value
4. **Stale cache**: `getBirdeyePortfolioSnapshotCached` handles expiration
5. **SOL vs symbol normalization**: Handled by snapshot service

---

## Implementation Checklist

- [ ] **Phase 1: New Functions**
  - [ ] Implement `getHistoricalPortfolioValueSeriesFromSnapshots()`
  - [ ] Implement `fillPortfolioValueGaps()`
  - [ ] Add `PORTFOLIO_SNAPSHOT_CONCURRENCY` constant
  - [ ] Add test cases

- [ ] **Phase 2: Update getCumulativePnL**
  - [ ] Update function to call new snapshot service
  - [ ] Remove aggregation dependency
  - [ ] Test with various time periods

- [ ] **Phase 3: Testing**
  - [ ] Unit tests: Empty portfolio, single day, multi-day
  - [ ] Integration tests: Compare before/after values
  - [ ] Edge cases: Gaps, failed snapshots, SOL/wrapped handling
  - [ ] Performance: Concurrency limits, cache hits

- [ ] **Phase 4: Cleanup**
  - [ ] Deprecate old `getHistoricalPortfolioValueSeries` (or remove)
  - [ ] Update type definitions if needed
  - [ ] Remove transaction-related code paths
  - [ ] Update docs/comments

- [ ] **Phase 5: Deployment**
  - [ ] Deploy to staging
  - [ ] Validate against production data
  - [ ] Monitor logs for errors
  - [ ] Deploy to production

---

## Constants to Define

```typescript
// Concurrency for portfolio snapshot fetches
const PORTFOLIO_SNAPSHOT_CONCURRENCY = 4; // or match TOKEN_BALANCE_SNAPSHOT_CONCURRENCY

// Carry-forward threshold (days without gap before skipping)
const MAX_GAP_DAYS = 7; // optional: if gap > 7 days, return 0 instead of carry-forward

// Re-export from existing if available
const DAY_MS = 24 * 60 * 60 * 1000;
```

---

## Logging & Monitoring

Add instrumentation points:

```typescript
// In getHistoricalPortfolioValueSeriesFromSnapshots
console.log("[pnl-snapshot-series]", {
    address,
    startMs,
    endMs,
    daysRequested: daySecList.length,
    daysSuccessful: portfolioValues.length,
    gapsFilled: portfolioValues.length - dailySnapshots.filter(s => s.snapshot).length,
});

// In getCumulativePnL
console.log("[cumulative-pnl]", {
    address,
    timePeriod,
    snapshotsCount: snapshots.length,
    startBalance: startingValue,
    endBalance: snapshots[snapshots.length - 1]?.value,
    cumulativePnL: cumulativePnL[cumulativePnL.length - 1]?.value,
});
```

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Snapshot data gaps | Carry-forward strategy; acceptable for unrealized PnL |
| Daily granularity loss | Document that sub-daily PnL not available; snapshots are daily |
| Price stale in snapshot | Birdeye manages this; acceptable for daily aggregation |
| Concurrency limits | Set `PORTFOLIO_SNAPSHOT_CONCURRENCY` conservatively (4) |
| Cache invalidation | Trust `getBirdeyePortfolioSnapshotCached` TTL logic |

---

## Testing Strategy

### Unit Tests
```typescript
// getHistoricalPortfolioValueSeriesFromSnapshots
- Empty portfolio → []
- Single day → 1 point
- Multi-day with all snapshots → N points
- Multi-day with gaps → N points with carry-forward

// fillPortfolioValueGaps
- No gaps → original points
- Leading gap → filled with 0 or first value
- Middle gaps → filled with carry-forward

// getCumulativePnL  
- Zero starting value → cumulative = 0
- Increasing values → positive dailyPnL
- Decreasing values → negative dailyPnL
- Various timePeriods (7D, 30D, 90D, 1Y)
```

### Integration Tests
- "Snapshot path" vs "fallback path" in getWalletTokenBalanceHistory
- Compare snapshot-based PnL with transaction-based (old) for validation period
- Real wallet addresses with known behavior

---

## Success Criteria

✅ **Performance**
- P99 latency < 1000ms for 30D request
- 80%+ cache hit rate on snapshots
- Concurrency doesn't exceed Birdeye limits

✅ **Correctness**
- PnL values match Birdeye net worth daily deltas
- Cumulative PnL = last day value - first day value
- No negative value errors

✅ **Reliability**
- Graceful handling of failed snapshots
- Proper error logging
- No infinite gaps

✅ **Code Quality**
- Type-safe, no `any` types
- Reusable utilities shared with token balance service
- Comprehensive JSDoc comments

---

## Open Questions / Notes

1. **Aggregation parameter**: Should `getCumulativePnL` still accept `aggregation`?
   - Current: Used to set interval for snapshots
   - New: Snapshots always daily
   - Recommendation: Remove parameter from backend; let client aggregate if needed

2. **Transaction pagination**: Old function supported `beforeCursor` and `transactionLimit`
   - These are not needed with snapshot approach
   - Remove to simplify interface

3. **Realized PnL future work**:
   - Consider separate function `getRealizedPnL()` later
   - Would require transaction cost-basis tracking
   - Out of scope for 30D window approach

4. **Other aggregations** (hourly, weekly):
   - Can be done client-side on daily snapshots
   - Or add post-processing in backend if needed
   - Keep simple for now

