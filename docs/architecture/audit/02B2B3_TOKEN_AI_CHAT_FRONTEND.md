# Yoca Token AI Chat Frontend Audit

## 1. Scope

This Phase 2B2B3 audit covers only the active Ask Yoca Token AI Chat frontend rendered from the Token Overview route `/tokens/:address`, specifically `TokenAIChat` and its direct request/render chain.

In scope:

- `TokenAIChat` mounting, auth gate, prompt entry, submission, loading, error, quota, and answer rendering
- Token context passed into AI requests
- Structured AI response rendering, rich-text handling, evidence and source rendering, provider/cache/confidence/fallback metadata, and disclaimer presentation
- Conversation/state behavior, token changes, retry/resend behavior, and responsive behavior
- Token-AI-specific frontend code that exists but is not active in the current `/tokens/:address` flow

Out of scope:

- Backend prompt construction, AI orchestration, Gemini or alternative provider internals, model selection logic, backend fallback-generation algorithms, and server-side cache implementation
- Token News feed, Chart News markers, token core identity/statistics/chart/holders/markets already audited, wallet AI chat, wash-trading, alerts, watchlist, profile, pricing, payment, shared auth, shared shell, deployment, databases, and Mermaid architecture

Reference documents used as context only: `01_REPOSITORY_RUNTIME_MAP.md`, `02A_FRONTEND_ROUTE_REACHABILITY.md`, `02B1_SHARED_SHELL_SEARCH_AUTH.md`, `02B2A_MARKET_FRONTEND.md`, `02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`, `02B2B2A_TOKEN_NEWS_FRONTEND.md`, and `02B2B2B_TOKEN_CHART_NEWS_MARKERS_FRONTEND.md`.

## 2. Classification and counting rules

Statuses describe frontend connectivity only:

- `FRONTEND_ACTIVE`: rendered from the active Token AI Chat flow, has a visible or lifecycle entry point, has connected frontend behavior, and completes its intended frontend role.
- `FRONTEND_ACTIVE_WITH_LIMITATIONS`: connected but has a confirmed limitation such as missing validation, missing request cancellation, missing stale-response protection, missing retry, subscription/auth dependency, response-shape assumptions, missing URL validation, partial rich-text parsing, missing malformed-text cleanup, local-only chat state, missing conversation persistence, incomplete error-specific feedback, fallback ambiguity, or incomplete responsive behavior.
- `FRONTEND_BROKEN`: visible Token AI Chat capability exists but cannot complete its intended basic frontend role.
- `FRONTEND_UNUSED`: Token AI Chat frontend implementation exists but has no active render, request, or interaction chain from `/tokens/:address`.
- `UNCERTAIN`: source evidence is insufficient.

Capability counts are derived only from canonical capabilities `TOKEN-AI-01` through `TOKEN-AI-15`. Repeated evidence, response fields, formatting helpers, CSS rows, frontend-flow descriptions, architecture blocks, and unused artifacts do not create additional capability counts.

## 3. Active Token AI Chat render and call chain

`client/src/App.tsx` registers `/tokens/:address` with `TokenOverviewPage`. In `client/src/pages/token-overview/index.tsx`, `TokenAIChat` is rendered in the main content column when `address` exists and token `details` are available. The component receives token identity from the page and uses a fixed `timeframe="24h"` prop from the page.

```text
/tokens/:address
`- TokenOverviewPage
   `- TokenAIChat
      |- Suggested questions
      |- Auth gate or question composer
      |- Loading / error / quota notice
      |- Answer header and metadata badges
      |- TLDR
      |- Structured sections
      |- Warnings / data limitations
      |- Key evidence
      |- Sources
      `- Disclaimer footer
