# Profile Page Mock-First Implementation Plan (2026-04-07)

## Goal
Build a production-ready profile page skeleton using mock data first, while keeping all mock wiring isolated so migration to real backend data is low-risk and fast.

## Primary Requirements (From Request)
1. Use mock data now, but design for easy cleanup when real data is ready.
2. Page layout is a stacked column with 2 main blocks:
   - Top: profile overview
   - Bottom: tab container
3. Tabs include:
   - Dashboard
   - Alerts
   - Wallets
   - Activity
4. Export plan under the wallets docs folder.

## Page Information Architecture

### Section A: Profile Overview (top block)
Displays:
1. Avatar (profile image)
2. Display name
3. Account status tag (Basic, Premium, etc.)
4. Aggregated account metrics:
   - Total net worth across all wallets
   - Trades or transactions count in selected period
   - Profit and loss across all wallets
   - Total linked wallets

### Section B: Profile Tab Container (bottom block)
Tabs:
1. Dashboard tab
2. Alerts tab
3. Wallets tab
4. Activity tab

Note:
- If product decides to ship only 3 tabs initially, make Dashboard feature-flagged and keep the other 3 tabs as stable MVP.

## Mock-First Strategy (Easy Cleanup by Design)

### Rule 1: No mock data inside UI components
- UI components only consume typed view models.
- Data source is injected from a provider hook/service layer.

### Rule 2: Single source toggle for mock/real
- Use one environment switch (example: VITE_PROFILE_DATA_SOURCE=mock|api).
- No per-component if/else for mock mode.

### Rule 3: Stable contracts now
- Define interfaces for all tab data now.
- Real API responses later must map into the same interfaces.

### Rule 4: Adapters for migration
- Keep adapter functions per domain (overview, alerts, wallets, activity).
- Replace mock adapter input with API response input later.

## Proposed Client File Plan

### Existing files to activate
- client/src/pages/profile/index.tsx
- client/src/components/profile/ProfileOverview.tsx
- client/src/components/profile/ProfileDashboardTab.tsx
- client/src/components/profile/ProfileAlertTab.tsx
- client/src/components/profile/ProfileWalletTab.tsx
- client/src/components/profile/ProfileActivityTab.tsx

### New files (recommended)
- client/src/types/profile.ts
- client/src/services/profile/profileDataProvider.ts
- client/src/services/profile/profileMockData.ts
- client/src/services/profile/profileAdapters.ts
- client/src/hooks/profile/useProfilePageData.ts
- client/src/components/profile/profile.constants.ts

Optional styling split:
- client/src/components/profile/profile.scss
- client/src/components/profile/profile-tabs.scss

## Data Contracts (Draft)

### Root page model
- ProfilePageData
  - overview: ProfileOverviewData
  - dashboard: ProfileDashboardData
  - alerts: ProfileAlertsData
  - wallets: ProfileWalletsData
  - activity: ProfileActivityData

### Overview model
- ProfileOverviewData
  - avatarUrl: string
  - displayName: string
  - accountTier: 'basic' | 'premium' | 'pro' | 'enterprise'
  - period: '24h' | '7d' | '30d' | '90d'
  - totalNetWorthUsd: number
  - tradeOrTxCount: number
  - pnlUsd: number
  - pnlPct: number
  - linkedWalletCount: number

### Alerts model
- ProfileAlertsData
  - leftNavItems: ('list' | 'editor')[]
  - selectedNav: 'list' | 'editor'
  - alerts: AlertRule[]
  - notifications: AlertNotification[]

- AlertRule
  - id: string
  - tokenSymbol: string
  - alertType: 'price' | 'volume' | 'drawdown' | 'custom'
  - conditionText: string
  - status: 'active' | 'paused' | 'triggered'
  - updatedAt: string

- AlertNotification
  - id: string
  - timestamp: string
  - message: string
  - severity: 'info' | 'warning' | 'critical'

