# Wallet Table Pagination And Counterparty Activity Plan

## Goal
Migrate wallet transfer and swap table data flows from time-window accumulation to cursor pagination with fixed 100-row pages, while preserving high-volume analytics capability for counterparties by introducing a dedicated processing path capped at 5000 records.

## Why This Change Is Needed
Wallet tables are UI-paginated and should not prefetch full 24h or 7d windows. The current behavior increases latency, memory use, and provider calls.

Counterparty aggregation currently depends on transfer history retrieval and must continue to work after table pagination changes. It also needs to incorporate swap activity so DEX interactions are reflected in counterparty rankings.

## Scope
In scope includes swap and transfer pagination contracts, service and route updates, wallet page data-loading changes, counterparty aggregation changes, and tests.

Out of scope includes visual redesign of existing tables/charts, identity-provider behavior changes, and long-term warehouse analytics.

## Current Constraints
The wallet table sections currently paginate in-memory after fetching a larger dataset.

Counterparty aggregation currently reads transfers only, which misses swap-only interactions.

If transfer and swap endpoints become strictly paginated, counterparty service cannot rely on a single call returning the full period dataset.

## Target Architecture
Transfer and swap table endpoints return one provider page per request with a fixed page size of 100.

The frontend fetches page 1 at load and fetches the next page only on explicit user pagination action.

Counterparty service uses a separate analytics fetch path, independent from table pagination behavior, and processes up to 5000 merged records.

Counterparty aggregation merges transfer and swap-derived interactions.

## Data Contract Changes
Introduce additive page metadata for swap and transfer responses.

```ts
type WalletPageInfo = {
  pageSize: 100;
  hasMore: boolean;
  nextCursor: string | null;
  source: "cache" | "provider" | "mixed";
};

type WalletTransfersResponse = {
  address: string;
  chain: SupportedChain;
  transfers: WalletTransfer[];
  pageInfo: WalletPageInfo;
};

type WalletSwapsResponse = {
  address: string;
  chain: SupportedChain;
  swaps: WalletSwap[];
  pageInfo: WalletPageInfo;
};
```

Keep existing `transfers` and `swaps` arrays for backward compatibility.

## Backend Work Plan

### Phase 1: Fetcher Chunk APIs
Add one-page fetchers for table usage.

`fetchHeliusSolanaTransfersChunk(address, { cursor, limit=100 })`

`fetchHeliusSolanaSwapChunk(address, { before, limit=100 })`

`fetchMoralisSolanaSwapChunk(address, { cursor, limit=100 })`

Each chunk fetcher returns `{ items, nextCursor, hasMore }` and does not loop across pages.

Keep current range-loop functions only for non-table analytics callers until migration is complete.

### Phase 2: Wallet Service Pagination Mode
Refactor wallet service methods to support true cursor pagination.

`getWalletTransfers(address, chain, { cursor, before })` returns one page with `pageInfo`.

`getWalletSwaps(address, chain, { cursor, before })` returns one page with `pageInfo`.

For table endpoints, ignore caller-provided arbitrary limits and force page size to 100.

Maintain compatibility aliasing where Helius history-style `before` and transfer-style `cursor` are accepted and normalized per endpoint.

### Phase 3: Dedicated Counterparty Activity Fetch Path
Introduce a helper dedicated to analytics workloads, separate from table pagination.

Example shape:

```ts
type CounterpartyActivityFetchOptions = {
  period: "24h" | "7d";
  maxRecords: number; // fixed to 5000
};

type CounterpartyActivityDataset = {
  transfers: WalletTransfer[];
  swaps: WalletSwap[];
  truncated: boolean;
};
```

Fetch newest transfer and swap pages iteratively until one of these stops:

Reached processing budget.

No more provider pages.

Reached period boundary.

Apply final processing cap of 5000 merged records by descending timestamp after dedupe.

### Phase 4: Counterparty Aggregation Upgrade
Update counterparty aggregation to combine transfer and swap signals.

Transfer-derived counterparty key remains from wallet side versus opposite owner.

Swap-derived counterparty key priority: `swap.exchange.address`, then `swap.pair.address`, then a deterministic fallback key.

Volume policy:

Transfer events use token price map when available.

Swap events prefer `totalValueUsd`, then `sold.valueUsd` or `bought.valueUsd`, then zero.

Transaction count dedupe key uses signature and counterparty key.

Token sets include transfer symbols and swap sold or bought symbols where available.

### Phase 5: Route Layer Updates
Update wallet routes to return paginated table responses.

`GET /api/wallets/transfers` and `GET /api/wallets/swap` return `pageInfo`.

Keep optional `cursor` and `before` query support, normalize internally.

Counterparty route remains period-based and should not depend on table page cursors.

### Phase 6: Cache Strategy Alignment
Use cache for page reads when possible, but preserve deterministic ordering and cursor progression.

Analytics fetch path can read from cache first and only fetch provider gaps needed for period completion up to the 5000 cap.

Mark metadata `source` as `cache`, `provider`, or `mixed` for observability.

## Frontend Work Plan

### Phase 1: Table Component Server Pagination Mode
Extend table component with controlled pagination mode.

Add callback for page changes so parent controls data loading.

For wallet swap and transfer tables, set `pageSize` to 100.

Disable client-side page slicing behavior for server-paginated mode.

### Phase 2: Wallet Page Data Loading
Wallet page stores per-section pagination state.

State includes current page index, loaded pages map, nextCursor, hasMore, and loading flags.

Initial load fetches first page only.

Next-page action fetches additional data only when needed.

Back-page action reads already cached page data locally.

### Phase 3: Wallet API Client Types
Update client wallet API types to include `pageInfo` in swap and transfer responses.

Preserve additive compatibility with existing response consumers.

## Testing Plan

### Fetcher Tests
Add chunk fetch tests for cursor semantics and single-page behavior.

Verify Helius transfer uses `cursor` and Helius swap uses `before`.

Verify Moralis swap uses `cursor` and supports missing fields.

### Service Tests
Verify page size fixed to 100 for table endpoints.

Verify `pageInfo.nextCursor` and `pageInfo.hasMore` propagation.

Verify analytics helper stops at 5000 merged records.

Verify counterparty aggregation merges transfer and swap sources without double-counting.

### Route Tests
Validate `/wallets/transfers` and `/wallets/swap` include `pageInfo`.

Validate cursor normalization and invalid input handling.

### Client Tests
Validate wallet table requests page 2 only on explicit next-page action.

Validate no background prefetch beyond current page.

Validate filters still operate on loaded data with clear behavior.

## Rollout Sequence
Implement backend additive contracts first.

Ship frontend pagination mode behind section-level switch.

Switch wallet swap and transfer sections to server pagination.

Enable counterparty merged transfer plus swap aggregation.

Remove obsolete time-window table fetch logic after verification.

## Acceptance Criteria
Wallet swap and transfer table endpoints return at most 100 rows per request.

Additional pages load only after user clicks next.

Counterparty service processes transfer plus swap activity and respects 5000-record processing cap.

Counterparty ranking output remains stable and deterministic.

No regressions in identity enrichment and wallet counterparties response shape.

## Risks And Mitigations
Risk: mixing table pagination with analytics retrieval can accidentally truncate counterparty data.

Mitigation: enforce separate analytics fetch helper and test it independently.

Risk: swap source variability may cause missing exchange or pair identifiers.

Mitigation: deterministic fallback keys and source labels with safe defaults.

Risk: cursor mismatch across providers can break pagination.

Mitigation: provider-specific cursor adapters with explicit tests per endpoint contract.
