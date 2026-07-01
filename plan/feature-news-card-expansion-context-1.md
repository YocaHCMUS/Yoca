---
goal: Implement expandable news cards with token context
version: 1.0
date_created: 2026-05-03
last_updated: 2026-05-03
owner: Development Team
status: 'Planned'
tags: [feature, news, ui, ai, cache, charts]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan extends the existing news implementation in `client/src/components/token/NewsCard.tsx` and `client/src/components/token/NewsTab.tsx` so each news card can expand in-place, render extra snippets, and show two historical context sparklines for price and market cap. The backend work adds a cache-only token-context accessor so the expanded card can render richer content without changing the existing news-list behavior. AI tags are intentionally deferred and handled in a separate follow-up plan.

## 1. Requirements & Constraints

- **REQ-001**: `NewsCard` must expose an explicit expand/collapse control and expand in-place inside the news grid.
- **REQ-002**: The expanded card must render extra snippets and token context for the five days around the news item.
- **REQ-003**: The expanded token context must be displayed as two sparkline charts: one for price and one for market cap.
- **REQ-004**: AI tags are deferred and must not block delivery of the expand-card and token-context work in this plan.
- **REQ-005**: Any later AI-tag workflow must be designed as an additive feature with a separate cache boundary and n8n contract.
- **REQ-006**: Token context must be read through a new additive function in the existing token service layer and must not overwrite `getTokenHistoricalData`.
- **REQ-007**: The token context accessor must use cache-only extraction with try/catch handling and must not call any upstream fetch flow.
- **REQ-008**: The expanded-card animation must be simple, linear, and responsive across desktop and mobile grid layouts.
- **REQ-009**: Client strings for expand/collapse, tags, context labels, and chart titles must be added to both `en.ts` and `vi.ts`.
- **SEC-001**: Rendered snippets, tags, and labels must be treated as plain text and must not use unsafe HTML injection.
- **SEC-002**: External article links must continue to open with safe `noopener noreferrer` behavior.
- **CON-001**: News AI tag cache records must be keyed by a stable article identifier such as `content_hash` and must be idempotent.
- **CON-002**: The token context feature assumes data already exists in the current cache layer; missing cache data must degrade gracefully.
- **GUD-001**: Follow the existing Carbon, SCSS module, and localization patterns already used in the client codebase.
- **PAT-001**: Extend existing service modules by adding new functions and exports rather than replacing current public functions.

## 2. Implementation Steps

### Implementation Phase 1: Expansion Payload Backend

- GOAL-001: Add the backend workflow that serves expanded news-card payloads with snippets and token context.
- Completion criteria: the backend can return an expanded payload for a news article using existing cached data.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add a news expansion service in `server/src/services/news.service.ts` or a new adjacent service file that merges base article data, extra snippets, and token context into one response object for the expanded card. | | |
| TASK-002 | Extend `server/src/routes/news.ts` with a retrieval endpoint such as `GET /api/news/articles/:contentHash/expand` that returns the expanded payload for a single article. | | |
| TASK-003 | Update `server/src/types/news.schema.ts` and `server/src/types/news.types.ts` with validation and TypeScript types for extra snippets, context payloads, and the expansion response shape. | | |

### Implementation Phase 2: Cache-Only Token Context Accessor

- GOAL-002: Add a new additive token-service function that returns five-day historical context without changing the existing historical-data API.
- Completion criteria: the new function returns aligned price and market-cap series from cache only, and returns null or an empty result on cache miss without making an upstream request.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Add `getTokenHistoricalContext(tokenAddress, days = 5)` to `server/src/services/tokens/token-history.ts` without changing `getTokenHistoricalData(...)`. | | |
| TASK-005 | Export the new token-context function from `server/src/services/tokens/index.ts` so callers can import it from the existing token service module. | | |
| TASK-006 | Implement the token-context function as cache-only extraction with `try/catch`, using the existing cached token history data already available in the server layer. | | |
| TASK-007 | Define the context return type as two aligned sparkline series, one for price and one for market cap, plus the date labels required for chart rendering. | | |

