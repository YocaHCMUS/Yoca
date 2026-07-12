# Yoca Supplemental Token Insights Frontend Audit

## 1. Scope

This Phase 2B2B4B audit covers only the active supplemental token insight flow rendered from the Token Overview route `/tokens/:address`, specifically the `TokenInsightTabs` subsystem and its conditional Tokenomics and Investors content.

In scope:

- Supplemental insight mounting and tab visibility on `/tokens/:address`
- Token-to-supplemental-asset mapping and the supplemental metadata request lifecycle
- Conditional Tokenomics, Allocation, Unlock Schedule, and Investors panels
- Local calculations, formatting, loading, empty, error, fallback, and responsive behavior for those panels
- Supplemental-insight-specific code that exists but is not active from the current Token Overview route

Out of scope:

- Core About/Stats and core Holders behavior already covered in Phase 2B2B1
- Token AI Chat, Token News, Chart News markers, wash-trading entry, token markets, token charts, alerts, watchlist, pricing, payment, shared auth, shared shell, backend routes, backend services, databases, deployment, and Mermaid architecture
- Destination page internals for any route reached from a supplemental token panel, if any were present

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2A_MARKET_FRONTEND.md`, `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`, `02B2B2A_TOKEN_NEWS_FRONTEND.md`, `02B2B2B_TOKEN_CHART_NEWS_MARKERS_FRONTEND.md`, `02B2B3_TOKEN_AI_CHAT_FRONTEND.md`, and `02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered from the active supplemental insight flow, has a visible or lifecycle entry point, has connected frontend behavior, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected but has a confirmed limitation such as supported-token mapping dependency, hardcoded asset mapping, missing request error UI, partial-data rendering, local-only selected-tab state, missing refresh, incomplete responsive behavior, incomplete accessibility, or external-provider dependency.
- `FRONTEND_BROKEN`: visible supplemental insight capability exists but cannot complete its intended basic frontend role.
- `FRONTEND_UNUSED`: supplemental insight implementation exists but has no active render, request, or interaction chain from `/tokens/:address`.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `SUPP-01` through `SUPP-10`. Repeated evidence, helper details, style rows, frontend-flow descriptions, architecture blocks, and unused artifacts do not create additional capability counts.

## 3. Active render and call chain

`client/src/App.tsx` registers `/tokens/:address` with `TokenOverviewPage`. In `client/src/pages/token-overview/index.tsx`, `TokenInsightTabs` is rendered inside the right content column once the page has token metadata. The component receives the route `address`, plus `meta`, `market`, `holders`, and `holdersLoading`, but the supplemental request path itself uses `meta.symbol` and `meta.name` for asset mapping rather than the route address.

```text
/tokens/:address
`- TokenOverviewPage
   `- TokenInsightTabs
      |- core About/Stats tab, out of scope
      |- core Holders tab, out of scope
      |- Tokenomics tab, conditional
      |  |- TokenAllocation, conditional
      |  `- TokenUnlockSchedule, conditional
      `- Investors tab, conditional
         `- TokenInvestors, conditional
