# Yoca Market Frontend Audit

## 1. Scope

This Phase 2B2A audit covers only the currently reachable `/market` frontend route and Market-specific frontend behavior in the current repository state.

In scope:

- Active `/market` route registration and render tree
- Market page state, tabs, filters, sorting, tables, and visible navigation
- Market-specific frontend API calls and frontend-only data derivation
- Market loading, empty, error, fallback, and partial-data states
- Market-specific code that exists but is not used by `/market`
- Architecture-oriented summaries derived from already confirmed frontend evidence

Out of scope:

- Destination page internals for token, pool-detail, wallet, historical-data, profile, alerts, pricing, payment, and wash-trading routes
- Backend routes, backend services, databases, external providers, deployment, and production data correctness
- Global search and shared authentication internals except where the active Market page directly depends on shared context
- Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, and `02B1_SHARED_SHELL_SEARCH_AUTH.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered by `/market`, has a visible or lifecycle entry point, is connected, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected and usable, but with a confirmed frontend limitation such as missing error UI, response-shape assumptions, partial fallback behavior, auth/watchlist dependency, or missing refresh/persistence behavior.
- `FRONTEND_BROKEN`: visible Market control exists, but cannot complete its intended basic frontend behavior.
- `FRONTEND_UNUSED`: Market-specific implementation exists, but no active render, call, or lifecycle chain from `/market` was found.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `MARKET-01` through `MARKET-15`. Repeated evidence in later sections, responsive observations, data-formatting rows, frontend flows, architecture blocks, and unused implementation artifacts do not create additional capability counts.

## 3. Active Market route and render chain

`client/src/App.tsx` imports `MarketPage` from `client/src/pages/market` and registers it at child path `"market"`, so the addressable route is `/market`.

```text
/market
`- RootLayout
   `- MarketPage
      `- PageWrapper
         `- Section.marketPage
            |- Market hero/header
            |- Main tab bar and active-tab subfilters
            |- Rank dropdown, for non-profitable-trader tabs
            |- Filter popup, for non-profitable-trader tabs
            `- tableSection
               |- DexTable, when active tab is trending/top/gainers/newPairs
               `- ProfitableTradersView, when active tab is profitableTraders
                  |- TraderTable, top gainers
                  `- TraderTable, top losers
```

`PageWrapper` defaults `noMarketTickers = true`, and `MarketPage` does not pass `noMarketTickers={false}`. Therefore `client/src/components/MarketTicker/index.tsx` is not rendered by the active `/market` route.

