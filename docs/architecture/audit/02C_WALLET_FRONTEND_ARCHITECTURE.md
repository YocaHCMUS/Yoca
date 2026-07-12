# Yoca Wallet Frontend Architecture Audit

## 1. Scope

This high-level audit covers the wallet frontend as one subsystem, centered on the active routes `/wallets/:address` and `/comparison/wallets`.

In scope:

- Active wallet route registration and render chains
- Wallet identity, summary, balance/history, holdings, transactions, comparison, AI analysis, follow, and alert-entry boundaries
- Direct frontend API boundaries used by wallet pages
- Wallet address context flow through the subsystem
- Navigation to related token, transaction, comparison, alert, pricing, and profile destinations
- Wallet-related components and services that exist but are not active in the current wallet route tree

Out of scope:

- Backend route/service implementations, databases, providers, deployment, and Mermaid architecture
- Detailed CSS behavior, every table column, and every response field
- Helius webhook processing, alert delivery, and auth internals already audited elsewhere
- Non-wallet product areas except where they are direct destinations from wallet pages

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`, `02B2B3_TOKEN_AI_CHAT_FRONTEND.md`, `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`, and `02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `ACTIVE`: rendered from the active wallet flow, has a visible or lifecycle entry point, and completes its intended frontend role.
- `ACTIVE_WITH_LIMITATIONS`: connected and usable, but with a confirmed limitation such as route fallback, local-only state, request-on-open behavior, missing page-level error UI, or shared-context dependence.
- `BROKEN`: visible wallet capability exists but cannot complete its intended basic frontend role.
- `ROUTE_INACTIVE`: wallet implementation exists, but no active render or interaction chain from the current wallet routes was confirmed.
- `NOT_IMPLEMENTED`: the active wallet route has no confirmed frontend control for that capability.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from the major wallet capabilities listed below. Repeated evidence, helper details, CSS rows, and architecture blocks do not create extra counts.

## 3. Active routes

`client/src/App.tsx` registers two active wallet routes:

| Route | Registered component | Reachability | Notes |
|---|---|---|---|
| `/wallets/:address` | `WalletPage` | Active and directly reachable | Public route, no route guard. `WalletPage` defensively returns an address-missing fallback if invoked without a param. |
| `/comparison/wallets` | `WalletsComparisonPage` | Active and directly reachable | Public route, no route guard. It can also be bootstrapped from `?wallets=...`. |

No `/wallets` root route was confirmed in `App.tsx`, so the active wallet shell is route-param-driven rather than index-route-driven.

## 4. Active render chains

### `/wallets/:address`

```text
/wallets/:address
└─ WalletPage
   ├─ WalletTopbar
   ├─ WalletHero
   ├─ BalanceChartV2
   ├─ PnLChart
   ├─ WalletTransactionActivity
   ├─ WalletHoldingsPanel
   ├─ TokenDetailsDemo / average-price overlay
   ├─ ChatContextProvider
   │  ├─ RightSidebar
   │  └─ WalletChat
   ├─ DayActivityPopup
   ├─ AiSwapSummaryModal
   └─ AiAnalysisModal
```

### `/comparison/wallets`

```text
/comparison/wallets
└─ WalletsComparisonPage
   ├─ WalletComparisonSidebar
   ├─ WalletComparisonMainContent
   │  ├─ GeneralTab
   │  ├─ HoldingTab
   │  └─ RiskTab
   ├─ ChatContextProvider
   │  ├─ RightSidebar
   │  └─ WalletChat
   ├─ QuickAiPopup
   └─ DayActivityPopup
```

## 5. Wallet capability ledger

