# Yoca Frontend — Design Reference & Component API

## 1. Tech Stack & Tooling

| Layer | Choice |
|---|---|
| **Framework** | React 19 + TypeScript 5.9 |
| **Build** | Vite 7 via `@vitejs/plugin-react` |
| **UI Kit** | IBM Carbon Design System v11 (`@carbon/react` 1.96, `@carbon/styles`, `@carbon/icons-react`) |
| **Styling** | SCSS modules (`*.module.scss`) + Tailwind v4 (landing page only, via `@tailwindcss/vite` plugin) |
| **State** | React Contexts (auth, theme, localization, chart, watchlist, solana wallet) |
| **Data Fetching** | SWR-like `useGet` hook (custom) + direct fetch in `services/*` |
| **Routing** | `react-router` v7 with `createBrowserRouter` |
| **Charts** | Apache ECharts 5 (`echarts`, `echarts-for-react`) |
| **Forms** | `react-hook-form` + `zod` (via `@hookform/resolvers`) |
| **Auth** | `@react-oauth/google`, Solana wallet adapter, JWT |
| **Payments** | Stripe (React + JS SDK) |
| **Drag/Resize** | `react-rnd` (mini-player) |
| **Animation** | `framer-motion` |
| **Date** | `date-fns` / `date-fns-tz` / `dayjs` |
| **Tests** | Vitest + jsdom + Testing Library |
| **Path Aliases** | `@/` → `client/src/`, `@sv/` → `server/src/` |

---

## 2. Design Principles

### 2.1 Carbon Design System as Foundation

Every reusable component wraps Carbon v11 primitives (DataTable, Tag, ComposedModal, ContentSwitcher, etc.) with Yoca-specific styling, behavior, and ergonomics. The Carbon theme is applied via `<GlobalTheme>` + `<Theme>` from `@carbon/react`. See `contexts/ThemeContext.tsx:m67-78`.

### 2.2 Yoca Theme Layer (CSS Custom Properties)

All files under `client/src/styles/theme.scss` define `--yoca-*` CSS variables scoped to `.yoca-app-theme` with light/dark variants via `data-yoca-theme="light|dark"`. Variables cover: bg, surface (with alpha), borders, text, primary, accent, success/danger/warning, radius, and shadow.

Key variables:
```
--yoca-bg: #f5f7fb (light) / #070a13 (dark)
--yoca-surface: rgba(255,255,255,0.84) / rgba(18,24,38,0.82)
--yoca-primary: #7c3aed (purple)
--yoca-accent: #0fbaa7 / #2dd4bf (teal)
--yoca-primary-2: #2563eb (blue)
--yoca-highlight: #2563eb (light) / #2dd4bf (dark) — accent for inline highlights, borders, labels
--yoca-surface-gradient: radial gradient pair for subtle surface texture (optional)
```

### 2.3 Transition Defaults

```
* { transition: background-color, color, border-color, box-shadow, opacity 0.2s cubic-bezier(0.2,0,0.38,0.9) }
button, input, a { transition adds transform; duration 0.15s }
body.no-transition * { transition: none !important }
```

### 2.4 Layout Constants (in `styles/_variables.scss`)

| Variable | Value |
|---|---|
| `$header-height` | 64px |
| `$sidebar-width` | 256px |
| `$footer-height` | 48px |
| `$border-radius-md` | 0.375rem |
| `$border-radius-lg` | 0.5rem |
| `$transition-base` | 0.2s |

---

## 3. Context Architecture

Provider nesting order in `main.tsx`:
```
ThemeProvider > AuthProvider > GoogleOAuthProvider > SolanaProvider > LocalizationProvider > WatchlistProvider > ChartProvider
```

### 3.1 ThemeContext (`client/src/contexts/ThemeContext.tsx`)
- Exposes: `{ theme, toggleTheme, themeRef }`
- `theme` = `"light" | "dark"`
- Maps to Carbon themes: light→`white`, dark→`g100`
- Persists to `localStorage` under `yoca_theme`
- `themeRef` is used as a portal target for filter popups (Table.tsx)

### 3.2 LocalizationContext (`contexts/LocalizationContext.tsx`)
- Exposes: `{ lang, setLang, tr, fmt }`
- Supports `"en"` and `"vi"` — translations in `config/localization/{en,vi}.ts`
- `tr(key, params?)` — typed translation function with interpolation (`{{key}}`) and plural support (`singular|plural` with `count` param)
- `fmt` — typed number/datetime/text formatters per locale
- Persists to `localStorage` under `yoca_language`

### 3.3 AuthContext (`contexts/AuthContext.tsx`)
- Exposes: `{ user, isUserLoading, refreshUser, signOut, openAuthModal, ... }`
- User type: `{ userId, displayName, avatarUrl }`
- AuthGuard wraps protected routes, redirects to `/unauthorized`

### 3.4 ChartContext (`contexts/ChartContext.tsx`)
- Exposes: `{ selectedTimezone, setTimezone, registerChart, unregisterChart, refreshAllCharts }`
- Timezone defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`

---

## 4. Reusable Component API Reference

### 4.1 Layout Components

#### PageWrapper — `components/wrapper/PageWrapper.tsx`
Primary app shell. Includes Carbon Header (nav, search, language, notifications, account, theme toggle), SideNav, MarketTicker bar, and `<Content>` slot.
```tsx
<PageWrapper
  noMarketTickers?   // default true — hide trending bar
  wideContent?       // wider content area
  extraHeaderPanel?  // { isOpen, content, size?, onClose }
  authPopup?         // { isOpen, onClose }
>
  {children}
