# Yoca Wash-Trading Frontend Architecture Audit

## 1. Scope

This high-level audit covers the complete wash-trading frontend as one subsystem, centered on the active route `/wash-trading/:mint` and the Token Overview entry path that opens it.

In scope:

- Route registration, access control, and Token Overview entry into wash-trading
- Token mint, symbol, timeframe, and algorithm flow through the page
- Main wash-trading analysis page structure and result blocks
- Wallet, transaction, pool, token, and comparison drill-down boundaries when reachable from the wash page
- Wash-trading AI analysis and chat surfaces, when active
- Subscription, upgrade, loading, error, and unsupported-token behavior
- Duplicated or incomplete wash-trading implementations

Out of scope:

- Backend detection algorithms, scoring formulas, provider internals, database schemas, AI prompt/model internals, payment implementation, detailed table columns, every response field, detailed CSS, deployment, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`, `02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`, `02C_WALLET_FRONTEND_ARCHITECTURE.md`, and `02D_ALERTS_FRONTEND_ARCHITECTURE.md`.

## 2. Architecture summary

The wash-trading subsystem is active and centered on a dedicated page component rendered from `/wash-trading` and `/wash-trading/:mint`. The primary entry path comes from the Token Overview header, which sends the user to the wash route after a subscription check succeeds. The wash page itself owns the full analysis workspace: header controls, analysis request, risk summary, graph visualization, suspicious-wallet list, wallet detail panel, detection log, contextual metadata, AI summary panel, and a separate wash-trading chat assistant.

The architecture is split into three layers:

- Token Overview entry and subscription gate
- Wash-trading analysis page and analysis request layer
- Wash-trading AI chat overlay and follow-up question surface

The page is usable without a prefilled mint, but the active analysis experience is anchored to `/wash-trading/:mint`. A manual open path exists for the route, yet the main production entry is the token-page wash button.

## 3. Active route and entry flow

### Active routes

| Route | Registered component | Reachability | Notes |
|---|---|---|---|
| `/wash-trading` | `WashTradingPage` | Active and directly reachable | Manual entry variant without a route mint. |
| `/wash-trading/:mint` | `WashTradingPage` | Active and directly reachable | Primary analysis route, and the form auto-runs when `mint` is present. |

### Entry flow from Token Overview

`TokenHeader` builds `/wash-trading/${address}?symbol=...&timeframe=24h` and only navigates after `getUserSubscription()` confirms the user is active/trialing and on Plus or Pro. If the user is not signed in, or the subscription check fails, the flow opens a local gate instead of navigating.

```text
/tokens/:address
└─ TokenOverviewPage
   └─ TokenHeader
      └─ wash-trading button
         ├─ guest gate
         ├─ subscription check
         ├─ pricing gate
         └─ navigate to /wash-trading/:mint

/wash-trading/:mint
└─ WashTradingPage
   ├─ fixed header / breadcrumbs / inputs
   ├─ AI verdict summary
   ├─ metrics summary
   ├─ graph analysis
   ├─ suspicious-wallet list and wallet insight panel
   ├─ detailed findings
   ├─ risk / feature panel
   ├─ detection log
   ├─ contextual metadata
   └─ WashTradingChat
