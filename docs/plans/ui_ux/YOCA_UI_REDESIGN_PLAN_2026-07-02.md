# Yoca UI Redesign — Unify App Pages Around the Web3/Neon Design System

Date: 2026-07-02

## Summary

Bring every logged-in app page (Market, Token detail, Wallet detail, Alerts,
Profile/Activity) and the app shell (header/side nav) up to the same
dark-first, glassmorphism, Solana-accented look already established on the
landing page and partially applied to the Wallet detail page. No business
logic, API calls, routing, or data flow changes — this is a styling/component
substitution pass, page by page, using the shared component library under
`client/src/components/common/`.

## Context — current state (verified in repo, 2026-07-02)

- The Yoca design-token layer **already exists**: `client/src/styles/theme.scss`
  defines `--yoca-*` CSS variables (bg, surface, border, text, primary,
  accent, success/danger/warning, radius, shadow) scoped to
  `.yoca-app-theme[data-yoca-theme="light|dark"]`, applied globally via
  `ThemeContext.tsx:71`. The values already match the tokens suggested in the
  brief almost exactly (`--yoca-primary: #7c3aed`, `--yoca-accent: #2dd4bf`
  dark-mode, `--yoca-bg: #070a13`, etc.). **No new token system needs to be
  invented** — extend/confirm this file, don't replace it.
- A first generation of shared "Yoca" components already exists in
  `client/src/components/common/`: `Card`, `MetricCard`, `PageHeader`,
  `PillTabs`, `StatusBadge`, `AddressPill`, `PeriodSelector`, `IconButton`,
  `Toast`, `Tooltip`. These are documented in `docs/DESIGN_REFERENCE.md`
  §4.2.
- **Adoption is uneven.** Grep across `client/src` shows these components are
  used almost exclusively by the Wallet page today:
  - `Card`, `PageHeader` → only `pages/wallet/index.tsx`
  - `PillTabs` → `pages/wallet/TokenDetailsDemo.tsx`,
    `components/wallet/WalletChat/ChatPromptMenu.tsx`
  - `StatusBadge`, `AddressPill` → `components/wallet/WalletTopbar/*`,
    `components/wallet/WalletChat/*`
  - `MetricCard` → **not used anywhere yet** (built but not adopted)
  - So **Wallet detail is the reference page** for this redesign, not a
    from-scratch target — it needs a polish pass, not a rebuild.
- Pages still on raw Carbon primitives (the "IBM admin dashboard" look the
  brief complains about):
  - `pages/market/index.tsx` (617 lines) — imports `Column, Grid, Section,
    Stack` from `@carbon/react` directly.
  - `pages/token/index.tsx` (440 lines) — mostly custom already but uses raw
    Carbon `InlineLoading`; not using `Card`/`PageHeader`/`MetricCard`.
  - `pages/alerts/index.tsx` (952 lines, largest target) + `CreateAlertRuleModal.tsx`
    + `components/{AlertConfigurationShared,AlertNotificationSettings,TokenStatsConfig,TradingEventsConfig}.tsx`
    — likely the heaviest Carbon `DataTable`/`Tile`/`Modal` usage in the app.
  - `pages/profile/index.tsx` (146 lines, small) — uses Carbon icons directly,
    smallest lift.
- App shell: `components/wrapper/PageWrapper.tsx` imports raw Carbon
  `Header, HeaderGlobalAction, HeaderGlobalBar, HeaderMenuButton,
  HeaderMenuItem, HeaderName, HeaderNavigation, HeaderPanel,
  HeaderSideNavItems, SideNav, SideNavItems`. This is the literal
  "Carbon-style header" supervisors dislike — it wraps every logged-in page,
  so restyling it has the highest visual leverage per line changed.
- There is **no shared `Button` variant system** and **no generic
  `EmptyState`/yoca-styled `Table` component** yet in `components/common/` —
  only chart-specific (`ChartEmptyState`) and AI-dashboard-specific
  (`AiAnalysisDashboard/EmptyState.tsx`) empty states exist today. These are
  real gaps the brief's "component polish" section calls for and must be
  built once, then reused.
- Table story: `components/Tble.tsx` (newer "Tble" data table) already uses
  `--yoca-*` styling per `docs/DESIGN_REFERENCE.md` §4.2. The older
  `components/tables/Table.tsx` (Carbon `TableWrapper`-based) is the one that
  looks like a raw enterprise table. Where a page already uses `Table.tsx`,
  prefer migrating it to `Tble` if the feature set matches (search/filter/sort
  behavior must stay identical), instead of re-skinning `Table.tsx`.

## Goals (unchanged from brief, restated for traceability)

1. Replace remaining Carbon/admin-dashboard visual style with the existing
   Yoca token system + shared component library — extend that library where
   gaps exist, don't invent a second system.
