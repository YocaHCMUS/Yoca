# Wallet Service Refactor Plan

## Goal
Refactor the wallet service into cohesive modules, centralize data contracts and constants, and update function signatures to use already defined typed DTOs instead of inline anonymous option objects.

## Scope
- In scope:
  - server/src/services/wallet/walletData.service.ts
  - server/src/services/wallet/dtos/walletDataObjects.ts
  - server/src/services/wallet/fetchers/walletDataFetcher.service.ts
  - server/src/services/wallet/db/walletDataRetriever.ts
  - server/src/services/wallet/db/walletDataCacher.ts
  - server/src/routes/wallets.route.ts
  - server/src/routes/charts/balance.route.ts
  - server/src/services/charts/pnlChart.service.ts
  - server/src/services/wallet/counterparties.service.ts
- Out of scope:
  - UI redesign work
  - Provider-level API redesign

## Current State Findings

1. Monolithic service structure
- walletData.service.ts currently mixes overview, portfolio, transactions, swaps, transfers, exchange aggregation, chart chunking, token history, enrichment, and utility helpers.

2. Mixed constants and domain logic
- Provider policy defaults, SOL aliases, chart limits, and cache tuning constants live in the same file as runtime business logic.

3. Signature inconsistency
- Public functions use repeated inline options objects instead of shared DTO types.
- This reduces discoverability and makes call-site changes harder to manage.

4. Type placement drift
- Some reusable response and chunk types are exported from walletData.service.ts rather than from dtos/walletDataObjects.ts.

5. Utility duplication risk
- Timestamp parsing, numeric normalization, and range/chunk calculations are spread across layers.

## Refactor Principles

1. Keep public API backward compatible first.
2. Extract by responsibility, not by arbitrary line count.
3. Move reusable contracts into DTO files.
4. Keep provider-specific logic in fetcher/provider modules.
5. Keep the facade file thin and explicit.

## Target Module Layout

Create or reshape wallet service modules as follows:

- server/src/services/wallet/walletData.service.ts
  - Thin facade: exports and high-level orchestration only

- server/src/services/wallet/walletOverview.service.ts
  - Overview cache read path, holdings snapshot, activity snapshot, response assembly

- server/src/services/wallet/walletPortfolio.service.ts
  - Portfolio provider selection, shadow mode logging, metadata enrichment integration

- server/src/services/wallet/walletHistory.service.ts
  - Helius transaction-range retrieval, cache-range merge behavior

- server/src/services/wallet/walletTransfersSwaps.service.ts
  - Transfers/swaps retrieval paths, cursor and range handling, provider fallback

- server/src/services/wallet/walletExchangeAggregation.service.ts
  - Exchange bucket resolution and aggregation

- server/src/services/wallet/walletCharts.service.ts
  - Balance history chunking and cumulative PnL chunking

- server/src/services/wallet/walletTokenBalance.service.ts
  - Token-level balance history and token chunk slicing

- server/src/services/wallet/walletEnrichment.service.ts
  - Token metadata/price enrichment for transactions, transfers, swaps

- server/src/services/wallet/wallet.constants.ts
  - Domain constants grouped by concern

- server/src/services/wallet/walletTime.utils.ts
  - Time/range/chunk window helpers

- server/src/services/wallet/walletNormalization.utils.ts
  - Numeric and string normalization helpers

## Data Type Consolidation Plan

Primary objective: use and extend existing DTO definitions in dtos/walletDataObjects.ts.

### Add typed request option DTOs

Add these shared types to server/src/services/wallet/dtos/walletDataObjects.ts:

- WalletCursorOptions
  - limit?: number
  - cursor?: string
  - before?: string

- WalletRangeOptions
  - from?: WalletTimePeriod
  - fromSec?: number
  - toSec?: number

- WalletTimePeriod
  - "24H" | "7D" | "30D" | "60D" | "90D" | "1Y" | "All"

- WalletOverviewQueryOptions
  - timePeriod?: WalletOverviewTimePeriod

- WalletHistoryQueryOptions
  - extends WalletCursorOptions and WalletRangeOptions

- WalletTransfersQueryOptions
  - extends WalletCursorOptions
  - from?: WalletTimePeriod

- WalletSwapsQueryOptions
  - extends WalletCursorOptions
  - from?: WalletTimePeriod

- WalletBalanceHistoryChunkOptions
  - timePeriod?: WalletTimePeriod
  - requestedFromSec?: number
  - requestedToSec?: number
  - chunkToSec?: number
  - limit?: number
  - heliusCursor?: string | null

- WalletPnLChunkOptions
  - timePeriod?: WalletTimePeriod
  - requestedFromSec?: number
  - requestedToSec?: number
  - chunkToSec?: number
  - limit?: number
  - aggregation?: PnLAggregation
  - heliusCursor?: string | null

- WalletTokenBalanceChunkOptions
  - timePeriod?: WalletTimePeriod
  - requestedFromSec?: number
  - requestedToSec?: number
  - chunkToSec?: number
  - limit?: number

### Move exported chart and PnL types to DTOs

Move and co-locate these currently service-exported types in dtos/walletDataObjects.ts:

- BalanceDataPoint
- PnLDataPoint
- WalletCumulativePnLResult
- ChartPageInfo
- ChartChunkInfo
- ChartChunkState
- TokenBalanceSeriesResult
- PnLAggregation
- ChartAggregation

## Function Signature Refactor Plan

Replace inline options with shared DTO types while preserving runtime behavior.

