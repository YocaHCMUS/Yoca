# Yoca Pool and Historical Data Frontend Architecture Audit

## 1. Scope

This high-level audit covers the pool-detail and historical-data frontend as one subsystem, centered on the active routes `/tokens/:address/:poolAddress` and `/historical-data/:address`.

In scope:

- Active pool-detail and historical-data route registration
- Pool identity, summary, liquidity, volume, pricing, transactions, and chart surfaces
- Historical token data view, range state, and table rendering
- Token, pool, and timeframe context flow
- Major frontend API boundaries used by these pages
- Token, wallet, pool, and transaction navigation from the active surfaces
- Wash-trading entry from the pool-detail header when actively connected
- Duplicated or incomplete pool/history implementations

Out of scope:

- Backend route implementations, provider internals, database schemas, detailed chart formulas, every table field, every response field, detailed CSS, alert processing, AI provider internals, deployment, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`, `02C_WALLET_FRONTEND_ARCHITECTURE.md`, `02D_ALERTS_FRONTEND_ARCHITECTURE.md`, and `02E_WASH_TRADING_FRONTEND_ARCHITECTURE.md`.

## 2. Architecture summary

The subsystem is split into two active surfaces:

- A pool-detail page at `/tokens/:address/:poolAddress`
- A historical-data page at `/historical-data/:address`

The pool-detail page is the richer workspace. It combines token identity, pool summary, pool selection, market stats, top holders, news, volatility signals, token AI chat, and recent transactions into one route-local analysis view. The historical-data page is narrower: it loads token metadata, lets the user change a range, and renders a paginated history table.

The active pool page also owns the connected wash-trading entry point through `TokenHeader` with `sidebar` enabled. No active alert-entry or watchlist entry was confirmed from these pages.

## 3. Active routes

| Route | Registered component | Reachability | Notes |
|---|---|---|---|
| `/tokens/:address/:poolAddress` | `TokenPage` | Active and directly reachable | Primary pool-detail route, parameterized by token address and pool address. |
| `/historical-data/:address` | `HistoricalDataPage` | Active and directly reachable | Historical data route for a single token address. |

No separate root pool-history route was confirmed. The active pool-detail route is token-and-pool-address driven, and the historical-data route is token-address driven.

## 4. Main render architecture

### `/tokens/:address/:poolAddress`

```text
/tokens/:address/:poolAddress
└─ TokenPage
   ├─ Pool intelligence hero
   ├─ TokenHeader (sidebar mode)
   ├─ PoolSelector
   ├─ MarketStats
   ├─ TopHolders
   ├─ NewsTab
   ├─ TokenChart
   ├─ VolatilitySignals
   ├─ TokenAIChat
   └─ RecentTransactions
```

### `/historical-data/:address`

```text
/historical-data/:address
└─ HistoricalDataPage
   ├─ TokenHeader
   ├─ Range selector
   └─ Historical table
