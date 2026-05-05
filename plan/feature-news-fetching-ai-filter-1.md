---
goal: Implement N8N-Powered News Fetching and Filtering Integration
version: 1.0
date_created: 2026-04-28
last_updated: 2026-04-28
owner: Development Team
status: 'Planned'
tags: [feature, n8n, news-aggregation, webhook, crypto-news, news-filtering]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This implementation plan outlines the development of a news fetching and filtering service that leverages the existing n8n workflow (`news-search-and-filter.json`) for content aggregation and AI-powered filtering. The workflow uses Brave Search API to find articles about the token currently selected in the token-overview page and Google Gemini LLM to intelligently filter for relevance. The system receives filtered crypto news articles via webhook POST at `http://localhost:5678/webhook/latest-news`, stores them in a database with token context (address, symbol, name), and exposes them through REST APIs for client consumption. News is fetched only when the user explicitly opens or refreshes the news tab.

### Webhook Request Body Format

The webhook will receive user context data to associate with the filtered news batch:

```json
{
  "address": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "symbol": "jup",
  "name": "Jupiter"
}
```

N8N will attach the news articles in the standard response schema format with `output.entry[]` containing title, url, description, timestamp, meta, and extra_snippets fields.

## 1. Requirements & Constraints

- **REQ-001**: News fetching workflow uses Brave Search API via n8n at webhook endpoint `http://localhost:5678/webhook/latest-news`
- **REQ-002**: N8N workflow filters articles using Google Gemini LLM, returns `entry[]` array with title, url, description, timestamp, meta, extra_snippets
- **REQ-003**: Webhook payload must include token context: address (token address), symbol (token symbol), name (token name)
- **REQ-004**: System must support concurrent article processing without losing data integrity
- **REQ-005**: News articles must be persisted in database with metadata and n8n filter results
- **REQ-006**: Client must display filtered news with source attribution and relevance indicators
- **REQ-007**: System must handle duplicate detection across multiple news sources
- **CON-001**: N8N workflow execution timeout limited to 30 seconds per fetch cycle
- **CON-002**: Database write performance must handle 500+ articles per fetch cycle
- **CON-003**: News fetch requests must be user initiated and must not run in the background without explicit token-overview tab interaction
- **GUD-001**: Follow existing project TypeScript conventions and naming patterns
- **GUD-002**: Implement comprehensive error logging and monitoring for webhook health
- **PAT-001**: Implement exponential backoff for failed webhook retries
- **SEC-001**: Validate webhook payload schema before processing (address, symbol, name must be present)
- **SEC-002**: Sanitize article URLs and content before storage and display

## 2. Implementation Steps

### Implementation Phase 1: Database and Schema Foundation

- **GOAL-001**: Establish data persistence layer and schema for news articles with n8n filter metadata and user context tracking

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add news schema definitions to `server/src/db/schema.ts` with tables: `news_articles`, `news_batches`, `user_sources` | | |
| TASK-002 | Define `news_articles` table in `server/src/db/schema.ts` with columns: id (PK), title, url (unique indexed), description, timestamp, source_name, favicon_url, content_hash (for dedup), batch_id (FK) | | |
| TASK-003 | Define `news_batches` table in `server/src/db/schema.ts` with: id (PK), address, symbol, name, created_at (stores token context for each batch) | | |
| TASK-004 | Define `user_sources` table in `server/src/db/schema.ts` for user source preferences: id (PK), address, source_name, is_enabled (boolean) | | |
| TASK-005 | Verify schema changes are applied manually through `npm run db:push` and document that no migration file is required | | |

### Implementation Phase 2: N8N Workflow Configuration

- **GOAL-002**: Verify and integrate the existing n8n workflow (news-search-and-filter.json) that uses Brave Search + Google Gemini filtering

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Review n8n workflow `n8n/news-search-and-filter.json` architecture: Webhook → Keywords Extractor → Brave Search → Normalize → Aggregate → LLM Filter → Output Parser | | |
| TASK-007 | Verify Brave Search API credentials and token search query format: "token {name}({symbol}) latest news in {current_month}" | | |
| TASK-008 | Verify Google Gemini LLM model (gemma-4-31b-it) configured with detailed filtering prompt for token relevance evaluation | | |
| TASK-009 | Review LLM filtering prompt logic: includes/excludes based on token being PRIMARY subject with specific events/data | | |
| TASK-010 | Verify Structured Output Parser converts LLM response into proper JSON schema with `entry[]` array | | |
| TASK-011 | Verify LLM filter gate error handling: maxTries=5, waitBetweenTries=2000ms for resilience | | |
| TASK-012 | Verify webhook path configured to `/latest-news` with responseMode=`lastNode` to return filtered articles | | |
| TASK-013 | Verify normalized entries output format matches schema: title, url, description, timestamp, meta (favicon, source), extra_snippets | | |
| TASK-014 | Create workflow documentation in `docs/N8N_WORKFLOW_SETUP.md` explaining Brave Search API + Gemini filtering logic and LLM prompt strategy | | |

### Implementation Phase 3: Webhook Handler and API Integration

