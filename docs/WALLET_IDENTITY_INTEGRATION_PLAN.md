# Wallet Identity Integration Plan

## Goal
Integrate Helius Wallet Identity data as one input source in a backend-owned wallet intelligence response, where Helius provides baseline attribution and internal services add analysis, scoring, and product-specific metadata.

## Why This Plan
- Helius identity data is useful but partial for your product goals.
- Response behavior can vary in beta (404 unknown or payloads with type = unknown), so normalization is required.
- Existing wallet stack already has strong patterns for fetch wrappers, caching, route contracts, and tests that we should reuse.

## Scope
- In scope:
  - Production-grade identity service (single + batch)
  - Identity normalization layer for known/unknown/error states
  - Cache + TTL for identity records
  - Wallet intelligence composer that merges Helius identity with internal analysis
  - New wallet route endpoints (non-debug)
  - Client integration touchpoint for wallet header/overview identity display
  - Tests for service, route, and mapper behavior
- Out of scope (first pass):
  - Full historical risk engine redesign
  - Non-Solana identity provider integrations
  - Advanced admin tooling for manual tag overrides

## Current Baseline In Repo
- Shared Helius HTTP wrapper with API-key header and 429 retry exists in [server/src/util/util-helius.ts](server/src/util/util-helius.ts).
- Wallet data orchestration and cache patterns exist in [server/src/services/wallet/walletData.service.ts](server/src/services/wallet/walletData.service.ts) and [server/src/services/wallet/db/walletDataCacher.ts](server/src/services/wallet/db/walletDataCacher.ts).
- Wallet routes already expose overview/portfolio/transactions and a debug identity endpoint in [server/src/routes/wallets.route.ts](server/src/routes/wallets.route.ts).
- Current identity service is a draft with hardcoded API key and no shared error/caching conventions in [server/src/services/wallet/walletIdentity.service.ts](server/src/services/wallet/walletIdentity.service.ts).
- Wallet tags (user-authored metadata) are available via [server/src/services/walletTags.ts](server/src/services/walletTags.ts) and [server/src/routes/walletTags.route.ts](server/src/routes/walletTags.route.ts).
- Wallet overview UI currently displays label + tags and is a natural place to display identity in [client/src/components/wallet/WalletOverview/WalletOverview.tsx](client/src/components/wallet/WalletOverview/WalletOverview.tsx).

## External Contract Facts To Honor (Helius)
- Docs index source: https://www.helius.dev/docs/llms.txt
- Identity endpoint: GET /v1/wallet/{wallet}/identity
- Batch endpoint: POST /v1/wallet/batch-identity (up to 100 addresses)
- Unknown wallets may appear as:
  - HTTP 404 with no identity payload
  - or payload variants where type = unknown
- Beta note: response schema may evolve; mapper should be defensive and forward-compatible.

## Design Principles
1. Never leak provider instability into product contract.
2. Keep provider payload separate from normalized internal DTO.
3. Treat unknown identity as successful business outcome, not server error.
4. Make enrichment additive: identity first, internal analysis second.
5. Prefer batch endpoint whenever 2+ addresses are involved.
6. Cache aggressively for identity; compute volatile analysis separately.

## Target Response Model
Return a backend-owned model (example shape):

```json
{
  "address": "...",
  "chain": "solana",
  "identity": {
    "status": "known",
    "type": "exchange",
    "name": "Binance 1",
    "category": "Centralized Exchange",
    "tags": ["Centralized Exchange"],
    "domainNames": ["example.sol"],
    "provider": "helius",
    "providerVersion": "wallet-api-beta",
    "resolvedAt": "2026-03-14T00:00:00.000Z"
  },
  "analysis": {
    "riskScore": 26,
    "riskLevel": "low",
    "signals": [
      "known_entity",
      "exchange_category"
    ],
    "counterpartyProfile": {
      "exchangeInteractions24h": 4,
      "uniqueKnownEntities7d": 9
    }
  },
  "metadata": {
    "cache": {
      "identityHit": true,
      "analysisHit": false,
      "ttlSec": 21600
    }
  }
}
```

Notes:
- identity.status should be one of known | unknown | unavailable.
- unknown is not an error; unavailable represents provider/network failure.
- analysis can still be partially populated when identity is unknown/unavailable.

## Proposed Types
Add new DTOs under wallet services, for example in a new file under wallet dtos:
- HeliusWalletIdentityRaw
- HeliusWalletIdentityBatchRaw
- WalletIdentityStatus = known | unknown | unavailable
- WalletIdentityNormalized
- WalletIdentityAnalysis
- WalletIntelligenceResponse
- WalletIntelligenceBatchResponse

Normalization rules:
- If HTTP 200 and type not unknown => status known.
- If HTTP 404 => status unknown.
- If HTTP 200 but type unknown => status unknown.
- If 429/5xx/network failure => status unavailable, preserve errorCode in metadata only.

## Implementation Phases

### Phase 1: Harden Identity Fetch Layer
Files:
- [server/src/services/wallet/walletIdentity.service.ts](server/src/services/wallet/walletIdentity.service.ts)
- [server/src/util/util-helius.ts](server/src/util/util-helius.ts)

Tasks:
1. Remove hardcoded API key usage.
2. Use getEndpoint + getRequiredHeaders + heliusFetch.
3. Add two fetch functions:
   - getWalletIdentityRaw(address)
   - getWalletIdentityBatchRaw(addresses)
