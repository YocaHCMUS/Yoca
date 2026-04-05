# API Call Tracker Implementation Plan (Backend)

## Goal
Implement a centralized API call tracker across all current backend outbound API calls so each record captures:
- API key used (masked and fingerprinted)
- Route/service/function responsible
- Full response payload (with safety caps/redaction)
- First caller context (request entrypoint and initiating call site)

Then export tracked records to external files for review after each completed response.

## Current State Summary
The backend currently makes outbound requests through mixed patterns:
- Shared helpers/utilities with API key handling:
  - `server/src/util/util-birdeye.ts`
  - `server/src/util/util-helius.ts`
  - `server/src/util/util-moralis.ts`
  - `server/src/util/util-bitquery.ts`
  - `server/src/util/api-key-manager.ts`
- Shared provider request wrapper:
  - `server/src/services/wallet/providers/providerRequest.ts`
- Direct `fetch` calls inside service files (tokens/wallet/core services and some routes).

This mixed usage means tracker integration must support both centralized wrappers and direct fetch call sites.

## Scope
### In Scope
- All outbound HTTP calls made by backend route handlers/services to third-party providers.
- Providers currently used: Birdeye, Helius, Moralis, Bitquery, plus unknown/custom endpoints.
- Structured export to newline-delimited JSON files (`.jsonl`) for offline review.

### Out of Scope (Phase 1)
- Database persistence of tracker records.
- Real-time dashboard/UI for tracker logs.
- Capturing internal DB queries as API calls.

## Design Overview
### 1) Tracking Data Model
Create a single record shape in `server/src/services/tracking/apiCallTracker.types.ts`:
- `id`: string (uuid or deterministic id)
- `timestampStartMs`: number
- `timestampEndMs`: number
- `durationMs`: number
- `provider`: `birdeye | helius | moralis | bitquery | unknown`
- `request`:
  - `url`: string
  - `method`: string
  - `headers`: sanitized object (no raw secret values)
  - `bodyPreview`: unknown (size-limited)
- `apiKey`:
  - `source`: env/service key source (e.g., `HELIUS_API_KEY`)
  - `masked`: string (e.g., first 4 + last 4)
  - `fingerprint`: string (sha256 truncated)
- `origin`:
  - `route`: string (e.g., `/api/wallets/...`)
  - `serviceFile`: string
  - `functionName`: string
  - `firstCaller`: string (stack frame or explicit marker)
  - `requestId`: string
- `response`:
  - `status`: number
  - `ok`: boolean
  - `headers`: object
  - `data`: unknown (full parsed JSON/text with max-bytes cap)
  - `truncated`: boolean
- `error` (optional):
  - `message`, `name`, `stackPreview`

### 2) Request Context Propagation ("where request first called")
Use Node `AsyncLocalStorage` in middleware to attach request-scoped metadata:
- `requestId`
- inbound route pattern/path
- method
- first service marker (set once)

Implementation points:
- New middleware in `server/src/middlewares/request-context.ts`
- Register in `server/src/main.ts` before routes
- Utility APIs:
  - `getRequestContext()`
  - `setFirstCallerIfUnset(serviceFile, functionName)`

Fallback when no HTTP context exists (cron/background jobs):
- default route `"system/background"`
- explicit first caller from wrapper input.

### 3) Central Tracker Service
Create `server/src/services/tracking/apiCallTracker.service.ts` with:
- `trackApiCall(input, execute)` wrapper that:
  - records start time
  - executes request
  - reads response safely
  - builds tracking record
  - queues export write
  - returns response unchanged to caller
- `trackApiCallError(...)` path for thrown errors
- payload controls:
  - `MAX_RESPONSE_BYTES` (configurable)
  - automatic redaction list for known secret fields
  - optional sampling toggle

### 4) Exporter (External File Output)
Create `server/src/services/tracking/apiCallTracker.exporter.ts`:
- Writes `.jsonl` records into `server/src/logs/api-tracker/` (or runtime-configurable folder)
- Filename convention:
  - `api-tracker-YYYY-MM-DD.jsonl`
- I/O behavior:
  - append-only
  - buffered queue to avoid blocking hot request path
  - periodic flush + process-exit flush
- Optional secondary error file:
  - `api-tracker-errors-YYYY-MM-DD.jsonl`

### 5) API Key Capture Strategy
Avoid logging raw keys. Capture key metadata safely:
- Add helper in `server/src/util/api-key-manager.ts`:
  - returns current selected key metadata for a provider (`masked`, `fingerprint`, `source`)
- For providers not using `apiKeyManager` (e.g., Bitquery currently direct env access), add a small adapter to emit equivalent metadata.

## Integration Plan By Code Area
### Phase A: Foundation
1. Add tracking types, tracker service, exporter service, redaction utilities.
2. Add request context middleware and wire in `server/src/main.ts`.
3. Add config constants in `server/src/config/constants.ts`:
   - tracker enabled flag
   - output directory
   - max response bytes
   - redact field names