</PageWrapper>
```
- Ctrl+K / Cmd+K opens search overlay
- Resets scroll on route change

#### Flex — `components/Flex.tsx`
CSS-flex wrapper — **the primary layout primitive** across the app (used in almost every component).
```tsx
<Flex dir="row" align="center" justify="between" gap={4} p={2} inline>
```
- Props: `dir`, `align`, `justify`, `wrap`, `gap`, `rowGap`, `colGap`, `inline`, and CSS logical spacing: `p`, `pBlock`, `pInline`, `px`, `py`, `m`, `mBlock`, `mInline`, `mBlockStart/End`, `pInlineStart/End`, `inlineSize`, `minInlineSize`, `maxBlockSize`
- Spacing values: `number` → `number * 0.125rem`, `string` → passthrough
- Appears in ~50+ components

#### Txt — `components/Txt.tsx`
Text primitive — used instead of raw `<span>` for consistent typography.
```tsx
<Txt size="sm" secondary bold mono ellipsis stretch uppercase align="center">
```
- Sizes: `xs(0.5rem)`, `sm(0.75rem)`, `md(1rem)`, `lg(2rem)`, `xl(3rem)`, `2xl(4rem)`
- Weights: `regular(400)`, `medium(500)`, `semibold(600)`, `bold(700)`
- Secondary color uses `cds.textSecondary` CSS var
- `mono` → `font-family: monospace`

### 4.2 Data Display Components

#### Tble � `components/Tble.tsx` (Data Table)
**Primary native table component** � Yoca-styled table shell with search, pagination, sticky headers, loading/empty states, sort configs, cell renderers, and lightweight filters.
```tsx
<Tble
  rows={[{ id: "1", name: "Alice", valueUsd: 120 }]}
  headers={[{ header: "Name", key: "name", align: "start", width: 200, minWidth: 100 }]}
  title="Table Title"
  description="Optional subtitle"
  loading={false}
  height={400}
  enableSearch
  searchFields={["name", "address"]}
  enablePagination
  pageSize={20}
  pageSizes={[8,16,24,32]}
  stickyHeader
  boxed
  toolBar={<button />}
  onRowClick={(row, idx) => void}
  sortConfigs={{ valueUsd: { type: TbleSortType.Number } }}
  filterSchema={{
    name: { type: TbleFilterType.Select },
    valueUsd: { type: TbleFilterType.Range, min: 0, max: 1000, step: 1 },
    mixed: { type: TbleFilterType.Composite, filters: { name: { type: TbleFilterType.Select } } }
  }}
  cellRenderers={{ name: (value, row) => <TokenIdentityCell symbol={String(value)} /> }}
/>
```
- Alignment: `header.align` ? `"start" | "center" | "end"`.
- Search is opt-in with `enableSearch`; use `searchFields` to restrict search to stable primitive row fields.
- Supported filters: searchable checkbox `Select`, dual-slider `Range`, and nested `Composite` groups. Date filters stay on the old rich `Table` until explicitly migrated.
- Active filters use `ChartTag`; filter popovers use native inputs/buttons and `--yoca-*` styling.
- Wallet holdings tables should use `Tble`; condense holding amount + USD value into one column when both are row-level portfolio values.
#### Table — `components/tables/Table.tsx` (Rich Table)
Advanced table with column-level filtering, sort configs, AI actions, and CSV export. Uses `TableWrapper` as outer shell.
```tsx
<Table
  title="Table"
  headers={["Col A", { header: "Col B", minWidth: 120, align: "center" }]}
  dataEntries={[][]}
  filterSchema={{ 0: { type: FilterType.Select }, 1: { type: FilterType.Range, min: 0, max: 100 } }}
  sortConfigs={{ 0: { type: SortType.Number } }}
  isSortable={[true, false]}
  cellRenderers={[null, renderPositiveNegative]}
  maxHeight={500}
  onRowClick={(row, idx) => void}
  onRowAiAction={(row, idx, e) => void}
  serverPagination={{ enabled, hasMore, onPageChange }}
/>
```
- Filter types: `Select`, `Range`, `Date`, `Composite`
- Sort types: `String`, `Date`, `Priority`, `Number`
- Filter popup portal to `themeRef.current` (for z-index/overflow)
- See `TableCellRenderer.tsx` for cell rendering helpers

#### TableCellRenderer — `components/tables/TableCellRenderer.tsx`
Cell rendering utility functions:
- `renderCode(value)` — monospace secondary color
- `renderLong(value, renderFn, limit=6)` — truncate with hover tooltip
- `renderHash(value)` — `6x...x4` format with copy button
- `renderStatus(value, successVals, successIcon, errorIcon)` — success/error with icon
- `renderPositiveNegative(value, icon?, percentage?)` — colored +/-
- `renderCurrency(value, symbol)` — with prefix/suffix
- `renderDateTime(value, options?)` — localized datetime
- `renderRelativeTime(value)` — "3h ago"
- `renderSparkline(value)` — small SparklineChart
- `renderTokenCell(token, formatAmount)` — token identity + amount
- `renderReducedNumber(value, renderFn, locale)` — compact notation + <0.0001 handling
- `renderLongCode(value)` — shorthand for renderLong+renderCode
- `createProfilePortfolioCellRenderers(options)` — editable label + unlink buttons

#### StrctLst — `components/StrctLst.tsx`
Carbon StructuredList wrapper for simple key-value list display.
```tsx
<StrctLst
  headers={[{ key: "field", header: "Field" }]}
  rows={[{ field: "Value" }]}
  loading={false}
/>
```

#### TknImg — `components/TknImg.tsx`
Token logo image with skeleton loading and fallback.
```tsx
<TknImg src={url} size={32} loading={false} alt="Token" />
```

#### TrendNum — `components/TrendNum.tsx`
Numeric trend display with auto-colored arrow/plus-minus prefix.
```tsx
<TrendNum
  value={0.05}
  direction="auto"      // "in" | "out" | "none" | "auto"
  prefixes="arrow"      // "plus-minus" | "arrow" | "none"
  formatter={(v) => fmt.num.percent(v)}
  size="sm"
  epsilon={1e-20}
  mono
/>
```
- Positive → green + CaretUp; Negative → red + CaretDown; Neutral → muted

#### TrendNumWithSign — `components/TrendNumWithSign.tsx`
Extends TrendNum with `forceSign` to coerce direction: `"positive" | "negative"`.

#### CpyBtn — `components/CpyBtn.tsx`
Copy-to-clipboard icon button with checkmark feedback (2s).
```tsx
<CpyBtn size="sm" copyWhat="text" align="right" />
```

#### FilterSwitch — `components/FilterSwitch.tsx` ⚠️ DEPRECATED (replaced by `PillTabs`)
Carbon ContentSwitcher wrapper for filter toggles. New code should use `PillTabs` instead.
```tsx
<FilterSwitch
  options={[{ value: "24H", label: "24H" }]}
  value="24H"
  onChange={(v) => setPeriod(v)}
  width="md"    // "sm"(8rem) | "md"(12.5) | "lg"(16) | "xl"(25) | "2xl"(32) | number
/>
```

#### Card — `components/common/Card/` (NEW)
Subtle border + shadow container with optional header bar. Used as primary section wrapper across wallet page.
```tsx
<Card
  title="Section Title"
  subtitle="Optional description"
  actions={<Button />}      // top-right action slot
  hoverable                 // elevates on hover
  padding="1rem"            // custom padding override
