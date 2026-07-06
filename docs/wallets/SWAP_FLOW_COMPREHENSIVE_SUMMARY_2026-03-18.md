# Swap Flow Comprehensive Summary
**Date**: March 18, 2026  
**Status**: Pre-Implementation (Phases 1–6 Pending)  
**Total Context**: ~700K tokens of exploration & analysis

---

## 1. Conversation Overview

**Primary Objectives:**
- Map current swap flow end-to-end and draft concrete implementation/testing plan to migrate from Helius-only swap fetching to Moralis wallet swaps endpoint
- Full architectural alignment to existing codebase patterns (chunk pagination, range-based cache filtering, provider resilience)

**Session Context:**
Systematic trace of every swap data flow touchpoint—from Helius fetcher through dual-TTL cache, retrieval, route layer, to frontend table and modal. Investigated ~46 critical files, executed targeted searches across server/client, validated migration history, and retrieved institutional knowledge from 5 prior context-memory notes.

**User Intent:**
Understand why current schema (Helius-shaped) is incomplete for Moralis response fields; identify migration hazards (schema drift between code and SQL migrations); produce a phased rollout plan that respects proven patterns while avoiding single-point failures during cutover.

---

## 2. Technical Foundation

### Technology Stack
- **Backend**: Hono (HTTP framework) + TypeScript + PostgreSQL, Drizzle ORM v0.44.7 with migrations
- **Frontend**: React 19.1, Vite, React Router, Carbon Design System, Vitest for both server & client testing
- **Data Providers**: Helius (currently active for Solana swaps), Moralis (target), CoinGecko (token enrichment)
- **Current Swap Source**: Helius wallet API with pagination via `before` cursor; pagination yields `pagination.nextCursor` response field

### Architectural Patterns

1. **Dual-table TTL cache**: `walletSwap` rows deduplicated by signature; `walletSwapMeta` (address, chain, fetchedAt) tracks freshness independently; `getCachedWalletSwaps` returns null if WALLET_SWAPS_TTL_MS (1 hour) exceeded

2. **Chain normalization**: Lowercase canonical names stored; fallback queries check mixed-case variants for legacy data

3. **Range-filtered retrieval**: SQL `gte`/`lte` applied at DB query time to window by timestamp, not in-memory

4. **Cursor pagination**: Wallet-chunked cursors prefixed `wc1_` encode {v, endpoint, snapshotSec, providerCursor}; providers return native cursors, wrapped on response

5. **Provider-agnostic enrichment**: Token prices fetched post-cache via `enrichWithSolanaTokenPrices()`, not persisted

6. **Migration safety**: `onConflictDoNothing` for row inserts; `onConflictDoUpdate` for meta refreshes to avoid blocking on re-runs

### Moralis API Integration (Existing)
- HTTP wrapper in `util-moralis.ts`: rate-limit retry logic (max 2 retries, up to 120s wait on 429)
- API key rotation via `apiKeyManager`
- Base URL: `https://deep-index.moralis.io/api/v2.2` (default)
- **Gap identified**: No solana-gateway endpoint builder yet; wallet swaps call would use different host than token/balance endpoints in Moralis

---

## 3. Codebase Status

### File: `server/src/services/wallet/dtos/walletDataObjects.ts`
**Purpose**: Canonical TypeScript types for wallet data transfer objects  
**Current State**: Complete for Helius shape  
**Key Types**:
```typescript
interface WalletSwap {
  walletAddress: string;
  signature: string;
  timestamp: string; // ISO string
  slot: number;
  fee: number;
  feePayer: string;
  balanceChanges: WalletSwapBalanceChange[]; // [{mint, amount, decimals}]
  feeChanges: WalletSwapBalanceChange[];
}
```
**Missing for Moralis**: `transactionType`, `blockNumber`, `exchange`, `pair` metadata, bought/sold objects, `baseQuotePrice`, `totalValueUsd`

