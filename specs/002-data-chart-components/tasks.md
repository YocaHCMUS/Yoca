# Tasks: Data Chart Components

**Input**: Design documents from `/specs/002-data-chart-components/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are OPTIONAL for this feature and not explicitly requested in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a monorepo web application:

- **Frontend**: `client/src/`
- **Backend**: `server/src/`
- **Shared types**: `client/src/types/`, `server/src/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [x] T001 Install chart dependencies: echarts@5.4.3, echarts-for-react@3.0.5, @types/echarts in client/
- [x] T002 Install mini-player dependency: react-rnd@10.4.1 in client/
- [x] T003 [P] Install date/timezone dependencies: date-fns@2.30.0, date-fns-tz@2.0.0 in client/
- [x] T004 [P] Install utilities: lodash.debounce@4.0.8, @types/lodash.debounce in client/
- [x] T005 Verify bundle size impact ≤135KB gzipped via npm run build

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create eCharts setup with tree-shaking in client/src/util/echarts-setup.ts
- [x] T007 [P] Define TypeScript types in client/src/types/chart.types.ts
- [x] T008 [P] Define data types in client/src/types/chart-data.types.ts
- [x] T009 [P] Define filter types in client/src/types/chart-filters.types.ts
- [x] T010 [P] Define API response types in client/src/types/chart-api.types.ts
- [x] T011 Create ChartContext for shared timezone state in client/src/contexts/ChartContext.tsx
- [x] T012 [P] Implement useChartFilters hook in client/src/hooks/useChartFilters.ts
- [x] T013 [P] Implement useAutoRefresh hook in client/src/hooks/useAutoRefresh.ts
- [x] T014 [P] Implement useChartExport hook in client/src/hooks/useChartExport.ts
- [x] T015 [P] Implement useFullscreen hook in client/src/hooks/useFullscreen.ts
- [x] T016 Create chartApi service in client/src/services/chart/chartApi.ts
- [x] T017 [P] Create chartExport utility in client/src/services/chart/chartExport.ts
- [x] T018 Create ChartWrapper base component in client/src/components/charts/shared/ChartWrapper.tsx
- [x] T019 [P] Create ChartSkeleton loading component in client/src/components/charts/shared/ChartSkeleton.tsx
- [x] T020 [P] Create ChartEmptyState component in client/src/components/charts/shared/ChartEmptyState.tsx
- [x] T021 [P] Create ChartErrorState component in client/src/components/charts/shared/ChartErrorState.tsx
- [x] T022 [P] Create ChartWrapper styles in client/src/components/charts/shared/ChartWrapper.module.scss
- [x] T023 Create chart helper utilities in client/src/util/chart-helpers.ts (formatCurrency, formatDate, formatTimestamp with timezone support, generateFilename for exports, estimateDataPoints for aggregation decisions)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Crypto Balance Trends (Priority: P1) 🎯 MVP

**Goal**: Display line/area chart showing balance history over selectable time periods to deliver immediate portfolio performance visibility.

**Independent Test**: User opens dashboard, sees balance chart with 30D default data, changes time period to 7D, chart updates showing last 7 days of balance data with hover tooltips showing exact values and timestamps.

### Implementation for User Story 1

- [X] T024 [P] [US1] Create BalanceChart component in client/src/components/charts/BalanceChart/BalanceChart.tsx
- [X] T025 [P] [US1] Create BalanceChart styles in client/src/components/charts/BalanceChart/BalanceChart.module.scss
- [X] T026 [P] [US1] Create BalanceChart index export in client/src/components/charts/BalanceChart/index.ts
- [X] T027 [US1] Implement balance chart option generation with time series config and area fill
- [X] T028 [US1] Add time period filter integration (7D, 30D, 60D, 90D, 1Y, All)
- [X] T029 [US1] Add token filter integration (All tokens or specific selection)
- [X] T030 [US1] Implement tooltip formatter with timezone-aware timestamps and currency formatting
- [X] T031 [US1] Add auto-refresh functionality (30-second interval with pause detection)
- [X] T032 [US1] Add loading, error, and empty states to BalanceChart
- [X] T033 [US1] Implement LTTB sampling for datasets >2000 points
- [X] T034 [US1] Create mockFetchBalanceTrend function in client/src/services/chart/mockChartData.ts
- [X] T035 [US1] Implement generateMockBalanceTrend with realistic data patterns (trend, volatility, noise)
- [X] T036 [US1] Add data aggregation logic (hourly, daily, weekly, monthly) based on time period
- [X] T037 [US1] Add simulated network delay and 5% random error rate for testing
- [X] T038 [US1] Integrate BalanceChart into dashboard page with ChartProvider wrapper

