# Wallet Single Balance Chart Plan (2026-04-17)

## Goal
Build new chart component combining:
- Left wallet table layout style from AggregatedAssetDistribution
- Right single-line trend chart behavior from BalanceChart

Chart shows one mode only: selected wallet.

## UX Requirements
- Two-column layout.
- Left table columns:
  - Wallet name/label/address
  - Net worth
  - 24h balance change
- Wallet address clickable, routes to `/wallets/{walletAddress}`.
- Row click selects wallet for chart.
- Right chart renders one line only (selected wallet).
- Time window toggle: 7D and 30D.

## Data + State
- Reuse `fetchBalanceTrend` with `useStandardChartController`.
- Query params: `timePeriod`, `wallets`, `timezone`.
- Keep state:
  - `activeWalletAddress`
  - `chartWindowDays` (`7 | 30`)
- Normalize points:
  - numeric timestamp/value
  - sorted by timestamp
  - dedupe same timestamp (keep newest)

## Derived Metrics
- Net worth: last point value in wallet series.
- 24h change: `(latest - baseline) / baseline * 100`.
- Baseline:
  - nearest point <= latest-24h
  - fallback previous point
- If baseline missing or zero: show N/A.

## Rendering Plan
- Left panel:
  - `Table` with wallet identity renderer and link.
  - currency formatter for net worth.
  - signed percent formatter for 24h change.
  - selected row highlight.
- Right panel:
  - `ReactECharts` line config with one series.
  - x-axis time, y-axis compact currency.
  - tooltip timestamp + value.
  - 7D/30D segmented toggle.

## Empty/Loading/Error
- Loading from controller state.
- Empty state when no wallet series or no points.
- Retry button calls `refetch(false)`.

## File Plan
- New component under charts folder.
- New SCSS module for two-column panel + change colors.
- Wire export/index where chart registry exists.
- Add i18n keys for title, headers, 24h change label, aria labels, 7D/30D labels.

## Verification Checklist
- Table renders wallet/net worth/24h change.
- Wallet link navigates correctly.
- Row selection updates chart series.
- Chart always single line.
- 7D/30D toggle updates window and query period.
- Works desktop + mobile stacked layout.