>
  {children}
</Card>
```

#### MetricCard — `components/common/MetricCard/` (NEW)
Compact KPI display with label, large value, optional trend indicator and icon. Used in WalletHero grid.
```tsx
<MetricCard
  label="Total PnL"
  value={fmt.num.compact.currency(12345)}
  trend={{ value: 12.5, direction: "up" | "down" | "neutral" }}
  subtitle="Realized + Unrealized"
  icon={<Icon />}
  size="sm" | "md" | "lg"
/>
```

#### PageHeader — `components/common/PageHeader/` (NEW)
Consistent page heading hierarchy: eyebrow → title → subtitle, with optional pill tab strip and actions slot.
```tsx
<PageHeader
  eyebrow="Wallet Intelligence"    // small uppercase label
  title="Wallet Detail"
  subtitle="Track holdings, capital flow..."
  actions={<Button />}
  tabs={[{ label: "7d", value: "7" }]}
  activeTab="7"
  onTabChange={(v) => void}
/>
```

#### PillTabs — `components/common/PillTabs/` (NEW)
Rounded `999px` pill tabs — replaces `FilterSwitch`/`ContentSwitcher` for period and filter toggles.
```tsx
<PillTabs
  options={[{ label: "7d", value: "7" }]}
  value="7"
  onChange={(v) => void}
  size="sm" | "md"
/>
```

#### StatusBadge — `components/common/StatusBadge/` (NEW)
Compact colored pill for status indicators (identity, risk level, alert severity).
```tsx
<StatusBadge
  label="Known"
  variant="success" | "warning" | "error" | "info" | "neutral"
  icon={<Icon />}
  size="sm" | "md"
/>
```

#### AddressPill — `components/common/AddressPill/` (NEW)
Truncated address display with optional copy button and label. Used for wallet addresses across the app.
```tsx
<AddressPill
  address="AbcDef...1234"
  label="Display Name"
  copyable
  truncate                    // 6...4 format
  icon={<Icon />}
  onClick={() => void}
  size="sm" | "md"
/>
```

#### DismissibleContentTag — `components/DismissibleContentTag/DismissibleContentTag.tsx`
Carbon Tag with custom close button and Flex layout.
```tsx
<DismissibleContentTag type="blue" onClose={handleClose}>
  Content
</DismissibleContentTag>
```

### 4.3 Tab / Accordion Components

#### TabContainer — `components/tabContainer/tabContainer.tsx` (deprecated, use PillTab or SegmentedControl)
```tsx
<TabContainer
  activeTab={0}
  names={["Tab 1", "Tab 2"]}
  tabIcons={[<Icon />]}
  tabs={[<Panel1 />, <Panel2 />]}
  onTabChange={(i) => void}
  actions={<Button />}
  preserveMountedPanels  // keep hidden panels mounted
  visitedTabIndices       // set of visited indices (used with preserve)
  orientation="horizontal" | "vertical"
/>
```

#### DropdownPanelField — `components/DropdownPanelField/DropdownPanelField.tsx`
Dropdown with a custom panel (not a listbox — renders arbitrary content).
```tsx
<DropdownPanelField
  id="field"
  titleText="Label"
  placeholder={<span>Select...</span>}
  value={currentValue}
  onValueChange={(v) => setValue(v)}
  renderValue={(v) => <span>{v}</span>}
  renderPanel={({ closePanel, setValue, value }) => <CustomPanel />}
  invalid invalidText helperText
/>
```
Supports controlled and uncontrolled modes. Panel opens as a popover below the trigger.

---

### 5. Chart System — `components/charts/`

### 5.1 ChartWrapper (`charts/shared/ChartWrapper.tsx`)
Base chart wrapper — provides consistent header, loading/error/empty states, export menu, fullscreen, and mini-player.
```tsx
<ChartWrapper
  title="Chart Title"
  loadingState={{ status, error, retryCount }}
  onRetry={refetch}
  isEmpty={false}
  emptyState={{ title, message, action }}
  enableExport onExport
  enableFullscreen enableMiniPlayer
  toolbarLayout="default" | "stacked"
  wrapperMinHeight={300}
>
  <ECharts option={option} />
</ChartWrapper>
```
- Statuses: `idle`, `loading` (skeleton), `success` (children), `error` (error state), `refreshing` (children visible)
- `data-html2canvas-ignore="true"` on controls for export
- Exports: PNG, SVG, CSV via ExportMenu
- Fullscreen uses native Fullscreen API + modal fallback
- MiniPlayer: draggable/resizable via react-rnd, ESC to close

### 5.2 BaseChart (`charts/Base/BaseChart.tsx`)
Simplest chart wrapper — thin wrapper around ChartWrapper with ChartStyle module class.

### 5.3 ChartContainer + ChartSection (`charts/shared/ChartContainer.tsx`)
Flexbox layout for multi-section charts.
```tsx
<ChartContainer direction="column" gap="1.5rem">
  <ChartSection minHeight="300px">
    <Chart />
  </ChartSection>
</ChartContainer>
```

### 5.4 ChartGrid + ChartGridItem (`charts/shared/ChartGrid.tsx`, `ChartGridItem.tsx`)
```tsx
<ChartGrid itemCount={3} multiItemColumns={3} autoFit minColumnWidth="400px">
  <ChartGridItem minHeight={400} aspectRatio="16/9">
    <ChartWrapper>...
  </ChartGridItem>
</ChartGrid>
```

### 5.5 ChartStatsHeader (`charts/shared/ChartStatsHeader.tsx`)
```tsx
<ChartStatsHeader
  cards={[{
    title: "Card", onClick, isActive,
    stats: [{ label: "Max DD", value: "-25.5%", prefix, suffix }]
  }]}
  minColumnWidth="200px"
