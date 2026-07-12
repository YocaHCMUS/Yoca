# Yoca Alerts Frontend Architecture Audit

## 1. Scope

This audit covers the alerts frontend as one subsystem, centered on the active routes `/alerts` and `/alerts-token-demo`.

In scope:

- Active alert route registration, authentication, and render chains
- Alert settings, existing alert management, wallet follow integration, and alert-rule creation
- Token statistics and trading-event alert flows
- Email and Discord delivery settings boundaries
- Frontend API categories used by the alerts subsystem
- Route and modal boundaries relevant to alert creation and management
- Route-inactive, demo-only, legacy, duplicated, or incomplete alert implementations

Out of scope:

- Backend alert evaluation, webhook processing, synchronization logic, delivery implementation, and background jobs
- Database schemas, external-provider internals, detailed validation rules, and detailed CSS behavior
- Every form field, every response property, deployment, and Mermaid architecture
- Authentication internals already audited elsewhere

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02C_WALLET_FRONTEND_ARCHITECTURE.md`, `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`, and `02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`.

## 2. Alerts architecture summary

The alerts subsystem is split into two active user-facing areas:

- `/alerts` is the production alert center. It manages followed wallets, delivery settings, and alert rules from one authenticated page.
- `/alerts-token-demo` is a separate authenticated demo workflow. It exposes token-stats and trading-events builder flows and uses different API categories from the production page.

The production page and the demo page are both active, but they are not the same architecture. Production alerts focus on management and configuration; the demo focuses on guided creation flows with a modal wizard.

## 3. Active alert routes

| Route | Registered component | Auth guard | Reachability | Status |
|---|---|---|---|---|
| `/alerts` | `AlertsPage` | `AuthGuard` | Active and directly reachable for signed-in users | `ACTIVE` |
| `/alerts-token-demo` | `AlertsDemo` | `AuthGuard` | Active and directly reachable for signed-in users | `DEMO_ONLY` |

No unauthenticated alert route was confirmed. `AuthGuard` redirects unauthenticated users away from both routes.

## 4. Main render architecture

### `/alerts`

```text
/alerts
└─ AuthGuard
   └─ AlertsPage
      ├─ Delivery settings
      │  ├─ Discord webhook settings
      │  └─ Email settings
      ├─ Existing wallet follow list
      ├─ Existing alert rules table
      ├─ CreateAlertRuleModal
      └─ Inline notifications / loading states
```

### `/alerts-token-demo`

```text
/alerts-token-demo
└─ AuthGuard
   └─ AlertsDemo
      ├─ Alert type selection modal
      ├─ TokenStatsConfig
      │  └─ AlertNotificationSettings
      ├─ TradingEventsConfig
      │  └─ AlertNotificationSettings
      └─ Existing demo alert table