## 4. Canonical Market capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation or exclusion reason |
|---|---|---|---|---|---|---|
| `MARKET-01` | Market route initialization and page shell | User opens `/market` | `App.tsx`, `MarketPage`, `PageWrapper` | Router renders `MarketPage` inside shared app shell | `FRONTEND_ACTIVE` | Shared shell behavior is covered in Phase 2B1; this row counts the Market route/page entry only. |
| `MARKET-02` | Market hero heading and contextual copy | Page render and active tab changes | `MarketPage` `headings` memo | Renders "Market Radar", title, and subtitle for active tab | `FRONTEND_ACTIVE` | Frontend presentation capability only. It supports the Market page container and should not become an independent high-level architecture node. |
| `MARKET-03` | Market tab switching | User clicks Trending, Top, Top Gainers, New Pairs, or Profitable Traders | `MarketPage` `MAIN_TABS` mapping | Updates `activeTabIndex` and default sort state for the selected tab | `FRONTEND_ACTIVE` | No URL persistence; tab state is local only. |
| `MARKET-04` | Pool data request lifecycle | `/market` mounts and selected pool subfilters change | `MarketPage`, `useGet` | Calls market-pool trending, top, gainers, and new-pairs endpoints | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | All non-trader pool requests are started even when their tab is hidden; pool request errors are not rendered distinctly. |
| `MARKET-05` | Pool table display | Non-profitable tab is active | `DexTable` | Displays pool token pair, market cap/FDV fallback, price, age, txns, volume, price changes, and liquidity | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Assumes response fields are usable; nulls fall back to `-`; request errors collapse into empty state behavior. |
| `MARKET-06` | Pool sorting and rank controls | User clicks table headers or rank dropdown options | `MarketPage.handleSort`, `DexTable` | Sorts current table data client-side by market cap, price, age, txns, volume, 5m, 1h, 6h, 24h, or liquidity | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Top-gainers duration changes only local sort key; the gainers API call is not parameterized by duration. |
| `MARKET-07` | Pool custom range filters | User opens Filters, edits min/max inputs, applies or resets | `MarketPage`, `DexTable` | Applies client-side filters for liquidity, market cap, volume, txns, age, and 24h change | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No min/max validity check; null field values pass filters; filtered-to-zero rows render an empty table body without a dedicated filtered-empty message. |
| `MARKET-08` | Pool-detail navigation | User clicks a pool token cell | `DexTable`, `useNavigate` | Navigates to `/tokens/:baseAddress/:poolAddress` | `FRONTEND_ACTIVE` | Destination page behavior is out of scope. |
| `MARKET-09` | Profitable-traders data request lifecycle | User switches to Profitable Traders tab or changes period | `ProfitableTradersView`, `useGet` | Calls top gainer and loser trader endpoints with `type=traderType` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Request errors are not rendered distinctly; failed requests can look like no data. |
| `MARKET-10` | Profitable-traders table display | Profitable Traders tab is active | `ProfitableTradersView`, `TraderTable` | Displays gainers and losers panels with trader, PnL, volume, and trade count | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Assumes trader response shape; both panels share one loading boolean. |
| `MARKET-11` | Trader period switching | User clicks 1D, 7D, 30D, or 90D period buttons | `MarketPage`, `ProfitableTradersView` | Updates `traderType`, which changes trader API keys | `FRONTEND_ACTIVE` | No URL persistence; period state is local only. |
| `MARKET-12` | Wallet navigation from trader rows | User clicks trader address cell | `TraderTable`, `useNavigate` | Navigates to `/wallets/:address` | `FRONTEND_ACTIVE` | Destination page behavior is out of scope. |
| `MARKET-13` | Wallet watchlist toggle from trader rows | User clicks star button in trader table | `TraderTable`, `WatchlistContext` | Calls `toggleWallet(address)` and disables pending wallet row | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Auth/watchlist dependency is not gated in the table; thrown toggle failures are not caught by `TraderTable`. |
| `MARKET-14` | Trader address copy | User clicks copy icon in trader row | `TraderTable` | Calls `navigator.clipboard.writeText(trader.address)` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No success or failure feedback is rendered. |
| `MARKET-15` | Market loading, empty, and fallback states | API lifecycle, empty arrays, missing images, null values | `DexTable`, `TraderTable`, `TknImg`, `useGet` | Shows pool inline loading, trader loading rows, no-data rows, token image skeleton/placeholder, and value fallbacks | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Pool loading omits `topGainerPools`; pool errors are not distinct; filtered-empty pool tables lack a dedicated message. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 6 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 9 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical capabilities** | 15 |

Validation: `6 + 9 + 0 + 0 + 0 = 15`, matching the 15 rows in the canonical Market capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Unused Market code artifacts | 10 |
| Out-of-scope components encountered | 0 |

Canonical capability totals come only from `MARKET-01` through `MARKET-15`. The ten unused Market artifacts are excluded. Responsive observations are not new capabilities. Data-formatting rows are not new capabilities. Frontend flows are not new capabilities. Architecture blocks are containers, not additional capabilities. Destination routes and shared `PageWrapper` controls were encountered as boundaries/evidence only and are not counted as out-of-scope components.

## 5. Visible Market sections

| Area | Visible content | Data source | Status |
|---|---|---|---|
| Shared app shell | App header, Market/Alerts nav, account/search/theme/language/notification controls | Shared `PageWrapper`; audited in Phase 2B1 | Evidence only |
| Market hero | "Market Radar" eyebrow plus active-tab title and subtitle | Static text plus localization keys selected by `activeTab` | `FRONTEND_ACTIVE` |
| Main tabs | Trending, Top, Top Gainers, New Pairs, Profitable Traders | Static `MAIN_TABS` list and localization | `FRONTEND_ACTIVE` |
| Pool subfilters | Durations for Trending/Gainers; Volume/Txns for Top | Static arrays in `MarketPage`; state local to page | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Rank dropdown | Direction and sort-key options | Static `sortOptions`; local sort state | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Filter popup | Range inputs for liquidity, market cap, volume, txns, age, and 24h change | Static `filterOptions`; local temp/applied filter state | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Pool table | Pair, market cap, price, age, txns, volume, 5m/1h/6h/24h changes, liquidity | Market-pool API responses, locally sorted/filtered | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Profitable-traders view | Two panels: top gainers and top losers | Trader API responses for selected period | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Trader rows | Star, address, copy button, PnL, volume, trades | Trader API data plus watchlist context | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

