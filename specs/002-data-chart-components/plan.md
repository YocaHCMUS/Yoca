# Implementation Plan: Data Chart Components

**Branch**: `002-data-chart-components` | **Date**: 2025-12-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-data-chart-components/spec.md`

## Summary

Implement reusable chart components for visualizing cryptocurrency portfolio data using Apache eCharts. Components include balance trends (line/area charts), asset distribution (donut charts), exchange comparisons (grouped bars), P&L tracking (dual-axis), and transaction analysis. All charts support filtering by time period/tokens, data export (PNG/SVG/CSV), 30-second auto-refresh, and multiple viewing modes (normal, fullscreen, draggable mini-player).

**Technical Approach**: Use echarts-for-react with tree-shaking to minimize bundle size (~105KB gzipped). Implement custom React hooks for filter management (debounced), auto-refresh (pause-aware), and export functionality. Use react-rnd for draggable mini-player, date-fns-tz for timezone handling, and React Context for shared timezone state. Charts consume pre-processed data from REST API endpoints with server-side aggregation for large datasets.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode enabled)  
**Primary Dependencies**:

- Frontend: React 19, Vite 7, React Router 7, Carbon Design System, react-i18next (i18n)
- Backend: Hono 4, Node.js 20+, Zod (validation)
- **Chart Library**: Apache eCharts 5.4.3, echarts-for-react 3.0.5
- **Draggable UI**: react-rnd 10.4.1
- **Date/Timezone**: date-fns 2.30.0, date-fns-tz 2.0.0
- **Utilities**: lodash.debounce 4.0.8
- **Localization**: i18next, react-i18next (multi-language support: en, vi, ja)

**Storage**: REST API endpoints for pre-processed chart data (server/src/routes/charts/)  
**Testing**: Vitest (unit tests), integration tests for API endpoints  
**Target Platform**: Web application (Chrome, Firefox, Safari latest 2 versions)  
**Project Type**: Web (monorepo with client/ and server/ workspaces)  
**Performance Goals**:

- Chart render: <2s for datasets up to 1000 points, <1s for 10K points with LTTB sampling
- Filter updates: <500ms response time (300ms debounce)
- API endpoints: p95 <200ms response time
- Bundle size impact: ~129KB gzipped (25.8% of 500KB budget, 371KB remaining)

**Constraints**:

- Auto-refresh every 30 seconds (pause when tab hidden or user interacting)
- Support datasets up to 50,000 points through server-side aggregation
- Export quality: 1:1 with display (pixelRatio: 2 for retina)
- Timezone aware (default user local, toggle to UTC)

**Scale/Scope**:

- 8 chart types across 4 user stories (P1-P3 priority)
- Expected 10-50 charts per dashboard page
- Datasets: 100-50,000 data points per chart
- Concurrent users: 1000+ per instance

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Yoca Constitution v1.0.0 Compliance**:

- [x] **Type Safety First**: All chart types, hooks, and components use TypeScript strict mode with explicit types. No `any` types except in eCharts event handlers (typed as `any` in library).
- [x] **Service Layer Abstraction**: Chart data fetching isolated in `services/chart/chartApi.ts`. Business logic (data transformation, formatting) separated from presentation components.
- [x] **Validation at Boundaries**: API responses validated with Zod schemas. Chart filter inputs validated before API calls. Date ranges validated for custom time periods.
- [x] **Component Modularity**: Each chart is self-contained with typed props. Shared functionality extracted to reusable hooks (useChartFilters, useAutoRefresh, useChartExport). ChartWrapper provides consistent header/controls.
- [x] **Performance Budgets**: Bundle size impact 129KB gzipped (25.8% of 500KB budget). LTTB sampling for large datasets. Server-side aggregation for 10K+ points. Debounced filter updates (300ms).
- [x] **Error Handling & Observability**: Comprehensive error states for chart loading failures. Loading skeletons during fetch. Structured error logging with chart context. Retry mechanism for failed auto-refresh.
- [x] **Testing Strategy**: Unit tests for custom hooks (useChartFilters, useAutoRefresh). Integration tests for API endpoints. E2E tests for critical user flows (filter change, export, fullscreen).

**Violations Requiring Justification**: None

**Post-Design Re-check**: ✅ All principles maintained after Phase 1 design. Service layer clearly defined, types comprehensive, performance optimizations in place.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Yoca Monorepo Structure** (npm workspaces):

```text
client/                    # Frontend workspace (React + Vite)
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level page components
│   ├── services/         # API clients and business logic
│   ├── api/              # API integration layer
│   ├── util/             # Utility functions
│   └── assets/           # Static assets
├── build/                # Production build output
└── tests/                # Frontend tests

server/                    # Backend workspace (Hono + Node.js)
├── src/
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic services
│   ├── middleware/       # Custom middleware
│   ├── data/             # Data schemas and models
│   ├── types/            # Shared type definitions
│   └── util/             # Utility functions
├── build/                # Compiled JavaScript output
└── tests/                # Backend tests
│   ├── unit/             # Unit tests
│   ├── integration/      # API integration tests
│   └── contract/         # Contract tests

