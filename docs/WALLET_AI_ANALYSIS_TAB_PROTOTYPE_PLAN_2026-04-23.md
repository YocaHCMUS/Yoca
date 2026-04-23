# Wallet AI Analysis Tab Prototype Plan (2026-04-23)

## 1) Goal
Ship working prototype AI Analysis tab on wallet page, with webhook fetch handled by backend.

- Input: wallet address from route `/wallets/:address`
- Client request: `POST /api/wallets/ai-analysis`
- Backend webhook request: `POST http://localhost:5678/webhook/analyse-wallet`
- Body to webhook: `{ "address": "<wallet>" }`
- Output: render wallet classification, strategy, behavior metrics, first funder, wallet age, risk, summary

## 2) Current State (Codebase)
Wallet page already contains AI tab UI and lazy-load flow.

- Existing tab + loader state in `client/src/pages/wallet/index.tsx`
- Missing exported API symbols in `client/src/services/wallet/walletApi.ts`:
  - `fetchWalletAiAnalysis`
  - `WalletAiAnalysisResponse`
- Missing localization keys used by AI tab in:
  - `client/src/config/localization/en.ts`
  - `client/src/config/localization/vi.ts`

Result now: TypeScript compile errors on wallet page imports + `tr("walletPage.ai...")` keys.

## 3) API Contract For Prototype
### Client -> Backend Request
- Method: `POST`
- URL: `/api/wallets/ai-analysis`
- JSON body:

```json
{
  "address": "<wallet-address>"
}
```

### Backend -> n8n Webhook Request
- Method: `POST`
- URL: `http://localhost:5678/webhook/analyse-wallet`
- JSON body:

```json
{
  "address": "<wallet-address>"
}
```

### Backend Timeout
- Timeout: `180000 ms` (3 minutes)
- Timeout failure response: clear message indicating AI analysis timed out

### Expected Response Shape
```json
{
  "wallet_address": "<address>",
  "classification": {
    "primary_type": "<type>",
    "confidence_percentage": 80,
    "supporting_signals": ["..."]
  },
  "strategy": {
    "primary_strategy": "<strategy>",
    "secondary_strategies": ["..."],
    "evidence": ["..."]
  },
  "behavior_metrics": {
    "trade_frequency": "...",
    "avg_holding_time": "...",
    "portfolio_concentration": "...",
    "win_loss_estimate": "...",
    "token_distribution": "..."
  },
  "first_funder_analysis": {
    "funder_type": "<type>",
    "risk_signal": "low | medium | high",
    "notes": "..."
  },
  "wallet_age": {
    "age_category": "<category>",
    "first_seen": "<timestamp>",
    "consistency_assessment": "..."
  },
  "risk_assessment": {
    "overall_risk": "low | medium | high",
    "flags": ["..."]
  },
  "summary": "<concise executive summary>"
}
```

### Response Tolerance Rule
n8n payload can appear wrapped in array in some outputs. Prototype parser should accept:
- object response
- array response and pick first object

## 4) Implementation Scope (Prototype)
## 4.1 Backend service layer (new owner of webhook call)
Files (target):
- `server/src/routes/wallets/*` (add AI analysis endpoint)
- `server/src/services/wallet/*` (add orchestration + webhook client)

Add backend endpoint:
- `POST /api/wallets/ai-analysis`
- Input: `{ address: string }`
- Output: normalized `WalletAiAnalysisResponse`

Backend flow:
1. Validate wallet address input.
2. Resolve prerequisite wallet datasets (or verify readiness):
   - wallet identity
   - wallet first fund
   - wallet portfolio
   - wallet swaps
3. Guardrail: if any prerequisite missing/unavailable, do not invoke webhook; return controlled error or not-ready status.
4. Invoke n8n webhook with 3-minute timeout.
5. Normalize object-or-array payload.
6. Return typed response to client.

Debug logging (backend webhook call):
- Log webhook request start with wallet address, request id, endpoint, timeout.
- Log webhook response status + latency on completion.
- Log timeout/error path with request id and normalized error code.
- Redact sensitive fields/tokens from logs.

Guardrail behavior (backend):
- Prevent premature webhook fetch when one of required dependencies unavailable.
- Include structured reason in response (which dependency missing).

## 4.2 Client service layer
File: `client/src/services/wallet/walletApi.ts`