No active Market summary cards, charts, active pagination controls, or manual refresh controls were found in the current `/market` render tree.

## 6. Market frontend API calls

| Trigger | Frontend caller | API method | Request input | Response usage | Frontend limitations |
|---|---|---|---|---|---|
| `/market` mounts and `trendingDuration` changes | `MarketPage` | `client.api.tokens["market-pools"].trending.$get` through `useGet` | Query `{ duration: trendingDuration }` | Data for Trending tab | Error is not rendered distinctly. |
| `/market` mounts and `topSort` changes | `MarketPage` | `client.api.tokens["market-pools"].top.$get` through `useGet` | Query `{ sortBy: topSort }` | Data for Top tab | Error is not rendered distinctly. |
| `/market` mounts | `MarketPage` | `client.api.tokens["market-pools"].gainers.$get` through `useGet` | No query | Data for Top Gainers tab | Duration UI affects local sort only; loading flag is not included in `DexTable.loading`. |
| `/market` mounts | `MarketPage` | `client.api.tokens["market-pools"]["new-pairs"].$get` through `useGet` | No query | Data for New Pairs tab | Uses `isLoading` but not `isValidating` in combined loading expression. |
| Profitable Traders tab renders or `traderType` changes | `ProfitableTradersView` | `client.api.trades.traders.gainers.$get` through `useGet` | Query `{ type: traderType }` | Data for top gainers trader panel | Error is not rendered distinctly. |
| Profitable Traders tab renders or `traderType` changes | `ProfitableTradersView` | `client.api.trades.traders.losers.$get` through `useGet` | Query `{ type: traderType }` | Data for top losers trader panel | Error is not rendered distinctly. |
| Trader star is clicked | `TraderTable` -> `WatchlistContext` -> `profileApi` | `client.api.profile.watchlist["addresses-update"].$post` or `$delete` | `{ walletAddress }` | Adds/removes wallet in shared watchlist state | No Market-level auth gate or user-facing failure handling. |

`useGet` uses SWR keys from Hono client URLs, throws non-success responses, disables `revalidateOnFocus`, and disables `revalidateOnReconnect`. The active Market page does not call `mutate()`, define a refresh interval, or render a manual refresh button.

## 7. Market state and controls

| State/control | Implementation | User effect | Status |
|---|---|---|---|
| Active tab | `activeTabIndex`, `MAIN_TABS` | Switches between four pool tables and profitable-traders view | `FRONTEND_ACTIVE` |
| Trending/gainers duration | `trendingDuration` | Changes Trending API query and local sort key; changes Top Gainers local sort key only | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Top sort | `topSort` | Changes Top API query and local sort key | `FRONTEND_ACTIVE` |
| Trader period | `traderType` | Changes profitable-trader API query keys | `FRONTEND_ACTIVE` |
| Sort key/direction | `sortKey`, `sortDirection` | Client-side sorting in `DexTable` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Applied filters | `filters` | Client-side range filtering in `DexTable` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Temporary filters | `tempFilters` | Stages popup input values until Apply | `FRONTEND_ACTIVE` |
| Rank dropdown open state | `isRankOpen`, `rankRef`, click-outside effect | Opens/closes ranking menu | `FRONTEND_ACTIVE` |
| Filter popup open state | `isFilterOpen`, `filterRef`, click-outside effect | Opens/closes filter popup | `FRONTEND_ACTIVE` |

No Market state is persisted into the URL, local storage, or session storage.

## 8. Sorting, filtering, tabs, pagination, and refresh

| Concern | Current frontend behavior | Status |
|---|---|---|
| Tab switching | Fully local state; active tab controls table/view selection and heading copy | `FRONTEND_ACTIVE` |
| Pool table sorting | Header clicks and rank dropdown call the same sort handler; sorting is client-side over current API response | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Pool duration subfilters | Trending duration updates API query; Gainers duration does not parameterize the gainers request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Top subfilters | Volume/Txns updates Top API query and local sort | `FRONTEND_ACTIVE` |
| Trader period subfilters | Period buttons update `traderType`, which updates gainers/losers API keys | `FRONTEND_ACTIVE` |
| Custom filters | Apply/reset are connected; filters are local range checks | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Pagination | No active pagination control is rendered by `/market` | Not active |
| Manual refresh | No active manual refresh button or `mutate()` call found | Not active |
| Automatic refresh | No active polling interval; SWR focus/reconnect revalidation is disabled | Not active |