2. Zero changes to business logic, API calls, data flow, routing, DB schema.
3. Make Landing → Market → Token detail → Wallet detail → Alerts →
   Profile/Activity feel like one product.
4. Dark-first professional Solana analytics dashboard aesthetic.

## Non-goals / constraints

- No rewriting of hooks, services, or state management.
- No backend/API/schema changes.
- No feature removal (search, export, filters, email/Discord/Helius alert
  logic, chart logic all stay behaviorally identical).
- Prefer incremental SCSS-module + component-swap diffs per page over
  big-bang rewrites — each page should be reviewable/testable independently.
- `npm run typecheck` (or equivalent in `client/package.json`) must pass after
  each phase.
- Keep i18n (`tr()`/`config/localization/{en,vi}.ts`) keys intact — relabeling
  ("Trending Pools" → "Market Radar" etc.) goes through the localization
  system, not hardcoded strings.

## Design tokens — action, not invention

`client/src/styles/theme.scss` already defines the full `--yoca-*` palette,
scoped to `.yoca-app-theme[data-yoca-theme="light|dark"]`. Current values
(read from the file directly, 2026-07-02):

| Token | Light | Dark |
|---|---|---|
| `--yoca-bg` | `#f5f7fb` | `#070a13` |
| `--yoca-bg-soft` | `#edf1f8` | `#0b1020` |
| `--yoca-surface` | `rgba(255,255,255,0.84)` | `rgba(18,24,38,0.82)` |
| `--yoca-surface-elevated` | `rgba(255,255,255,0.96)` | `rgba(24,31,48,0.92)` |
| `--yoca-surface-hover` | `rgba(241,245,249,0.98)` | `rgba(32,41,62,0.95)` |
| `--yoca-border` | `rgba(71,85,105,0.16)` | `rgba(148,163,184,0.16)` |
| `--yoca-text-main` | `#0f172a` | `#f8fafc` |
| `--yoca-text-muted` | `#64748b` | `#94a3b8` |
| `--yoca-text-soft` | `#334155` | `#cbd5e1` |
| `--yoca-primary` | `#7c3aed` | `#7c3aed` |
| `--yoca-primary-2` | `#2563eb` | `#2563eb` |
| `--yoca-accent` | `#0fbaa7` | `#2dd4bf` |
| `--yoca-success` | `#15803d` | `#22c55e` |
| `--yoca-danger` | `#dc2626` | `#ef4444` |
| `--yoca-warning` | `#d97706` | `#f59e0b` |
| `--yoca-radius-md` | `12px` | `12px` |
| `--yoca-radius-lg` | `18px` | `18px` |
| `--yoca-shadow-card` | `0 18px 50px rgba(15,23,42,0.12)` | `0 18px 50px rgba(0,0,0,0.32)` |

**Cross-check against the colleague's suggested token list**: the dark-mode
values above already match the brief's suggested hex codes almost exactly —
`--primary`, `--primary-2`, `--accent` (`#2DD4BF`), `--success`, `--danger`,
`--warning`, `--bg`, `--bg-soft`, `--border`, `--text-main`, `--text-muted`,
`--surface` are all identical or equivalent. The one measurable difference:
brief suggests `--surface-hover: rgba(27, 63, 90, 0.9)`-style
`rgba(27, 35, 54, 0.9)` vs. the current `rgba(32, 41, 62, 0.95)` — close
enough that it's a judgment call, not a bug; flag it during Phase 0 review
and only change it if the current hover state visually reads too flat/bright
against `--yoca-surface`. **No color values need to be invented or migrated
— implementation should consume the existing tokens as-is.**

Gaps to fill in this same file (additive, both light/dark blocks):
- Spacing scale tokens (`--yoca-space-1..6`) if per-page SCSS is currently
  hardcoding `rem` spacing ad hoc — audit during Phase 0.
- `--yoca-radius-sm` / `--yoca-radius-pill` (999px) if pill-shaped elements
  (badges, tabs) are hand-rolling `border-radius: 999px` inline instead of a
  token.
- `--yoca-shadow-card-hover` / elevated-hover shadow, used by `Card`'s
  `hoverable` prop — check if it already reuses `--yoca-shadow-card` or needs
  its own value for stronger hover feedback.
- `--yoca-surface-glass-border` if the glass-card look needs a distinct
  lighter border on hover vs rest state (nice-to-have, only if visually
  needed once Phase 0 lands).

Do not rename existing `--yoca-*` variables — `ThemeContext`/`theme.scss` are
load-bearing across the app; renames would create a much larger diff than
necessary for a "smallest safe structural change" redesign.

## Phased scope

### Phase 0 — Foundations (do first, unblocks everything else)