Add:
- `type WalletAiRisk = "low" | "medium" | "high"`
- `interface WalletAiAnalysisResponse` (exact fields above)
- fetcher targeting backend endpoint `/api/wallets/ai-analysis`
- `fetchWalletAiAnalysis(address: string): Promise<WalletAiAnalysisResponse>`

Behavior:
- POST JSON `{ address }` to backend
- parse non-2xx error body with backend dependency status details when available
- throw clear error message for UI retry flow

Config:
- no direct n8n URL in client

## 4.3 Wallet page integration + anti-refetch guardrails
File: `client/src/pages/wallet/index.tsx`

Already present:
- `activeTab === 3` lazy load trigger
- loading/error/empty/success render blocks
- retry button
- risk badge renderer

Prototype adjustments:
- keep lazy-first-load strategy
- add readiness gate before first AI fetch:
  - identity available
  - first fund available
  - portfolio available
  - swaps available
- if gate fails, skip fetch and show dependency-waiting state
- prevent premature refetch on tab/component rerender:
  - cache fetch state by `address`
  - only auto-fetch once per address while tab active
  - ignore rerender-triggered effects unless address changed or manual retry
  - keep in-flight lock so concurrent rerenders cannot start duplicate fetches
- optional: display `wallet_address` under summary for traceability
- optional: add “last updated” timestamp in state

## 4.4 Localization keys
Files:
- `client/src/config/localization/en.ts`
- `client/src/config/localization/vi.ts`

Add missing `walletPage` keys used in AI tab:
- `aiAnalysis`
- `aiAnalysisLoading`
- `aiAnalysisFailed`
- `aiAnalysisRetry`
- `aiNoData`
- `aiSummary`
- `aiClassification`
- `aiPrimaryType`
- `aiConfidence`
- `aiSupportingSignals`
- `aiStrategy`
- `aiPrimaryStrategy`
- `aiSecondaryStrategies`
- `aiEvidence`
- `aiBehaviorMetrics`
- `aiTradeFrequency`
- `aiAvgHoldingTime`
- `aiPortfolioConcentration`
- `aiWinLossEstimate`
- `aiTokenDistribution`
- `aiFirstFunderAnalysis`
- `aiFunderType`
- `aiRiskSignal`
- `aiNotes`
- `aiWalletAge`
- `aiAgeCategory`
- `aiFirstSeen`
- `aiConsistencyAssessment`
- `aiRiskAssessment`
- `aiOverallRisk`
- `aiFlags`

## 5) Testing Plan
## 5.1 Functional checks
1. Open `/wallets/:address`
2. Switch to AI Analysis tab
3. Confirm one POST request sent to backend endpoint (not n8n direct)
4. Confirm backend blocks webhook call when dependency missing
5. Confirm all sections render for success response
6. Confirm retry works after simulated error
7. Confirm empty arrays render as `-`

## 5.2 Guardrail checks
- missing identity => no webhook call
- missing first fund => no webhook call
- missing portfolio => no webhook call
- missing swaps => no webhook call
- response shows clear not-ready reason

## 5.3 Payload variation checks
- object payload
- array-wrapped payload
- missing optional arrays
- unknown risk values (fallback to neutral style/string)

## 5.4 Failure checks
- webhook down
- 4xx/5xx with JSON body
- timeout at 3-minute backend limit

Expected UI:
- localized error title + detailed error text
- retry action enabled

## 5.5 Rerender/refetch checks
- switch to AI tab once => one fetch
- rerender tab/component without address change => zero additional fetches
- tab switch away/back without force refresh => zero additional fetches
- manual retry => exactly one new fetch

## 5.6 Build checks
Run client type-check/build and verify zero errors for:
- missing wallet API exports
- missing translation key types
- server build/type-check passes for new endpoint/service

## 6) Risks + Mitigation
## Risk: Dependency readiness race
Mitigation:
- backend readiness guard checks before webhook invoke
- explicit reason payload for blocked analysis

## Risk: Response shape drift
Mitigation:
- runtime normalization + guardrails
- fail-fast message when required root fields absent

## Risk: Slow AI response
Mitigation:
- visible loading state
- timeout + retry button

## 7) Deliverables
- New backend AI analysis endpoint + webhook service with 3-minute timeout
- Backend dependency readiness guardrail (identity, first fund, portfolio, swaps)
- Updated client wallet API service targeting backend endpoint
- Wallet page AI tab connected to working webhook call
- Frontend anti-rerender refetch guardrail
- Localization keys added in EN/VI
- Passing type-check for wallet page + backend modules

