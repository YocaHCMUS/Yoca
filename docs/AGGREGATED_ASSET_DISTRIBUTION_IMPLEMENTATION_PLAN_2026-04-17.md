# Aggregated Asset Distribution Chart - Implementation Plan (2026-04-17)

## Goal
Add new chart named Aggregated Asset Distribution, based on existing AssetDistribution behavior, with 2-column in-chart layout:
- Column 1: Wallet selector table.
- Column 2: Single donut chart driven by active mode.

Chart has 2 modes (header toggle):
- Default mode: Single Wallet.
  - No Is Selected checkbox column in wallet table.
  - Clicking wallet row makes that wallet active and chart updates to that wallet only.
- Alternative mode: Multiple Aggregated.
  - Wallet table shows Is Selected checkbox column.
  - Chart aggregates data from selected wallets.
  - Table header shows selection summary text: "x wallets selected".

Chart must preserve key filter/export capabilities already used in AssetDistribution:
- Top token filtering (Top 5, Top 10, All).
- Minimum value filtering (aligned with existing minimum-threshold behavior in current chart UX).
- Export support (PNG/SVG/PDF/CSV) through existing chart export flow.

## Functional Requirements

### 1) Chart shell and layout
- Reuse ChartWrapper container pattern used by current chart components.
- Inside wrapper body, render a fixed 2-column responsive layout:
  - Left column: wallet selector table panel.
  - Right column: one donut chart panel.
- On narrow screens, stack columns vertically (table first, chart second).

### 2) Wallet selector table (left column)
Implementation note:
- Wallet selector must use shared Table component from client/src/components/tables/Table.tsx (not a custom ad-hoc table markup).

Table columns (Single Wallet mode):
- Wallet Name
- Wallet Address
- Net Worth
- Unique Token Count

Table columns (Multiple Aggregated mode):
- Wallet Name
- Wallet Address
- Net Worth
- Unique Token Count
- Is Selected (checkbox)

Behavior:
- Each row maps to one wallet from upstream wallet distribution payload.
- Single Wallet mode:
  - Row click sets active wallet.
  - Active wallet row has clear selected styling.
  - No checkbox interactions.
- Multiple Aggregated mode:
  - Checkbox toggles inclusion/exclusion from aggregate computation.
  - Default state: all wallets selected when entering this mode.
  - Table header renders "x wallets selected" summary.
- Prevent invalid empty selection state by either:
  - disallowing uncheck of last selected wallet, or
  - allowing empty and showing deterministic empty-chart state.
  Chosen behavior should match existing multi-select patterns in codebase.

### 3) Aggregated donut chart (right column)
- Single donut visual, not per-wallet grid.
- Dataset source by mode:
  - Single Wallet mode: tokens from active wallet only.
  - Multiple Aggregated mode: merge tokens from selected wallets.
- Grouping/filtering behavior mirrors AssetDistribution:
  - Apply top token filter.
  - Apply minimum value filter.
  - Merge remaining into Others when needed.
- Tooltip shows token value and percentage; Others tooltip lists hidden token names.
- Center label shows total value for active wallet (single mode) or selected wallets (aggregated mode).

### 4) Header controls
- Add mode toggle button group in header actions:
  - Single Wallet (default)
  - Multiple Aggregated
- Toggle changes table interaction model and chart data source.

### 5) Filter controls
- Keep top token filter control in chart actions area.
- Keep minimum value filter control in chart actions area.
- Filter UI style should match shared chart control styles already used in AssetDistribution.

### 6) Export behavior
- Use existing runChartExport + useChartExport pipeline.
- Export output reflects active mode, selected/active wallets, and active filters.
- CSV export rows should represent exact donut dataset currently displayed.
- Export metadata includes mode + filter values + selected-wallet context.

## Data and Aggregation Design

### Source shape (current expectation)
- Use wallet-scoped data from fetchAssetDistribution response (wallets[] with walletAddress + token rows).

### New view model for table
Per wallet compute and expose:
- walletName: resolved display name (fallback strategy below).
- walletAddress
- netWorth: sum of token values in wallet dataset (or dedicated field if backend provides it).
- uniqueTokenCount: count of unique token names in wallet dataset.
- isSelected: UI state (aggregated mode only).
- isActive: UI state (single-wallet mode only).

Chart mode state:
- mode: single | aggregate
- activeWalletAddress: used in single mode
- selectedWalletAddresses: used in aggregate mode

Wallet name fallback order:
1. explicit backend wallet label/name if available,
2. existing identity/alias source if already available in chart context,
3. shortened address.

### Aggregation algorithm
1. Collect token rows from selected wallets.
2. Normalize by token key (prefer token address/symbol key if present; fallback token name).
3. Sum value across wallets per token.
4. Recompute percentages against aggregate total.
5. Apply top/min grouping helper logic.
6. Emit final pie data + Others hiddenNames.

Important:
- Keep deterministic sorting (desc by value) before grouping.
- Keep number formatting/precision consistent with existing chart helpers.

## Implementation Plan

## Phase 1 - Create new chart component scaffold
Files:
- client/src/components/charts/AggregatedAssetDistribution/AggregatedAssetDistribution.tsx (new)
- client/src/components/charts/AggregatedAssetDistribution/index.ts (new)