/>
```

### 5.6 ExportMenu (`charts/shared/ExportMenu.tsx`)
Dropdown export menu with spinner.
```tsx
<ExportMenu onExport={handleExport} isExporting disabled formats={["png","svg","csv"]} />
```
- `data-html2canvas-ignore="true"` on wrapper
- Trigger button: download icon with loading spinner SVG animation

### 5.7 TimezoneSelector (`charts/shared/TimezoneSelector.tsx`)
UTC±offset selector for charts.

### 5.8 Chart State Components (in `charts/shared/`)
- `ChartSkeleton` — Carbon SkeletonPlaceholder, default height 400px
- `ChartEmptyState` — SVG icon + title + message + optional action button
- `ChartErrorState` — error icon + message + retry button + optional technical details <details>


### 5.9 ChartControls (`charts/shared/ChartControls/`) — Preferred for chart/table-local controls
Use these non-Carbon controls for compact chart headers, table tabs, token selectors, search inputs, and inline chart chips.
```tsx
<SegmentedControl options={options} value={value} onChange={setValue} ariaLabel="Mode" />
<SearchBox value={query} onChange={setQuery} placeholder="Search tokens..." />
<ChartSelect items={items} value={value} onChange={setValue} renderOption={...} actionIcon={Plus} onAction={addItem} />
<ChartTag label="SOL" value={<TrendNum ... />} onDismiss={removeToken} />
<IconActionButton label="Open" icon={ExternalLink} href={url} />
```
- Preferred replacements for `FilterSwitch`, Carbon `ContentSwitcher`/`IconSwitch`, Carbon chart-local `Button`, Carbon `Tag`, and Carbon `IconButton`.
- Also used outside chart context: `ChatPromptMenu` uses `SearchBox`; `WalletChat` header uses `SegmentedControl` for position switching (left/right/fullscreen).
- Header controls should be passed through `ChartWrapper.actions` and right-aligned in the chart header, not placed in the chart body.
- Styling uses `--yoca-*` theme variables and native buttons/links.
- Asset distribution charts should render as a two-section layout: label-less donut on the left, custom bounded legend on the right with color swatches and percentages. `Others` stays a single aggregate row; hidden token names are not rendered in the chart body.
- Carbon `Dropdown`, `FilterableMultiSelect`, chart-local filter dropdowns, Carbon chart buttons, and Carbon tags are deprecated for new chart/table-local controls.

### 5.10 Chart Types (`types/chart.types.ts`)
| Type | Description |
|---|---|
| `ChartType` | `line`, `area`, `bar`, `stackedBar`, `pie`, `donut`, `dualAxis` |
| `LoadingStatus` | `idle`, `loading`, `success`, `error`, `refreshing` |
| `ChartConfiguration` | colors, height, legend, axes, timezone, sampling, export filename |

Default config: height=400, showLegend, legendPosition=bottom, sampling enabled at 2000 points.

### 5.11 Chart Props (`charts/shared/ChartProp.tsx`)
```tsx
interface ChartProps {
  title?, minHeight?, initialFilters?, tokenSelectorOptions?,
  maxTokenTags?, autoRefresh?, refreshInterval?,
  fetchEnabled?, className?, onDataLoaded?, onError?, actions?
}
```

### 5.12 Concrete Chart Implementations

| Component | Location | Purpose |
|---|---|---|
| `BalanceChartV2` | `BalanceChartV2/` | Wallet balance over time |
| `PnLChart` | `PnLChart/` | Profit & loss timeline |
| `TokenPriceChart` | `TokenPriceChart/` | Token price with tooltip |
| `Winrate` | `Winrate/` | Win rate distribution |
| `AggregatedAssetDistribution` | `AggregatedAssetDistribution/` | Asset allocation pie |
| `AssetDistribution` | `AssetDistribution/` | Per-wallet asset breakdown |
| `CandleStickChart` | `CandleStickChart/` | OHLC candles |
| `Drawdown` | `Drawdown/` | Drawdown timeline |
| `GeckoTerminalChart` | standalone | GeckoTerminal embed |
| `MultiTimeSeriesLineChart` | `MultiTimeSeriesLineChart/` | Multi-wallet comparison |
| `RollingProfitAndLoss` | `RollingProfitAndLoss/` | Rolling PnL |
| `SparklineChart` | `SparklineChart/` | Mini sparklines |
| `StablecoinRatio` | `StablecoinRatio/` | Stablecoin allocation |
| `TimeSeriesLineChart` | `TimeSeriesLineChart/` | Single line chart |
| `TimeSeriesTradesScatterChart` | `TimeSeriesTradesScatterChart/` | Trade scatter overlay |
| `TokenTreeMap` | `TokenTreeMap/` | Treemap allocation |
| `TotalTradingVolume` | `TotalTradingVolume/` | Volume bars |
| `TradingVolume` | `TradingVolume/` | Volume per wallet |
| `TradingVolumeDistribution` | `TradingVolumeDistribution/` | Volume distribution |
| `TransactionDistribution` | `TransactionDistribution/` | Tx distribution |
| `BalanceChartMultiV2` | `BalanceChartMultiV2/` | Multi-wallet balance |
| `ProfileTradeFrequencyHeatmap` | `ProfileTradeFrequencyHeatmap/` | Trade frequency |

---

## 6. Auth Components — `components/auth/`

### AuthModalBase / SignInModal / SignUpModal
Animated side-by-side login/register modal with slide toggle. Includes:
- Email/password forms (zod-validated)
- Forgot password flow (email → 6-digit code → reset)
- Google OAuth button
- Solana wallet auth button
- Supports both dark and light themes (`.light*` CSS class variants)
- Animation: container shifts between login (left) and register (right) panels

### AuthGuard
Wraps protected routes. Shows Loading while checking auth, redirects to `/unauthorized` if not authenticated (preserves attempted path in location state).

---

## 7. Wallet Components — `components/wallet/`

| Component | File | Role |
|---|---|---|
| `WalletOverview` | `WalletOverview/` | Full wallet header: name, address, tags, identity, age, stats sections, period selector, bookmark/follow/share/compare, sub-sections (Value, PnL, Trading, WinRate banner). ~600 lines. |
| `WalletTopbar` | `WalletTopbar/` | Sub-header with wallet identity (`AddressPill`, `StatusBadge`), `PillTabs` period selector, bookmark/follow/compare/share/AI buttons, tag/label modals |
| `WalletHero` | `WalletHero/` | 4-column CSS grid of `MetricCard`s: Total Asset Value, Total PnL, Trading Volume, Win rate with sub-metrics |
| `WalletHoldingsPanel` | `WalletHoldingsPanel/` | Sidebar portfolio holdings list |
| `WalletChat` | `WalletChat/` | AI chat sidebar/overlay with context. Uses `SegmentedControl` for position (left/right/fullscreen), `SearchBox` from ChartControls, `lucide-react` icons (migrated from `@carbon/icons-react`). Features circular header buttons (`.circleBtn`), border-left highlighted section blocks (`.sectionBlock`), contextual plans popup, and real-time usage quota label. |
| `AiAnalysisModal` | `AiAnalysisModal/` | Full AI analysis modal |
| `WalletAiAnalysisPopup` | `WalletAiAnalysisPopup/` | Quick AI popup |
| `SwapDetailModal` | `SwapDetailModal/` | Swap transaction detail |
| `TransferDetailModal` | `TransferDetailModal/` | Transfer detail |
| `DayActivityPopup` | `DayActivityPopup/` | Day-level activity overview |
| `AiSwapSummaryModal` | `AiSwapSummaryModal/` | AI summary of swaps |
| `WalletAuditPanel` | `WalletAuditPanel/` | Forensic audit panel |
| `WalletLabelModal` | `WalletLabelModal/` | Edit wallet label |
| `WalletTagsModal` | `WalletTagsModal/` | Manage tags |
| `WalletComparison` | `WalletComparison/` | Multi-wallet comparison |
| `TokenLogoCell` | `TokenLogoCell/` | Token logo + symbol cell |
| `SwapPairCell` | `SwapPairCell/` | Swap pair display |
| `QuickAiPopup` | `QuickAiPopup/` | Quick AI insight popup |
| `WalletTransactionActivity` | `WalletTransactionActivity/` | Swap + Transfer activity tables section |

#### Chat Section Design Pattern

Wallet chat sections (`.sectionBlock`, `.tldr`, `.warnings`) follow a left-border highlight pattern instead of card containers:

```
position: relative;
margin: 0.6rem 0;
padding-left: 12px;
border-left: 2px solid var(--yoca-highlight);
```

- Section headers and copy buttons use `--yoca-highlight` for accent color
- Section kind labels are plain uppercase text (no icon badges, no colored backgrounds)
- Copy buttons are absolute-positioned, opacity 0 → 1 on parent hover
- TLDR and warnings dropped the numbered/icon badges — rely on text hierarchy

#### Chat Panel Positioning

The wallet page uses CSS custom properties on `.pageLayout` for chat overlay positioning:

| Variable | Default | `.rightSidebarExpanded` |
|---|---|---|
| `--chat-panel-right-offset` | `96px` | `400px` |
| `--chat-launcher-offset` | `56px` | `400px` |
| `--chat-panel-bottom-offset` | `16px` | `16px` |
| `--chat-panel-top-offset` | `calc(3.5rem + 16px)` | unchanged |
| `--chat-panel-left-offset` | `16px` | unchanged |

Both share the same `400px` offset when expanded so the chat panel and launcher read as part of the main content area, with breathing room from the right sidebar.

---



## 8. Market Components — `components/market/`

| Component | Role |
|---|---|
| `TickerBar` | Scrolling market ticker |
| `MarketTabs` | Tab navigation for market views |
| `TokenPerformanceTable` | Token ranking table |
| `TokenPriceHistoryChart` | Price chart on market page |
| `TraderTable` | Trader ranking table |
| `TransactionTable` | Recent transactions table |
| `ProfitableTradersView` | Top profitable traders |
| `HighlightsMiniList` | Highlighted tokens |
| `DexTable` | DEX listing table |
| `AssetInfo` | Asset detail card |

---

## 9. Token Components — `components/token/`

| Component | Role |
|---|---|
| `TokenHeader` | Token name, price, badge |
| `TokenTabs` | Tab navigation for token page |
| `TokenChart` | Primary price chart |
| `TokenOverviewChart` | Overview price area |
| `TokenOverviewStats` | Key stats grid |
| `MarketStats` | Market metrics |
| `TokenAllocation` | Allocation breakdown |
| `TopHolders` | Holder list |
| `TopHoldersTable` | Holder table |
| `TokenMarketsTable` | Markets table (DEX list) |
| `InfoDropdown` | Expandable info section |
| `InfoTooltip` | Tooltip info icon |
| `RecentTransactions` | Recent tx list |
| `NewsCard` | News article card |
| `NewsTab` | News tab content |
| `TokenAIChat` | AI chat for token |
| `VolatilitySignals` | Volatility indicators |
| `TokenInvestors` | Investor list |
| `PoolSelector` | Pool selection dropdown |
| `GlobalPrices` | Global price feed |
| `TokenUnlockSchedule` | Vesting/unlock timeline |
| `TokenIdentityCell` | Token logo + symbol + name cell |

---

## 10. Search Components — `components/search/`

### SearchBar
Overlay search panel (Ctrl+K). Fetches from `/search` endpoint with 320ms debounce. Results split into Tokens, Pools, Wallets sections. Keyboard navigation (↑↓EnterEsc) with hover/focus hijack. Active token shown in side panel (TokenStatsPanel) with chart.

Result items: `TokenResultItem`, `PoolResultItem`, `WalletResultItem` — each with isFocused, onSelect callbacks.

### SearchableListPanel
Generic searchable filtered list panel.

---

## 11. Payment Components — `components/payment/`

| Component | Role |
|---|---|
| `CheckoutForm` | Stripe checkout |
| `PaymentModalWrapper` | Modal wrapping payment flow |
| `SolanaPaymentFlow` | SOL/USDC payment |
| `AuthReminderModal` | Prompts login before payment |
| `PaymentSuccessModal` | Post-payment success |
| `PrivacyTransactionId` | Private tx ID display |

---

## 12. Common UI Patterns

### PeriodSelector — `components/common/PeriodSelector/PeriodSelector.tsx`
Uses `config/periodOptions.ts` which defines: `"24H" | "7D" | "30D" | "90D" | "All"`. Buttons with `.chartToggle` / `.chartToggleButton` shared styles.

### ErrorLayout — `components/error/ErrorLayout.tsx`
Minimalist error page with big watermark number, gradient glow circles, overline, title, description, detail, and action buttons. Uses Tailwind utility classes directly (hardcoded strings). Exports `ERROR_ACTION_GROUP_CLASSNAMES`, `ERROR_PRIMARY_ACTION_CLASSNAMES`, `ERROR_SECONDARY_ACTION_CLASSNAMES` for composing actions.

### ModelStateManager — `components/ModelStateManager.tsx`
Render-prop pattern for modal open/close state and portal rendering to `#modal-root`.