## 8) Out of Scope (Prototype)
- historical AI result persistence
- caching across sessions
- report export integration of AI block
- advanced markdown/rich rendering of evidence fields

## 9) Suggested Next Step After Prototype
Phase 2 hardening:
- add telemetry (latency/success/failure)
- add backend cache for AI responses by wallet + TTL
- add contract tests with mocked n8n payload variants

## 10) ApiManager Integration Plan For n8n Analysis
### 10.1 Inspection findings (current code)
- ACMS wrapper exists and already used for wallet provider calls via `callViaAcms`.
- `ApiManagerService` currently supports providers: `birdeye | helius` only.
- Wallet analysis route exists (`POST /wallets/analysis`), but wallet analysis service file is currently stubbed and missing expected exports.

### 10.2 Integration goal
Route n8n analysis webhook invocation through `ApiManagerService` to gain:
- request coalescing (avoid duplicate concurrent analysis for same wallet)
- in-memory cache for repeated analysis requests
- throttled queue behavior under burst load

### 10.3 Required changes
#### A) Fix analysis service baseline first
Files:
- `server/src/services/wallet/walletAnalysis.service.ts`
- `server/src/routes/wallets.route.ts`

Tasks:
- Implement and export `getWalletAiAnalysis`.
- Implement and export `WalletAnalysisServiceError`.
- Keep route error handling aligned with service error type.

#### B) Extend ApiManager provider support for n8n
File:
- `server/src/services/api-manager/api-manager.service.ts`

Tasks:
- Extend provider union: `"birdeye" | "helius" | "n8n"`.
- Add queue entry for `n8n`.
- Keep cache/coalesce behavior unchanged.

#### C) Reuse existing ACMS adapter gateway
File:
- `server/src/services/wallet/providers/adapters/index.ts`

Tasks:
- Extend adapter provider union to include `n8n`.
- Use `callViaAcms("n8n", endpoint, params, fetcher, opts)` in wallet analysis service.

#### D) Add request/response Zod schemas for analysis
File (target):
- `server/src/services/wallet/walletAnalysis.service.ts`

Tasks:
- request schema: `{ address: walletAddress }`
- response schema: normalized AI response object
- pass schemas to ACMS `opts` for validation on both sides

#### E) Stable cache key strategy
Use key components:
- provider: `n8n`
- endpoint: `analyse-wallet`
- params: `{ address, modelVersion?, promptVersion? }`

Reason:
- address-only key can become stale if workflow/prompt/model changes.

### 10.4 Timeout handling with ACMS path
- Keep webhook timeout inside fetcher with `AbortController` at `180000 ms`.
- ACMS wraps fetcher; timeout remains enforced per execution.
- Return explicit timeout service error code so route maps to deterministic status.

### 10.4.1 Debug logging requirements (ACMS + n8n)
- Add debug logs before/after `callViaAcms("n8n", ...)` execution.
- Include cache/coalesce visibility when possible (hit/miss/coalesced request).
- Log final source marker in success path (`acms-cache`, `acms-coalesced`, `webhook-live`).
- Keep logs behind env flag (example: `WALLET_AI_ANALYSIS_DEBUG=true`) to avoid noisy production output.

### 10.5 Guardrail interaction with ACMS
Order of operations in service:
1. Validate address.
2. Check prerequisites (identity, first fund, portfolio, swaps).
3. If prerequisite missing, short-circuit before ACMS call.
4. If ready, call webhook via ACMS.

Reason:
- avoid caching/coalescing invalid “not ready” states as analysis payload.

### 10.6 Rollout strategy
1. Add baseline service exports (compile green).
2. Add provider `n8n` to ApiManager + adapter.
3. Switch analysis fetch path to `callViaAcms`.
4. Enable with feature flag.

Suggested flag:
- `WALLET_AI_ANALYSIS_USE_ACMS` (default false), independent from broad `WALLET_USE_ACMS`.

### 10.7 Test matrix for ACMS integration
- Two simultaneous requests same address => one webhook execution (coalesced).
- Sequential requests same address within cache window => cache hit.
- Different addresses => separate fetch/keys.
- Timeout path => no cache poison with partial payload.
- Prerequisite missing => no ACMS/webhook call.
- Feature flag off => direct fetch path still works.
