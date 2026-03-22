# Backend Memory OOM Investigation

Date: 2026-03-20

## Incident Context
Observed runtime error:

- `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`
- Last GC logs indicate repeated Scavenge/Mark-Compact near ~2 GB heap.

This pattern is typically caused by high allocation pressure from large in-memory object graphs, not necessarily a classic long-lived memory leak.

## Scope and Method
Static code-path audit of backend (`server/src`) with focus on:

- Unbounded in-memory collections (arrays/maps/sets)
- Full-table/full-history reads then in-memory filtering
- Fan-out parallel work (`Promise.all`) on heavy endpoints
- Per-request transformations that duplicate large datasets
- Long-lived runtime structures and timers/listeners

## Executive Summary
Most likely root cause is **heap exhaustion from large transient allocations** in wallet retrieval and chart aggregation paths.

The strongest contributors are:

1. Loading full wallet datasets from DB into memory before filtering/pagination.
2. Building full mapped arrays and only then slicing per page.
3. Full-history fetch + merge pipelines for Helius transactions.
4. Multi-wallet chart fan-out with wide periods (including `All`) and parallel heavy computations.
5. High SQL log write volume adding extra pressure under load.

I did **not** find evidence of classic timer/listener leaks in startup flow.

## Findings (Ranked)

### 1) Critical - Full dataset materialization in retrievers
**Evidence**

- `server/src/services/wallet/db/walletDataRetriever.ts:217`
- `server/src/services/wallet/db/walletDataRetriever.ts:260`
- `server/src/services/wallet/db/walletDataRetriever.ts:262`
- `server/src/services/wallet/db/walletDataRetriever.ts:277`
- `server/src/services/wallet/db/walletDataRetriever.ts:278`
- `server/src/services/wallet/db/walletDataRetriever.ts:298`
- `server/src/services/wallet/db/walletDataRetriever.ts:310`
- `server/src/services/wallet/db/walletDataRetriever.ts:312`
- `server/src/services/wallet/db/walletDataRetriever.ts:323`
- `server/src/services/wallet/db/walletDataRetriever.ts:345`
- `server/src/services/wallet/db/walletDataRetriever.ts:357`
- `server/src/services/wallet/db/walletDataRetriever.ts:359`
- `server/src/services/wallet/db/walletDataRetriever.ts:370`

**Why this is dangerous**

Queries load complete row sets for wallet history tables (including JSON-heavy fields), then apply range filtering in JS (`.filter(...)`). For active wallets this can allocate very large arrays and objects in one request.

---

### 2) Critical - Pagination path still maps all rows before slicing
**Evidence**

- `server/src/services/wallet/db/walletDataRetriever.ts:402`
- `server/src/services/wallet/db/walletDataRetriever.ts:420`
- `server/src/services/wallet/db/walletDataRetriever.ts:432`
- `server/src/services/wallet/db/walletDataRetriever.ts:466`
- `server/src/services/wallet/db/walletDataRetriever.ts:482`
- `server/src/services/wallet/db/walletDataRetriever.ts:500`
- `server/src/services/wallet/db/walletDataRetriever.ts:508`
- `server/src/services/wallet/db/walletDataRetriever.ts:547`

**Why this is dangerous**

Chunk APIs should reduce memory, but current flow builds a full `mapped` array from all rows before selecting page items. This can still OOM for large histories.

---

### 3) Critical - Full-history fetch/merge pipeline creates large temporary graphs
**Evidence**

- `server/src/services/wallet/fetchers/walletDataFetcher.service.ts:1024`
- `server/src/services/wallet/fetchers/walletDataFetcher.service.ts:1042`
- `server/src/services/wallet/fetchers/walletDataFetcher.service.ts:1139`
- `server/src/services/wallet/walletData.service.ts:865`
- `server/src/services/wallet/walletData.service.ts:882`
- `server/src/services/wallet/walletData.service.ts:895`
- `server/src/services/wallet/walletData.service.ts:907`
- `server/src/services/wallet/walletData.service.ts:988`
- `server/src/services/wallet/walletData.service.ts:991`

**Why this is dangerous**

`fetchAllTransactionHistory` accumulates transactions in memory, then merges with cached transactions and builds de-dup sets. This can become huge for active wallets and broad ranges.

