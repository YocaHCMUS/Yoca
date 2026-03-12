# Wallet Service Test Plan

## Scope
- Fetcher service: `walletDataFetcher.service.ts`
- Cache writer service: `walletDataCacher.ts`
- Cache reader service: `walletDataRetriever.ts`
- Token market data service: `token-market-data.ts`

## Objectives
- Validate pagination contracts for Helius Wallet API endpoints.
- Validate timestamp-window behavior and null timestamp handling.
- Validate deduplication and metadata writes in cache persistence.
- Validate TTL freshness checks and date-window filtering in cache retrieval.
- Validate null-value normalization before persisting token market data.
- Validate race handling when two service instances refresh the same stale token set concurrently.

## Test Strategy
- Unit tests only.
- No real network or database calls.
- Mock external dependencies:
  - Helius fetch utilities.
  - Database client and schema tables.
  - Drizzle helper functions.
  - TTL constants.

## Coverage Matrix

### Fetcher Tests
1. History pagination uses `before` with `pagination.nextCursor`.
2. Transfers pagination uses `cursor` with `pagination.nextCursor`.
3. Null timestamps are skipped (not treated as hard stop).
4. Transaction mapping includes direction, counterparty, and amount conversion.

### Cache Writer Tests
1. `saveTransactionsCache` deletes previous rows and inserts deduplicated hashes.
2. `saveTransfersCache` deduplicates by `(signature, instructionIndex)` and writes meta timestamp.
3. `saveTransactionsHeliusCache` deduplicates by signature and writes Solana row shape.

### Cache Reader Tests
1. Returns `null` when metadata is stale.
2. Returns mapped transaction DTOs when metadata is fresh.
3. Applies `from`-window filtering for transfers.
4. Applies `from`-window filtering for Helius transaction history.

### Token Market Data Tests
1. Normalizes null required numeric market fields to safe non-null defaults.
2. Always sets non-null `decimals` for DB compatibility.
3. Handles invalid/null date values (`athDate`, `atlDate`) without throwing.
4. Deduplicates concurrent stale refresh calls so two simultaneous requests share one API+DB refresh.

## Execution
- Run all tests: `npm test`
- Watch mode: `npm run test:watch`

## Exit Criteria
- All tests pass.
- No network/database side effects.
- Pagination and TTL logic regressions are covered by assertions.
