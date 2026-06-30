# Profile Real Charts Integration Plan (2026-04-08)

## Goal
Replace placeholder/mock-rendered chart sections in the profile tabs with real chart components that follow the existing chart architecture.

## Requested Scope
1. In `ProfileWalletTab`, replace the current text-based chart placeholders (current block around line 198-228) with real `BalanceChart` and `DrawdownChart` components.
2. In `ProfileActivityTab`, replace the current inline heatmap grid (current block around line 137-158) with a new chart component using ECharts calendar heatmap.
3. Adjust related mock data and profile types so the new chart components can run correctly in mock mode.
4. Implement the new calendar heatmap chart under the charts folder, aligned with existing chart patterns.

## Current-State Findings
1. `ProfileWalletTab` currently renders "Balance chart" and "Drawdown chart" using plain text from `data.balanceDrawdownSeries`.
2. `ProfileActivityTab` currently renders a CSS grid heatmap from `data.heatmap.cells`.
3. Profile mock data source is `client/src/services/profile/profileMockData.ts` and profile contracts are in `client/src/types/profile.ts`.
4. Existing reusable charts already exist and are production-ready for wallet-based querying:
   - `BalanceChart`: `client/src/components/charts/BalanceChart/BalanceChart.tsx`
   - `DrawdownChart`: `client/src/components/charts/Drawdown/DrawdownChart.tsx`

## Implementation Plan

### Phase 1: Data Contract Alignment
1. Update profile wallet data contract to support real chart input:
   - Keep `linkedWalletRows[].walletAddress` as full wallet address (not shortened display form).
   - Introduce a display formatter in UI for shortened addresses where needed.
2. Handle legacy `balanceDrawdownSeries` in `ProfileWalletsData` (Option A selected):
   - Remove field from type and mock payload.
   - Remove all related references in profile tab rendering.
3. Keep `ProfileActivityData.heatmap` contract but make it chart-friendly:
   - Ensure dates are valid ISO date strings (`YYYY-MM-DD`).
   - Limit expected data span to short windows only (3D and 7D).

### Phase 2: Wallet Tab Refactor to Real Charts
1. In `client/src/components/profile/ProfileWalletTab.tsx`:
   - Remove placeholder sections that map `data.balanceDrawdownSeries` into text.
   - Import and render `BalanceChart` and `DrawdownChart`.
2. Build wallet filter input for charts:
   - Derive wallet list from `data.linkedWalletRows.map((row) => row.walletAddress)`.
   - Pass to chart `initialFilters.wallets`.
   - Set a stable period default (`30D`) unless profile-level period sync is introduced.
3. Replace section bodies:
   - Balance section: `<BalanceChart minHeight={300|360} initialFilters={{ timePeriod: "30D", wallets }} />`
   - Drawdown section: `<DrawdownChart minHeight={300|360} initialFilters={{ timePeriod: "30D", wallets }} />`
4. Preserve existing table/compare behavior and avoid touching unrelated wallet actions.

### Phase 3: New Calendar Heatmap Chart Component
1. Create new chart module under `client/src/components/charts/`:
   - `ProfileTradeFrequencyHeatmap/ProfileTradeFrequencyHeatmap.tsx`
   - `ProfileTradeFrequencyHeatmap/index.ts`
   - Optional style module if needed (`ProfileTradeFrequencyHeatmap.module.scss`)
2. Component design should follow existing chart conventions:
   - Reuse `BaseChart` for loading/error/empty behavior.
   - Reuse `ChartContainer`, `ChartSection`, `ChartGridItem` from shared chart components.
   - Use `useChartTheme()` and themed base option helpers for visual consistency.
3. Input contract for new component:
   - Prefer explicit prop shape from profile tab: `cells: Array<{ date: string; count: number }>`.
   - Optional title/minHeight props similar to other chart components.
   - Include a local UI window toggle with two modes: `3D` and `7D`.