**Checkpoint**: At this point, User Story 1 (Balance Chart) should be fully functional and testable independently with mock data

---

## Phase 4: User Story 2 - Analyze Asset Distribution (Priority: P1)

**Goal**: Display donut chart with cryptocurrency symbols, percentages, and total value at center to allow users to immediately grasp their asset allocation.

**Independent Test**: User views asset distribution chart, sees donut with colored segments for each crypto, percentages labeled on segments, total portfolio value in center, legend shows asset symbols with values.

### Implementation for User Story 2

- [X] T039 [P] [US2] Create AssetDistribution component in client/src/components/charts/AssetDistribution/AssetDistribution.tsx
- [X] T040 [P] [US2] Create AssetDistribution styles in client/src/components/charts/AssetDistribution/AssetDistribution.module.scss
- [X] T041 [P] [US2] Create AssetDistribution index export in client/src/components/charts/AssetDistribution/index.ts
- [X] T042 [US2] Implement donut chart option with radius configuration and segment colors
- [X] T043 [US2] Add center graphic for total portfolio value display
- [X] T044 [US2] Implement legend formatter showing token symbols with formatted values
- [X] T045 [US2] Add token filter integration with limit support (top N tokens)
- [X] T046 [US2] Add segment label formatting (symbol: percentage)
- [X] T047 [US2] Add auto-refresh functionality for distribution data
- [X] T047a [US2] Implement legend item click handler to toggle data series visibility in eCharts configuration
- [X] T048 [US2] Add loading, error, and empty states to AssetDistribution
- [X] T049 [US2] Create mockFetchAssetDistribution function in client/src/services/chart/mockChartData.ts
- [X] T050 [US2] Implement generateMockAssetDistribution with 8 cryptocurrencies and realistic allocations
- [X] T051 [US2] Add percentage computation and color assignments for distribution data
- [X] T052 [US2] Add simulated network delay and 5% random error rate for testing
- [X] T053 [US2] Integrate AssetDistribution into dashboard page

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently with mock data

---

## Phase 5: User Story 9 - Apply Universal Data Filtering and Export (Priority: P1)

**Goal**: Enable filtering chart data by time periods, tokens, transaction types, and export visualizations for reporting, demonstrating universal utility features work independently.

**Independent Test**: User clicks time period dropdown on any chart, selects 7D, chart updates. User clicks export button, chooses PNG format, file downloads with correct naming convention (data_name-filters-timestamp.png). User clicks fullscreen button, chart expands to fullscreen mode.

### Implementation for User Story 9

