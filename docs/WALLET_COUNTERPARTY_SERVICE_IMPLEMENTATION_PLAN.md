# Wallet Counterparty Service Implementation Plan

## Goal
Build a production counterparty service that returns, for a selected wallet, the top counterparties interacted with in a bounded recent window, and wire both wallet table and wallet chart client flows to use that service.

This plan targets:
- Counterparty table data for the wallet page
- Counterparty ranking chart data by transaction count and volume
- DB-first cache usage with provider fallback
- Strict max window of 7 days

## Scope
- In scope:
  - Server service for counterparty aggregation and ranking
  - Wallet route endpoint wiring
  - Optional chart-route compatibility wiring (for existing chart consumers)
  - Client wallet API and wallet page integration
  - Counterparty chart integration on wallet page
  - Service and route tests
- Out of scope:
  - New visual redesign of table/chart components
  - Historical windows beyond 7 days
  - Persistent counterparty materialized cache table in first pass

## Functional Requirements
1. Input is current wallet address and chain, with a bounded period not exceeding 7 days.
2. Response includes table rows where each row contains:
   - counterparty address
   - counterparty identity (if available)
   - unique token count
   - token list
   - total trading volume with that counterparty
   - transaction count
3. Response also includes ranking datasets for charting by:
   - transaction count
   - total volume
4. Data source must use cached or freshly fetched wallet transaction data.
5. API and client wiring must replace current placeholder wallet counterparties data flow.

## Current Findings
1. The chart route [server/src/routes/charts/counterparties.route.ts](server/src/routes/charts/counterparties.route.ts) currently returns mock data.
2. Wallet page counterparties table in [client/src/pages/wallet/index.tsx](client/src/pages/wallet/index.tsx) is currently placeholder and not wired to real counterparty data.
3. Wallet page top counterparties section currently renders [client/src/components/charts/TransactionDistribution/TransactionDistribution.tsx](client/src/components/charts/TransactionDistribution/TransactionDistribution.tsx), not a counterparty ranking dataset.
4. Existing wallet services already provide DB-first fetch paths and 24h/7d retrieval behavior for transactions/transfers/swaps in [server/src/services/wallet/walletData.service.ts](server/src/services/wallet/walletData.service.ts).
5. Identity services already support single and batch identity lookups with cache in [server/src/services/wallet/walletIdentity.service.ts](server/src/services/wallet/walletIdentity.service.ts).

## Target API Contract

### Endpoint
- Primary endpoint: GET /api/wallets/counterparties

### Query params
- address: string, required
- chain: string, optional, default solana
- period: string, optional, allowed 24h or 7d, default 7d
- limit: number, optional, default 20, max 100
- includeTokens: boolean, optional, default true

### Response shape
- counterparties: CounterpartyRow[]
- rankings:
  - byTransactionCount: CounterpartyRankingItem[]
  - byVolume: CounterpartyRankingItem[]
- metadata:
  - period: 24h or 7d
  - chain: string
  - source: cache, provider, or mixed
  - totals: { counterparties, transactions, volume }

### CounterpartyRow
- address: string
- identity:
  - status: known, unknown, unavailable
  - name: string or null
  - category: string or null
  - type: string or null
- uniqueTokenCount: number
- tokens: string[]
- transactionCount: number
- totalVolumeUsd: number

### CounterpartyRankingItem
- address: string
- label: string (identity name fallback to shortened address)
- transactionCount: number
- totalVolumeUsd: number

## Service Design

### New service file
- Add [server/src/services/wallet/counterparties.service.ts](server/src/services/wallet/counterparties.service.ts)

### Core responsibilities
1. Normalize and enforce period bounds:
   - Accept 24h or 7d only
   - Normalize invalid values to 7d
2. Build counterparty aggregates from wallet activity:
   - Prefer wallet transfer records for counterparty and token relationship extraction
   - Use transaction-level pricing where available for USD volume
   - Fallback to 0 USD when price unavailable (do not fail request)
3. Enrich counterparties via identity batch lookup:
   - Collect unique counterparty addresses
   - Call getWalletIdentityBatch once per request
   - Map responses by address
4. Build ranking outputs:
   - Sort by transactionCount desc
   - Sort by totalVolumeUsd desc
   - Apply limit
5. Return deterministic output and metadata.

### Data sourcing strategy
1. Retrieve wallet activity via existing DB-first paths in wallet data service helpers.
2. Restrict processing to period window in-memory even if source returns wider set.
3. For Solana:
   - Use transfer-oriented records for counterparty and token details
   - Use available token pricing enrichment for USD volume when possible
4. For EVM:
   - Use transaction history fallback until transfer-level parity exists
   - Keep response shape identical

## Route Wiring Plan

### Wallet route additions
1. In [server/src/routes/wallets.route.ts](server/src/routes/wallets.route.ts), add:
   - import for getWalletCounterparties
   - query schema for period, limit, includeTokens
   - GET /counterparties handler
2. Handler behavior:
   - Validate address and parse chain
   - Normalize period to 24h or 7d
   - Clamp limit to max 100
   - Return service response
   - Map errors to 500 with stable error payload