### WalletReportTemplate — `components/WalletReportTemplate.tsx`
PDF report layout with sections for overview, holdings, activity/risk. Used by wallet page's PDF export.

### WalletAnalystPanel — `components/WalletAnalystPanel.tsx`
AI analyst panel (re-exports from elsewhere).

---

## 13. Carbon Theme Utility — `util/carbon-theme.ts`

Static object `cds` mapping Carbon v11 CSS custom properties to typed keys:
```ts
cds.background, cds.layer01, cds.textPrimary, cds.textSecondary,
cds.supportSuccess, cds.supportError, cds.supportWarning, cds.supportInfo,
cds.borderInteractive, cds.focus, cds.interactive, etc.
```
Used everywhere for inline styles (e.g., `color: cds.supportSuccess`, `background: cds.layer01`).

---

## 14. Data Fetching Patterns

### useGet — `hooks/useGet.ts`
Generic typed fetch hook wrapping `swr` or custom logic. Accepts Hono RPC endpoint, params, and options (`enabled`, `select`).
```tsx
const { data, isLoading } = useGet(client.api.search.index, 200, {
  query: { q: query }
}, { enabled: query.length > 0, select: (raw) => mapped })
```

### Services pattern
API calls follow `services/{domain}/` structure:
- `services/wallet/walletApi.ts` — fetchWalletOverview, fetchWalletSwaps, fetchWalletTransfers, fetchWalletPortfolio, fetchWalletIntelligence
- `services/profile/profileApi.ts`, `services/tokenAiChat.ts`, `services/news.ts`, etc.
- No global SWR provider — each page manages its own fetch state.