```

## 5. Major frontend capabilities

| ID | Capability | Main components | Classification | Major limitation |
|---|---|---|---|---|
| `POOL-HIST-01` | Pool-detail route and page shell | `App.tsx`, `TokenPage` | `ACTIVE` | The page is active but requires both token and pool addresses. |
| `POOL-HIST-02` | Pool identity and summary | `TokenPage` hero, `TokenHeader`, `PoolSelector` | `ACTIVE_WITH_LIMITATIONS` | Pool identity is assembled from multiple API results and route params. |
| `POOL-HIST-03` | Pool liquidity, volume, pricing, and chart surfaces | `TokenPage` hero, `MarketStats`, `TokenChart`, `VolatilitySignals` | `ACTIVE` | Active, but the charts and stats depend on async data from the configured API backend. |
| `POOL-HIST-04` | Pool transactions and wallet drill-down | `RecentTransactions` | `ACTIVE` | Transaction rows are active, but navigation is limited to wallet links and external explorers. |
| `POOL-HIST-05` | Historical-data route and table workspace | `HistoricalDataPage`, `Tble` | `ACTIVE` | The route is active and table-driven, but its scope is token history rather than a full pool workspace. |
| `POOL-HIST-06` | Timeframe and filter state | `HistoricalDataPage`, `PoolSelector`, `RecentTransactions`, `VolatilitySignals` | `ACTIVE_WITH_LIMITATIONS` | Filter and range state are local to each page surface rather than shared across the subsystem. |
| `POOL-HIST-07` | Wash-trading entry from pool detail | `TokenHeader` in sidebar mode | `ACTIVE_WITH_LIMITATIONS` | The action is active, but it is an entry boundary rather than a native pool feature. |
| `POOL-HIST-08` | Loading and error boundary | `TokenPage`, `HistoricalDataPage` | `ACTIVE_WITH_LIMITATIONS` | Failures collapse into local loading states or fallback messages instead of a unified subsystem error shell. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `ACTIVE` | 4 |
| `ACTIVE_WITH_LIMITATIONS` | 4 |
| `BROKEN` | 0 |
| `ROUTE_INACTIVE` | 0 |
| `NOT_IMPLEMENTED` | 0 |
| `UNCERTAIN` | 0 |
| **Total major pool and historical-data capabilities** | 8 |

## 6. Pool and token context flow

The pool-detail page carries both token and pool identity through the route:

- `address` identifies the token
- `poolAddress` identifies the selected pool
- `PoolSelector` switches the active pool by navigating to another `/tokens/:address/:poolAddress` route
- `TokenHeader` receives the token identity in sidebar mode
- `MarketStats`, `TokenChart`, `VolatilitySignals`, `TokenAIChat`, and `RecentTransactions` all consume the current token or pool context

The historical-data page carries only the token address:

- `address` comes from the route param
- A local `selectedRange` controls how many days are requested
- `TokenHeader` renders from the loaded token metadata once it arrives

The subsystem does not confirm a shared route store. Context flows through route params, local component state, and the data returned by page-level fetches.

## 7. Frontend API boundaries

| Frontend block | API category | Communication | Request purpose | Trigger |
|---|---|---|---|---|
| Token metadata | Token details | `client.api.tokens.details[":addresses"]` via `useGet` | Load token identity and base metadata | Pool-detail and historical-data pages mount. |
| Top pools | Token pools list | `client.api.tokens[":address"].pools` via `useGet` | Load selectable pool candidates | Pool-detail page mount. |
| Pool data | Pool detail | `client.api.tokens.pools[":addresses"]` via `useGet` | Load the selected pool record | Pool-detail page mount or pool change. |
| Pool trades | Pool transaction feed | `client.api.tokens.pools.trades[":address"]` via `useGet` | Load recent pool trades for the selected pool | Pool-detail page mount or pool change. |
| Holders and holder stats | Token holders | `client.api.tokens.holders[":address"]` and `client.api.tokens.holders.stats[":addresses"]` via `useGet` | Load pool-adjacent token holder context | Pool-detail page mount. |
| Market data | Token markets | `client.api.tokens.markets[":addresses"]` via `useGet` | Load market summary context | Pool-detail page mount. |
| Historical series | Token history | `client.api.tokens.history[":address"]` | Load token history rows for the selected range | Historical-data page mount or range change. |
| Token AI chat | Token AI analysis | `TokenAIChat` request path | Load an AI response grounded in the active token context | User submits a question from the embedded Token AI Chat. |
| Volatility signals | Volatility/news analysis | `VolatilitySignals` request path | Load signal events and optional summaries | Pool-detail page mount and range/threshold changes. |

Request behavior summary:

- Pool-detail data uses `useGet`-driven fetches for token, pool, market, holder, and trade context
- Historical data uses a direct API call with an `AbortController` guard
- Pool changes rerun pool-scoped fetches and reset local pair selection
- Historical range changes rerun the history request
- No polling was confirmed in either route
- No shared subsystem-level cache was confirmed beyond page-local hooks and request helpers

## 8. Historical-data architecture

`HistoricalDataPage` is a separate route-local workspace with a simple control surface:

- It loads token metadata to render the compact `TokenHeader`
- It offers fixed range buttons for 7D, 14D, 1M, 3M, and 1Y
- It requests history rows for the selected range
- It reverses the returned rows into a newest-first display order
- It renders a paginated table through `Tble`

The historical workspace is active, but it is narrow compared to the pool-detail page. It does not expose pool selection, live transaction feeds, or the broader chart stack used on the pool-detail route.

## 9. Navigation and action boundaries

| Source UI | Destination | Internal/external | Status |
|---|---|---|---|
| Pool selector | `/tokens/:address/:poolAddress` | Internal | Active |
| Recent transaction wallet link | `/wallets/:address` | Internal | Active |
| Recent transaction tx link | Solscan transaction URL | External | Active |
| Pool header wash button | `/wash-trading/:mint?...` | Internal | Active with limitations |
| Token header token link | `/tokens/:address` | Internal | Active |
| Historical-data table | None confirmed | N/A | Local table only |
| Historical-data range selector | None | Local state only | Active |

No active navigation to alerts, watchlists, or comparison routes was confirmed from these pages. The strongest cross-subsystem boundary is the wash-trading entry from the pool-detail header.

## 10. Active, inactive, and incomplete implementations

| Candidate | Classification | Why |
|---|---|---|
| Pool-detail route | `ACTIVE` | `/tokens/:address/:poolAddress` is actively registered and rendered. |
| Historical-data route | `ACTIVE` | `/historical-data/:address` is actively registered and rendered. |
| PoolSelector | `ACTIVE` | It changes the selected pool by navigating to another pool-detail route. |
| RecentTransactions | `ACTIVE` | It renders the active pool trade table and navigation links. |
| VolatilitySignals | `ACTIVE_WITH_LIMITATIONS` | It is active, but the signal workspace is request-driven and local-state driven. |
| TokenAIChat on pool page | `ACTIVE_WITH_LIMITATIONS` | It is active on the pool page, but it is an embedded token-analysis surface rather than pool-native functionality. |
| TokenHeader sidebar wash entry | `ACTIVE_WITH_LIMITATIONS` | Active from the pool page, but it is a cross-subsystem handoff rather than pool/history behavior. |
| Historical-data error/loading handling | `ACTIVE_WITH_LIMITATIONS` | Error and loading states are local, not unified at the subsystem level. |


## 11. Major architectural limitations

- The pool-detail page is a large mixed workspace that combines identity, charts, market stats, history-adjacent data, AI chat, and recent transactions in one route-local shell.
- Pool switching is handled by route navigation, but the surrounding state is still largely local to the current page instance.
- Historical data is active but isolated to token history rows and a single range selector. It does not share the richer pool-detail analysis model.
- The pool-detail page depends on several asynchronous fetches, so the user experience is sensitive to partial data and page-level loading timing.
- The wash-trading action is connected from the pool header, but no active alerts or watchlist entry was confirmed from either surface.
- Recent transaction and volatility flows include external destinations and separate request boundaries, which keeps the page functional but increases cross-system coupling.

## 12. Backend verification requirements

Later backend or integration verification should focus on:

1. Whether the pool-detail page should expose a unified loading/error shell when one of the pool-scoped requests fails.
2. Whether pool switching should preserve more of the current page state across `/tokens/:address/:poolAddress` transitions.
3. Whether historical data should remain token-only or gain a pool-specific variant.
4. Whether `RecentTransactions` should keep using wallet and external explorer navigation only, or add dedicated pool/transaction routes.
5. Whether the wash-trading entry from the pool header should remain the only cross-subsystem action.
6. Whether `VolatilitySignals` and `TokenAIChat` should be kept as embedded token-analysis surfaces inside the pool workspace.

## 13. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`
- `docs/architecture/audit/02C_WALLET_FRONTEND_ARCHITECTURE.md`
- `docs/architecture/audit/02D_ALERTS_FRONTEND_ARCHITECTURE.md`
- `docs/architecture/audit/02E_WASH_TRADING_FRONTEND_ARCHITECTURE.md`
- `client/src/App.tsx`
- `client/src/pages/token/index.tsx`
- `client/src/pages/historical-data/index.tsx`
- `client/src/components/token/PoolSelector.tsx`
- `client/src/components/token/RecentTransactions.tsx`
- `client/src/components/token/VolatilitySignals.tsx`
- `client/src/components/token/TokenAIChat.tsx`
- `client/src/components/token/TokenHeader.tsx`
- `client/src/components/token/TokenChart.tsx`
- `client/src/components/token/MarketStats.tsx`
- `client/src/components/token/TopHolders.tsx`
- `client/src/components/token/NewsTab.tsx`
- `client/src/components/wrapper/PageWrapper.tsx`