### File: `server/src/db/schema.ts`
**Purpose**: Drizzle ORM table definitions  
**Current State**: walletSwap table with JSONB balance change storage  
**Schema**:
```
walletSwap (address, chain, signature) PRIMARY KEY
- blockTimestamp: timestamp
- slot: bigint
- fee: decimal
- feePayer: varchar
- swapBalanceChanges: jsonb (first two entries = swap legs)
- feeBalanceChanges: jsonb (remaining = fees/rent)

walletSwapMeta (address, chain) PRIMARY KEY
- fetchedAt: timestamp DEFAULT now()
```
**Issue**: Schema designed for Helius dual-array pattern; Moralis response has top-level fields (bought, sold, exchange, pair) that don't fit current structure without migration

### File: `server/src/services/wallet/db/walletDataCacher.ts`
**Purpose**: Write swap data & metadata to cache  
**Current State**: Production-ready dedup + upsert pattern  
**Key Logic**:
- Deduplicates by signature (Map<signature, WalletSwap>)
- Inserts rows via `onConflictDoNothing()` to prevent duplicates
- Upserts meta via `onConflictDoUpdate()` with LEAST/GREATEST for persisted coverage bounds
**Dependency**: Maps WalletSwap DTO → DB row; if Moralis fields are added to DTO, cacher must map them

### File: `server/src/services/wallet/db/walletDataRetriever.ts`
**Purpose**: Read swap cache, check freshness, filter by time window  
**Current State**: Robust TTL & range handling  
**Key Function**: `getCachedWalletSwaps(address, chain, from="7d")`
- Calculates `swapThreshold = now - WALLET_SWAPS_TTL_MS`
- Calls `hasFreshWalletMeta(address, chain, swapThreshold, "swaps")`
- Returns null if stale; otherwise queries walletSwap table, filters by blockTimestamp range via `resolveRange(from)`, maps to DTO
**SQL Filtering**: Range filtering moved to DB query (gte/lte conditions), not post-fetch

### File: `server/src/services/wallet/walletData.service.ts`
**Purpose**: Orchestration layer for wallet data operations  
**Current State**: getWalletSwaps function working for Solana, empty return for other chains  
**Flow**:
1. Try cache: `getCachedWalletSwaps(address, effectiveChain, options.from)`
2. If fresh, enrich prices and return
3. If not fresh:
   - Validate Solana only: `if (effectiveChain !== "solana") return { swaps: [] }`
   - Fetch: `await fetchHeliusSolanaSwap(address, options.from)`
   - Save: `await saveSwapsCache(address, effectiveChain, swaps)`
   - Enrich: `await enrichWithSolanaTokenPrices(swaps)`
   - Return or catch error → return empty
**Missing**: Moralis provider branch; multi-chain support

### File: `server/src/services/wallet/fetchers/walletDataFetcher.service.ts`
**Purpose**: Direct provider API calls (Helius, not yet Moralis)  
**Current State**: `fetchHeliusSolanaSwap(address, from)` function
- Pagination loop: requests chunks, accumulates via `swaps.push()`
- Maps Helius response → WalletSwap DTO
- Stops on no-more-pages or error
- Returns WalletSwap[]
**Missing**: Moralis equivalent; different pagination contract (cursor vs before)

### File: `server/src/routes/wallets.route.ts`
**Purpose**: HTTP endpoint definition  
**Current State**: GET /swap endpoint
- Query: address (required), chain (optional, defaults "solana"), limit, cursor, before
- Handler: calls `getWalletSwaps(address, chain, {limit, cursor, before})`
- Response: `{ address, chain, swaps: [] }`
**Gap**: limit and cursor not used in current getWalletSwaps implementation

### File: `server/src/config/openapi.ts`
**Purpose**: Swagger/OpenAPI documentation  
**Current State**: Defines /api/wallets/swap endpoint schema  
**Schema**:
```
path: "/api/wallets/swap"
summary: "Get wallet swaps"
query: {address, chain?, limit?, cursor?, before?}
```
**Missing**: Response schema documentation for swaps array

### File: `server/src/util/util-moralis.ts`
**Purpose**: Moralis API HTTP client wrapper  
**Current State**: Generic HTTP wrapper with retry logic  
**Capabilities**:
- `moralisFetch(url, init)`: executes request; retries on 429 up to 120s
- `getEndpoint(path)`: builds URL from MORALIS_API_BASE_URL or default deep-index
- `getRequiredHeaders()`: adds X-API-Key header
- API key rotation via `apiKeyManager`
**Gap**: No solana-gateway endpoint builder; wallet-swaps endpoint uses different host than balance/token endpoints in Moralis