---

### 4) High - Heavy fan-out in chart routes with wide periods and parallel calls
**Evidence**

- `server/src/routes/charts/balance.route.ts:22`
- `server/src/routes/charts/balance.route.ts:26`
- `server/src/routes/charts/balance.route.ts:74`
- `server/src/routes/charts/balance.route.ts:108`
- `server/src/routes/charts/balance.route.ts:112`
- `server/src/routes/charts/pnl.route.ts:24`
- `server/src/services/charts/pnlChart.service.ts:63`
- `server/src/services/charts/pnlChart.service.ts:64`
- `server/src/services/wallet/walletData.service.ts:1786`
- `server/src/services/wallet/walletData.service.ts:1798`
- `server/src/services/wallet/walletData.service.ts:1858`
- `server/src/services/wallet/walletData.service.ts:1861`
- `server/src/services/wallet/walletData.service.ts:2058`
- `server/src/services/wallet/walletData.service.ts:2112`
- `server/src/services/wallet/walletData.service.ts:2114`

**Why this is dangerous**

For multi-wallet inputs and long periods, chart services invoke expensive historical computations concurrently. `Promise.all` fan-out multiplies heap use.

---

### 5) High - Aggregation services pull broad datasets then aggregate in JS
**Evidence**

- `server/src/services/charts/dailyTradingVolume.service.ts:98`
- `server/src/services/charts/dailyTradingVolume.service.ts:119`
- `server/src/services/charts/dailyTradingVolume.service.ts:121`
- `server/src/services/charts/totalTradingVolume.service.ts:53`
- `server/src/services/charts/totalTradingVolume.service.ts:82`
- `server/src/services/charts/totalTradingVolume.service.ts:84`
- `server/src/services/wallet/transactionDistribution.service.ts:61`
- `server/src/services/wallet/transactionDistribution.service.ts:76`
- `server/src/services/wallet/transactionDistribution.service.ts:78`
- `server/src/services/wallet/transactionDistribution.service.ts:112`
- `server/src/routes/charts/daily-trading-volume.route.ts:19`
- `server/src/routes/charts/total-trading-volume.route.ts:18`
- `server/src/routes/charts/transactions.route.ts:18`

**Why this is dangerous**

These endpoints allow long windows (`All`) and can run over large row sets. In-memory grouping and token-set construction can become expensive.

---

### 6) Medium - SQL logger writes per-query files without backpressure
**Evidence**

- `server/src/db/index.ts:11`
- `server/src/db/index.ts:13`
- `server/src/db/index.ts:14`
- `server/src/services/storage.ts:7`
- `server/src/services/storage.ts:10`

**Runtime observation**

- Current SQL log file count: **5646** (`src/logs/sql`)

**Why this matters**

High-volume logging can add async I/O backlog and extra memory pressure under load.

---

### 7) Medium - User-provided exchange limit not clamped in one wallet route path
**Evidence**

- `server/src/routes/wallets.route.ts:332`
- `server/src/routes/wallets.route.ts:335`
- `server/src/services/wallet/walletData.service.ts:1409`
- `server/src/services/wallet/walletData.service.ts:1417`
- `server/src/services/wallet/walletData.service.ts:1424`
- `server/src/services/wallet/walletData.service.ts:1441`
- `server/src/services/wallet/walletData.service.ts:1485`

**Why this matters**

Large caller-provided limits can force larger in-memory swap collections and longer loops.

---

### 8) Low - Unused heavy import in startup
**Evidence**

- `server/src/main.ts:20`

`puppeteer` is imported but unused in startup path; this is not the primary OOM cause but is avoidable overhead.

## Not Supported by Evidence

- No obvious unbounded `setInterval`/listener registration leak was found in startup and common service paths.
- Most `Map`/`Set` usage appears request-scoped; major issue is dataset size and parallelism, not indefinite retention.

## Probable Root Cause Statement
The incident is most consistent with **high transient heap usage** from wallet/chart request paths that materialize too much data at once, especially under wide periods and concurrent calls. GC cannot reclaim fast enough before the next allocation wave, resulting in heap OOM.

## Priority Remediation Plan

### P0 (immediate)