- [X] T054 [P] [US9] Create FullscreenView component in client/src/components/charts/shared/FullscreenView.tsx
- [X] T055 [P] [US9] Create FullscreenView styles in client/src/components/charts/shared/FullscreenView.module.scss
- [X] T056 [P] [US9] Create MiniPlayer component in client/src/components/charts/shared/MiniPlayer.tsx
- [X] T057 [P] [US9] Create MiniPlayer styles in client/src/components/charts/shared/MiniPlayer.module.scss
- [X] T058 [P] [US9] Create ExportMenu component in client/src/components/charts/shared/ExportMenu.tsx
- [X] T059 [P] [US9] Create ExportMenu styles in client/src/components/charts/shared/ExportMenu.module.scss
- [X] T060 [US9] Implement PNG export with pixelRatio: 2 for retina quality
- [X] T061 [US9] Implement SVG export functionality
- [X] T062 [US9] Implement CSV export with metadata headers including chart title, applied filters, export timestamp in ISO 8601 format, and timezone identifier (e.g., 'America/New_York', 'UTC', or user's current timezone)
- [X] T063 [US9] Implement filename generation following data_name-filters-timestamp convention
- [X] T064 [US9] Add fullscreen mode with hybrid native API + modal fallback
- [X] T065 [US9] Add ESC key handler for exiting fullscreen and mini-player
- [X] T066 [US9] Implement mini-player with react-rnd for drag and resize
- [X] T067 [US9] Add keyboard navigation support (focus trap in fullscreen)
- [X] T068 [US9] Integrate export and viewing mode controls into ChartWrapper header
- [X] T069 [US9] Add timezone selector UI component with local/UTC/custom options
- [X] T070 [US9] Implement timezone change propagation to all charts via ChartContext

**Checkpoint**: All P1 user stories (Balance, Distribution, Filtering/Export) should now be independently functional

---

## Phase 6: User Story 5 - Monitor Profit and Loss Trends (Priority: P2)

**Goal**: Display dual-axis chart showing daily P&L bars with cumulative P&L line overlay, delivering comprehensive profitability analysis.

**Independent Test**: User views P&L chart, sees green bars for profit days and red bars for loss days, cumulative line shows running total, hover displays exact daily and cumulative values with date.

### Implementation for User Story 5

- [X] T071 [P] [US5] Create PnLChart component in client/src/components/charts/PnLChart/PnLChart.tsx
- [X] T072 [P] [US5] Create PnLChart styles in client/src/components/charts/PnLChart/PnLChart.module.scss
- [X] T073 [P] [US5] Create PnLChart index export in client/src/components/charts/PnLChart/index.ts
- [X] T074 [US5] Implement dual-axis chart option with bars (daily P&L) and line (cumulative)
- [X] T075 [US5] Add conditional bar coloring (green for positive, red for negative values)
- [X] T076 [US5] Add tooltip formatter showing both daily and cumulative P&L values
- [X] T077 [US5] Add time period filter integration
- [X] T078 [US5] Add wallet filter integration
- [X] T079 [US5] Add auto-refresh functionality for P&L data
- [X] T080 [US5] Add loading, error, and empty states to PnLChart
- [X] T081 [US5] Create mockFetchPnLChart function in client/src/services/chart/mockChartData.ts
- [X] T082 [US5] Implement generateMockPnLData with daily P&L bars and cumulative line
- [X] T083 [US5] Add P&L calculation logic (daily gains/losses and running total)
- [X] T084 [US5] Add aggregation support (daily, weekly, monthly) based on time period
- [X] T085 [US5] Add simulated network delay and error handling for testing
- [X] T086 [US5] Integrate PnLChart into dashboard page

**Checkpoint**: At this point, User Stories 1, 2, 5, and 9 should all work independently

---

## Phase 7: User Story 3 - Compare Exchange Trading Activity (Priority: P2)

**Goal**: Display grouped bar chart comparing deposits vs withdrawals across exchanges, delivering immediate insight into exchange-specific activity patterns.

**Independent Test**: User views exchange comparison chart, sees grouped bars for each exchange (Binance, Coinbase, etc.), deposits and withdrawals side-by-side in different colors, exact counts displayed on bars.

### Implementation for User Story 3

- [X] T087 [P] [US3] Create ExchangeComparison component in client/src/components/charts/ExchangeComparison/ExchangeComparison.tsx
- [X] T088 [P] [US3] Create ExchangeComparison styles in client/src/components/charts/ExchangeComparison/ExchangeComparison.module.scss
- [X] T089 [P] [US3] Create ExchangeComparison index export in client/src/components/charts/ExchangeComparison/index.ts
- [X] T090 [US3] Implement grouped bar chart option with exchange names on X-axis
- [X] T091 [US3] Add series configuration for deposits and withdrawals with distinct colors
- [X] T092 [US3] Add data label display on top of each bar
- [X] T093 [US3] Add legend showing deposits vs withdrawals
- [X] T094 [US3] Add time period filter integration
- [X] T095 [US3] Add metric selector (count vs volume)
- [X] T096 [US3] Add auto-refresh functionality for exchange data
- [X] T097 [US3] Add loading, error, and empty states to ExchangeComparison
- [X] T098 [US3] Create mockFetchExchangeComparison function in client/src/services/chart/mockChartData.ts
- [X] T099 [US3] Implement generateMockExchangeData with deposits/withdrawals per exchange
- [X] T100 [US3] Add exchange activity aggregation logic (count vs volume metrics)
- [X] T101 [US3] Add simulated network delay and error handling for testing
- [X] T102 [US3] Integrate ExchangeComparison into dashboard page

**Checkpoint**: At this point, User Stories 1, 2, 3, 5, and 9 should all work independently

---

## Phase 8: User Story 4 - Analyze Counterparty Transaction Activity (Priority: P2)

**Goal**: Display grouped bar charts showing transaction counts and volumes per counterparty, delivering actionable insights about trading relationships.

**Independent Test**: User views counterparty analysis chart, sees bars grouped by counterparty address/name, both transaction count and total volume displayed, can filter by time period and transaction type.

### Implementation for User Story 4

- [X] T103 [P] [US4] Create CounterpartyActivity component in client/src/components/charts/CounterpartyActivity/CounterpartyActivity.tsx
- [X] T104 [P] [US4] Create CounterpartyActivity styles in client/src/components/charts/CounterpartyActivity/CounterpartyActivity.module.scss
- [X] T105 [P] [US4] Create CounterpartyActivity index export in client/src/components/charts/CounterpartyActivity/index.ts
- [X] T106 [US4] Implement grouped bar chart option with counterparty identifiers on X-axis
- [X] T107 [US4] Add series for transaction count and total volume
- [X] T108 [US4] Add time period filter integration
- [X] T109 [US4] Add transaction type filter integration
- [X] T110 [US4] Add limit selector for top N counterparties
- [X] T111 [US4] Add auto-refresh functionality for counterparty data
- [X] T112 [US4] Add loading, error, and empty states to CounterpartyActivity
- [X] T113 [US4] Create mockFetchCounterpartyActivity function in client/src/services/chart/mockChartData.ts
- [X] T114 [US4] Implement generateMockCounterpartyData with transaction counts and volumes
- [X] T115 [US4] Add counterparty activity aggregation logic (top N filtering)
- [X] T116 [US4] Add simulated network delay and error handling for testing
- [X] T117 [US4] Integrate CounterpartyActivity into dashboard page

**Checkpoint**: At this point, User Stories 1, 2, 3, 4, 5, and 9 should all work independently

---

## Phase 9: User Story 6 - Compare Trading Volume Across Benchmarks (Priority: P3)

**Goal**: Display multi-series line/bar chart with benchmark comparisons and value annotations, allowing users to quickly spot performance differences.

**Independent Test**: User views volume benchmark chart, sees multiple colored lines/bars for different wallets, values displayed on hover, dates clearly marked on X-axis, legend identifies each wallet.

### Implementation for User Story 6

- [X] T118 [P] [US6] Create VolumeBenchmark component in client/src/components/charts/VolumeBenchmark/VolumeBenchmark.tsx
- [X] T119 [P] [US6] Create VolumeBenchmark styles in client/src/components/charts/VolumeBenchmark/VolumeBenchmark.module.scss
- [X] T120 [P] [US6] Create VolumeBenchmark index export in client/src/components/charts/VolumeBenchmark/index.ts
- [X] T121 [US6] Implement multi-series line or bar chart option
- [X] T122 [US6] Add series configuration for multiple wallets with unique colors
- [X] T123 [US6] Add data label display for precise values
- [X] T124 [US6] Add wallet filter integration
- [X] T125 [US6] Add time period filter integration
- [X] T126 [US6] Add auto-refresh functionality for volume data
- [X] T127 [US6] Add loading, error, and empty states to VolumeBenchmark
- [X] T128 [US6] Create mockFetchVolumeBenchmark function in client/src/services/chart/mockChartData.ts
- [X] T129 [US6] Implement generateMockVolumeBenchmark with multi-wallet comparison data
- [X] T130 [US6] Add volume comparison aggregation logic (multiple time series)
- [X] T131 [US6] Add simulated network delay and error handling for testing
- [X] T132 [US6] Integrate VolumeBenchmark into dashboard page

**Checkpoint**: At this point, User Stories 1, 2, 3, 4, 5, 6, and 9 should all work independently

---

## Phase 10: User Story 7 - Analyze Transaction Distribution by Type (Priority: P3)

**Goal**: Display dual chart view showing transaction counts by date and unique tokens traded, segmented by wallet, delivering activity pattern insights.

**Independent Test**: User views transaction distribution, sees stacked/grouped bars showing transaction counts over time by wallet, second chart shows unique token counts per day, can filter by time period and transaction type.

### Implementation for User Story 7

- [X] T133 [P] [US7] Create TransactionDistribution component in client/src/components/charts/TransactionDistribution/TransactionDistribution.tsx
- [X] T134 [P] [US7] Create TransactionDistribution styles in client/src/components/charts/TransactionDistribution/TransactionDistribution.module.scss
- [X] T135 [P] [US7] Create TransactionDistribution index export in client/src/components/charts/TransactionDistribution/index.ts
- [X] T136 [US7] Implement stacked or grouped bar chart for transaction counts
- [X] T137 [US7] Implement second chart for unique token counts per day
- [X] T138 [US7] Add wallet color distinction with data labels
- [X] T139 [US7] Add time period filter integration
- [X] T140 [US7] Add wallet filter integration
- [X] T141 [US7] Add transaction type filter integration
- [X] T142 [US7] Add auto-refresh functionality for transaction distribution data
- [X] T143 [US7] Add loading, error, and empty states to TransactionDistribution
- [X] T144 [US7] Create mockFetchTransactionDistribution function in client/src/services/chart/mockChartData.ts
- [X] T145 [US7] Implement generateMockTransactionDistribution with stacked/grouped bar data
- [X] T146 [US7] Add transaction distribution aggregation logic (counts and unique tokens)
- [X] T147 [US7] Add simulated network delay and error handling for testing
- [X] T148 [US7] Integrate TransactionDistribution into dashboard page

**Checkpoint**: At this point, User Stories 1, 2, 3, 4, 5, 6, 7, and 9 should all work independently

---

## Phase 11: User Story 8 - View Token Holding Duration Analysis (Priority: P3)

**Goal**: Display bar charts showing holding duration in days for top tokens per wallet, delivering holding behavior insights.

**Independent Test**: User views holding times chart, sees separate charts for each wallet, bars show tokens with their holding durations in days, can filter to show top N tokens or longest holdings.

### Implementation for User Story 8

- [ ] T149 [P] [US8] Create HoldingDurations component in client/src/components/charts/HoldingDurations/HoldingDurations.tsx
- [ ] T150 [P] [US8] Create HoldingDurations styles in client/src/components/charts/HoldingDurations/HoldingDurations.module.scss
- [ ] T151 [P] [US8] Create HoldingDurations index export in client/src/components/charts/HoldingDurations/index.ts
- [ ] T152 [US8] Implement bar chart option with token symbols on X-axis
- [ ] T153 [US8] Add multi-chart layout for separate wallet displays
- [ ] T154 [US8] Add duration value labels on bars
- [ ] T155 [US8] Add wallet filter integration
- [ ] T156 [US8] Add limit selector for top N tokens
- [ ] T157 [US8] Add time unit selector (days, weeks, months)
- [ ] T158 [US8] Add auto-refresh functionality for holding duration data
- [ ] T159 [US8] Add loading, error, and empty states to HoldingDurations
- [ ] T160 [US8] Create mockFetchHoldingDurations function in client/src/services/chart/mockChartData.ts
- [ ] T161 [US8] Implement generateMockHoldingDurations with token duration data per wallet
- [ ] T162 [US8] Add holding duration calculation logic (days/weeks/months)
- [ ] T163 [US8] Add simulated network delay and error handling for testing
- [ ] T164 [US8] Integrate HoldingDurations into dashboard page

**Checkpoint**: All user stories (1-8 + 9) should now be independently functional

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T165 [P] Add comprehensive JSDoc comments to all custom hooks
- [ ] T166 [P] Add JSDoc comments to all chart components
- [ ] T167 Optimize bundle size with lazy loading for chart components
- [ ] T168 [P] Add keyboard navigation support across all charts (tab, arrow keys)
- [ ] T169 [P] Add screen reader support with ARIA labels and live regions
- [ ] T170 Run axe-core accessibility audit and fix violations
- [ ] T171 [P] Performance test with 10,000 data points across all chart types
- [ ] T172 [P] Performance test with 50,000 data points using server aggregation
- [ ] T173 Verify all empty states render correctly when no data available
- [ ] T174 Verify all error states render correctly on API failures
- [ ] T175 Add staggered refresh offset calculation for multiple charts
- [ ] T176 [P] Create dashboard layout with responsive grid (2-column desktop, 1-column mobile)
- [ ] T177 [P] Update README.md with chart component documentation
- [ ] T178 Run quickstart.md validation to ensure all examples work
- [ ] T179 Final bundle size verification (must be ≤135KB gzipped)
- [ ] T180 Verify TypeScript strict mode passes with no errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-11)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order:
    - P1: US1 (Balance), US2 (Distribution), US9 (Filtering/Export)
    - P2: US5 (P&L), US3 (Exchanges), US4 (Counterparties)
    - P3: US6 (Benchmarks), US7 (Transaction Distribution), US8 (Holdings)
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (Balance Trend)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (Asset Distribution)**: Can start after Foundational - No dependencies on other stories
- **User Story 9 (Filtering/Export)**: Can start after Foundational - Enhances all other stories but can be implemented independently
- **User Story 5 (P&L Chart)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (Exchanges)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (Counterparties)**: Can start after Foundational - No dependencies on other stories
- **User Story 6 (Benchmarks)**: Can start after Foundational - No dependencies on other stories
- **User Story 7 (Transactions)**: Can start after Foundational - No dependencies on other stories
- **User Story 8 (Holdings)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Frontend component files marked [P] can be created in parallel
- Chart option implementation depends on component creation
- Filter integration depends on chart option implementation
- Backend endpoint must be implemented before frontend can fetch real data
- Integration into dashboard is final step for each story