### Wallets model
- ProfileWalletsData
   - leftNavItems: ('portfolio-table' | 'linked-wallets' | 'balance-chart' | 'drawdown-chart')[]
   - selectedNav: 'portfolio-table' | 'linked-wallets' | 'balance-chart' | 'drawdown-chart'
  - availableWalletFilters: WalletFilterOption[]
  - selectedWalletIds: string[]
  - portfolioRows: WalletPortfolioRow[]
   - linkedWalletRows: LinkedWalletRow[]
   - selectedComparisonWalletIds: string[]
   - walletDetailRouteTemplate: string
  - balanceDrawdownSeries: WalletBalanceDrawdownSeries[]
  - comparisonTargetRoute: string

### Activity model
- ProfileActivityData
  - leftNavItems: ('swaps-table' | 'transfers-table' | 'wallet-overview-cards' | 'trade-frequency-heatmap')[]
  - selectedNav: 'swaps-table' | 'transfers-table' | 'wallet-overview-cards' | 'trade-frequency-heatmap'
  - availableWalletFilters: WalletFilterOption[]
  - selectedWalletIds: string[]
  - swapTransferRows: ActivityRow[]
  - walletCards: WalletActivityCard[]
  - heatmap: ActivityHeatmapData

## Tab-by-Tab UI Plan

### 1) Dashboard Tab (suggested content)
Purpose:
- Fast executive summary with high-signal widgets.

Suggested sections:
1. KPI strip
   - Net worth trend
   - Realized/Unrealized PnL split
   - Win rate
   - Active alerts count
2. Wallet concentration panel
   - Distribution of net worth by wallet
3. Risk panel
   - Max drawdown (period)
   - Volatility proxy
4. Recent anomalies list
   - Large transfer spikes
   - Unusual trade frequency changes

Reason:
- Gives users a one-screen status before drilling into Alerts/Wallet/Activity tabs.

### 2) Alerts Tab
Layout: 3-column content.
1. Left sidebar navigation
   - Alert List
   - Alert Editor/Creator
2. Middle content
   - If Alert List selected:
     - Table with token, alert type, condition, status, actions
     - Add Alert button above table
   - If Editor selected:
     - Form for token, type, threshold/condition, channels, enable toggle
3. Right sidebar
   - Notification feed with timestamp and message

### 3) Wallets Tab
Layout: 2-column content.
1. Left sidebar navigation
   - Portfolio table
   - Linked wallets
   - Balance chart
   - Drawdown chart
2. Main content
   - Portfolio table across all wallets with per-wallet filtering
   - Linked wallet list section with add/link wallet action and unlink action
   - Each linked-wallet row is clickable to navigate to that wallet page
   - Each linked-wallet row has a checkbox for comparison selection
   - Wallet comparison action uses selected checkbox rows (deep-link to wallet comparison page)
   - balance chart all wallets with per-wallet filtering
   - drawdown chart all wallets with per-wallet filtering

### 4) Activity Tab
Layout: 2-column content.
1. Left sidebar navigation
   - Swaps table
   - Transfers table
   - Wallet overview cards
   - Trade frequency heatmap
2. Main content
   - Swaps/transfers table for all wallets + individual wallet filter
   - Per-wallet overview cards (trades, sell tx, buy tx, pnl, period)
   - GitHub-style contribution heatmap for trading frequency

## State Management Plan
1. Keep one page-level state for:
   - active tab
   - period
   - selected wallets
2. Keep tab-local state for intra-tab left sidebar selection.
3. Keep derived formatting and chart-ready transforms memoized in hook layer.

## Routing and Navigation Plan
1. Route remains profile page root (current page).
2. Wallet comparison action uses existing wallet comparison route with selected checkbox wallet IDs as query params.
3. Clicking a linked-wallet row navigates to that wallet detail page.
4. Preserve tab and sub-section in URL query params for deep-linking later (optional in first pass).

## Implementation Phases

