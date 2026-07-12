# Yoca Token Overview Core Frontend Audit

## 1. Scope

This Phase 2B2B1 audit covers only the currently used core frontend implementation for the Token Overview route `/tokens/:address` in the current repository state.

In scope:

- Active `/tokens/:address` route registration and render tree
- Route parameter handling for the token address
- Core token identity, metadata, statistics, charts, markets, pools, holders, and navigation behavior
- Core Token Overview frontend API calls and local state
- Core loading, empty, error, fallback, responsive, and derived-value behavior
- Token-related code that exists but is not active in the `/tokens/:address` route
- Architecture-oriented summaries derived from confirmed frontend evidence

Out of scope:

- Backend route, service, database, provider, deployment, and production data correctness
- Pool-detail route `/tokens/:address/:poolAddress`
- Historical-data page internals
- Wallet page internals
- Deferred news, AI, wash-trading, tokenomics/investors, and chart-news internals beyond boundary identification
- Shared `PageWrapper`, global search, account, authentication, notification, and preference-control internals except where they frame the page
- Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, and `02B2A_MARKET_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered by `/tokens/:address`, has a visible or lifecycle entry point, is connected, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected and usable, but with a confirmed frontend limitation such as missing validation, missing error UI, response-shape assumptions, partial fallback behavior, external embed dependency, or local-only state.
- `FRONTEND_BROKEN`: visible core Token Overview control exists, but cannot complete its intended basic frontend behavior.
- `FRONTEND_UNUSED`: token-specific implementation exists, but no active render, call, or lifecycle chain from `/tokens/:address` was found.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `TOKEN-CORE-01` through `TOKEN-CORE-19`. Repeated evidence in later sections, deferred feature boundaries, responsive observations, data-formatting rows, frontend flows, architecture blocks, and unused implementation artifacts do not create additional capability counts.

## 3. Active route and render chain

`client/src/App.tsx` imports `TokenOverviewPage` from `client/src/pages/token-overview` and registers it at child path `"tokens/:address"`, so the addressable route is `/tokens/:address`.

```text
/tokens/:address
`- RootLayout
   `- TokenOverviewPage
      `- PageWrapper
         `- section.tokenOverviewPage
            |- Token hero/header copy
            |- overviewShell
            |  |- sideRail
            |  |  |- TokenHeader
            |  |  `- TokenOverviewStats
            |  `- mainRail
            |     |- TokenTabs
            |     |- #token-overview
            |     |  `- TokenOverviewChart
            |     |- #token-markets
            |     |  |- TokenInsightTabs
            |     |  |- TokenAIChat (deferred boundary)
            |     |  |- TokenMarketsTable
            |     |  `- GlobalPrices, when priceUsd exists
            |     `- #token-news
            |        `- NewsTab (deferred boundary)
```

No route-level guard, lazy-loaded route wrapper, or route-level address validator was confirmed for `/tokens/:address`.

## 4. Deferred feature boundaries

These features are rendered from the active Token Overview route or adjacent active Token Overview components, but their internals are intentionally deferred from this core audit.

| Deferred boundary | Entry point in `/tokens/:address` | Component or subsystem | Boundary behavior confirmed | Why deferred |
|---|---|---|---|---|
| Wash-trading action | AI wash-trading button in the token header | `TokenHeader` | Visible action can lead toward wash-trading/auth/upgrade flows depending on user and plan state | Wash-trading, auth gating, and plan behavior are audited separately. |
| Ask Yoca token AI chat | Inline AI chat block below insights | `TokenAIChat` | Rendered with token address, symbol, name, and chart timeframe | AI chat request/streaming internals are out of scope. |
| Token news feed | `#token-news` section and TokenTabs news tab | `NewsTab` | Rendered when both address and token details exist | News fetch, refresh, pagination, and article handling are out of scope. |
| Chart news markers and summaries | Overlays and popups inside the overview chart | `TokenOverviewChart` news-marker subsystem | Chart component includes news event marker state, marker click behavior, and summary state | News-event API and AI/news summarization behavior are out of scope. |
| Supplemental tokenomics/investors tabs | Conditional insight tabs | `TokenInsightTabs`, `TokenAllocation`, `TokenUnlockSchedule`, `TokenInvestors` | Conditional tabs can appear from supplemental metadata fetched by the component | Tokenomics/investor metadata and external-provider behavior are non-core for this phase. |

Deferred feature boundary count: 5.