1. **App shell** (`components/wrapper/PageWrapper.tsx` +
   `PageWrapper.module.scss`): restyle the Carbon `Header`/`SideNav` markup
   in place — keep the same Carbon components (avoid a router/layout rewrite)
   but override via SCSS module + `--yoca-*` tokens so it matches the landing
   nav: glass background, thin border-bottom, consistent icon/spacing/hover
   states, theme toggle styled to match landing. Keep `Market`/`Alerts` etc.
   nav items and all existing behavior (Ctrl+K search, notification panel,
   account panel from `ea4b79b4`).
2. **Shared component gap-fill** in `components/common/`:
   - `Button/` — primary/secondary/ghost/danger variants wrapping Carbon
     `Button` (or replacing it) with Yoca styling, sizes matching existing
     usage patterns.
   - `EmptyState/` — generic version (icon, title, message, optional action)
     for reuse across Market/Alerts/Profile, distinct from the
     chart-specific/AI-dashboard-specific ones already in place (those stay
     as-is unless trivially convertible).
   - Confirm `MetricCard` (already built, unused) is fit for purpose before
     Phase 3's wallet polish and Phase 1/2 reuse — adjust props only if a
     real usage need surfaces, don't speculatively expand its API.
3. Typecheck + visual smoke test of every route after this phase before
   moving on — this phase touches the most shared surface area.

### Phase 1 — Market page (`pages/market/index.tsx`, 617 lines)

- Swap raw Carbon `Grid/Column/Section/Stack` layout for `Flex` primitive +
  `PageHeader` (eyebrow/title/subtitle/tabs slot) at the top.
- Ranking dropdown/filters → `PillTabs`/`DropdownPanelField` styling pass.
- Table rows: if currently on `components/tables/Table.tsx`, evaluate
  migrating to `Tble` (already yoca-styled) — only if feature parity holds
  (search fields, filter schema, sort configs, row click, CSV/AI actions if
  present). If parity doesn't hold, re-skin `Table.tsx` via SCSS module
  instead of migrating.
- Naming: keep "Trending Pools" as the functional/i18n key; visually can add
  a "Market Radar" eyebrow label via `PageHeader` without touching routing or
  i18n keys used elsewhere — confirm with product/supervisor preference
  before renaming user-facing copy (this is a copy decision, not styling).

### Phase 2 — Token detail page (`pages/token/index.tsx`, 440 lines)

- Header/sidebar → `Card` + `MetricCard` for price/stat blocks.
- "Wash Trading Detection"/AI button → premium-styled `Button` variant
  (gradient border or accent glow), reuse `IconButton` where relevant — check
  `components/wallet/AiAnalysisDashboard/` for any existing premium-button
  styling to reuse rather than inventing a second pattern.
- Tabs (Overview/Markets/News/Historical Data) → `PillTabs`.
- Chart cards → wrap in `Card`; confirm `ChartWrapper` (in
  `components/charts/shared/`) already picks up `--yoca-*` tokens or needs a
  targeted SCSS update (likely low-effort — audit before assuming a rewrite).
- Empty/loading states → new shared `EmptyState` from Phase 0 + existing
  `ChartEmptyState` where chart-specific.
- All API integrations (`services/*`, hooks) untouched.

### Phase 3 — Wallet detail page (`pages/wallet/index.tsx` + subcomponents)

This page is furthest along — treat as a **polish pass**, not a rewrite:
- Ensure `MetricCard` is actually adopted for the summary metrics (total
  asset value, PnL, win rate, trading volume) — currently unused despite
  being built; this is likely the single highest-value small change in the
  whole plan.
- Audit `RightSidebar.tsx`, `WalletReportTemplate.tsx`,
  `components/wallet/WalletTopbar/*`, `WalletChat/*` for remaining raw Carbon
  surfaces and swap to `Card`/`AddressPill`/`StatusBadge` for consistency
  with what's already done.
- Standardize card usage across Balance History, Asset Distribution,
  Portfolio, Profit & Loss, Swaps/Transfers, Last Traded Tokens sections —
  confirm they all wrap in `Card` with consistent title/subtitle/actions
  pattern.
- Address/tag/label readability: apply `AddressPill`/`StatusBadge`
  consistently anywhere a raw truncated string or Carbon `Tag` still appears.

### Phase 4 — Alerts page (`pages/alerts/*`, 952-line index + 4 sub-components + modal)

Largest, riskiest surface — most alert-specific business logic (email/Discord/
Helius rule config, form schema via `react-hook-form`/`zod` in
`form-schema.ts`) lives alongside the markup, so changes must be scoped to
JSX/SCSS only:
- `PageHeader` framing as "Alert Center" (again, confirm copy change
  separately from styling if user-facing).