| ID | Capability | Main implementation | Status | Limitation or exclusion reason |
|---|---|---|---|---|
| `WALLET-01` | Wallet route and page shell | `WalletPage`, `WalletsComparisonPage`, `App.tsx` | `ACTIVE_WITH_LIMITATIONS` | Both routes are public and active, but the detail page is param-driven and the comparison page is query-driven rather than fully self-contained. |
| `WALLET-02` | Wallet identity and summary | `WalletTopbar`, `WalletHero`, `fetchWalletOverview`, `fetchWalletIntelligence`, `fetchWalletTags` | `ACTIVE_WITH_LIMITATIONS` | Identity/summary data comes from multiple async sources and falls back silently when partial data is missing. |
| `WALLET-03` | Balance and historical balance | `BalanceChartV2`, `PnLChart`, `DayActivityPopup` | `ACTIVE_WITH_LIMITATIONS` | Chart and day-popup behavior is active, but failures and stale data are handled locally rather than with a page-level error surface. |
| `WALLET-04` | Holdings and token drill-down | `WalletHoldingsPanel`, `AssetDistribution`, `TokenDetailsDemo` | `ACTIVE_WITH_LIMITATIONS` | The section is active, but token drill-in and watchlist behavior depend on shared state and per-row token metadata. |
| `WALLET-05` | Transactions and activity | `WalletTransactionActivity` | `ACTIVE` | The swaps/transfers table is active, searchable, filterable, and navigates out to transaction explorers. |
| `WALLET-06` | Wallet comparison workspace | `WalletsComparisonPage`, `WalletComparisonSidebar`, `GeneralTab`, `HoldingTab`, `RiskTab` | `ACTIVE_WITH_LIMITATIONS` | Comparison is active and query-hydratable, but it depends on local selection state and tab-gated fetches. |
| `WALLET-07` | Wallet AI analysis modal | `AiAnalysisModal`, `WalletAnalystPanel`, `analyzeWalletWithAI` | `ACTIVE_WITH_LIMITATIONS` | The modal is active and retryable, but it is a separate overlay with request-on-open behavior and no route-level persistence. |
| `WALLET-08` | Wallet AI chat / assistant panel | `WalletChat`, `ChatContextProvider`, `QuickAiPopup` | `ACTIVE_WITH_LIMITATIONS` | The chat surface is active on wallet and comparison pages, but guest gating, plan prompts, and local session state limit persistence. |
| `WALLET-09` | Wallet watchlist / bookmark control | `WalletTopbar`, `WalletHoldingsPanel`, `WalletComparisonSidebar`, `RightSidebar`, `WatchlistContext` | `ACTIVE_WITH_LIMITATIONS` | Token and wallet watchlists are active, but they rely on shared context and optimistic local updates. |
| `WALLET-10` | Wallet follow / alerts-backed subscription control | `WalletTopbar` | `ACTIVE_WITH_LIMITATIONS` | The bell control is active and backed by alerts APIs, but it is click-time stateful and has no dedicated page-level error UX. |
| `WALLET-11` | Wallet alert-entry control | `WalletOverview` legacy stub | `NOT_IMPLEMENTED` | The current wallet route has no confirmed alert-entry launcher; the legacy component only logs a create-alert click. |
| `WALLET-12` | Entity navigation | `WalletTopbar`, `WalletHoldingsPanel`, `WalletComparisonSidebar`, `RightSidebar`, `WalletChat`, `WalletTransactionActivity` | `ACTIVE_WITH_LIMITATIONS` | Navigation is active to tokens, wallets, comparison, alerts, pricing, and explorers, but several handoffs use raw route strings or external links. |
| `WALLET-13` | Loading, empty, and error boundary | `WalletPage`, `WalletsComparisonPage`, `AiAnalysisModal`, `WalletChat`, `WalletTransactionActivity`, `WalletHoldingsPanel` | `ACTIVE_WITH_LIMITATIONS` | Many wallet failures collapse into empty/partial UI or console logging instead of a dedicated route-level error state. |
| `WALLET-14` | Legacy wallet overview implementation | `client/src/components/wallet/WalletOverview/WalletOverview.tsx` | `ROUTE_INACTIVE` | The old wallet overview shell is not the active `/wallets/:address` implementation and was not confirmed as reachable from the current route tree. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `ACTIVE` | 1 |
| `ACTIVE_WITH_LIMITATIONS` | 11 |
| `BROKEN` | 0 |
| `ROUTE_INACTIVE` | 1 |
| `NOT_IMPLEMENTED` | 1 |
| `UNCERTAIN` | 0 |
| **Total major wallet capabilities** | 14 |