## 5. Canonical Token Overview core capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation or exclusion reason |
|---|---|---|---|---|---|---|
| `TOKEN-CORE-01` | Token Overview route initialization and address handoff | User opens `/tokens/:address` | `App.tsx`, `TokenOverviewPage` | Router renders the page and `useParams` reads `address` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Missing address renders a plain fragment; no route-level address validation, trimming, or normalization was found. |
| `TOKEN-CORE-02` | Core token data bootstrap | Page mounts or address changes | `useTokenOverviewData`, `useGet` | Requests token details, market data, and holders | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Details select assumes `data[0].meta` and `data[0].details`; holder loading/error is not included in the main loading/error calculation. |
| `TOKEN-CORE-03` | Token page container and layout | Page render | `TokenOverviewPage`, `PageWrapper`, page SCSS | Renders page hero, sidebar, main rail, section anchors, and skeleton branch | `FRONTEND_ACTIVE` | Shared shell internals are a boundary covered in Phase 2B1. |
| `TOKEN-CORE-04` | Token identity header | Token details available | `TokenHeader` | Displays image, symbol, name, and AI wash-trading action | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Token Overview uses compact configuration, so address copy and external header links are hidden; image fallback can mask missing image data. |
| `TOKEN-CORE-05` | Token statistics and metadata card | Token details and market data available | `TokenOverviewStats` | Displays price, custom/24h change, range bar, supply, market cap, FDV, volume, ATH/ATL, and metadata links | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Some fields assume valid URLs or numeric values; malformed homepage can throw during hostname parsing. |
| `TOKEN-CORE-06` | Token section tabs and section scrolling | User clicks Overview, Markets, or News tab | `TokenTabs`, `TokenOverviewPage` refs | Scrolls to active page sections and updates local `activeTab` | `FRONTEND_ACTIVE` | News tab targets a deferred boundary; tab state is local and not URL-persisted. |
| `TOKEN-CORE-07` | Price and market-cap line chart | Page render, chart range or metric changes | `TokenOverviewChart`, `ReactECharts` | Fetches chart data and renders price or market-cap time series | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Failed chart requests collapse into no-data behavior; no distinct error UI or request cancellation was confirmed. |
| `TOKEN-CORE-08` | Chart range and metric controls | User clicks range or price/market-cap/candle controls | `TokenOverviewChart` | Updates chart mode, line mode, selected range, and parent custom price-change state | `FRONTEND_ACTIVE` | State is local and not URL-persisted. |
| `TOKEN-CORE-09` | Candle chart mode | User selects candle mode | `TokenOverviewChart`, `GeckoTerminalChart` | Fetches token pools, selects the highest-liquidity pool, and renders an external iframe chart | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Requires pool data and iframe availability; no distinct pool-request error state was confirmed. |
| `TOKEN-CORE-10` | About/summary insight cards | User views About/Stats tab | `TokenInsightTabs` | Derives narrative cards from market volume, ATH/ATL, market cap, and FDV | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Empty market data can leave the active tab with no dedicated empty message. |
| `TOKEN-CORE-11` | Holder table and distribution chart | User views Holders tab | `TokenInsightTabs`, `TopHoldersTable`, `ReactECharts` | Displays top holders and a top-holder distribution donut chart | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Holder loading is driven by main first-load state rather than the holder request itself; invalid percentages can render as invalid text. |
| `TOKEN-CORE-12` | Token markets and pools table | Markets section render | `TokenMarketsTable`, `Tble` | Fetches pools and token metadata, then displays exchange, pair, price, change, volume, liquidity, and transactions | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Pool errors collapse into empty state; pair metadata loading is not surfaced; table has pagination but no active sorting/filtering. |
| `TOKEN-CORE-13` | Markets table pagination | User changes page or page size | `Tble` used by `TokenMarketsTable` | Paginates pool rows locally with page-size options | `FRONTEND_ACTIVE` | Pagination state is local and not URL-persisted. |
| `TOKEN-CORE-14` | Global fiat price conversions | Market price exists | `GlobalPrices`, `useExchangeRates` | Fetches exchange rates and renders allowed fiat conversions with "show more" behavior | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Rate failures render no explicit error; the section is hidden entirely when `priceUsd` is null. |
| `TOKEN-CORE-15` | Pool-detail navigation | User clicks a pool/pair row in markets table | `TokenMarketsTable`, React Router `Link` | Navigates to `/tokens/:address/:poolAddress` | `FRONTEND_ACTIVE` | Destination page internals are out of scope. |
| `TOKEN-CORE-16` | Holder wallet navigation | User clicks a holder address | `TopHoldersTable` | Opens `/wallets/:holderAddress` through an anchor href | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Uses an href rather than React Router navigation; no holder address validation was confirmed. |
| `TOKEN-CORE-17` | Historical-data navigation | User clicks Historical Data tab-link | `TokenTabs` | Opens `/historical-data/:address` in a new tab | `FRONTEND_ACTIVE` | Historical-data page internals are out of scope. |
| `TOKEN-CORE-18` | External token metadata links | User opens Website, Explorer, or Community links | `TokenOverviewStats` | Renders external metadata links from token detail fields | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Explorer URLs are filtered defensively, but homepage hostname parsing is less defensive. |
| `TOKEN-CORE-19` | Core loading, empty, and fallback behavior | API lifecycle and missing partial data | `TokenOverviewPage`, `TokenOverviewChart`, `TokenMarketsTable`, `TopHoldersTable`, `TknImg`, `Tble` | Shows skeletons, loading states, no-data states, placeholders, and value fallbacks | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Main page error is not rendered distinctly; several API failures can look like loading, empty, or missing data. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 6 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 13 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical capabilities** | 19 |

Validation: `6 + 13 + 0 + 0 + 0 = 19`, matching the 19 rows in the canonical Token Overview core capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Deferred feature boundaries | 5 |
| Unused or disconnected core Token artifacts | 8 |
| Out-of-scope components encountered | 0 |

Canonical capability totals come only from `TOKEN-CORE-01` through `TOKEN-CORE-19`. Deferred feature boundaries, unused artifacts, destination routes, shared shell controls, responsive observations, data-formatting rows, and architecture summary blocks are excluded from canonical counts.

## 6. Route parameter handling

