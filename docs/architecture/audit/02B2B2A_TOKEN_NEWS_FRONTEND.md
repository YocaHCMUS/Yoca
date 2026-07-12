# Yoca Token News Frontend Audit

## 1. Scope

This Phase 2B2B2A audit covers only the currently used Token News frontend rendered from the Token Overview route `/tokens/:address`, specifically the `#token-news` section and `NewsTab` render chain.

In scope:

- How `NewsTab` is reached from Token Overview
- `NewsTab` render conditions, props, state, requests, refresh, pagination, article cards, links, text handling, and responsive behavior
- Frontend API contracts directly called by the active Token News flow
- Token-news-specific loading, empty, error, fallback, partial-data, and stale-data behavior
- Token-news-specific code that exists but is not active from `/tokens/:address`

Out of scope:

- Chart news markers, chart marker popups, chart marker summaries, and chart news-event fetching
- Ask Yoca token AI chat
- Tokenomics or investor metadata
- Wash-trading, token alerts, token watchlist, and shared authentication
- Core token identity, statistics, charts, holders, and markets already covered in Phase 2B2B1
- Pool-detail page behavior, historical-data page behavior, wallet page behavior, backend implementation, providers, databases, deployment, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2A_MARKET_FRONTEND.md`, and `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered from the active Token News flow, has a visible or lifecycle entry point, has connected frontend behavior, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected but has a confirmed limitation such as missing validation, missing request cancellation, missing stale-request protection, response-shape assumptions, incomplete error feedback, local-only pagination, missing URL validation, or partial text cleanup.
- `FRONTEND_BROKEN`: visible Token News capability exists but cannot complete its intended basic frontend role.
- `FRONTEND_UNUSED`: Token News frontend implementation exists but has no active render, request, or interaction chain from `/tokens/:address`.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `TOKEN-NEWS-01` through `TOKEN-NEWS-14`. Repeated evidence, article fields, formatting helpers, responsive rows, frontend flows, architecture blocks, deferred chart-news boundaries, and unused implementation artifacts do not create additional capability counts.

## 3. Active Token News render chain

`client/src/App.tsx` registers `/tokens/:address` with `TokenOverviewPage`. Inside `client/src/pages/token-overview/index.tsx`, the `#token-news` section renders `NewsTab` only when both `address` and `details` are truthy.

```text
/tokens/:address
`- RootLayout
   `- TokenOverviewPage
      `- PageWrapper
         `- #token-news
            `- NewsTab, when address && details
               |- Header title and fetch/refresh icon button
               |- Error message, when news.error exists
               |- Initial skeleton cards, when news.isLoading && !news.hasLoaded
               |- Empty state and try-refresh button, when loaded with no articles and no error
               |- Web-mention notice, when all loaded articles are non-news sourceType
               |- NewsCard[], when sortedArticles.length > 0
               `- Pagination controls, when totalPages > 1
```

| Rendered block | File/component | Parent | Render condition | User purpose |
|---|---|---|---|---|
| Token News section anchor | `client/src/pages/token-overview/index.tsx` `#token-news` | `TokenOverviewPage` main rail | Always present after page renders | Scroll target for TokenTabs News tab. |
| `NewsTab` | `client/src/components/token/NewsTab.tsx` | `#token-news` | `address && details` | Token-specific news feed UI. |
| Header and action button | `NewsTab` | `NewsTab` root | Always when `NewsTab` renders | Shows section title and fetch/refresh control. |
| Error banner | `NewsTab` | `NewsTab` root | `news.error` | User-facing generic request failure message. |
| Initial loading skeletons | `NewsTab` | `NewsTab` root | `news.isLoading && !news.hasLoaded` | Shows initial loading placeholder cards. |
| Empty state | `NewsTab` | `NewsTab` root | `news.hasLoaded && !news.isLoading && !news.error && sortedArticles.length === 0` | Shows no-results copy and retry button. |
| Web-mention notice | `NewsTab` | Article-list area | Articles exist and every article has `sourceType !== "news"` | Tells users related web mentions are being shown. |
| Article cards | `NewsCard` | `NewsTab` article grid | `sortedArticles.length > 0`; one card per visible page article | Displays compact article metadata and external link. |
| Pagination | `NewsTab` | Below article grid | `totalPages > 1` | Moves through local pages of loaded articles. |

## 4. Token News inputs