### Phase 0: Contract and scaffolding
1. Create profile types and constants.
2. Create provider interface and mock implementation.
3. Create hook useProfilePageData() returning typed data + loading + error.

Exit criteria:
- Components compile using typed mock source only.

### Phase 1: Page shell and overview
1. Implement profile page stacked layout.
2. Build ProfileOverview with avatar, name, tier chip, four metrics.
3. Add period selector placeholder (if used in overview metrics).

Exit criteria:
- Top overview section renders correctly on desktop and mobile.

### Phase 2: Tab container skeleton
1. Build shared tab container and switcher.
2. Mount four tab components with placeholder internals.

Exit criteria:
- Tab switching is stable and preserves local state per tab where needed.

### Phase 3: Alerts tab MVP
1. Implement left nav + middle conditional section + right notification feed.
2. Add table interactions (edit, pause/resume, delete placeholders).
3. Add Add Alert CTA and editor form skeleton.

Exit criteria:
- Alerts tab complete in mock mode with deterministic test data.

### Phase 4: Wallets tab MVP
1. Implement left nav and wallet filter controls.
2. Build portfolio table view.
3. Build linked-wallets section with add/link and unlink actions.
4. Add row-click navigation to wallet page and checkbox selection for comparison.
5. Build balance/drawdown chart container with mock series.

Exit criteria:
- Wallet tab supports all three sub-sections and filtering behavior.

### Phase 5: Activity tab MVP
1. Implement swaps/transfers table with wallet filter.
2. Add wallet overview card grid.
3. Implement trade frequency heatmap matrix.

Exit criteria:
- Activity tab supports all requested views and period slicing.

### Phase 6: Mock-to-real migration prep
1. Add TODO markers only in provider layer (not UI components).
2. Document exact adapter replacement points.
3. Add integration contract checks for expected API shape.

Exit criteria:
- Replacing mock provider with API provider touches only service/hook layer.

## Testing Plan

### Unit tests
1. Adapter conversion tests (mock and api inputs to same view model).
2. Sidebar navigation reducer/state tests.
3. Utility tests for metric and currency formatting.

### Component tests
1. ProfileOverview renders core fields and KPI values.
2. Alerts tab list/editor mode switching.
3. Wallet tab filter and sub-navigation rendering.
4. Activity heatmap rendering with sparse and dense data.

### Integration tests
1. Profile page loads provider data and renders overview + default tab.
2. Tab changes preserve selected filters as expected.
3. Linked-wallet row click navigates to wallet detail route.
4. Comparison action includes selected checkbox wallet IDs.

## Cleanup Plan (When Real APIs Arrive)
1. Implement ApiProfileDataProvider in profileDataProvider.ts.
2. Keep adapter signatures unchanged.
3. Remove profileMockData.ts usage by switching env flag default to api.
4. Delete mock-only fixture file after API parity confirmed.
5. Keep one fallback mock mode for local dev if desired (optional).

Expected cleanup impact:
- Mostly in service/hook files.
- Minimal or zero UI component churn.

## Risk Register
1. Risk: Tab complexity creates bloated page component.
   - Mitigation: enforce per-tab component boundaries and typed props.
2. Risk: Inconsistent wallet filtering between tabs.
   - Mitigation: centralize filter state and reusable wallet-filter component.
3. Risk: Heatmap performance with large datasets.
   - Mitigation: pre-aggregate by date + memoize.
4. Risk: Mock contracts drift from backend contracts.
   - Mitigation: keep adapter + contract tests and review during API integration.

## Open Decisions
1. Final account tier taxonomy and color mapping.
2. Default profile period (7d vs 30d).
3. Dashboard initial KPI list finalization.
4. Alert editor field depth for MVP.

## Suggested Iteration Workflow For This Plan
Because this plan is expected to be edited multiple times:
1. Keep this file as the single source of truth.
2. Add a short change log section at the bottom on each update.
3. Track each implemented phase with date and PR link.

## Change Log
- 2026-04-07: Initial mock-first profile page implementation plan created.