## 9. Market navigation

| Source block | Destination route | Entity | Trigger |
|---|---|---|---|
| Pool discovery | `/tokens/:baseAddress/:poolAddress` | Pool detail for selected base token and pool | User clicks a pool token cell in `DexTable`. |
| Profitable traders | `/wallets/:address` | Wallet address | User clicks a trader address cell in `TraderTable`. |

No active Market-specific navigation to `/tokens/:address` token overview was confirmed. Global search can navigate there, but global search is out of scope for this phase. `MarketTicker` has token-overview links if rendered elsewhere, but it is not rendered from `/market`.

## 10. Authentication, plan, wallet, and watchlist dependencies

| Interaction | Dependency | Current frontend behavior | Limitation |
|---|---|---|---|
| Pool table viewing/filtering/sorting | None found | Public UI renders without route guard | No Market-specific auth dependency found. |
| Profitable-traders viewing | None found | Public UI renders when tab is selected | No Market-specific plan or auth gate found. |
| Trader wallet watchlist star | Shared watchlist/auth context | Uses `walletWatchlist`, `walletPending`, and `toggleWallet` from `WatchlistContext` | Table does not gate guests, prompt auth, catch toggle failures, or show error feedback. |
| Trader wallet navigation | None found | Navigates to wallet route | Destination behavior is out of scope. |
| Wallet connection | None found | No active Market wallet-connection control found | Wallet auth/provider behavior is not used by Market page controls. |
| Subscription plan | None found | No active Market plan-gated control found | Plan behavior is out of scope. |

## 11. Loading, empty, error, and fallback states

| State type | Where implemented | Behavior | Limitation |
|---|---|---|---|
| Pool loading | `MarketPage` -> `DexTable.loading` | Shows Carbon `InlineLoading` with market loading text | Combined loading includes trending/top/newPairs but omits top-gainers loading and some validating states. |
| Pool empty | `DexTable` | If original `data.length === 0`, shows no-pools-found message | Request errors and empty responses can look the same; filtered-to-zero rows render an empty table body without a message. |
| Pool field fallback | `DexTable` | Null/missing values render `-`; market cap falls back to FDV | No response-field validation beyond local fallbacks. |
| Token image loading/error | `TknImg` | Shows skeleton while loading and placeholder on image error | Placeholder can hide image data quality issues. |
| Trader loading | `TraderTable` | Shows loading row spanning the table | Gainers and losers share one loading boolean in parent. |
| Trader empty | `TraderTable` | Shows no-data row | Request errors are not distinct from empty data. |
| Trader copy | `TraderTable` | Calls clipboard write | No success/error feedback. |
| Watchlist pending | `TraderTable` | Disables star while pending for that address | Toggle failures are not handled in the table. |

## 12. Market data formatting and derived values