| Concern | Current behavior | Status |
|---|---|---|
| Route registration | `App.tsx` registers child path `"tokens/:address"` with `TokenOverviewPage` | `FRONTEND_ACTIVE` |
| Param read | `TokenOverviewPage` reads `address` through `useParams<{ address: string }>()` | `FRONTEND_ACTIVE` |
| Missing param branch | If `!address`, the component returns `<>Missing token address</>` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Address validation | No Solana/base58 or token-address validation was confirmed in the route component | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Address normalization | No trimming, casing normalization, or canonicalization was confirmed before API calls | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Address change behavior | Data hooks and child props update on rerender when the path param changes | `FRONTEND_ACTIVE` |
| Local state on address change | Page and chart local state generally persists unless a child effect resets it | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

The address is passed directly to data hooks and child components, including token details, holders, market data, chart data, markets table, historical-data link, and deferred news/AI boundaries.

## 7. Token identity and metadata

| Identity or metadata concern | Implementation | Behavior | Limitation |
|---|---|---|---|
| Page hero identity | `TokenOverviewPage` | Hero title uses `details?.name ?? "Token Overview"` and includes static contextual copy | Copy mentions holders, news, and AI context even though news/AI internals are deferred. |
| Sidebar token identity | `TokenHeader` | Displays token image, symbol, name, and optional rank | `marketCapRank` is passed as `null` from the overview page. |
| Token image | `TokenHeader` | Uses detail image URL or an identicon fallback seeded by address | Fallback hides whether the source image is missing or failed. |
| Header self-link | `TokenHeader` | Token image links to `/tokens/:address` | Self-link does not add new route behavior. |
| Compact header mode | `TokenHeader compact` | Hides address row, copy button, token age, and external header action buttons | External metadata links still appear in `TokenOverviewStats` when available. |
| Info links | `TokenOverviewStats` | Renders Website, Explorer, Twitter, Discord, and Telegram links when fields exist | Homepage parsing is not guarded like explorer parsing. |
| Explorer links | `TokenOverviewStats` internal dropdown | Attempts to parse and filter explorer URLs | Invalid explorer URLs are skipped. |

## 8. Token statistics and summary blocks

| Statistics block | Source fields | Frontend behavior | Limitation |
|---|---|---|---|
| Current price | `market.priceUsd` | Formats current price as currency in `TokenOverviewStats` | Missing values rely on formatter behavior and fallbacks. |
| Displayed price change | `market.priceChangePercentage24h` or chart-derived `customPriceChange` | Shows 24h change by default, or chart-range change after a non-24h range is selected | Chart-derived change requires at least two chart points. |
| 24h range | `low24h`, `high24h`, `priceUsd` | Renders low/high values and a clamped indicator on the range bar | Missing or invalid ranges fall back to a zeroed internal range. |
| Market cap and FDV | `market.marketCap`, `market.fullyDilutedValuation` | Displays compact currency values | Accuracy depends on backend-provided values. |
| Volume | `market.totalVolume` | Displays compact currency value | Missing values fall back through formatter behavior. |
| Supply metrics | `circulatingSupply`, `totalSupply`, `maxSupply` | Displays compact supply; null max supply renders infinity | No supply consistency validation is performed. |
| ATH/ATL | `ath`, `atl`, date and change fields | Displays historical high/low values with trend and date context | Missing fields partially suppress context. |
| About/Stats cards | `TokenInsightTabs` derived from `market` | Renders volume, ATH/ATL, market cap, and FDV narrative cards | If no card fields are present, no dedicated empty text is shown. |

## 9. Token charts

| Chart | Implementation | Trigger | Data source | Status | Limitation |
|---|---|---|---|---|---|
| Price line chart | `TokenOverviewChart`, `ReactECharts` | Default chart mode and price metric | Token market chart endpoint selected by range | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Request failures are logged or collapsed into no-data behavior. |
| Market-cap line chart | `TokenOverviewChart`, `ReactECharts` | User selects market-cap metric | Same chart response transformed into market-cap series | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Requires market-cap points in response; no separate error state. |
| Candle chart | `TokenOverviewChart`, `GeckoTerminalChart` | User selects candle mode | Token pools request selects top-liquidity pool, then iframe chart renders by pool address | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Depends on pool data and external iframe availability. |
| Holder distribution donut | `TokenInsightTabs`, `ReactECharts` | User views Holders tab | Holder percentage data from holder request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Distribution is derived from currently provided holder rows; invalid percentages can produce invalid output. |
| Chart news markers | `TokenOverviewChart` news-marker subsystem | Range and news state changes | Deferred chart-news service | Deferred boundary | Excluded from core chart capability counts. |

## 10. Token markets and pools

`TokenMarketsTable` is the active core markets/pools table for `/tokens/:address`.

| Markets/pools behavior | Implementation | Behavior | Limitation |
|---|---|---|---|
| Pool request | `useGet(client.api.tokens[":address"].pools, ...)` | Requests pools for the current token address | Errors are not rendered distinctly. |
| Pair metadata request | `useGet(client.api.tokens.meta[":addresses"], ...)` | Requests metadata for unique base/quote token addresses from pool rows | Metadata loading is not shown separately. |
| Exchange display | `ExchangeCell` | Displays DEX label and proxied image with fallback initial | Image proxy failures fall back visually. |
| Pair display | React Router `Link` | Displays base and quote token images/symbols and links to pool detail | No route-level validation before building link. |
| Price/change/volume/liquidity/txns | `TokenMarketsTable` row mapping | Formats values locally and uses `TrendNum` for 24h change | Nulls frequently become zero or empty display depending on row field. |
| Pagination | `Tble enablePagination pageSize={16}` | Paginates table rows locally | Page state is local; no server pagination. |
| Sorting/filtering | `Tble` supports configs, but `TokenMarketsTable` passes none | No active sort/filter controls in this table | Users cannot sort or filter core markets table from this route. |

