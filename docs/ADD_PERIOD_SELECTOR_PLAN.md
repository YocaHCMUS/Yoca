# Add Period Selector to Trading Charts

Date: 2026-03-28

## Summary

Add a time-period selector (button group) to these chart components so users can switch the displayed time range exactly like the `BalanceChart` window buttons. The selectable options must match `WalletOverview`'s `PERIOD_OPTIONS` (`24H`, `7D`, `30D`, `90D`, `All`).

## Goals

- Provide a single source-of-truth for period options.
- Implement a reusable `PeriodSelector` UI that renders as a row of buttons (BalanceChart-style).
- Integrate the selector into the three charts so `filters.timePeriod` updates and charts refresh automatically.
- Keep styling theme-aware and accessible.

## Scope

Targets:
- `client/src/components/charts/TotalTradingVolume/TotalTradingVolumeChart.tsx`
- `client/src/components/charts/TradingVolumeDistribution/TradingVolumeDistribution.tsx`
- `client/src/components/charts/TradingVolume/TradingVolumePerTransaction.tsx`

Shared/new files suggested:
- `client/src/config/periodOptions.ts` (export `PERIOD_OPTIONS`)
- `client/src/components/common/PeriodSelector/PeriodSelector.tsx` (reusable component)

## Requirements

- Options: `24H`, `7D`, `30D`, `90D`, `All`.
- Labels should be i18n keys identical to `WalletOverview` (e.g. `wallet.filter24h`, ...).
- Selector UI: button group styled like `BalanceChart` window toggle buttons — show active state, `aria-pressed`, keyboard focus.
- Integration must use existing `useChartFiltersSync` and call `setTimePeriod(selectedKey)` so the charts' queries (which use `filters.timePeriod`) automatically refresh.

## Implementation Plan

1. Shared constant
   - Create `client/src/config/periodOptions.ts`:
     ```ts
     export const PERIOD_OPTIONS = [
       { key: '24H', labelKey: 'wallet.filter24h' },
       { key: '7D', labelKey: 'wallet.filter7d' },
       { key: '30D', labelKey: 'wallet.filter30d' },
       { key: '90D', labelKey: 'wallet.filter90d' },
       { key: 'All', labelKey: 'wallet.filterAll' },
     ];
     ```
   - Replace any local `PERIOD_OPTIONS` definitions (e.g. in `WalletOverview`) to import from this file.

2. `PeriodSelector` component
   - Location: `client/src/components/common/PeriodSelector/PeriodSelector.tsx` (or existing UI folder).
   - Props: `value: string`, `onChange: (key: string) => void`, `options?: typeof PERIOD_OPTIONS`, `compact?: boolean`, `className?: string`.
   - Behavior: Render options as buttons; clicking a button calls `onChange(key)`; active button gets `aria-pressed` and active styles.
   - Styling: Reuse classes from Chart shared styles (`ChartStyle.module.scss`) where appropriate, or accept `className` for parent to style.

3. Integrate into charts (repeat for each chart)
   - Import `PERIOD_OPTIONS` and `PeriodSelector`.
   - Update `useChartFiltersSync` destructure to include `setTimePeriod` (it's already present in `BalanceChart`).
   - Render `<PeriodSelector value={filters.timePeriod} onChange={(k) => setTimePeriod(k)} />` in the chart control area (above or near existing controls). If a chart already has a compact control area, use `compact` mode.
   - Ensure initialFilters remain compatible — no change needed if charts use `filters.timePeriod` in their queries.

4. Styling & accessibility
   - Match `BalanceChart` toggle aesthetics: active class, focus ring, adequate hit area.
   - Ensure keyboard navigation and `aria-pressed` for each button.
   - Make compact layout for small widths (wrap or switch to dropdown if necessary).

5. Testing & verification
   - Manual: Start frontend, open pages with each chart, toggle periods and verify charts re-query and redraw with appropriate time window.
   - Edge cases: charts with empty data, charts already using local window toggles (avoid duplicate controls), multi-wallet vs single-wallet layouts.


## Notes / Gotchas

- `useChartFiltersSync` must expose `setTimePeriod` — verify the hook signature; `BalanceChart` already uses it.
- The `All` option semantics: decide whether `All` maps to a special server-side query value or simply a label; keep parity with `WalletOverview` behavior.

---

If you want, I can now:
- implement the shared `PERIOD_OPTIONS` and `PeriodSelector` (create files), or
- implement one chart integration as a sample PR.

Tell me which you prefer and I'll proceed.
