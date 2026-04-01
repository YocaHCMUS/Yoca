# Wallet Enrichment and Transfer Render Fix Plan

Date: 2026-04-01
Owner: Wallet backend + wallet frontend
Status: Drafted for implementation

## Scope

Update the wallet token enrichment flow to match current DTO shapes and runtime payload variants, with focus on non-SOL token enrichment reliability and removal of UI crash side effects.

Primary function in scope:
- server/src/services/wallet/walletEnrichment.service.ts

Side-effect issues to address in same track:
- Transfer table React child crash when object reaches scalar render path.
- BalanceChart prefetch path throwing unhandled rejection when balance endpoint fails.

## Context Snapshot

Observed symptoms:
- Non-SOL tokens are not consistently enriched for symbol, name, logoUri, priceUsd, and derived USD amounts.
- Runtime UI crash:
  - Objects are not valid as a React child (object keys: address, amount, symbol, name, logoUri, priceUsd, valueUsd).
- Follow-on rejection in BalanceChart prefetch:
  - Error fetching wallet balance history.

Key files reviewed:
- server/src/services/wallet/walletEnrichment.service.ts
- server/src/services/wallet/dtos/walletDataObjects.ts
- server/src/services/wallet/walletData.core.ts
- server/src/services/tokens/token-info.ts
- server/src/services/tokens/token-market-data.ts
- server/src/services/tokens/token-list.ts
- server/src/services/wallet/fetchers/walletProviderMappers.ts
- server/src/services/wallet/db/walletDataCacher.ts
- server/src/services/wallet/db/walletDataRetriever.ts
- server/src/services/wallet/walletTransfersSwaps.service.ts
- server/src/routes/charts/balance.route.ts
- client/src/pages/wallet/index.tsx
- client/src/components/tables/Table.tsx
- client/src/components/charts/BalanceChart/BalanceChart.tsx

## Execution Plan

## Phase 1: Contract Hardening and Guard Rails

### 1.1 Define runtime-safe scalar extraction utilities

Tasks:
- Add local helpers in wallet enrichment module (or shared wallet helper) for safe scalar extraction:
  - toOptionalString(value)
  - toOptionalFiniteNumber(value)
  - toTokenDisplaySymbol(value, fallback)
- Enforce scalar writes for fields expected by client table rendering:
  - transfer.tokenSymbol
  - transfer.tokenName
  - transfer.tokenLogoUri
  - swap.bought.symbol/name/logoUri
  - swap.sold.symbol/name/logoUri

Acceptance criteria:
- No object values are assigned into scalar token display fields in enrichment path.
- Enrichment handles malformed provider/cache payload values without throw.

### 1.2 Add DTO-shape assertions at enrichment entry

Tasks:
- Add lightweight type guards for transaction, transfer, swap records.
- For swap legs, guard bought/sold objects before reading address/symbol.

Acceptance criteria:
- Invalid entries are skipped with debug counters, not crashes.

## Phase 2: Non-SOL Enrichment Reliability Refactor

### 2.1 Refactor candidate extraction by shape

Tasks:
- Split candidate extraction into explicit paths:
  - collectTransactionCandidateAddress
  - collectTransferCandidateAddress
  - collectSwapCandidateAddresses
- Keep SOL alias normalization behavior, but ensure non-SOL addresses are normalized consistently.

Acceptance criteria:
- Candidate set includes all valid non-SOL addresses present in transaction/transfer/swap records.
- Invalid/placeholder addresses are excluded.

### 2.2 Normalize token lookup keys consistently

Tasks:
- Ensure all keys pass through normalizePortfolioLookupAddress then normalizePortfolioAddressKey before:
  - metadata map set/get
  - market data map set/get
  - enrichment target lookups
- Verify key equality for mixed-case addresses and known aliases.

Acceptance criteria:
- Case differences do not break metadata or price map lookup.
- SOL aliases still resolve to SOL_MINT behavior.

### 2.3 Separate metadata fill and price fill stages

Tasks:
- Stage A: fill symbol/name/logoUri where missing/placeholder.
- Stage B: fill priceUsd/valueUsd/amountUsd/totalUsd where missing and computable.
- Do not block Stage A when Stage B misses, and vice versa.

Acceptance criteria:
- Metadata enrichment succeeds even when market data is missing.
- Price enrichment succeeds even when metadata is missing.

### 2.4 Add enrichment observability counters