Tasks:
- Clone structural patterns from AssetDistribution:
  - filter sync,
  - standard chart controller,
  - chart theme,
  - export hook integration.
- Rename chart title localization key namespace for new chart.
- Keep code isolated (do not regress existing AssetDistribution).

## Phase 2 - Build two-column layout and selector table
Files:
- client/src/components/charts/AggregatedAssetDistribution/AggregatedAssetDistribution.tsx
- client/src/components/charts/shared or style module used by chart (only if shared layout class needed)
- client/src/components/tables/Table.tsx (reuse only; extend props only if required)

Tasks:
- Replace per-wallet chart grid with 2-column layout container.
- Implement wallet selector table panel with mode-aware columns using shared Table component.
- Add mode toggle control in chart header actions (default single).
- Add active-wallet state (single mode) and selected-wallet state (aggregate mode).
- Initialize active wallet and aggregate selections when data changes.
- Render "x wallets selected" at table header in aggregate mode.
- If Table lacks needed interaction hooks (row click, custom checkbox cell), add minimal backward-compatible extension instead of bypassing Table.

Accessibility:
- Checkbox aria-label includes wallet address/name.
- Table headers semantic and keyboard-operable controls.
- Mode toggle has clear aria-pressed semantics for active option.

## Phase 3 - Implement aggregation pipeline
Files:
- client/src/components/charts/AggregatedAssetDistribution/AggregatedAssetDistribution.tsx
- optional helper extraction file if logic grows

Tasks:
- Add memoized mode-aware dataset builder:
  - single mode -> active wallet data,
  - aggregate mode -> merged selected wallet data.
- Reuse/port applyGrouping behavior from AssetDistribution.
- Generate single ECharts option for aggregated dataset.
- Preserve tooltip, Others handling, center total label.

## Phase 4 - Integrate filter controls and export
Files:
- client/src/components/charts/AggregatedAssetDistribution/AggregatedAssetDistribution.tsx

Tasks:
- Keep top token + minimum value controls in actions area.
- Ensure chart redraw follows mode, wallet click/selection, and filter changes.
- Wire export handlers:
  - PNG/SVG/PDF from chart instance,
  - CSV from final aggregated dataset.
- Include extraFilters metadata for export output, including mode and wallet selection summary.

## Phase 5 - Localization and labels
Files:
- client/src/config/localization/en.ts
- client/src/config/localization/vi.ts

Tasks:
- Add localized keys for:
  - chart title,
  - filter labels,
  - wallet table headers,
  - selection checkbox label text,
  - empty/loading messages,
  - export naming.

## Phase 6 - Registration and page integration
Files:
- chart registry/config locations where AssetDistribution-like charts are wired

Tasks:
- Register new Aggregated Asset Distribution chart entry.
- Ensure it appears in intended dashboard/page placement.
- Keep old AssetDistribution available unless explicitly replaced by product decision.

## Phase 7 - Tests

### Frontend unit/component tests
Suggested targets:
- Aggregation correctness across multiple wallets.
- Single mode row click updates donut and center total.
- Aggregate mode checkbox toggling updates donut and center total.
- Aggregate mode table header shows correct "x wallets selected" text.
- Mode switch preserves valid chart state and dataset source.
- Top token/minimum value filters produce expected grouped output.
- Others segment tooltip includes hidden names.
- Export CSV mirrors displayed rows in both modes.

Suggested files:
- client/src/components/charts/AggregatedAssetDistribution/AggregatedAssetDistribution.test.tsx
- helper tests if aggregation function extracted.

### Regression checks
- Existing AssetDistribution behavior unchanged.
- Existing export service consumers unaffected.

## API/Contract Notes
- Current implementation can compute table net worth and token count client-side from wallet token rows.
- If backend later provides wallet display names and precomputed net worth, prefer backend fields for consistency/perf.
- If token identity key ambiguity appears (same symbol/name across assets), backend should expose stable token identifier and chart should aggregate by that identifier.

## Risks and Mitigations
- Risk: Large wallet count makes table + chart updates expensive.
  - Mitigation: memoize derived datasets; avoid rebuilding option objects unnecessarily.
- Risk: Token identity collisions when aggregating by name.
  - Mitigation: aggregate by stable token id/address when available, use name only as display label.
- Risk: Empty selected set edge-case.
  - Mitigation: enforce at least one selected wallet or explicit empty-state path.
- Risk: Export inconsistency versus visible chart.
  - Mitigation: export from same post-filter aggregated dataset used by chart option.

## Delivery Sequence
1. Scaffold component and register chart.
2. Implement 2-column UI + wallet selector table.
3. Add aggregation + donut rendering.
4. Add filters + export.
5. Add localization.
6. Add tests + regression pass.

## Definition of Done
- New Aggregated Asset Distribution chart exists and renders in target chart surface.
- Chart wrapper contains working 2-column layout.
- Wallet selector rendered via shared Table component.
- Header contains mode toggle with default Single Wallet mode.
- Single mode: table has no checkbox, clicking wallet row updates chart to clicked wallet.
- Aggregate mode: table shows checkbox column and "x wallets selected" summary in list header.
- Right-side donut reflects active wallet (single mode) or selected wallets (aggregate mode).
- Top token and minimum value filters work as specified.
- Export output matches currently visualized aggregated data.
- Localization keys added for supported languages.
- Tests cover aggregation, selection, filter, and export paths.