1. Push range filtering and pagination to SQL in wallet retrievers.
2. Ensure chunk endpoints never map full result sets before slicing.
3. Add strict route-level caps for wallets count, tokens count, and `limit`.
4. Disable SQL file logger in production (or add bounded queue + drop policy).

### P1 (short-term)

1. Replace heavy `Promise.all` fan-out with bounded concurrency for multi-wallet chart computation.
2. Restrict or gate `All` period on expensive endpoints.
3. Add defensive max-result guardrails in services (early cutoffs with metadata warnings).

### P2 (hardening)

1. Add memory instrumentation (`process.memoryUsage()`) around high-risk handlers.
2. Add load tests for top endpoints with active-wallet fixtures.
3. Add a CI regression test ensuring retrievers apply SQL-side range constraints.

## Detailed Implementation Plan (Chart Chunking + OOM Mitigation)

This addendum translates the remediation items into a concrete implementation sequence, with a new **swap/transfer-style pagination pattern** for balance and PnL charts.

### Goal

Move heavy chart endpoints from "full-range materialization" to **bounded chunk retrieval**, while preserving chart UX by loading more history only when users interact (pan/zoom/load older).

### Core Pattern to Introduce

Use the same contract shape already used by swap/transfer table endpoints:

- Request accepts `limit` + `cursor`.
- Response includes `pageInfo` (`pageSize`, `hasMore`, `nextCursor`, `source`).
- First request returns only the most recent chunk.
- Older chunks are fetched incrementally using `nextCursor`.

For charts, cursor semantics are time-window based rather than row-id based.

---

### Phase 0 - Safety Guardrails (Immediate)

1. Route-level clamps on expensive chart endpoints:
	- max wallets per request
	- max tokens per request
	- max `limit` / max points-per-chunk
	- reject unsafe `All` requests without chunking params when multi-wallet
2. Disable SQL file logging in production by default.
3. Add temporary memory logs around:
	- `/api/charts/balance`
	- `/api/charts/pnl`
	- heavy wallet history service methods

---

### Phase 1 - Backend Contract for Chunked Charts

#### 1) Route contract updates

Extend chart routes to accept chunk params:

- Balance route (`/api/charts/balance`):
  - `timePeriod`, `wallets`, `tokens`, `timezone`
  - `limit?` (points/chunk)
  - `cursor?` (opaque)
- PnL route (`/api/charts/pnl`):
  - `period`, `wallets`, `aggregation`
  - `limit?` (points/chunk)
  - `cursor?` (opaque)

Response shape (additive, backward-compatible where possible):

- existing series payloads (`series` for balance; `dailyPnL/cumulativePnL` or `wallets` for pnl)
- `pageInfo`:
  - `pageSize`
  - `hasMore`
  - `nextCursor`
  - `source` (`cache` | `provider` | `mixed`)
- `chunkInfo`:
  - `chunkFromSec`
  - `chunkToSec`
  - `requestedFromSec`
  - `requestedToSec`
  - `effectiveAggregation`

#### 2) Cursor format (Signature-Based, Not Time-Based)

**CRITICAL ADJUSTMENT**: Helius History API uses **signature-based pagination** (via `before` parameter), not time-based cursors. Cannot request arbitrary time ranges directly.

Introduce chart cursor encode/decode utility (opaque token):