```

## 4. Main render architecture

### `/wash-trading/:mint`

- `PageWrapper` hosts the route shell.
- `WashTradingPage` owns the full analysis page state.
- A fixed control bar contains breadcrumbs, token/timeframe inputs, algorithm selection, verdict toggle, and the run-analysis button.
- The scrollable body renders the error surface, AI verdict summary, metrics, graph card, suspicious-wallet list, selected-wallet insight panel, detailed findings, risk panel, detection log, and contextual metadata.
- `WashTradingChat` renders as a separate assistant surface at the bottom of the page.

### Major page blocks

- Route shell and fixed controls
- Analysis request and access gate
- AI verdict summary
- Summary metrics
- Circular-trade graph visualization
- Suspicious-wallet list
- Selected-wallet insight panel
- Detailed findings
- Risk and feature scoring panel
- Detection log
- Context metadata
- Wash-trading chat assistant
- Upgrade and graph modal overlays

## 5. Major frontend capabilities

| ID | Capability | Main components | Classification | Major limitation |
|---|---|---|---|---|
| `WASH-01` | Route and page shell | `App.tsx`, `WashTradingPage`, `PageWrapper` | `ACTIVE` | Two active route entry forms exist, but `/wash-trading/:mint` is the primary path. |
| `WASH-02` | Token-context and timeframe entry | `TokenHeader`, `WashTradingPage` | `ACTIVE_WITH_LIMITATIONS` | The page accepts query-driven context and can also be opened manually, so the mint is not the only entry path. |
| `WASH-03` | Subscription and access gate | `TokenHeader`, `WashTradingPage`, `getUserSubscription` | `ACTIVE_WITH_LIMITATIONS` | Access is checked on click or page load, not through a single route-level gate. |
| `WASH-04` | Analysis request layer | `WashTradingPage` | `ACTIVE_WITH_LIMITATIONS` | The request is client-driven and depends on the configured API backend. |
| `WASH-05` | AI verdict summary | `WashTradingPage` | `ACTIVE_WITH_LIMITATIONS` | The AI summary is coupled to the active analysis response and an independent open/close toggle. |
| `WASH-06` | Result metrics and risk overview | `WashTradingPage` | `ACTIVE` | Core summary metrics are active and always tied to the latest analysis result. |
| `WASH-07` | Graph visualization and fullscreen modal | `WashTradingPage`, `NetworkGraph` | `ACTIVE_WITH_LIMITATIONS` | Graph rendering depends on analysis data and modal state; no separate route exists. |
| `WASH-08` | Suspicious-wallet exploration and wallet detail | `WashTradingPage`, `WalletRow`, `WalletInsightPanel` | `ACTIVE_WITH_LIMITATIONS` | Wallet drill-down is local to the analysis page and not a route transition. |
| `WASH-09` | Detailed findings and detection log | `WashTradingPage` | `ACTIVE` | Findings/logs render only after analysis data exists. |
| `WASH-10` | Wash-trading AI chat assistant | `WashTradingChat` | `ACTIVE_WITH_LIMITATIONS` | Chat is active but scoped to the current analysis context and not persisted as a full conversation route. |
| `WASH-11` | Subscription upgrade and plus gate | `WashTradingPage`, `TokenHeader` | `ACTIVE_WITH_LIMITATIONS` | Upgrade behavior is modal/local-state driven and depends on the current plan state. |
| `WASH-12` | Entity navigation | `WashTradingPage`, `TokenHeader`, `WashTradingChat` | `ACTIVE_WITH_LIMITATIONS` | Navigation exists, but many handoffs are raw route links or external tabs rather than protected route transitions. |
| `WASH-13` | Loading, empty, error, and unsupported-state boundary | `WashTradingPage`, `WashTradingChat` | `ACTIVE_WITH_LIMITATIONS` | Failures collapse into local error text or empty panels rather than a route-level error shell. |
### Capability count validation

| Capability status | Count |
|---|---:|
| `ACTIVE` | 3 |
| `ACTIVE_WITH_LIMITATIONS` | 10 |
| `BROKEN` | 0 |
| `ROUTE_INACTIVE` | 0 |
| `NOT_IMPLEMENTED` | 0 |
| `UNCERTAIN` | 0 |
| **Total major wash-trading capabilities** | 13 |

## 6. Token context and state flow

The wash page uses route and query context together:

- `mint` comes from the route param.
- `symbol` comes from `?symbol=...` or defaults to `TOKEN`.
- `timeframe` comes from `?timeframe=...` or defaults to `24h`.
- `algorithm` comes from `?algorithm=...` or defaults to `GCN`.
- Manual mode can supply a mint through an input field when the route param is absent.

The active analysis request runs when `mint` is present and the page mounts or the mint changes. The page also updates the URL when timeframe or algorithm changes, so the route remains a shareable state container rather than a passive shell.

The wash chat uses a smaller context bundle:

- mint
- symbol
- timeframe
- algorithm
- data source
- analyzed-at timestamp
- risk score
- analysis-ready flag

That context is reset when mint, timeframe, or algorithm changes.

## 7. Frontend API boundaries

| Frontend block | API category | Communication | Request purpose | Trigger |
|---|---|---|---|---|
| Subscription gate | Profile subscriptions | `client.api.profile.subscriptions.$get` via `getUserSubscription()` | Check whether the signed-in user can use wash-trading AI | Token Overview wash click or wash-page access gate |
| Wash-trading analysis | Configured API backend | Direct `fetch` to `${API_DOMAIN}/api/v1/wash-trading/ai-analyze` | Request the main wash-trading result payload | Route mint present or run-analysis click |
| Wash-trading chat | Configured API backend | Direct `fetch` to `${API_DOMAIN}/api/v1/wash-trading/chat` | Request follow-up AI answers grounded in the current analysis context | User submits a chat question |

Request behavior summary:

- Initial analysis trigger: yes, when the mint route is present or the run-analysis button is pressed
- Manual open path: yes, for `/wash-trading` without a mint
- Token dependency: yes, mint and symbol are part of the analysis payload
- Timeframe dependency: yes, the payload includes `24h`, `7d`, or `30d`
- Algorithm dependency: yes, `GCN`, `GAT`, and `GraphSAGE` are selectable
- Auth dependency: yes, guests are blocked into login
- Plan dependency: yes, Plus/Pro is required for AI use
- Chat dependency: yes, chat is context-scoped to the current analysis
- Refresh/cache layer: none confirmed in the frontend
- Request cancellation: none confirmed in the frontend-to-backend HTTP boundary
- Stale-response protection: none confirmed in the frontend-to-backend HTTP boundary

## 8. Access, subscription, and upgrade boundaries

`TokenHeader` and `WashTradingPage` enforce access in different places:

- `TokenHeader` checks subscription before navigating from Token Overview.
- `WashTradingPage` checks subscription again before running analysis.
- Guests are redirected to sign in rather than being allowed through to AI analysis.
- Users without Plus or Pro are sent to a local upgrade gate.
- The upgrade path points to `/pricing` when the request or gate supplies it.

The plan boundary is active and meaningful, but it is not unified into one shared page-level access system. The page mixes route entry, analysis gating, and upgrade gating as local state.

## 9. Navigation boundaries

| Source UI | Destination | Internal/external | Status |
|---|---|---|---|
| Token Overview wash button | `/wash-trading/:mint?symbol=...&timeframe=24h&algorithm=...` | Internal | Active |
| Wash page breadcrumb | `/tokens` | Internal | Active |
| Wash page breadcrumb token link | `/tokens/:mint` | Internal | Active |
| Manual token open button | `/wash-trading/:mint?...` | Internal | Active |
| Plus gate upgrade link | `/pricing` | Internal | Active |
| Error upgrade link | `upgradePath` or `/pricing` | Internal or external depending response | Active with limitations |
| Graph modal close/escape | Same page state | Local only | Active |
| Wash chat question flow | No route change | Local only | Active |

The page does not confirm dedicated route transitions to token transaction, pool, comparison, or wallet detail pages. The active route surface is primarily analysis-first with token-page and pricing exits.

## 10. Active, inactive, and incomplete implementations

| Candidate | Classification | Why |
|---|---|---|
| `WashTradingPage` on `/wash-trading` | `ACTIVE` | The manual route is registered and renders the same page component. |
| `WashTradingPage` on `/wash-trading/:mint` | `ACTIVE` | This is the primary production path and auto-runs analysis when mint exists. |
| Token Overview wash entry | `ACTIVE` | The header button is active and navigates into the wash route after a subscription check. |
| Analysis request flow | `ACTIVE_WITH_LIMITATIONS` | It is active but depends on the configured API backend and has no confirmed cancellation or stale-response guard. |
| AI summary panel | `ACTIVE_WITH_LIMITATIONS` | It is active, but only as part of the main analysis response and local toggle state. |
| WashTradingChat | `ACTIVE_WITH_LIMITATIONS` | It is active and separately request-driven, but conversation history is local-only. |
| Plus gate | `ACTIVE_WITH_LIMITATIONS` | It is active, but plan gating is locally mediated and not route-guarded. |
| Graph fullscreen modal | `ACTIVE_WITH_LIMITATIONS` | Active overlay, but no dedicated route or persistent state. |


## 11. Major architectural limitations

- The subsystem has two entry modes: Token Overview handoff and direct manual route entry. That is practical, but it means the mint is not enforced as a single source of truth.
- Access is checked in the token header and again on the wash page. That duplication is functional, but it creates two local policy points.
- The main analysis request is a direct browser fetch to the configured API domain. The frontend does not provide a mediation layer, cancellation contract, or visible stale-response handling.
- The page mixes core analysis, AI summary, graph inspection, and chat into one large route-local state machine. That keeps the experience cohesive, but it increases the risk of stale state when context changes.
- The upgrade path is response-driven and local-state driven rather than route-guard-driven.
- Token, wallet, graph, and chat drill-downs are mostly overlays or in-page selectors, not separate durable routes.

## 12. Backend verification requirements

Later backend or integration verification should focus on:

1. Whether `/wash-trading` should remain a manual entry variant or be redirected to `/wash-trading/:mint`.
2. Whether the frontend should trust the token-header subscription check, the wash-page check, or both.
3. Whether the configured API backend should support cancellation or request supersession when mint, timeframe, or algorithm changes quickly.
4. Whether the AI summary and chat surfaces should share one backend contract or remain separate endpoints.
5. Whether wallet, token, pool, and transaction drill-downs should navigate to dedicated routes or remain local overlays.
6. Whether unsupported-token and demo-fallback handling should surface distinct user-facing states instead of sharing the same analysis shell.
7. Whether the upgrade path should be standardized so error responses and plan gates resolve consistently.

## 13. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`
- `docs/architecture/audit/02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`
- `docs/architecture/audit/02C_WALLET_FRONTEND_ARCHITECTURE.md`
- `docs/architecture/audit/02D_ALERTS_FRONTEND_ARCHITECTURE.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/TokenHeader.tsx`
- `client/src/pages/wash-trading/index.tsx`
- `client/src/pages/wash-trading/wash-trading.module.scss`
- `client/src/components/wash-trading/WashTradingChat/WashTradingChat.tsx`
- `client/src/components/wash-trading/WashTradingChat/WashTradingChat.module.scss`
- `client/src/services/profile/subscriptionApi.ts`