## 11. Recent token transactions

No Recent Transactions block is rendered by the active `/tokens/:address` Token Overview route.

`client/src/components/token/RecentTransactions.tsx` exists and is exported from the token component barrel, but the confirmed active caller is the pool-detail page `client/src/pages/token/index.tsx`, which is outside this phase. Therefore recent-transaction behavior for Token Overview is classified as not active for the core route, not as a broken visible feature.

## 12. Top holders

| Holder behavior | Implementation | Behavior | Limitation |
|---|---|---|---|
| Holder request | `useTokenOverviewData` | Fetches holders by token address | Holder error is not included in page-level error. |
| Holders tab | `TokenInsightTabs` | Displays holder content when active tab is Holders | Holder loading uses `result.isFirstLoad`, not the holder hook's own loading flag. |
| Distribution chart | `TokenInsightTabs` | Groups holder percentages into top 10, 11-25, 26-50, and remaining | Derived from available rows only. |
| Holder table | `TopHoldersTable` | Displays the first 10 holder rows | Additional holders are not paginated or exposed here. |
| Holder amount | `TopHoldersTable` | Formats balance as compact decimal | Missing balance renders as 0. |
| Holder share | `TopHoldersTable` | Converts percentage with `Number(...).toFixed(2)` | Missing/invalid percentage can render invalid text. |
| Holder navigation | Carbon `Link` with `href` | Links to `/wallets/:holderAddress` | Destination page is out of scope. |

## 13. Core Token Overview frontend API calls

| Trigger | Frontend caller | API method or URL source | Request input | Response usage | Core/deferred |
|---|---|---|---|---|---|
| `/tokens/:address` mounts or address changes | `useTokenOverviewData` | `client.api.tokens.details[":addresses"].$get` | Param `{ addresses: address }` | Builds token details/meta object | Core |
| `/tokens/:address` mounts or address changes | `useTokenOverviewData` | `client.api.tokens.holders[":address"].$get` | Param `{ address }` | Supplies holders table and distribution chart | Core |
| `/tokens/:address` mounts or address changes | `useTokenOverviewData` | `client.api.tokens.markets[":addresses"].$get` | Param `{ addresses: address }` | Supplies market/statistics data | Core |
| Chart render or 1-day range selected | `TokenOverviewChart` | `client.api.tokens.markets.chart[":address"].$get` | Param `{ address }` | Supplies intraday chart points | Core |
| Chart range selected for <= 90 days | `TokenOverviewChart` | `client.api.tokens.markets.chart[":address"].hourly.$get` | Param `{ address }`, query `{ days }` | Supplies hourly chart points | Core |
| Chart range selected for > 90 days | `TokenOverviewChart` | `client.api.tokens.markets.chart[":address"].daily.$get` | Param `{ address }`, query `{ days }` | Supplies daily chart points | Core |
| Candle mode selected | `TokenOverviewChart` | `client.api.tokens[":address"].pools.$get` | Param `{ address }` | Selects highest-liquidity pool for candle chart | Core |
| Markets section renders | `TokenMarketsTable` | `client.api.tokens[":address"].pools.$get` | Param `{ address }` | Supplies markets/pools table rows | Core |
| Markets pool rows exist | `TokenMarketsTable` | `client.api.tokens.meta[":addresses"].$get` | Param `{ addresses }` | Supplies base/quote token images and metadata | Core |
| Exchange image renders | `ExchangeCell` | `client.api.misc["image-proxy"].$url(...)` | Query `{ url: dexImageUrl }` | Browser image load for DEX logo | Core support |
| Global prices section renders | `GlobalPrices` | `client.api.misc["exchange-rates"].$get` | None | Supplies fiat conversion rates | Core |
| Chart news marker lifecycle | `TokenOverviewChart` | `getTokenChartNewsEvents(...)` | Token address and timeframe | Supplies news markers/summaries | Deferred |
| Supplemental tokenomics/investors lifecycle | `TokenInsightTabs` | Raw external metadata fetch | Token symbol/name-derived asset | Supplies conditional tokenomics/investors tabs | Deferred |
| Token news feed lifecycle | `NewsTab` | News component internals | Token address/details | Supplies news articles | Deferred |
| Ask Yoca AI lifecycle | `TokenAIChat` | AI component internals | Token address/symbol/name/timeframe | Supplies token AI chat | Deferred |

## 14. Core Token Overview state management

| State | Owner | Purpose | Persistence |
|---|---|---|---|
| `address` route param | React Router / `TokenOverviewPage` | Drives all core token data and route links | URL path |
| `activeTab` | `TokenOverviewPage` | Tracks active Overview/Markets/News section tab | Local only |
| `customPriceChange` | `TokenOverviewPage`, updated by `TokenOverviewChart` | Lets stats card show selected chart-range price change | Local only |
| Section refs | `TokenOverviewPage` | Scroll targets for tabs | Local only |
| Chart `mode` | `TokenOverviewChart` | Switches price/market-cap/candle presentation | Local only |
| Chart `lineMode` | `TokenOverviewChart` | Switches price versus market-cap series | Local only |
| Chart `range` | `TokenOverviewChart` | Chooses chart endpoint granularity and timeframe | Local only |
| Chart series state | `TokenOverviewChart` | Stores transformed price and market-cap points | Local only |
| Chart loading state | `TokenOverviewChart` | Drives chart loading/empty UI | Local only |
| Insight active tab | `TokenInsightTabs` | Switches About/Stats, Holders, and conditional supplemental tabs | Local only |
| Markets table pagination | `Tble` | Tracks page and page size for pool rows | Local only |
| Global prices visible count | `GlobalPrices` | Controls fiat conversion "show more" expansion | Local only |