- payload fields:
  - `v` (version)
  - `endpoint` (`balance` | `pnl`)
  - `requestedFromSec` / `requestedToSec` (original user request bounds)
  - `heliusCursor` (opaque Helius `pagination.nextCursor` for resuming provider fetch)
  - `currentChunkFromSec` / `currentChunkToSec` (time bucket we're building toward)
  - `aggregationHint` (granularity for gap-aware aggregation)
  - `lastProcessedSignature` (last tx signature included in this chunk, for de-dup safety)

Semantics:

- First request: no cursor → fetch newest transactions from Helius, build chunk of recent transactions, return chunk data + `nextCursor` pointing to older Helius results
- Subsequent requests: provide cursor → resume Helius fetch where previous chunk stopped (using `heliusCursor`), continue fetching until target `currentChunkToSec`, build new chunk

- Reject invalid/mismatched endpoint cursors with 400
- Cursor indicates "resume provider fetch at this point AND you've already built chunks up to this time boundary"

#### 3) Service APIs (new chunk variants - adapted for Helius signature pagination)

Add chunked methods alongside existing full methods:

- `getWalletBalanceHistoryChunk(walletAddress, { requestedFromSec, requestedToSec, heliusCursor?, limit, aggregationHint })`
- `getWalletTokenBalanceHistoryChunk(...)`
- `getCumulativePnLChunk(...)`
- multi-wallet wrappers with bounded concurrency (not raw `Promise.all`)

Each method should:

1. Resolve requested full range from period.
2. Determine target chunk window (most recent unprocessed time bucket based on cursor state).
3. **Fetch from Helius using signature-based pagination**:
   - If cursor provided, resume from `heliusCursor`
   - If no cursor, start fresh (Helius returns newest first)
   - Accumulate transactions until:
     a) We have enough data to build a complete time chunk, OR
     b) We've fetched max allowed pages / items for this request
   - Stop Helius pagination early once target `currentChunkToSec` is satisfied (you've fetched back to that timestamp)
   - Capture final `pagination.nextCursor` from Helius for resuming next chunk
4. Build in-memory intermediate chunk from fetched transactions (group by time window).
5. Apply gap-aware aggregation to compress older chunks.
6. Return chunk points + `pageInfo` + `chunkInfo` + encoded cursor (including captured Helius `nextCursor`).

**Key difference from initial plan**: We don't filter by time at the provider layer (Helius doesn't support it). Instead, we fetch sequentially via signatures and build time chunks offline. This is more transient-memory-efficient but requires careful pagination state management.

---

### Phase 2 - Gap-Aware Aggregation Strategy

To keep old-history requests cheap, use **time-gap-aware aggregation** between chunk bounds.

Definition:

- `gapSec = chunkToSec - chunkFromSec`

Behavior:

1. Compute a base interval from user selection (`daily/weekly/monthly` for pnl, default cadence for balance).
2. Increase interval as `gapSec` grows to cap points and memory:
	- short gap: finer granularity
	- large gap: coarser granularity
3. Enforce `maxPointsPerChunk` guardrail regardless of requested period.
4. Return `effectiveAggregation` in metadata so frontend can display/handle resolution changes.

This addresses the requested "aggregate based on time gap between chunk ends" behavior.

---

### Phase 3 - Remove High-Memory Hotspots in Data Access

**Constraint**: Helius History API uses signature-based pagination (`before` parameter), not time-range filtering. Cannot offload time filtering to provider API. Time-based chunking happens offline after fetching.

1. Refactor retrievers to avoid full-array materialization:
	- push time filters to SQL (`gte`/`lte`) for DB-sourced data
	- apply `limit` in SQL query (not in-memory slice)
	- cursor pagination in SQL predicates where applicable
	- map only selected page rows (not full mapped array then slice)

2. Bound provider fetch loops for Helius:
	- max pages per chunk request (e.g., 5, each returns up to 100 txs)
	- max transactions accumulated per chunk build (not unlimited)
	- early stop when fetched transactions satisfy target `currentChunkToSec` time boundary (i.e., once oldest fetched tx is before target time, can stop)
	- capture and return final `pagination.nextCursor` to encode in response cursor (for resuming next chunk)
	- implement de-dup by signature to prevent re-processing if chunk boundaries overlap

3. Keep merge/de-dup operations chunk-scoped only:
	- only merge with cache txs that overlap this chunk's time range
	- build de-dup set from current chunk + cache overlap (not full history)

#### Signature-Based Pagination Flow (End-to-End)

1. **Client Calls**: `GET /api/charts/balance?wallets=[...], tokens=[...], timePeriod=All, cursor=<encoded_or_null>, limit=200`

2. **Backend Chunk Service Called**:
   - Decode cursor (if provided) to extract: `heliusCursor`, `currentChunkFromSec`, aggregation metadata
   - If first request (no cursor): determine `currentChunkToSec` as "most recent Monday/day depending on aggregation"
   - If subsequent request (has cursor): determine next `currentChunkToSec` going backwards (e.g., previous Monday)