| Displayed value | Source field or fields | Frontend transformation/helper | Missing or invalid-value behavior | Capability ID |
|---|---|---|---|---|
| Pair name and token symbols | `baseSymbol`, `quoteSymbol`, `baseName` | `DexTable` uppercases symbols and shows `baseName` as description only when it differs from base symbol | Missing symbols render `UNK`; missing description is omitted | `MARKET-05` |
| Pool row rank | Sorted/filtered row index | `DexTable` displays `#{idx + 1}` after local sort/filter | Rank is derived locally and may differ from backend rank semantics | `MARKET-05` |
| Token image and quote image | `baseImageUrl`, `quoteImageUrl` | `TknImg` renders skeleton until image load and placeholder after image error | Null or errored image uses app placeholder | `MARKET-15` |
| Market cap | `marketCapUsd`, `fdvUsd` | `const mcap = pool.marketCapUsd || pool.fdvUsd`; formatted with `fmt.num.compact.currency` | Missing both renders `-`; zero is treated as falsy and renders `-` | `MARKET-05` |
| Price | `priceUsd` | `fmt.num.currency(pool.priceUsd)` | Missing or zero/falsy value renders `-` | `MARKET-05` |
| Pool age | `poolCreatedAt` | `formatAge(dateStr, justNowLabel)` derives days/hours/minutes from `Date.now()` | Missing, future, or invalid dates render `-` or may produce invalid date behavior | `MARKET-05` |
| Transaction count | `txns24h` | `fmt.num.compact.decimal(pool.txns24h)` | Missing or zero/falsy value renders `-` | `MARKET-05` |
| Volume | `volume24h` | `fmt.num.compact.currency(pool.volume24h)` | Missing or zero/falsy value renders `-` | `MARKET-05` |
| Liquidity | `liquidityUsd` | `fmt.num.compact.currency(pool.liquidityUsd)` | Missing or zero/falsy value renders `-` | `MARKET-05` |
| Price-change percentages | `priceChange5m`, `priceChange1h`, `priceChange6h`, `priceChange24h` | `renderTrend` plus `formatCompactPercentText`; positive/negative/neutral classes | `null` renders `-`; very large values use compact percent formatting | `MARKET-05` |
| Pool filter values | Pool numeric fields plus derived `ageHours` | `DexTable` parses min/max strings with `parseFloat` and range checks locally | Null values pass filters; invalid min/max input can become `NaN` and fail comparisons | `MARKET-07` |
| Trader address | `address` | `truncateAddress` renders first 4 and last 4 chars; full address is used for navigation/copy/watchlist | Short or missing addresses return as-is | `MARKET-10` |
| Trader PnL | `pnl` | Sign prefix and `fmt.num.compact.currency`; class based on positive/negative/neutral | Assumes numeric value is present | `MARKET-10` |
| Trader volume | `volume` | `fmt.num.compact.currency(trader.volume)` | Assumes numeric value is present | `MARKET-10` |
| Trader trade count | `tradeCount` | `fmt.num.decimal(trader.tradeCount)` | Assumes numeric value is present | `MARKET-10` |
| Trader rank | `rank` | Rendered directly as `#{trader.rank}` | Missing rank would render `#` plus the supplied value behavior | `MARKET-10` |
| Watchlist star state | `walletWatchlist`, `walletPending`, `trader.address` | `walletWatchlist.includes(address)` chooses `Star`/`StarFilled`; pending disables button | Depends on shared watchlist state and pending map | `MARKET-13` |

This section documents frontend formatting and derivation only. It does not evaluate financial accuracy.

## 13. Responsive Market behavior

Responsive behavior in the active Market page is CSS-driven. No mobile-specific data fetching, mobile-specific click handlers, or separate mobile render tree was found in the inspected active files.

| Market block | Desktop behavior | Narrow/mobile behavior | Same data flow used | Confirmed limitation |
|---|---|---|---|---|
| Market page container and hero | `marketStack` is capped at `min(100%, 96rem)`; hero uses larger clamp-based padding/title sizes | At `max-width: 42rem`, page horizontal padding is reduced and hero padding becomes `1.125rem` | Yes | Presentation-only adaptation; no separate mobile state. |
| Main tab and toolbar bar | `.dexBar` is a single flex row with toolbar pushed right by `margin-left: auto` | At `max-width: 72rem`, `.dexBar` wraps and toolbar loses auto margin; at `max-width: 42rem`, active tab and toolbar become full-width/stretch | Yes | No explicit horizontal tab scrolling; many tab buttons can wrap rather than scroll. |
| Active tab subfilters | Inline filters sit inside active tab container | At `max-width: 42rem`, active tab container uses full width and `justify-content: space-between` | Yes | No mobile-specific compact label logic beyond existing static labels. |
| Rank dropdown | Absolute dropdown aligned right under rank button, fixed width `14.5rem` | Same positioning rules apply after toolbar wraps | Yes | No viewport collision handling beyond toolbar wrapping. |
| Filter popup | Absolute popup aligned right with width `min(22rem, calc(100vw - 2rem))`; internal content scrolls at `max-height: 24rem` | Width clamps to viewport minus 2rem; popup remains absolute under filter control | Yes | No full-screen/mobile-sheet behavior found. |
| Pool table | Table has `min-width: 70rem`, nowrap cells, and horizontal overflow on `.dexTableContainer` | At `max-width: 48rem`, border radius and horizontal cell padding are reduced; horizontal overflow remains | Yes | No hidden columns or mobile card layout found. |
| Profitable trader panels | `.splitLayout` displays two panels side by side with flex row | At `max-width: 768px`, `.splitLayout` becomes column layout | Yes | Same gainer/loser requests and tables are used. |
| Trader table | Table has `min-width: 31rem`, sticky headers, `max-height: calc(100vh - 18rem)`, and overflow auto | At `max-width: 48rem`, only border radius is adjusted; horizontal overflow remains | Yes | No hidden columns or mobile card layout found. |

