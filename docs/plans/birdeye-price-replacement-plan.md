# Birdeye Price Data Replacement Plan

## Problem

- **CoinGecko tools in chat** (`get_token_price*`) return empty data for most Solana tokens (no CG ID)
- **AI context** (`token-ai-context.ts` `readChartSummary`) returns empty chart summary for the same reason
- **LLM can't analyze price movements** because it has no reliable price data for the tokens being discussed
- **ECharts price charts** rendered in `WalletChatMessage` are empty/broken when CoinGecko has no data
- **User can't visually see price** action in the chat panel during token discussion

## Solution

### Two-pronged approach

| Problem | Solution | Mechanism |
|---|---|---|
| LLM has no price data | Replace CoinGecko with Birdeye in chat tools + AI context | New `birdeye-chart-data.ts` service, updated tool handlers |
| User can't see price visually | Render GeckoTerminal iframe inside chat messages | New `"geckoterminal"` chart type flows through existing `<chart />` marker pipeline |

## Architecture

### Revised `chartEmbed` — as a ChartSpec type

Instead of a separate `chartEmbed` field in `ChatResponse`, we extend `ChartSpec` with a `"geckoterminal"` type:

```
ChartSpec {
  id: string
  type: "line" | "bar" | "area" | "pie" | "geckoterminal"   ← NEW type
  dataRef: string
  tokenAddress?: string   ← for geckoterminal type, identifies the token
  poolAddress?: string    ← for geckoterminal type, resolved server-side
  ...
}
```

This means:
- GeckoTerminal iframes flow through the exact same `<chart id="..." />` marker pipeline
- The LLM generates `<chart id="token_chart" />` with `type: "geckoterminal"`
- The `ChartRenderer` in `WalletChatMessage.tsx` switches on type and renders an iframe
- The orchestrator resolves `poolAddress` from the token address before serializing to the client

### Data Flow

```
User asks "What's BONK doing?"
  │
  ▼
LLM selects: [search_token("BONK"), get_token_price_24h("BONK_address")]
  │
  ▼
TOOL_HANDLERS execute:
  - get_token_price_24h → getBirdeyeChartData("BONK_address", "24h")
  │                      returns [{unixTimestampMs, price}, ...]
  ▼
generateResponse() builds chart specs:
  - Checks tool results for token price data
  - Calls getTokenTopPools(tokenAddress) to resolve poolAddress
  - Creates ChartSpec { type: "geckoterminal", tokenAddress, poolAddress }
  - Includes in response.charts[]
  │
  ▼
LLM generates text with <chart id="..." /> marker referencing geckoterminal chart
  │
  ▼
Frontend WalletChatMessage renders:
  - ChartRenderer detects type === "geckoterminal" 
  - Renders <GeckoTerminalChart poolAddress={...} /> instead of ECharts
```

## Files Changed

### 1. NEW: `server/src/services/wallet/providers/birdeye-chart-data.ts`

Birdeye price history service with DB caching.

```typescript
// Core functions:

fetchBirdeyePriceHistory(
  address: string,
  fromSec: number,
  toSec: number,
  interval: "15m" | "1H" | "4H" | "1D",
): Promise<void>

getBirdeyeChartData(
  address: string,
  timeframe: string | number,  // "24h" | 7 | 30 | 90 | 365
): Promise<{ unixTimestampMs: number; price: number }[]>
```

**Interval mapping:**
| Timeframe | Birdeye type |
|---|---|
| "24h" (1 day) | `"15m"` |
| 2-7 days | `"1H"` |
| 8-30 days | `"4H"` |
| 31+ days | `"1D"` |

**Resolution order:** DB cache → Birdeye API → CoinGecko fallback (reuses existing `tokenMarketChartHourly`/`tokenMarketChartDaily` tables)

### 2. EDIT: `server/src/services/chat/chat.tools.ts`

**4 handler replacements:**
- `get_token_price` → Birdeye `/defi/token_overview` + CoinGecko fallback
- `get_token_price_24h` → `getBirdeyeChartData(addr, "24h")`
- `get_token_price_hourly` → `getBirdeyeChartData(addr, days)`
- `get_token_price_daily` → `getBirdeyeChartData(addr, days)`