### Chart route compatibility
To avoid breaking existing chart consumers, choose one of the following:
1. Preferred: update [server/src/routes/charts/counterparties.route.ts](server/src/routes/charts/counterparties.route.ts) to call the new wallet counterparty service when a wallet is provided.
2. Transitional fallback: keep mock behavior only when no wallet context exists.

This allows dashboard chart code to migrate incrementally while wallet page uses the new wallet endpoint immediately.

## Client Wiring Plan

### Wallet API service updates
1. Add fetchWalletCounterparties in [client/src/services/wallet/walletApi.ts](client/src/services/wallet/walletApi.ts).
2. Parameters:
   - address
   - chain
   - period
   - limit
   - includeTokens
3. Add alias getCounterparties in walletApi export object.

### Wallet page integration
1. In [client/src/pages/wallet/index.tsx](client/src/pages/wallet/index.tsx), replace placeholder counterparties table data with API-backed data.
2. Table columns should be:
   - Counterparty address
   - Identity
   - Unique tokens traded
   - Token list
   - Total volume
   - Transaction count
3. Wire sort/filter config for volume and count numeric fields.
4. Keep pagination and loading behavior consistent with current table sections.

### Counterparty chart integration
1. Replace top counterparties section on wallet page from TransactionDistribution to counterparty ranking chart component.
2. Preferred option:
   - Reuse [client/src/components/charts/CounterpartyActivity/CounterpartyActivity.tsx](client/src/components/charts/CounterpartyActivity/CounterpartyActivity.tsx)
   - Add wallet-aware query support by passing wallet address through query contract
3. Ensure ranking view supports both dimensions:
   - by transaction count
   - by volume

## Type Contracts and DTO Updates

### Server DTOs
1. Add counterparty response interfaces in [server/src/services/wallet/dtos/walletDataObjects.ts](server/src/services/wallet/dtos/walletDataObjects.ts):
   - WalletCounterpartyRow
   - WalletCounterpartyRankingItem
   - WalletCounterpartiesResponse
2. Reuse existing wallet identity normalized shape for row identity field.

### Client types
1. Add matching types in client wallet types (or shared chart types if chart route consumes same shape).
2. Avoid overloading existing chart counterparties type if wallet shape is richer.

## Validation and Guardrails
1. Enforce period upper bound of 7 days in route and service.
2. Enforce max limit of 100 rows.
3. Never fail the full response because identity provider is unavailable:
   - return identity status unavailable for affected rows
4. Ensure self-transfers do not create fake counterparties.
5. Deduplicate transaction counts by signature hash (for multi-leg transfers in same tx).

## Testing Plan

### Service tests
- Add [server/tests/wallet/walletData.counterparties.test.ts](server/tests/wallet/walletData.counterparties.test.ts)
- Cases:
  1. Aggregates counterparties correctly in 7d window
  2. Deduplicates transaction count by signature
  3. Computes unique token count and token list
  4. Sorts rankings by count and volume correctly
  5. Uses identity batch enrichment and maps known/unknown/unavailable states
  6. Handles missing price/volume gracefully
  7. Excludes records outside 7d period

### Route tests
- Extend [server/tests/routes/wallets.route.test.ts](server/tests/routes/wallets.route.test.ts)
- Cases:
  1. GET /counterparties returns 200 and expected payload
  2. Missing address returns 400
  3. Invalid period is normalized to 7d
  4. Limit is clamped to max

### Client integration checks
1. Wallet page counterparties tab renders API data rows.
2. Top counterparties chart renders ranking data from the new response.
3. Error states show retry behavior without breaking the whole wallet page.

## Rollout Phases

### Phase 1: Contract and server service
1. Add DTOs and service implementation.
2. Add service tests.

### Phase 2: Route wiring
1. Add /api/wallets/counterparties route.
2. Add/adjust charts counterparties route compatibility.
3. Add route tests.

### Phase 3: Client wiring
1. Add wallet API function.
2. Replace wallet page table placeholder data.
3. Wire top counterparties chart to ranking data.

### Phase 4: Validation and hardening
1. Verify period guardrails and limit clamps.
2. Verify identity failure fallback.
3. Verify ranking determinism for equal values (secondary sort by address).

## Acceptance Criteria
1. Wallet counterparties table is populated from real backend counterparty service data.
2. Each row includes address, identity, unique token count, token list, total volume, and transaction count.
3. Counterparty ranking chart supports both transaction count and volume ranking from the same service response.
4. Period is strictly bounded to 7 days maximum.
5. Service uses existing cached-or-fetch wallet activity flows.
6. Tests cover aggregation correctness, route validation, and identity fallback behavior.

## Open Decisions
1. Keep /api/charts/counterparties response shape backward compatible, or fully migrate chart consumers to /api/wallets/counterparties.
2. Define exact volume policy for records without reliable USD pricing:
   - Option A: treat as 0 USD
   - Option B: use latest token price estimate
   - Option C: return nullable and exclude from volume ranking
3. Decide whether to include both token symbols and token addresses in row token list for UI clarity.