# Wallet AI Analysis Tab Styling + Component Refactor Plan (2026-04-25)

## PURPOSE
Refactor `aiAnalysisTab` UI out of `client/src/pages/wallet/index.tsx`, restyle to match `client/src/components/wallet/WalletOverview/*`, and add explicit dependency readiness UI + generate button gating.

## SCOPE
- Move `aiAnalysisTab` rendering into new components under `client/src/components/walletfolder/`.
- Replace inline styles with `*.module.scss`, mirroring `WalletOverview.module.scss` patterns (spacing, borders, cards, text hierarchy).
- Update layout so `signals` render as **vertical card list** (not grid of text rows).
- Update pre-fetch gate UI: always show per-dependency status row with icon + color, plus a bottom “Generate analysis” button enabled only when all dependencies are `available`.

## NON-GOALS
- Change AI endpoint contract or backend readiness rules (keep existing logic).
- Rework reference rendering engine (`renderWalletAiReferenceText` / `renderWalletAiReferenceList`) beyond wiring into new components.

## CURRENT STATE (WHAT EXISTS TODAY)
- `aiAnalysisTab` JSX lives in `client/src/pages/wallet/index.tsx` around `aiAnalysisTab = (...)`.
- Fetch gating already exists inside `loadAiAnalysisData()` by building `missingDependencies` and setting `aiAnalysisWaitingReason`:
  - `portfolio` required (`portfolio.length > 0`)
  - `swaps` required (`activitySwaps.length > 0`)
  - `intelligence` required (checks in same block)
- Current UI when not ready: single text string (`aiAnalysisWaitingReason`) + Retry button.
- `signals` currently rendered via `renderWalletAiReferenceList(aiAnalysisReport.signals, ...)` inside a `display: grid` container.

## TARGET END-STATE UX
### A) Dependency status panel (always visible before first successful analysis)
Display list of required datapoints with row format:
- `{ icon } {label} {statusText}`
- Status values: `available | no data | fetching`
- Color code:
  - available: green
  - no data: grey
  - fetching: blue

Dependencies to show (match existing gate logic; keep naming stable for later i18n):
- `portfolio`
- `swaps`
- `intelligence`

Mapping to state (source of truth in wallet page):
- `portfolio`
  - fetching: `portfolioLoading === true` OR `!portfolioLoadedRef.current && activeTab === 3` (choose one consistent rule)
  - available: `Array.isArray(portfolio) && portfolio.length > 0`
  - no data: `!portfolioLoading && portfolioLoadedRef.current && portfolio.length === 0`
- `swaps` (activity)
  - fetching: `activityLoading === true` OR `!activityLoadedRef.current && activeTab === 3`
  - available: `Array.isArray(loadedSwaps) && loadedSwaps.length > 0`
  - no data: `!activityLoading && activityLoadedRef.current && loadedSwaps.length === 0`
- `intelligence`
  - fetching: `intelligenceLoading === true` (if exists) OR `intelligenceEnabled && intelligenceReport == null && !intelligenceError` (pick actual local state names)
  - available: `intelligenceReport != null`
  - no data: `intelligenceEnabled && !intelligenceLoading && intelligenceReport == null`

If wallet page does not expose `activityLoading` / `intelligenceLoading`, add minimal derived booleans (no new async behavior).

### B) Generate analysis button (single CTA)
- Location: bottom of dependency panel.
- Enabled only when all dependencies are `available`.
- Click action:
  - `aiAnalysisRequestedRef.current = true`
  - `loadAiAnalysisData(true)` (force refresh)
- While analysis fetch in-flight: show loading state (disable, optional inline spinner text).

### C) Signals as vertical cards
Render `aiAnalysisReport.signals` as **stacked cards**:
- Each card: signal text + optional reference capsules (reuse reference renderer)
- Spacing and borders align with `WalletOverview.module.scss` `.Card` style:
  - background: `$layer-01`
  - border: `1px solid $border-subtle`
  - radius: `6px`
  - padding: `12px`

## PROPOSED FILE/DIRECTORY SHAPE (STYLE-GUIDE COMPLIANT)
Create new category-first folder (kebab-case for filenames; directory name requested by task):
- `client/src/components/walletfolder/ai-analysis/`
  - `AiAnalysisTab.tsx` (main orchestrator view for tab body)
  - `AiAnalysisDependencyPanel.tsx` (dependency list + CTA)
  - `AiAnalysisDependencyRow.tsx` (row: icon + label + status)
  - `AiAnalysisSignalsList.tsx` (vertical card list)
  - `ai-analysis.module.scss`
  - `types.ts` (shared types: dependency ids, status union)

If team prefers fewer files: merge row + panel into `AiAnalysisDependencyPanel.tsx`, keep `AiAnalysisSignalsList.tsx` separate.