| Input | Source component | Destination component/hook | Usage | Missing-input behavior | Status |
|---|---|---|---|---|---|
| Token address | `TokenOverviewPage` route param | `NewsTab`, then `useNewsFeed` and `getTokenNews` | Sent as `address` query parameter | `NewsTab` is not rendered if `address` is missing | `FRONTEND_ACTIVE` |
| Token details object | `useTokenOverviewData` in `TokenOverviewPage` | Render condition for `NewsTab` | Gates `NewsTab` rendering | `NewsTab` is not rendered until details exists | `FRONTEND_ACTIVE` |
| Token symbol | `details.symbol ?? ""` | `NewsTab`, `useNewsFeed`, `getTokenNews` | Sent as `symbol` query parameter | Initial effect does not fetch if symbol is empty, but manual button can still call `fetchNews` with empty symbol | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token name | `details.name ?? ""` | `NewsTab`, `useNewsFeed`, `getTokenNews` | Sent as `name` query parameter | Initial effect does not fetch if name is empty, but manual button can still call `fetchNews` with empty name | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Token image | Not passed | None | Not used by active news flow | N/A | Not active |
| Market data | Not passed | None | Not used by active news flow | N/A | Not active |
| Active tab state | `TokenOverviewPage` local state | Not passed to `NewsTab` | NewsTab is mounted independent of active tab selection once details exist | News request can happen even if the News section has not been clicked | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Language/localization | `LocalizationProvider` via `useLocalization` | `NewsTab`, `NewsCard` | Localizes labels and formats dates | If translation is missing, behavior depends on localization layer | `FRONTEND_ACTIVE` |
| User/session state | Not passed | None | Not used by active news flow | N/A | Not active |
| Refresh trigger | Local button click | `NewsTab` -> `news.fetchNews` | Reissues same token-news request | Disabled while loading; no cooldown | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 5. Canonical Token News capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation |
|---|---|---|---|---|---|---|
| `TOKEN-NEWS-01` | Token News section rendering | `/tokens/:address` page render after token details exist | `TokenOverviewPage`, `NewsTab` | Renders `#token-news` and conditionally mounts `NewsTab` | `FRONTEND_ACTIVE` | Section can exist empty while token details are still unavailable. |
| `TOKEN-NEWS-02` | Token identity handoff to news flow | `NewsTab` mount | `TokenOverviewPage`, `NewsTab`, `useNewsFeed` | Builds `{ address, symbol, name }` query object | `FRONTEND_ACTIVE` | Initial fetch requires non-empty symbol and name. |
| `TOKEN-NEWS-03` | Initial token-news request | `NewsTab` effect after address, symbol, and name are truthy | `NewsTab`, `useNewsFeed`, `getTokenNews` | Calls token-news endpoint and stores entries | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No cancellation or stale-response protection was confirmed. |
| `TOKEN-NEWS-04` | Manual news refresh | Header refresh/fetch button or empty-state retry button | `NewsTab`, `useNewsFeed` | Reissues token-news request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Existing data can remain visible with generic error; refresh has no cooldown or clear success feedback. |
| `TOKEN-NEWS-05` | Article sorting and page reset | News entries change | `NewsTab` `useEffect` | Sorts by parsed `publishedAt` descending and resets page to 0 | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Invalid dates sort as timestamp 0; no stable secondary sort was confirmed. |
| `TOKEN-NEWS-06` | Local article pagination | User clicks previous/next page buttons | `NewsTab` | Slices already loaded sorted articles by page size 10 | `FRONTEND_ACTIVE` | Pagination is local only; no server pagination or URL persistence. |
| `TOKEN-NEWS-07` | Article card rendering | Loaded visible articles exist | `NewsCard` | Renders thumbnail, source, title, description, external link, and date | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Assumes title and URL exist; no duplicate suppression or field validation. |
| `TOKEN-NEWS-08` | Article thumbnail and favicon fallback | Article card render and image load failure | `NewsCard` | Uses `imageUrl`, `faviconUrl`, or `favicon`; falls back to source initial | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Image URLs are not validated; thumbnail fallback can hide data quality issues. |
| `TOKEN-NEWS-09` | Source and publication metadata display | Article card render | `NewsCard` | Displays source label and formatted publication date | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Source/domain validation is not performed; invalid dates are omitted. |
| `TOKEN-NEWS-10` | External article navigation | User clicks Open Article link | `NewsCard` | Opens `article.url` in a new tab with `noopener noreferrer` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | URL validity and protocol are not checked. |
| `TOKEN-NEWS-11` | Related web-mention notice | Loaded articles exist and all are non-news `sourceType` | `NewsTab` | Shows "No major news found" notice | `FRONTEND_ACTIVE` | Depends on article `sourceType`; missing sourceType counts as non-news for this check. |
| `TOKEN-NEWS-12` | Loading, empty, and error states | Request lifecycle and article count | `NewsTab`, `useNewsFeed` | Shows skeletons, empty state, retry, generic error, or article list | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Refresh-after-empty can temporarily show no body; errors are generic and can coexist with stale articles. |
| `TOKEN-NEWS-13` | Stale data retention during refresh/failure | Manual refresh or repeated fetch | `useNewsFeed`, `NewsTab` | Keeps previous entries while loading and after failed refresh | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No last-success indicator is rendered; `updatedAt` is stored but not displayed. |
| `TOKEN-NEWS-14` | Summary/snippet text rendering | Article card render | `NewsCard`, React text rendering, CSS line clamp | Renders `description` as text and clamps to two lines | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No explicit cleanup for scraped navigation text, HTML-like fragments, escaped entities, or duplicate title text. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 4 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 10 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical Token News capabilities** | 14 |

