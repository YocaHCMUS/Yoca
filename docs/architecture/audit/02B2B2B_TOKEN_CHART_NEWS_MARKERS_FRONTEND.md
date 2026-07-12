# Yoca Token Chart News Markers Frontend Audit

## 1. Scope

This Phase 2B2B2B audit covers only the active chart-linked news-marker frontend rendered from the Token Overview route `/tokens/:address`, specifically the chart-news behavior inside `TokenOverviewChart`.

In scope:

- Chart-news marker mounting, requests, state, popup, summary request path, and external article links
- News-event timestamp normalization and mapping onto chart points
- Marker generation, marker tooltip, marker click handling, selected-event state, and popup behavior
- Range-, mode-, and token-dependent chart-news behavior
- Chart-news-specific loading, empty, error, stale-data, fallback, responsive, and disconnected-code behavior

Out of scope:

- `NewsTab` and normal Token News feed behavior
- Ask Yoca token AI chat and general AI analysis
- Core line/candle chart behavior except where needed to explain marker placement
- Tokenomics, investors, wash-trading, alerts, watchlist, pool-detail, historical-data, wallet pages, shared authentication, shared shell, backend/provider implementations, deployment, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2A_MARKET_FRONTEND.md`, `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`, and `02B2B2A_TOKEN_NEWS_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered from the active chart-news flow, has a visible or lifecycle entry point, has connected frontend behavior, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected but has a confirmed limitation such as timestamp-alignment assumptions, missing cancellation, missing stale-request protection, limited accessibility, missing validation, unsupported chart mode, incomplete loading feedback, or external/summary dependency.
- `FRONTEND_BROKEN`: visible chart-news capability exists but cannot complete its intended basic frontend role.
- `FRONTEND_UNUSED`: chart-news frontend implementation exists but has no active render, request, or interaction chain from `/tokens/:address`.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `CHART-NEWS-01` through `CHART-NEWS-14`. Repeated evidence, event fields, ECharts option details, formatting helpers, responsive rows, frontend flows, architecture blocks, and unused artifacts do not create additional capability counts.

## 3. Active Chart News render and call chain

`client/src/App.tsx` registers `/tokens/:address` with `TokenOverviewPage`. `client/src/pages/token-overview/index.tsx` renders `TokenOverviewChart` inside the `#token-overview` section when `address` exists. Inside `TokenOverviewChart`, chart-news logic is mounted regardless of whether the visible chart is currently line or candle mode, but marker rendering itself is only visible in the non-candle `ReactECharts` path.

```text
/tokens/:address
`- TokenOverviewPage
   `- TokenOverviewChart
      |- chart data effect
      |- chart-news event effect
      |- line-chart ECharts option
      |  `- News markers scatter series
      |- chart click handler
      |  `- summary request on marker click, when summary is absent
      |- selected-event popup, when selectedNewsEvent exists
      `- marker status line, when !loading && seriesData.length > 0
