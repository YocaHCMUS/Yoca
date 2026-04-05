# Wallet Portfolio Phase 1 Plan: Backend Enrichment and API Contract

## Objective
Improve wallet portfolio data quality for wallet chart and table consumers by:
1. Aligning Solana portfolio mapping with Helius Wallet Balances behavior (including hide-zero semantics and metadata fields).
2. Adding a fallback enrichment path for unknown token metadata using token info service.
3. Returning logo URI and normalized token identity fields through wallet and chart routes.

## Scope
In scope:
1. Server-side DTO and cache payload enhancements for portfolio items.
2. Helius balances mapper updates for metadata fields.
3. Token-info fallback enrichment for missing symbol, name, and logo URI.
4. Route response adjustments for portfolio and distribution APIs.
5. Backend tests for fetcher, service, and route compatibility.

Out of scope:
1. Wallet page visual redesign.
2. Advanced icon rendering behavior in frontend components.
3. Any schema migration for wallet_portfolio_cache (jsonb supports additive fields).

## Functional Requirements
1. Keep showZeroBalance=false behavior explicit for Helius balances requests.
2. Preserve existing portfolio fields and add metadata fields as additive changes.
3. Fill unknown metadata only when fields are missing or placeholder-like.
4. Never fail the portfolio API because token enrichment fails.
5. Ensure /wallets/portfolio and distribution endpoints include logoUri for frontend use.

## Plan of Work

### 1) Portfolio Data Contract Update
1. Extend WalletPortfolioItem with optional metadata fields for frontend consumption:
   - logoUri?: string
   - keep symbol, name, tokenAddress, amount, priceUsd, valueUsd, change24hPercent
2. Update wallet portfolio cache JSON typing to include logoUri.
3. Keep backward compatibility so old cached rows still deserialize.

### 2) Helius Balances Mapper Update
1. In Helius portfolio fetcher, map logoUri from balances response.
2. Keep existing pagination and pricing mapping behavior.
3. Maintain filters:
   - showZeroBalance=false
   - showNative=true
   - showNfts=false
4. Keep graceful handling for null pricePerToken and usdValue.

### 3) Token Metadata Fallback Enrichment
1. Add shared enrichment helper in wallet service to process WalletPortfolioItem[].
2. Identify candidates where symbol/name/logoUri are missing and tokenAddress is valid.
3. Fetch metadata in batch using token info service.
4. Merge fallback values only when original fields are missing.
5. Keep deterministic precedence:
   - Provider value wins.
   - Token-info fallback fills blanks.
6. On enrichment failure, log warning and return original portfolio data.

### 4) Cache Refresh Behavior
1. On fresh cache hit, detect if any rows are missing metadata.
2. If missing metadata exists, run enrichment and write refreshed jsonb cache.
3. Avoid extra writes when no metadata changes are applied.

### 5) Route Response Updates
1. Ensure /api/wallets/portfolio returns enriched items with logoUri.
2. Ensure /api/wallets/distribution returns additive token metadata fields:
   - tokenAddress
   - symbol
   - name
   - logoUri
3. Ensure /api/charts/distribution mirrors the same additive metadata for wallet-driven responses.
4. Preserve current required shape (name, value, percentage, totalValue, metadata).

### 6) Testing Plan (Style-Guide Compliant)

#### 6.1 Testing Rule Alignment
1. Follow the style guide mandated testing rule: every service, function, or utility touched in this phase must be covered by a dedicated unit test target with explicit 1:1 mapping.
2. For existing consolidated test suites, preserve project conventions but keep explicit 1:1 traceability in this matrix and in test names.
3. New helper files introduced during implementation must ship with matching .test.ts files.

#### 6.2 1:1 Test Coverage Matrix
| Implementation Target | Test Target | Coverage Type | Status |
| :--- | :--- | :--- | :--- |
| server/src/services/wallet/fetchers/walletDataFetcher.service.ts | server/tests/wallet/fetchers/walletDataFetcher.service.test.ts | Unit | Extend existing |
| server/src/services/wallet/walletData.service.ts | server/tests/wallet/walletData.portfolio.test.ts | Unit/Service | Create |
| server/src/routes/wallets.route.ts | server/tests/routes/wallets.route.test.ts | Route contract | Extend existing |
| server/src/routes/charts/distribution.route.ts | server/tests/routes/charts/distribution.route.test.ts | Route contract | Create |
| server/src/services/tokens/token-info.ts (if modified) | server/tests/tokens/token-info.test.ts | Unit | Create/Extend as needed |

#### 6.3 Required Unit and Service Cases
1. Helius fetcher mapping:
   - maps logoUri from balances payload.
   - keeps showZeroBalance=false in request query.
   - preserves pagination behavior and non-breaking handling for null price fields.
2. Wallet portfolio enrichment service:
   - fills missing symbol, name, and logoUri from token info fallback.
   - never overwrites existing provider-provided symbol, name, or logoUri.
   - skips enrichment for invalid or empty tokenAddress.
   - handles token info failure and still returns portfolio successfully.
3. Cache refresh logic:
   - enriches stale metadata on cache hit and persists only when rows changed.
   - avoids unnecessary writes when metadata is already complete.

#### 6.4 Route Contract Cases
1. GET /api/wallets/portfolio:
   - returns additive logoUri while preserving legacy fields.
   - returns 200 with enriched payload when fallback is used.
2. GET /api/wallets/distribution:
   - includes additive token metadata (tokenAddress, symbol, name, logoUri).
   - preserves required distribution fields (name, value, percentage).
3. GET /api/charts/distribution:
   - wallet-driven path includes additive metadata.
   - output shape remains backward compatible for existing chart consumers.

#### 6.5 Integration and Smoke Checks
1. Validate using real Solana wallets with:
   - fully known tokens.
   - partially unknown tokens.
   - mixed portfolios with missing pricing.
2. Confirm logoUri appears from either Helius payload or token-info fallback.
3. Confirm no route-level regressions in status codes and response envelope.

#### 6.6 Execution Commands
1. Run all server tests:
   - npm --prefix server run test
2. Run focused tests while iterating:
   - npm --prefix server run test -- walletDataFetcher.service
   - npm --prefix server run test -- wallets.route
   - npm --prefix server run test -- distribution.route
3. Run server lint:
   - npm --prefix server run lint

#### 6.7 Test Exit Gates
1. 100% pass on new and updated tests.
2. No breaking changes in existing wallet route tests.
3. New additive fields verified in route snapshots/assertions.
4. Manual smoke checks completed for at least three wallet scenarios.

## Acceptance Criteria
1. Portfolio responses include logoUri when available from either provider or token-info fallback.
2. Unknown token symbol/name cases are reduced by fallback enrichment.
3. Wallet and chart distribution routes expose enough metadata for frontend icon rendering.
4. No regressions in existing consumers that rely on current portfolio fields.
5. Tests pass for updated fetcher/service/route behavior.

## Risks and Mitigations
1. Risk: Extra token-info calls increase latency.
   Mitigation: Run enrichment only for rows with missing metadata and batch addresses.
2. Risk: Inconsistent tokenAddress casing causes lookup misses.
   Mitigation: Normalize addresses for lookup keys.
3. Risk: Cached rows remain stale for long periods.
   Mitigation: Opportunistic enrichment on cache hit when metadata is missing.

## Rollout Checklist
1. Implement and run server tests.
2. Validate with real Solana wallets containing mixed known/unknown tokens.
3. Verify /wallets/portfolio and both distribution endpoints include logoUri.
4. Confirm no response shape regressions for existing clients.
