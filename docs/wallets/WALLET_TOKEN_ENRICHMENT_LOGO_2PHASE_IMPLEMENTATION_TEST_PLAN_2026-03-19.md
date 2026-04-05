# Wallet Token Enrichment + Logo Display

## Objective
Deliver full token enrichment for wallet swaps and transfers (metadata + pricing parity with portfolio behavior), then render token logos in wallet UI tables and modal.

## Scope
- In scope:
  - Server enrichment for swaps and transfers using metadata and market data.
  - Missing enrichment path fix in transfers provider branch.
  - Additive DTO/type updates across server and client.
  - Wallet client rendering of token logos for swap and transfer views.
  - Tests for backend enrichment logic and frontend rendering behavior.
- Out of scope:
  - Large schema redesign.
  - Non-wallet pages.
  - Breaking API response changes.

## Phase 1: Backend Enrichment Foundation

### Implementation
1. Define additive DTO contract for full token data.
- Update server DTOs in server/src/services/wallet/dtos/walletDataObjects.ts.
- Add optional identity fields for transfer tokens (name/logo) and optional value fields as needed for transfer USD display.
- Extend WalletSwapBalanceChange with optional name/logo fields while preserving existing symbol/price/value fields.

2. Reuse portfolio metadata normalization rules for swaps/transfers.
- Reuse existing helper behavior in server/src/services/wallet/walletData.service.ts:
  - normalizePortfolioText
  - normalizePortfolioLookupAddress
  - shouldFillPortfolioText
  - isMissingPortfolioLogoUri
- Preserve SOL alias normalization parity with portfolio path.

3. Upgrade enrichment function from transaction-only mutation to multi-shape mutation.
- Refactor enrichWithSolanaTokenPrices in server/src/services/wallet/walletData.service.ts to enrich:
  - WalletTransaction: existing behavior (priceUsd/totalUsd).
  - WalletTransfer: fill tokenSymbol/tokenName/tokenLogoUri when missing, plus token price and amount USD where available.
  - WalletSwap: fill missing symbol/name/logoUri in balanceChanges and feeChanges, fill priceUsd/valueUsd where missing, derive totalValueUsd fallback when absent.
- Fetch getTokenMeta and getTokenMarketData in batched calls per request.
- Do not overwrite valid provider fields unless the current value is placeholder/empty.

4. Close branch-level enrichment gap.
- Add enrichment call in getWalletTransfers options.from provider success path (currently save + return without enrichment).

5. Keep cache strategy additive and low-risk in this phase.
- Runtime enrichment is sufficient for response quality.
- Do not require DB migration in Phase 1 unless profiling later shows repeated metadata lookups are costly.

### Testing
1. Add backend enrichment tests.
- Create or extend tests under server/tests/wallet to cover:
  - transfer metadata fill from token meta.
  - swap leg metadata fill from token meta.
  - SOL alias normalization behavior.
  - non-overwrite behavior for valid provider symbols/names.
  - graceful behavior when metadata or market data service fails.

2. Add branch coverage test for transfers provider path.
- Validate getWalletTransfers options.from provider branch returns enriched transfers.

3. Regression tests for provider fallback and cache paths.
- Ensure existing Moralis/Helius swap fallback behavior remains unchanged.
- Ensure cached chunk paths still return enriched records.

4. Suggested verification commands.
- npm run test -w=server
- npm run lint -w=server

### Exit Criteria
- All transfer and swap return paths produce enriched token identity data when available.
- No breaking API contract changes.
- Server tests for enrichment pass.

## Phase 2: Client Token Logo Rendering

### Implementation
1. Mirror additive type updates in client.
- Update client/src/services/wallet/walletApi.ts transfer and swap types for new optional identity/value fields.

2. Render logos in wallet transfer and swap tables.
- Update wallet page in client/src/pages/wallet/index.tsx:
  - Transfer token column renderer to use TokenIdentityCell with symbol/name/logo.
  - Swap sold/bought columns to render amount + TokenIdentityCell.
- Keep sortable/filterable raw values intact to avoid table behavior regression.

3. Render logos in swap detail modal.
- Update client/src/components/wallet/SwapDetailModal/SwapDetailModal.tsx to show token icon for sold/bought and change rows.
- Preserve existing fallback behavior when logo is missing or image fails.

4. Update shared table renderer only if needed.
- If row-object lookup is required, extend Table cell renderer call signature in client/src/components/tables/Table.tsx to pass original row index safely.
- Ensure no pagination/filtering sort regressions from this change.

5. Light styling updates.
- Add minimal CSS adjustments for icon alignment/spacing in wallet page and modal where needed.

### Testing
1. Update client API contract tests.
- Extend client/src/services/wallet/walletApi.test.ts for new optional transfer/swap metadata fields.

2. Add wallet page rendering tests.
- Extend client/src/pages/wallet/index.test.tsx (or add focused tests) to verify:
  - logo appears when provided.
  - text fallback appears when logo is missing.
  - no crash when logo URL fails.

3. Add modal rendering tests.
- Add or extend tests for SwapDetailModal to verify icon rendering and fallback for sold/bought legs.

4. Manual QA checklist.
- Open wallet page and confirm transfer/swap logos in first and paginated pages.
- Confirm filter/sort still works in transfer/swap tables.
- Confirm modal displays token icons correctly.

5. Suggested verification commands.
- npm run test -w=client
- npm run lint -w=client

### Exit Criteria
- Wallet transfer/swap table cells display token logos when available.
- Swap detail modal displays token logos with robust fallback.
- Client tests and lint pass with no table interaction regressions.

## Delivery Notes
- Recommended execution order: complete all Phase 1 tasks and tests before Phase 2 UI work.
- Rollback safety: all new response fields are optional and additive.
- Observability: keep enrichment logging concise and include counts of enriched records by type (transaction/transfer/swap).