### Implementation Phase 3: Expandable NewsCard and NewsTab UI

- GOAL-003: Update the news card and news tab components so the user can expand a card inline and view the extra data with a linear animation.
- Completion criteria: clicking the expand button toggles a card between compact and expanded states, and the expanded state shows snippets, AI tags, and two context charts.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Extend `client/src/types/news.ts` with the new article shape for `extraSnippets` and `context` data. | | |
| TASK-009 | Update `client/src/components/token/NewsTab.tsx` to track the currently expanded card and to request the expansion payload on demand. | | |
| TASK-010 | Update `client/src/components/token/NewsCard.tsx` so each card renders an expand/collapse button, fills the grid row when expanded, and animates the transition with a simple linear timing curve. | | |
| TASK-011 | Update `client/src/components/token/NewsCard.module.scss` and `client/src/components/token/NewsTab.module.scss` so the expanded card spans at least two row-heights and the grid remains responsive. | | |
| TASK-012 | Render the extra snippets in the expanded card as a plain-text list and render the context as two sparkline charts using `client/src/components/charts/SparklineChart/index.tsx`. | | |
| TASK-013 | Add the required localization entries to `client/src/config/localization/en.ts` and `client/src/config/localization/vi.ts` for expand, collapse, snippets, context, and chart labels. | | |

### Implementation Phase 4: Validation and Regression Coverage

- GOAL-004: Add tests and verification steps that prove the expanded-card flow, cache behavior, and token-context accessor work together without breaking the existing news tab.
- Completion criteria: backend cache-hit behavior, token-context extraction, and client expansion rendering are covered by automated tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Add backend tests for `getTokenHistoricalContext(...)` covering aligned five-day output and graceful cache-miss handling. | | |
| TASK-015 | Add client component tests for `NewsCard` expansion state, including the presence of the expand/collapse control and the expanded detail region. | | |
| TASK-016 | Add client component tests for `NewsTab` to verify that only one card is expanded at a time and that the loading skeleton remains intact. | | |
| TASK-017 | Run the relevant TypeScript, lint, and targeted component tests after implementation and capture any regression fixes in the same slice. | | |

### Deferred Scope

- GOAL-005: Defer AI analysis tags until a separate follow-up plan is created.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Keep AI tags out of the current implementation scope and do not create the news-tag cache table, AI-tag service, or AI-tag workflow in this plan. | | |

## 3. Alternatives

- **ALT-001**: Use a modal or side panel for the expanded content instead of in-place grid expansion. Rejected because the requirement is to expand the card in the grid and preserve the feed layout.
- **ALT-002**: Prefetch all AI tags and token context when the tab opens. Rejected because the plan should keep the base news list lightweight and fetch expanded data only when the user expands a card.
- **ALT-003**: Render a single combined chart for context instead of two sparklines. Rejected because the requirement explicitly calls for two separate context charts.
- **ALT-004**: Reuse the existing news fetch service for AI tags. Deferred because AI tags are out of scope for this plan and should be handled in a separate follow-up spec.

## 4. Dependencies

- **DEP-001**: Existing news tab implementation in `client/src/components/token/NewsTab.tsx` and `client/src/components/token/NewsCard.tsx`.
- **DEP-002**: Existing localized formatting and translation context in `client/src/contexts/LocalizationContext.tsx` and `client/src/config/localization/en.ts` / `client/src/config/localization/vi.ts`.
- **DEP-003**: Existing reusable sparkline renderer in `client/src/components/charts/SparklineChart/index.tsx`.
- **DEP-004**: Existing token service exports in `server/src/services/tokens/index.ts` and `server/src/services/tokens/token-history.ts`.
- **DEP-005**: Existing PostgreSQL and Drizzle schema infrastructure in `server/src/db/schema.ts`.
- **DEP-006**: Existing token history cache data for five-day context rendering.

## 5. Files