No core Token Overview state was confirmed as persisted to local storage, session storage, or query parameters.

## 15. Core navigation

| Source block | Destination route or URL | Entity | Trigger | Status |
|---|---|---|---|---|
| Token header image | `/tokens/:address` | Current token | User clicks token image | `FRONTEND_ACTIVE` |
| Historical Data tab-link | `/historical-data/:address` | Current token | User clicks Historical Data | `FRONTEND_ACTIVE` |
| Markets table pair row | `/tokens/:address/:poolAddress` | Selected pool | User clicks pool/pair cell | `FRONTEND_ACTIVE` |
| Top holders table address | `/wallets/:holderAddress` | Holder wallet | User clicks holder address | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token metadata website/community links | External URLs | Token metadata destinations | User clicks info links | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Wash-trading action | Wash-trading/auth/upgrade flow boundary | Current token | User clicks AI wash-trading button | Deferred boundary |
| Token news cards | News feed internals | Token articles | User interacts with `NewsTab` | Deferred boundary |
| Ask Yoca chat | AI chat internals | Current token | User interacts with `TokenAIChat` | Deferred boundary |

Destination page internals are not audited in this phase.

## 16. Loading, empty, error, and partial states

| State type | Where implemented | Behavior | Limitation |
|---|---|---|---|
| Initial token load | `TokenOverviewPage` | Shows sidebar and main-rail skeleton cards while `result.isFirstLoad` is true | Uses details/market loading; holders loading is not included. |
| Page-level error | `useTokenOverviewData`, `TokenOverviewPage` | Error is returned by the hook | The page does not render a distinct error screen or message from `result.error`. |
| Missing details/market data | `useTokenOverviewData` | Keeps `data` null and `isFirstLoad` true until both are available | Failed requests can resemble continued loading. |
| Chart loading | `TokenOverviewChart` | Shows loading state or ECharts loading overlay | Existing data can remain while new range loads. |
| Chart empty | `TokenOverviewChart` | Shows no-data state when no series points exist | Message can imply missing chart support even when the cause is request failure. |
| Chart request failure | `TokenOverviewChart` | Sets chart arrays empty and logs/collapses error | No distinct user-facing error. |
| Candle no pool | `TokenOverviewChart` | Shows no-candle-pool empty message | Pool request errors are not distinguished from empty pool data. |
| Markets loading | `TokenMarketsTable`, `Tble` | Shows table loading state while pools load | Pair-token metadata loading is not surfaced. |
| Markets empty/error | `TokenMarketsTable`, `Tble` | Empty rows render table no-data state | Pool request errors are not distinct. |
| Holders loading | `TokenInsightTabs`, `TopHoldersTable` | Shows holder/table loading from passed `holdersLoading` | Loading source can become false before holder request completes. |
| Holders empty/error | `TopHoldersTable` | Empty rows render no-data state | Holder request errors are not distinct. |
| Image fallback | `TokenHeader`, `TknImg`, `ExchangeCell` | Identicon, token placeholder, or DEX initial is shown | Fallbacks can hide upstream image data quality issues. |
| Global prices failure | `GlobalPrices` | Exchange-rate fetch failure returns null/empty display | No user-facing error. |

## 17. Data formatting and derived values

| Displayed or derived value | Source field or fields | Frontend transformation/helper | Missing or invalid-value behavior | Capability ID |
|---|---|---|---|---|
| Token image | `details.image`, `address` | Header image or identicon fallback | Missing image uses identicon | `TOKEN-CORE-04` |
| Token symbol/name | `details.symbol`, `details.name` | Rendered directly in header and hero | Missing name falls back to generic title in hero | `TOKEN-CORE-04` |
| Price | `market.priceUsd` | `fmt.num.currency(...)` | Depends on formatter/fallback behavior | `TOKEN-CORE-05` |
| Display price change | `market.priceChangePercentage24h`, chart-derived first/last prices | Uses 24h by default or chart custom range label | Fewer than two chart points prevents custom percentage | `TOKEN-CORE-05` |
| 24h range position | `low24h`, `high24h`, `priceUsd` | Computes clamped percent position from expanded range | Missing values produce fallback range behavior | `TOKEN-CORE-05` |
| Market cap/FDV/volume | Market numeric fields | Compact currency formatting | Missing values render via local helper behavior | `TOKEN-CORE-05` |
| Supply values | Supply numeric fields | Compact supply formatting; null max supply renders infinity | Does not validate supply relationships | `TOKEN-CORE-05` |
| ATH/ATL dates | Date strings | Date formatting in stats card | Missing date suppresses date context | `TOKEN-CORE-05` |
| Line chart points | Chart response points | Converts timestamps to milliseconds and maps price/market-cap arrays | Invalid or missing points are filtered through array assumptions | `TOKEN-CORE-07` |
| Chart custom change | First/last chart prices | Computes absolute and percentage delta | Requires at least two valid prices | `TOKEN-CORE-08` |
| Candle top pool | Pool rows and liquidity | Sorts pools by liquidity and selects first pool | Empty pool list prevents candle chart | `TOKEN-CORE-09` |
| Holder distribution | Holder percentages | Groups top 10, 11-25, 26-50, and rest | Invalid percentages become zero in distribution math | `TOKEN-CORE-11` |
| Holder table percentage | `holder.percentage` | `Number(...).toFixed(2)` | Invalid input can render invalid text | `TOKEN-CORE-11` |
| Markets pair name | Pool row and token metadata | Combines base/quote symbols and images | Missing data falls back to Unknown or placeholder images | `TOKEN-CORE-12` |
| Markets txns | `txns24hBuys`, `txns24hSells` | Sums buys and sells when both exist | Missing side renders null/empty formatted value | `TOKEN-CORE-12` |
| Global fiat prices | `market.priceUsd`, exchange rates | Multiplies USD price by rate versus USD | Missing rate or price hides/empties rows | `TOKEN-CORE-14` |