## 6. Wallet address context flow

| Source | Flow | Destination |
|---|---|---|
| Route param | `useParams<{ address: string }>()` in `WalletPage` | `WalletTopbar`, `WalletHero`, charts, holdings, chat, AI modal, and overlays |
| Selected wallets query | `useSearchParams()` in `WalletsComparisonPage` | `WalletComparisonSidebar`, comparison tabs, right sidebar, chat, popup layers |
| Derived token addresses | Holdings and token-detail overlays derive token addresses from wallet state | `TokenDetailsDemo`, token metadata/market lookups, token routes |
| Shared watchlist state | `useWatchlist()` is shared across wallet and comparison surfaces | Token and wallet watchlists, add/remove actions, bookmark buttons |

The wallet subsystem passes the address context directly through props and shared context rather than through a route-level store.

## 7. Wallet detail page architecture

### Wallet identity and summary

`WalletTopbar` is the active owner for identity, labels, tags, copy/share, period switching, bookmark/follow actions, and AI analysis launch. `WalletHero` renders the high-level summary metrics from wallet overview and win-rate data.

### Balance and historical balance

`BalanceChartV2` renders the balance history view, while `PnLChart` renders profit/loss history. Both feed `DayActivityPopup` when a day is clicked. These blocks are active, but they behave as independent chart surfaces rather than a single composite dashboard.

### Holdings

`WalletHoldingsPanel` renders the asset distribution and holdings table. It is also where token follow/bookmark controls appear per holding row, and clicking a non-native token row navigates to `/tokens/:address`.

### Transactions and activity

`WalletTransactionActivity` is the active swap/transfer history surface. It provides table search, filters, sort controls, and external transaction links.

### Auxiliary overlays

The page also mounts `TokenDetailsDemo` for token drill-ins, `WalletChat` inside `ChatContextProvider`, `AiSwapSummaryModal`, `AiAnalysisModal`, `DayActivityPopup`, and `RightSidebar`. These are supporting wallet surfaces, not separate routes.

## 8. Wallet comparison architecture

`WalletsComparisonPage` is the active multi-wallet workspace.

- The left sidebar owns wallet entry, removal, copy, bookmark, and watchlist follow controls.
- The comparison tabs are `GeneralTab`, `HoldingTab`, and `RiskTab`.
- `GeneralTab` compares balance history and volume.
- `HoldingTab` compares holdings overlap and token distributions.
- `RiskTab` compares PnL, win rate, drawdown, and related risk metrics.
- The page can hydrate directly from `?wallets=a,b,c`, capped at four wallets.
- `RightSidebar` can add watched wallets into the comparison set.
- `WalletChat`, `QuickAiPopup`, and `DayActivityPopup` are active comparison overlays.

## 9. Wallet AI boundaries

### Wallet AI analysis

`AiAnalysisModal` is the active wallet AI analysis boundary on `/wallets/:address`. It opens from `WalletTopbar`, calls `analyzeWalletWithAI` in `client/src/services/api/walletAnalysis.tsx`, renders `WalletAnalystPanel`, and uses retry-on-failure behavior inside a portal modal.

### Wallet AI chat

`WalletChat` is a separate active assistant surface on wallet and comparison pages. It uses `ChatContextProvider`, session state, prompt menus, and a pricing/plans popup. It also routes from address pills back to `/wallets/:address`.

## 10. Wallet follow and alert entry

### Follow and watchlist

The active wallet follow/watchlist story is split across two systems:

- Bookmark/watchlist state is backed by `WatchlistContext`.
- The bell-style follow control in `WalletTopbar` is backed by `client.api.alerts` GET/POST/DELETE calls and can route the user to `/alerts`.

This is functional, but it is click-time, locally mediated, and not a single unified wallet subscription subsystem.

### Alert entry