---

## 15. Config / Constants

- `config/constants.ts`: `THEME_LOCAL_STORAGE_KEY`, `ID_MODAL_ROOT`, `ONE_DAY_MS`, `SOLSCAN_ACCOUNT_URL`, `SOLSCAN_TX_URL`, `SUCCESS_COLOR`, `ERROR_COLOR`, etc.
- `config/periodOptions.ts`: `PERIOD_OPTIONS` array with `{ key: PeriodKey, labelKey: PeriodLabelKey }`
- `config/localization/`: `/en.ts` (2669 lines), `/vi.ts` — translations organized by domain keys

---

## 16. Style Architecture Summary

| File | Purpose |
|---|---|---|
| `styles/theme.scss` | `--yoca-*` CSS vars, light/dark themes, global transitions |
| `styles/carbon.scss` | Carbon import with `@use "@carbon/styles"` |
| `styles/_variables.scss` | SCSS variables (layout, spacing, z-index, breakpoints) |
| `styles/_tokens.module.scss` | Design token SCSS variables (card, metric, pill, badge, address, button tokens) |
| `styles/_semantic.module.scss` | `.positive`/`.negative` utility classes |
| `styles/_overwrite.module.scss` | Carbon component overrides + shared utility classes (`.card`, `.metricValue`, `.pageTitle`, `.pillTab`, `.statusBadge`, `.emptyState`, `.addressPill`) |
| `styles/landing-tailwind.css` | Tailwind v4 for landing page with scoped reset |
| `**/*.module.scss` | Co-located component styles |

---

## 17. Key File Paths Quick Reference

| What | Path |
|---|---|
| App entry | `client/src/main.tsx` |
| Router config | `client/src/App.tsx` |
| Theme context | `client/src/contexts/ThemeContext.tsx` |
| Auth context | `client/src/contexts/AuthContext.tsx` |
| Localization | `client/src/contexts/LocalizationContext.tsx` |
| Chart context | `client/src/contexts/ChartContext.tsx` |
| Page shell | `components/wrapper/PageWrapper.tsx` |
| Table (simple) | `components/Tble.tsx` |
| Table (rich) | `components/tables/Table.tsx` |
| Table cell renderers | `components/tables/TableCellRenderer.tsx` |
| Table shell | `components/tables/TableWrapper.tsx` |
| Flex layout | `components/Flex.tsx` |
| Text primitive | `components/Txt.tsx` |
| Chart wrapper | `components/charts/shared/ChartWrapper.tsx` |
| Chart shared exports | `components/charts/shared/index.ts` |
| Chart types | `types/chart.types.ts` |
| Chart base props | `components/charts/shared/ChartProp.tsx` |
| Carbon theme tool | `util/carbon-theme.ts` |
| Auth modal | `components/auth/SignInModal.tsx` (also SignInModal/SignUpModal exports) |
| Tab container | `components/tabContainer/tabContainer.tsx` |
| Card (shared) | `components/common/Card/Card.tsx` |
| MetricCard (shared) | `components/common/MetricCard/MetricCard.tsx` |
| PageHeader (shared) | `components/common/PageHeader/PageHeader.tsx` |
| PillTabs (shared) | `components/common/PillTabs/PillTabs.tsx` |
| StatusBadge (shared) | `components/common/StatusBadge/StatusBadge.tsx` |
| AddressPill (shared) | `components/common/AddressPill/AddressPill.tsx` |
| Period selector | `components/common/PeriodSelector/PeriodSelector.tsx` |
| Wallet page | `pages/wallet/index.tsx` |
| Wallet overview | `components/wallet/WalletOverview/WalletOverview.tsx` |
| Wallet topbar | `components/wallet/WalletTopbar/WalletTopbar.tsx` |
| Wallet hero | `components/wallet/WalletHero/WalletHero.tsx` |
| Error layout | `components/error/ErrorLayout.tsx` |
| Payment components | `components/payment/` |
| Market components | `components/market/` |
| Token components | `components/token/` |
| Landing page | `components/landing/` |
| Styles — theme vars | `styles/theme.scss` |
| Styles — SCSS vars | `styles/_variables.scss` |
| Styles — Carbon overrides | `styles/_overwrite.module.scss` |
| Hooks | `hooks/` |
| Services | `services/` |
| Types | `types/` |
| Util | `util/` |
| API client | `api/main.ts` |

---

## 18. UI Refactoring Plan — Modernization Roadmap

### 18.1 Design Token System

Create a shared CSS module for design tokens to ensure consistency across all components:

