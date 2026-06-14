# Multi-Wallet Chat — Fan-Out Architecture

Status: **Planned** (Jun 2026)
Est. effort: ~3 days dev (solo), ~1.5 days if 2-3 devs in parallel

## Goal

Enable the comparison page chat to query **all selected wallets simultaneously**. When a user asks "which wallet has better PnL?" or "show me holdings across all wallets", the backend fetches data for every wallet and returns merged/comparison-aware results.

## Architecture Decision

**Fan-out pattern**: The orchestrator runs each selected Gemini tool once per wallet address (in parallel via `Promise.all`) and merges results. This reuses 100% of existing tool handlers and data extractors — no new tool definitions needed.

```
User query "which wallet has better PnL?"
         │
         ▼
  answerChatQuery(["walletA", "walletB"], query, lang, history)
         │
         ├─ Cache lookup (key = sorted addresses + query + fingerprint)
         │
         ├─ Tool selection loop (max 3 iterations)
         │      │
         │      ├─ Gemini selects: get_wallet_overview, get_wallet_pnl
         │      │
         │      └─ Fan-out per address:
         │            get_wallet_overview("walletA") ─┐
         │            get_wallet_overview("walletB") ─┤  Promise.all
         │            get_wallet_pnl("walletA") ──────┤  (parallel)
         │            get_wallet_pnl("walletB") ──────┘
         │                         │
         │                    Merge → [{address, data}, ...]
         │                         │
         │                    Feed merged data back to Gemini
         │
         ├─ Generate final response (text + charts + tables)
         │
         └─ Cache write → response to client
```

## Dependency Graph

```
Phase 0: Types + Route schema  ← must go first
  │
  ├── Stream C: isWalletTool() helper  (10 min, no deps)
  │
  ├── Stream A: Orchestrator + Cache   (3h, needs Phase 0 + C)
  │
  ├── Stream B: Prompts + Intent       (3h, needs Phase 0 only)
  │
  ├── Stream D: Frontend               (3h, needs Phase 0 only)
  │
  └── Phase 2: Fallback                (2h, needs Stream A + B)
```

## File-by-File Changes

### Phase 0 — Types + Route (~30 min)

**`server/src/services/chat/chat.types.ts`**
- `ChatRequest.address: string` → `ChatRequest.addresses: string[]`

**`server/src/routes/chat.route.ts`**
- Zod schema: `addresses: z.array(z.string().min(32).max(48)).min(1).max(10)`
- Pass `addresses` (plural) to `answerChatQuery`

### Stream C — Tools helper (~10 min)

**`server/src/services/chat/chat.tools.ts`**
- Add `isWalletTool(name: string): boolean`
- Returns `true` for the 12 wallet-scoped tools (overview, swaps, transfers, etc.), `false` for global tools (token price, search, nav)

### Stream A — Orchestrator + Cache (~3h)

**`server/src/services/chat/chat.orchestrator.ts`**

| Change | Detail |
|---|---|
| `answerChatQuery(addresses: string[], ...)` | Accept array instead of single string |
| New `executeToolsForAllAddresses()` | For each selected tool: if `isWalletTool`, call handler per address via `Promise.all`; merge into `{ address: data }` shape |
| `selectTool()` call | Pass `addresses` array (rendered in prompt as indexed list) |
| Cache lookup | Key includes sorted `addresses.join("\|")` |
| Data fingerprint | Hash latest tx across ALL addresses |

Merge shape for a single tool result:
```ts
{
  name: "get_wallet_overview",
  input: { addresses: ["addr1", "addr2"] },
  data: {
    "addr1": { /* LLM extract */ },
    "addr2": { /* LLM extract */ }
  },
  fullData: {
    "addr1": { /* raw service response */ },
    "addr2": { /* raw service response */ }
  }
}
```

**`server/src/services/chat/chat.cache.ts`**
- `computeDataFingerprint(addresses: string[])`: parallel-fetch latest swap for each address, combined hash
- Cache key: `addresses.sort().join("|") + query + model + fingerprint + historyHash + intent`

