# Wallet AI Summarization UX Enhancement Plan (2026-04-23)

## 1) Objective
Enhance Wallet AI Analysis UX with two upgrades:
- Language-aware summarization request (`en`, `vn`) driven by current localization context.
- Entity-aware rendering (token/wallet/dex) using metadata capsules with existing `TokenIdentityCell` instead of plain text mentions.

## 2) Current Gaps
- Client sends only wallet address to backend AI route.
- Webhook does not receive explicit language preference.
- AI response is text-heavy and not entity-structured.
- UI displays raw strings for tokens/wallets/dex instead of reusable visual identity capsules.

## 3) Proposed End-State
1. Client sends `{ address, language }` to backend AI endpoint.
2. Backend forwards language to webhook payload.
3. Backend resolves and enriches entity references into a metadata map.
4. Backend response includes:
- Existing analysis fields (for compatibility).
- New `entities` dictionary.
- New `rich` references pointing to entity IDs.
5. Frontend interprets `rich` references and renders entity capsules via `TokenIdentityCell`.

## 4) API Contract Changes

### 4.1 Client -> Backend
Endpoint:
- `POST /api/wallets/ai-analysis`

Request body:
```json
{
	"address": "<wallet-address>",
	"language": "en"
}
```

Language values:
- `en`
- `vn`

Fallback:
- If missing/invalid, backend defaults to `en`.

### 4.2 Backend -> Webhook
Webhook body:
```json
{
	"address": "<wallet-address>",
	"language": "en"
}
```

### 4.3 Backend -> Client (V2)
Backward-compatible response strategy:
- Keep existing fields used by current UI.
- Add new fields for rich rendering.

Example extension:
```json
{
	"version": "v2",
	"wallet_address": "...",
	"classification": { "...": "..." },
	"strategy": { "...": "..." },
	"behavior_metrics": { "...": "..." },
	"first_funder_analysis": { "...": "..." },
	"wallet_age": { "...": "..." },
	"risk_assessment": { "...": "..." },
	"summary": "...",
	"entities": {
		"token:So111...": {
			"id": "token:So111...",
			"kind": "token",
			"address": "So111...",
			"symbol": "SOL",
			"label": "SOL",
			"fullName": "Solana",
			"logoUri": "https://..."
		}
	},
	"rich": {
		"summary": [
			{ "type": "text", "text": "Rotated into " },
			{ "type": "entity", "entityId": "token:So111...", "text": "SOL" }
		],
		"strategyEvidence": [
			{
				"segments": [
					{ "type": "text", "text": "Used " },
					{ "type": "entity", "entityId": "dex:jupiter", "text": "Jupiter" }
				]
			}
		]
	}
}
```

## 5) Architecture Changes

### 5.1 New Backend Service: Entity Resolver
Add service that scans AI payload text and resolves identities.

Suggested files:
- `server/src/services/wallet/walletAiEntityResolver.service.ts`
- `server/src/services/wallet/dtos/walletAiEntityObjects.ts`

Resolver responsibilities:
- Detect entity mentions in summary/evidence/signals.
- Classify mention kind (`token`, `wallet`, `dex`, `cex`, `unknown`).
- Resolve metadata (`logoUri`, `symbol`, `label`, `fullName`, `address`).
- Return deduplicated `entities` map.
- Convert text fields into mixed `rich` segments with entity references.

### 5.2 Identity Sources
- Token metadata from existing token endpoints/caches.
- Wallet identity from existing wallet identity service.
- Exchange/dex labels from known mappings + swap/exchange context.

### 5.3 Failure Strategy
- Entity resolver must be non-blocking.
- If resolver fails or partial misses:
- Keep plain text fields intact.
- Return best-effort `entities` + `rich`.
- UI fallback to text.

## 6) Frontend UX Changes

### 6.1 Request Language Wiring
In wallet page:
- Map `lang` from localization context:
- `en` -> `en`
- `vi` -> `vn`
- Pass language into `fetchWalletAiAnalysis(address, language)`.

### 6.2 Data Types
Update wallet API types to include:
- `language` request param.
- Optional `version`, `entities`, `rich` response fields.

### 6.3 Capsule Renderer
Add helper renderer that takes `rich` segments and `entities` map and outputs JSX.

For entity segments:
- Render `TokenIdentityCell` with:
- `symbol`: `entity.symbol ?? entity.label`
- `fullName`: `entity.fullName`
- `imageUrl`: `entity.logoUri`
- `showInitialsFallback: true`

Fallback:
- If entity missing, render `segment.text` as plain string.

### 6.4 Target UI Areas
Replace plain text rendering (when `rich` exists) in:
- Summary
- Classification supporting signals
- Strategy evidence
- Any section with entity mentions

## 7) Backward Compatibility and Rollout
1. Keep current schema fields unchanged.
2. Add new fields as optional.
3. Frontend prefers `rich` rendering when available.
4. Frontend falls back to existing strings when `rich` absent.
5. Enable with feature flag if needed:
- `WALLET_AI_RICH_RENDERING_ENABLED`

## 8) Implementation Steps

### Step 1: Request Language
- Backend: add `language` to request schema.
- Backend: include `language` in webhook body.
- Backend: include `language` in ACMS key params to avoid cross-language cache collisions.
- Client: pass language from localization context.

### Step 2: Entity Resolver Service
- Create DTO + service for entity extraction/resolution.
- Implement deterministic matching first (addresses/exact symbols/known dex names).
- Add contextual matching second (portfolio/swaps context).

### Step 3: Response Enrichment
- Enrich normalized analysis payload with `entities` + `rich`.
- Validate with new optional schema fields.

### Step 4: Frontend Rendering
- Update API types.
- Add rich segment renderer.
- Integrate `TokenIdentityCell` rendering in AI sections.

### Step 5: QA + Hardening
- Add tests and manual checks.
- Monitor fallback rate and resolver misses.

## 9) Testing Plan

### 9.1 Backend
- Request validation:
- valid language values accepted.
- invalid/missing language defaults to `en`.
- Webhook payload includes language.
- ACMS keys differ by language.

### 9.2 Resolver
- Detect and resolve token mentions from symbols/addresses.
- Resolve wallet mentions from addresses/identity labels.
- Resolve dex mentions from known map.
- Deduplicate entities across sections.
- Graceful fallback on unresolved references.

### 9.3 Frontend
- Uses `rich` + `entities` when present.
- Falls back to plain text when absent.
- Capsule rendering displays logo/name/symbol correctly.
- Locale switch triggers language-specific request and fresh analysis fetch.

## 10) Risks and Mitigations
- Risk: False-positive entity matching.
- Mitigation: Prioritize deterministic rules, keep confidence thresholds, fall back to text.

- Risk: Response complexity increases payload size.
- Mitigation: Deduplicate entities and reference by ID.

- Risk: Language mismatch from cache.
- Mitigation: Include language in cache/coalescing key.

## 11) Deliverables
- Language-aware AI analysis request pipeline.
- New backend entity resolver service.
- Enriched AI response (`entities`, `rich`) with backward compatibility.
- Frontend capsule rendering via `TokenIdentityCell` for entity references.
- Tests for language behavior, resolver behavior, and UI fallback.

## 12) Suggested Next Step
Start with Step 1 and Step 2 in one PR:
- Add language contract + resolver skeleton + response fields (empty `entities`/`rich` allowed).
- This keeps contract stable while unblocking frontend integration.