**File:** `client/src/styles/_tokens.module.scss`
```scss
// Cards
$card-radius: 12px;
$card-border: 1px solid var(--yoca-border);
$card-shadow: 0 1px 3px rgba(0,0,0,0.04);
$card-shadow-hover: 0 4px 12px rgba(0,0,0,0.08);
$card-padding: 1rem;
$card-bg: var(--yoca-surface);

// Metric cards
$metric-card-min-width: 200px;
$metric-value-size: 1.75rem;
$metric-label-size: 0.75rem;

// Page headers
$page-header-bottom-margin: 1.5rem;
$page-title-size: 1.5rem;
$page-eyebrow-size: 0.7rem;

// Pill tabs
$pill-radius: 999px;
$pill-padding: 0.35rem 0.75rem;
$pill-font-size: 0.75rem;

// Address pills
$address-pill-radius: 6px;
$address-pill-bg: var(--yoca-surface-hover);

// Status badges
$badge-radius: 6px;
$badge-padding: 2px 8px;
$badge-font-size: 0.65rem;
$badge-font-weight: 600;

// Empty states
$empty-state-padding: 3rem 1rem;

// Buttons
$btn-radius: 8px;
$btn-primary-gradient: linear-gradient(120deg, #7c3aed, #2563eb);
$btn-danger-color: var(--yoca-danger);

// Circle icon button
$circle-btn-size: 2.25rem;
$circle-btn-radius: 999px;
$circle-btn-border: 1px solid var(--yoca-border);

// Left-border highlight section
$section-highlight-width: 2px;
$section-highlight-color: var(--yoca-highlight);
$section-padding-left: 12px;
```

### 18.2 Shared Component Library to Build

#### 18.2.1 PageHeader — `components/common/PageHeader/`
```tsx
interface PageHeaderProps {
  eyebrow?: string;       // small uppercase label above title
  title: string;
  subtitle?: string;
  actions?: ReactNode;    // buttons, filters, etc.
  tabs?: { label: string; value: string }[];
  activeTab?: string;
  onTabChange?: (v: string) => void;
  className?: string;
}
```
- Consistent heading hierarchy: `eyebrow` (uppercase, muted) → `title` (1.5rem, bold) → `subtitle` (muted, 0.875rem)
- Optional pill tab strip below title
- Actions slot aligned right
- Used by: wallet page, market page, alerts page, profile page, token pages

#### 18.2.2 Card — `components/common/Card/`
```tsx
interface CardProps {
  title?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;      // top-right actions
  hoverable?: boolean;
  padding?: string;
  className?: string;
  children: ReactNode;
}
```
- Subtle border + shadow, 12px border-radius
- Optional header bar with title + actions
- Hover elevation on `hoverable`

#### 18.2.3 MetricCard — `components/common/MetricCard/`
```tsx
interface MetricCardProps {
  label: string;
  value: string | ReactNode;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  subtitle?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```
- Used in WalletHero: Total Asset Value, Total PnL, Trading Volume
- Value in large bold type, label in small uppercase, optional trend arrow
- Flexible grid layout via parent (CSS grid with `minmax(200px, 1fr)`)

#### 18.2.4 PillTabs — `components/common/PillTabs/`
```tsx
interface PillTabsProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
}
```
- Rounded `999px` pills, active filled with primary gradient
- Replaces `FilterSwitch` and `ContentSwitcher` usage for period/tab selection
- Used by: PeriodSelector, wallet overview, market tabs, token tabs

#### 18.2.5 StatusBadge — `components/common/StatusBadge/`
```tsx
type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  size?: 'sm' | 'md';
}
```
- Compact colored pill with uppercase label
- Used for: win rate, risk level, identity status, alert severity

#### 18.2.6 AddressPill — `components/common/AddressPill/`
```tsx
interface AddressPillProps {
  address: string;
  label?: string;           // optional display name
  copyable?: boolean;
  truncate?: boolean;       // 6...4 format
  icon?: ReactNode;
  onClick?: () => void;
  size?: 'sm' | 'md';
}
```
- Rounded container with optional copy button and label
- Used everywhere wallet addresses appear

#### 18.2.7 EmptyState — `components/common/EmptyState/`
```tsx
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}
```
- Replaces ad-hoc empty states across profile, alerts, wallet pages
- Consistent icon, title, message, optional CTA button

#### 18.2.8 Button variants — consolidate in `components/common/Button/` (or extend Carbon's)
```tsx
// Custom variants not covered by Carbon:
<Button kind="danger" size="sm">    // Red destructive button
<Button kind="ghost-danger" size="sm">  // Ghost red (for delete icons)
```
- Wrap Carbon's `<Button>` with `kind="danger"` mapped to `--cds-support-error`
- Add `ghost-danger` variant for icon delete actions

### 18.3 Page-Specific Refactoring

#### 18.3.1 Wallet Page (`pages/wallet/index.tsx`) ✅ COMPLETED
**Goal:** Improve visual hierarchy of summary metrics and card consistency.

| Change | Detail | Status |
|---|---|---|
| **WalletHero → MetricCards** | CSS grid (4-col→2-col→1-col responsive) with `MetricCard` components: Total PnL (realized/unrealized split), Trading Volume (buy/sell split), Total Trades, Win rate (4th column) | ✅ Done |
| **WalletTopbar identity** | `AddressPill` for address display, `StatusBadge` for identity/risk badges, removed win rate mini-card | ✅ Done |
| **BalanceChartV2 / PnLChart** | Wrapped in `Card` component | ✅ Done |
| **WalletTransactionActivity** | Wrapped in `Card` component | ✅ Done |
| **WalletHoldingsPanel** | Wrapped in `Card` component | ✅ Done |
| **Page title area** | `PageHeader` with "Wallet Intelligence" eyebrow + "Wallet Detail" title | ✅ Done |
| **Period selector** | Replaced `Select` dropdown with `PillTabs` | ✅ Done |
| **Win rate** | Moved as 4th column in `WalletHero` (`MetricCard`) instead of `StatusBadge` or mini-card | ✅ Done |
| **TokenDetailsDemo FilterSwitch** | Replaced Carbon `FilterSwitch` with `PillTabs` in `TokenAverageTradePrice` | ✅ Done |
| **index.module.scss cleanup** | Removed `.pageIntro`, `.pageEyebrow`, `.pageTitle`, `.pageSubtitle`, `.section` + Carbon overrides (~150 lines) | ✅ Done |

**Layout structure after refactor:**
```
PageHeader (eyebrow="Wallet Intelligence", title="Wallet Detail")
WalletTopbar (AddressPill, StatusBadge, PillTabs period, action buttons)
MetricCard grid (4 columns)
├── Total PnL | Trading Volume | Total Trades | Win Rate
Card: Balance History
Card: Profit & Loss
Card: Swaps / Transfers (tables)
Card: Portfolio Holdings (sidebar)
```

#### 18.3.2 Alerts Page (`pages/alerts/`)
**Goal:** Make it look like a polished "Alert Center" with clean card separation.