Validation: `4 + 10 + 0 + 0 + 0 = 14`, matching the 14 rows in the canonical Token News capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Unused Token News code artifacts | 5 |
| Deferred chart-news boundaries | 1 |
| Out-of-scope components encountered | 1 |

The deferred chart-news boundary is the `TokenOverviewChart` news-marker subsystem. The out-of-scope component encountered is sibling `TokenAIChat` in the Token Overview page. Neither is counted as Token News frontend capability.

## 6. Token News frontend API calls

| Capability ID | Trigger | Frontend caller | API method or URL | Request input | Response usage | Error handling | Refresh/cache behavior | Status |
|---|---|---|---|---|---|---|---|---|
| `TOKEN-NEWS-03` | `NewsTab` effect runs when `address && symbol && name` | `useNewsFeed.fetchNews` -> `getTokenNews` | `client.api["token-news"].$get` | Query `{ address, symbol, name }` | Maps `payload.data.articles` into `entries`, copies `source` to `sourceName`, maps `favicon` to `faviconUrl`, stores `updatedAt` | Non-OK or unsuccessful payload throws; hook stores message in `error`; `NewsTab` renders generic translated error | No SWR/cache layer; local hook state only; no cancellation/stale guard | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| `TOKEN-NEWS-04` | User clicks header fetch/refresh icon button | Same as above | Same as above | Same as above, including possible empty symbol/name if manually clicked | Replaces entries on success | Same as above | Previous entries remain while loading and after failed refresh | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| `TOKEN-NEWS-04` | User clicks empty-state Try Refresh button | Same as above | Same as above | Same as above | Replaces entries on success | Same as above | During empty-state refresh, no skeleton is rendered because `hasLoaded` is already true | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Not counted | No active trigger found | `getExpandedNewsArticle` in `client/src/services/news.ts` | `client.api.news.articles[":contentHash"].expand.$get` | Param `{ contentHash: encodeURIComponent(contentHash) }` | Would return article expansion data if called | Catches errors, logs to console, returns null | No active caller from `NewsTab` or `NewsCard` | `FRONTEND_UNUSED` |

Request behavior summary:

- Initial render request: yes, but only when `address`, `symbol`, and `name` are all truthy.
- Token-address dependency: yes, through `useNewsFeed` callback dependencies and `NewsTab` effect.
- Token-name or symbol dependency: yes, both are request query inputs and required by the initial effect.
- Manual refresh trigger: yes, header button and empty-state retry button.
- Pagination trigger: no request; pagination is local slicing.
- Load-more trigger: none found.
- Article expansion trigger: none active.
- Parallel/sequential requests: active news flow issues one token-news request per fetch.
- Polling: none found.
- Request cancellation: none found.
- Stale-response handling: none found.
- Behavior when token address changes: hook callback and effect update from new primitives, but old in-flight request protection was not confirmed.

## 7. Article data shape and display

| Displayed or used field | Component | Response field | Transformation | Missing-value behavior | Status |
|---|---|---|---|---|---|
| Title | `NewsCard` | `article.title` | Rendered as React text in `<h3>` | No explicit fallback; empty/missing title would render empty or fail type expectations | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article URL | `NewsCard` | `article.url` | Used directly as anchor `href` | No validation or fallback before render | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Description/snippet | `NewsCard` | `article.description` | Rendered as React text in `<p>` when truthy; CSS clamps to two lines | Missing description omits paragraph | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source label | `NewsCard` | `article.sourceName`, `article.source` | `sourceName || source || sourceFallback` | Falls back to localized source fallback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Published time | `NewsTab`, `NewsCard` | `article.publishedAt` | `Date.parse` for sorting; `new Date(...)` plus localized date formatter for display | Invalid/missing date sorts as 0 and is omitted from card footer | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Main image | `NewsCard` | `article.imageUrl`, `article.faviconUrl`, `article.favicon` | First available image/fav icon is used as thumbnail | Placeholder with source initial if absent or image fails | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Favicon | `NewsCard` | `article.faviconUrl`, `article.favicon` | Rendered as source-row favicon when present | Hidden on image error | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source type | `NewsTab` | `article.sourceType` | Used only to compute no-major-news web-mention notice | Missing sourceType is treated as non-news by the `every(sourceType !== "news")` check | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Content hash | Not rendered | `article.contentHash` | Not used by active `NewsTab` or `NewsCard` | N/A | Not active |
| Extra snippets/context | Not rendered | `extraSnippets`, `context` | Not used by active card UI | N/A | Not active |
| Score/matchedBy/raw | Not rendered | `score`, `matchedBy`, `raw` | Not used by active card UI | N/A | Not active |