### Parallel Opportunities

**Phase 1 (Setup)**: Tasks T001-T004 can all run in parallel

**Phase 2 (Foundational)**:

- Type definitions (T007-T010) can run in parallel
- Hooks (T012-T015) can run in parallel
- Services (T016-T017) can run in parallel
- Shared components (T018-T021) can run in parallel
- Styles (T022) can run with components

**Phase 3-11 (User Stories)**: Once Foundational is complete, ALL user stories can be worked on in parallel by different team members

**Within Each User Story**:

- Component, styles, and index files marked [P] can be created simultaneously
- Multiple backend endpoints can be developed in parallel by different developers

---

## Parallel Example: Foundational Phase

```bash
# Launch all type definitions together:
Task T007: "Define TypeScript types in client/src/types/chart.types.ts"
Task T008: "Define data types in client/src/types/chart-data.types.ts"
Task T009: "Define filter types in client/src/types/chart-filters.types.ts"
Task T010: "Define API response types in client/src/types/chart-api.types.ts"

# Launch all hooks together (after types complete):
Task T012: "Implement useChartFilters hook in client/src/hooks/useChartFilters.ts"
Task T013: "Implement useAutoRefresh hook in client/src/hooks/useAutoRefresh.ts"
Task T014: "Implement useChartExport hook in client/src/hooks/useChartExport.ts"
Task T015: "Implement useFullscreen hook in client/src/hooks/useFullscreen.ts"

# Launch all shared components together:
Task T018: "Create ChartWrapper base component"
Task T019: "Create ChartSkeleton loading component"
Task T020: "Create ChartEmptyState component"
Task T021: "Create ChartErrorState component"
```