This section documents frontend formatting and derivation only. It does not evaluate financial accuracy.

## 18. Responsive behavior

Responsive behavior in the active Token Overview page is CSS-driven. No mobile-specific data fetching, route registration, or separate mobile data model was found in the inspected active core files.

| Token Overview block | Desktop behavior | Narrow/mobile behavior | Same data flow used | Confirmed limitation |
|---|---|---|---|---|
| Page shell and grid | `overviewShell` uses sidebar plus main content grid | At `max-width: 1180px`, layout becomes a single column | Yes | Sidebar content moves above main content; no separate mobile route. |
| Page padding and hero | Page uses larger section spacing and hero copy | At `max-width: 768px`, spacing and hero typography are reduced | Yes | Presentation-only adaptation. |
| Token header | Uses flexible rows and compact header mode | Header rows wrap at smaller widths | Yes | Compact mode already hides several controls regardless of viewport. |
| Stats card | Cards/rows wrap with local dropdown constraints | At mobile breakpoints, stats sections compress and wrap | Yes | No alternate mobile-specific stats model. |
| Chart controls | Toolbar wraps; chart area is contained | At `max-width: 768px`, range buttons can scroll horizontally | Yes | No dedicated mobile chart simplification was confirmed. |
| Candle iframe | Fixed-height chart embed inside chart shell | Same iframe is used on narrow screens | Yes | External iframe responsiveness depends on embedded content. |
| Insight tabs and holders | Holders content uses one column by default and wider two-column layout at `min-width: 900px` | Narrow layout remains single column | Yes | Distribution and table remain separate vertical blocks. |
| Markets table | `Tble` wraps controls and table shell uses horizontal overflow | Pagination adapts at `max-width: 720px` | Yes | Table remains table-based; no mobile card layout was confirmed. |
| Global prices | Grid uses six columns on wider screens | At `max-width: 560px`, rows reduce to three columns | Yes | Some conversion context is visually compressed rather than redesigned. |

## 19. Unused or disconnected core Token code

These artifacts are token-related and present in the repository, but no active render/call chain from `/tokens/:address` was confirmed.

| Candidate | File | Relationship to Token area | Active `/tokens/:address` render/call found | Classification |
|---|---|---|---|---|
| `MarketStats` | `client/src/components/token/MarketStats.tsx` | Pool-detail/token market stats component | No. Active caller found in `client/src/pages/token/index.tsx`, the pool-detail page. | `FRONTEND_UNUSED` for core Token Overview |
| `PoolSelector` | `client/src/components/token/PoolSelector.tsx` | Pool-detail selector component | No. Active caller found in pool-detail page. | `FRONTEND_UNUSED` for core Token Overview |
| `RecentTransactions` | `client/src/components/token/RecentTransactions.tsx` | Token transaction table component | No. Active caller found in pool-detail page. | `FRONTEND_UNUSED` for core Token Overview |
| `TokenChart` | `client/src/components/token/TokenChart.tsx` | Pool-detail chart component | No. Active caller found in pool-detail page. | `FRONTEND_UNUSED` for core Token Overview |
| `TopHolders` | `client/src/components/token/TopHolders.tsx` | Pool-detail holder component | No. Token Overview uses `TopHoldersTable` instead. | `FRONTEND_UNUSED` for core Token Overview |
| `VolatilitySignals` | `client/src/components/token/VolatilitySignals.tsx` | Pool-detail volatility component | No. Active caller found in pool-detail page. | `FRONTEND_UNUSED` for core Token Overview |
| Standalone `InfoDropdown` | `client/src/components/token/InfoDropdown.tsx` | Token info dropdown helper | No. `TokenOverviewStats` defines and uses its own internal `InfoDropdown`. | `FRONTEND_UNUSED` for core Token Overview |
| `InfoTooltip` | `client/src/components/token/InfoTooltip.tsx` | Token info tooltip helper | No active core Token Overview caller found. | `FRONTEND_UNUSED` for core Token Overview |

Unused or disconnected core Token artifact count: 8.

Components intentionally excluded from this list: `TokenAIChat`, `NewsTab`, chart-news services, wash-trading action internals, and supplemental tokenomics/investors components, because those are deferred feature boundaries rather than unused core artifacts.

## 20. Frontend-only core Token data flows

### Flow A - Open Token Overview