```

| Rendered or lifecycle block | File/component/function | Parent or caller | Activation condition | User purpose |
|---|---|---|---|---|
| Supplemental tab subsystem mount | `client/src/pages/token-overview/index.tsx` -> `TokenInsightTabs` | `TokenOverviewPage` | `address && details` | Hosts the conditional supplemental insight area. |
| Supplemental metadata bootstrap | `TokenInsightTabs` `useEffect(fetchMobula)` | `TokenInsightTabs` root | `meta.symbol` or `meta.name` changes after mount | Requests supplemental token metadata for the current mapped asset. |
| Tokenomics tab visibility | `hasTokenomics` | `TokenInsightTabs` tab bar | `allocation.length > 0 || releaseSchedule.length > 0` after loading | Reveals the Tokenomics tab only when data exists. |
| Investors tab visibility | `hasInvestors` | `TokenInsightTabs` tab bar | `investors.length > 0` after loading | Reveals the Investors tab only when data exists. |
| TokenAllocation rendering | `TokenAllocation` | `TokenInsightTabs` Tokenomics branch | Allocation data exists and Tokenomics tab is active | Renders the allocation chart. |
| TokenUnlockSchedule rendering | `TokenUnlockSchedule` | `TokenInsightTabs` Tokenomics branch | Release schedule data exists and Tokenomics tab is active | Renders unlock chart and upcoming unlock list. |
| TokenInvestors rendering | `TokenInvestors` | `TokenInsightTabs` Investors branch | Investors data exists and Investors tab is active | Renders investor cards. |
| Active-tab reset | `useEffect` in `TokenInsightTabs` | `TokenInsightTabs` root | A hidden tab remains selected after loading settles | Returns focus to the Stats tab when the selected supplemental tab disappears. |

## 4. Supplemental token inputs and asset mapping

| Input | Source | Destination | Usage | Missing-input behavior | Status |
|---|---|---|---|---|---|
| Route address | `TokenOverviewPage` route param | `TokenInsightTabs` prop only | Carries the current token context into the component tree | The supplemental metadata request does not use the address directly | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token symbol | `details?.symbol ?? ""` | `resolveAssetName` and supplemental request | Primary input for Mobula asset mapping | Falls back to the token name or an empty string | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token name | `details?.name ?? ""` | `resolveAssetName` and supplemental request | Secondary input for Mobula asset mapping | Falls back to the symbol or an empty string | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token description | `details?.description ?? null` | `TokenInsightTabs` prop only | Passed through with the page metadata | Not consumed by the supplemental request path in the inspected code | `FRONTEND_ACTIVE` |
| Theme | `useUserTheme()` | Charts and cards | Controls dark/light styling and chart colors | No request impact | `FRONTEND_ACTIVE` |
| Localization | `useLocalization()` | Labels, descriptions, and formatted values | Localizes visible copy and numeric formatting | No request impact | `FRONTEND_ACTIVE` |

`resolveAssetName(symbol, name)` strips `wrapped ` and `bridged ` prefixes from the token name, then maps common symbols and names such as `sol`, `eth`, `btc`, `matic`, `bnb`, `avax`, and others to Mobula asset slugs. If no mapping matches, it falls back to the normalized name or the lowercased symbol. The active supplemental request path does not use the route address as a request key.

### Complete frontend token-to-asset mapping

| Input key or alias | Resolved provider asset slug | Match source | Normalization applied | Limitation |
|---|---|---|---|---|
| `sol` | `solana` | Hardcoded `nameMap` entry | Lowercased symbol or name | Symbol/name collisions can map unrelated tokens to the same provider slug. |
| `ether` | `ethereum` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `eth` | `ethereum` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `bitcoin` | `bitcoin` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `btc` | `bitcoin` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `matic` | `polygon` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `bnb` | `binancecoin` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `avax` | `avalanche` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `arb` | `arbitrum` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `link` | `chainlink` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `ada` | `cardano` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `dot` | `polkadot` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `uni` | `uniswap` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `atom` | `cosmos` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `xlm` | `stellar` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `apt` | `aptos` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `sui` | `sui` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `op` | `optimism` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `near` | `near` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `fil` | `filecoin` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `algo` | `algorand` | Hardcoded `nameMap` entry | Lowercased symbol or name | Same collision risk applies. |
| `wrapped <name>` | Normalized non-wrapped name | Pre-map normalization | Splits on `" ("`, trims, lowercases, then removes the `wrapped ` prefix | Prefix removal broadens matching and can increase collisions. |
| `bridged <name>` | Normalized non-bridged name | Pre-map normalization | Splits on `" ("`, trims, lowercases, then removes the `bridged ` prefix | Prefix removal broadens matching and can increase collisions. |
| `name` with suffix | Normalized base name | Pre-map normalization | Splits on `" ("`, keeps the left side, trims, and lowercases | Descriptive suffixes are discarded before matching. |
| `symbol` fallback | Lowercased symbol or mapped slug | Final fallback path | Lowercases the symbol before map lookup | Different tokens with the same symbol can resolve to the same slug. |
| `normalized name` fallback | Normalized name | Final fallback path | Uses the cleaned name when no hardcoded alias matches | Unmapped names may still collide with other tokens or provider slugs. |
| `empty input` | Empty string | Final fallback path | Returns `""` when both normalized name and symbol are empty | The request can still be attempted with an empty asset query. |

The route token address is not used to identify the provider asset. Symbol/name collisions are therefore possible. Two unrelated tokens sharing a symbol or similar normalized name could resolve to the same provider slug. The audit does not determine whether every mapping is factually correct.

## 5. Canonical supplemental insight capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation |
|---|---|---|---|---|---|---|
| `SUPP-01` | Supplemental insight subsystem mount and shell | `TokenOverviewPage` renders the right content column | `TokenInsightTabs` | Renders the supplemental insight entry area inside the token page | `FRONTEND_ACTIVE` | Core tabs are present too, but are out of scope for this audit. |
| `SUPP-02` | Token-to-asset mapping and metadata request lifecycle | Component mount and token name or symbol change | `resolveAssetName`, Mobula fetch effect | Builds a Mobula asset slug and requests supplemental metadata | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Hardcoded symbol/name mapping, external-provider dependency, and collision risk from symbol/name-only matching. |
| `SUPP-03` | Conditional tab discovery, visibility, and active-tab reset | Mobula request settles and data arrays change | `hasTokenomics`, `hasInvestors`, `activeTab` reset effect | Reveals Tokenomics and Investors tabs only when data exists | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Local-only selected-tab state and visibility dependence on returned data. |
| `SUPP-04` | Tokenomics panel shell and subpanel composition | Tokenomics tab becomes active | `TokenInsightTabs` conditional branch | Renders Allocation and Unlock Schedule panels independently | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No dedicated error or loading UI for individual subpanels. |
| `SUPP-05` | Allocation display and chart rendering | Allocation data exists and Tokenomics tab is active | `TokenAllocation` | Renders allocation title, description, pie chart, and legend | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Response-shape assumptions and local top-8 truncation with Others aggregation. |
| `SUPP-06` | Unlock schedule display and timeline rendering | Release schedule data exists and Tokenomics tab is active | `TokenUnlockSchedule` | Renders cumulative unlock chart, custom legend, and upcoming unlock cards | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Uses local date math, month grouping, and limited upcoming-item slicing. |
| `SUPP-07` | Investor display and card rendering | Investors data exists and Investors tab is active | `TokenInvestors` | Renders investor cards with badges, country, image, and description | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No external links or investor detail navigation. |
| `SUPP-08` | Supplemental loading, empty, error, and fallback behavior | Mobula request lifecycle | `mobulaLoading`, silent catch, conditional tab gating | Hides unsupported tabs while loading or when data is absent | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No visible request error state and no manual refresh; unsupported-token, invalid-mapping, malformed-response, and request-failure cases converge to the same hidden-tab result. |
| `SUPP-09` | Local calculations, labels, and formatting | Allocation, unlock schedule, and investor panels render | Formatting helpers and chart builders | Computes percentages, cumulative unlock series, title cleanup, and card labels locally | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Derived values depend on response shape and local parsing. |
| `SUPP-10` | Responsive, accessibility, and navigation behavior | Tabs and panels render on different viewport sizes | SCSS modules and plain button/card markup | Wraps tabs, cards, and charts across narrow viewports | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No confirmed external navigation and limited ARIA tab semantics. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 1 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 9 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical supplemental capabilities** | 10 |

Validation: `1 + 9 + 0 + 0 + 0 = 10`, matching the 10 rows in the canonical supplemental capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Unused supplemental frontend artifacts | 0 |
| Out-of-scope components encountered | 2 |

The out-of-scope components encountered are the core About/Stats and core Holders sections that are rendered by the same `TokenInsightTabs` subsystem but are excluded by this phase.

## 6. Frontend requests

| Capability ID | Trigger | Frontend caller | API method or URL | Request input | Response usage | Error handling | Refresh/cache behavior | Status |
|---|---|---|---|---|---|---|---|---|
| `SUPP-02` | `TokenInsightTabs` mounts or `meta.symbol` / `meta.name` changes | `fetchMobula` inside `TokenInsightTabs` | Direct browser `fetch` to the provider metadata endpoint with `asset=<encoded asset slug>` and a redacted Authorization header | Query `asset` from `resolveAssetName(symbol, name)` plus `Authorization: [REDACTED FRONTEND-EMBEDDED PROVIDER CREDENTIAL]` | Consumes `json.data.distribution`, `release_schedule`, and `investors` | Non-OK responses and thrown errors are silently caught; tabs simply do not appear | No refresh button or polling; local cancellation flag prevents stale state writes after cleanup, but the request is not aborted | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Request behavior summary:

- Initial trigger: yes, on mount after token metadata is available
- Token dependency: yes, via `meta.symbol` and `meta.name`
- Route address dependency: no direct use in the supplemental request contract
- Tab-open dependency: no, the request starts before the user opens Tokenomics or Investors
- Per-token behavior: the request is attempted for every mounted token page
- Supported-token behavior: visible supplemental tabs require returned data from the request
- Manual refresh: none found
- Polling: none found
- AbortController: none found
- Stale-response guard: a local cancelled flag is present and prevents stale state writes after cleanup, but it does not abort the external request itself
- Deduplication: none found
- Behavior when the token changes: the effect reruns with the new mapped asset
- Usable-input behavior: the request is attempted whenever the component has usable symbol/name input, even if no hardcoded alias matches
- Unsupported-token behavior: a token is not necessarily skipped merely because it lacks a hardcoded mapping
- Failure ambiguity: unsupported-token, invalid-mapping, malformed-response, and request-failure cases can produce the same visible result because the supplemental tabs remain hidden

### Frontend credential exposure finding

| Security concern | Current frontend evidence | Architectural risk | Recommended remediation | Verification boundary |
|---|---|---|---|---|
| Credential visible in client bundle | The supplemental metadata request is issued directly from browser frontend code and includes a frontend-embedded provider credential in the Authorization header | Frontend bundle values are publicly observable by application users, so the credential does not provide server-side secrecy | Move the provider request behind a controlled backend endpoint or proxy and rotate the exposed credential according to provider guidance | External-provider boundary and credential-handling review |
| Direct browser-to-provider request | `TokenInsightTabs` calls the provider metadata endpoint directly from the browser | No server-side policy, allowlist, or abuse control is enforced by Yoca for this request path | Proxy the request through Yoca backend policy and logging | External-provider boundary review |
| Provider quota exposure | The request targets a third-party metadata endpoint from the client with a reusable credential | Browser-visible credentials can be copied, reused, or rate-abused outside intended app flows | Rotate the credential and move access control to the backend | Provider usage and rotation review |
| Missing server-side request policy | The frontend performs the request without a Yoca-controlled intermediary | Yoca cannot enforce request shaping, throttling, or audit policy from the browser alone | Introduce a backend mediation layer with request validation | Architecture hardening review |
| Credential rotation requirement | The embedded credential is present in frontend source and therefore should be treated as exposed to users | If the credential is reused elsewhere, it can widen the blast radius of rotation or abuse | Rotate or replace the credential after moving the request behind controlled infrastructure | Provider guidance and secrets review |
| Client-side provider dependency | Supplemental tokenomics and investor data depend on browser access to the provider endpoint | A provider outage, quota issue, or policy change directly affects visibility of supplemental tabs | Decouple the UI from direct provider access through a backend contract | External-provider dependency review |

## 7. Supplemental tab visibility and default active tab

| Visibility concern | Current behavior | Dependency | User-visible effect | Status |
|---|---|---|---|---|
| Base tab bar | The tab bar always renders the core tabs plus any supplemental tabs that have data | `TokenInsightTabs` render | Users always see the base tab chrome | `FRONTEND_ACTIVE` |
| Tokenomics tab | Renders only when allocation or unlock schedule data exists after loading | `hasTokenomics` | The Tokenomics tab appears only for supported tokens with metadata | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Investors tab | Renders only when investors data exists after loading | `hasInvestors` | The Investors tab appears only for supported tokens with investor metadata | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Active tab default | State starts at `0` | Local `useState(0)` | About/Stats remains the default tab while supplemental tabs are absent or newly appearing | `FRONTEND_ACTIVE` |
| Hidden-tab reset | If Tokenomics or Investors disappears while selected, state resets to `0` | `useEffect` in `TokenInsightTabs` | Users are returned to About/Stats instead of seeing an empty tab shell | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Supplemental tab persistence | Tab choice is local only | `activeTab` state | Tab state is not persisted to URL, storage, or shared context | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

The supplemental tabs do not auto-select when they first appear. If a previously selected supplemental tab becomes hidden because the next token has no data, the component resets to the Stats tab.

## 8. Tokenomics panel rendering

`TokenInsightTabs` renders the Tokenomics tab only when either allocation data or unlock schedule data exists. Inside that tab, `TokenAllocation` and `TokenUnlockSchedule` are rendered independently, so a token can show one or both panels.

| Tokenomics panel behavior | Implementation | Displayed output | Limitation | Status |
|---|---|---|---|---|
| Tokenomics tab shell | Conditional branch in `TokenInsightTabs` | Tab wrapper containing one or two tokenomics panels | Tab exists only for supported tokens with metadata | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Allocation panel presence | `allocation.length > 0` | Allocation chart card | No separate allocation empty state is rendered inside the tab | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Unlock schedule panel presence | `releaseSchedule.length > 0` | Unlock chart card and upcoming list | No separate unlock empty state is rendered inside the tab | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Mixed availability | Either array can be present alone | The tab can render just one subpanel | Tab visibility is coarse, but subpanels are data-driven | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 9. Allocation display and chart rendering

`TokenAllocation` is a display-only component. It does not fetch data. It receives the mapped supplemental allocation array from `TokenInsightTabs`.

| Allocation concern | Current behavior | Implementation | Limitation | Status |
|---|---|---|---|---|
| Title and description | Renders a tokenomics title and short explanation | `TokenAllocation` markup | Uses local title text and a simple description, not a live narrative | `FRONTEND_ACTIVE` |
| Pie chart | Renders a pie chart through ECharts | `ReactECharts` | Fixed chart sizing and no separate mobile model | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Legend | Renders a right-side legend with percentages | ECharts legend formatter | Legend text is truncated after 20 characters | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Data ordering | Displays the supplied allocation array in order | Parent pre-sorts by percentage | The component assumes the distribution array is already meaningful | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Display fields | `name` and `percentage` | Chart series and legend | No link-out, address, or source field is rendered | `FRONTEND_ACTIVE` |

Local allocation behavior:

- Parent sorts allocation items descending by percentage
- If more than eight entries exist, the first eight are kept and the rest are aggregated into `Others`
- The chart uses a fixed color palette
- The chart tooltip formats values as percentages with two decimal places
- `displayCleanName` strips anything after `(` and falls back to the symbol when the token name is absent or `Unknown Token`

## 10. Unlock schedule display and timeline rendering

`TokenUnlockSchedule` is display-only. It receives the release schedule array from `TokenInsightTabs` and renders both a cumulative chart and a list of upcoming unlock events.

| Unlock schedule concern | Current behavior | Implementation | Limitation | Status |
|---|---|---|---|---|
| Unlock chart | Renders a stacked cumulative line/area chart | `ReactECharts` | Uses fixed chart dimensions and category-axis month labels | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Legend | Renders a wrapped legend below the chart | Custom HTML legend | Legend is local and not interactive | `FRONTEND_ACTIVE` |
| "Now" marker | Marks the current date on the last series | `getNowXAxisIndex` and ECharts markLine | Marker position is interpolated from local month labels | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Upcoming list | Renders the first five future unlock events | `UpcomingList` | Uses local date math and a capped slice of the future events | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Display fields | `unlock_date`, `tokens_to_unlock`, `allocation_details` | Chart and list rendering | No external link or drilldown is rendered | `FRONTEND_ACTIVE` |

Local unlock schedule behavior:

- `allocation_details` keys are merged into a category set
- Events are sorted by `unlock_date`
- Cumulative totals are built per category
- Duplicate month labels are deduped by keeping the highest cumulative value for that month
- Upcoming items are filtered to `unlock_date >= Date.now()`
- Upcoming chips sort categories by amount and format values into B, M, K, or raw counts

## 11. Investors display and card rendering

`TokenInvestors` is display-only. It receives investor data from `TokenInsightTabs` and renders a responsive card grid.

| Investor concern | Current behavior | Implementation | Limitation | Status |
|---|---|---|---|---|
| Card grid | Renders a responsive grid of investor cards | `TokenInvestors` + CSS grid | No table, pagination, or drilldown is provided | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Display fields | `name`, `type`, `lead`, `country_name`, `description`, `image` | Card header and body | No external destination or investor detail navigation is rendered | `FRONTEND_ACTIVE` |
| Lead badge | Adds a visible lead badge when `lead` is true | Badge markup | Lead ordering is done in the parent, not locally in the card | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Fallback image | Uses an initial-based placeholder when no image exists | Local placeholder | Placeholder can hide upstream image quality issues | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Description truncation | Clamps description text to three lines | CSS clamp | Long descriptions are truncated without expansion | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

The parent sorts investors so `lead` entries appear first before rendering the cards. No investor links, map, or external navigation are present in the active panel.

## 12. Loading, empty, error, and fallback behavior

| State or action | Loading UI | Empty UI | Error UI | Partial-data behavior | Retry/fallback | Status |
|---|---|---|---|---|---|---|
| Mobula request in flight | Supplemental tabs are hidden while `mobulaLoading` is true | N/A | No visible error state | Core tabs remain visible while supplemental data loads | Wait for the request to settle | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Request failure | Tabs stay hidden if no data is returned | The panel set simply does not appear | No visible error UI; the catch block is silent | Unsupported or failed tokens look the same to the user | No manual retry control | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| No allocation data | Tokenomics tab is omitted unless release schedule exists | N/A | N/A | Allocation panel does not render on its own | N/A | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| No unlock data | Tokenomics tab is omitted unless allocation exists | N/A | N/A | Unlock panel does not render on its own | N/A | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| No investors data | Investors tab is omitted | N/A | N/A | Investors panel does not render | N/A | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Hidden tab selected | Active tab resets to Stats | N/A | N/A | The component avoids rendering an empty hidden tab | Local reset only | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Unsupported-token, invalid-mapping, malformed-response, and request-failure cases can therefore converge on the same visible outcome: the supplemental tabs remain hidden and the UI does not distinguish the cause.

## 13. Local calculations, labels, and formatting

| Derived value | Source fields or helper | Frontend transformation | Missing or invalid-value behavior | Capability ID |
|---|---|---|---|---|
| Mobula asset slug | `meta.symbol`, `meta.name` | `resolveAssetName` strips `wrapped` and `bridged` prefixes and applies a hardcoded symbol/name map | Falls back to normalized symbol or name, or an empty string | `SUPP-02` |
| Tokenomics tab eligibility | Allocation and release arrays | `hasTokenomics` checks both arrays after loading | Missing data hides the tab entirely | `SUPP-03` |
| Investor tab eligibility | Investors array | `hasInvestors` checks array length after loading | Missing data hides the tab entirely | `SUPP-03` |
| Allocation top-N | Allocation array | Parent sorts descending and collapses entries beyond eight into `Others` | No separate overflow explanation is rendered | `SUPP-05` |
| Unlock schedule category series | `allocation_details` keys | Builds cumulative monthly series per category | Missing categories are simply absent from the chart | `SUPP-06` |
| Now position | `unlock_date` month labels | `getNowXAxisIndex` interpolates the current month on the category axis | If dates are missing, the marker is omitted | `SUPP-06` |
| Upcoming-event timing | `unlock_date` | `Math.ceil` computes days remaining | Past events are excluded from the upcoming list | `SUPP-06` |
| Amount formatting | Allocation percentages and unlock token counts | Formats into B, M, K, or raw counts | Uses local number thresholds only | `SUPP-05`, `SUPP-06` |
| Investor ordering | `lead` boolean | Parent sorts lead investors first | Sorting is local and display-only | `SUPP-07` |

This section documents frontend formatting and derivation only. It does not evaluate tokenomics accuracy.

## 14. Navigation, accessibility, and responsive behavior

No external router links or external destination anchors were confirmed in the active supplemental token insight panels. The supplemental feature set is display-first.

| Concern | Current behavior | Implementation | Limitation | Status |
|---|---|---|---|---|
| External navigation | None confirmed in the active supplemental panels | No `Link` or `href` elements were found in `TokenAllocation`, `TokenUnlockSchedule`, or `TokenInvestors` | There is no supplemental navigation flow to verify | `FRONTEND_ACTIVE` |
| Tab semantics | Tab buttons are plain buttons in a wrapper div | `TokenInsightTabs` | No explicit ARIA tablist/tab/tabpanel structure was confirmed | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Keyboard access | Buttons are keyboard-focusable by default | Browser semantics | No separate keyboard shortcut or roving-tabindex behavior was confirmed | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Responsive tabs | Buttons wrap across lines on narrow screens | SCSS `tabs` wraps | No horizontal scroller or condensed mobile tab rail | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Responsive tokenomics | Charts keep fixed heights and wrap with the page layout | ECharts plus surrounding CSS | No mobile-specific chart simplification was confirmed | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Responsive investors | Cards auto-fill to a minimum width of 280px | CSS grid | Card density changes only through wrapping | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 15. Unused or disconnected supplemental code

| Candidate | File/component/function | Active caller found from `/tokens/:address` | Reason excluded | Classification |
|---|---|---|---|---|
| None confirmed | N/A | N/A | No unused supplemental frontend artifact outside the active `TokenInsightTabs` flow was confirmed during this phase | `FRONTEND_UNUSED` count 0 |

No disconnected supplemental-insight-only component was confirmed. The core About/Stats and Holders content is present in `TokenInsightTabs`, but those sections are out of scope rather than unused.

## 16. Frontend-only flows

### Flow A - Mount the supplemental insight subsystem

1. User opens `/tokens/:address`.
2. `TokenOverviewPage` renders `TokenInsightTabs`.
3. `TokenInsightTabs` mounts with the page token metadata.
4. The Mobula metadata request starts immediately.
5. Supplemental tabs stay hidden until the request settles and data exists.

### Flow B - Resolve supported supplemental metadata

1. `TokenInsightTabs` normalizes the token symbol and name into a Mobula asset slug.
2. The frontend issues one Mobula metadata request per mounted token view.
3. The response is inspected for allocation, release schedule, and investor arrays.
4. Tokenomics or Investors tabs appear only if corresponding data exists.

### Flow C - Open Tokenomics

1. User clicks the Tokenomics tab when it is visible.
2. The tab shell shows Allocation and Unlock Schedule panels independently.
3. If only one data set exists, only that panel renders.
4. The tab remains local-state driven and does not change the URL.

### Flow D - View allocation or unlock details

1. User opens Allocation or Unlock Schedule from the Tokenomics tab.
2. Allocation renders a pie chart and legend from the returned distribution.
3. Unlock Schedule renders the cumulative unlock chart and upcoming unlock cards.
4. Local formatting turns numbers into readable chart labels and chips.

### Flow E - Open Investors

1. User clicks the Investors tab when it is visible.
2. Investor cards render from the returned investor list.
3. Lead investors are displayed first.
4. No investor link-out or expansion path is provided.

### Flow F - Token change or data loss

1. The route token changes or the response data disappears.
2. The request effect reruns for the new mapped token.
3. Allocation, release schedule, and investor arrays are cleared during the refresh cycle.
4. If the selected supplemental tab is no longer valid, the component returns to the Stats tab.

## 17. Architecture-ready summary

### Confirmed supplemental insight frontend blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Supplemental insight shell | `SUPP-01`, `SUPP-03` | `TokenOverviewPage`, `TokenInsightTabs` | Mounts the supplemental area and controls conditional tab visibility | High-level supplemental insight node. |
| Supplemental metadata request layer | `SUPP-02`, `SUPP-08` | `TokenInsightTabs`, `resolveAssetName` | Maps token identity to a Mobula asset slug and loads supplemental metadata | Frontend-to-external-provider boundary. |
| Tokenomics view | `SUPP-04`, `SUPP-05`, `SUPP-06`, `SUPP-09` | `TokenAllocation`, `TokenUnlockSchedule` | Renders allocation and unlock schedule panels with local formatting and charting | Core supplemental tokenomics block. |
| Investors view | `SUPP-07`, `SUPP-09`, `SUPP-10` | `TokenInvestors` | Renders investor cards and their responsive presentation | Core supplemental investors block. |

### Supplemental insight external-provider boundary

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| Supplemental metadata loader | Mobula token metadata | Direct `fetch` to `https://api.mobula.io/api/1/metadata?asset=...` | Load tokenomics and investor metadata for the mapped token asset | `TokenInsightTabs` mount and token name/symbol changes | `client/src/components/token/TokenInsightTabs.tsx` |

### Capabilities eligible for later verification

Only canonical IDs that issue requests, depend on returned supplemental metadata, depend on response shape, or need failure-mode verification are listed:

1. `SUPP-02` Token-to-asset mapping and metadata request lifecycle
2. `SUPP-03` Conditional tab discovery, visibility, and active-tab reset
3. `SUPP-04` Tokenomics panel shell and subpanel composition
4. `SUPP-05` Allocation display and chart rendering
5. `SUPP-06` Unlock schedule display and timeline rendering
6. `SUPP-07` Investor display and card rendering
7. `SUPP-08` Supplemental loading, empty, error, and fallback behavior
8. `SUPP-09` Local calculations, labels, and formatting
9. `SUPP-10` Responsive, accessibility, and navigation behavior

## 18. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should the Mobula request be aborted instead of only ignored through a cancellation flag? | The effect prevents stale writes, but no network abort was confirmed | Supplemental insights hardening |
| Should unsupported tokens show an explicit fallback message instead of hiding the conditional tabs? | Failed or unsupported requests simply leave the supplemental area empty | Supplemental UX hardening |
| Should the hardcoded Mobula authorization token be moved out of the frontend? | The current request includes a visible Authorization header | External-provider integration review |
| Should Tokenomics and Investors tabs auto-select when they first become available? | The current state stays on the Stats tab unless a hidden tab was previously selected | Supplemental UX review |
| Should the supplemental tabs expose stronger ARIA tab semantics? | The current implementation uses plain buttons without a confirmed tablist pattern | Accessibility review |
| Should investor cards expose external profile or source links if the metadata provides them? | The current card renderer is display-only | Product review |

## 19. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2A_MARKET_FRONTEND.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `docs/architecture/audit/02B2B2A_TOKEN_NEWS_FRONTEND.md`
- `docs/architecture/audit/02B2B2B_TOKEN_CHART_NEWS_MARKERS_FRONTEND.md`
- `docs/architecture/audit/02B2B3_TOKEN_AI_CHAT_FRONTEND.md`
- `docs/architecture/audit/02B2B4A_TOKEN_WASH_TRADING_ENTRY_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/TokenInsightTabs.tsx`
- `client/src/components/token/TokenAllocation.tsx`
- `client/src/components/token/TokenUnlockSchedule.tsx`
- `client/src/components/token/TokenInvestors.tsx`
- `client/src/components/token/TokenInsightTabs.module.scss`
- `client/src/components/token/TokenAllocation.module.scss`
- `client/src/components/token/TokenInvestors.module.scss`
- `client/src/components/token/index.ts`