4. Add robust status handling for 404, 400, 401, 429, 5xx.
5. Add request guards (base58 format, address non-empty, batch max 100).

Deliverable:
- Provider-aware service with deterministic error mapping.

### Phase 2: Add Normalization + Composition Layer
Files:
- New wallet identity mapper/composer module in wallet services
- [server/src/services/wallet/walletData.service.ts](server/src/services/wallet/walletData.service.ts) for analysis inputs reuse
- [server/src/services/walletTags.ts](server/src/services/walletTags.ts)

Tasks:
1. Map raw Helius responses into WalletIdentityNormalized.
2. Build composeWalletIntelligence(address, options) that combines:
   - normalized identity
   - optional user tags (if authenticated context exists)
   - optional analytics from existing wallet services (exchange counts, tx aggregates)
3. Keep response stable even when one source fails.

Deliverable:
- One orchestrator returning backend-owned response shape.

### Phase 3: Add Cache Storage for Identity
Files:
- [server/src/db/schema.ts](server/src/db/schema.ts)
- Migration under server/postgresdb/migrations
- New retrieval/cacher helpers near existing wallet cache helpers

Suggested table:
- wallet_identity_cache
  - address (pk)
  - chain
  - status
  - type
  - name
  - category
  - tags (jsonb)
  - domain_names (jsonb)
  - raw (jsonb nullable)
  - fetched_at

TTL strategy:
- known: 6h to 24h
- unknown: 1h to 6h
- unavailable: do not persist as authoritative identity; optionally short-lived negative cache (for circuit breaking)

Deliverable:
- Cache-aware identity reads with stale-while-revalidate behavior.

### Phase 4: Expose Production Routes
Files:
- [server/src/routes/wallets.route.ts](server/src/routes/wallets.route.ts)

Routes:
1. GET /api/wallets/identity?address=...&chain=solana
2. POST /api/wallets/identity/batch
   - body: { addresses: string[], chain?: "solana" }
   - enforce max 100
3. Optionally GET /api/wallets/intelligence?address=...
   - returns composed identity + analysis object

Route behavior:
- 200 with status unknown for unknown wallet.
- 400 for invalid address format.
- 401 for auth errors to provider (sanitized message).
- 502/503 for provider outages only when no cached fallback exists.

Deliverable:
- Stable API contract replacing debug-only usage.

### Phase 5: Client Integration
Files:
- [client/src/services/wallet/walletApi.ts](client/src/services/wallet/walletApi.ts)
- [client/src/components/wallet/WalletOverview/WalletOverview.tsx](client/src/components/wallet/WalletOverview/WalletOverview.tsx)

Tasks:
1. Add fetchWalletIdentity and fetchWalletIntelligence methods.
2. In WalletOverview header:
   - show known name/category when status known
   - fallback to shortened address when unknown
   - optionally badge category and risk level
3. Keep existing label and user tags behavior intact.

Deliverable:
- UI displays identity attribution without breaking existing wallet overview flow.

### Phase 6: Testing
Files:
- New tests under server/tests/wallet and server/tests/routes
- Extend existing patterns in [server/tests/routes/wallets.route.test.ts](server/tests/routes/wallets.route.test.ts)

Test matrix:
1. Service unit tests:
   - maps 200 known -> status known
   - maps 404 -> status unknown
   - maps 200 type unknown -> status unknown
   - maps 429/5xx -> status unavailable
   - batch chunking and dedupe behavior
2. Cache tests:
   - cache hit/miss/ttl expiry
   - stale fallback on provider failure
3. Route tests:
   - single identity happy path
   - unknown identity still 200 with status unknown
   - invalid address -> 400
   - batch over 100 -> 400
4. Integration smoke:
   - identity + analysis composition returns complete envelope with partial failures tolerated

Deliverable:
- Regression-resistant identity stack with explicit behavior guarantees.

## Rollout Strategy
1. Deploy behind feature flag: walletIdentityV1.
2. Log-only mode for first release:
   - compare old debug endpoint output vs new normalized output for sampled requests.
3. Enable single endpoint first.
4. Enable batch endpoint second.
5. Enable intelligence composition endpoint third.
6. Remove debug identity route after verification window.

## Observability
Track per endpoint:
- provider latency p50/p95
- cache hit ratio
- unknown ratio
- provider error rates by status code
- batch size distribution
- downstream analysis completion ratio

## Security and Compliance Notes
1. Do not embed API keys in source code.
2. Sanitize provider errors before returning to clients.
3. Avoid persisting sensitive provider internals beyond required debug metadata.
4. If user-specific tags are merged, enforce auth boundaries strictly.

## Acceptance Criteria
1. No hardcoded Helius key remains in identity code.
2. Unknown wallets return a normalized success response (status unknown), not 500.
3. Batch identity supports up to 100 addresses with validation and chunking.
4. Cache behavior is implemented and tested.
5. Composed response includes identity plus internal analysis fields.
6. Wallet overview UI can display known entity identity without regressions.
7. Debug identity route is deprecated after rollout validation.

## Immediate Next Step (Suggested)
Implement Phase 1 + Phase 2 first, keeping API surface minimal:
- GET /api/wallets/identity for single lookup
- internal composeWalletIntelligence function
Then add batch and cache in Phase 3 and Phase 4.