**Tool description updates** — add "Covers all Solana tokens via Birdeye" to each description so the LLM knows they work universally.

### 3. EDIT: `server/src/services/chat/chat.types.ts`

```typescript
// Extend ChartSpec with geckoterminal type
interface ChartSpec {
  id: string;
  type: "line" | "bar" | "area" | "pie" | "geckoterminal";
  dataRef: string;
  title?: string;
  limit?: number;
  pointActions?: DataActionSpec;
  xAxisType?: "category" | "time";
  yAxisFormat?: "currency" | "decimal" | "percent" | "compact-currency";
  xAxisFormat?: "datetime" | "date" | "time";
  // geckoterminal-specific:
  tokenAddress?: string;
  poolAddress?: string;
}
```

### 4. EDIT: `server/src/services/chat/chat.prompts.ts`

**In `buildResponseGenerationPrompt` — CHART SPEC FIELDS section** (around line 235):

Add geckoterminal chart type documentation:
```
- type: "geckoterminal": renders an interactive GeckoTerminal price chart (iframe).
  Use this when your answer discusses a specific token's price movement.
  Set tokenAddress to the token mint address.
  Do NOT set dataRef — geckoterminal charts don't use transformed data.
  Only use when price discussion is central to the answer.
```

### 5. EDIT: `server/src/services/chat/chat.orchestrator.ts`

In `generateResponse()` after building `resolvedData` (line ~394):

```typescript
// Step: resolve pool addresses for geckoterminal chart specs
for (const chart of charts) {
  if (chart.type === "geckoterminal" && chart.tokenAddress) {
    const pools = await getTokenTopPools(chart.tokenAddress);
    const topPool = pools[0]?.data as { poolAddress?: string } | undefined;
    if (topPool?.poolAddress) {
      chart.poolAddress = topPool.poolAddress;
    }
  }
}
```

### 6. EDIT: `server/src/services/chat/data-transformers.ts`

No structural changes needed — the transformers already work with the standard `{unixTimestampMs, price}[]` shape. The `tokenAddress` preservation is handled at the tool handler level (already in the tool input).

### 7. EDIT: `server/src/services/tokens/token-ai-context.ts`

Replace `readChartSummary()`:
- Try `getBirdeyeChartData(address, timeframe)` first
- If empty/error, fall back to existing `get24h/getHourly/getDailyTokenMarketChart`
- Update evidence source: `"Birdeye Solana price feed"` or `"CoinGecko (fallback)"`

### 8. EDIT: `client/src/components/wallet/WalletChat/types.ts`

```typescript
// Sync ChartSpec with server type
export interface ChartSpec {
  id: string;
  type: "line" | "bar" | "area" | "pie" | "geckoterminal";
  dataRef: string;
  title?: string;
  limit?: number;
  pointActions?: DataActionSpec;
  xAxisType?: "category" | "time";
  yAxisFormat?: "currency" | "decimal" | "percent" | "compact-currency";
  xAxisFormat?: "datetime" | "date" | "time";
  tokenAddress?: string;
  poolAddress?: string;
}
```

### 9. EDIT: `client/src/components/wallet/WalletChat/WalletChatMessage.tsx`

In the chart rendering section (around line 664):

```tsx
} else if (only.type === "chart" && message.data && only.id) {
  const spec = message.charts?.find((c) => c.id === only.id) ?? {
    id: only.id, type: "line" as const, dataRef: only.id,
  };
  // NEW: handle geckoterminal chart type
  if (spec.type === "geckoterminal" && spec.poolAddress) {
    elements.push(
      <GeckoTerminalChart
        key={`gc-${only.id}`}
        poolAddress={spec.poolAddress}
        height="200"
      />
    );
  } else {
    elements.push(
      <ChartRenderer key={`c-${only.id}`} spec={spec} data={message.data} onAction={onAction} />,
    );
  }
```

Also import `GeckoTerminalChart`:
```tsx
import { GeckoTerminalChart } from "@/components/charts/GeckoTerminalChart";
```

## No Changes Needed

- No new DB tables
- No new env vars
- No new npm packages
- No changes to `token-chart.ts` (existing Birdeye fetch reused)
- No changes to `resolve-token-price.ts` (separate concern)
- No changes to `walletEnrichment.service.ts` (separate concern)
