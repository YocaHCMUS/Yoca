# Wallet Swaps + Token Trades Unification Plan

Date: 2026-04-01
Status: Draft
Owner: Wallet Backend

## Goal
Unify getWalletTokenTrades behavior into the existing getWalletSwaps path by extending getWalletSwaps only, improving maintainability with a direct development cutover.

## Background
Today, wallet swap/trade data is split across separate routes, services, tables, and response contracts:

- Swap history path:
  - Route: /api/wallets/swap
  - Service: walletTransfersSwaps.service.ts -> getWalletSwaps
  - Tables/cache: wallet_swap + wallet_swap_meta
  - Response: WalletSwapsResponse (swaps + pageInfo)

- Token trades path (used by TokenDetailsDemo recent trades):
  - Route: /api/wallets/:walletAddress/trades/:tokenAddress
  - Service: wallet-token-trades.ts -> getWalletTokenTrades (exported as getWalletTokenSwaps)
  - Table/cache: wallet_token_trades
  - Response: raw trade rows (no pageInfo envelope)

This split causes duplicate logic for provider fetch, TTL behavior, and mapping/normalization.

## Constraints (Confirmed)
1. Do not introduce a new unified service function.
2. Do not introduce a mapper layer as a new abstraction.
3. Extend existing getWalletSwaps to support additional params/data required by trade route.
4. Remove wallet_token_trades as an active schema/read-write path.
5. Keep one row per transaction hash in wallet_swap (no multi-leg key migration).

## Current Problems
1. Duplicate provider integration logic for Moralis swaps in two service paths.
2. Different caching freshness semantics:
   - wallet_swap path uses wallet_swap_meta timestamp freshness.
   - wallet_token_trades path uses updatedAt freshness on row set.
3. Different pagination/contract semantics:
   - swap route supports cursor/before/pageInfo.
   - token trades route returns non-paged array.
4. Data model divergence:
   - wallet_swap is canonical WalletSwap shape.
   - wallet_token_trades is token-focused row model.
5. Higher regression risk when changing swap mapping because two downstream formats must be maintained independently.

## Target Architecture
Use WalletSwap as the canonical domain model and the existing getWalletSwaps implementation as the only retrieval pipeline.

- Extend getWalletSwaps with optional token-route parameters (for example tokenAddress and response mode flags if needed).
- Route both /swap and /:walletAddress/trades/:tokenAddress through getWalletSwaps.
- Remove wallet-token-trades fetch/write path and wallet_token_trades table usage.

## Phased Plan

### Phase 1: Extend Existing getWalletSwaps
1. Add optional parameters directly to existing getWalletSwaps options.
2. Input options should include:
   - address (required)
   - tokenAddress (optional)
   - from/cursor/before/limit (optional)
3. Apply tokenAddress filtering within getWalletSwaps before final response.
4. Preserve pageInfo behavior.

Acceptance criteria:
- Existing /api/wallets/swap behavior unchanged.
- Extended getWalletSwaps returns deterministic ordering and valid pageInfo.

### Phase 2: Rewire Trades Route to Existing getWalletSwaps
1. Update /api/wallets/:walletAddress/trades/:tokenAddress route to call getWalletSwaps with tokenAddress filter.
2. Keep existing validation schema for walletAddress/tokenAddress unchanged.
3. Return response in the target trade-route shape for the current app flow.
4. Avoid adding a separate mapper module; keep any required transformation local to route/service flow.

Acceptance criteria:
- TokenDetailsDemo recent trades renders correctly after route cutover.
- Row count and values are correct for active test wallets.

### Phase 3: Contract Finalization (Direct Cutover)
1. Add optional pagination parameters to token trades endpoint contract.
2. Standardize token trades and swap pagination semantics without versioning.
3. Remove any temporary dual-contract handling once route cutover is complete.

Acceptance criteria:
- Trades and swaps endpoints expose one consistent, final contract model.
- No versioned route variants are introduced.