- Split into visually distinct `Card` sections: notification settings
  (`AlertNotificationSettings.tsx`), create-alert form (`CreateAlertRuleModal.tsx`,
  `TokenStatsConfig.tsx`, `TradingEventsConfig.tsx`), active alert rules
  table, followed wallets list — these already look like separate
  components, so this is largely a "wrap existing sections in `Card`" +
  spacing/typography pass, not a re-architecture.
- Table/list styling → same `Table`→`Tble` evaluation as Phase 1.
- Delete/destructive actions → danger `Button` variant from Phase 0; keep
  existing confirm-before-delete behavior unchanged.
- Empty states (no alerts yet, no followed wallets) → new shared `EmptyState`.
- Do not touch `form-schema.ts` validation logic or the alert delivery logic
  (email/Discord/Helius) — only the form's visual chrome.

### Phase 5 — Profile/Activity page (`pages/profile/index.tsx`, 146 lines)

Smallest page — good validation target before/after Alerts if sequencing
needs a quick win:
- Empty states → shared `EmptyState`.
- Table/card styling consistent with other pages.
- Export/search/filter behavior unchanged — only presentation.

### Phase 6 — Responsiveness + cross-page QA pass

- Verify all 6 surfaces (Landing, Market, Token detail, Wallet detail,
  Alerts, Profile) at common laptop breakpoints (1366×768, 1440×900,
  1920×1080) without requiring browser zoom-out.
- Tables scroll horizontally where needed (`Tble`/`Table` already support
  this — confirm it isn't broken by the restyle); primary cards/metrics stay
  legible at laptop widths.
- Re-run `npm run typecheck` and existing Vitest suite (`docs/DESIGN_REFERENCE.md`
  confirms Vitest + Testing Library is the test stack) to catch any prop/type
  regressions from component swaps.

## Shared component inventory

| Component | Status | Notes |
|---|---|---|
| `Card` | exists, used only in Wallet | reuse everywhere |
| `MetricCard` | exists, **unused** | adopt in Phase 3 first, then Market/Token |
| `PageHeader` | exists, used only in Wallet | reuse everywhere |
| `PillTabs` | exists, light adoption | replaces `FilterSwitch` (deprecated) and `TabContainer` (deprecated) |
| `StatusBadge` | exists, used in Wallet | reuse for alert severity, token risk, identity tags |
| `AddressPill` | exists, used in Wallet | reuse anywhere a wallet/token address is shown |
| `PeriodSelector` | exists | already reusable, no change needed |
| `IconButton` | exists | reuse for premium/AI action buttons |
| `Button` variants | **missing** | build in Phase 0 |
| Generic `EmptyState` | **missing** | build in Phase 0 |
| `Tble` (data table) | exists, yoca-styled | prefer over `Table.tsx` when parity holds |
| `Table.tsx` (rich table) | exists, Carbon-styled | re-skin in place where migration to `Tble` isn't safe |

## Manual test plan (per page, run after its phase lands)

- **Market**: filters/tabs/ranking dropdown still change results identically;
  table sort/search/pagination unchanged; row click still navigates to token
  detail.
- **Token detail**: Overview/Markets/News/Historical Data tabs still load
  correct data; Wash Trading Detection button still triggers existing AI
  flow; chart period toggles still refetch.
- **Wallet detail**: all six card sections (Balance History, Asset
  Distribution, Portfolio, PnL, Swaps/Transfers, Last Traded Tokens) render
  with real wallet data; chart interactions unchanged.
- **Alerts**: create/edit/delete an alert rule end-to-end; toggle
  email/Discord/Helius notification settings and confirm persistence; follow/
  unfollow a wallet.
- **Profile/Activity**: export, search, and filter still function; empty
  state renders correctly for a fresh account.
- **Cross-page**: theme toggle (light/dark) works consistently on every page;
  header nav (Market/Alerts links, search, account panel, notifications)
  behaves identically pre/post redesign.

## Known-limitation flags to carry into the final report

- Copy changes ("Market Radar", "Alert Center") are content decisions, not
  pure styling — flag anywhere the plan assumed a rename so a
  supervisor/product owner can confirm before it ships.
- `Table.tsx`→`Tble` migration is conditional on feature parity; any page
  where parity doesn't hold should be called out explicitly rather than
  silently re-skinned differently from its siblings.
- This plan doesn't cover `pages/transactions/*`, `pages/walletsComparison/*`,
  `pages/wash-trading/*`, `pages/historical-data/*`, `pages/token-overview/*`,
  or `pages/pricing/*` — the brief's six named pages only. If those are
  visually inconsistent after this pass, they need a follow-up plan.

## Final report template (produce after implementation, not part of this doc)

When this plan is executed, the implementer should report:
1. Files changed (grouped by phase/page).
2. What UI was improved, page by page, with before/after description.
3. Any known limitations or deferred items (see above list as a starting
   point).
4. Manual test steps actually performed for each of the six pages (use the
   "Manual test plan" section above as the checklist).
