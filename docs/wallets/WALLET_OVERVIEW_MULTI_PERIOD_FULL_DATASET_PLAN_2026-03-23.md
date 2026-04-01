# Wallet Overview Multi-Period Full Dataset Plan (2026-03-23)

## Goal
Update wallet overview so the backend returns one full multi-period dataset (24H, 7D, 30D, 60D, 90D, All) in a single response, cached in one DB row with period-specific columns, and consumed client-side without re-requesting by period.

## Requested Functional Changes Mapped
1. Update getWalletOverview and getOverviewFromFreshCache to support 5 period versions.
2. Store those 5 versions in separate columns in the same wallet overview cache row.
3. Update buildActivitySnapshotFromProviders to fetch all periods, not only one period.
4. Remove period selector from route and service signatures; overview endpoint always returns all periods.
4. Expand response schema and UI:
- Total Asset Value includes 24H percent change.
- Trading Volume includes buy/sell count and buy/sell volume.
- Total PnL includes realized/unrealized PnL.
- Client switches period locally from full dataset.

## Scope
In scope:
- server/src/services/wallet/walletOverview.service.ts
- server/src/services/wallet/walletData.core.ts
- server/src/services/wallet/db/walletDataCacher.ts
- server/src/services/wallet/dtos/walletDataObjects.ts
- server/src/db/schema.ts
- server/src/routes/wallets.route.ts
- server/postgresdb/migrations/* (new migration)
- client/src/services/wallet/walletApi.ts
- client/src/components/wallet/WalletOverview/WalletOverview.tsx
- client/src/components/wallet/WalletOverview/WalletOverview.module.scss
- client/src/config/localization/en.ts
- client/src/config/localization/vi.ts

Out of scope (this iteration):
- Rebuilding provider integrations not already available in Birdeye summary payload.
- Redesigning unrelated wallet page sections.

## Design Decisions
1. Period set for overview dataset:
- Canonical periods: 24H, 7D, 30D, 90D, All.
- Backward compatibility: if request period is 1Y, map to All in response selection logic.

2. API contract strategy:
- Route returns full period dataset always.
- Route signature is changed to remove period query entirely.
- Service signature is changed to remove timePeriod option entirely.
- Client uses full dataset and switches period locally.

3. Cache freshness strategy:
- Use exactly 2 fetched_at columns for stale detection:
  - holdings_fetched_at
  - activity_fetched_at
- Freshness is evaluated at block level (holdings block and full-activity block), not per period.

4. Provider call strategy:
- Fetch Birdeye overall PnL for 5 durations in parallel with Promise.allSettled.
- Build partial dataset on failures; fill from cache if available.

## Target Response Contract
Add additive response type (example structure):

```json
{
  "address": "...",
  "availablePeriods": ["24H", "7D", "30D", "90D", "All"],
  "holdings": {
    "totalAssetValueUsd": 12345.67,
    "change24hPercent": -2.31,
    "tokensHoldingCount": 42,
    "source": "birdeye-portfolio"
  },
  "periods": {
    "24H": {
      "tradingVolumeUsd": 1000,
      "buy": { "transactionCount": 12, "volumeUsd": 600 },
      "sell": { "transactionCount": 8, "volumeUsd": 400 },
      "tokensTradedCount": 10,
      "transactionCount": 20,
      "pnl": {
        "totalUsd": 120,
        "realizedUsd": 80,
        "unrealizedUsd": 40
      },
      "source": "birdeye-overall-pnl"
    },
    "7D": {},
    "30D": {},
    "90D": {},
    "All": {}
  },
  "legacy": {
    "totalAssetValueUsd": 12345.67,
    "tradingVolumeUsd24h": 1000,
    "pnlUsdTotal": 120,
    "transactionCount24h": 20,
    "tokensTradedCount": 10,
    "tokensHoldingCount": 42,
    "metricsPeriod": "24h"
  }
}
```

Notes:
- Keep legacy top-level fields during migration window to avoid breaking existing consumers.
- Legacy fields should mirror the 24H period block.

## Data Model Plan (DB Schema + Migration)
Current wallet_overview_cache stores one period set. Expand same row with period-specific columns.

1. Keep existing columns temporarily for rollback safety.
2. Add period-prefixed columns for activity metrics:
- trading_volume_usd_24h, trading_volume_usd_7d, trading_volume_usd_30d, trading_volume_usd_90d, trading_volume_usd_all
- transaction_count_24h, transaction_count_7d, transaction_count_30d, transaction_count_90d, transaction_count_all
- tokens_traded_count_24h, tokens_traded_count_7d, tokens_traded_count_30d, tokens_traded_count_90d, tokens_traded_count_all

3. Add buy/sell split columns per period:
- buy_tx_count_*, sell_tx_count_*
- buy_volume_usd_*, sell_volume_usd_*

4. Add pnl split columns per period:
- pnl_total_usd_*, pnl_realized_usd_*, pnl_unrealized_usd_*

5. Add holdings extension columns:
- total_asset_value_change_24h_percent

6. Add freshness columns:
- holdings_fetched_at
- activity_fetched_at

7. Backfill strategy:
- Backfill only 24H columns from legacy columns where possible.
- Leave other period columns null and let runtime fill.

8. Cleanup phase (later migration):
- Remove old one-period columns after all consumers are migrated and stable.

## Backend Refactor Plan

### Phase 1: DTO and utility foundations
1. In walletDataObjects.ts add new types:
- WalletOverviewPeriodKey = "24H" | "7D" | "30D" | "90D" | "All"
- WalletOverviewPeriodStats
- WalletOverviewHoldingsStats
- WalletOverviewMultiPeriodResponse

2. Expand WalletOverviewCacheRow to include new columns.
3. Add period key maps in walletData.core.ts:
- OVERVIEW_PERIOD_KEYS constant
- mapPeriodToCacheColumnSuffix helper
- remove timePeriod-based selection helpers from service and route flow

### Phase 2: Cache read/write adaptation
1. Update getOverviewFromFreshCache:
- Read holdings freshness from holdings_fetched_at.
- Read activity freshness from activity_fetched_at.
- Return full dataset only when both blocks are fresh, otherwise rebuild both blocks.

2. Update saveOverviewCache (or create saveOverviewMultiPeriodCache):
- Upsert all available period blocks and only 2 fetched_at fields.
- Preserve existing cache values when incoming period data is missing.

### Phase 3: buildActivitySnapshotFromProviders to all periods
1. Replace single-period signature with all-period output:
- from: (address, timePeriod, cacheRow, periodSec)
- to: (address, cacheRow) => { periodSnapshots, providerFailuresByPeriod }

2. Execute Birdeye summary calls in parallel for durations:
- 24h, 7d, 30d, 90d, all

3. Map summary to expanded metrics:
- tradingVolumeUsd = total_invested + total_sold
- buy/sell transaction count and volume from summary counts/cashflow
- pnl total/realized/unrealized from summary pnl
- transactionCount = buyCount + sellCount (or total_trade when available)

4. Failure behavior:
- If period call fails: fallback to same period cache block.
- If both fail: null values, source none, and providerFailure true for that period.

### Phase 4: getWalletOverview orchestration
1. getWalletOverview should:
- Load cache row once.
- Try getOverviewFromFreshCache returning full dataset.
- Refresh holdings snapshot once.
- Refresh all activity periods once.
- Build WalletOverviewMultiPeriodResponse.
- Persist multi-period cache in one write.

Service signature change:
- from: getWalletOverview(address, options?: { timePeriod?: WalletOverviewTimePeriod })
- to: getWalletOverview(address)

2. Keep logging structured by period:
- cache hit/miss by period
- source by period
- provider failures by period

## Route Plan
1. Update /api/wallets/overview contract in wallets.route.ts:
- Return full multi-period payload always.
- Remove period query parameter from route signature.
- Route only accepts address.
- Route always calls getWalletOverview(address) and returns full dataset.

2. Validation updates:
- Remove parseOverviewTimePeriod from overview route path.
- Remove route-level period normalization/warning logic.

3. Versioning safety:
- Keep route path unchanged.
- Keep legacy scalar fields in payload until frontend migration is complete.

## Client Plan

### Phase 1: API typing
1. In walletApi.ts define WalletOverviewMultiPeriodResponse interface.
2. Update fetchWalletOverview return type from any to WalletOverviewMultiPeriodResponse.
3. Remove period argument from fetchWalletOverview request builder.
3. Keep compatibility with legacy payload fields during transition.

### Phase 2: WalletOverview component data model
1. Replace current single-overview assumptions with local period selection over response.periods.
2. Filter controls become pure client selectors:
- 24H, 7D, 30D, 90D, All
- remove request-time custom day slider for overview cards.

3. Derived UI selectors:
- selectedStats = periods[selectedPeriod]
- holdings from response.holdings

### Phase 3: UI metric expansion
1. Total Asset Value card:
- Show totalAssetValueUsd
- Show 24H | 7D | 30D change percentage badge/secondary line, 90d and all time use 30D version or not displaying at all 

2. Trading Volume card:
- Main value: period tradingVolumeUsd
- Sub lines:
  - Buy: count + volume
  - Sell: count + volume

3. Total PnL card:
- Main value: pnl.totalUsd
- Sub lines:
  - Realized
  - Unrealized

4. Keep tokens traded/holding cards; tie tokens traded to selected period and holding to holdings snapshot.

### Phase 4: localization and formatting
1. Add i18n keys for:
- buyTransactionCount
- buyVolume
- sellTransactionCount
- sellVolume
- realizedPnL
- unrealizedPnL
- change24hPercent
- allPeriod label

2. Number formatting:
- Currency for USD values.
- Signed percent formatting for 24H change.

## Utility Function Changes
In walletData.core.ts add/update utility helpers:
1. mapOverviewTimePeriodToBirdeyeDuration for all target periods.
2. mapBirdeyeSummaryToPeriodStats(summary) shared mapper.
3. buildLegacyOverviewFromDefaultPeriod (24H) for backward compatibility block.
4. selectOverviewPeriodStats(payload, period) for server and client reuse (optional shared utility pattern).

## Testing Plan

### Backend unit tests
1. getOverviewFromFreshCache:
- returns full dataset when both holdings_fetched_at and activity_fetched_at are fresh.
- invalidates full cache payload if either fetched_at field is stale.

2. buildActivitySnapshotFromProviders:
- maps successful provider payload for each period.
- falls back to cache per period on provider failures.
- handles complete provider failure gracefully.

3. getWalletOverview:
- cache hit returns without provider calls.
- cache miss fetches holdings + all periods and persists once.
- legacy fields mirror 24H period block.

### Route tests
1. /overview returns full dataset shape.
2. /overview rejects or ignores period query (depending on final validation policy) and still returns full dataset.
3. route calls getWalletOverview(address) with no period argument.

### Client tests
1. WalletOverview period switch updates displayed values without network call.
2. Trading volume sub rows render buy/sell count+volume.
3. PnL sub rows render realized/unrealized.
4. Asset value 24H percent renders with sign and fallback when null.

## Rollout and Safety
1. Deploy DB migration first.
2. Deploy backend with dual-read/write compatibility (legacy + new fields).
3. Deploy frontend consuming new structure.
4. After validation, remove legacy scalar-only write path and schedule column cleanup migration.

## Acceptance Criteria
1. One /overview response contains full metrics for 24H, 7D, 30D, 90D, All.
2. Cache row stores all period variants in separate columns in one row per address.
3. buildActivitySnapshotFromProviders fetches and maps all periods.
4. Client switches periods locally without extra API request.
5. UI shows:
- asset 24H percent change,
- trading buy/sell count and volume,
- pnl realized/unrealized.
6. Legacy consumers continue to work during migration window.

## Open Questions To Resolve Before Implementation
1. Confirm source for totalAssetValue 24H | 7D | 30D change percent:
- computed from net worth snapshots.

2. Confirm TTL policy:
- same TTL for all periods
