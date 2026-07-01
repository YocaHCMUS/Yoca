# Wallet AI Summarization UX Enhancement Plan (2026-04-23, Revised 2026-04-24)

## 1) Objective
Enhance Wallet AI Analysis UX with workflow-native reference output:
- Keep language-aware summarization request (en, vn) from localization context.
- Consume reference-aware output produced directly by workflow.
- Remove backend entity extraction and old enrichment payload dependence.

## 2) Scope Change
Previous plan assumed backend/entity pipeline with separate enrichment blocks.

New reality:
- Workflow returns structured output with ref markers in text and reference entries in output.reference.
- Backend should pass through and normalize workflow format.
- Frontend should resolve ref:n markers through output.reference and render capsules.

Out of scope now:
- Backend entity extraction service.
- Backend mention detection/classification.
- old enrichment response contract.

## 3) Current Gaps (After Scope Change)
- Route contract still assumes old optional enrichment fields.
- UI still renders plain strings in sections containing ref:n markers.
- Workflow envelope shape (array + output) needs consistent normalization.
- output.reference not yet treated as single source of truth in renderer.

## 4) Proposed End-State
1. Client sends { address, language } to backend AI endpoint.
2. Backend forwards { address, language } to workflow webhook.
3. Backend route/service normalizes workflow envelope into stable API shape.
4. Backend preserves output.reference and text fields with ref:n markers.
5. Frontend resolves ref:n markers using output.reference and renders capsules.

## 5) API Contract Changes

### 5.1 Client -> Backend
Endpoint:
- POST /api/wallets/ai-analysis

Request body:
```json
{
  "address": "<wallet-address>",
  "language": "en"
}
```

Language values:
- en
- vn

Fallback:
- Missing/invalid language defaults to en.

### 5.2 Backend -> Workflow Webhook
Webhook body:
```json
{
  "address": "<wallet-address>",
  "language": "en"
}
```

### 5.3 Workflow -> Backend
Accepted workflow envelope example:

```json
[
  {
    "output": {
      "wallet_address": "...",
      "classification": { "...": "..." },
      "strategy": { "...": "..." },
      "behavior_metrics": { "...": "..." },
      "first_funder_analysis": { "...": "..." },
      "wallet_age": { "...": "..." },
      "risk_assessment": { "...": "..." },
      "summary": "...",
      "reference": [
        {
          "ref_id": 0,
          "type": "wallet",
          "address": "...",
          "name": "Target Wallet",
          "symbol": "N/A",
          "logoUri": ""
        },
        {
          "ref_id": 1,
          "type": "token",
          "address": "...",
          "name": "Jupiter Perpetuals Liquidity Provider Token",
          "symbol": "JLP",
          "logoUri": "https://..."
        }
      ]
    }
  }
]
```

Notes:
- output.reference is authoritative source for ref:n tokens.
- Route should tolerate missing/partial reference array for backward compatibility and fallback rendering.

### 5.4 Backend -> Client
Backend response strategy:
- Preserve existing fields consumed by current UI.
- Forward output.reference as-is.
- Do not require any extra enrichment fields beyond reference.

## 6) Route/Service Responsibilities (Revised)

### 6.1 Keep
- Request validation (address, language).
- Dependency readiness checks.
- Webhook call + timeout/error mapping.
- Envelope normalization (object, array, output wrapper).
- ACMS key includes language.

### 6.2 Remove
- Backend entity resolver service.
- Mention detection/classification logic.
- legacy enrichment schema requirements.

### 6.3 Add/Adjust
- Route validation allows optional output.reference array.
- Service normalization preserves reference block instead of rebuilding metadata maps.
- Keep graceful fallback: unresolved ref:n remains plain text.

## 7) Frontend UX Changes (Primary Work)

### 7.1 Request Language Wiring
- Map localization context:
  - en -> en
  - vi -> vn
- Send language in fetchWalletAiAnalysis(address, language).
- Cache key must include language.

### 7.2 Data Types
Update wallet AI types to support reference-driven payload:
- reference?: Array<{ ref_id: number; type: string; address?: string; name?: string; symbol?: string; logoUri?: string }>

Keep all legacy fields required by current cards/widgets.

### 7.3 Renderer Strategy
- Disclaimer: renderer will be implemented as a separate service/module for reuse across wallet AI sections and future pages.
- Parse ref:n markers from text fields.
- Resolve marker n with reference entry where reference.ref_id === n.
- Render capsule using reference metadata when found.
- Fallback to plain text token when missing/unresolved.

### 7.4 Target UI Areas
Prioritize:
- Summary
- Classification supporting signals
- Strategy evidence
- Behavior metrics text containing references
- First funder notes

## 8) Backward Compatibility and Rollout
1. Do not remove existing response fields.
2. Treat reference rendering as optional enhancement.
3. Feature-flag reference rendering if needed:
   - WALLET_AI_REFERENCE_RENDERING_ENABLED
4. Keep text fallback path always available.

## 9) Implementation Steps (Revised)

### Step 1: Contract/Route Alignment
- Finalize accepted workflow envelope with output.reference.
- Ensure route/service schema accepts optional reference field.
- Keep language in request/webhook/ACMS params.

### Step 2: Frontend Type Update
- Extend wallet AI response types with optional reference field.
- Add parser guards for partial/missing reference entries.

### Step 3: Frontend Rendering Integration
- Add text-to-JSX ref resolver using output.reference.
- Integrate in AI sections with strict fallback to plain text.

### Step 4: QA + Hardening
- Validate locale switch sends proper language and refetches correctly.
- Validate reference rendering and fallback behavior.
- Monitor payload variability from workflow.

## 10) Testing Plan (Revised)

### 10.1 Backend Route/Service
- Accepts valid language values.
- Missing/invalid language defaults to en.
- Webhook payload includes language.
- ACMS key differs by language.
- Envelope normalization handles:
  - object
  - array
  - { output: ... }
  - [ { output: ... } ]
- Optional output.reference does not break schema.

### 10.2 Frontend
- Resolves ref:n markers using output.reference when present.
- Falls back to legacy plain text when reference missing/partial.
- Handles unresolved ref:n markers without crashing.
- Locale switch causes language-specific request + cache isolation.

## 11) Risks and Mitigations (Updated)
- Risk: Workflow response shape drifts.
- Mitigation: schema guards + tolerant normalization + fallback rendering.

- Risk: Missing reference metadata for some ref markers.
- Mitigation: render raw token text when lookup misses.

- Risk: Cross-language cache contamination.
- Mitigation: include language in cache/coalescing keys.

## 12) Deliverables (Updated)
- Language-aware wallet AI request pipeline.
- Route/service alignment for workflow envelope and output.reference.
- Frontend support for output.reference-driven ref:n rendering.
- Backward-compatible fallback rendering.
- Tests for language behavior, envelope normalization, and UI fallback.

## 13) Suggested Next Step
Single PR focused on routes + UI:
- Finalize route/schema normalization for output.reference payload.
- Extend frontend types + ref resolver renderer.
- Add tests for envelope variants and fallback behavior.
