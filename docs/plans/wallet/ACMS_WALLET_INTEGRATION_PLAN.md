# ACMS → Wallet Services Integration Plan

Goal
----
Integrate the API Call Management System (ACMS: caching, coalescing, throttling, key rotation)
into wallet request flows so all outbound provider calls from wallet services go through ACMS.

High-level Steps
----------------
1. Feature flag & config
   - Add `WALLET_USE_ACMS` env flag and central config to enable/disable ACMS per service.
   - Location: central config (e.g., `server/src/config` or env documentation).

2. Adapter layer
   - Add thin adapters that bridge wallet provider usage to `ApiManagerService.call(...)`.
   - Suggested folder: `server/src/services/wallet/providers/adapters/`.
   - Adapter signature: `call(provider, endpoint, params, fetcher, opts?)`.

3. Replace direct provider calls
   - Update wallet fetchers/consumers (examples below) to route outbound calls through the adapter.
   - Files to update (examples):
     - `server/src/services/wallet/fetchers/walletDataFetcher.service.ts`
     - `server/src/services/wallet/walletTokenBalance.service.ts`
     - `server/src/services/wallet/walletHistory.service.ts`

4. API key rotation & metadata
   - Ensure all provider utilities use `api-key-manager` and `getRequiredHeadersWithMetadata()`.
   - Provider configs should use `apiKeyEnvVar` (env var name) not a single `apiKey` string.
   - Verify `server/src/util/*` helpers (Birdeye, Helius, Moralis) use the manager.

5. Tests
   - Unit tests: mock `ApiManagerService` in wallet unit tests to verify routing.
   - Coalescing tests: multi-call bursts should coalesce to a single fetcher invocation.
   - Throttling tests: verify requests respect provider rate limits.
   - Integration: small e2e wallet flow (balance) calling ACMS to validate caching/coalescing/retry.

6. Observability
   - Wire ACMS metrics into existing tracking: call counts, cache hits/misses, queue wait, 429 retries.
   - Use existing `trackApiCallResponse` hooks where appropriate.

7. Rollout plan
   - Start behind `WALLET_USE_ACMS=false` by default.
   - Enable for non-critical read-only endpoints first.
   - Monitor metrics and errors; progressively enable more endpoints.
   - Rollback: flip flag off and revert any adapter registration if necessary.

8. Documentation
   - Update developer README with:
     - How to enable ACMS (`WALLET_USE_ACMS`).
     - Env var format for comma-separated keys (e.g., `BIRDEYE_API_KEY=key1,key2`).
     - Testing instructions for mocking ACMS in unit tests.

Acceptance Criteria
-------------------
- Wallet services use ACMS when the feature flag is enabled.
- Coalescing reduces duplicate outbound provider calls in burst scenarios.
- Throttling enforces provider limits and recovers from 429 with retries/backoff.
- No test regressions; CI passes.

Files & Locations (suggested)
----------------------------
- Adapter scaffolding: `server/src/services/wallet/providers/adapters/`
- Wallet fetchers: `server/src/services/wallet/fetchers/` (see existing files)
- Provider helpers: `server/src/util/*` (use `apiKeyManager`)
- ACMS service: `server/src/services/api-manager/api-manager.service.ts`

Minimal Implementation Order
----------------------------
1. Add feature flag + config.
2. Add adapter interface + one adapter for Birdeye.
3. Route one wallet flow (balance) through adapter and update tests.
4. Expand to other providers and wallet flows.

Notes
-----
- Postgres cache persistence step can be skipped initially because wallet services
  already have persistent data and check that first; ACMS can focus on in-memory/Redis
  caching, coalescing, and queueing initially.

---
This plan is intended for review; I can implement the steps iteratively — start with
Step 1 (feature flag and adapter scaffold) if you want me to proceed.