### Stream B — Prompts + Intent (~3h)

**`server/src/services/chat/chat.prompts.ts`**

Tool selection prompt — replace single address line with:
```
You are analyzing ${n} wallets:
[0] ${addr1}
[1] ${addr2}
...
When you select a wallet-scoped tool, it runs for ALL wallets.
Results are labeled by address index [0], [1], etc.
```

System instruction — augment with comparison guidance:
```
When the user compares multiple wallets, highlight:
- Which wallet performs better (PnL, win rate, volume)
- Unique tokens / common holdings
- Risk differences between wallets
Use side-by-side tables when appropriate.
```

**`server/src/services/chat/chat-intent.ts`**
- Add `"comparison"` intent: `/compare|vs\b|versus|difference|which (is|has|performed)|so sánh|khác nhau|hơn/i`

### Stream D — Frontend (~3h)

**`client/src/components/wallet/WalletChat/WalletChat.tsx`**
- Extend `Props` with optional `addresses?: string[]`
- When provided:
  - Show wallet selector dropdown in header
  - `chatWalletAddress` defaults to `addresses[0]`
  - API call sends `{ addresses: [activeWallet] }` for single-wallet queries
  - API call sends `{ addresses }` (all wallets) for comparison-sounding queries
- Simple heuristic for comparison query detection (regex match on query text)

**`client/src/pages/walletsComparison/index.tsx`**
- Update `WalletChat` usage:
```tsx
<WalletChat
  addresses={selectedWallets}
  address={chatWalletAddress}
  onAddressChange={setChatWalletAddress}
  lang={lang}
  variant="sidebar"
  chatPosition="left"
  onChatPositionChange={() => {}}
/>
```
- Remove the manual wallet selector (`<select>`) from chat header (now handled by WalletChat)

**No changes needed to** `client/src/api/main.ts` — types auto-update from `ChatAppType` inference.

### Phase 2 — Fallback (~2h)

**`server/src/services/chat/chat-fallback.ts`**
- New `buildComparisonSections(allResults, language)`:
  1. Extract per-address overview, PnL, portfolio from merged `{ address: data }` results
  2. Build side-by-side comparison sections:
     - Metrics table (PnL, volume, win rate per wallet)
     - Holdings comparison (common tokens + unique tokens)
     - Risk comparison
  3. Include evidence per wallet
- Update `buildWalletFallbackResponse` to dispatch to `buildComparisonSections` when data contains multiple addresses

## Existing Code That Can Be Reused

| Module | What it provides | How to use |
|---|---|---|
| `walletComparison.ts` | `mapWithConcurrency()` + per-wallet mappers | Already matches the fan-out pattern — use same pattern |
| Chart services (`pnlChart`, `winrate`, `dailyTradingVolume`) | Multi-wallet data fetchers returning `{ wallets: [...] }` | Fallback can use these directly for richer comparison data |
| `buildEvidence()`, `buildWarnings()`, `computeConfidence()` | Evidence/warnings/confidence helpers | Can be adapted to work per-address |
| `findResult()`, `findResultArray()` | Locate tool results by name | Already works with merged results array |

## Parallel Execution Plan (Single Dev)

| Step | What | Time |
|---|---|---|
| 1 | Phase 0 + Stream C (types, route, isWalletTool) | 40 min |
| 2 | Stream A (orchestrator + cache) | 3 h |
| 3 | Stream B (prompts + intent) | 3 h |
| 4 | Stream D (frontend) | 3 h |
| 5 | Phase 2 (fallback) | 2 h |

Steps 2-4 can be interleaved (no ordering dependencies between A, B, D).

## Parallel Execution Plan (2-3 Devs)

| Dev | Work |
|---|---|
| Dev 1 | Phase 0 → Stream A → Phase 2 |
| Dev 2 | Stream B (starts after Phase 0) |
| Dev 3 | Stream D (starts after Phase 0) |

Stream C can be done by anyone during Phase 0 (~10 min).