No active token-less wallet alert-entry launcher was confirmed on the current wallet routes. The only alert-entry-like wallet code found in `WalletOverview` is a legacy stub that logs `Create alert clicked`, so wallet alert entry on the current route is `NOT_IMPLEMENTED`.

## 11. Frontend API boundaries

| Wallet block | API category | Main caller | Purpose |
|---|---|---|---|
| Wallet summary | Wallet overview / intelligence / tags | `WalletPage`, `WalletTopbar`, `WalletHero` | Load wallet identity, summary metrics, and tags |
| Balance/history | Wallet overview, charts, activity popups | `WalletPage`, `BalanceChartV2`, `PnLChart`, `DayActivityPopup` | Load historical balance and day-level activity data |
| Holdings | Wallet portfolio and token metadata | `WalletPage`, `WalletHoldingsPanel` | Load holdings rows, token metadata, and token drill-in data |
| Transactions/activity | Wallet swaps and transfers | `WalletTransactionActivity` | Load swap and transfer history tables |
| Comparison | Comparison summaries | `useWalletComparisonSummary` | Load balance, win-rate, PnL, and trading-volume summaries for multiple wallets |
| AI analysis | External wallet-analysis endpoint | `AiAnalysisModal` | Request a wallet AI analysis report |
| Watchlist | Shared profile watchlist APIs | `WatchlistContext` | Hydrate and mutate token and wallet watchlists |
| Follow/alerts | Alerts API | `WalletTopbar` | Follow/unfollow a wallet and jump to `/alerts` |
| Legacy analysis helpers | `walletApi.ts` analysis/audit helpers | Not confirmed active from current wallet routes | Present in the codebase but not reachable from the current wallet flow |

## 12. Navigation boundaries

| Source UI | Destination | Status |
|---|---|---|
| Holding row click | `/tokens/:address` | Active |
| Topbar compare action | `/comparison/wallets?wallets=...` | Active |
| Follow success action | `/alerts` | Active |
| Chat address pill | `/wallets/:address` | Active |
| Comparison sidebar wallet row | `/wallets/:address` | Active |
| Comparison sidebar open-wallet action | `/wallets/:address` | Active |
| Transaction row explorer link | External Solscan transaction URL | Active |
| Chat plans popup | `/pricing` | Active |
| Legacy wallet overview alert stub | None | Route-inactive / not implemented |

## 13. Loading, empty, error, and fallback behavior

| Wallet area | Current behavior | Limitation |
|---|---|---|
| Wallet detail page | Loads wallet data in separate effects and caches local state per section | Section failures can collapse to empty or partial UI instead of a route-level error screen |
| Comparison page | Hydrates the selected wallets from query string and fetches per-tab only when needed | Empty comparison sets reset to the first tab; invalid or missing wallets are handled locally |
| AI analysis modal | Shows loading, error, and retry states in the modal | Request is on-open only and is not persisted across route changes |
| Wallet chat | Shows auth gate, loading, message, and plan states | Guest/plan gating is modal-local and not reflected in route state |
| Wallet follow/watchlist | Disables or rolls back around local pending state | Follow/watchlist failures are mostly surfaced as toasts and console logs |

## 14. Route-inactive or incomplete wallet implementations

| Candidate | File | Why it is not active from the current wallet routes |
|---|---|---|
| Legacy wallet overview shell | `client/src/components/wallet/WalletOverview/WalletOverview.tsx` | No current caller from `WalletPage` or `WalletsComparisonPage` was confirmed; the current wallet page uses `WalletTopbar` and the newer shell instead. |
| Legacy alert-entry stub | `client/src/components/wallet/WalletOverview/WalletOverview.tsx` | The create-alert button only logs to the console and is not the active wallet route implementation. |
| Legacy AI helpers | `client/src/services/wallet/walletApi.ts` (`fetchWalletAiAnalysis`, `fetchWalletAudit`) | Present in the service layer, but the active wallet AI analysis modal uses `analyzeWalletWithAI` in `services/api/walletAnalysis.tsx` instead. |