## 8. Article cards and interactions

| Article interaction | Component | Trigger | Result | Validation/fallback | Status |
|---|---|---|---|---|---|
| Render article card | `NewsCard` | Card is in current `visibleArticles` slice | Displays thumbnail, source, title, optional description, open link, and optional date | No full article-object validation beyond conditional rendering | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Open original article | `NewsCard` | User clicks Open Article anchor | Opens `article.url` in a new browser tab | Uses `target="_blank"` and `rel="noopener noreferrer"`; no URL/protocol validation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Card hover styling | `NewsCard.module.scss` | User hovers card | Visual hover transform/background change | Card itself is not an anchor or click handler | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Thumbnail fallback | `NewsCard` | Missing thumbnail or image load error | Shows placeholder with first source-label character or `N` | Source label is trimmed only for placeholder letter | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Favicon fallback | `NewsCard` | Favicon image load error | Hides favicon element | No replacement favicon is shown in source row | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Duplicate article handling | `NewsTab` | Article list render | Uses `article.url || idx` as React key | Duplicate URLs are not filtered and can produce duplicate-key behavior | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Featured/primary article | None found | N/A | No featured article behavior | N/A | Not active |
| Card expansion | None active | N/A | No internal expansion interaction | Expansion styles/service exist but no active UI | `FRONTEND_UNUSED` |

## 9. Summary, snippet, and content cleanup

| Text concern | File/function | Current cleanup behavior | Unhandled malformed case | Status |
|---|---|---|---|---|
| Title text | `NewsCard` | Rendered as React text, so HTML is escaped rather than interpreted | No cleanup for duplicated title, scraped navigation text, CSS class fragments, escaped entities, or excessive whitespace | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Description/snippet | `NewsCard` | Rendered as React text and visually clamped by CSS | Raw HTML-like fragments, repeated "Back to News" text, JSX/CSS fragments, script/style text as plain text, and escaped entities are not normalized | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source text | `NewsCard` | Uses `sourceName || source || fallback`; placeholder letter uses `sourceLabel.trim().slice(0, 1).toUpperCase()` | Displayed source label itself is not trimmed, domain-normalized, or validated | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Expanded article content | Not active | No active expansion content rendering | Expansion service/types exist, but no active UI uses them | `FRONTEND_UNUSED` |
| HTML parsing/sanitization | `NewsCard`, `NewsTab` | No `dangerouslySetInnerHTML`, HTML parser, Markdown parser, or DOM sanitization was found in the active card path | Malformed HTML is escaped by React but still visible as raw text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Length truncation | `NewsCard.module.scss` | Description uses CSS line clamp; title uses wrapping/word-break | No character-count truncation or semantic cleanup | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

No active `dangerouslySetInnerHTML` usage was found in `NewsTab`, `NewsCard`, `useNewsFeed`, or `getTokenNews`.

## 10. Pagination, load-more, and refresh

| Concern | Current behavior | State/hook | API effect | User feedback | Status |
|---|---|---|---|---|---|
| Page navigation | Enabled when `totalPages > 1`; page size is 10 | `currentNewsPage`, `sortedArticles` | No API request; local slice only | Showing X-Y of Z and previous/next icon buttons | `FRONTEND_ACTIVE` |
| Cursor pagination | Not implemented | None | None | None | Not active |
| Offset pagination | Type support exists, but active request does not use `limit` or `offset` | `TokenNewsQuery` type only | None in active request | None | `FRONTEND_UNUSED` |
| Load more | Not implemented | None | None | None | Not active |
| Infinite scroll | Not implemented | None | None | None | Not active |
| Manual refresh | Header icon button and empty-state Try Refresh button call `news.fetchNews` | `useNewsFeed.isLoading`, `hasLoaded`, `entries` | Reissues token-news request | Button disabled while loading; icon changes from download to renew after first load | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Automatic refresh | Not implemented | None | None | None | Not active |
| Refresh cooldown | Not implemented | None | None | None beyond loading disabled state | Not active |
| Loading-more state | Not implemented separately | None | None | None | Not active |
| End-of-list state | Not implemented beyond disabling next button on final local page | `currentNewsPage`, `totalPages` | None | Next button disabled | `FRONTEND_ACTIVE` |
| Duplicate prevention | Not implemented | None | None | Duplicate articles can remain visible | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Existing article retention while loading | Previous entries stay in hook state during refresh | `useNewsFeed` preserves previous state while setting `isLoading` | Same request | Existing cards remain visible if already loaded | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 11. Article expansion