3. **Helius Fetch Loop**:
   - Initialize: `after = null` (or decode `heliusCursor` if resuming)
   - Loop up to max pages (e.g., 5):
     - Call `walletDataFetcher.fetchTxHistoryPage(address, { before: after, limit: 100 })`
     - Accumulate fetched transactions
     - Capture `pagination.nextCursor` as new `after`
     - Check if oldest transaction in batch has `timestamp < currentChunkToSec`: if yes, we can stop early
   - Return: accumulated transactions + final `pagination.nextCursor` for next chunk

4. **Offline Chunk Building**:
   - Group accumulated transactions into time buckets (e.g., `[daily, hourly, or fixed windows]` depending on `currentChunkToSec - currentChunkFromSec`)
   - Merge with cached transactions in overlapping time window
   - De-dup by signature
   - Apply gap-aware aggregation (coarsen resolution if fetching old history)

5. **Response to Client**:
   - `series` (or `dailyPnL/cumulativePnL`) for this chunk only
   - `pageInfo.nextCursor`: encoded token containing:
     - `heliusCursor` (the Helius `pagination.nextCursor` captured above, or `null` if `!hasMore`)
     - `currentChunkToSec`: next older chunk boundary
     - aggregation metadata
   - `pageInfo.hasMore`: true if Helius returned `pagination.hasMore && heliusCursor != null`
   - `chunkInfo`: time bounds, effective aggregation, etc.

---

### Phase 4 - Frontend Interaction-Driven Backfill

Apply the same user-triggered paging model as swap/transfer tables, but for chart interactions.

#### 1) Client API/types

1. Extend chart request params with `cursor` + `limit`.
2. Extend chart response types with `pageInfo` + `chunkInfo`.

#### 2) Chart state model

Per chart instance maintain:

- loaded chunk list / merged series
- `nextCursor`
- `hasMore`
- `isFetchingMore`
- dedupe index by timestamp

#### 3) Trigger fetching on interaction

1. Initial load: fetch only latest chunk.
2. On pan/zoom toward earliest loaded boundary (or explicit "load older" action):
	- if `hasMore && !isFetchingMore`, request next chunk with cursor
	- merge sorted by timestamp, dedupe overlaps
3. Optional prefetch threshold: when viewport nears left edge (for smooth UX).

This satisfies "initiate fetching further data when interacted by user" while avoiding upfront full-range memory pressure.

---

### Phase 5 - Test Plan (Required)

#### Backend tests

1. Cursor encode/decode validation and endpoint mismatch rejection.
2. Chunk boundary correctness (`hasMore`, `nextCursor`, no gaps/duplicates).
3. Gap-aware aggregation step-up under wide ranges.
4. Route validation for clamps (`wallets`, `tokens`, `limit`, `All`).
5. Regression tests proving retrievers no longer map full datasets before slicing.

#### Frontend tests

1. Initial chart call uses no cursor and receives first chunk.
2. Interaction (pan/zoom/load older) triggers one incremental fetch.
3. Merged series remain ordered and deduplicated.
4. No duplicate parallel fetches under rapid interactions.

#### Load tests

1. Multi-wallet + `All` period on balance/pnl with active wallets.
2. Validate bounded heap growth and stable GC behavior.

---

### Rollout Strategy

1. Add feature flag (`CHART_CHUNKING_ENABLED`) for controlled rollout.
2. Deploy with flag off, validate metrics/logs in staging.
3. Enable for wallet page charts first.
4. Expand to dashboard/comparison chart consumers.
5. Remove legacy full-range path after stability window.

---

### Acceptance Criteria

1. Balance and PnL routes no longer compute full history in one request by default.
2. Chart payloads include `pageInfo` and support cursor-driven backfill.
3. Multi-wallet chart requests use bounded concurrency.
4. Retriever/query paths avoid full in-memory mapped arrays for paginated reads.
5. Under soak tests, heap no longer spikes toward OOM on chart-heavy traffic.

## Validation Checklist After Fixes

1. Soak test heavy endpoints (`balance`, `pnl`, wallet transaction/swap/transfer flows) with high-activity wallets.
2. Track heap used before/after requests and after GC cycles.
3. Confirm no monotonic growth across steady-state traffic.
4. Verify 95th/99th percentile latency does not regress due to new DB filters/caps.

## Investigation Notes
A repository-memory note was added documenting a likely regression mismatch:

- `/memories/repo/wallet-retriever-inmemory-filtering-regression-2026-03-20.md`