---

## Parallel Example: Multiple User Stories

```bash
# After Foundational phase completes, launch user stories in parallel:
Developer A: Phase 3 - User Story 1 (Balance Chart)
Developer B: Phase 4 - User Story 2 (Asset Distribution)
Developer C: Phase 5 - User Story 9 (Filtering/Export)

# Or for MVP focus:
Team: Phase 3 - User Story 1 (Balance Chart) → Test & Deploy → MVP! ✅
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (5 tasks)
2. Complete Phase 2: Foundational (18 tasks) - CRITICAL
3. Complete Phase 3: User Story 1 (15 tasks)
4. **STOP and VALIDATE**: Test Balance Chart independently
5. Deploy/demo MVP with single working chart

**MVP Timeline**: ~24 hours of work (Setup + Foundation + US1)

### Incremental Delivery (P1 Stories)

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Balance) → Test → Deploy (MVP!)
3. Add User Story 2 (Distribution) → Test → Deploy
4. Add User Story 9 (Filtering/Export) → Test → Deploy
5. **P1 Complete**: 3 core charts with full functionality

**P1 Timeline**: ~40 hours of work (includes all P1 stories)

### Full Feature (All Stories)

1. Complete P1 stories first (see above)
2. Add P2 stories (US5, US3, US4) → Test → Deploy
3. Add P3 stories (US6, US7, US8) → Test → Deploy
4. Complete Polish phase → Final validation

**Full Timeline**: ~80 hours of work (all 8 user stories + polish)

### Parallel Team Strategy

With 3 developers after Foundational phase:

- **Week 1**: Dev A: US1 | Dev B: US2 | Dev C: US9 (P1 stories)
- **Week 2**: Dev A: US5 | Dev B: US3 | Dev C: US4 (P2 stories)
- **Week 3**: Dev A: US6 | Dev B: US7 | Dev C: US8 (P3 stories)
- **Week 4**: All: Polish phase together

---

## Total Task Count

- **Phase 1 (Setup)**: 5 tasks
- **Phase 2 (Foundational)**: 18 tasks
- **Phase 3 (US1 - Balance)**: 15 tasks
- **Phase 4 (US2 - Distribution)**: 15 tasks
- **Phase 5 (US9 - Filtering/Export)**: 17 tasks
- **Phase 6 (US5 - P&L)**: 16 tasks
- **Phase 7 (US3 - Exchanges)**: 16 tasks
- **Phase 8 (US4 - Counterparties)**: 15 tasks
- **Phase 9 (US6 - Benchmarks)**: 15 tasks
- **Phase 10 (US7 - Transactions)**: 16 tasks
- **Phase 11 (US8 - Holdings)**: 16 tasks
- **Phase 12 (Polish)**: 16 tasks

**Total**: 180 tasks

---

## Notes

- [P] tasks can run in parallel (different files, no dependencies)
- [Story] label (US1-US9) maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **All charts use client-side mock data** in `client/src/services/chart/mockChartData.ts`
- Mock data includes realistic patterns, network delays, and 5% random errors for testing
- Backend API endpoints (server/src/routes/charts/) are optional and available for production use
- All charts share ChartWrapper, filters, and export functionality from Foundational phase
- Bundle size must remain ≤135KB gzipped throughout implementation