### Phase 4: Data/Schema Consolidation (Remove Trade Table Path)
1. Stop reading/writing via wallet-token-trades.ts.
2. Remove wallet_token_trades references from service exports and route dependencies.
3. Create migration to drop wallet_token_trades table after rollout guard window.
4. Keep wallet_swap + wallet_swap_meta as the only swap/trade persistence path.

Acceptance criteria:
- No runtime read path depends on wallet-token-trades provider fetch or table.
- Schema no longer includes wallet_token_trades.

## Critical Design Decision

### Transaction deduplication granularity
Current wallet_swap cache path deduplicates by transactionHash before insert and table PK is transactionHash.

Risk: Some real swaps can have multiple legs/events under one transaction hash; deduping to one row may lose token-trade fidelity.

Decision:
1. Keep 1 row per transaction hash.

Implications:
- No wallet_swap primary key change.
- Keep existing saveSwapsCache dedupe by transactionHash.
- Trade route behavior must align with this granularity.

## API and Routing Changes

### Keep (unchanged initially)
- GET /api/wallets/swap
- GET /api/wallets/:walletAddress/trades/:tokenAddress

### Internal changes
- Route /trades/:tokenAddress uses getWalletSwaps with tokenAddress-aware params.
- wallet-token-trades.ts is deprecated and then removed.

## Testing Strategy
1. Unit tests:
   - Unified filter logic by tokenAddress.
   - Route-level response shaping for token-trades contract.
2. Contract tests:
   - /wallets/swap response unchanged.
   - /wallets/:walletAddress/trades/:tokenAddress payload shape unchanged.
3. Integration tests:
   - Compare old vs new trade route outputs on fixture wallets.
4. Regression checks:
   - Ordering consistency (latest-first).
   - Numeric fields: base/quote amounts, volumeUsd, timestamps.

## Rollout Strategy
1. Feature flag the token-trades route backend implementation switch.
2. Run dual-read comparison logging for a sample of wallets.
3. Track mismatch metrics:
   - count mismatch
   - timestamp mismatch
   - volume mismatch
4. Enable unified path gradually.
5. Remove old path after stability window.

## Risks and Mitigations
1. Risk: semantic mismatch in tradeAction mapping for token-centric view.
   - Mitigation: route/service tests for buy/sell orientation relative to requested token.
2. Risk: dedupe by transaction hash hides multiple swap legs.
   - Mitigation: accepted constraint; document expected behavior and test for stable outputs.
3. Risk: pagination mismatch for token route.
   - Mitigation: enforce one final pagination contract during cutover and update the route in one pass.
4. Risk: cache freshness behavior changes visible to users.
   - Mitigation: align TTL checks and monitor stale-hit rates during rollout.

## Implementation Checklist
- [ ] Extend existing getWalletSwaps options with optional token filter params.
- [ ] Rewire token trades route to existing getWalletSwaps.
- [ ] Finalize single route contract for TokenDetailsDemo flow (no versioning).
- [ ] Add tests for route/service contract.
- [ ] Add feature flag and dual-read logging.
- [ ] Keep dedupe strategy as one row per transaction hash.
- [ ] Remove wallet-token-trades read/write path.
- [ ] Remove wallet_token_trades table via migration.

## Proposed File Touches (for implementation PR)
- server/src/services/wallet/walletTransfersSwaps.service.ts
- server/src/routes/wallets.route.ts
- server/src/services/wallet/index.ts
- server/src/services/wallet/wallet-token-trades.ts (remove/deprecate)
- server/src/services/wallet/dtos/walletDataObjects.ts (only if route contract typing needs extension)
- server/src/db/schema.ts (remove wallet_token_trades definition)
- drizzle migration files for wallet_token_trades removal
- tests covering routes/services

## Out of Scope
- Frontend redesign of TokenDetailsDemo.
- Changes to wallet overview/portfolio/token details APIs.
- Multi-provider fallback redesign beyond swap/trade unification.