No active article expansion UI is rendered by `NewsTab` or `NewsCard`.

| Expansion concern | Current behavior | Implementation | API request | Failure behavior | Status |
|---|---|---|---|---|---|
| Expand button | No active button in `NewsCard.tsx` | Expansion-related CSS classes exist in `NewsCard.module.scss` | None | N/A | `FRONTEND_UNUSED` |
| Expanded content request | No active caller | `getExpandedNewsArticle(contentHash)` exists in `client/src/services/news.ts` | Would call `client.api.news.articles[":contentHash"].expand.$get` if used | Catches errors, logs to console, returns null | `FRONTEND_UNUSED` |
| Content hash usage | Not active | `contentHash` exists in `NewsArticle` type | None active | N/A | `FRONTEND_UNUSED` |
| Modal/drawer/accordion/inline expansion | None found in active `NewsCard.tsx` | None active | None | N/A | Not active |
| Expansion loading/error/cache/collapse | None active | None active | None | N/A | Not active |
| External fallback link | Active article link exists | `NewsCard` anchor | No expansion request | Opens original article externally | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 12. Dates, sources, and external links

| Metadata concern | Source field | Transformation/helper | Missing/invalid behavior | Status |
|---|---|---|---|---|
| Sort timestamp | `publishedAt` | `Date.parse(article.publishedAt)` in `NewsTab` | Missing/invalid date sorts as 0 | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Displayed date | `publishedAt` | `new Date(article.publishedAt)` then `fmt.datetime.date` | Missing/invalid date is omitted | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source name | `sourceName`, `source` | `sourceName || source || tr("token.news.sourceFallback")` | Falls back to localized source fallback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source domain | Not extracted | None | Domain is not derived or displayed separately | Not active |
| Main article URL | `url` | Used directly as anchor `href` | Missing/invalid URL is not filtered before render | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Protocol validation | `url`, image fields | None found | Non-HTTP or malformed URLs are not rejected in frontend | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| New-tab behavior | `url` | `target="_blank"` | Always opens through browser if link is usable | `FRONTEND_ACTIVE` |
| Link security rel | Static anchor attributes | `rel="noopener noreferrer"` | Present on article link | `FRONTEND_ACTIVE` |
| Thumbnail image | `imageUrl`, `faviconUrl`, `favicon` | First available image source | Placeholder on missing thumbnail or load error | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Favicon image | `faviconUrl`, `favicon` | Rendered in source row | Hidden on load error | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 13. Token News state management

| State concern | File/hook | Initial value | Updated by | UI/request effect | Persistence |
|---|---|---|---|---|---|
| Token address | `TokenOverviewPage` route param | URL path value | Router | NewsTab render and token-news query | URL path |
| Token symbol/name | `TokenOverviewPage` details | `details.symbol ?? ""`, `details.name ?? ""` | Token details response | Initial fetch condition and token-news query | Server response |
| Article list | `useNewsFeed.entries` | `[]` | Successful `getTokenNews` response | Source for sorted articles | None |
| Loading state | `useNewsFeed.isLoading` | `false` | `fetchNews` start/end | Disables refresh button and controls skeleton/blank refresh states | None |
| Error state | `useNewsFeed.error` | `null` | `fetchNews` catch or start | Renders generic error banner | None |
| Last updated time | `useNewsFeed.updatedAt` | `null` | Successful response | Stored but not displayed by active UI | None |
| Loaded flag | `useNewsFeed.hasLoaded` | `false` | Fetch success or failure | Switches initial skeleton versus refresh/empty behavior and button icon description | None |
| Sorted articles | `NewsTab.sortedArticles` | `[]` | `useEffect` when `news.entries` changes | Controls article list, pagination, empty state, web-mention notice | None |
| Current page | `NewsTab.currentNewsPage` | `0` | Entries change, previous/next buttons | Controls visible article slice | None |
| Page size | `NEWS_PAGE_SIZE` | `10` | Constant | Local pagination size | None |
| Has-more flag | Derived `totalPages > 1` and current page | N/A | Derived each render | Shows/disables pagination controls | None |
| Refreshing state | Same as `isLoading` | `false` | `fetchNews` | Button disabled; no separate refresh indicator | None |
| Expanded article/content | None active | N/A | N/A | No active effect | Not active |
| Source/sort filters | None active | N/A | N/A | No filter UI | Not active |
| Thumbnail failure | `NewsCard.thumbnailFailed` | `false` | Thumbnail `onError` | Switches thumbnail to placeholder | None |