### Phase B: Centralized Wrapper Integration
4. Integrate tracker inside `server/src/services/wallet/providers/providerRequest.ts`.
5. Integrate tracker in utility fetch wrappers:
   - `server/src/util/util-helius.ts`
   - `server/src/util/util-moralis.ts`
6. Integrate key metadata in header builders:
   - `server/src/util/util-birdeye.ts`
   - `server/src/util/util-bitquery.ts`

### Phase C: Direct Fetch Migration Coverage
7. Replace direct `fetch` calls with tracked wrapper in high-traffic services first:
   - `server/src/services/wallet/**`
   - `server/src/services/tokens/**`
8. Migrate legacy and top-level services:
   - `server/src/services/balances.ts`
   - `server/src/services/pools.ts`
   - `server/src/services/trades.ts`
   - `server/src/services/transfers.ts`
   - `server/src/services/transfers.deprecated.ts` (if still active)
9. Cover route-level direct outbound calls:
   - `server/src/routes/misc.ts`
   - `server/src/routes/traders.ts`

### Phase D: Hardening and Validation
10. Add tests (unit + integration-lite) for:
   - record creation
   - redaction and truncation
   - exporter append + flush
   - request context linkage and first-caller behavior
11. Load test with tracker enabled to validate overhead and memory profile.
12. Add operational docs and runbook.

## Required Refactor Pattern for Call Sites
For each outbound call, pass explicit tracking metadata:
- provider name
- API key source metadata
- current service file/function marker

Example call-site contract (conceptual):
- `trackedFetch({ provider, keyMeta, serviceFile, functionName, routeHint }, () => fetch(...))`

This keeps business logic unchanged while enforcing consistent audit capture.

## File and Module Additions
Planned new files:
- `server/src/middlewares/request-context.ts`
- `server/src/services/tracking/apiCallTracker.types.ts`
- `server/src/services/tracking/apiCallTracker.service.ts`
- `server/src/services/tracking/apiCallTracker.exporter.ts`
- `server/src/services/tracking/apiCallTracker.redaction.ts`
- `server/tests/services/tracking/apiCallTracker.service.test.ts`
- `server/tests/services/tracking/apiCallTracker.exporter.test.ts`

Planned updated files:
- `server/src/main.ts`
- `server/src/config/constants.ts`
- `server/src/util/api-key-manager.ts`
- `server/src/util/util-birdeye.ts`
- `server/src/util/util-bitquery.ts`
- `server/src/util/util-helius.ts`
- `server/src/util/util-moralis.ts`
- `server/src/services/wallet/providers/providerRequest.ts`
- direct-fetch service and route files listed in Phase C

## Safety, Privacy, and Performance Controls
- Never persist raw API keys; only masked + fingerprinted values.
- Redact sensitive response/request fields (`apiKey`, `authorization`, `token`, `password`, `secret`, `signature`).
- Enforce payload size cap and mark truncated records.
- Use async buffered writer to reduce request latency impact.
- Add feature flag to disable tracker quickly in production.

## Testing Plan
- Unit tests:
  - key masking/fingerprint correctness
  - redaction behavior
  - response truncation
  - exporter append behavior and file rollover by date
- Integration tests (mocked fetch):
  - route -> service -> provider call includes route + first caller
  - error responses still exported with context
- Regression checks:
  - existing API responses unchanged
  - no duplicate outbound calls introduced by wrapper

## Rollout Strategy
1. Deploy with `API_CALL_TRACKER_ENABLED=false` (dark launch code path).
2. Enable in non-prod and verify exported files and redactions.
3. Enable in production for selected providers first (config allowlist).
4. Expand to all providers and direct fetch call sites.

## Acceptance Criteria
- Every outbound API response (success/failure) emits exactly one tracker record.
- Record includes provider, masked key metadata, route/service/function, first caller, and response payload (or truncation marker).
- Export files are created and appended correctly in configured folder.
- No raw credentials appear in exported records.
- Overhead remains within agreed SLO (target: p95 added latency < 10ms for non-large responses).

## Risks and Mitigations
- Risk: large payloads increase memory pressure.
  - Mitigation: byte caps, streaming-safe read strategy, truncation markers.
- Risk: missing origin in non-HTTP jobs.
  - Mitigation: explicit context API + fallback origin.
- Risk: scattered direct fetch calls bypass tracker.
  - Mitigation: CI lint rule/check to forbid untracked `fetch(` in service layer.

## Execution Checklist
- [ ] Build tracker core + exporter + middleware
- [ ] Integrate shared wrappers/utils
- [ ] Migrate direct fetch call sites
- [ ] Add tests + perf validation
- [ ] Add docs/runbook and enable via config flags