## 14. Unused or disconnected Market code

| Candidate | File | Why it is Market-related | Active `/market` render/call found | Classification |
|---|---|---|---|---|
| `MarketTicker` | `client/src/components/MarketTicker/index.tsx` | Market/trending ticker component with token navigation and token APIs | No. `PageWrapper` can render it only when `noMarketTickers` is false; `/market` does not set that prop. | `FRONTEND_UNUSED` |
| `TickerBar` | `client/src/components/market/TickerBar.tsx` | Market ticker using hardcoded token addresses and 60s polling | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `MarketTabs` | `client/src/components/market/MarketTabs.tsx` | Older Carbon tab wrapper for overview/fundamental/profit-loss/futures | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `AssetInfo` | `client/src/components/market/AssetInfo.tsx` | Token/asset summary card | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `TokenPerformanceTable` | `client/src/components/market/TokenPerformanceTable.tsx` | Token market table with hardcoded address list and raw fetches | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `TokenPriceHistoryChart` | `client/src/components/market/TokenPriceHistoryChart.tsx` | Token chart component with raw chart fetches | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `TransactionTable` | `client/src/components/market/TransactionTable.tsx` | Mock recent transaction table with Carbon pagination/export | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `HighlightsMiniList` | `client/src/components/market/HighlightsMiniList.tsx` | Generic market highlight mini-list | No import from active `MarketPage` | `FRONTEND_UNUSED` |
| `SYNC_OPTIONS` | `client/src/pages/market/index.tsx` | Hardcoded synchronized dropdown option list | Defined but not rendered or referenced by UI | `FRONTEND_UNUSED` |
| `currentDropdownLabel` | `client/src/pages/market/index.tsx` | Derived label for a dropdown that is not currently rendered | Computed but not displayed | `FRONTEND_UNUSED` |

Unused implementation count: 10.

## 15. Frontend-only Market data flows

### Flow A - Open the Market page

1. User navigates to `/market`.
2. Router renders `MarketPage`.
3. `MarketPage` initializes local tab, sort, filter, and popup state.
4. All four pool request hooks initialize: trending, top, gainers, and new-pairs, even though only one pool tab is visible.
5. The active tab is resolved from `MAIN_TABS[activeTabIndex]`.
6. Active-tab pool data is selected through `dataToRender`, or `ProfitableTradersView` is rendered for the profitable-traders tab.
7. `DexTable` locally sorts and filters the selected pool rows.
8. `DexTable` or `ProfitableTradersView` renders.
9. Loading, empty, and fallback states are selected by the active child component.

### Flow B - Switch Market tabs

1. User clicks a tab button.
2. `MarketPage` updates `activeTabIndex`.
3. For Trending or Top Gainers, `sortKey` is reset to the current `trendingDuration` and `sortDirection` to `desc`.
4. For Top, `sortKey` is reset to `topSort` and `sortDirection` to `desc`.
5. For New Pairs, `sortKey` is reset to `age` and `sortDirection` to `desc`.
6. Pool tabs reveal already mounted pool request data; switching among pool tabs does not mount a new child request hook.
7. Switching to Profitable Traders mounts `ProfitableTradersView`, and that child initializes the trader gainer/loser request hooks.

### Flow C - Change a pool subfilter

1. On Trending, user selects 5m, 1h, 6h, or 24h.
2. `trendingDuration` changes, `sortKey` is set to that duration, and the trending pool API query changes.
3. On Top, user selects Volume or Txns.
4. `topSort` changes, `sortKey` is set to that sort, and the top pool API query changes.
5. On Top Gainers, user selects 5m, 1h, 6h, or 24h.
6. `trendingDuration` and local `sortKey` change, but the gainers request has no duration parameter in the current UI.
7. New Pairs has no equivalent visible request parameter in the current UI.

### Flow D - Sort and filter pool rows

1. User clicks a table header or opens the rank menu and selects a sort option.
2. `handleSort` updates `sortKey` and toggles or resets `sortDirection`.
3. `DexTable` computes `sortedData` with `getSortValue`.
4. User opens the filter popup.
5. Filter input changes update `tempFilters`, not applied filters.
6. Apply copies `tempFilters` into `filters` and closes the popup.
7. Reset returns both `filters` and `tempFilters` to `INITIAL_FILTERS`.
8. `DexTable` applies local range filters before sorting.
9. If filtering removes every row, the rendered table body is empty without a dedicated filtered-empty message.

