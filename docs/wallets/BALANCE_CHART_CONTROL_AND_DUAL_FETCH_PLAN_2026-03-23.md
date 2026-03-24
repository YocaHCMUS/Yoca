# Balance Chart Control + Dual Fetch Update Plan (2026-03-23)

## Objective
Upgrade the BalanceChart control and data behavior to support:
- General balance and token-specific balance concurrently (dual-fetch model).
- A new control experience with combobox selection, tag display, and summary data box.
- Clear behavior split for single-wallet vs multi-wallet scenarios.

This plan covers both client and server updates required to fulfill the behavior contract.

---

## Product Requirements (Consolidated)

### 1) Remove token initial filter coupling
- The chart should no longer rely on an initial tokens filter field as the source of truth.
- Token selection state should be controlled by the BalanceChart UI state, not by initial filter propagation.
- Time period and wallets remain in query filters.

### 2) Dual-fetch model
- The chart will run two fetcher paths in parallel:
  - General balance data (no token filter).
  - Token-specific data (selected token list).
- The rendered chart merges these payloads into a unified display model.

### 3) Always-on control area
- The chart always renders a token/mode control section.
- Control uses a combobox to search/select token options.
- Optionally supports a composite workflow where selected token can be added (+) to display multiple tokens at once (limit of 3 tags at a time in single-wallet mode; adding a 4th selection replaces the oldest added token tag).

### 4) Tag system
- Selected items are represented as tags at top-left of the chart area.
- Each tag must show:
  - Token symbol.
  - Token logo.
- Tags are dismissible except when only one tag remains.

### 5) Upper-half data box
- A summary data box is shown in the upper half of the chart container.
- The box lists recent percentage changes for currently selected tags.

### 6) Addendum: 24h change calculation
- The 24h percentage change shown in the data box can be calculated from current chart data points.
- Calculation baseline:
  - Use the latest point and nearest available point at approximately t-24h from the currently rendered chart series.
  - If no valid 24h baseline point exists, continue with further point and add a display showcasing the delta time period.
  - Use N/A only as a final fallback, this case should and will not happen in actual run

### 7) Addendum: single-wallet vs multi-wallet behavior
- Multiple token display applies only in single-wallet mode.
- Multi-wallet mode supports one active tag only:
  - Any new token/all selection replaces the current one (switch behavior).
- In multi-wallet mode, the data box labels by wallet address or resolved wallet identity instead of token label.

### 8) Addendum: walletPage tab consolidation
- Since total and token modes are merged into one BalanceChart experience, separate walletPage tabs for balance and token balance are no longer relevant.
- walletPage should expose one BalanceChart tab that includes:
  - General balance view through the All tag.
  - Token-specific and composite views through combobox + tags.
- The existing PnL tab remains separate.

---

## UX Behavior Contract

## Selection Rules
- All is treated as a selectable tag representing general balance.
- Max selected tags: 3 (single-wallet only).
- If max tag count is reached in single-wallet mode, a new add operation replaces the oldest added token tag.
- If only one tag remains, dismiss action is disabled.
- In multi-wallet mode:
  - Selection is single-tag.
  - New selection replaces old selection.
  - No additive multi-token composition.

## Tag Content
- Tag text: token symbol (or All for general mode).
- Tag icon: token logo URI when available.
- Fallback icon strategy for missing logo:
  - Generic token glyph or symbol-initial badge.

## Data Box Content
- Single-wallet:
  - One row/card per selected tag (up to 3).
  - Label by token symbol (or All) and token logo.
  - Value is percent change derived from the latest point against the nearest available baseline around 24h ago.
  - If exact 24h baseline is unavailable, use the next nearest historical point and show the effective delta duration label.
  - Use N/A only when no valid baseline exists.
- Multi-wallet:
  - Label by wallet short address or identity name.
  - Value is 24h percent change for the active rendered series.

---

## Technical Design

## Client-side Changes

### A) BalanceChart refactor
File:
- [client/src/components/charts/BalanceChart/BalanceChart.tsx](client/src/components/charts/BalanceChart/BalanceChart.tsx)

Planned updates:
- Replace single query/fetch path with orchestrated dual-fetch flow:
  - Query A: total/general balance (tokens omitted).
  - Query B: token-specific balance (tokens from selected tags excluding All).
- Merge both responses into a normalized display structure for ECharts.
- Add state model for selected tags independent from initial token filters.
- Enforce max-tags and single-vs-multi-wallet selection rules.
- Compute 24h percentage changes from chart series points.
- Render:
  - Combobox selector.
  - Add action (single-wallet mode).
  - Tag row with symbol + logo.
  - Data box in upper-half area.

### A.1) walletPage tab integration refactor
File:
- [client/src/pages/wallet/index.tsx](client/src/pages/wallet/index.tsx)

Planned updates:
- Replace the current two-tab split (balance history + token balance history) with a single BalanceChart tab.
- Remove mode-specific tab wiring that forced total and token charts to be separate entries.
- Pass one BalanceChart instance configured for merged mode behavior and shared token options.
- Keep PnL as a separate tab entry.

### B) Shared chart styles
File:
- [client/src/components/charts/shared/ChartStyle.module.scss](client/src/components/charts/shared/ChartStyle.module.scss)