```

| Rendered or lifecycle block | File/component/function | Parent or caller | Activation condition | User purpose |
|---|---|---|---|---|
| Token AI Chat mount | `client/src/pages/token-overview/index.tsx` -> `TokenAIChat` | `TokenOverviewPage` | `address && details` | Hosts the Ask Yoca token AI experience. |
| Auth gate | `TokenAIChat` guest branch | `TokenAIChat` root | `!user` | Prompts sign-in before a user can ask custom questions. |
| Suggested questions | `TokenAIChat` chips | `TokenAIChat` root | Always rendered | Gives one-click prompts. |
| Question composer | `TokenAIChat` textarea + Send button | `TokenAIChat` root | `user` exists | Lets signed-in users enter a custom question. |
| AI request lifecycle | `submitQuestion` -> `askTokenAiChat` | `TokenAIChat` event handler | User submits a valid question and is not loading/quota-blocked | Requests a token analysis answer. |
| Loading state | `TokenAIChat` loading banner | `TokenAIChat` root | `isLoading` | Shows generation progress. |
| Answer shell | `TokenAIChat` answer block | `TokenAIChat` root | `answer && !isLoading` | Renders the structured AI result. |
| Sources/evidence expansion toggles | `TokenAIChat` show-all buttons | `TokenAIChat` answer block | Answer contains enough items to exceed the default slice | Lets users reveal more evidence or sources without another request. |

## 4. Token AI inputs

| Input | Source | Destination | Usage | Missing-input behavior | Status |
|---|---|---|---|---|---|
| Token address | `TokenOverviewPage` route param | `TokenAIChat`, `askTokenAiChat` | Sent as AI request context | Chat is not mounted until `address && details` | `FRONTEND_ACTIVE` |
| Token symbol | `details?.symbol ?? undefined` | `TokenAIChat`, `askTokenAiChat` | Sent as AI request context | Optional; request still submits with `undefined` | `FRONTEND_ACTIVE` |
| Token name | `details?.name ?? undefined` | `TokenAIChat`, `askTokenAiChat` | Sent as AI request context | Optional; request still submits with `undefined` | `FRONTEND_ACTIVE` |
| Timeframe | Fixed prop from page | `TokenAIChat`, `askTokenAiChat` | Sent as AI request context and answer context | Fixed to `24h` in current Token Overview usage | `FRONTEND_ACTIVE` |
| User question | Textarea or suggested question | `TokenAIChat`, `askTokenAiChat` | Sent as the question prompt | Empty/overlong submissions are blocked | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| User auth state | `useAuth()` | `TokenAIChat` submit handler | Gates custom question submission | Guests see sign-in gate or auth modal instead of a request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Quota/usage state | `AiUsageMetadata` | `TokenAIChat` composer and quota notice | Gates access when remaining questions reaches zero | Composer disabled and upgrade notice shown when exhausted | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Conversation display state | Local `answer`, `question`, `usage` | `TokenAIChat` render | Controls current question/answer UI | No persisted conversation history | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 5. Canonical Token AI capability ledger

| ID | Capability | User or lifecycle entry point | Main implementation | API/local action | Status | Limitation |
|---|---|---|---|---|---|---|
| `TOKEN-AI-01` | Token AI Chat section rendering and sign-in gate | `/tokens/:address` render after token details exist | `TokenOverviewPage`, `TokenAIChat` | Renders chat shell, suggested questions, and either the composer or auth gate | `FRONTEND_ACTIVE` | None beyond the page-level mount condition. |
| `TOKEN-AI-02` | Token-context handoff | `TokenAIChat` mount | `TokenOverviewPage`, `TokenAIChat` | Passes `address`, `symbol`, `name`, and fixed `timeframe` into the chat flow | `FRONTEND_ACTIVE` | Symbol/name are optional and can be undefined. |
| `TOKEN-AI-03` | Suggested-question display and selection | User clicks a suggested question chip | `TokenAIChat` chips and `submitQuestion` | Fills the composer and attempts submission | `FRONTEND_ACTIVE` | Chips can still open the auth modal for guests rather than sending a request. |
| `TOKEN-AI-04` | Manual question entry and validation | User types into the composer | `TokenAIChat` textarea and validation state | Tracks the question text and validates length | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Validation is local-only and limited to empty/500-character checks. |
| `TOKEN-AI-05` | Question submission and access gating | User presses Send or Enter | `submitQuestion` | Blocks empty, overlong, loading, and quota-exhausted submits; opens auth modal for guests | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No duplicate-question guard or dedicated resend button was confirmed. |
| `TOKEN-AI-06` | AI request lifecycle | Question submission succeeds past local checks | `askTokenAiChat` | Sends the token AI request and stores the answer/usage on success | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No request cancellation or stale-response protection was confirmed. |
| `TOKEN-AI-07` | Loading and generation state | Request is in flight | `isLoading` render branch | Shows "Analyzing token evidence..." and disables the composer | `FRONTEND_ACTIVE` | Existing answer is hidden during loading rather than shown as a live thread. |
| `TOKEN-AI-08` | Single-answer conversation state and token reset behavior | Successful answer or token change | `question`, `answer`, `usage`, `showAllEvidence`, `showAllSources` | Stores the current answer only, not a message list | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No conversation history, persistence, or route-token reset effect was confirmed. |
| `TOKEN-AI-09` | Structured answer shell | Request resolves successfully | `TokenAIChat` answer block | Renders answer header, mode badges, confidence, TLDR, sections, and footer | `FRONTEND_ACTIVE` | Answer shell is replaced by loading state while a new request is active. |
| `TOKEN-AI-10` | Rich-text and warning cleanup | Answer content and warnings render | `TokenAiRichText`, warning helpers | Parses bold markers, bullets, and metric/signaling tokens; filters weak/deduped warnings | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Rich-text support is partial and does not sanitize HTML. |
| `TOKEN-AI-11` | Evidence rendering and show-more behavior | Answer contains evidence | `SectionTable`, evidence card grid | Renders evidence cards and toggles between top six and all evidence | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Evidence data is sliced locally and can remain stale until a new answer arrives. |
| `TOKEN-AI-12` | Source rendering and show-more behavior | Answer contains sources | Sources list and source-domain helper | Renders source cards and toggles between top five and all sources | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Source links are not URL-validated and open externally. |
| `TOKEN-AI-13` | Provider/cache/confidence/fallback metadata | Answer resolves | Metadata helpers and badges | Renders provider, model mode, cache status, stale badge, confidence badge, fallback reason, usage, and disclaimer | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Many metadata values are display-only and do not alter request flow. |
| `TOKEN-AI-14` | Error handling and retry/resubmission | Request fails | `TokenAiChatError` handling and UI error banner | Renders status/message feedback and can reopen sign-in on 401 | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | No dedicated retry button or status-specific UI for most failures. |
| `TOKEN-AI-15` | External/internal navigation and pricing upsell | User follows a token/source/evidence/pricing link | React Router `Link` and external anchors | Opens the token link, article links, or pricing/upgrade routes | `FRONTEND_ACTIVE_WITH_LIMITATIONS` | Some links are raw URLs without explicit validation. |

### Capability count validation

| Capability status | Count |
|---|---:|
| `FRONTEND_ACTIVE` | 5 |
| `FRONTEND_ACTIVE_WITH_LIMITATIONS` | 10 |
| `FRONTEND_BROKEN` | 0 |
| `FRONTEND_UNUSED` | 0 |
| `UNCERTAIN` | 0 |
| **Total canonical Token AI capabilities** | 15 |

Validation: `5 + 10 + 0 + 0 + 0 = 15`, matching the 15 rows in the canonical Token AI capability ledger.

### Excluded implementation validation

| Excluded category | Count |
|---|---:|
| Unused Token AI code artifacts | 6 |
| Out-of-scope components encountered | 5 |
| Deferred general-AI boundaries | 0 |

The out-of-scope components encountered are the surrounding Token Overview blocks audited in earlier phases: `TokenHeader`, `TokenOverviewStats`, `TokenOverviewChart`, `TokenInsightTabs`, and `NewsTab`.

## 6. Token AI frontend API calls

| Capability ID | Trigger | Frontend caller | API method or URL | Request input | Response usage | Error handling | Refresh/cache behavior | Status |
|---|---|---|---|---|---|---|---|---|
| `TOKEN-AI-06` | User submits a question | `submitQuestion` -> `askTokenAiChat` | `client.api["token-ai-chat"].$post` | JSON `{ address, symbol, name, question, timeframe, includeNews: true, includeVolatility: true }` | Stores `data` into `answer` and `usage` into `usage` | Non-OK response throws `TokenAiChatError`; 401 can reopen sign-in modal; 429 can carry usage metadata | No cache layer in the frontend; latest answer replaces the previous answer | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| `TOKEN-AI-14` | Request fails | Same request path | Same endpoint | Same as above | Error banner displays message; 401 can open auth modal | Generic error text for most statuses; 429 may surface quota metadata | No automatic retry or resend request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

Request behavior summary:

- Initial trigger: only after the user submits a valid question.
- Address dependency: yes, sent every time.
- Token name or symbol dependency: yes, sent when available.
- Timeframe dependency: yes, currently fixed to `24h` by the page.
- User auth dependency: yes, guests are gated before submission.
- Subscription/quota dependency: yes, `usage.remaining === 0` blocks submission unless `usage.disabled` is true.
- Manual refresh/resend: no dedicated button exists; the user can resubmit manually.
- Polling: none found.
- Request cancellation: none found.
- Stale-response handling: none found.
- Deduplication: none found.
- Behavior when token address changes: no auto-reset was confirmed.

## 7. Structured response rendering

| Used response field | Component/function | Response field | Frontend usage | Missing-value behavior | Status |
|---|---|---|---|---|---|
| Token label | `getTokenLabel` | `answer.token.address`, `symbol`, `name` | Renders the token label in the answer title and optional link | Falls back from `name (SYMBOL)` to name, symbol, then address | `FRONTEND_ACTIVE` |
| Token link | Answer header | `answer.token.yocaUrl` | Renders a `Link` to the token-specific Yoca route when present | Missing link renders plain text label | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Intent | Answer eyebrow | `answer.intent` | Renders the answer category text | Underscore characters are replaced with spaces | `FRONTEND_ACTIVE` |
| TLDR list | TLDR block | `answer.tldr[]` | Renders numbered summary points | Empty array renders no TLDR items | `FRONTEND_ACTIVE` |
| Sections | Answer sections | `answer.sections[]` | Renders structured sections by kind | Empty array renders no sections | `FRONTEND_ACTIVE` |
| Section title | `AnswerSection` | `section.title` | Renders section heading through rich-text helper | No explicit fallback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Section content | `AnswerSection` | `section.content` | Renders paragraph or bullet-rich text | Missing content omits the block | `FRONTEND_ACTIVE` |
| Section bullets | `AnswerSection` | `section.bullets[]` | Renders bullet list | Missing bullets omit the list | `FRONTEND_ACTIVE` |
| Section table | `SectionTable` | `section.table[]` | Renders a table with up to six columns from row keys | Empty table renders nothing | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Warnings | Warnings block | `answer.warnings[]` | Shows filtered warnings or data limitations | Weak/unavailable warnings are hidden; only the first three visible warnings are shown | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Evidence | Evidence cards | `answer.evidence[]` | Renders key evidence cards with type badge, label, value, detail, source, and timestamp | Visible set is capped to six until expanded | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Sources | Source cards | `answer.sources[]` | Renders clickable source cards with title, snippet, publisher/domain, and date | Visible set is capped to five until expanded | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Confidence | Confidence badge | `answer.confidence` | Shows confidence label and color treatment | Badge color is Low/Medium/High only | `FRONTEND_ACTIVE` |
| As-of timestamp | Answer status text | `answer.asOf` | Renders a localized timestamp context line | Invalid date becomes empty string | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Provider | Answer mode/footer | `answer.provider` | Renders provider label in the mode row and footer | Falls back to a generic label when not mapped | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Model mode | Answer mode row | `answer.modelModeUsed ?? answer.modelModeRequested` | Renders the used/requested model mode | Falls back to "Deep Analysis" if absent | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Model name | Answer mode row | `answer.modelUsed` | Renders the model name when present | Missing model name omits that badge | `FRONTEND_ACTIVE` |
| Cache | Answer mode/footer | `answer.cache.hit` | Renders cache hit/miss state | Missing cache renders "Cache unknown" in the mode row | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Fallback reason | Footer meta | `answer.fallbackReason` | Renders fallback reason with underscores replaced by spaces | Missing reason omits the footer detail | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Stale flag | Answer mode row | `answer.stale` | Shows a `Stale` badge when true | Missing flag omits the badge | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Disclaimer | Footer disclaimer | `answer.disclaimer` | Renders the model disclaimer | Empty disclaimer renders nothing useful | `FRONTEND_ACTIVE` |

Unused response fields in the active rendering path include `answer.question`, `answer.generatedAt`, `answer.modelRequested`, `answer.cache.expiresAt`, and `source.sourceType`.

## 8. Question entry and submission

| Entry or submit concern | Current behavior | Implementation | Limitation | Status |
|---|---|---|---|---|
| Suggested question selection | Clicking a chip copies that prompt into submission logic | `SUGGESTED_QUESTIONS` and `submitQuestion(suggestion)` | Guests can still click a chip and get the auth modal instead of a request | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Manual typing | Composer textarea accepts custom prompt text | Controlled `question` state | Input is limited to 500 characters and supports multiline text | `FRONTEND_ACTIVE` |
| Empty submission | Submission is blocked when the trimmed question is empty | `validationError` and `submitQuestion` guard | No request is made; send button is disabled | `FRONTEND_ACTIVE` |
| Overlong submission | Submission is blocked above 500 characters | `validationError` and `maxLength={500}` | No request is made; textarea is visually marked invalid | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Enter-to-send | Enter submits, Shift+Enter adds a newline | `onKeyDown` | Sends immediately from the textarea without a separate form element | `FRONTEND_ACTIVE` |
| Duplicate submission | No explicit dedupe is implemented | `submitQuestion` | The same question can be resubmitted if quota/loading checks pass | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Loading lockout | Submissions are blocked while a request is in flight | `isLoading` | Send button and chips disable during loading | `FRONTEND_ACTIVE` |
| Quota lockout | Submissions are blocked when quota is exhausted | `quotaExhausted` | Send button and chips disable while the quota notice is shown | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Guest prompt | Non-signed-in users see the auth gate and no composer | `user ? ... : ...` | The question composer is hidden until sign-in | `FRONTEND_ACTIVE` |
| Auth modal entry | Guest submit path opens sign-in modal | `openAuthModal("login")` | Submission is not queued; auth is the next step | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 9. Conversation and state management

| State concern | File/hook | Initial value | Updated by | UI/request effect | Persistence |
|---|---|---|---|---|---|
| Current question | `TokenAIChat.question` | `""` | Typing, chip click, successful submit trims and stores it | Powers validation and request payload | Component state |
| Current answer | `TokenAIChat.answer` | `null` | Successful `askTokenAiChat` response | Renders the structured answer block | Component state |
| Usage metadata | `TokenAIChat.usage` | `null` | Successful answer or `TokenAiChatError.usage` on failure | Drives quota text and quota gating | Component state |
| Loading state | `TokenAIChat.isLoading` | `false` | Request start/end | Shows "Analyzing token evidence..." and hides the answer block while loading | Component state |
| Error state | `TokenAIChat.error` | `null` | Request failure/start | Shows inline error banner | Component state |
| Evidence toggle | `showAllEvidence` | `false` | Evidence expand/collapse button, reset on success | Controls how many evidence cards are visible | Component state |
| Sources toggle | `showAllSources` | `false` | Sources expand/collapse button, reset on success | Controls how many sources are visible | Component state |
| Token address | Route param | URL path | Router | Changes should rerender the page, but the chat has no reset effect tied to it | URL path |

Conversation behavior:

- The frontend stores a single latest answer, not a message array.
- New successful submissions replace the previous answer.
- While a new request is loading, the answer block is hidden.
- If a request fails, the previous answer can reappear below the error banner because it is not cleared at submit time.
- No explicit chat reset was confirmed when the token address changes.

## 10. Loading, generation, and quota states

| State or action | Loading UI | Empty UI | Error UI | Partial-data behavior | Retry/fallback | Status |
|---|---|---|---|---|---|---|
| Initial chat load | No dedicated loading screen before a question is asked | Suggested questions are still visible | None | Guest auth gate or composer renders immediately | N/A | `FRONTEND_ACTIVE` |
| Question generation | "Analyzing token evidence..." banner | N/A | Existing error remains cleared until failure | The answer block is hidden while loading | No dedicated cancel/retry button | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Successful answer with partial fields | Answer shell renders available pieces only | Missing sections/sources/evidence simply omit those blocks | None | Response fields are rendered opportunistically | N/A | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Quota exhausted | Composer and chips disabled, quota notice shown | N/A | No error banner unless request also fails | Existing answer may remain visible | User can navigate to pricing | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Guest user | Sign-in gate shown instead of composer | Suggested questions remain visible | None | Clicking a chip opens sign-in modal | Sign-in modal or pricing link | `FRONTEND_ACTIVE` |
| 401 response | Generic error banner plus auth modal | N/A | Auth modal can open through catch handler | Existing answer can remain visible after failure | User can sign in and resubmit | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| 429 response | Generic error banner and quota metadata if supplied | N/A | May show quota notice on the next render | Usage state can be populated from the error response | User can upgrade via pricing | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| 500/503/network failure | Generic error banner | N/A | No status-specific UI beyond message text | Previous answer may remain visible after the error | Manual resubmit is the only retry path | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Empty question or overlong question | Validation text and disabled Send button | N/A | Local validation only | No request is issued | User edits the input | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 11. Rich text and cleanup

| Text concern | File/function | Current cleanup | Unhandled case | Status |
|---|---|---|---|---|
| Bold markup | `splitBoldSegments` | Parses `**bold**` into strong text | Unmatched markdown remains as plain text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Metric/signal highlighting | `renderMetricTokens`, `getMetricClass` | Wraps percent, money, volume, bullish/bearish/warning phrases in spans | Unrecognized tokens remain plain text | `FRONTEND_ACTIVE` |
| Bullet cleanup | `cleanBulletLine`, `isBulletLikeLine` | Removes leading bullet/number markers and renders bullet lists | Non-bullet markdown is not fully parsed | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Paragraph cleanup | `TokenAiRichText` | Splits on blank lines and trims whitespace | Excess internal whitespace is not normalized globally | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Warning cleanup | `normalizeVisibleWarnings`, `warningKey` | Trims, dedupes, filters weak "unavailable" warnings, and caps visible warnings at 3 | Some malformed warnings still render as plain text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source domain cleanup | `getSourceDomain` | Uses `new URL(...).hostname` and strips `www.` | Invalid URLs fall back to empty domain text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| HTML injection | `TokenAiRichText` and render tree | No `dangerouslySetInnerHTML`, HTML parser, or Markdown parser was found | HTML-like fragments are escaped by React and may still display as raw text | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 12. Structured answer rendering details

| Rendered block | Component | Data source | Missing-value behavior | Status |
|---|---|---|---|---|
| Answer title and token link | Answer header | `answer.token` and `answer.token.yocaUrl` | Falls back to plain text when the link is absent | `FRONTEND_ACTIVE` |
| Mode row | Answer header | `modelMode`, `provider`, `modelUsed`, `stale`, `cache` | Missing values remove the corresponding badge | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Confidence badge | Answer status | `confidence` | Always shown when answer exists | `FRONTEND_ACTIVE` |
| TLDR list | TLDR block | `tldr[]` | Empty list omits the block items | `FRONTEND_ACTIVE` |
| Section cards | `AnswerSection` | `sections[]` | Empty list omits section cards | `FRONTEND_ACTIVE` |
| Section icons and labels | `SECTION_KIND_META` | `section.kind` | Unknown kinds fall back to the custom analysis label/icon | `FRONTEND_ACTIVE` |
| Section tables | `SectionTable` | `section.table[]` | Rows with no columns render nothing; table shows at most six columns | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Warnings/data limitations | Warnings block | `warnings[]` | If warnings are all weak/unavailable, the block may not render | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Evidence cards | Evidence block | `evidence[]` | Missing evidence omits the block | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Sources cards | Sources block | `sources[]` | Missing sources omits the block | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Disclaimer | Footer disclaimer | `disclaimer` | Missing disclaimer omits the block | `FRONTEND_ACTIVE` |

## 13. Errors and retry

| Error class or status | Current behavior | Implementation/API | User feedback | Limitation | Status |
|---|---|---|---|---|---|
| 401 | Catch handler opens login modal | `TokenAiChatError` branch in `submitQuestion` | Error banner plus auth modal | No automatic retry | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| 403 | Generic error banner | `TokenAiChatError` or generic catch | Error message only | No status-specific UI | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| 429 | If structured, usage metadata is parsed and shown | `askTokenAiChat` and `TokenAiChatError.usage` | Error banner and quota notice / pricing link | No dedicated retry or resend control | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| 500 | Generic error banner | `submitQuestion` catch | Error message only | No server-specific feedback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| 503 | Generic error banner | `submitQuestion` catch | Error message only | No server-specific feedback | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Timeout/network failure | Generic error banner from thrown message or fallback text | `submitQuestion` catch | Error message only | No retry UI and no timeout-specific UI | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Resubmit after failure | Same send button or suggestion chip can be used again | `submitQuestion` | New request can be issued manually | There is no dedicated retry button | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 14. Access gating and pricing

| Access concern | Current behavior | Dependency | User-visible effect | Status |
|---|---|---|---|---|
| Mount access | The chat section mounts with the Token Overview page once token details exist | Route data only | Chat panel is visible on the page | `FRONTEND_ACTIVE` |
| Guest access | Guests cannot send questions | `useAuth().user` | Sign-in gate replaces the composer; suggested chips still visible | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Subscription/quota access | Quota state can disable the composer and chips when remaining questions reach zero | `AiUsageMetadata` from response or error | Quota notice appears, and upgrade path links to pricing | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Upgrade path | Pricing link in guest gate and quota notice | React Router `Link` to `/pricing` | Users can move to pricing without leaving the page manually | `FRONTEND_ACTIVE` |
| Usage text | Remaining / limit / tier display | `usage` metadata | Shows "questions remaining today" and tier | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

## 15. Navigation and external links

| Source UI | Required data | Destination | Internal/external | Validation | Status |
|---|---|---|---|---|---|
| Token title link | `answer.token.yocaUrl` | Yoca token route | Internal | Rendered through React Router `Link`; no extra validation | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Evidence link | `item.url` | Evidence source URL | External new tab | Raw `href` with `target="_blank"` and `rel="noreferrer"` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Source link | `source.url` | Source URL | External new tab | Raw `href` with `target="_blank"` and `rel="noreferrer"` | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |
| Pricing/upgrade link | Static `/pricing` link or usage error upgrade path | Pricing page or upgrade path | Internal or possibly external depending returned path | Pricing link is internal; returned upgrade path is not validated | `FRONTEND_ACTIVE_WITH_LIMITATIONS` |

No navigation to other token pages, article expansion routes, or message threads was confirmed from the active chat UI.

## 16. Responsive behavior

Token AI Chat responsive behavior is CSS-driven. No separate mobile request path or mobile-only data model was found.

| AI chat block | Desktop behavior | Mobile/narrow behavior | Same data flow | Confirmed limitation |
|---|---|---|---|---|
| Panel shell | Full-width panel with padded card layout | Padding tightens at narrow widths | Yes | No separate mobile shell is rendered. |
| Header | Title and description sit side by side with the rest of the panel | Header stacks vertically at `max-width: 768px` | Yes | No mobile-specific header actions. |
| Suggested questions | Wrapped chips | Same chips wrap and fill available width | Yes | Long lists can require wrapping; no horizontal scroller. |
| Composer | Two-column textarea/send layout | Stacks into one column on narrow screens | Yes | No fixed submit bar. |
| Auth gate | Text and actions sit in one row | Stacks vertically on small screens | Yes | No dedicated mobile sign-in flow. |
| Answer header | Mode badges and confidence are inline on desktop | Header stacks and status aligns left on mobile | Yes | No compact mobile summary rail. |
| Sections/evidence/sources | Two-column grids for evidence and sections | Collapse to one column below 1200px and 768px | Yes | No separate card-only mobile render tree. |
| Table rendering | Tables can overflow horizontally through the wrapper | Same behavior on mobile | Yes | Large tables do not collapse into cards. |

## 17. Unused or disconnected Token AI code

| Candidate | Type | File/component/function | Active caller found | Reason excluded | Classification |
|---|---|---|---|---|---|
| `language` request field | Payload field | `client/src/services/tokenAiChat.ts` `TokenAiChatPayload.language` | No active caller passes it | Active chat request does not send language | `FRONTEND_UNUSED` |
| `modelMode` request field | Payload field | `TokenAiChatPayload.modelMode` | No active caller passes it | Active chat request does not request a specific mode | `FRONTEND_UNUSED` |
| `generatedAt` response field | Response field | `TokenAiChatData.generatedAt` | No active render use | The UI never displays generated-at time | `FRONTEND_UNUSED` |
| `modelRequested` response field | Response field | `TokenAiChatData.modelRequested` | No active render use | The UI never displays requested model name | `FRONTEND_UNUSED` |
| `cache.expiresAt` response field | Response field | `TokenAiChatData.cache.expiresAt` | No active render use | The UI shows only cache hit/miss | `FRONTEND_UNUSED` |
| `sourceType` on sources | Response field | `TokenAiSource.sourceType` | No active render use | Source cards render title, publisher/domain, snippet, and date only | `FRONTEND_UNUSED` |

Unused Token AI code artifact count: 6.

## 18. Frontend-only Token AI flows

### Flow A - Open Token AI Chat

1. User opens `/tokens/:address`.
2. `TokenOverviewPage` renders `TokenAIChat` after token details exist.
3. The chat shows suggested questions immediately.
4. If the user is signed out, the auth gate replaces the composer.
5. If the user is signed in, the composer and quota text render instead.

### Flow B - Ask a question

1. User clicks a suggested question or types a custom question.
2. `TokenAIChat` trims and validates the prompt.
3. Empty or overlong prompts are blocked locally.
4. Guests are sent to the sign-in modal.
5. Signed-in users trigger `askTokenAiChat` with token context and the question.
6. While the request is pending, the loading banner appears and the answer block is hidden.
7. On success, the answer and usage replace the previous result.

### Flow C - Handle the latest answer

1. The latest successful response is stored as `answer`.
2. The UI renders one answer at a time, not a threaded conversation.
3. `showAllEvidence` and `showAllSources` control how much of the answer is visible.
4. A new successful answer replaces the old answer.
5. No persisted conversation history is kept.

### Flow D - Handle access limits or errors

1. If the response is 401, the auth modal can open.
2. If the response is 429, usage metadata can populate and quota text can render.
3. Other failures render the generic error banner.
4. The user can resubmit manually from the same composer or a suggestion chip.

### Flow E - Open sources or token links

1. User clicks the token label link, a source card, or an evidence link.
2. Token link uses the in-app React Router `Link` when present.
3. Source and evidence links open in a new tab.
4. No URL validation is applied before rendering the external anchors.

### Flow F - Change token address

1. Route token changes.
2. The page rerenders `TokenAIChat` with new props.
3. No explicit state reset effect clears the prior question/answer/usage.
4. Previous answer state can remain visible until a new request or user action replaces it.

## 19. Architecture-ready Token AI summary

### Confirmed Token AI frontend blocks

| Proposed frontend block | Capability IDs | Components included | Responsibility | Architecture relevance |
|---|---|---|---|---|
| Token AI Chat shell | `TOKEN-AI-01`, `TOKEN-AI-02` | `TokenOverviewPage`, `TokenAIChat` | Mounts the chat experience and hands token context into it | Core Token AI page node. |
| Prompt entry and access gating | `TOKEN-AI-03`, `TOKEN-AI-04`, `TOKEN-AI-05`, `TOKEN-AI-14` | Suggested chips, textarea, Send button, auth gate | Lets the user submit a question with local validation and access controls | Frontend input/control block. |
| AI request and loading layer | `TOKEN-AI-06`, `TOKEN-AI-07` | `askTokenAiChat`, loading banner | Issues one chat request per submit and shows generation state | Frontend-to-backend boundary and loading layer. |
| Answer state and metadata | `TOKEN-AI-08`, `TOKEN-AI-09`, `TOKEN-AI-13` | Answer shell, metadata badges, quota text | Renders the current AI answer and visible metadata | Core result presentation block. |
| Structured answer detail blocks | `TOKEN-AI-10`, `TOKEN-AI-11`, `TOKEN-AI-12` | Rich-text renderer, evidence cards, source cards | Renders TLDR, sections, warnings, evidence, and sources | Detail rendering block. |
| Navigation and upsell | `TOKEN-AI-15` | Token link, source/evidence anchors, pricing links | Moves users to token, article, or pricing destinations | External navigation block. |

### Token AI frontend-to-backend boundaries

| Frontend block | API category | Communication | Request purpose | Trigger | Evidence |
|---|---|---|---|---|---|
| Token AI request layer | Token AI chat | Hono RPC `client.api["token-ai-chat"].$post` | Request an AI answer for the current token and question | User submits a valid question | `client/src/components/token/TokenAIChat.tsx`, `client/src/services/tokenAiChat.ts` |

No other active Token AI frontend-to-backend boundary was confirmed in the `/tokens/:address` flow.

### Token AI navigation boundaries

| Source block | Destination | Entity | Trigger |
|---|---|---|---|
| Token label link | `answer.token.yocaUrl` | Token route | User clicks the token label in the answer header. |
| Source card | External article URL | Source article | User clicks a source card. |
| Evidence link | External evidence URL | Evidence source | User clicks an evidence label that has a URL. |
| Upgrade / pricing link | `/pricing` or upgrade path | Pricing page | User clicks the pricing/upgrade CTA or quota notice link. |

### Capabilities eligible for backend verification

Only canonical IDs that issue requests, depend on backend-returned answer data, depend on response shape, or need failure-mode verification are listed:

1. `TOKEN-AI-02` Token-context handoff
2. `TOKEN-AI-05` Question submission and access gating
3. `TOKEN-AI-06` AI request lifecycle
4. `TOKEN-AI-08` Single-answer conversation state and token reset behavior
5. `TOKEN-AI-09` Structured answer shell
6. `TOKEN-AI-10` Rich-text and warning cleanup
7. `TOKEN-AI-11` Evidence rendering and show-more behavior
8. `TOKEN-AI-12` Source rendering and show-more behavior
9. `TOKEN-AI-13` Provider/cache/confidence/fallback metadata
10. `TOKEN-AI-14` Error handling and retry/resubmission
11. `TOKEN-AI-15` External/internal navigation and pricing upsell

## 20. Open questions

| Question | Why unresolved in frontend-only audit | Suggested verification phase |
|---|---|---|
| Should the chat reset when the route token changes? | No explicit reset effect was confirmed | Token AI Chat UX hardening |
| Should a conversation history be retained instead of only the latest answer? | The component stores a single answer object, not a message thread | Product review |
| Should duplicate submissions be prevented? | No dedupe beyond loading/quota guards was confirmed | Token AI Chat input hardening |
| Should the frontend expose a dedicated resend/retry button? | Users can resubmit manually, but there is no explicit retry control | Token AI Chat UX hardening |
| Should 403, 500, 503, timeout, and network failures each have distinct user-facing copy? | Current UI mostly shows a generic error banner | Token AI Chat error-handling review |
| Should the answer shell remain visible during loading rather than being hidden? | The answer block is hidden while the request is in flight | Token AI Chat UX review |
| Should source and evidence URLs be validated or protocol-restricted before rendering? | The UI renders raw `href` values | Token AI Chat security/robustness review |
| Should rich-text cleanup handle more than bold markers, bullets, and metric tokens? | HTML-like fragments are escaped by React, but other malformed content is not normalized | Token AI Chat content-quality review |
| Should `usage.resetsAt` be shown instead of the fixed "midnight UTC" copy? | The response includes reset metadata, but the UI does not render it | Token AI Chat quota UX review |
| Should `generatedAt` or `modelRequested` be displayed? | Those response fields exist but are not rendered | Token AI Chat product review |

## 21. Files inspected

- `docs/architecture/audit/01_REPOSITORY_RUNTIME_MAP.md`
- `docs/architecture/audit/02A_FRONTEND_ROUTE_REACHABILITY.md`
- `docs/architecture/audit/02B1_SHARED_SHELL_SEARCH_AUTH.md`
- `docs/architecture/audit/02B2A_MARKET_FRONTEND.md`
- `docs/architecture/audit/02B2B1_TOKEN_OVERVIEW_CORE_FRONTEND.md`
- `docs/architecture/audit/02B2B2A_TOKEN_NEWS_FRONTEND.md`
- `docs/architecture/audit/02B2B2B_TOKEN_CHART_NEWS_MARKERS_FRONTEND.md`
- `client/src/App.tsx`
- `client/src/pages/token-overview/index.tsx`
- `client/src/components/token/TokenAIChat.tsx`
- `client/src/components/token/TokenAIChat.module.scss`
- `client/src/components/token/index.ts`
- `client/src/services/tokenAiChat.ts`
- `client/src/contexts/AuthContext.tsx`