## 14. Loading, empty, error, and partial states

| News section or action | Loading UI | Empty UI | Error UI | Partial-data behavior | Retry/fallback | Status |
|---|---|---|---|---|---|---|
| Initial request | Three skeleton-style loading cards | N/A while loading | Generic error banner after failure | N/A | Header button can retry | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Successful empty response | None | Empty panel with no-results copy and Try Refresh button | None | N/A | Try Refresh button calls `fetchNews` | `FRONTEND_ACTIVE` |
| Initial failure | Loading skeleton disappears | No empty state while error exists | Generic translated error text | No article cards unless entries exist | Header button can retry | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Refresh with existing articles | Existing article cards remain visible; no explicit spinner beyond disabled button | N/A | Generic error can render above stale articles | Previous entries remain after failure | Refresh can be retried | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Refresh from empty state | No skeleton because `hasLoaded` is true | Empty state disappears while loading | Generic error on failure | Body can appear blank during refresh | Header button disabled while loading | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article missing image | No loading placeholder beyond browser image loading | Placeholder initial appears after missing/error | None | Uses favicon or placeholder | Thumbnail fallback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article missing source | N/A | N/A | None | Uses localized source fallback | Source fallback | `FRONTEND_ACTIVE` |
| Article invalid date | N/A | N/A | None | Date omitted on card; sorts as oldest | None | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Article missing summary | N/A | N/A | None | Description paragraph omitted | None | `FRONTEND_ACTIVE` |
| Article invalid link | N/A | N/A | None | Anchor still renders with raw `href` | Browser handles result; no frontend validation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 15. Token News navigation

| Source UI | Component | Required data | Destination | Internal/external | Validation | Status |
|---|---|---|---|---|---|---|
| TokenTabs News tab | `TokenTabs`, `TokenOverviewPage` refs | `newsRef` section exists | `#token-news` scroll target | Internal page scroll | No request validation needed | `FRONTEND_ACTIVE` |
| Article Open Article link | `NewsCard` | `article.url` | Original article URL | External new tab | No URL/protocol validation; has `noopener noreferrer` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Previous news page | `NewsTab` | `currentNewsPage > 0` | Previous local page | Internal local state | Button disabled on first page | `FRONTEND_ACTIVE` |
| Next news page | `NewsTab` | `currentNewsPage < totalPages - 1` | Next local page | Internal local state | Button disabled on last page | `FRONTEND_ACTIVE` |
| Back-to-news action | None active | N/A | N/A | N/A | N/A | Not active |
| Internal expanded article | None active | N/A | N/A | N/A | N/A | Not active |
| Source website link separate from article | None active | N/A | N/A | N/A | N/A | Not active |
| Related token route | None active | N/A | N/A | N/A | N/A | Not active |

## 16. Responsive behavior

Token News responsive behavior is CSS-driven. No mobile-specific request path, article data model, or separate mobile render tree was found in the active `NewsTab`/`NewsCard` chain.

| News block | Desktop behavior | Mobile/narrow behavior | Same data flow | Confirmed limitation |
|---|---|---|---|---|
| News header | Horizontal title and controls with space-between alignment | At `max-width: 768px`, header stacks vertically and aligns left | Yes | No separate mobile toolbar behavior beyond stacking. |
| Article grid | `repeat(auto-fill, minmax(300px, 1fr))` | At `max-width: 1024px`, min width becomes 250px; at `max-width: 768px`, one column | Yes | No masonry/featured/card-density variant. |
| Article card | Vertical card with 16:9 thumbnail and text below | At `max-width: 768px`, padding and text sizes reduce | Yes | Card remains table/list-like card; no compact feed row. |
| Description text | Two-line CSS clamp | Same clamp with smaller font | Yes | Long malformed text is hidden visually but not cleaned. |
| Pagination | Horizontal info and controls | At `max-width: 768px`, pagination stacks and controls align right | Yes | No touch-specific load-more replacement. |
| Expansion styles | Expansion classes exist in CSS | Mobile expansion styles also exist | No active data flow | Styles are disconnected from active card implementation. |

## 17. Unused or disconnected Token News code