1. User navigates to `/tokens/:address`.
2. Router renders `TokenOverviewPage`.
3. The page reads `address` from `useParams`.
4. If address is missing, the page returns a plain missing-address fragment.
5. If address exists, `useTokenOverviewData(address)` starts details, holders, and market requests.
6. While required details/market data is missing, the page renders skeletons.
7. When data is available, the page renders token identity, stats, chart, insight tabs, markets, optional global prices, and deferred feature boundaries.

### Flow B - Load and display token statistics

1. Token details and market data resolve.
2. `TokenOverviewPage` passes `details` and `market` to `TokenHeader` and `TokenOverviewStats`.
3. Header renders compact identity.
4. Stats card formats price, change, supply, market cap, FDV, volume, 24h range, ATH/ATL, and metadata links.
5. If the chart later reports a custom range change, the stats card displays that custom change instead of the 24h label.

### Flow C - Use the overview chart

1. User views the default overview chart.
2. `TokenOverviewChart` fetches chart data for the selected range.
3. The response is transformed into price and market-cap series.
4. User can switch price versus market-cap line mode.
5. User can change the range, which changes the chart endpoint and recomputes custom price change.
6. User can switch to candle mode.
7. Candle mode fetches pools, selects the top-liquidity pool, and renders the iframe chart boundary.

### Flow D - Browse holders

1. User clicks the Holders insight tab.
2. `TokenInsightTabs` uses holder data already fetched by the page hook.
3. It derives holder distribution groups and renders a donut chart when possible.
4. `TopHoldersTable` renders up to 10 holders.
5. User can click a holder address to move to `/wallets/:holderAddress`.

### Flow E - Browse markets and pools

1. Markets section renders `TokenMarketsTable`.
2. The table fetches token pools by address.
3. It derives a unique set of base/quote token addresses and fetches metadata for those tokens.
4. Rows render exchange, pair, price, 24h change, volume, liquidity, and transactions.
5. `Tble` paginates rows locally.
6. User clicks a pair row to navigate to `/tokens/:address/:poolAddress`.

### Flow F - Open historical data

1. User clicks the Historical Data link in `TokenTabs`.
2. The link opens `/historical-data/:address` in a new tab.
3. Flow stops at the historical-data route boundary.

### Flow G - View global prices

1. If `market.priceUsd` is not null, `GlobalPrices` renders.
2. `useExchangeRates` requests exchange rates.
3. The component multiplies USD token price by allowed fiat rates.
4. It renders an initial page of currencies and can show more rows locally.
5. Failed or missing exchange-rate data produces no distinct error UI.

## 21. Architecture-ready Token Overview core summary

### Confirmed Token Overview frontend blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Token Overview page container | `TOKEN-CORE-01`, `TOKEN-CORE-03`, `TOKEN-CORE-06`, `TOKEN-CORE-19` | `App.tsx`, `TokenOverviewPage`, `PageWrapper`, page refs and skeletons | Owns route entry, address handoff, page layout, section navigation, and page-level loading/fallback behavior | High-level frontend page node. |
| Token identity and statistics | `TOKEN-CORE-04`, `TOKEN-CORE-05`, `TOKEN-CORE-18` | `TokenHeader`, `TokenOverviewStats` | Displays token identity, price/statistics, metadata links, and chart-derived custom range change | Core token summary block. |
| Token charting | `TOKEN-CORE-07`, `TOKEN-CORE-08`, `TOKEN-CORE-09` | `TokenOverviewChart`, `ReactECharts`, `GeckoTerminalChart` | Renders price/market-cap line chart and candle iframe mode | Core data visualization block, with chart-news deferred boundary. |
| Token insights and holders | `TOKEN-CORE-10`, `TOKEN-CORE-11`, `TOKEN-CORE-16` | `TokenInsightTabs`, `TopHoldersTable`, holders donut chart | Renders about/stat cards, holder distribution, and top-holder table/navigation | Core holder and summary insight block, with supplemental tokenomics/investors deferred. |
| Token markets and pools | `TOKEN-CORE-12`, `TOKEN-CORE-13`, `TOKEN-CORE-15` | `TokenMarketsTable`, `Tble`, `ExchangeCell` | Fetches and renders pool markets with local pagination and pool-detail navigation | Core pool discovery block. |
| Global price conversions | `TOKEN-CORE-14` | `GlobalPrices` | Converts USD token price into allowed fiat currencies | Supplemental core pricing block. |

### Token Overview frontend-to-backend boundaries

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| Page data bootstrap | Token details | Hono RPC `client.api.tokens.details[":addresses"].$get` | Fetch token metadata/details | Page mount and address changes | `client/src/pages/token-overview/index.tsx` |
| Page data bootstrap | Token market data | Hono RPC `client.api.tokens.markets[":addresses"].$get` | Fetch token market/stat fields | Page mount and address changes | `client/src/pages/token-overview/index.tsx` |
| Holders | Token holders | Hono RPC `client.api.tokens.holders[":address"].$get` | Fetch holder rows for table and distribution | Page mount and address changes | `client/src/pages/token-overview/index.tsx` |
| Charting | Token market chart | Hono RPC chart, hourly chart, or daily chart endpoint | Fetch chart points for selected range | Chart range and address changes | `TokenOverviewChart.tsx` |
| Candle mode | Token pools | Hono RPC `client.api.tokens[":address"].pools.$get` | Select pool for candle iframe | User selects candle mode | `TokenOverviewChart.tsx` |
| Markets table | Token pools | Hono RPC `client.api.tokens[":address"].pools.$get` | Fetch pool rows | Markets table render/address changes | `TokenMarketsTable.tsx` |
| Markets table | Token metadata | Hono RPC `client.api.tokens.meta[":addresses"].$get` | Fetch base/quote token metadata for rows | Pool rows available | `TokenMarketsTable.tsx` |
| Exchange logos | Image proxy | Hono RPC URL builder for image proxy | Load DEX logo image through proxy URL | Exchange cell render | `TokenMarketsTable.tsx` |
| Global prices | Exchange rates | Hono RPC `client.api.misc["exchange-rates"].$get` | Fetch fiat exchange rates | Global prices render | `GlobalPrices.tsx` |