- **FILE-001**: `server/src/services/news.service.ts` - add the news expansion aggregation service or helper.
- **FILE-002**: `server/src/routes/news.ts` - add the article expansion retrieval endpoint.
- **FILE-003**: `server/src/types/news.schema.ts` - add validation for the new expansion payload shape.
- **FILE-004**: `server/src/types/news.types.ts` - add TypeScript types for expanded articles and context.
- **FILE-005**: `server/src/services/tokens/token-history.ts` - add the new cache-only context accessor.
- **FILE-006**: `server/src/services/tokens/index.ts` - export the new context accessor.
- **FILE-007**: `client/src/types/news.ts` - extend client-side article and expansion types.
- **FILE-008**: `client/src/components/token/NewsCard.tsx` - add expand/collapse UI and expanded content rendering.
- **FILE-009**: `client/src/components/token/NewsCard.module.scss` - add card expansion, layout span, and animation styles.
- **FILE-010**: `client/src/components/token/NewsTab.tsx` - manage the expanded-card state and detail fetch flow.
- **FILE-011**: `client/src/components/token/NewsTab.module.scss` - update the news grid and loading behavior for expansion.
- **FILE-012**: `client/src/components/charts/SparklineChart/index.tsx` - reuse existing sparkline rendering for the context charts.
- **FILE-013**: `client/src/config/localization/en.ts` - add English strings for the new controls and labels.
- **FILE-014**: `client/src/config/localization/vi.ts` - add Vietnamese strings for the new controls and labels.
- **FILE-015**: `server/tests/token-history-context.test.ts` - verify cache-only context extraction.
- **FILE-016**: `client/src/components/token/NewsCard.test.tsx` - verify expand/collapse rendering and animation-triggered state changes.
- **FILE-017**: `client/src/components/token/NewsTab.test.tsx` - verify expanded-card coordination and skeleton behavior.

## 6. Testing

- **TEST-001**: Unit test `getTokenHistoricalContext(...)` to confirm the function returns aligned five-day price and market-cap series from cache only.
- **TEST-002**: Unit test `getTokenHistoricalContext(...)` for a missing-cache path that returns null or an empty result without throwing.
- **TEST-003**: Component test for `NewsCard` expansion that checks the button label, expanded body, and chart placeholders.
- **TEST-004**: Component test for `NewsTab` that ensures one expanded card at a time and verifies the loading skeleton still renders during the first fetch.
- **TEST-005**: Integration test for the article-expansion endpoint to validate the merged payload shape returned to the client.
- **TEST-006**: Regression test for localization keys in `en.ts` and `vi.ts` to ensure the new labels resolve in both languages.
- **TEST-007**: Visual or DOM-level test for the card-row expansion behavior to confirm the expanded card occupies at least two row-heights.
- **TEST-008**: Manual verification that the expanded card animation is linear and does not cause layout breakage at mobile breakpoints.

## 7. Risks & Assumptions

- **RISK-001**: The token context cache may not contain a full five-day window for every article. Mitigation: render whatever cached points exist and show a graceful fallback when series are incomplete.
- **RISK-002**: Expanding a card inside a dense grid may cause layout shifts on smaller screens. Mitigation: keep the animation simple, reserve space with CSS, and test mobile breakpoints.
- **RISK-003**: The sparkline chart data may be empty or uneven between price and market-cap series. Mitigation: normalize series lengths in the service layer before rendering.
- **ASSUMPTION-001**: The separate n8n workflow for AI tags will be reachable from the backend when a cache miss occurs.
- **ASSUMPTION-002**: The existing token cache already contains enough historical data to build a five-day context series without upstream fetches.
- **ASSUMPTION-003**: The existing Carbon and SCSS module setup can support the in-place expansion animation without introducing a new UI framework.
- **ASSUMPTION-004**: The news list will remain the primary entry point, and expansion will only be triggered by an explicit user action.

## 8. Related Specifications / Further Reading

- [Existing news implementation plan](./feature-news-fetching-ai-filter-1.md)
- [Token overview page](../client/src/pages/token-overview/index.tsx)
- [News card component](../client/src/components/token/NewsCard.tsx)
- [News tab component](../client/src/components/token/NewsTab.tsx)
- [Token historical data service](../server/src/services/tokens/token-history.ts)
- [Sparkline chart component](../client/src/components/charts/SparklineChart/index.tsx)