### Flow E - Select a pool

1. User clicks the token/pair cell in a `DexTable` row.
2. `DexTable` calls `navigate(`/tokens/${pool.baseAddress}/${pool.poolAddress}`)`.
3. Flow stops at the route boundary `/tokens/:baseAddress/:poolAddress`.

### Flow F - View profitable traders

1. User selects the Profitable Traders tab.
2. `MarketPage` renders `ProfitableTradersView` with `traderType`.
3. `ProfitableTradersView` initializes top-gainer and top-loser trader request hooks.
4. The selected period is passed as query `{ type: traderType }`.
5. The component renders two panels.
6. Each panel renders a `TraderTable`.

### Flow G - Select or copy a trader

1. User clicks a trader address cell.
2. `TraderTable` calls `navigate(`/wallets/${trader.address}`)`.
3. Flow stops at the route boundary `/wallets/:address`.
4. If user clicks the copy icon, the event propagation is stopped.
5. The component calls `navigator.clipboard.writeText(trader.address)`.
6. No copy success or failure feedback is rendered.

### Flow H - Toggle a trader watchlist entry

1. User clicks the star button in a trader row.
2. The click stops row propagation.
3. `TraderTable` calls `toggleWallet(trader.address)` from `WatchlistContext`.
4. The row star button is disabled while `walletPending[trader.address]` is truthy.
5. Shared watchlist state is optimistically updated by `WatchlistContext`.
6. The flow crosses the frontend/backend boundary through profile watchlist update calls.
7. `TraderTable` does not provide a local auth gate, auth prompt, catch block, or error message.

## 16. Architecture-ready Market summary

### Confirmed Market frontend blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Market page container | `MARKET-01`, `MARKET-02`, `MARKET-03` | `App.tsx`, `MarketPage`, `PageWrapper`, Market hero and tabs | Owns route entry, local page state, presentation heading, and active tab selection | High-level frontend page node. `MARKET-02` is presentation support inside this container, not a separate architecture node. |
| Market pool discovery | `MARKET-04`, `MARKET-05`, `MARKET-15` | `MarketPage`, `DexTable`, `TknImg`, `useGet` | Fetches market pool datasets and renders pool discovery table with fallbacks | Core Market data presentation block. |
| Pool filtering and ranking | `MARKET-06`, `MARKET-07` | `MarketPage`, `DexTable` | Provides client-side sorting, rank dropdown, and range filtering over current pool rows | Frontend interaction layer over pool discovery data. |
| Profitable-trader discovery | `MARKET-09`, `MARKET-10`, `MARKET-11`, `MARKET-15` | `ProfitableTradersView`, `TraderTable` | Fetches and renders trader gainers/losers for selected period | Separate Market data view with its own request lifecycle. |
| Entity navigation | `MARKET-08`, `MARKET-12`, `MARKET-14` | `DexTable`, `TraderTable`, React Router navigation, clipboard API | Moves users from Market rows to pool or wallet routes and supports address copying | Route-boundary block, not destination-page behavior. |
| Watchlist interaction | `MARKET-13` | `TraderTable`, `WatchlistContext`, `profileApi` | Toggles wallet watchlist state from trader rows | Crosses into shared profile/watchlist frontend boundary. |

### Market frontend-to-backend boundaries

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| Market pool discovery | Trending market pools | Hono RPC `client.api.tokens["market-pools"].trending.$get` | Fetch trending pool rows for selected duration | `/market` mount and `trendingDuration` changes | `client/src/pages/market/index.tsx` |
| Market pool discovery | Top market pools | Hono RPC `client.api.tokens["market-pools"].top.$get` | Fetch top pool rows sorted by volume or txns | `/market` mount and `topSort` changes | `client/src/pages/market/index.tsx` |
| Market pool discovery | Gainer market pools | Hono RPC `client.api.tokens["market-pools"].gainers.$get` | Fetch top-gainer pool rows | `/market` mount | `client/src/pages/market/index.tsx` |
| Market pool discovery | New-pair market pools | Hono RPC `client.api.tokens["market-pools"]["new-pairs"].$get` | Fetch newly created pair rows | `/market` mount | `client/src/pages/market/index.tsx` |
| Profitable-trader discovery | Top-gainer traders | Hono RPC `client.api.trades.traders.gainers.$get` | Fetch profitable trader rows for selected period | Profitable Traders tab render and `traderType` changes | `client/src/components/market/ProfitableTradersView.tsx` |
| Profitable-trader discovery | Top-loser traders | Hono RPC `client.api.trades.traders.losers.$get` | Fetch losing trader rows for selected period | Profitable Traders tab render and `traderType` changes | `client/src/components/market/ProfitableTradersView.tsx` |
| Watchlist interaction | Wallet watchlist update | Hono RPC via `client.api.profile.watchlist["addresses-update"].$post` or `$delete` | Add or remove a trader wallet address from the user's watchlist | Trader row star click | `TraderTable`, `WatchlistContext`, `profileApi` |

