# Wallet Balance History Cache and Gap-Fill Plan (2026-03-22)

## Scope
Update `getWalletBalanceHistory` in `server/src/services/wallet/walletCharts.service.ts` to:
- normalize Birdeye time cursor formatting at UTC day start (`00:00:00`),
- move duplicated time helpers to appropriate shared utility files,
- add cache retrieval/write-through behavior,
- support partial-data gap filling when cache/provider data is incomplete.

## 1) Shared Helper Refactor

1. Move Birdeye time formatting helper out of `walletCharts.service.ts` into `server/src/util/util-birdeye.ts`.
2. Adjust formatter behavior to normalize any input timestamp to UTC day start before formatting as `YYYY-MM-DD HH:mm:ss`.
3. Move `timePeriodToCountAndLoop` out of `walletCharts.service.ts` into `server/src/services/wallet/walletTime.utils.ts`.
4. Extend period handling to include `60D` explicitly (already part of `WalletTimePeriod` union).

## 2) getWalletBalanceHistory Cache Flow

Implement a cache-first + provider-fill pipeline using DB storage in `walletCharts.service.ts`:

**Cache Point Semantics:** Cache stores UTC day-start points only (e.g., 2026-03-12 00:00:00). For the current day (today), always fetch the live current point-in-time intraday value; only cache one newest instance of today's point in memory (will not be added to the database).

**Flow:**
1. Resolve requested time window using existing range helpers (`getRangeStartMs`).
2. Separate window into:
   - `historicalWindow`: from requested start to yesterday's day-start (fully cacheable)
   - `todayWindow`: today's day-start to now (live, not cached)
3. Query `walletBalanceHistoryCache` table by `(address, timePeriod)` for historical window.
4. If cache row is fresh and fully covers historical window, deserialize cached points.
5. If cache is stale/partial or missing, fetch only missing historical segments from Birdeye.
6. Always fetch today's live point from Birdeye (intraday, current market value).
7. Merge cached historical points + fetched historical points + live today point.
8. Deduplicate by day key (only one point per UTC day).
9. Persist historical data (up to yesterday) with updated coverage, TTL, and serialized points to DB.
10. Return merged series (historical cached + historical fetched + live today).
11. On provider failure for historical ranges, return best available cached data. For today's live point, use most recent day's value if fetch fails.

## 3) Partial Coverage Gap Filling

After merging data sources:

1. Normalize to one data point per UTC day.
2. Build expected daily timeline for the request range.
3. Fill internal missing days using carry-forward (nearest prior known value).
4. Fill leading missing days with first known value in-range.
5. If no complete day points exist, fallback to portfolio total (`getFallbackPortfolioValueUsd`).
6. **Today's handling:** Top the series with today's live intraday point (current time, not day-start). Do not create a separate "today" day-start point if today is the final point in the series.
7. Keep output sorted ascending by timestamp and route-compatible.

## 4) Cursor Safety and Pagination Semantics

1. Use day-start formatter for both initial cursor and loop cursor updates.
2. Replace broad `-1 day` cursor shift with a boundary-safe decrement strategy that avoids duplicate-page anchors without skipping days.
3. Keep Birdeye request limits aligned with fetcher constraints (`count <= 30`, normalized time parameter).

## 5) Database Schema for Balance History Cache

Add a new table `walletBalanceHistoryCache` to `server/src/db/schema.ts`:

```typescript
export const walletBalanceHistoryCache = pgTable(
  "wallet_balance_history_cache",
  {
    address: varchar("address", { length: 66 }).notNull(),
    timePeriod: varchar("time_period", { length: 10 }).notNull(),
    data: jsonb("data")
      .$type<
        Array<{
          timestamp: number;
          value: number;
          date: string;
          changeUsd: number;
          changePercent: number;
        }>
      >()
      .notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
    coveredFromMs: bigint("covered_from_ms").notNull(),
    coveredToMs: bigint("covered_to_ms").notNull(),
  },
  (t) => [primaryKey({ columns: [t.address, t.timePeriod] })],
);
```

**Columns:**
- `address`: wallet address (PK component)
- `timePeriod`: e.g., "7D", "30D", "60D", "90D", "1Y", "All" (PK component)
- `data`: serialized array of `BalanceDataPoint` objects
- `fetchedAt`: timestamp of last cache write (TTL reference)
- `coveredFromMs`: earliest UTC day-start millisecond in cached data
- `coveredToMs`: latest UTC day-start millisecond in cached data

**Usage:**
- Query: `SELECT * FROM walletBalanceHistoryCache WHERE address = $1 AND timePeriod = $2`
- Upsert on write with `onConflictDoUpdate` to update `data`, `fetchedAt`, coverage bounds.

## 5) Testing Plan

Add/extend tests for:

1. Formatter behavior in `util-birdeye.ts`:
   - ISO input => day-start format,
   - already-formatted string => day-start normalized output,
   - invalid input handling.

2. Cache Point Semantics:
   - Today's intraday point is always fetched fresh (not from cache).
   - Yesterday's fully-completed day is cached and reused on subsequent requests.
   - `coveredToMs` in cache never includes today's day-start.
   - Cache entry is persisted only up to yesterday's end.