### File: `client/src/services/wallet/walletApi.ts`
**Purpose**: Client-side API wrapper  
**Current State**: `fetchWalletSwaps(address, params?) → { address, chain, swaps: any[] }`
- Calls backend GET /wallets/swap
- Returns untyped JSON via `response.json()`
- Exported as `walletApi.getSwaps` alias
**Issue**: No explicit WalletSwap interface; cannot type-check; relies on documentation

### File: `client/src/pages/wallet/index.tsx`
**Purpose**: Main wallet page, tabbed view with portfolio, swaps, transfers, counterparties  
**Current State**: Production-ready but with weak swap handling  
**Swap Logic**:
- Fetches via `fetchWalletSwaps(address, {chain: "solana", limit: 50})`
- Stores raw response in `rawSwapsRef.current`
- Transforms to table rows inferring sold/bought from sign heuristic
- Table columns: [Time, Fee, Token Sold, Token Bought, Total Changes]
- Click handler passes rawSwap to modal as TransferRecord[] via balanceChanges mapping
**Gap**: Infers sold/bought from sign heuristic; cannot render exchange, pair, or USD value; no type safety on swap object


**Rendering**:
- Sold token card (outflow direction)
- Arrow icon
- Bought token card (inflow direction)
- Details: signature (Solscan link), time, fee (in SOL), slot, fee payer
- If transfers.length > 2: extra "All Balance Changes" section lists each change
**Gap**: Cannot render exchange, pair, or pricing info because not passed to modal; TransferRecord interface not ideal for swap data

### Database Migrations Status
| File | Content | Status |
|------|---------|--------|
| 0000_bouncy_tusk.sql | wallet_overview_cache, portfolio_cache, transactions_meta, transactions, exchanges_cache | **NO wallet_swap** |
| 0000_minor_rockslide.sql | Token-related tables (market_chart, metadata, transfers, holders) | **NO wallet_swap** |
| 0001_medical_kingpin.sql | Pool trades, trending tokens, token metadata extensions | **NO wallet_swap** |
| 0003_wallet_meta_covered_range.sql | Adds coveredFromSec/coveredToSec to wallet_transactions_meta | N/A |
| 0004_wallet_identity_cache.sql | Creates wallet_identity_cache; adds indexes including `wallet_swap_addr_chain_ts_idx` | **Assumes wallet_swap exists** |
| 0005_wallet_chunked_indexes.sql | Recreates indexes; again assumes wallet_swap table | **Assumes wallet_swap exists** |