Tasks:
- Add summary counters by category:
  - candidatesCollected
  - invalidCandidatesDropped
  - tokenMetaHits/tokenMetaMisses
  - marketDataHits/marketDataMisses
  - transferFieldFills/swapFieldFills/transactionFieldFills
- Keep logs concise and structured.

Acceptance criteria:
- Logs provide enough information to verify non-SOL improvements in production traces.

## Phase 3: Transfer Table Crash Prevention

### 3.1 Harden transfer row mapping in wallet page

Tasks:
- In client/src/pages/wallet/index.tsx transferData mapping, coerce token column to string-safe value.
- Add helper to derive display symbol from any runtime value:
  - string -> trimmed string
  - object with symbol -> symbol string
  - fallback -> Unknown

Acceptance criteria:
- Transfer table token column never contains object values.

### 3.2 Harden generic table fallback renderer

Tasks:
- In client/src/components/tables/Table.tsx default cell path, prevent raw object child rendering.
- If value is non-primitive, render String(value) or safe JSON snippet.

Acceptance criteria:
- No React child error from table fallback path.

## Phase 4: BalanceChart Rejection Containment

### 4.1 Catch prefetch failures locally

Tasks:
- Wrap prefetchTokenSeries loop in try/catch in client/src/components/charts/BalanceChart/BalanceChart.tsx.
- Fail soft by skipping failed chunk and continuing with available series.
- Avoid throwing from useEffect async workflow.

Acceptance criteria:
- Endpoint failure does not produce unhandled rejection in client.
- Main chart still renders available data or empty state.

### 4.2 Return serializable chart errors from server route

Tasks:
- In server/src/routes/charts/balance.route.ts, avoid returning raw error object in JSON details.
- Return safe payload fields (message, name, code when available).

Acceptance criteria:
- Error responses are always serializable and predictable for client parser.

## Phase 5: Persistence and Cache Alignment (Recommended)

### 5.1 Persist transfer metadata fields in cache tables when available

Tasks:
- Extend transfer cache write/read mapping to include tokenName and tokenLogoUri if schema already supports it.
- If schema lacks fields, create migration in separate PR and stage rollout.

Acceptance criteria:
- Cached transfer responses preserve metadata and reduce repeated runtime enrichment dependency.

## Test Plan

## Server unit tests

### A. Non-SOL transfer enrichment

Given:
- transfer tokenAddress valid non-SOL mint
- token meta returns symbol/name/image
- market data returns finite priceUsd

Expect:
- tokenSymbol/tokenName/tokenLogoUri filled when missing
- priceUsd and amountUsd filled when missing

### B. Non-SOL swap leg enrichment

Given:
- swap bought and sold with non-SOL mints
- metadata and market data available for one or both legs

Expect:
- per-leg symbol/name/logoUri fill follows missing-only behavior
- per-leg priceUsd/valueUsd computed when possible
- totalValueUsd backfilled from available leg values when missing

### C. Malformed payload tolerance

Given:
- transfer tokenSymbol is object
- swap leg fields include unexpected types

Expect:
- no throw
- scalar-safe coercions applied

## Client tests

### D. Transfer table render safety

Given:
- transfer token field is object in incoming data

Expect:
- wallet page renders transfer table without React child exception
- token cell displays fallback text

### E. BalanceChart prefetch error containment

Given:
- fetchBalanceTrend fails for one prefetch request

Expect:
- no unhandled rejection
- chart remains mounted and interactive

## Integration checks

### F. Wallet transfers route shape

Expect each transfer item fields are scalar-safe:
- tokenSymbol: string
- tokenName: string or undefined
- tokenLogoUri: string or undefined

### G. Wallet swaps route shape

Expect swap bought/sold fields are scalar-safe and numeric where expected.

## Delivery Sequence

1. Implement Phase 1 + Phase 2 in server enrichment.
2. Implement Phase 3 in client table and wallet page.
3. Implement Phase 4 in chart client and server error response.
4. Add tests for all affected modules.
5. Run full wallet-related test suites and manual smoke test:
   - wallet transfer tab
   - wallet swap tab
   - balance chart with token prefetch

## Rollback Strategy

- Keep enrichment refactor within one module and guarded by conservative fallback behavior.
- If regressions detected, revert enrichment write paths while retaining rendering guard fixes (Phase 3) to keep UI stable.

## Definition of Done

- Non-SOL tokens are enriched reliably for transfer and swap flows.
- No React child object crash from wallet tables.
- No unhandled rejection from BalanceChart prefetch path.
- Added tests pass and regression checks are green.