- **GOAL-003**: Implement backend webhook handler to receive and validate pre-filtered news payload from n8n

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Create webhook handler file `server/src/api/routes/news.ts` with POST `/api/news/webhook` endpoint | | |
| TASK-016 | Implement payload validation middleware using Zod schema in `server/src/types/news.schema.ts` (validate address, symbol, name, entries) | | |
| TASK-017 | Create type definitions in `server/src/types/news.types.ts` for NewsArticle, UserContext, FilteredNews | | |
| TASK-018 | Implement article batch insertion with conflict handling (upsert on url) in `server/src/services/news.service.ts` | | |
| TASK-019 | Store token context (address, symbol, name) associated with each filtered news batch | | |
| TASK-020 | Add rate limiting middleware for webhook endpoint (max 10 requests/minute per source) | | |
| TASK-021 | Create webhook response formatter returning status, articles_received, articles_stored | | |
| TASK-022 | Add comprehensive logging in `server/src/utils/logger.ts` for all webhook operations | | |
| TASK-023 | Write webhook tests in `server/tests/api/news-webhook.test.ts` with mock payloads | | |

### Implementation Phase 4: Token Overview News Tab

- **GOAL-004**: Implement a dedicated news tab inside the token-overview page that fetches news only when the user opens or refreshes the tab

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Add a News tab entry to `client/src/components/token/TokenTabs` and render it from `client/src/pages/token-overview/index.tsx` | | |
| TASK-025 | Create a token-overview news panel component that renders inside the new tab without affecting existing overview, markets, and insight sections | | |
| TASK-026 | Create a news card component for token-overview usage with title, source, timestamp, and relevance indicator | | |
| TASK-027 | Create a custom hook that fetches news only on explicit user request when the News tab becomes active or refresh is clicked | | |
| TASK-028 | Implement API service method `client/src/services/newsService.ts` GET `/api/news/filtered` endpoint using token meta data (address, symbol, name) as query input | | |
| TASK-029 | Create type definitions in `client/src/types/news.ts` for NewsArticle, FilterResult, and TokenNewsQuery | | |
| TASK-030 | Implement relevance indicator visual that is scoped to the News tab content | | |
| TASK-031 | Add pagination or load-more behavior for articles with limit parameter inside the News tab | | |
| TASK-032 | Implement source favicon display from meta.favicon field with fallback | | |
| TASK-033 | Add source filter/toggle controls within the News tab only | | |
| TASK-034 | Implement manual refresh action so news is fetched only on user interaction | | |
| TASK-035 | Create responsive News tab layout for desktop and mobile using existing token-overview styling patterns | | |

### Implementation Phase 5: API Endpoints and Data Retrieval

- **GOAL-005**: Create REST API endpoints for retrieving filtered news with various filters and sorting

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-036 | Create GET `/api/news/filtered` endpoint with query params: limit, offset, source_filter, sort_by, address, symbol, name | | |
| TASK-037 | Implement query builder with Drizzle ORM joining `news_articles` with token context filters | | |
| TASK-038 | Add sorting options: timestamp (DESC), source (ASC), relevance (if available from n8n) | | |
| TASK-039 | Create GET `/api/news/sources` endpoint returning available news sources with article counts | | |
| TASK-040 | Create GET `/api/news/stats` endpoint with metrics: total_articles, articles_by_source, articles_by_token | | |
| TASK-041 | Create POST `/api/news/preferences` endpoint to save/retrieve user-specific source preferences | | |
| TASK-042 | Implement HTTP caching headers (max-age=300s) on GET endpoints | | |
| TASK-043 | Create API response formatter in `server/src/utils/response.ts` with consistent error/success structure | | |
| TASK-044 | Write API endpoint tests in `server/tests/api/news.test.ts` | | |

## 3. Alternatives

- **ALT-001**: Use server-sent events (SSE) instead of polling for real-time updates - provides lower latency but requires persistent connections; polling chosen for simplicity and compatibility
- **ALT-002**: Use different search provider (Google News, CoinGecko) instead of Brave Search - Brave chosen for crypto-specific results and API availability
- **ALT-003**: Use different LLM (ChatGPT, Claude) instead of Google Gemini - Gemini chosen for cost-effectiveness and already configured in workflow
- **ALT-004**: Store all articles without filtering, filter on client-side - reduces server load but increases client payload; n8n filtering chosen for better UX
- **ALT-005**: Implement news fetching directly in backend cron job instead of n8n - n8n chosen for workflow visualization, orchestration flexibility, and easy maintenance

## 4. Dependencies

- **DEP-001**: N8N workflow (`news-search-and-filter.json`) running at `http://localhost:5678` with Brave Search + Google Gemini capabilities
- **DEP-002**: Brave Search API credentials configured for token news searches
- **DEP-003**: Google Gemini LLM (PaLM) API with gemma-4-31b-it model available
- **DEP-004**: PostgreSQL database (already in project) updated through `npm run db:push`
- **DEP-005**: Hono web framework (existing in server codebase) for routing
- **DEP-006**: TypeScript 5.x environment with strict type checking enabled
- **DEP-007**: Zod validation library for schema validation
- **DEP-008**: Winston logger for structured logging
- **DEP-009**: Node.js 18+ runtime with async/await support
- **DEP-010**: Tailwind CSS for client-side component styling