3. `getWalletBalanceHistory` service behavior:
   - DB cache hit for historical range avoids provider fetch for those days.
   - Today's point is always fetched from Birdeye, even when cache is fresh.
   - Partial historical cache fetches only missing historical segments.
   - Merged series has no duplicate days.
   - Gap filling produces continuous daily points.
   - `60D` mapping and output length expectations.
   - Cache upsert writes correct coverage bounds (max `coveredToMs` = yesterday's day-start).

4. DB retriever and cacher:
   - Freshness check uses fetchedAt + TTL threshold.
   - Coverage calculation from coveredFromMs/To (never includes today).
   - Serialization/deserialization of points array.
   - Upsert correctly expands coverage bounds on each refresh.

5. Route compatibility in `server/src/routes/charts/balance.route.ts` response shape remains stable.

## 6) Suggested Rollout Order

1. Add DB schema migration for `walletBalanceHistoryCache` table.
2. Helper extraction and import updates.
3. DB retriever and cacher helper functions.
4. Cache-flow service logic with DB read/write.
5. Partial-range provider fetch and merge.
6. Gap-fill post-processing.
7. Tests and diagnostics run.

## 7) DB Cache Implementation Details

**Cache TTL:** 15 minutes (`BALANCE_HISTORY_CACHE_TTL_MS = 15 * 60 * 1000`).

**Cache Point Semantics:**
- Cache stores complete UTC days only (daily snapshots at 00:00:00 UTC).
- Today's point is always fetched live (intraday, current time) and **never cached**.
- This ensures portfolio values reflect real-time changes within the current trading day.
- When yesterday's calendar day finishes (UTC midnight), the final live point becomes cacheable.

**Cache Coverage Tracking:**
- `coveredFromMs`: earliest cached day-start (e.g., 2026-03-05 00:00:00)
- `coveredToMs`: latest cached day-start (e.g., 2026-03-11 00:00:00, never includes today)

**Retriever function** (in `server/src/services/wallet/db/walletDataRetriever.ts`):
```typescript
export async function getCachedWalletBalanceHistory(
  address: string,
  timePeriod: WalletTimePeriod,
): Promise<{ points: BalanceDataPoint[]; coveredFromMs: number; coveredToMs: number } | null> {
  const threshold = new Date(Date.now() - BALANCE_HISTORY_CACHE_TTL_MS);
  const rows = await db
    .select()
    .from(walletBalanceHistoryCache)
    .where(and(
      eq(walletBalanceHistoryCache.address, address),
      eq(walletBalanceHistoryCache.timePeriod, timePeriod),
      gte(walletBalanceHistoryCache.fetchedAt, threshold),
    ))
    .limit(1);

  if (rows.length === 0) return null;
  
  return {
    points: rows[0].data,
    coveredFromMs: Number(rows[0].coveredFromMs),
    coveredToMs: Number(rows[0].coveredToMs),
  };
}
```

**Cacher function** (in `server/src/services/wallet/db/walletDataCacher.ts`):
```typescript
export async function saveBalanceHistoryCache(
  address: string,
  timePeriod: WalletTimePeriod,
  points: BalanceDataPoint[],      // historical points only, excludes today
  coveredFromMs: number,            // earliest day-start
  coveredToMs: number,              // latest day-start (never today)
): Promise<void> {
  await db
    .insert(walletBalanceHistoryCache)
    .values({
      address,
      timePeriod,
      data: points,
      coveredFromMs,
      coveredToMs,
    })
    .onConflictDoUpdate({
      target: [walletBalanceHistoryCache.address, walletBalanceHistoryCache.timePeriod],
      set: {
        data: points,
        fetchedAt: new Date(),
        coveredFromMs,
        coveredToMs,
      },
    });
}
```

**Service logic** (in `walletCharts.service.ts`):
```typescript
const todayDayStartMs = toUtcDayStartMs(nowMs);
const yesterdayEndMs = todayDayStartMs - 1;  // last moment of yesterday

// Split window: historical (cacheable) vs today (live only)
const historicalToMs = Math.min(requestedToDayMs, yesterdayEndMs);

// Fetch from cache: only use if coverage includes historical range
const cachedEntry = await getCachedWalletBalanceHistory(address, timePeriod);
if (cachedEntry && isCacheFreshAndCovering(cachedEntry, requestedFromMs, historicalToMs, nowMs)) {
  historicalPoints = cachedEntry.points;  // use cached historical
}

// Fetch missing historical segments (if any)
const missingHistoricalSegments = getMissingSegments(cachedEntry, requestedFromMs, historicalToMs);
// ... fetch from Birdeye for each missing segment...

// Always fetch today's live point (intraday current)
if (requestedToDayMs >= todayDayStartMs) {
  const todayLivePoint = await fetchBirdeyeRange(address, todayDayStartMs, nowMs, count);
  // Add to result but DO NOT include in cache write
}

// Cache only historical (up to yesterday), exclude today's point
const pointsToPersist = dedupeAndSortByDay([
  ...historicalPoints,
  ...fetchedHistoricalPoints,
  // exclude today
]);
const persistCoverageToMs = Math.min(pointsToPersist[last].timestamp, yesterdayEndMs);
await saveBalanceHistoryCache(address, timePeriod, pointsToPersist, ..., persistCoverageToMs);

// Return all points including today's live point
return fillDailySeriesGaps([...pointsToPersist, ...todayLivePoint], requestedFromMs, requestedToDayMs, fallback);
```

## Open Decision

**Cache persistence mode (DECIDED):**

Use **DB-backed cache** (cross-instance consistency, multi-server support).
- Schema migration required: add `walletBalanceHistoryCache` table.
- Follows existing project patterns (`walletPortfolioCache`, `walletOverviewCache`).
- Supports horizontal scaling and cache invalidation across instances.
- Query performance optimized with composite primary key `(address, timePeriod)`.