4. ECharts implementation details:
   - Use `calendar` coordinate system and `heatmap` series.
   - Convert cells to `[date, count]` tuples.
   - Configure `visualMap` with min 0 and max from provided `maxCount` (or derived max).
   - Tooltip format: date + trade count.
   - Calendar range derived from selected UI window (last 3 days or last 7 days).
   - Default selected window: `7D`.
5. Empty-state behavior:
   - No cells or all zero counts should render chart empty state via `BaseChart`.

### Phase 4: Activity Tab Refactor
1. In `client/src/components/profile/ProfileActivityTab.tsx`:
   - Remove current inline CSS-grid heatmap block.
   - Render new `ProfileTradeFrequencyHeatmap` component in that section.
2. Pass heatmap data directly from profile model:
   - `cells={data.heatmap.cells}`
   - `maxCount={data.heatmap.maxCount}` (or omit if deriving internally)
   - Keep the 3D/7D window toggle state inside the new heatmap component UI.
3. Keep table and wallet cards section unchanged.

### Phase 5: Mock Data and Optional Styling Cleanup
1. Update `client/src/services/profile/profileMockData.ts`:
   - Ensure linked wallet addresses are full valid wallet addresses for chart queries.
   - Keep `activity.heatmap.cells` focused on short-term windows (at least 7 consecutive days).
   - Remove `wallets.balanceDrawdownSeries` from mock payload.
2. Update `client/src/types/profile.ts` accordingly.
3. In `client/src/components/profile/profile.module.scss`:
   - Remove obsolete `.heatmap` and `.heatCell` styles if no longer used.
   - Remove `.chartPlaceholder` if now unused by profile tabs.

## File-Level Change List
1. `client/src/components/profile/ProfileWalletTab.tsx`
2. `client/src/components/profile/ProfileActivityTab.tsx`
3. `client/src/components/charts/ProfileTradeFrequencyHeatmap/ProfileTradeFrequencyHeatmap.tsx` (new)
4. `client/src/components/charts/ProfileTradeFrequencyHeatmap/index.ts` (new)
5. `client/src/types/profile.ts`
6. `client/src/services/profile/profileMockData.ts`
7. `client/src/components/profile/profile.module.scss`

## Validation Checklist
1. Type-check passes in client workspace.
2. Profile Wallet tab renders real Balance and Drawdown charts without runtime errors.
3. Profile Activity tab renders ECharts calendar heatmap with legend/intensity mapping.
4. Heatmap UI toggle switches correctly between 3D and 7D windows.
5. No UI regressions in tables/actions/modals within profile tabs.
6. Mock mode (`VITE_PROFILE_DATA_SOURCE=mock`) still works end-to-end.
7. Obsolete profile chart placeholder styles/fields are removed or intentionally deprecated.

## Risks and Mitigations
1. Risk: Mock wallet addresses are abbreviated and fail real chart fetchers.
   - Mitigation: Store full addresses in data; shorten only at render layer.
2. Risk: Calendar heatmap has too little data for selected window.
   - Mitigation: Ensure mock dataset always provides at least 7 consecutive days so both 3D and 7D modes are populated.
3. Risk: Removing `balanceDrawdownSeries` breaks hidden references.
   - Mitigation: Use global grep cleanup before build/test validation in the same PR.

## Execution Order (Recommended)
1. Update profile types and mock payload.
2. Add new calendar heatmap chart module.
3. Refactor `ProfileWalletTab` to `BalanceChart` + `DrawdownChart`.
4. Refactor `ProfileActivityTab` to use new heatmap chart component.
5. Remove obsolete styles/fields and run final validation.

## Acceptance Criteria
1. `ProfileWalletTab` no longer renders text-based chart placeholders and instead uses `BalanceChart` and `DrawdownChart`.
2. `ProfileActivityTab` no longer renders the custom CSS heat grid and instead uses a dedicated ECharts calendar heatmap chart component.
3. The heatmap supports a UI toggle for 3D and 7D windows (default 7D).
4. `balanceDrawdownSeries` is removed from profile wallet types and mock payload (Option A).
5. Mock data and types are aligned with the refactor and compile cleanly.
6. Plan is documented under the docs profile folder for implementation handoff.