.specify/                  # Spec-Kit configuration
├── memory/
│   └── constitution.md   # This project's constitution
└── templates/            # Document templates
```

**Feature Integration Points**:

- **Frontend**: Add components to `client/src/components/` or `client/src/pages/`
- **Backend**: Add routes to `server/src/routes/`, services to `server/src/services/`
- **Shared Types**: Define in `server/src/types/` and import in client via path aliases
- **Validation**: Use Zod schemas in `server/src/middleware/` or co-located with routes

## Complexity Tracking

**No violations** - All constitution principles are satisfied without requiring exceptions or additional complexity.

---

## Implementation Phases

### Phase 0: Outline & Research ✅ COMPLETE

**Output**: [research.md](./research.md)

**Completed Research**:

1. ✅ eCharts React integration (echarts-for-react with tree-shaking)
2. ✅ Fullscreen viewing mode (hybrid native API + modal fallback)
3. ✅ Mini-player implementation (react-rnd for draggable popup)
4. ✅ Export functionality (PNG/SVG via eCharts API, custom CSV)
5. ✅ Data filtering patterns (debounced real-time updates)
6. ✅ Large dataset performance (LTTB sampling + server aggregation)
7. ✅ 30-second auto-refresh (pause-aware with visibility detection)
8. ✅ Bundle size analysis (129KB gzipped, 25.8% of budget)

**Key Decisions**:

- Use echarts-for-react 3.0.5 with selective imports
- Implement hybrid fullscreen (native API + modal fallback)
- Use react-rnd for mini-player drag/resize
- Export with pixelRatio: 2 for retina quality
- Debounce filter changes (300ms)
- LTTB sampling for >2000 points
- Server-side aggregation for >5000 points

---

### Phase 1: Design & Contracts ✅ COMPLETE

**Prerequisites**: research.md complete ✅

**Outputs**:

- ✅ [data-model.md](./data-model.md) - Entities, relationships, validation rules
- ✅ [contracts/chart-api.yaml](./contracts/chart-api.yaml) - OpenAPI 3.0 spec for 8 endpoints
- ✅ [quickstart.md](./quickstart.md) - Developer implementation guide
- ✅ Agent context updated (.github/agents/copilot-instructions.md)

**Data Model Entities**:

1. ChartComponent - Main wrapper with config and state
2. ChartConfiguration - Visual styling and behavior settings
3. ChartFilters - Filter state (time period, tokens, transaction type)
4. ChartDataSeries - Collection of data points for visualization
5. DataPoint - Individual values (time series, categorical, distribution)
6. AutoRefreshConfig - 30-second refresh settings
7. ExportConfig - Export format and metadata settings
8. ViewModeState - Fullscreen/mini-player state management
9. ChartLoadingState - Loading, success, error states

**API Endpoints** (8 total):

1. `GET /api/charts/balance` - Balance trend time series
2. `GET /api/charts/distribution` - Asset distribution (donut)
3. `GET /api/charts/exchanges` - Exchange comparison (grouped bars)
4. `GET /api/charts/counterparties` - Counterparty activity
5. `GET /api/charts/pnl` - Profit/loss dual-axis chart
6. `GET /api/charts/transactions/distribution` - Transaction counts over time
7. `GET /api/charts/holdings` - Token holding durations
8. `GET /api/charts/volume-benchmark` - Volume comparison across wallets

---

### Phase 2: Core Infrastructure (Next Step)

**Estimated Time**: 8 hours

**Tasks** (will be generated by `/speckit.tasks` command):

1. Install dependencies (echarts, echarts-for-react, react-rnd, date-fns, date-fns-tz)
2. Create eCharts setup with tree-shaking (`client/src/util/echarts-setup.ts`)
3. Define TypeScript types (`client/src/types/chart*.types.ts`)
4. Create ChartContext for shared timezone state
5. Implement custom hooks:
   - useChartFilters (debounced filter management)
   - useAutoRefresh (30-second interval with pause detection)
   - useChartExport (PNG/SVG/CSV export)
   - useFullscreen (native API + modal fallback)
6. Create ChartWrapper base component with header/controls
7. Create shared components (ChartSkeleton, ChartEmptyState, ChartErrorState)

**Acceptance Criteria**:

- [ ] All dependencies installed, bundle size ≤135KB gzipped
- [ ] TypeScript strict mode passes with no `any` types
- [ ] Custom hooks have unit tests with >80% coverage
- [ ] ChartWrapper renders with mock data

---

### Phase 3: Chart Components (P1)

**Estimated Time**: 10 hours

**Charts to Implement**:

1. **BalanceChart** - Line/area chart for balance trends (User Story 1)
2. **AssetDistribution** - Donut chart for portfolio allocation (User Story 2)
3. **PnLChart** - Dual-axis bars + line for profit/loss (User Story 5)

**Each Chart Includes**:

- Component with typed props
- API integration via chartApi service
- Filter support (time period, tokens)
- Export functionality
- Auto-refresh (30s interval)
- Loading/error/empty states
- SCSS module for styling

**Acceptance Criteria**:

- [ ] All 3 charts render with real API data
- [ ] Filters update chart within 500ms
- [ ] Export works for all formats (PNG, SVG, CSV)
- [ ] Auto-refresh pauses when tab hidden
- [ ] Charts handle 10,000+ data points smoothly (<1s render)

---

### Phase 4: Viewing Modes

**Estimated Time**: 6 hours

**Features**:

1. Fullscreen mode (hybrid native + modal)
2. Mini-player popup (draggable with react-rnd)
3. View mode state management
4. Responsive chart behavior in different modes

**Components**:

- `FullscreenView.tsx` - Fullscreen container with ESC handler
- `MiniPlayer.tsx` - Draggable popup with resize handles
- `useFullscreen` hook - Mode management and transitions

**Acceptance Criteria**:

- [ ] Fullscreen works on desktop (native) and iOS (modal)
- [ ] Mini-player is draggable and resizable (min 300x200px)
- [ ] ESC key exits fullscreen and mini-player
- [ ] Chart resizes correctly in all view modes
- [ ] Keyboard navigation works (focus trap in fullscreen)

---

### Phase 5: Additional Chart Types (P2)

**Estimated Time**: 6 hours

**Charts to Implement**:

1. **ExchangeComparison** - Grouped bars for exchange activity (User Story 3)
2. **CounterpartyActivity** - Grouped bars for counterparty transactions (User Story 4)
3. **TransactionDistribution** - Stacked bars for transaction counts (User Story 7)

**Acceptance Criteria**:

- [ ] All 3 charts render with API data
- [ ] Consistent styling with Phase 3 charts
- [ ] All utility features work (export, fullscreen, filters)

---

### Phase 6: Backend API Implementation

**Estimated Time**: 8 hours

**Tasks**:

1. Create route handlers in `server/src/routes/charts/`
2. Implement data aggregation logic (hourly, daily, weekly, monthly)
3. Add Zod schemas for request validation
4. Add error handling and logging
5. Implement caching strategy (optional)

**Endpoints** (8 total, see contracts/chart-api.yaml):

- Balance, Distribution, Exchanges, Counterparties, PnL, Transactions, Holdings, Volume Benchmark

**Acceptance Criteria**:

- [ ] All endpoints return data matching OpenAPI schema
- [ ] Request validation works (400 for invalid params)
- [ ] Response times: p95 <200ms for read operations
- [ ] Integration tests pass for all endpoints
- [ ] Error responses follow standard format

---

### Phase 7: Advanced Features (P3)

**Estimated Time**: 4 hours

**Features**:

1. Timezone selector (local, UTC, custom)
2. Custom date range picker
3. Shareable filtered URLs (URL params sync)
4. Refresh all charts button
5. Chart-specific export options (quality, size)

**Acceptance Criteria**:

- [ ] Timezone change updates all charts
- [ ] Custom date range validates start < end
- [ ] URL params restore filter state on page load
- [ ] Export menu shows format options on hover

---

### Phase 8: Testing & Polish

**Estimated Time**: 6 hours

**Tasks**:

1. Unit tests for all hooks (target >80% coverage)
2. Integration tests for API endpoints
3. E2E tests for critical flows:
   - Filter change → chart updates
   - Export → file downloads
   - Fullscreen → mode changes
4. Accessibility audit (WCAG 2.1 AA)
5. Performance testing with large datasets
6. Empty state and error state coverage
7. Loading skeleton polishing

**Acceptance Criteria**:

- [ ] Test coverage >80% for hooks and utilities
- [ ] All API endpoints have integration tests
- [ ] E2E tests pass for critical user flows
- [ ] No accessibility violations (axe-core)
- [ ] Performance benchmarks met (render <1s for 10K points)
- [ ] All edge cases handled (empty data, API errors, etc.)

---

## Total Estimated Time: 48 hours (6 work days)

---

## Success Metrics

**Performance**:

- Chart render: <2s for 1K points, <1s for 10K points ✅ Target
- Filter update: <500ms ✅ Target
- API response: p95 <200ms ✅ Target
- Bundle size: ≤135KB gzipped ✅ Target (129KB actual)

**Quality**:

- Test coverage: >80% for hooks/utilities
- TypeScript strict: 100% compliance (no `any`)
- Accessibility: WCAG 2.1 AA compliant
- Error handling: All states covered (loading, error, empty)

**User Experience**:

- All charts support filtering, export, auto-refresh
- Fullscreen and mini-player work across devices
- Loading states use Carbon Design skeletons
- Error messages are actionable and user-friendly

---

## Risk Mitigation

**Bundle Size Overrun**:

- Mitigation: Lazy load chart components by route
- Fallback: Remove mini-player (react-rnd) if needed (~8KB savings)

**Performance with Large Datasets**:

- Mitigation: LTTB sampling + server-side aggregation
- Fallback: Hard limit datasets to 10,000 points max

**Browser Compatibility**:

- Mitigation: Fullscreen modal fallback for iOS Safari
- Fallback: Disable mini-player on mobile if drag issues

---

## Next Command

Run `/speckit.tasks` to generate detailed task breakdown for Phase 2 implementation.