Planned updates:
- Add styles for:
  - Combobox container.
  - Tag chip with icon area.
  - Dismiss action states.
  - Data box grid/cards.
- Ensure responsive behavior for mobile and narrower chart containers.

### C) Chart props cleanup
File:
- [client/src/components/charts/shared/ChartProp.tsx](client/src/components/charts/shared/ChartProp.tsx)

Planned updates:
- Deprecate or remove props tied to old token-toggle control behavior where applicable.
- Keep compatibility for callers until migration complete.

### D) Filter sync decoupling
File:
- [client/src/hooks/useChartFiltersSync.ts](client/src/hooks/useChartFiltersSync.ts)

Planned updates:
- Stop using initial token filter as BalanceChart control state source.
- Continue using wallets/timePeriod sync behavior.

### E) API typing updates
Files:
- [client/src/types/chart-api.types.ts](client/src/types/chart-api.types.ts)
- [client/src/services/chart/chartApi.ts](client/src/services/chart/chartApi.ts)

Planned updates:
- Add/extend metadata types needed for token logo and symbol transport.
- Ensure inferred types still match route contract.

---

## Server-side Changes

## Route layer
File:
- [server/src/routes/charts/balance.route.ts](server/src/routes/charts/balance.route.ts)

Planned updates:
- Preserve support for both no-token and token-filtered requests.
- Enrich payload metadata for UI needs:
  - Token symbol map.
  - Token logo URI map.
  - Optional wallet identity labels for multi-wallet presentation.
- Keep existing validation and constraints; align max token count with UI policy if needed.

## Service layer
Files:
- [server/src/services/wallet/walletCharts.service.ts](server/src/services/wallet/walletCharts.service.ts)
- [server/src/services/wallet/walletTokenBalance.service.ts](server/src/services/wallet/walletTokenBalance.service.ts)
- [server/src/services/wallet/walletPortfolio.service.ts](server/src/services/wallet/walletPortfolio.service.ts)

Planned updates:
- Ensure token-history path supports requested timePeriod range (not fixed-only assumptions).
- Use portfolio enrichment for token symbol/logo metadata reliability.
- Keep concurrency and cache behavior stable for wallet x token combinations.

Optional identity label source for multi-wallet data box:
- [server/src/routes/wallets.route.ts](server/src/routes/wallets.route.ts)
- Identity services already used elsewhere may be reused if available.

---

## Data Contract Proposal (Delta)

## Balance metadata additions
Suggested metadata additions in /charts/balance response:
- mode: total | token | composite
- tokens: string[]
- tokenMeta: Record<string, { symbol: string; logoUri?: string; tokenAddress?: string }>
- walletMeta: Record<string, { label: string; identityName?: string }>

Notes:
- composite can be represented as merged client mode even if route returns total and token separately.
- If route remains unchanged, client can still compute composite by dual-fetch and local merge.

---

## 24h Percentage Change Logic

For each displayed item (token tag, All tag, or active multi-wallet series):
1. Get normalized ascending points.
2. Let latestPoint be last valid point.
3. Find baselinePoint nearest to latestPoint.timestamp - 24h.
4. If no point exists near 24h, continue searching further back and use the nearest valid historical baseline.
5. If baseline value is 0 or no valid baseline can be found, return N/A.
6. Else compute:
   changePct = ((latest - baseline) / baseline) * 100
7. Round for display (for example 2 decimals) and expose/display the effective delta duration label when baseline is not exact 24h.

Fallback behavior:
- If only one point exists, no change metric is shown.

---

## Single-wallet vs Multi-wallet Rendering Rules

## Single wallet
- Allow All + up to 2 additional token tags (max 3 total tags).
- Add flow enabled.
- On overflow add, replace the oldest added token tag.
- Data box labels by token symbol/All and token logo.

## Multi-wallet
- Only 1 active tag at a time.
- Any new selection replaces current tag.
- Data box labels by wallet identity/address.

---

## Testing Plan

## Client tests
- Tag selection constraints:
  - max 3 in single-wallet.
  - overflow add replaces oldest token tag.
  - replace behavior in multi-wallet.
  - cannot remove last tag.
- Dual-fetch merge correctness and render order.
- 24h change computation for:
  - complete series.
  - sparse data.
  - zero baseline.
  - single-point series.
  - non-exact 24h baseline with delta duration label.
- Tag rendering includes symbol + logo fallback.
- walletPage tab behavior:
  - one merged BalanceChart tab is present.
  - no separate token-balance tab remains.
  - PnL tab remains accessible and unaffected.

## Server tests
- Balance route metadata enrichment is stable for:
  - no tokens.
  - one token.
  - multiple tokens.
  - multiple wallets.
- Token history respects requested period.

---

## Rollout Sequence
1. Server metadata/timePeriod support.
2. Client dual-fetch merge model.
3. walletPage tab consolidation to one merged BalanceChart tab.
4. New control/tag/data-box UI.
5. Remove old token-toggle behavior.
6. Regression validation across wallet modes.

---

## Notes
- This document supersedes the earlier draft with addendums:
  - 24h change from chart data points.
  - Multi-token only for single-wallet mode.
  - Tag must include token symbol and logo.
