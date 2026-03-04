# Token Chart Routes & Caching

## Overview

Token chart data comes from the CoinGecko Demo plan, which has tight rate limits. To keep the number of outbound API calls low while still serving different time ranges on demand, the approach is:

- Fetch a wide fixed window from CoinGecko once and store every data point in the DB.
- On subsequent requests, serve directly from the DB.
- Only re-fetch when the cached data is considered stale (based on `unixUpdatedAtMs`).
- The DB query always filters by the caller's requested window, so the response is scoped correctly even though the cache is wider.

## Tables

**`token_market_chart_24h`**
Stores the last 24 hours of data at ~5-minute granularity (whatever CoinGecko returns for a 1-day range). Staleness threshold: 7 minutes. Updated incrementally — only fetches from the latest cached point to now.

**`token_market_chart_hourly`**
Stores up to ~90 days of data at hourly granularity. On a cache miss or stale check, the full 90-day window is re-fetched and upserted. The 2-minute offset (`TOKEN_CHART_HOURLY_FETCH_RANGE_MS`) keeps the request safely under CoinGecko's 90-day cutoff for hourly granularity, accounting for network latency. Staleness threshold: 30 minutes.

**`token_market_chart_daily`**
Same pattern as hourly, but covers up to ~365 days at daily granularity (the furthest the Demo plan allows). Staleness threshold: 6 hours.

`unixUpdatedAtMs` on hourly/daily rows records when the row was last written (in milliseconds). This is what the staleness check reads — not the data timestamp itself.

## Endpoints

```
GET /api/tokens/markets/chart/:address          — 24h chart, incremental updates
GET /api/tokens/markets/chart/:address/overview — proxied directly from CoinGecko /coins/{id}/market_chart, no DB cache (used for the overview page)
GET /api/tokens/markets/chart/:address/hourly?days=N  — default 7, max meaningful value is 90
GET /api/tokens/markets/chart/:address/daily?days=N   — default 30, max meaningful value is 365
```

`days` is validated as a positive number by `daysQuerySchema`. No runtime clamp is enforced yet — if `days` exceeds the fetch window (90 for hourly, 365 for daily), the response will be silently partial. A guard should be added when the routes stabilize.

## Staleness check

For hourly and daily, staleness is determined by the `unixUpdatedAtMs` of the last row within the requested window:

```
isStale = Date.now() - lastRow.unixUpdatedAtMs > THRESHOLD
```

If the DB has no rows for that address in the requested window, it is treated as a cache miss and a full fetch is triggered.

## Known TODOs

- Add a runtime clamp/validation on `days` to reject values that exceed the fetch window (90 for hourly, 365 for daily).
- `token_market_chart_30d` table exists in the schema but is not yet used by any service — it was a precursor to the current hourly/daily split and can be dropped in a future migration.
- The `overview` endpoint proxies directly and has no DB cache. If CoinGecko is slow or rate-limits, the client sees it directly. Consider caching it similarly if it becomes a problem.