1. getWalletOverview
- Current:
  - getWalletOverview(address, options?: { timePeriod?: WalletOverviewTimePeriod })
- Target:
  - getWalletOverview(address, options?: WalletOverviewQueryOptions)

2. getWalletTransactionHelius
- Current:
  - getWalletTransactionHelius(address, options?: { limit?: number; cursor?: string; before?: string; from?: WalletTimePeriod; fromSec?: number; toSec?: number })
- Target:
  - getWalletTransactionHelius(address, options?: WalletHistoryQueryOptions)

3. getWalletTransfers
- Current:
  - getWalletTransfers(address, options?: { limit?: number; cursor?: string; before?: string; from?: WalletTimePeriod })
- Target:
  - getWalletTransfers(address, options?: WalletTransfersQueryOptions)

4. getWalletSwaps
- Current:
  - getWalletSwaps(address, options?: { limit?: number; cursor?: string; before?: string; from?: WalletTimePeriod })
- Target:
  - getWalletSwaps(address, options?: WalletSwapsQueryOptions)

5. getWalletBalanceHistoryChunk
- Current:
  - options inline object
- Target:
  - options: WalletBalanceHistoryChunkOptions

6. getCumulativePnLChunk
- Current:
  - options inline object
- Target:
  - options: WalletPnLChunkOptions

7. getWalletTokenBalanceHistoryChunk
- Current:
  - options inline object
- Target:
  - options: WalletTokenBalanceChunkOptions

8. getWalletExchangeCounts
- Keep WalletExchangeCountsOptions but move the type declaration to dtos/walletDataObjects.ts.

## Constants Reorganization Plan

Move constants out of walletData.service.ts into wallet.constants.ts with explicit groups.

- Address constants
  - SOL_MINT
  - SOL_SYSTEM_PROGRAM_ADDRESS
  - SOL_NATIVE_ALIAS_MINT

- Time constants
  - DAY_MS
  - DAY_SEC

- Defaults and limits
  - WALLET_TABLE_PAGE_SIZE
  - DEFAULT_EXCHANGE_LIMIT
  - MAX_EXCHANGE_LIMIT
  - DEFAULT_HELIUS_HISTORY_CHUNK_PAGES
  - MAX_HELIUS_HISTORY_CHUNK_PAGES
  - DEFAULT_HELIUS_HISTORY_CHUNK_TRANSACTIONS
  - MAX_HELIUS_HISTORY_CHUNK_TRANSACTIONS
  - DEFAULT_CHART_POINTS_PER_CHUNK
  - MAX_CHART_POINTS_PER_CHUNK

- Snapshot cache tuning
  - TOKEN_BALANCE_SNAPSHOT_CONCURRENCY
  - TOKEN_BALANCE_SNAPSHOT_CACHE_RECENT_TTL_MS
  - TOKEN_BALANCE_SNAPSHOT_CACHE_HISTORICAL_TTL_MS

- Provider policy defaults
  - DEFAULT_SWAP_PROVIDER_SOURCE
  - DEFAULT_WALLET_PROVIDER_POLICY

## Implementation Phases

### Phase 1: Contract-first preparation
1. Add new option DTOs and chunk types to dtos/walletDataObjects.ts.
2. Extend WalletTimePeriod to include 24H and use this type in all from/query options that currently hard-code period unions.
3. Add backwards-compatible period normalization so legacy lower-case inputs (for example 24h, 7d) map to WalletTimePeriod values.
4. Update imports in service and route files to use DTO exports.
5. No behavior changes in this phase.

### Phase 2: Extract constants and core utils
1. Create wallet.constants.ts.
2. Create walletTime.utils.ts and walletNormalization.utils.ts.
3. Replace in-file helper usage with imports.

### Phase 3: Extract service clusters
1. Extract overview and portfolio flows first.
2. Extract transfers/swaps and exchange aggregation.
3. Extract chart and token balance flows.
4. Keep walletData.service.ts as facade and re-export compatibility layer.

### Phase 4: Signature cleanup at call sites
1. Update route and chart services to import the new option DTOs.
2. Replace ad hoc option object typings with named types.
3. Update period parsing/normalization helpers so transfers, swaps, and transaction history functions accept WalletTimePeriod (including 24H) consistently.
4. Confirm no external endpoint contract changes.

### Phase 5: Hardening and tests
1. Add unit tests per extracted module.
2. Add integration tests for wallets and chart routes.
3. Validate chunk pagination and cursor behavior.

## Validation Checklist

1. Type safety
- All previously inline options are replaced with shared DTO types.

2. API compatibility
- Existing JSON response shapes are unchanged.

3. Behavior parity
- Cache hit/miss paths and provider fallback behavior are preserved.

4. Route compatibility
- wallets.route.ts and chart routes compile and pass tests with updated imports.

5. Performance guardrails
- Chunk limits and range handling continue to prevent unbounded fetch behavior.

## Risk and Mitigation

1. Risk: accidental behavior changes during extraction
- Mitigation: perform extraction in small phases with behavior-preserving wrappers.

2. Risk: circular imports between facade and extracted modules
- Mitigation: enforce one-way dependencies (facade imports modules; modules do not import facade).

3. Risk: DTO churn affecting many call sites
- Mitigation: add DTO aliases and deprecate gradually where needed.

## Deliverables

1. New wallet service module structure with thin facade.
2. Centralized constants and reusable utility helpers.
3. DTO-based function signatures for wallet service public APIs.
4. Updated route/service call sites using shared option types.
5. Added or updated unit and integration tests.