### Token Overview route boundaries

| Source block | Destination route | Entity | Trigger |
|---|---|---|---|
| Historical Data link | `/historical-data/:address` | Current token | User clicks Historical Data in `TokenTabs`. |
| Markets table pair link | `/tokens/:address/:poolAddress` | Selected pool | User clicks a pool/pair row. |
| Top holders address link | `/wallets/:holderAddress` | Holder wallet | User clicks holder address. |
| Header self-link | `/tokens/:address` | Current token | User clicks compact token image. |

### Capabilities eligible for backend verification

Only canonical IDs that cross the frontend/backend boundary or depend on backend-provided data are listed:

1. `TOKEN-CORE-02` Core token data bootstrap
2. `TOKEN-CORE-05` Token statistics and metadata card
3. `TOKEN-CORE-07` Price and market-cap line chart
4. `TOKEN-CORE-09` Candle chart mode
5. `TOKEN-CORE-10` About/summary insight cards
6. `TOKEN-CORE-11` Holder table and distribution chart
7. `TOKEN-CORE-12` Token markets and pools table
8. `TOKEN-CORE-14` Global fiat price conversions
9. `TOKEN-CORE-18` External token metadata links
10. `TOKEN-CORE-19` Core loading, empty, and fallback behavior

## 22. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should `/tokens/:address` validate address format before issuing API calls? | The route currently passes the param directly to all core requests | Token route hardening |
| Should token details selection guard missing `data[0]`, `meta`, or `details`? | Current select callback assumes response shape | Token API contract verification |
| Should holder loading/error be tracked independently from details/market loading? | Holder request is not included in the main loading/error calculation | Token UX hardening |
| Should page-level token data errors render a dedicated error state? | `result.error` is returned but not visibly rendered | Token UX hardening |
| Should chart requests use cancellation or stale-response protection when address/range changes quickly? | Chart fetch effect does not show a cancellation guard in the inspected source | Token chart hardening |
| Should chart no-data distinguish unsupported chart data from failed requests? | Chart errors and empty responses can show the same no-data state | Token chart UX verification |
| Should candle mode show pool-request errors separately from no-pool state? | Candle pool fetch error is not distinct in current UI | Token chart UX verification |
| Should top holders table support pagination or a larger holder list? | Current table slices to the first 10 holders | Token holders product review |
| Should holder percentage formatting guard invalid values? | `Number(...).toFixed(2)` can render invalid text | Token holders hardening |
| Should markets table support sorting/filtering like the Market page table? | `Tble` supports table capabilities, but Token markets table does not pass sort/filter configs | Token markets UX review |
| Should global price exchange-rate failures render an explicit error or fallback message? | Exchange-rate failures currently produce no distinct visible state | Token pricing UX verification |
| Should malformed homepage metadata be safely ignored like invalid explorer URLs? | Homepage hostname parsing is less defensive | Token metadata hardening |
| Should deferred chart news markers, Token AI chat, token news, wash-trading, and tokenomics/investor tabs be audited as separate feature phases? | These are active boundaries but intentionally excluded from the core audit | Token deferred-feature audits |

## 23. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2A_MARKET_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/pages/token-overview/index.module.scss`
- `client/src/components/token/index.ts`
- `client/src/components/token/TokenHeader.tsx`
- `client/src/components/token/TokenHeader.module.scss`
- `client/src/components/token/TokenOverviewStats.tsx`
- `client/src/components/token/TokenOverviewStats.module.scss`
- `client/src/components/token/TokenTabs.tsx`
- `client/src/components/token/TokenOverviewChart.tsx`
- `client/src/components/token/TokenOverviewChart.module.scss`
- `client/src/components/charts/GeckoTerminalChart.tsx`
- `client/src/components/token/TokenInsightTabs.tsx`
- `client/src/components/token/TokenInsightTabs.module.scss`
- `client/src/components/token/TokenMarketsTable.tsx`
- `client/src/components/token/TokenMarketsTable.module.scss`
- `client/src/components/token/GlobalPrices.tsx`
- `client/src/components/token/GlobalPrices.module.scss`
- `client/src/components/token/TopHoldersTable.tsx`
- `client/src/components/token/TopHoldersTable.module.scss`
- `client/src/components/Tble.tsx`
- `client/src/components/Tble.module.scss`
- `client/src/components/TknImg.tsx`
- `client/src/components/TrendNum.tsx`
- `client/src/components/token/RecentTransactions.tsx`
- `client/src/components/token/TopHolders.tsx`
- `client/src/components/token/MarketStats.tsx`
- `client/src/components/token/PoolSelector.tsx`
- `client/src/components/token/TokenChart.tsx`
- `client/src/components/token/VolatilitySignals.tsx`
- `client/src/components/token/InfoDropdown.tsx`
- `client/src/components/token/InfoTooltip.tsx`
- `client/src/pages/token/index.tsx`