### Market route boundaries

| Source block | Destination route | Entity | Trigger |
|---|---|---|---|
| Pool discovery | `/tokens/:baseAddress/:poolAddress` | Pool detail | User clicks pool token cell in `DexTable`. |
| Profitable traders | `/wallets/:address` | Wallet address | User clicks trader address cell in `TraderTable`. |

No active Market-specific navigation to `/tokens/:address` was confirmed.

### Capabilities eligible for backend verification

Only canonical IDs that cross the frontend/backend boundary or depend on backend-provided data are listed:

1. `MARKET-04` Pool data request lifecycle
2. `MARKET-05` Pool table display
3. `MARKET-06` Pool sorting and rank controls
4. `MARKET-07` Pool custom range filters
5. `MARKET-09` Profitable-traders data request lifecycle
6. `MARKET-10` Profitable-traders table display
7. `MARKET-13` Wallet watchlist toggle from trader rows
8. `MARKET-15` Market loading, empty, and fallback states

## 17. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should Top Gainers duration buttons be sent to the backend rather than only changing local sort? | The active gainers request has no duration query, but the UI exposes 5m/1h/6h/24h buttons | Market backend/API contract verification |
| Should pool request errors render a distinct error state? | `useGet.error` is not consumed by `MarketPage` or `DexTable` | Market UX hardening |
| Should filtered-to-zero pool results show a dedicated empty state? | `DexTable` only checks original data length, not filtered result length | Market UX hardening |
| Should top-gainers loading be included in the pool loading expression? | `topGainerPools.isLoading` and `.isValidating` are omitted from `DexTable.loading` | Market frontend bug review |
| Should `/market` have pagination or manual refresh? | No active pagination/manual refresh controls were found, despite unused components with pagination/polling | Product requirements review |
| Should trader watchlist controls require authentication or open an auth prompt for guests? | `TraderTable` calls `toggleWallet` directly and does not catch errors | Market/watchlist UX verification |
| Should the unused Market components be removed, revived, or moved to a legacy/demo area? | Multiple Market-specific components exist with no active render chain from `/market` | Frontend cleanup audit |
| Should responsive behavior hide columns or provide mobile card layouts? | Current active CSS mainly uses wrapping and horizontal overflow; no hidden-column or card layout was confirmed | Market responsive UX review |

## 18. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `client/src/App.tsx`
- `client/src/pages/market/index.tsx`
- `client/src/pages/market/index.module.scss`
- `client/src/components/wrapper/PageWrapper.tsx`
- `client/src/components/market/DexTable.tsx`
- `client/src/components/market/DexTable.module.scss`
- `client/src/components/market/ProfitableTradersView.tsx`
- `client/src/components/market/ProfitableTradersView.module.scss`
- `client/src/components/market/TraderTable.tsx`
- `client/src/components/market/TraderTable.module.scss`
- `client/src/components/market/index.ts`
- `client/src/components/MarketTicker/index.tsx`
- `client/src/components/market/TickerBar.tsx`
- `client/src/components/market/MarketTabs.tsx`
- `client/src/components/market/AssetInfo.tsx`
- `client/src/components/market/TokenPerformanceTable.tsx`
- `client/src/components/market/TokenPriceHistoryChart.tsx`
- `client/src/components/market/TransactionTable.tsx`
- `client/src/components/market/HighlightsMiniList.tsx`
- `client/src/hooks/useGet.ts`
- `client/src/contexts/WatchlistContext.tsx`
- `client/src/services/profile/profileApi.ts`
- `client/src/components/TknImg.tsx`
- `client/src/components/TrendNum.tsx`