```

| Rendered or lifecycle block | File/component/function | Parent or caller | Activation condition | User purpose |
|---|---|---|---|---|
| Token Overview chart mount | `client/src/components/token/TokenOverviewChart.tsx` | `TokenOverviewPage` | `address` exists | Hosts core chart and chart-news subsystem. |
| Chart-news event effect | `TokenOverviewChart` `useEffect(fetchNewsEvents)` | `TokenOverviewChart` | `address`, `symbol`, `name`, or `newsTimeframe` changes | Loads chart-news events for the current token and chart range bucket. |
| Event request service | `client/src/services/tokenChartNewsEvents.ts` `getTokenChartNewsEvents` | Chart-news event effect and marker-click handler | Active caller issues event or summary request | Frontend contract for chart-news event data. |
| Marker mapping | `TokenOverviewChart` `newsMarkerData` | `TokenOverviewChart` render | `seriesData.length > 0 && newsEvents.length > 0` | Maps returned events onto visible chart points. |
| Marker layer | `TokenOverviewChart` ECharts option `series[1]` | `ReactECharts` line/market-cap chart | `mode !== "candle"` and `newsMarkerData` available | Displays clickable chart markers. |
| Marker click handler | `TokenOverviewChart` `handleChartClick` | `ReactECharts` `onEvents.click` | Clicked ECharts series is `"News markers"` | Selects a marker and optionally requests its summary. |
| Selected-event popup | `TokenOverviewChart` JSX `selectedNewsEvent && ...` | Chart wrapper | `selectedNewsEvent` exists | Shows selected event metadata, summary state, and source articles. |
| Marker status text | `TokenOverviewChart` `.newsMarkerStatus` | `TokenOverviewChart` root | `!loading && seriesData.length > 0` | Shows loading/error/empty/count status for markers. |

## 4. Chart News inputs

| Input | Source | Destination | Usage | Missing-input behavior | Status |
|---|---|---|---|---|---|
| Token address | Route param through `TokenOverviewPage` | `TokenOverviewChart`, event request, summary request | Sent in every chart-news request | If missing, effect clears events and selection | `FRONTEND_ACTIVE` |
| Token symbol | `details?.symbol ?? ""` from `TokenOverviewPage` | `TokenOverviewChart`, event request, summary request | Sent in every chart-news request | If empty, event effect clears events and selection and does not request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token name | `details?.name ?? ""` from `TokenOverviewPage` | `TokenOverviewChart`, event request, summary request | Sent in every chart-news request | If empty, event effect clears events and selection and does not request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Chart range | `TokenOverviewChart` local `range` | `getNewsTimeframe`, event request, summary request | Determines chart-news timeframe bucket | Range changes trigger a new chart-news request | `FRONTEND_ACTIVE` |
| News timeframe bucket | `getNewsTimeframe(range.days)` | Event request and summary request | Sent as `24h`, `7d`, `1m`, `3m`, or `1y` | No fallback outside the defined day buckets beyond `1y` | `FRONTEND_ACTIVE` |
| Line-chart points | `prices` or `marketCaps` as `seriesData` | Marker mapping and ECharts scatter series | Provides timestamps and Y values for nearest-point placement | If empty, no marker data is generated | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Selected chart metric | `mode` and `lineMode` | Marker mapping and line-chart series selection | Chooses whether markers map onto price or market-cap series | No dedicated reset when switching between line metrics | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Candle mode | `mode === "candle"` | Render branch only | Hides ECharts marker layer because candle iframe replaces line chart | Event requests still run even though markers are not visible | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Language | `useLocalization().lang` | Date formatters for popup and tooltip | Chooses `vi-VN` or `en-US` date locale | Popup/status copy itself is mostly hardcoded English | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Theme | Global `[data-yoca-theme]` styling | Popup and article styles | Affects popup/article visual styling only | Not an API input | `FRONTEND_ACTIVE` |
| Existing event list | `newsEvents` state | Marker mapping, status text, popup summary cache | Provides cached events and summary-bearing events | Old events can persist during new requests | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Chart-news requests depend on `address`, `symbol`, `name`, and the range-derived `newsTimeframe`. They do not wait for chart data to load before issuing the request. Marker placement itself depends on chart points being available.

## 5. Canonical Token Chart News capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation |
|---|---|---|---|---|---|---|
| `CHART-NEWS-01` | Chart-news subsystem initialization | `TokenOverviewChart` mount with token identity present | `TokenOverviewChart` chart-news state and effects | Initializes event, selection, summary, and status state | `FRONTEND_ACTIVE` | Marker visibility still depends on non-candle chart mode and chart data. |
| `CHART-NEWS-02` | Range-to-timeframe mapping | Chart range selection or initial default range | `getNewsTimeframe(range.days)` | Converts day ranges into request timeframe buckets | `FRONTEND_ACTIVE` | Timeframe buckets are coarse and fixed to five values. |
| `CHART-NEWS-03` | Event request lifecycle | Initial chart render and token/range changes | `fetchNewsEvents` effect -> `getTokenChartNewsEvents` | Requests chart-news events without summaries | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No cancellation, deduplication, or stale-request protection was confirmed. |
| `CHART-NEWS-04` | Event timestamp normalization and nearest-point matching | Event list and chart series are available | `Date.parse`, `getClosestChartPoint`, `newsMarkerData` | Parses event timestamp and maps to nearest chart point | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No range-boundary guard; out-of-range or future events can pin to the nearest endpoint. |
| `CHART-NEWS-05` | Marker generation and insertion | Marker data is available in line/market-cap mode | ECharts option `series[1]` scatter layer | Inserts pin markers with article-count labels into the chart option | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No overlap handling, deduplication, max-count limit, or importance filtering was confirmed. |
| `CHART-NEWS-06` | Marker hover/status display | Marker layer is rendered and chart has data | ECharts tooltip and `.newsMarkerStatus` | Shows marker hover tooltip and chart-level marker status text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Tooltip/status copy is mostly hardcoded and not fully localized. |
| `CHART-NEWS-07` | Marker selection | User clicks a chart marker | `handleChartClick`, `selectedNewsEvent` | Selects the clicked marker event | `FRONTEND_ACTIVE` | No toggle-off on repeated marker click was confirmed. |
| `CHART-NEWS-08` | Selected-event popup display | `selectedNewsEvent` exists | `TokenOverviewChart` popup JSX | Renders popup header, meta, summary area, and article list | `FRONTEND_ACTIVE` | Popup overlays the chart and can obscure chart area. |
| `CHART-NEWS-09` | Summary request on marker click | User clicks a marker whose event has no summary | `handleChartClick` -> `getTokenChartNewsEvents(includeSummary: true, date)` | Requests a summary-bearing event set for the clicked event date | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Uses date rather than event ID/content hash; rapid marker changes can race with `newsSummaryLoading`. |
| `CHART-NEWS-10` | Summary rendering and plan/auth feedback | Summary request resolves or fails | Popup summary branch | Renders summary headline, bullets, provider, usage, auth error, or upgrade-path link | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Summary state depends on external/backend summary generation and hardcoded fallback copy. |
| `CHART-NEWS-11` | Popup article list and external links | Selected event has articles | Popup article list JSX | Renders source articles and opens them externally | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Links use raw URLs and `rel="noreferrer"` only; no URL validation. |
| `CHART-NEWS-12` | Popup dismissal and selection reset | Close button, missing identity, or new event request | Popup close button and `fetchNewsEvents` effect | Clears `selectedNewsEvent` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No chart-background click or Escape-key dismissal was confirmed. |
| `CHART-NEWS-13` | Range-, mode-, and token-change behavior | User changes range, metric, chart mode, or route token | Chart-news effect, marker mapping, render branches | Re-requests events for range/token changes and remaps markers to current series | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Mode changes do not trigger a news request and do not fully clear stale marker state; candle mode hides markers but can leave popup/status state active. |
| `CHART-NEWS-14` | Chart-news loading, empty, error, and stale-data handling | Event request lifecycle and summary lifecycle | `newsLoading`, `newsError`, popup summary branches, status line | Shows loading/error/empty text and summary-loading branches | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Old events remain in state during new requests, enabling stale markers when chart data returns earlier than event data. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 4 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 10 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical Chart News capabilities** | 14 |

Validation: `4 + 10 + 0 + 0 + 0 = 14`, matching the 14 rows in the canonical Token Chart News capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Unused Chart News code artifacts | 4 |
| Deferred general-AI boundaries | 1 |
| Out-of-scope components encountered | 2 |

The deferred general-AI boundary is sibling `TokenAIChat` in `TokenOverviewPage`. The out-of-scope components encountered are `NewsTab` and `GeckoTerminalChart`.

## 6. Chart News frontend API calls

| Capability ID | Trigger | Frontend caller | API method or URL | Request input | Response usage | Error handling | Refresh/cache behavior | Status |
|---|---|---|---|---|---|---|---|---|
| `CHART-NEWS-03` | Initial line-chart render and any `address`, `symbol`, `name`, or `newsTimeframe` change | `TokenOverviewChart` `fetchNewsEvents` effect | `getTokenChartNewsEvents` -> `client.api["token-chart-news-events"].$get` | Query `{ address, symbol, name, timeframe, includeSummary: "false" }` | Stores `data.events` into `newsEvents` for marker generation | On failure logs to console, clears `newsEvents`, and sets `newsError` | No SWR/cache layer; no manual refresh; old `newsEvents` remain until success/failure settles | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| `CHART-NEWS-09` | User clicks a marker whose event has no summary and `newsSummaryLoading` is false | `handleChartClick` | Same service and same frontend endpoint | Query `{ address, symbol, name, timeframe, includeSummary: "true", date: event.date }` | Finds the matching returned event by `date`, updates cached `newsEvents`, updates `selectedNewsEvent`, and stores `usage` | API error can open login modal on 401, set upgrade path for feature/limit errors, and render popup error text | No request cancellation; if another marker is clicked while loading, the second unsummarized click does not start a new request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Request behavior summary:

- Initial trigger: yes, once token identity and default range resolve.
- Address dependency: yes.
- Range dependency: yes, through `newsTimeframe`.
- Start/end timestamp dependency: none confirmed; requests use timeframe buckets, not computed chart start/end timestamps.
- Dependency on loaded chart points: no for the request itself; yes for marker placement.
- Trigger from marker click: yes, summary request only.
- Parallel/sequential behavior: event request and core chart request run independently; summary request is user-driven after marker click.
- Polling: none found.
- Manual refresh: none found.
- Local cache: `newsEvents` and per-event `summary` live in component state only.
- Request cancellation: none found.
- Stale-response handling: none found.
- Deduplication: none found.
- Behavior when address changes: request reruns; existing events are not cleared immediately.
- Behavior when range changes quickly: request reruns, but earlier responses can still land because no cancellation/stale guard is present.
- Behavior when chart mode changes: no chart-news request is triggered by mode changes alone.

## 7. News-event response shape

| Used event field | Component/function | Response field | Frontend usage | Missing-value behavior | Status |
|---|---|---|---|---|---|
| Event date key | `handleChartClick` | `event.date` | Sent back in summary request and used to find summarized event in returned list | If missing or duplicated, matching becomes ambiguous | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Event timestamp | `newsMarkerData`, `formatEventDate`, tooltip, popup | `event.timestamp` | Parsed for marker placement and shown in hover/popup date text | Invalid timestamp drops marker or falls back to raw string in popup title formatter | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article count | Marker label, tooltip, popup meta, status | `event.articleCount` | Shows count on marker label and popup | Missing value renders empty label or awkward text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary object | Popup summary branch | `event.summary` | Determines whether click needs a summary request and what summary UI renders | Null triggers loading/request or "Summary unavailable" | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary headline | Popup | `event.summary.headline` | Renders summary title | Missing field would render empty heading | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary bullets | Popup | `event.summary.bullets` | Renders bullet list | Assumes array exists when summary exists | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary provider | Popup | `event.summary.provider` | Renders provider text when present | Missing provider simply omits provider row | `FRONTEND_ACTIVE` |
| Articles list | Popup | `event.articles` | Drives popup article cards and links | Empty list yields no article items | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article URL | Popup article link | `article.url` | Anchor key and `href` | No validation before render | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article title | Popup article item | `article.title` | Renders article title | No explicit fallback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article source | Popup article item | `article.source` | Renders source text and placeholder initial | `article.source.trim()` assumes string exists | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article published date | Popup article item | `article.publishedAt` | Formats article timestamp in meta row | Invalid/missing values are omitted | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article description | Popup article item | `article.description` | Renders clamped description when truthy | Missing description omits description block | `FRONTEND_ACTIVE` |
| Article image | Popup article item | `article.imageUrl`, `article.favicon` | Renders thumbnail image or placeholder initial | Image failure hides image without replacing it | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Usage info | Popup summary footer | `data.usage.remaining`, `limit`, `disabled` | Shows remaining summaries count after successful summary fetch | Hidden when absent or disabled | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Upgrade path | Popup summary error branch | `error.upgradePath` from API error | Renders Upgrade plan link on gated summary failure | No link validation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Unused response/type fields in the active popup path include `summary.tldr`, `summary.themes`, `summary.confidence`, `summary.riskNote`, `summary.generatedAt`, article `score`, `matchedBy`, `sourceType`, and data `meta`, `token`, `updatedAt`, `counted`.

## 8. Event timestamp normalization

| Timestamp concern | Current behavior | Function/helper | Failure or edge-case behavior | Status |
|---|---|---|---|---|
| Event timestamp parsing | Uses `Date.parse(event.timestamp)` | `newsMarkerData` mapper | Invalid timestamps drop the marker entirely | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Display timestamp formatting | Uses `new Date(timestamp)` and `toLocaleDateString`/`toLocaleString` | `formatEventDate`, `formatArticleDate` | Invalid popup event timestamp falls back to raw string; invalid article date becomes empty string | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Time-zone handling | Popup event dates use explicit `timeZone: "UTC"`; article dates do not specify UTC | `formatEventDate`, `formatArticleDate` | Event date and article date can use different timezone rules | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Marker placement basis | Uses nearest visible chart point by absolute timestamp distance | `getClosestChartPoint` | Placement is not exact event timestamp; Y value is borrowed from closest chart point | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Start/end range filtering | No explicit frontend range-boundary check beyond requested timeframe and current series points | `newsMarkerData` + request timeframe | Out-of-range events can pin to the nearest endpoint if returned | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Multiple events on same point | No grouping beyond whatever the response already grouped | `newsMarkerData` scatter array | Multiple events can overlap visually if they resolve to the same point | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Future-dated events | No frontend guard | `Date.parse` + nearest-point mapping | Future events can pin to the last available point | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Marker placement is nearest chart point matching, not exact timestamp plotting, not start-of-day alignment, and not category-axis indexing.

## 9. Marker generation

| Marker concern | Current behavior | Implementation | Limitation | Status |
|---|---|---|---|---|
| Target series | Markers are rendered as their own scatter series over the line chart | ECharts `series[1]` with `type: "scatter"` | No markers in candle iframe mode | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Marker symbol | Uses `"pin"` marker symbol | ECharts scatter `symbol: "pin"` | No marker-type variation by event category | `FRONTEND_ACTIVE` |
| Marker size | Fixed size 34 | ECharts scatter `symbolSize: 34` | No density-based resizing or responsive change | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Marker label | Displays article count on marker | Scatter `label.formatter` reads `event.articleCount` | Missing count yields empty label | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Marker payload | Stores `{ value: [closestTs, closestY], event }` | `newsMarkerData` mapping | Relies on raw event object staying attached to scatter point | `FRONTEND_ACTIVE` |
| Hover tooltip | Shows formatted event date and article count | Scatter `tooltip.formatter` | Hardcoded English copy; no localization | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Marker styling | Yellow pin with dark border and black label text | Scatter `itemStyle`, `label` | Color is static and meaning is color-only | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Importance/source filtering | None confirmed | No additional frontend filter after request | All returned events are mapped if timestamp parses | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Price vs market-cap mode | Uses current `seriesData`, so markers map onto price points or market-cap points | `seriesData = mode === "price" ? prices : marketCaps` | Mode `"candle"` also selects `marketCaps` for mapping even though markers are not rendered | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Maximum marker count/overlap control | None confirmed | None | Dense event sets can overlap and remain unreadable | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 10. Marker display and accessibility

| User interaction concern | Desktop behavior | Keyboard/touch behavior | Accessibility evidence | Limitation | Status |
|---|---|---|---|---|---|
| Marker visibility | Markers appear on the ECharts line/market-cap chart when marker data exists | No separate mobile or touch marker UI found | Visible status line below chart reports marker loading/count/error state | Marker visibility depends on chart density and overlap | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Hover tooltip | ECharts hover tooltip shows event date and article count | No keyboard-triggered tooltip path was confirmed | Tooltip text exists through ECharts config only | Canvas markers do not expose per-marker focus behavior in the inspected source | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Click interaction | Clicking a marker selects it | Same click handler would be used if ECharts emits touch clicks | `handleChartClick` checks `seriesName === "News markers"` | No explicit touch affordance or gesture hint | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Keyboard access | No marker-specific button, link, or focus element was found | No keyboard selection path confirmed | Popup close button is keyboard-focusable, but markers themselves are canvas-rendered | Marker interaction appears pointer-driven | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Screen-reader evidence | Status line and popup text are DOM nodes | No marker-specific screen-reader labels found for canvas points | Popup close button has `aria-label` | Marker meaning relies on chart canvas interaction and color/icon | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Explanatory text | Status line reports count/loading/error/empty markers | Same text on narrow screens | Visible DOM text exists below the chart | No legend or explanation of why markers are pinned to chart points | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 11. Marker selection behavior

| Selection concern | Current behavior | Handler/state | Reset behavior | Status |
|---|---|---|---|---|
| Click target check | Only reacts when clicked series name is `"News markers"` | `handleChartClick` early return | Non-marker chart clicks do nothing | `FRONTEND_ACTIVE` |
| Event extraction | Reads `params?.data?.event` | `handleChartClick` | Missing event aborts selection | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Selected-event state | Sets `selectedNewsEvent` to clicked event | `useState<TokenChartNewsEvent | null>` | Cleared by close button and by chart-news effect start | `FRONTEND_ACTIVE` |
| Repeated click behavior | Clicking a marker always sets it selected again | `setSelectedNewsEvent(event)` | No toggle-off on second click | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Background click dismissal | No background-click handler found | None | Selection stays open | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Escape-key dismissal | No Escape handler found | None | Selection stays open | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Range/token change reset | New chart-news request starts with `setSelectedNewsEvent(null)` | `fetchNewsEvents` effect | Selection closes on range/timeframe/token identity changes | `FRONTEND_ACTIVE` |
| Metric/mode change reset | No explicit clear on price<->market-cap or line<->candle switch | None | Selection can persist into other modes | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 12. Selected-event popup

| Popup element or behavior | Component | Data source | Missing-value behavior | Status |
|---|---|---|---|---|
| Popup container | `TokenOverviewChart` `.newsPopup` | `selectedNewsEvent` state | Not rendered when no selected event exists | `FRONTEND_ACTIVE` |
| Popup header | Popup JSX | `selectedNewsEvent.timestamp` | Invalid event timestamp falls back to raw string through formatter | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Close button | Popup JSX | Local state only | Always available when popup exists | `FRONTEND_ACTIVE` |
| Article-count meta | Popup JSX | `selectedNewsEvent.articleCount` | Missing count would degrade text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary panel | Popup JSX | `selectedNewsEvent.summary`, summary-loading/error states | Shows loading, error, summary content, or "Summary unavailable." | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Upgrade plan link | Summary error branch | `newsSummaryUpgradePath` | Omitted when no upgrade path exists | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article list | Popup JSX | `selectedNewsEvent.articles` | Empty array produces no article items | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Popup positioning | SCSS `.newsPopup` | Chart wrapper-relative absolute positioning | On mobile, inset left/right 12px; width auto | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Popup scrolling | SCSS `.newsPopup` | `overflow: auto`, max height relative to wrapper | Long content scrolls inside popup | `FRONTEND_ACTIVE` |
| Popup chart blocking | Layout effect | Overlays top-right of chart area | No non-overlapping placement logic | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

The popup is chart-relative, not viewport-fixed, and it does not use a modal overlay.

## 13. Marker summary requests

| Summary concern | Current behavior | Implementation/API | User feedback | Limitation | Status |
|---|---|---|---|---|---|
| Summary trigger | Clicking a selected marker whose `event.summary` is null and `newsSummaryLoading` is false | `handleChartClick` -> `getTokenChartNewsEvents(includeSummary: true, date)` | Popup immediately opens; summary area enters loading state | Uses `date` rather than event ID/content hash | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary loading UI | Shows "Loading summary..." only when selected event lacks summary | Popup summary branch | Visible loading text | No spinner or background chart feedback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary success | Replaces matching event in `newsEvents`, updates `selectedNewsEvent`, and stores usage | Summary request success path | Summary headline, bullets, provider, and usage can render | Matching by date can be ambiguous if multiple events share the same date key | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary error | Sets `newsSummaryError`; may open auth modal on 401; may expose upgrade link for gated/limit errors | `TokenChartNewsEventsApiError` handling | Error text shown inside popup | Popup remains open without retry control | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary cache | If `event.summary` already exists, no second request is made | `handleChartClick` early return | Cached summary renders immediately | Cache lifetime is component-state only and resets when events are replaced | `FRONTEND_ACTIVE` |
| Rapid marker changes | Another unsummarized marker click during `newsSummaryLoading` does not start a new request | `handleChartClick` early return on `newsSummaryLoading` | Selected event can change before old request resolves | Old request can later overwrite `selectedNewsEvent` with earlier marker summary | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 14. Summary and text cleanup

| Text concern | File/function | Current cleanup | Unhandled case | Status |
|---|---|---|---|---|
| Marker tooltip text | ECharts tooltip formatters in `TokenOverviewChart` | Interpolates plain strings into HTML tooltip template | No cleanup for malformed event timestamp or odd counts beyond formatter output | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Popup summary headline/bullets | Popup JSX | Rendered as plain React text | No cleanup for HTML-like fragments, escaped entities, duplicated text, or excess whitespace | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Popup article title/source/description | Popup JSX | Rendered as plain React text; descriptions are CSS-clamped | No cleanup for scraped markup, navigation fragments, CSS/JSX artifacts, or repeated copy | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Upgrade-plan text | Popup error branch | Plain React text and anchor | No cleanup or URL validation on upgrade path | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| HTML injection | `TokenOverviewChart` popup and article list | No `dangerouslySetInnerHTML`, Markdown renderer, HTML parser, or sanitizer found in the active chart-news path | Malformed HTML-like strings are escaped by React but remain visible as raw text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 15. Range, mode, and token-change behavior

| Change | Request effect | Marker-state effect | Selected-event effect | Limitation | Status |
|---|---|---|---|---|---|
| Range change | Triggers new chart-news request because `newsTimeframe` changes | Existing `newsEvents` remain until request settles; new series points remap marker positions | `selectedNewsEvent` is cleared at request start | Old markers can briefly reappear on new chart data before new event response arrives | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Price vs market-cap mode change | No chart-news request | Markers remap to `prices` or `marketCaps` via `seriesData` | No automatic selection clear | Marker positions depend on current metric; popup can stay open across metric change | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Line to candle mode change | No chart-news request | Marker layer is hidden because candle iframe replaces ECharts; `newsEvents` state remains | No automatic selection clear | Popup and marker status can remain while visible markers disappear | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Candle back to line mode | No chart-news request if token/range unchanged | Cached events and line-series mapping are reused | Existing selection can still exist | Can return with old markers/state without revalidation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token address/symbol/name change | Triggers new chart-news request | Existing events remain until response settles | Selection clears at request start or when identity is missing | No stale-request protection if previous response resolves late | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| New chart data arrives | No chart-news request by itself | Marker positions recompute against latest `seriesData` | Selection stays unless a chart-news effect cleared it | Markers can move or reappear from old events when new chart points arrive first | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 16. Chart News state management

| State concern | File/hook | Initial value | Updated by | UI/request effect | Persistence |
|---|---|---|---|---|---|
| Event list | `TokenOverviewChart` `newsEvents` | `[]` | Event request success, summary request success, event request failure clears | Drives marker mapping, status line, and popup event cache | Component state |
| Event loading | `newsLoading` | `false` | Event request start/end | Drives status line loading branch | Component state |
| Event error | `newsError` | `null` | Event request failure/start | Drives status line error branch | Component state |
| Selected event | `selectedNewsEvent` | `null` | Marker click, event request start, missing identity, close button, summary success | Controls popup visibility/content | Component state |
| Summary loading | `newsSummaryLoading` | `false` | Marker click request start/end | Drives popup summary loading branch and suppresses additional summary requests | Component state |
| Summary error | `newsSummaryError` | `null` | Summary request failure/start | Drives popup summary error branch | Component state |
| Summary usage | `newsSummaryUsage` | `null` | Summary request success | Displays remaining summaries information | Component state |
| Summary upgrade path | `newsSummaryUpgradePath` | `null` | Summary request failure/start | Displays upgrade plan link in popup error branch | Component state |
| Timeframe bucket | `newsTimeframe` | Derived from default range | Range changes | Drives event and summary request timeframe | Derived state |
| Marker data | `newsMarkerData` | `[]` when no series or events | Derived from `seriesData` and `newsEvents` | Supplies scatter series points | Derived state |
| Series selection | `seriesData` | Derived from `mode` and chart data arrays | Chart data and mode changes | Determines marker mapping target | Derived state |

No chart-news state was confirmed as persisted to URL, local storage, session storage, SWR cache, or shared context.

## 17. Loading, empty, error, and partial states

| Chart-news section or action | Loading UI | Empty UI | Error UI | Partial-data behavior | Retry/fallback | Status |
|---|---|---|---|---|---|---|
| Initial event request with chart data available later | Status line eventually shows "Loading news markers..." once line chart data exists | If zero events, status says no markers for timeframe | If request fails, status says unable to load news markers | Markers can appear later once both events and series data exist | No manual retry | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Event request before chart data exists | No dedicated marker UI until `!loading && seriesData.length > 0` | None before chart data | None before chart data | Marker state is effectively hidden while chart has no series data | Falls through to chart loading/empty UI | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Range/token change request | `newsLoading` status after chart data is present | Same as above | Same as above | Old events remain in state until response settles | No manual retry; old markers can become stale | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary request | Popup summary shows "Loading summary..." | If summary remains null after request, popup says "Summary unavailable." | Popup shows summary error text and optional upgrade link | Existing popup article list still renders | No retry button | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Event request failure | Status line shows `newsError` | No marker empty-state distinction beyond status line | Console log plus status-line error text | Events are cleared on failure | No retry | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Summary request failure | Popup remains open | No separate empty state | Popup summary error text | Existing article list remains visible | No retry; auth modal may open on 401 | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Invalid event timestamp | Marker is dropped from `newsMarkerData` | Potentially fewer markers than event count | No user-facing specific error | Other events still render | Silent drop | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Missing summary | Popup shows "Summary unavailable." | N/A | N/A | Article list still renders | None | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Missing article image | Thumbnail image hides on error or fallback initial is used when no image/favicon is supplied | N/A | None | Placeholder initial uses `article.source.trim()` | Silent fallback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Missing article URL/source | No specific guard | N/A | None | Raw assumptions can break link or placeholder logic if runtime data violates types | None | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 18. Navigation and external links

| Source UI | Required data | Destination | Internal/external | Validation | Status |
|---|---|---|---|---|---|
| Marker click | Valid marker payload with event | Selected-event popup | Internal chart overlay | Checks only `seriesName` and presence of `data.event` | `FRONTEND_ACTIVE` |
| Popup article item | `article.url` | Original article URL | External new tab | Uses raw `href`, `target="_blank"`, `rel="noreferrer"`; no URL/protocol validation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Upgrade plan link | `newsSummaryUpgradePath` | Upgrade path from summary error | Internal or external boundary depending returned URL | Raw `href`; no validation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Popup close button | `selectedNewsEvent` exists | Clears popup selection | Internal local state | Explicit close button only | `FRONTEND_ACTIVE` |

No navigation to `NewsTab`, related tokens, source websites, or internal article expansion was confirmed from the chart-news popup.

## 19. Responsive behavior

Chart-news responsive behavior is CSS-driven within `TokenOverviewChart`. No separate mobile marker request path or mobile-specific event data model was found.

| Chart-news block | Desktop behavior | Mobile/narrow behavior | Same data flow | Confirmed limitation |
|---|---|---|---|---|
| Marker layer | Same pin markers and tooltip behavior as line chart | No marker resizing or reduced count confirmed | Yes | Dense markers can still overlap on narrow screens. |
| Marker status | Inline status text below chart | Same text flow below chart | Yes | No compressed/mobile-specific legend behavior. |
| Popup | Absolute top-right overlay with width `min(420px, calc(100% - 36px))` | At `max-width: 768px`, popup uses `left: 12px; right: 12px; width: auto` | Yes | Popup still overlays chart rather than becoming a full-screen sheet. |
| Popup scrolling | Internal scroll when content exceeds popup height | Same scrollable popup | Yes | No sticky footer/header controls beyond existing close button. |
| Range controls affecting chart-news | Range buttons remain horizontally grouped | Range button container gets horizontal overflow | Yes | No chart-news-specific touch hint for scrolling range controls. |
| Candle-mode popup/status persistence | Popup/status can remain from prior line-mode interaction | Same behavior on narrow screens | Yes | Users can see chart-news popup/status while markers themselves are hidden in candle mode. |

## 20. Unused or disconnected Chart News code

| Candidate | Type | File/component/function | Active caller found | Reason excluded | Classification |
|---|---|---|---|---|---|
| `forceRefresh` | Query option | `TokenChartNewsEventsQuery`, `getTokenChartNewsEvents` | No active caller from `TokenOverviewChart` | Service supports forced refresh, but active chart-news flow never sets it | `FRONTEND_UNUSED` |
| `counted` propagation | Response field passthrough | `getTokenChartNewsEvents` return object | No active reader in `TokenOverviewChart` | Returned boolean is preserved by the service but unused by chart-news UI | `FRONTEND_UNUSED` |
| Unrendered summary fields | Response/type fields | `TokenChartNewsEventSummary.tldr`, `themes`, `confidence`, `riskNote`, `generatedAt` | No active popup usage | Popup renders only headline, bullets, and provider | `FRONTEND_UNUSED` |
| Unused event/data metadata | Response/type fields | `TokenChartNewsEventsData.token`, `updatedAt`, `meta`; article `score`, `matchedBy`, `sourceType` | No active chart-news UI usage | Active marker/popup flow ignores these fields | `FRONTEND_UNUSED` |

Unused Chart News code artifact count: 4.

## 21. Frontend-only Chart News flows

### Flow A - Load chart news events

1. User opens `/tokens/:address`.
2. `TokenOverviewPage` renders `TokenOverviewChart`.
3. `TokenOverviewChart` resolves `address`, `symbol`, `name`, and default `range`.
4. The chart-news effect computes `newsTimeframe` from `range.days`.
5. If `address`, `symbol`, and `name` are present, the effect issues `getTokenChartNewsEvents(... includeSummary: false)`.
6. Returned events are stored in `newsEvents`.
7. Once visible line/market-cap chart points exist, `newsMarkerData` parses each event timestamp and maps each event to the nearest chart point.
8. The chart option renders the scatter marker series, or the status line renders loading/empty/error text.

### Flow B - Change chart range

1. User clicks a different range button.
2. Core chart data request and chart-news event request both rerun independently.
3. `newsTimeframe` changes to the new bucket.
4. `selectedNewsEvent` is cleared at chart-news request start.
5. `newsEvents` are not cleared immediately.
6. When new chart points arrive before new events, old events can temporarily map onto the new chart as stale markers.
7. When the new event response arrives, markers are remapped from the fresh event list.

### Flow C - Select a marker

1. User clicks a scatter point whose ECharts `seriesName` is `"News markers"`.
2. `handleChartClick` extracts `params.data.event`.
3. `selectedNewsEvent` is set.
4. If the event already has a summary, the popup opens immediately with cached summary content.
5. If the event has no summary and no summary request is currently loading, a summary request is issued.

### Flow D - Load marker summary

1. User clicks an unsummarized marker.
2. `handleChartClick` calls `getTokenChartNewsEvents` again with `includeSummary: true` and `date: event.date`.
3. While the request is pending, popup summary area shows "Loading summary...".
4. On success, the returned event matching the same `date` replaces the cached event in `newsEvents`.
5. `selectedNewsEvent` is replaced with the summarized event and usage data may render.
6. On failure, popup summary area shows an error message and may show an upgrade link or open the login modal.

### Flow E - Open original article

1. User clicks an article row in the popup.
2. The anchor uses `article.url` as `href`.
3. Browser opens the article in a new tab.
4. The frontend does not validate the URL before rendering the link.

### Flow F - Close marker popup

1. User clicks the popup close button.
2. `selectedNewsEvent` is set to `null`.
3. The popup unmounts.
4. Range/timeframe/token changes also clear `selectedNewsEvent` through the chart-news effect.

### Flow G - Change token address

1. Route token identity changes.
2. Core chart data request and chart-news event request rerun with the new token inputs.
3. `selectedNewsEvent` clears at event-request start.
4. Old `newsEvents` remain until the new event request resolves.
5. If new chart data returns first, stale old-token markers can temporarily remap onto the new token chart.
6. When the new event request settles, markers are replaced or cleared.

## 22. Architecture-ready Chart News summary

### Confirmed Chart News frontend blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Chart-news request/state layer | `CHART-NEWS-01`, `CHART-NEWS-02`, `CHART-NEWS-03`, `CHART-NEWS-14` | `TokenOverviewChart`, `getTokenChartNewsEvents`, chart-news state hooks | Loads chart-news events, tracks loading/error/selection/summary state, and exposes marker status | Core chart-news frontend state node. |
| Event normalization and marker mapping | `CHART-NEWS-04`, `CHART-NEWS-05`, `CHART-NEWS-06` | `getClosestChartPoint`, `newsMarkerData`, ECharts scatter series, status line | Converts events into chart markers and user-visible marker status | Core event-to-visual mapping node. |
| Chart marker interaction layer | `CHART-NEWS-07`, `CHART-NEWS-12`, `CHART-NEWS-13` | `handleChartClick`, `selectedNewsEvent`, mode/range/token transition logic | Selects markers, clears popup state, and responds to route/range/mode changes | Interactive chart-news control node. |
| Selected-event popup | `CHART-NEWS-08`, `CHART-NEWS-11` | Popup container, popup article list, external links | Presents selected event metadata and source articles | Primary marker-detail UI node. |
| Marker summary layer | `CHART-NEWS-09`, `CHART-NEWS-10` | Summary request path, summary UI, usage/error/upgrade states | Fetches and renders summary content for a selected event | Secondary request-driven detail node. |

### Chart News frontend-to-backend boundaries

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| Chart-news request/state layer | Chart-news events | `getTokenChartNewsEvents` -> Hono RPC `client.api["token-chart-news-events"].$get` | Fetch event groups for token and timeframe without summaries | Initial token/range load and token/range changes | `client/src/components/token/TokenOverviewChart.tsx`, `client/src/services/tokenChartNewsEvents.ts` |
| Marker summary layer | Chart-news events with summaries | Same frontend service and same Hono RPC endpoint | Fetch summary-bearing event data for a selected event date | Marker click when summary is absent | `client/src/components/token/TokenOverviewChart.tsx`, `client/src/services/tokenChartNewsEvents.ts` |

### Chart News navigation boundaries

| Source block | Destination | Entity | Trigger |
|---|---|---|---|
| Marker click | Selected-event popup | Event group on chart | User clicks a news marker. |
| Popup article row | Original article URL | Source article | User clicks a popup article item. |
| Upgrade plan link | Upgrade path URL | Summary plan/auth boundary | Summary request fails with upgrade path. |

### Capabilities eligible for backend verification

Only canonical IDs that issue requests, depend on backend event/summary data, depend on response shape, or need stale/failure verification are listed:

1. `CHART-NEWS-03` Event request lifecycle
2. `CHART-NEWS-04` Event timestamp normalization and nearest-point matching
3. `CHART-NEWS-05` Marker generation and insertion
4. `CHART-NEWS-06` Marker hover/status display
5. `CHART-NEWS-09` Summary request on marker click
6. `CHART-NEWS-10` Summary rendering and plan/auth feedback
7. `CHART-NEWS-11` Popup article list and external links
8. `CHART-NEWS-13` Range-, mode-, and token-change behavior
9. `CHART-NEWS-14` Chart-news loading, empty, error, and stale-data handling

## 23. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should chart-news requests use cancellation or stale-request protection on fast range/token changes? | No cancellation or stale guard was confirmed in the active effects | Chart-news frontend hardening |
| Should `newsEvents` be cleared immediately at event-request start to avoid stale markers on fresh chart data? | Existing events persist until the request settles | Chart-news UX hardening |
| Should chart-news requests depend on line-chart visibility, or is candle-mode fetching intentional? | Event requests continue even when candle mode hides markers | Chart-news/product review |
| Should marker mapping reject events outside the visible chart range instead of pinning to the nearest endpoint? | Current mapping has no explicit bounds check | Chart-news data-contract verification |
| Should summary requests identify events by event ID/content hash instead of date? | Active summary request uses only `date` plus token/timeframe | Chart-news API contract verification |
| Should clicking a different marker during summary loading cancel or supersede the first summary request? | Active handler blocks new unsummarized requests while `newsSummaryLoading` is true | Chart-news interaction hardening |
| Should marker tooltips, popup copy, and status text be fully localized? | Many marker-specific strings are hardcoded English | Chart-news UX localization review |
| Should popup article URLs and upgrade-path URLs be validated or protocol-restricted? | Active anchors use raw `href` values | Chart-news security/robustness review |
| Should the popup close on background click or Escape? | No such handlers were found | Chart-news interaction review |
| Should marker density/overlap be limited or aggregated on narrow screens? | No overlap handling or responsive marker simplification was confirmed | Chart-news responsive UX review |

## 24. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2A_MARKET_FRONTEND.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `docs/architecture/audit/02B2B2A_TOKEN_NEWS_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/TokenOverviewChart.tsx`
- `client/src/components/token/TokenOverviewChart.module.scss`
- `client/src/services/tokenChartNewsEvents.ts`
- `client/src/types/chartNewsEvents.ts`
- `client/src/contexts/AuthContext.tsx`
- `client/src/components/charts/GeckoTerminalChart.tsx`