```

## 5. Major alert capabilities

| ID | Capability | Main components | Responsibility | Classification | Major limitation |
|---|---|---|---|---|---|
| `ALERTS-01` | Alerts route and page shell | `AlertsPage`, `AlertsDemo`, `AuthGuard`, `App.tsx` | Owns the production alert center and demo alert builder routes | `ACTIVE_WITH_LIMITATIONS` | Production and demo are separate routes with different state models. |
| `ALERTS-02` | Delivery settings | `AlertsPage` | Manages Discord webhook and email delivery settings | `ACTIVE_WITH_LIMITATIONS` | Settings are editable, but feedback is mostly inline and request failures collapse locally. |
| `ALERTS-03` | Existing alert management | `AlertsPage` | Lists followed wallets and alert rules, and supports delete actions | `ACTIVE_WITH_LIMITATIONS` | Listing is active, but the UI does not expose a unified edit surface for all rule types. |
| `ALERTS-04` | Wallet follow integration | `AlertsPage`, `WalletTopbar`, `WalletComparisonSidebar` | Syncs followed wallets into alert-center management | `ACTIVE_WITH_LIMITATIONS` | Follow is represented as an alerts-backed wallet subscription, not the same thing as a wallet rule. |
| `ALERTS-05` | Wallet alert-rule creation | `CreateAlertRuleModal` | Creates production wallet-follow alert rules | `ACTIVE_WITH_LIMITATIONS` | This is rule creation only; it is not the same as wallet follow. |
| `ALERTS-06` | Token statistics alerts | `AlertsDemo`, `TokenStatsConfig` | Creates token-stat alerts in the demo flow | `DEMO_ONLY` | The flow is demo-scoped and not the production alert center. |
| `ALERTS-07` | Trading-event alerts | `AlertsDemo`, `TradingEventsConfig` | Creates trading-event alerts in the demo flow | `DEMO_ONLY` | The flow is demo-scoped and uses a different API surface from production. |
| `ALERTS-08` | Email configuration | `AlertsPage`, `AlertNotificationSettings` | Connects email delivery to alert creation/configuration | `ACTIVE_WITH_LIMITATIONS` | Delivery selection is fragmented across production and demo flows. |
| `ALERTS-09` | Discord configuration | `AlertsPage`, `AlertNotificationSettings` | Connects Discord webhook delivery to alert configuration | `ACTIVE_WITH_LIMITATIONS` | Webhook configuration is active, but user-facing failure handling is limited. |
| `ALERTS-10` | Authentication and access gate | `AuthGuard`, route-level sign-in branches | Keeps alert management behind an authenticated session | `ACTIVE` | Guest users are redirected away rather than shown a full alert shell. |
| `ALERTS-11` | Alert navigation and modal orchestration | `AlertsPage`, `CreateAlertRuleModal`, demo modals | Orchestrates create, edit-like, and configuration modal flows | `ACTIVE_WITH_LIMITATIONS` | Modal boundaries are split across production and demo paths. |
| `ALERTS-12` | Loading/error boundary | `AlertsPage`, `AlertsDemo` | Surfaces loading, empty, and partial error states | `ACTIVE_WITH_LIMITATIONS` | Errors often collapse into inline notices or table empties rather than route-level failures. |
| `ALERTS-13` | Route-inactive and legacy alert implementations | `WalletOverview`, demo placeholder alert types | Captures incomplete or future alert paths | `ROUTE_INACTIVE` | Several alert types and controls exist only as placeholders or legacy code. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `ACTIVE` | 1 |
| `ACTIVE_WITH_LIMITATIONS` | 9 |
| `BROKEN` | 0 |
| `ROUTE_INACTIVE` | 1 |
| `DEMO_ONLY` | 2 |
| `NOT_IMPLEMENTED` | 0 |
| `UNCERTAIN` | 0 |
| **Total major alert capabilities** | 13 |

## 6. Alert-type architecture

### Wallet follow

- Entry point: `WalletTopbar` bell control, plus wallet/watchlist surfaces elsewhere.
- Configuration component: production alert center list and settings on `/alerts`.
- Token or wallet context: wallet address.
- Frontend API boundary: `client.api.alerts` GET/POST/DELETE for followed-wallet rows.
- Status: `ACTIVE_WITH_LIMITATIONS`.
- Major limitation: follow is alerts-backed and click-time, so intent preservation and feedback are limited.

### Wallet alert-rule creation

- Entry point: `CreateAlertRuleModal` on `/alerts`.
- Configuration component: two-step modal with rule details and delivery selection.
- Token or wallet context: wallet address plus rule metadata.
- Frontend API boundary: `client.api.alerts.rules.$post`.
- Status: `ACTIVE_WITH_LIMITATIONS`.
- Major limitation: this is the production wallet-rule flow, not the same as wallet follow.

### Token statistics alerts

- Entry point: `AlertsDemo` type-selection modal.
- Configuration component: `TokenStatsConfig`.
- Token or wallet context: token address, symbol, and name selected through token search.
- Frontend API boundary: `client.api.alertsHp.tokens.$post`.
- Status: `DEMO_ONLY`.
- Major limitation: this flow is demo-scoped and not wired into the production alert center.

### Trading-event alerts

- Entry point: `AlertsDemo` type-selection modal.
- Configuration component: `TradingEventsConfig`.
- Token or wallet context: wallet address, token, pool, and optional counterparty scope.
- Frontend API boundary: `client.api.alertsHp.trading.$post`.
- Status: `DEMO_ONLY`.
- Major limitation: this flow is demo-scoped and uses a separate API category from production.

### Other alert types found in source

- `technical-indicators` appears in the demo route as a selectable type, but its configuration is not implemented.
- `market-movements` appears in the demo route as a selectable type, but its configuration is not implemented.

Status for both: `NOT_IMPLEMENTED`.

## 7. Existing alert management

The production `/alerts` page supports:

- Listing followed wallets
- Listing active alert rules
- Creating a new alert rule
- Deleting followed wallets
- Deleting alert rules
- Toggling email delivery and editing Discord webhook settings

The management model is split:

- Followed wallets are managed in a dedicated table.
- Alert rules are managed in a separate table.
- Rule editing is not clearly exposed in the production page; the active flow is create/delete rather than a full edit lifecycle.
- One-time versus recurring behavior is presented through trigger mode fields in the creation modal, but the page does not present a deeper lifecycle manager.

## 8. Delivery settings

`AlertsPage` owns the production delivery settings surface.

- Email settings are editable with an enable toggle and an optional override address.
- Discord settings are editable through a webhook URL field.
- Default delivery preferences are exposed through the create-rule modal and the demo notification settings panel.
- Per-alert delivery overrides are supported in the production create-rule modal and in the demo configuration flows.
- The main API boundary is `client.api.alerts.settings`.

Main weakness:

- Delivery settings use inline notifications and local fallback state, but there is no strong route-level failure state or recovery workflow.

## 9. Authentication and access boundaries

- Both `/alerts` and `/alerts-token-demo` are guarded by `AuthGuard`.
- Guests are redirected to `/unauthorized` rather than shown an embedded alerts shell.
- Plan or subscription gating is not a first-class route-level concept on the production alert center, but some demo alert examples and wallet follow actions imply delivery/upgrade dependencies.
- Login intent is not preserved through the guard in this flow; `AuthGuard` redirects with location state, but the alert pages themselves do not show a dedicated login-return contract.

## 10. Frontend API boundaries

| Alerts block | API category | Trigger | Purpose | Major limitation |
|---|---|---|---|---|
| Delivery settings | Alert settings | `/alerts` mount and save actions | Load and persist Discord and email settings | Failure handling is mostly inline. |
| Followed wallets | Followed-wallet list | `/alerts` mount and follow/unfollow actions | Load and mutate followed wallet rows | Follow and alerts are coupled, but feedback is limited. |
| Existing alert rules | Alert rules | `/alerts` mount and delete actions | Load and remove production alert rules | Editing is not clearly exposed in the active flow. |
| Wallet rule creation | Alert rule creation | `CreateAlertRuleModal` submit | Create production wallet alert rules | The modal is create-centric and multi-step. |
| Token stats demo | Token alert rules | `TokenStatsConfig` submit | Create token-stat demo alerts | Demo-only API surface. |
| Trading events demo | Trading event rules | `TradingEventsConfig` submit | Create trading-event demo alerts | Demo-only API surface. |
| Demo list hydrating | Demo alert categories | `AlertsDemo` mount | Load demo token and trading alerts | Separate from production alert management. |

## 11. Route and modal boundaries

| Source block | Destination or modal | Context passed |
|---|---|---|
| `/alerts` create button | `CreateAlertRuleModal` | New wallet alert-rule flow context |
| `/alerts-token-demo` type selection | `TokenStatsConfig` modal | Token alert type and token selection context |
| `/alerts-token-demo` type selection | `TradingEventsConfig` modal | Trading alert type and wallet/pool/token scope context |
| Production follow success | `/alerts` | Followed-wallet management context |
| Wallet follow follow-up action | `/alerts` | Alerts management context |
| Auth guard | `/unauthorized` | Attempted route state only |

## 12. Active, demo, inactive, and incomplete implementations

| Class | Examples | Status |
|---|---|---|
| Active production alert flow | `/alerts`, `AlertsPage`, `CreateAlertRuleModal`, delivery settings, followed wallets, rule deletion | `ACTIVE_WITH_LIMITATIONS` |
| Demo-only alert flow | `/alerts-token-demo`, `TokenStatsConfig`, `TradingEventsConfig`, `AlertsDemo` | `DEMO_ONLY` |
| Route-inactive or legacy implementation | `WalletOverview` create-alert stub | `ROUTE_INACTIVE` |
| Placeholder alert types | `technical-indicators`, `market-movements` in the demo route | `NOT_IMPLEMENTED` |
| Duplicated configuration layer | `AlertNotificationSettings` and `AlertConfigurationShared` reused across demo builders | `ACTIVE_WITH_LIMITATIONS` |

## 13. Major architectural limitations

- Production and demo alert flows are split across different routes and API categories.
- Wallet follow and wallet alert-rule creation are both surfaced in the alerts area, but they are distinct workflows and can be confused by users.
- Token statistics and trading-event alerts live in the demo route rather than the production alert center.
- Some alert types are exposed in the demo selector but not implemented.
- Alert failures are mostly surfaced through inline notifications or simple table empties rather than a unified error boundary.
- Delivery settings, follow management, and rule creation are fragmented across separate components and modals.
- Alert edit behavior is not clearly exposed in the active production flow.

## 14. Backend verification requirements

Later backend or integration verification should focus on:

1. Whether the production `/alerts` page should expose rule editing rather than only create/delete flows.
2. Whether wallet follow should remain coupled to alerts or become a distinct subscription model.
3. Whether the demo token statistics and trading-event builders should be promoted into the production alert center.
4. Whether unsupported demo alert types should remain visible or be removed from the selector.
5. Whether delivery settings should be centralized behind a single alert configuration contract.
6. Whether login intent should be preserved after the `AuthGuard` redirect for alert management routes.

## 15. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`
- `docs/architecture/audit/02B2B4B_SUPPLEMENTAL_TOKEN_INSIGHTS_FRONTEND.md`
- `docs/architecture/audit/02C_WALLET_FRONTEND_ARCHITECTURE.md`
- `client/src/App.tsx`
- `client/src/pages/alerts/index.tsx`
- `client/src/pages/alerts/demo.tsx`
- `client/src/pages/alerts/CreateAlertRuleModal.tsx`
- `client/src/pages/alerts/components/AlertConfigurationShared.tsx`
- `client/src/pages/alerts/components/AlertNotificationSettings.tsx`
- `client/src/pages/alerts/components/TokenStatsConfig.tsx`
- `client/src/pages/alerts/components/TradingEventsConfig.tsx`
- `client/src/pages/alerts/form-schema.ts`
- `client/src/components/auth/AuthGuard.tsx`
- `client/src/components/auth/index.ts`
- `client/src/components/wallet/WalletTopbar/WalletTopbar.tsx`
- `client/src/pages/walletsComparison/index.tsx`
- `client/src/components/wallet/WalletOverview/WalletOverview.tsx`
- `client/src/components/wrapper/PageWrapper.tsx`
- `client/src/api/alerts.ts`