| Candidate | Type | File/component | Active caller found | Reason excluded | Classification |
|---|---|---|---|---|---|
| `getExpandedNewsArticle` | Service helper | `client/src/services/news.ts` | No active caller from `NewsTab`/`NewsCard` | Article expansion is not wired in active Token News UI | `FRONTEND_UNUSED` |
| Expansion response types | Type definitions | `NewsArticleExpansion`, `NewsArticleExpansionResult` in `client/src/types/news.ts` | No active UI use | Expansion data is not rendered by active cards | `FRONTEND_UNUSED` |
| Expansion article fields | Type fields | `contentHash`, `extraSnippets`, `context` in `NewsArticle` | No active render/use in `NewsCard` | Fields support inactive expansion/context behavior | `FRONTEND_UNUSED` |
| Pagination request params | Type definitions | `TokenNewsQuery.limit`, `TokenNewsQuery.offset`, `NewsPaginationParams` | No active request use | Active pagination is local and sends no limit/offset | `FRONTEND_UNUSED` |
| Expansion styles | CSS classes | `NewsCard.module.scss` `.expandButton`, `.expandedBody`, `.contextGrid`, `.expandedMeta`, related classes | No active class usage in `NewsCard.tsx` | Expansion layout styles are disconnected from active card implementation | `FRONTEND_UNUSED` |

Unused Token News code artifact count: 5.

Chart news-marker code is not classified as unused here. It is a deferred chart-news boundary for a separate phase.

## 18. Frontend-only Token News flows

### Flow A - Open Token News

1. User opens `/tokens/:address`.
2. `TokenOverviewPage` renders the `#token-news` section.
3. When `address && details` is true, `NewsTab` is mounted with `address`, `details.symbol ?? ""`, and `details.name ?? ""`.
4. `NewsTab` constructs `{ address, symbol, name }` and passes it to `useNewsFeed`.
5. If `address && symbol && name` are all truthy, `NewsTab` calls `news.fetchNews()` in an effect.
6. `useNewsFeed` calls `getTokenNews`.
7. `getTokenNews` calls the token-news frontend API contract and maps articles into entries.
8. `NewsTab` sorts entries by publication time, resets the page to 0, and renders loading, error, empty, or article-list UI.

### Flow B - Refresh Token News

1. User clicks the header fetch/refresh icon button, or the empty-state Try Refresh button.
2. `NewsTab` calls `news.fetchNews()`.
3. `useNewsFeed` sets `isLoading=true` and clears `error`.
4. Existing entries remain in local state while the request is pending.
5. On success, entries are replaced, `updatedAt` is stored, `hasLoaded=true`, and page resets to 0 through the entries effect.
6. On failure, previous entries remain, `error` is set, and a generic error banner is rendered.

### Flow C - Change page

1. Loaded and sorted articles exceed 10 entries.
2. `NewsTab` renders previous/next icon buttons and showing X-Y of Z text.
3. User clicks next or previous.
4. `currentNewsPage` changes locally.
5. `visibleArticles` slices the same sorted list.
6. No API request is issued.

### Flow D - Open an article

1. User clicks the Open Article link inside a `NewsCard`.
2. The anchor uses `article.url` as `href`.
3. Browser opens the URL in a new tab.
4. The anchor includes `rel="noopener noreferrer"`.
5. The frontend does not validate URL format or protocol before rendering the link.

### Flow E - Expand an article

No active internal article expansion flow exists. Expansion service/types/styles are present but disconnected from the active `NewsCard` implementation.

### Flow F - Handle incomplete article data

1. Missing image uses favicon if available, otherwise a placeholder with source initial.
2. Failed thumbnail load sets `thumbnailFailed=true` and switches to placeholder.
3. Failed favicon load hides the favicon element.
4. Missing source uses localized source fallback.
5. Missing or invalid date is omitted from the card and sorts as timestamp 0.
6. Missing description omits the description paragraph.
7. Invalid links are not filtered by the frontend.

## 19. Architecture-ready Token News summary

### Confirmed Token News frontend blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Token News section container | `TOKEN-NEWS-01`, `TOKEN-NEWS-02` | `TokenOverviewPage`, `NewsTab` | Mounts news UI when token address and details are available and hands token identity into news flow | Token Overview sub-feature node. |
| News request/state layer | `TOKEN-NEWS-03`, `TOKEN-NEWS-04`, `TOKEN-NEWS-12`, `TOKEN-NEWS-13` | `useNewsFeed`, `getTokenNews`, `NewsTab` | Fetches articles, tracks loading/error/loaded state, and retains previous entries during refresh | Frontend-to-backend boundary and local state block. |
| Article list and local pagination | `TOKEN-NEWS-05`, `TOKEN-NEWS-06`, `TOKEN-NEWS-11` | `NewsTab` | Sorts articles, slices local pages, shows pagination and web-mention notice | Pure frontend list-management block. |
| Article cards and metadata | `TOKEN-NEWS-07`, `TOKEN-NEWS-08`, `TOKEN-NEWS-09`, `TOKEN-NEWS-14` | `NewsCard` | Displays article title, description, source, image/favicon fallback, date, and text rendering | Article presentation block. |
| External article navigation | `TOKEN-NEWS-10` | `NewsCard` article link | Opens original article URL in new tab | External navigation boundary. |

