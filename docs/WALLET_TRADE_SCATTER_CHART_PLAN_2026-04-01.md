# WALLET_TRADE_SCATTER_CHART_PLAN_2026-04-01

## Goal
Implement a new chart component as a fork of `TimeSeriesLineChart` that overlays aggregated trade bubbles on top of token price history for use in `TokenAverageTradePrice`.

Core behavior:
- Show buy/sell trades as scatter points positioned by time (x) and price (y).
- Use point size to encode trade volume.
- Aggregate multiple trades at similar times into larger points.

## Target Integration
- Use in `TokenAverageTradePrice` in `client/src/pages/wallet/TokenDetailsDemo.tsx`.
- Keep existing avg buy/sell mark lines and line-series behavior.

## Data Contract

### Price Series (existing)
- Source: `client.api.tokens.markets.chart[":address"].daily`
- Shape used by chart:
  - `unixTimeMs: number`
  - `value: number`

### Trade Series (new/extended)
Trade rows should include per-trade price as first-class data.

Proposed normalized trade point shape:
- `unixTimeMs: number`
- `side: "buy" | "sell"`
- `volumeUsd: number`
- `price: number | null`
- `priceSource: "trade" | "mapped" | "missing"`
- `transactionHash?: string`

Pricing rules:
1. Prefer per-trade price from trade row directly (`priceSource: "trade"`).
2. If missing, map price from market series nearest to trade timestamp (`priceSource: "mapped"`).
3. If mapping cannot be produced (no market points), keep null and exclude from plotted scatter (`priceSource: "missing"`).

## New Component

### File
- `client/src/components/charts/TimeSeriesTradesScatterChart/index.tsx`

### Props
- Keep line-chart-compatible props where useful:
  - `data`, `markLines`, `loading`, `isDataSorted`, `height`, `className`, `valueFormatter`, `title`
- Add trade-specific props:
  - `trades: TradePoint[]`
  - `aggregation?: { timeBucketMs: number; priceBucketPercent?: number }`
  - `sizeScale?: { minPx: number; maxPx: number }`

### Visual Encoding
- Price line: same behavior as current line chart.
- Buy points: success color.
- Sell points: error color.
- Bubble radius: scaled by aggregated `volumeUsd` (sqrt scale to reduce outlier dominance).

## Aggregation Design
Aggregate trades before rendering to reduce clutter.

Grouping key:
- `timeKey = floor(unixTimeMs / timeBucketMs) * timeBucketMs`
- optional `priceKey` if `priceBucketPercent` configured
- group by `side + timeKey (+ priceKey)`

Per-group outputs:
- `side`
- `unixTimeMs` (bucket midpoint or weighted average timestamp)
- `price` (volume-weighted avg price)
- `volumeUsd` (sum)
- `tradeCount`
- optional `sampleTxHashes`

Important:
- Buy and sell must never merge into same aggregate.
- Exclude entries with invalid `volumeUsd <= 0`.
- Exclude entries with null/invalid `price` from scatter plotting.

## Price Mapping Algorithm (Fallback)
When trade price is absent:
1. Ensure market line data is sorted by `unixTimeMs`.
2. For each trade timestamp, find nearest market point in time.
3. Use nearest point `value` as mapped price.
4. Mark `priceSource: "mapped"`.

Implementation options:
- Simpler: linear scan for each trade (ok for small datasets).
- Preferred: binary-search nearest timestamp for better scale.

## Chart Option Structure (ECharts)
Series plan:
1. Line series for market price.
2. Scatter series for aggregated buys.
3. Scatter series for aggregated sells.

Tooltip requirements:
- Time, side, plotted price.
- Aggregated volume (USD).
- Number of trades aggregated.
- Price source indicator when helpful (trade vs mapped).

Mark lines:
- Preserve avg buy / avg sell mark lines from current usage.

## Integration Steps in TokenAverageTradePrice
1. Keep existing market line query (`priceData`).
2. Transform `recentTrades.data` into normalized `TradePoint[]`.
3. Fill trade price directly from row when available.
4. If missing, map from nearest `priceData` timestamp.
5. Pass normalized trades into new chart component.
6. Replace `TimeSeriesLineChart` usage in this panel with new forked chart.

## Default Aggregation by Time Range
Use adaptive bucket size:
- 7d -> 30m or 1h
- 30d -> 2h or 4h
- 90d -> 6h or 12h

Tune based on readability after manual QA.

## Testing Plan

### Unit Tests
- Aggregation correctness:
  - same bucket + same side merges
  - same bucket + different side does not merge
  - volume-weighted price is correct
  - summed volume and tradeCount are correct
- Price mapping correctness:
  - picks nearest market timestamp
  - handles before-first and after-last points
  - marks source as mapped

### Component Tests
- Renders line + buy scatter + sell scatter.
- Bubble size increases with volume.
- Tooltip includes side/volume/count/price.
- Empty states:
  - no line data
  - no valid trade points

### Manual QA
- Sparse wallet trades
- Burst trading windows (aggregation visible)
- Mixed buy/sell at near-identical time
- Missing trade price fallback behavior

## Rollout Plan
1. Add new chart component without removing current one.
2. Swap usage in `TokenAverageTradePrice`.
3. Verify visual parity for line + mark lines.
4. Validate tooltip and aggregation behavior on real wallet data.
5. Remove temporary debug logging before merge.

## Open Decisions
- Confirm exact trade field name for per-trade price in API response.
- Decide whether mapped price points should be visually distinguished from true trade-price points (optional style or tooltip badge).