## 15. Architecture-ready summary

### Confirmed wallet frontend blocks

| Proposed frontend block | Capability IDs | Responsibility |
|---|---|---|
| Wallet route shell | `WALLET-01`, `WALLET-13` | Owns route entry, address handoff, and the main wallet page lifecycle |
| Wallet summary and charts | `WALLET-02`, `WALLET-03` | Renders wallet identity, summary metrics, and history charts |
| Holdings and transactions | `WALLET-04`, `WALLET-05`, `WALLET-12` | Renders holdings, token drill-down, transaction history, and token/entity navigation |
| Comparison workspace | `WALLET-06` | Compares multiple wallets from a public, query-hydrated route |
| Wallet AI surfaces | `WALLET-07`, `WALLET-08` | Renders the AI analysis modal and the wallet assistant/chat layer |
| Follow/watchlist and alert boundary | `WALLET-09`, `WALLET-10`, `WALLET-11` | Handles bookmark/watchlist state, alerts-backed follow, and the missing alert-entry launcher |

### Wallet frontend-to-backend or external-provider boundaries

| Frontend block | API category | Communication |
|---|---|---|
| Wallet summary | Wallet overview / intelligence / tags | Hono RPC via `walletApi.ts` and `walletTagsApi.ts` |
| Holdings | Wallet portfolio and token metadata | Hono RPC and token metadata fetches |
| Transactions | Wallet swaps and transfers | Hono RPC via `walletApi.ts` |
| Comparison summaries | Balance, win-rate, PnL, and trading volume | Hono RPC plus chart service helpers |
| AI analysis | Wallet-analysis endpoint | Direct fetch via `services/api/walletAnalysis.tsx` |
| Watchlist | Profile watchlist APIs | Shared context over profile endpoints |
| Follow/alerts | Alerts APIs | `client.api.alerts` GET/POST/DELETE from `WalletTopbar` |

## 16. Backend verification requirements

Later backend or integration verification should focus on:

1. Whether `/wallets/:address` should have a dedicated route-level empty/error state instead of only local section fallbacks.
2. Whether wallet comparison should preserve selected wallets more explicitly across route changes or browser refreshes.
3. Whether the alerts-backed follow button in `WalletTopbar` should preserve intent after login or failure.
4. Whether wallet alert entry is intended to exist on the current wallet page or only in the legacy overview path.
5. Whether the direct wallet AI analysis endpoint and the `walletApi.ts` analysis/audit helpers should be consolidated.
6. Whether the wallet chat and wallet analysis surfaces should share a single higher-level AI entry model.

## 17. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `docs/architecture/audit/02B2B3_TOKEN_AI_CHAT_FRONTEND.md`
- `docs/architecture/audit/02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`
- `docs/architecture/audit/02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/wallet/index.tsx`
- `client/src/pages/walletsComparison/index.tsx`
- `client/src/components/wallet/WalletTopbar/WalletTopbar.tsx`
- `client/src/components/wallet/WalletHero/WalletHero.tsx`
- `client/src/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx`
- `client/src/components/WalletTransactionActivity/WalletTransactionActivity.tsx`
- `client/src/components/wallet/WalletChat/WalletChat.tsx`
- `client/src/components/wallet/AiAnalysisModal/AiAnalysisModal.tsx`
- `client/src/components/wallet/WalletComparison/GeneralTab.tsx`
- `client/src/components/wallet/WalletComparison/HoldingTab.tsx`
- `client/src/components/wallet/WalletComparison/RiskTab.tsx`
- `client/src/components/wallet/WalletComparison/WalletComparisonProp.tsx`
- `client/src/components/wallet/WalletOverview/WalletOverview.tsx`
- `client/src/pages/wallet/RightSidebar.tsx`
- `client/src/services/wallet/walletApi.ts`
- `client/src/services/api/walletAnalysis.tsx`
- `client/src/contexts/WatchlistContext.tsx`
- `client/src/contexts/AuthContext.tsx`
- `client/src/main.tsx`