| Change | Detail |
|---|---|
| **Page header** | Use `PageHeader` with "Alert Center" title |
| **Section separation** | Wrap each section in `Card`: Notification Settings, Create Alert, Active Alert Rules, Followed Wallets |
| **Alert rules table** | Use `Table` with `StatusBadge` for severity (critical/warning/info), cleaner delete action (ghost-danger icon button) |
| **Empty state** | Use `EmptyState` component when no alerts configured |
| **Followed wallets** | Display as card-based list with `AddressPill`, not raw table |
| **Notification settings** | Form elements in a card with clearer grouping (Email, Discord, Helius toggles) |
| **Table styling** | Use `_overwrite.module.scss` consistently; ensure sticky headers, proper padding |
| **Buttons** | Use `kind="danger"` for delete actions |

**Layout structure:**
```
PageHeader (title="Alert Center", subtitle="Manage notifications and alert rules")
Card: Notification Settings
├── Email toggle + input
├── Discord toggle + webhook input
├── Helius sync status
Card: Create Alert
├── Alert configuration form (existing logic, improved layout)
Card: Active Alert Rules
├── Table with StatusBadge + delete actions
├── EmptyState when no rules
Card: Followed Wallets
├── AddressPill list with unfollow button
```

#### 18.3.3 Profile / Activity Page (`pages/profile/`, `components/profile/`)
**Goal:** Fix empty states so they don't look unfinished.

| Change | Detail |
|---|---|
| **ProfileDashboardTab** | Use `EmptyState` for each empty sub-section (no activity, no portfolio, etc.) |
| **ProfileActivityTab** | Replace raw "No activity" text with `EmptyState` component |
| **ProfilePortfolioTab** | Use `Card` for wallet list, `StatusBadge` for auth wallet indicator |
| **ProfileWalletTab** | Consistent `Table` styling matching other pages |
| **ProfileAlertTab** | Same improvements as Alerts page |
| **ProfileOverview** | Use `MetricCard` for summary stats |
| **ProfileWatchlistTab** | Use `AddressPill` for watched wallet entries |
| **ProfileSubscriptionsTab** | Card-based plan display with status badges |

### 18.4 Global Style Overrides (`styles/_overwrite.module.scss`)

Add new shared classes:
```scss
// Card
.card {
  background: var(--yoca-surface);
  border: 1px solid var(--yoca-border);
  border-radius: 12px;
  padding: 1rem;
  transition: box-shadow 0.2s, border-color 0.2s;
  &.cardHoverable:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    border-color: var(--yoca-primary);
  }
}

// Metric value
.metricValue {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.metricLabel {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--yoca-text-muted);
}

// Page header
.pageEyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--yoca-text-muted);
  margin-bottom: 0.25rem;
}
.pageTitle {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

// Pill tabs
.pillTab {
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--yoca-border);
  background: transparent;
  color: var(--yoca-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  &.pillTabActive {
    background: var(--yoca-primary);
    border-color: var(--yoca-primary);
    color: #fff;
  }
  &:hover:not(.pillTabActive) {
    background: var(--yoca-surface-hover);
    border-color: var(--yoca-text-muted);
  }
}

// Status badge
.statusBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.4;
  &.success { background: rgba(var(--yoca-success), 0.12); color: var(--yoca-success); }
  &.warning { background: rgba(var(--yoca-warning), 0.12); color: var(--yoca-warning); }
  &.error { background: rgba(var(--yoca-danger), 0.12); color: var(--yoca-danger); }
  &.info { background: rgba(var(--yoca-primary), 0.12); color: var(--yoca-primary); }
  &.neutral { background: var(--yoca-surface-hover); color: var(--yoca-text-muted); }
}

// Empty state
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--yoca-text-muted);
  .emptyStateTitle { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
  .emptyStateMessage { font-size: 0.875rem; max-width: 24rem; }
  .emptyStateAction { margin-top: 1rem; }
}

// Address pill
.addressPill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--yoca-surface-hover);
  font-family: monospace;
  font-size: 0.75rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 18.5 Responsiveness Guidelines

- All card grids use CSS `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` for metric sections
- Tables scroll horizontally on narrow viewports (`overflow-x: auto` on wrapper)
- Page sidebars stack below main content on screens < 1024px
- Metric cards never exceed 2 columns on < 768px screens
- Wallet page: side `WalletHoldingsPanel` moves below charts on < 1200px
- All padding/radius values use `rem` for proportional scaling

### 18.6 Implementation Order

| Step | Item | Status |
|---|---|---|
| 1 | **Design tokens** — Create `_tokens.module.scss` with shared CSS classes | ✅ Done |
| 2 | **Card + MetricCard** — Build reusable components | ✅ Done |
| 3 | **PageHeader** — Build component | ✅ Done |
| 4 | **PillTabs** — Build and replace Carbon `FilterSwitch`/`ContentSwitcher` | ✅ Done |
| 5 | **StatusBadge + AddressPill** — Build and replace ad-hoc tags/pills | ✅ Done |
| 6 | **EmptyState** — Build and replace empty state text across profile/alerts | ❌ Pending |
| 7 | **Button variants** — Add danger/ghost-danger support | ❌ Pending |
| 8 | **Alerts page** — Card-based layout with EmptyState | ❌ Pending |
| 9 | **Profile/Activity page** — EmptyState + Card cleanup | ❌ Pending |
| 10 | **Wallet page** — Full Card/MetricCard/PageHeader integration | ✅ Done |

### 18.7 Constraints Recap

| Constraint | How we follow it |
|---|---|
| No business logic rewrites | Only CSS/component refactors; fetch/data logic untouched |
| No backend API changes | All changes in `client/src/` |
| No DB schema changes | Server/db untouched |
| No feature removal | Every existing UI element preserved, just re-skinned |
| Incremental refactors | Steps ordered by isolation; each step is independently deployable |
| Keep typecheck passing | No API/type changes; only visual layers modified |
| Responsive at laptop size | Grid breakpoints set at 768/1024/1200px |
| Tables horizontally scrollable | `overflow-x: auto` on table containers |

### 18.8 Testing Verification

After each step, manually verify:

| Page | Test |
|---|---|
| **Wallet page** | Metric cards show all 4 columns at 1440px; collapse to 2 at 900px, 1 at 600px. Win rate color correct. `PillTabs` period filter works. Charts/tables wrapped in `Card`. |
| **Alerts page** | Each section is a distinct card. Empty state renders when no alert rules. Delete action visible and works. |
| **Profile pages** | Each tab has proper empty states instead of blank/stub. Tables match other pages. |
| **Global** | `npm run typecheck` passes. No visual regressions on existing charts/tables. |