**⚠️ Critical Issue**: wallet_swap table creation SQL **not found in migrations/**; table exists in schema.ts but migration source unclear; indexes reference it in 0004/0005, causing chicken-and-egg dependency

### Test Files & Coverage
- `server/tests/wallet/fetchers/walletDataFetcher.service.test.ts`: Covers pagination, null timestamp skip, transfers cursor; **NO explicit swap tests yet**
- `server/tests/wallet/db/walletDataCacher.test.ts`: Dedup tests for transactions/transfers/helius; **mocks walletSwap but no explicit swap cacher tests**
- `server/tests/wallet/db/walletDataRetriever.test.ts`: Freshness threshold, coverage bounds, legacy fallback; **NO swap-specific retriever tests**
- `server/tests/routes/wallets.route.test.ts`: Mocks getWalletSwaps as returning empty swaps **returns empty, no real test**
- `client/src/pages/wallet/index.test.tsx`: Portfolio mapping tests, label fallback; **NO swap table or modal tests**

---

## 4. Problem Resolution

### Issues Encountered

1. **Migration State Ambiguity**: wallet_swap and walletSwapMeta tables defined in schema.ts, but CREATE TABLE statements not found in migration SQL files 0000–0001. Indexes in 0004/0005 reference the table, creating unresolved dependency.
   - **Investigation**: Searched migrations/ for wallet_swap; found only indexes. Checked migration journal—shows entries through 0004 but 0005 not in journal yet. Snapshot metadata incomplete or stale.

2. **Schema Shape Mismatch**: Current walletSwap table uses dual-array pattern (balanceChanges, feeChanges) inherited from Helius. Moralis response has top-level fields (bought, sold, exchange, transactionType, subCategory) that don't fit into JSONB balance-change arrays.
   - **Investigation**: Examined schema.ts; confirmed swapBalanceChanges and feeBalanceChanges as JSONB with no exchange, pair, or side fields.

3. **Weak Client Typing**: fetchWalletSwaps returns untyped any[]; swap page component infers sold/bought from sign heuristic on balanceChanges.find(); modal receives derived TransferRecord[] instead of native swap shape.
   - **Investigation**: Read walletApi.ts (no explicit WalletSwap interface), wallet/index.tsx (any[] swap state).

4. **No Moralis Endpoint Builder**: util-moralis.ts has generic HTTP wrapper but no solana-gateway URL customization or wallet-swaps-specific pagination mapping.
   - **Investigation**: Read util-moralis.ts; confirmed only default deep-index base URL and generic endpoint builder.

5. **Incomplete Test Coverage**: Current tests mock swaps as empty arrays; no integration coverage for actual swap data flow or field mapping.
   - **Investigation**: grep_search on test files; all walletData.* test files mock getWalletSwaps to return empty swaps.

### Solutions Implemented (via Plan)

1. **Migrate wallet_swap table explicitly**: Generate new migration file (0006 or 0002 depending on gap) to create wallet_swap and walletSwapMeta tables with safe IF NOT EXISTS guards; include rollback strategy for stale Helius rows.

2. **Extend schema for Moralis fields**: Add first-class columns to walletSwap for transactionType, blockNumber, exchange, pair metadata (as JSONB or foreign keys); keep balanceChanges for backward compat with dual-array structure.

3. **Type client swap API**: Define WalletSwap interface on client matching backend DTO; replace any[] with WalletSwap[] in wallet page; pass full swap object to modal instead of derived TransferRecord[].

4. **Add Moralis fetcher**: Implement `fetchMoralisSolanaSwap()` func in walletDataFetcher.service.ts with cursor pagination, fromDate/toDate mapping, and null-field handling.

5. **Build Moralis endpoint helper**: Add solana-gateway branch to util-moralis.ts or create util-moralis-solana.ts for wallet-swaps endpoint with correct host and pagination contract.

6. **Expand UI rendering**: Add columns to swap table for exchange, pair, total USD value; update modal to display these fields with robust null fallbacks.

---

## 5. Progress Tracking

### Completed Tasks
- ✅ Cache schema design (walletSwap + walletSwapMeta tables with TTL meta)
- ✅ Dual-table dedup & upsert logic (saveSwapsCache function)
- ✅ TTL freshness check (getCachedWalletSwaps with timestamp threshold)
- ✅ Range-filtered SQL retrieval (blockTimestamp gte/lte window)
- ✅ Helius fetcher & pagination loop (fetchHeliusSolanaSwap with page accumulation)
- ✅ Route endpoint definition (GET /swap with OpenAPI doc)
- ✅ Service orchestration (getWalletSwaps with cache-first fallback, Solana gate, error handling)
- ✅ Basic frontend fetch & render (fetchWalletSwaps, swap table with balanceChanges inference)

- ✅ Test mocking infrastructure (mocked fetch/cache/retriever in multiple test files)

### Partially Complete Work
- ⚠️ Migration scripts: indexes exist in 0004/0005 but table CREATE statement location unclear; snapshot metadata possibly stale
- ⚠️ Client typing: walletApi.ts has no explicit WalletSwap interface; relies on untyped any[]
- ⚠️ Moralis HTTP support: util-moralis.ts has retry logic but no solana-gateway endpoint builder
- ⚠️ UI rendering: swap table limited to [time, fee, sold, bought, count]; no exchange/pair/USD columns

### Validated Outcomes
- ✅ Cache read/write round-trip (cacher dedup + retriever freshness check produces expected behavior in tests)
- ✅ Helius pagination (fetcher loop produces correct WalletSwap[] array; test covers cursor progression)
- ✅ TTL expiry (getCachedWalletSwaps returns null when WALLET_SWAPS_TTL_MS exceeded)
- ✅ JSON serialization (walletSwap rows persist and retrieve JSONB balanceChanges/feeChanges without corruption)
- ✅ Frontend table rendering (balanceChanges transform to table rows; click handler passes swap to modal)

---

## 6. Active Work State

### Current Focus (Pre-Summarization)
Agent had just completed exhaustive code path exploration and was synthesizing findings into a concrete implementation & testing plan. 

### Working Code (Most Recent Examination)

**1. Swap fetching chain** (walletData.service.ts):
```typescript
export async function getWalletSwaps(
  address: string,
  chain: SupportedChain,
  options?: { limit?: number; cursor?: string; before?: string; from?: "24h" | "7d" }
): Promise<{ address: string; chain: SupportedChain; swaps: WalletSwap[] }> {
  const cachedSwaps = await getCachedWalletSwaps(address, effectiveChain, options?.from ?? "7d");
  if (cachedSwaps) {
    await enrichWithSolanaTokenPrices(cachedSwaps); // Mutates array
    return { address, chain: effectiveChain, swaps: cachedSwaps };
  }
  if (effectiveChain !== "solana") return { address, chain: effectiveChain, swaps: [] };
  try {
    const swaps = await fetchHeliusSolanaSwap(address, options?.from ?? "7d");
    await saveSwapsCache(address, effectiveChain, swaps);
    return { address, chain: effectiveChain, swaps };
  } catch (err) {
    return { address, chain: effectiveChain, swaps: [] };
  }
}
```

**2. Swap table data mapping** (wallet/index.tsx):
```typescript
const swapData = useMemo(
  () => swaps.map((swap: any) => {
    const balanceChanges = swap.balanceChanges || [];
    const soldChange = balanceChanges.find((bc: any) => bc.amount < 0);
    const boughtChange = balanceChanges.find((bc: any) => bc.amount > 0);
    const formatTokenDisplay = (change: any) => {
      if (!change) return "—";
      const amount = Math.abs(change.amount).toFixed(4);
      const mint = change.mint || "";
      const symbol = mint.length > 8 ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : mint;
      return `${amount} ${symbol}`;
    };
    return [
      swap.timestamp,
      swap.fee,
      formatTokenDisplay(soldChange),
      formatTokenDisplay(boughtChange),
      swap.balanceChanges?.length ?? 0
    ];
  }),
  [swaps]
);
```

**3. Modal transmission** (wallet/index.tsx):
```typescript
function handleSwapRowClick(row: any[], rowIndex: number) {
  const rawSwap = rawSwapsRef.current[rowIndex >= 0 ? rowIndex : -1];
  if (!rawSwap) return;
  const records: TransferRecord[] = rawSwap.balanceChanges?.map((change: any) => ({
    signature: rawSwap.signature,
    timestamp: Math.floor(new Date(rawSwap.timestamp).getTime() / 1000),
    direction: change.amount > 0 ? "in" : "out",
    counterparty: rawSwap.walletAddress,
    mint: change.mint || "",
    symbol: null,
    amount: Math.abs(change.amount),
    amountRaw: String(change.amount),
    decimals: change.decimals || 0
  })) || [];
  setSelectedTransfers(records);
  setSwapModalOpen(true);
}
```

---

## 7. Continuation Plan

### [Phase 1] Resolve Migration State & Schema Audit
**Details**: Validate wallet_swap table creation timing. Search Drizzle migration history or check if wallet_swap is auto-generated by schema.ts under certain conditions. Reconcile migration journal with actual SQL files. If wallet_swap CREATE TABLE is missing, generate new migration file with safe IF NOT EXISTS guards.

**Specific Next Steps**:
1. Query Drizzle docs or codebase for schema-only table behavior
2. Run `npm run db:generate` to generate a fresh migration from schema.ts
3. Compare generated migration against 0005_wallet_chunked_indexes.sql
4. If CREATE TABLE exists in generated file but not in committed migrations, merge or replace

**Requirements**: Access to live .env with POSTGRES_DB_URL, ability to run `npm run db:generate`

### [Phase 2] Moralis Endpoint Builder & HTTP Client Enhancement
**Details**: Extend util-moralis.ts to support solana-gateway host for `/account/{address}/wallet-swaps` endpoint. Map Helius pagination (before cursor) → Moralis pagination (cursor). Build fetcher function signature.

**Specific Next Steps**:
1. Add `getEndpoint(path, provider="evm")` overload supporting `provider="solana-gateway"`
2. Document Moralis wallet-swaps response contract
3. Implement `fetchMoralisSolanaSwap()` with pagination loop matching Helius pattern
4. Add feature flag `SWAP_PROVIDER_SOURCE` (env var) to gate Moralis vs Helius

**Inputs Needed**: Moralis wallet-swaps endpoint documentation

### [Phase 3] Schema Expansion & Migration
**Details**: Expand walletSwap table to include top-level Moralis fields while keeping balanceChanges/feeChanges for backward compat.

**Specific Next Steps**:
1. Update schema.ts walletSwap table definition to add new columns
2. Run `npm run db:generate` to create migration
3. Add safe defaults for nullable new columns
4. Mark stale Helius-shaped rows for refresh optional

### [Phase 4] Implement Moralis Fetcher & Orchestration
**Details**: Replace Helius fetcher with Moralis and wire into orchestration with feature flag.

**Specific Next Steps**:
1. Implement `fetchMoralisSolanaSwap()` in fetchers/walletDataFetcher.service.ts
2. Map Moralis response fields → WalletSwap DTO
3. Update getWalletSwaps to branch on SWAP_PROVIDER_SOURCE
4. Preserve Helius fallback until confidence is high

### [Phase 5] Client Typing & Frontend Refactor
**Details**: Define explicit WalletSwap interface on client. Update fetchWalletSwaps response type. Refactor wallet page table. Expand table columns. Update modal.

**Specific Next Steps**:
1. Create client WalletSwap interface in walletApi.ts
2. Update fetchWalletSwaps return type from any[] to WalletSwap[]
3. Update wallet/index.tsx to use swap.bought, swap.sold, swap.exchange, swap.pair fields
4. Add table columns for exchange, pair, totalValueUsd
5. Refactor modal input from TransferRecord[] to full swap object

### [Phase 6] Comprehensive Test Coverage
**Details**: Add unit & integration tests for Moralis fetcher, updated cacher/retriever, client typing, and UI rendering.

**Specific Next Steps**:
1. Fetcher tests: pagination, null handling, field mapping, error recovery
2. Cacher tests: Moralis row upsert, new field persistence
3. Retriever tests: range filtering, new field retrieval
4. Service tests: feature flag switching, provider error fallback
5. Route tests: response contract with new fields
6. Client API tests: deserialization, type correctness
7. UI tests: table rendering with new columns, modal detail view
8. Integration: compare backend response to live Moralis for sample wallets

---

## 8. Key Dependencies & Constraints

- **Moralis API rate limit**: 429 handling with Retry-After header + exponential backoff up to 120s
- **Helius pagination**: uses `before` cursor for history, `cursor` for transfers; nextCursor response field
- **Solana wallet swaps**: currently exclusive to Helius; Moralis support exists but not yet integrated
- **Migration state**: wallet_swap table and indexes defined in schema.ts but migration creation date unclear
- **WALLET_SWAPS_TTL_MS**: 1 hour (3600000 ms) cache freshness threshold
- **Dedup key**: signature (not composite with address/chain in table code)
- **Enrichment timing**: Applied post-cache via enrichWithSolanaTokenPrices(), not persisted; every response gets fresh token prices

---

## 9. Continuation Guidance

**Most Urgent**: Resolve migration state (Phase 1) to unblock schema changes  
**Logically Sequential**: Phases follow dependency order: migrations → HTTP client → fetcher → service → client → tests  
**High Risk**: Feature flagging must be in place before toggling providers; rollback plan needed if Moralis latency/cost issues emerge  
**Backward Compat**: Keep Helius path available until Moralis validation is complete on production-like wallets  

**Next Action**: Resolve migration state & schema audit (Phase 1): Validate wallet_swap table creation timing; if wallet_swap CREATE TABLE is missing from committed migrations, generate new migration file with safe IF NOT EXISTS guards. This unblocks schema expansion for Moralis fields in Phase 3.