## COMPONENT CONTRACTS (PROPS)
### `AiAnalysisTab`
Inputs from wallet page:
- `aiAnalysisLoading: boolean`
- `aiAnalysisError: string | null`
- `aiAnalysisWaitingReason: string | null` (legacy; may be replaced by structured dependency statuses)
- `aiAnalysisReport: WalletAiAnalysisResponse | null`
- `aiAnalysisLastUpdated: string | null`
- `onGenerate: () => void` (calls force refresh)
- `dependencyStatuses: Array<{ id: "portfolio"|"swaps"|"intelligence"; status: "available"|"no_data"|"fetching" }>`

Responsibility:
- Render dependency panel when report missing OR when deps not all available (design choice: always show panel above report for transparency).
- Render existing success sections (summary, profile, strategy, etc.) using same content but remove inline styles; map to SCSS classes.

### `AiAnalysisDependencyPanel`
- `items: dependencyStatuses`
- `canGenerate: boolean` (all available)
- `generating: boolean` (aiAnalysisLoading)
- `onGenerate: () => void`

### `AiAnalysisSignalsList`
- `signals: string[] | unknown` (normalize to string[] before render)
- `reference: WalletAiAnalysisResponse["reference"]`

## STYLING PLAN (MATCH WalletOverview LOOK)
Base: copy patterns from `client/src/components/wallet/WalletOverview/WalletOverview.module.scss`:
- Container blocks mimic `statsSection` / `pnlSection` spacing and `border-bottom: 1px solid $border-subtle`.
- Use card primitives similar to `.Card`, `.CardLabel`, `.CardValueRow`.

New SCSS module (`ai-analysis.module.scss`) should:
- Import Carbon theme + shared variables:
  - `@use '@carbon/react/scss/theme' as *;`
  - `@use '@carbon/react/scss/spacing' as *;`
  - `@use '../../../styles/variables' as *;` (adjust relative path)
- Define named color tokens (no magic values):
  - `$status-available: $support-success;` (or existing success token)
  - `$status-fetching: $support-info;` (or a blue token used elsewhere)
  - `$status-no-data: $text-secondary;`
- Provide utility classes:
  - `.section` (like `chartSection` but without inline style)
  - `.sectionTitle`
  - `.dependencyPanel`, `.dependencyRow`, `.dependencyIcon`, `.dependencyText`, `.dependencyStatus`
  - `.signalsList`, `.signalCard`

## FETCH CONDITION UPDATE (STRUCTURED, UI-DRIVEN)
Replace string-only gate (`aiAnalysisWaitingReason`) with structured statuses computed before calling `fetchWalletAiAnalysis`:
- Compute `dependencyStatuses` every render (pure function) from current wallet page state.
- `canFetchAiAnalysis = dependencyStatuses.every(s => s.status === "available")`
- In `loadAiAnalysisData(force?: boolean)`:
  - if `!canFetchAiAnalysis`:
    - set report null
    - set legacy `aiAnalysisWaitingReason` optional (keep for now, but UI should primarily use structured statuses)
    - return null (skip fetch)
  - else proceed existing cache/in-flight logic unchanged

## MIGRATION STEPS (LOW RISK)
1. Create `client/src/components/walletfolder/ai-analysis/` components + SCSS, initially render same content as current tab (copy/paste sections, then clean up styles).
2. In `client/src/pages/wallet/index.tsx`, replace `aiAnalysisTab = (...)` with `<AiAnalysisTab ... />` and pass required props.
3. Add structured dependency statuses + `canGenerate` logic in wallet page (pure helpers, no new network calls).
4. Update `signals` rendering: replace `renderWalletAiReferenceList` usage with `AiAnalysisSignalsList` card list, or wrap each signal into card while reusing existing list renderer.
5. Remove remaining inline styles in AI tab sections, mapping to SCSS classes.
6. Quick visual parity check: compare spacing/typography vs `WalletOverview` sections, adjust tokens and gaps.

## TEST PLAN
- Open wallet page, go AI tab with:
  - No portfolio loaded yet => dependency panel shows portfolio fetching/no data; generate button disabled.
  - Portfolio loaded but empty => status `no data`; generate button disabled.
  - Swaps still loading => status fetching; button disabled.
  - All available => button enabled; clicking triggers exactly one fetch.
- Ensure existing lazy-load behavior still holds:
  - Switch to AI tab once => no auto-fetch unless `canFetchAiAnalysis` true.
  - Manual Generate always forces fetch when ready.
- Signals render:
  - Long signal strings wrap inside cards, no overflow.
  - Reference capsules still work.

## RISKS / NOTES
- Some loading booleans may not exist (activity/intelligence). Prefer derived “fetching” based on existing refs + null checks; avoid adding new async state unless necessary.
- Keep legacy `aiAnalysisWaitingReason` during transition to reduce regression risk; UI should not rely on string parsing.