No active article-expansion architecture block is confirmed for Token News on `/tokens/:address`.

### Token News frontend-to-backend boundaries

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| News request/state layer | Token news feed | Hono RPC `client.api["token-news"].$get` | Fetch token-related article list for `{ address, symbol, name }` | Initial `NewsTab` effect and manual refresh/retry | `client/src/hooks/useNewsFeed.ts`, `client/src/services/news.ts`, `client/src/components/token/NewsTab.tsx` |

The inactive expansion helper would call `client.api.news.articles[":contentHash"].expand.$get`, but it has no active `NewsTab` or `NewsCard` caller and is therefore not an active frontend-to-backend boundary for this phase.

### Token News navigation boundaries

| Source block | Destination | Entity | Trigger |
|---|---|---|---|
| TokenTabs News tab | `#token-news` section | Token News section | User clicks News tab on Token Overview. |
| Article card link | `article.url` | Original article | User clicks Open Article link. |
| Pagination controls | Local current page | Loaded article list | User clicks previous/next news page. |

### Capabilities eligible for backend verification

Only canonical IDs that issue a request, depend on backend-provided article data, depend on response shape, or need failure-mode verification are listed:

1. `TOKEN-NEWS-03` Initial token-news request
2. `TOKEN-NEWS-04` Manual news refresh
3. `TOKEN-NEWS-05` Article sorting and page reset
4. `TOKEN-NEWS-07` Article card rendering
5. `TOKEN-NEWS-08` Article thumbnail and favicon fallback
6. `TOKEN-NEWS-09` Source and publication metadata display
7. `TOKEN-NEWS-10` External article navigation
8. `TOKEN-NEWS-11` Related web-mention notice
9. `TOKEN-NEWS-12` Loading, empty, and error states
10. `TOKEN-NEWS-13` Stale data retention during refresh/failure
11. `TOKEN-NEWS-14` Summary/snippet text rendering

## 20. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should the initial news request run when symbol or name is missing but address exists? | `NewsTab` renders with empty fallback strings, but the initial effect requires all three values | Token News product/API contract verification |
| Should token-news requests include `limit` or `offset`, or is local-only pagination intentional? | Type support exists, but active request sends no pagination params | Token News API contract verification |
| Should refresh show a distinct background-loading indicator while stale articles remain visible? | Existing cards remain and only the button disables | Token News UX hardening |
| Should refresh from an empty state keep the empty panel visible or show skeletons? | Empty-state refresh can leave the section body blank while loading | Token News UX hardening |
| Should failed refreshes indicate that displayed articles are stale? | Error can coexist with previous entries, but no stale/last-updated label is rendered | Token News UX hardening |
| Should `updatedAt` be displayed? | Hook stores it, but active UI does not render it | Token News UX/product review |
| Should duplicate article URLs be filtered or deduplicated before render? | Active list maps every returned article and uses URL as key when available | Token News data-quality verification |
| Should article URLs and image URLs be validated or protocol-restricted? | Active card renders raw URLs into `href` and `src` attributes | Token News security/robustness review |
| Should article title/description/source text be normalized for scraped markup, navigation fragments, entities, or repeated text? | Active UI relies on React escaping and CSS clamping, not cleanup | Token News content-quality hardening |
| Should internal article expansion be revived or removed? | Expansion service/types/styles exist but no active UI calls them | Token News cleanup/product decision |
| Should web-mention notice distinguish missing `sourceType` from explicit non-news values? | `sourceType !== "news"` treats missing sourceType as non-news | Token News response-shape verification |

## 21. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2A_MARKET_FRONTEND.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/NewsTab.tsx`
- `client/src/components/token/NewsTab.module.scss`
- `client/src/components/token/NewsCard.tsx`
- `client/src/components/token/NewsCard.module.scss`
- `client/src/hooks/useNewsFeed.ts`
- `client/src/services/news.ts`
- `client/src/types/news.ts`
- `client/src/components/token/index.ts`
- `client/src/components/token/TokenTabs.tsx`
- `client/src/pages/token/index.tsx`