## 5. Files

- **FILE-001**: `server/src/db/schema.ts` - Database schema definitions for news tables
- **FILE-002**: `server/src/db/init.ts` - Database initialization validation after `npm run db:push`
- **FILE-003**: `server/src/api/routes/news.ts` - Webhook handler and API endpoints
- **FILE-004**: `server/src/services/news.service.ts` - News data access layer
- **FILE-005**: `server/src/types/news.schema.ts` - Zod validation schemas (includes user context: address, symbol, name)
- **FILE-006**: `server/src/types/news.types.ts` - TypeScript type definitions
- **FILE-007**: `server/src/utils/logger.ts` - Structured logging utility
- **FILE-008**: `client/src/pages/token-overview/index.tsx` - Token overview page containing the News tab
- **FILE-009**: `client/src/components/token/TokenTabs` - Tab navigation for adding the News tab
- **FILE-010**: `client/src/components/token/NewsTab.tsx` - News panel and news card UI rendered inside the token-overview page
- **FILE-011**: `client/src/hooks/useNewsFeed.ts` - React hook for user-initiated news fetching
- **FILE-012**: `client/src/services/newsService.ts` - API client service
- **FILE-013**: `client/src/types/news.ts` - Client-side TypeScript types
- **FILE-014**: `n8n/news-search-and-filter.json` - N8N workflow definition (Brave Search + Gemini filtering)
- **FILE-015**: `docs/N8N_WORKFLOW_SETUP.md` - N8N workflow configuration documentation
- **FILE-016**: `.env.example` - Environment variables template for API keys (Brave Search, Gemini)

## 6. Testing

- **TEST-001**: Unit test for Zod schema validation with valid/invalid payloads (address, symbol, name)
- **TEST-002**: Unit test for user-initiated fetch behavior in the token-overview News tab
- **TEST-003**: Unit test for duplicate detection algorithm using content_hash
- **TEST-004**: Integration test for webhook handler accepting POST payload and storing articles
- **TEST-005**: Integration test for news API endpoints with filtering and sorting by token context
- **TEST-006**: Integration test for database constraint enforcement (unique URLs, foreign keys)
- **TEST-007**: Load test for concurrent article insertion (500+ articles/cycle)
- **TEST-008**: End-to-end test simulating full n8n webhook → storage → token-overview News tab flow
- **TEST-009**: Error recovery test for webhook timeout scenarios
- **TEST-010**: Security test for XSS prevention in article content display
- **TEST-011**: Security test for webhook payload injection validation
- **TEST-012**: Performance test for article storage and retrieval latency (<500ms for batch of 50)
- **TEST-013**: Rate limiting test verifying webhook endpoint blocks excessive requests
- **TEST-014**: Client component test for News tab and article card rendering with various article statuses

## 7. Risks & Assumptions

- **RISK-001**: Brave Search or Google Gemini API may be unavailable or rate-limited during peak usage - **Mitigation**: Implement comprehensive error logging and alert thresholds for 0% success rate, configure retry logic with exponential backoff
- **RISK-002**: Google Gemini LLM filtering logic may be too strict/lenient for specific token contexts - **Mitigation**: Implement monitoring dashboard to track filter acceptance rates and user feedback, adjust prompt strategy as needed
- **RISK-003**: Database growth from article accumulation could impact query performance - **Mitigation**: Implement data retention policy (delete articles >30 days old) and create indexes on timestamp and user context columns
- **RISK-004**: Duplicate articles from different search results could appear - **Mitigation**: Implement content_hash based deduplication with configurable similarity threshold
- **RISK-005**: Client polling could create unnecessary server load if update frequency too high - **Mitigation**: Set polling interval to 5 minutes with exponential backoff for errors
- **RISK-006**: Webhook payload may lose data during network transmission - **Mitigation**: Implement checksum validation and retry logic with idempotency keys
- **ASSUMPTION-001**: N8N webhook will trigger synchronously and respond within 30 seconds
- **ASSUMPTION-002**: Brave Search API will consistently return news results for crypto tokens with proper formatting
- **ASSUMPTION-003**: Google Gemini LLM will parse and evaluate article relevance consistently
- **ASSUMPTION-004**: PostgreSQL database will handle 500+ concurrent writes without deadlocks
- **ASSUMPTION-005**: Token context (address, symbol, name) will be provided in webhook payload for every user-initiated request
- **ASSUMPTION-006**: Article URLs will remain stable and not redirect frequently

## 8. Related Specifications / Further Reading

- [N8N Workflow Documentation](https://docs.n8n.io/workflows/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Zod Validation Library](https://zod.dev/)
- [Hono Web Framework](https://hono.dev/)
- [Winston Logger Documentation](https://github.com/winstonjs/winston)
- [Project Context](./PROJECT_CONTEXT.md)
- [Style Guide](./style-guide.md)
